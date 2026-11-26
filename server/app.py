from flask import Flask, request, render_template_string, jsonify
from datetime import datetime
import sqlite3
import os
from contextlib import closing

app = Flask(__name__)

# Permitir comunicación desde el frontend servido por Live Server.
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
    return response

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "studyplan_remote.db")

def get_db_connection():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection

def add_column_if_missing(connection, table, column, definition):
    columns = [row["name"] for row in connection.execute(f"PRAGMA table_info({table})")]
    if column not in columns:
        connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")

def initialize_database():
    connection = get_db_connection()
    connection.execute("""CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, teacher TEXT, schedule TEXT, color TEXT,
        created_at TEXT NOT NULL
    )""")
    # Migración segura: conserva las materias que ya existían.
    add_column_if_missing(connection, "subjects", "local_id", "INTEGER")
    connection.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_local_id ON subjects(local_id)")
    connection.execute("""CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        local_id INTEGER UNIQUE,
        title TEXT NOT NULL, description TEXT, subject_id INTEGER,
        due_date TEXT, priority TEXT, completed INTEGER DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT
    )""")
    connection.execute("""CREATE TABLE IF NOT EXISTS grades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        local_id INTEGER UNIQUE,
        title TEXT NOT NULL, subject_id INTEGER,
        score REAL NOT NULL, weight REAL NOT NULL, grade_date TEXT,
        created_at TEXT NOT NULL, updated_at TEXT
    )""")
    connection.commit()
    connection.close()

initialize_database()

REPORTE_HTML = """<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Reporte - StudyPlan</title></head><body>
<h1>StudyPlan</h1><h2>Generador de reportes académicos</h2>
<form method="POST"><label>Nombre de la materia:</label><input type="text" name="materia" required><button type="submit">Generar reporte</button></form>
{% if materia %}<h3>Reporte generado correctamente</h3><p>Materia: {{ materia }}</p><p>Fecha: {{ fecha }}</p><p>Información procesada por el servidor.</p>{% endif %}
</body></html>"""

@app.route("/")
def home():
    return '<h1>StudyPlan - Servidor Flask</h1><p>Servidor funcionando correctamente.</p><a href="/reporte">Abrir generador de reportes</a><p><a href="/api/subjects">API materias</a> | <a href="/api/tasks">API tareas</a> | <a href="/api/grades">API calificaciones</a></p>'

@app.route("/reporte", methods=["GET", "POST"])
def reporte():
    materia = request.form.get("materia", "").strip() if request.method == "POST" else None
    fecha = datetime.now().strftime("%d/%m/%Y %H:%M") if materia else None
    return render_template_string(REPORTE_HTML, materia=materia, fecha=fecha)

# SUBJECTS
@app.route("/api/subjects", methods=["GET"])
def get_subjects():
    with closing(get_db_connection()) as connection:
        rows = connection.execute("SELECT * FROM subjects ORDER BY id DESC").fetchall()
    return jsonify(success=True, subjects=[dict(row) for row in rows])

@app.route("/api/subjects", methods=["POST"])
def create_subject():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    if not name:
        return jsonify(success=False, message="El nombre de la materia es obligatorio."), 400
    local_id = data.get("local_id")
    now = datetime.now().isoformat()
    with closing(get_db_connection()) as connection:
        if local_id is not None:
            connection.execute("""INSERT INTO subjects(local_id,name,teacher,schedule,color,created_at)
                VALUES(?,?,?,?,?,?) ON CONFLICT(local_id) DO UPDATE SET
                name=excluded.name, teacher=excluded.teacher, schedule=excluded.schedule, color=excluded.color""",
                (int(local_id), name, data.get("teacher", ""), data.get("schedule", ""), data.get("color", ""), now))
            row = connection.execute("SELECT id FROM subjects WHERE local_id=?", (int(local_id),)).fetchone()
            remote_id = row["id"]
        else:
            cursor = connection.execute("INSERT INTO subjects(name,teacher,schedule,color,created_at) VALUES(?,?,?,?,?)",
                (name, data.get("teacher", ""), data.get("schedule", ""), data.get("color", ""), now))
            remote_id = cursor.lastrowid
        connection.commit()
    return jsonify(success=True, message="Materia guardada en el servidor.", id=remote_id), 201

@app.route("/api/subjects/<int:local_id>", methods=["DELETE"])
def delete_subject(local_id):
    with closing(get_db_connection()) as connection:
        cursor = connection.execute("DELETE FROM subjects WHERE local_id=?", (local_id,))
        connection.commit()
    return jsonify(success=True, deleted=cursor.rowcount)

# TASKS
@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    with closing(get_db_connection()) as connection:
        rows = connection.execute("SELECT * FROM tasks ORDER BY id DESC").fetchall()
    return jsonify(success=True, tasks=[dict(row) for row in rows])

@app.route("/api/tasks", methods=["POST"])
def create_task():
    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip()
    if not title:
        return jsonify(success=False, message="El título de la tarea es obligatorio."), 400
    local_id = data.get("local_id")
    now = datetime.now().isoformat()
    values = (title, data.get("description", ""), data.get("subject_id"), data.get("due_date", ""),
              data.get("priority", "media"), 1 if data.get("completed") else 0,
              data.get("created_at") or now, data.get("updated_at") or now)
    with closing(get_db_connection()) as connection:
        if local_id is None:
            cursor = connection.execute("""INSERT INTO tasks(title,description,subject_id,due_date,priority,completed,created_at,updated_at)
                VALUES(?,?,?,?,?,?,?,?)""", values)
            remote_id = cursor.lastrowid
        else:
            connection.execute("""INSERT INTO tasks(local_id,title,description,subject_id,due_date,priority,completed,created_at,updated_at)
                VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(local_id) DO UPDATE SET title=excluded.title,
                description=excluded.description,subject_id=excluded.subject_id,due_date=excluded.due_date,
                priority=excluded.priority,completed=excluded.completed,updated_at=excluded.updated_at""",
                (int(local_id),) + values)
            remote_id = connection.execute("SELECT id FROM tasks WHERE local_id=?", (int(local_id),)).fetchone()["id"]
        connection.commit()
    return jsonify(success=True, message="Tarea guardada en el servidor.", id=remote_id), 201

@app.route("/api/tasks/<int:local_id>", methods=["DELETE"])
def delete_task(local_id):
    with closing(get_db_connection()) as connection:
        cursor = connection.execute("DELETE FROM tasks WHERE local_id=?", (local_id,))
        connection.commit()
    return jsonify(success=True, deleted=cursor.rowcount)

# GRADES
@app.route("/api/grades", methods=["GET"])
def get_grades():
    with closing(get_db_connection()) as connection:
        rows = connection.execute("SELECT * FROM grades ORDER BY id DESC").fetchall()
    return jsonify(success=True, grades=[dict(row) for row in rows])

@app.route("/api/grades", methods=["POST"])
def create_grade():
    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip()
    try:
        score, weight = float(data.get("score")), float(data.get("weight"))
    except (TypeError, ValueError):
        return jsonify(success=False, message="Calificación y ponderación deben ser números."), 400
    if not title or score < 0 or score > 10 or weight <= 0 or weight > 100:
        return jsonify(success=False, message="Verifica título, calificación (0-10) y ponderación (0-100)."), 400
    local_id = data.get("local_id")
    now = datetime.now().isoformat()
    values = (title, data.get("subject_id"), score, weight, data.get("grade_date", ""),
              data.get("created_at") or now, data.get("updated_at") or now)
    with closing(get_db_connection()) as connection:
        if local_id is None:
            cursor = connection.execute("INSERT INTO grades(title,subject_id,score,weight,grade_date,created_at,updated_at) VALUES(?,?,?,?,?,?,?)", values)
            remote_id = cursor.lastrowid
        else:
            connection.execute("""INSERT INTO grades(local_id,title,subject_id,score,weight,grade_date,created_at,updated_at)
                VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(local_id) DO UPDATE SET title=excluded.title,
                subject_id=excluded.subject_id,score=excluded.score,weight=excluded.weight,
                grade_date=excluded.grade_date,updated_at=excluded.updated_at""",
                (int(local_id),) + values)
            remote_id = connection.execute("SELECT id FROM grades WHERE local_id=?", (int(local_id),)).fetchone()["id"]
        connection.commit()
    return jsonify(success=True, message="Calificación guardada en el servidor.", id=remote_id), 201

@app.route("/api/grades/<int:local_id>", methods=["DELETE"])
def delete_grade(local_id):
    with closing(get_db_connection()) as connection:
        cursor = connection.execute("DELETE FROM grades WHERE local_id=?", (local_id,))
        connection.commit()
    return jsonify(success=True, deleted=cursor.rowcount)

if __name__ == "__main__":
    app.run(debug=True, port=5000)
