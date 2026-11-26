
// ==========================================
// STUDYPLAN - MÓDULO DE TAREAS
// ==========================================

let editingTaskId = null;

// INICIALIZAR MÓDULO
document.addEventListener("DOMContentLoaded", () => {
    const addButton = document.getElementById("add-task");
    const form = document.getElementById("task-form");
    const cancelButton = document.getElementById("cancel-task");
    const remoteTasksButton = document.getElementById("load-tasks-remote");

remoteTasksButton?.addEventListener("click", loadRemoteTasks);

    addButton?.addEventListener("click", openTaskForm);
    form?.addEventListener("submit", saveTask);
    cancelButton?.addEventListener("click", closeTaskForm);

    loadTasks();
});

// ==========================================
// CONSULTAR TAREAS DEL SERVIDOR
// ==========================================

async function loadRemoteTasks() {
    const container = document.getElementById("tasks-list");

    if (!container) return;

    try {
        const response = await fetch(
            "http://127.0.0.1:5000/api/tasks"
        );

        if (!response.ok) {
            throw new Error("No se pudieron consultar las tareas.");
        }

        const data = await response.json();

        console.log("Tareas del servidor:", data);

        alert(
            `Consulta exitosa. Tareas encontradas: ${
                (data.tasks || []).length
            }`
        );

    } catch (error) {
        console.error("Error consultando tareas remotas:", error);
        alert("No se pudieron consultar las tareas del servidor.");
    }
}

// REGISTRAR OPERACIÓN EN LA COLA DE SINCRONIZACIÓN
async function registerTaskSync(operation, taskData) {
    try {
        if (typeof window.addPendingSync !== "function") {
            console.warn("El módulo de sincronización no está disponible.");
            return;
        }

        await window.addPendingSync("tasks", operation, taskData);

    } catch (error) {
        console.error("Error registrando sincronización de tarea:", error);
    }
}

// ABRIR FORMULARIO
async function openTaskForm() {
    const form = document.getElementById("task-form");

    form.reset();
    editingTaskId = null;

    document.getElementById("task-form-title").textContent = "Agregar tarea";
    document.getElementById("task-priority").value = "media";

    const today = new Date();

    const localDate = new Date(
        today.getTime() - today.getTimezoneOffset() * 60000
    ).toISOString().slice(0, 10);

    document.getElementById("task-date").value = localDate;

    await loadSubjectOptions();

    document.getElementById("task-form-container")
        .classList.remove("hidden");
}

// CARGAR MATERIAS EN EL SELECT
async function loadSubjectOptions(selectedId = "") {
    const select = document.getElementById("task-subject");

    if (!select) return;

    try {
        const subjects = await getAllRecords("subjects");

        select.innerHTML = `
            <option value="">Sin materia asignada</option>
            ${subjects.map(subject => `
                <option value="${subject.id}">
                    ${escapeTaskHTML(subject.name)}
                </option>
            `).join("")}
        `;

        select.value = selectedId ? String(selectedId) : "";

    } catch (error) {
        console.error("Error al cargar materias para tareas:", error);
    }
}

// CERRAR FORMULARIO
function closeTaskForm() {
    document.getElementById("task-form-container")
        ?.classList.add("hidden");

    editingTaskId = null;
}

// GUARDAR TAREA
async function saveTask(event) {
    event.preventDefault();

    const title = document.getElementById("task-name").value.trim();

    if (!title) {
        alert("Escribe el nombre de la tarea.");
        return;
    }

    const subjectValue = document.getElementById("task-subject").value;

    const task = {
        title,
        description: document.getElementById("task-description").value.trim(),
        subjectId: subjectValue ? Number(subjectValue) : null,
        dueDate: document.getElementById("task-date").value,
        priority: document.getElementById("task-priority").value,
        completed: false,
        updatedAt: new Date().toISOString()
    };

    const wasEditing = editingTaskId !== null;
    const operation = wasEditing ? "update" : "create";

    try {
        if (wasEditing) {
            const existingTasks = await getAllRecords("tasks");

            const existingTask = existingTasks.find(
                item => item.id === editingTaskId
            );

            if (!existingTask) {
                alert("No se encontró la tarea que deseas editar.");
                return;
            }

            task.id = editingTaskId;
            task.completed = existingTask.completed;
            task.createdAt = existingTask.createdAt;

        } else {
            task.createdAt = new Date().toISOString();
        }

        await saveRecord("tasks", task);

        // Recuperar el ID generado para una tarea nueva.
        let savedTask = task;

        if (!wasEditing) {
            const allTasks = await getAllRecords("tasks");

            savedTask = allTasks.find(item =>
                item.updatedAt === task.updatedAt &&
                item.title === task.title
            ) || task;
        }

        // Registrar creación o edición.
        await registerTaskSync(operation, savedTask);

        closeTaskForm();
        await loadTasks();

        alert(wasEditing
            ? "Tarea actualizada correctamente."
            : "Tarea guardada correctamente.");

    } catch (error) {
        console.error("Error al guardar tarea:", error);
        alert("No se pudo guardar la tarea.");
    }
}

// CARGAR Y MOSTRAR TAREAS
async function loadTasks() {
    const container = document.getElementById("tasks-list");

    if (!container) return;

    try {
        const tasks = await getAllRecords("tasks");
        const subjects = await getAllRecords("subjects");

        const subjectMap = new Map(
            subjects.map(subject => [subject.id, subject.name])
        );

        tasks.sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;

            return a.dueDate.localeCompare(b.dueDate);
        });

        if (tasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>¡Todavía no tienes tareas!</h3>
                    <p>Agrega tu primera actividad para comenzar a organizarte.</p>
                </div>
            `;
        } else {
            container.innerHTML = tasks.map(task => {
                const priority = ["baja", "media", "alta"].includes(task.priority)
                    ? task.priority
                    : "media";

                return `
                    <article class="task-card ${task.completed ? "completed" : ""}">
                        <div class="task-card-header">
                            <div>
                                <h3>${escapeTaskHTML(task.title)}</h3>
                                <p class="task-subject">
                                    ${escapeTaskHTML(
                                        subjectMap.get(task.subjectId) || "Sin materia"
                                    )}
                                </p>
                            </div>

                            <span class="task-priority priority-${priority}">
                                ${priority.toUpperCase()}
                            </span>
                        </div>

                        <p>${escapeTaskHTML(task.description || "Sin descripción")}</p>

                        <p class="task-date">
                            <strong>Entrega:</strong>
                            ${formatTaskDate(task.dueDate)}
                        </p>

                        <div class="task-actions">
                            <button type="button"
                                onclick="toggleTaskCompleted(${task.id})">
                                ${task.completed ? "Reabrir tarea" : "Completar"}
                            </button>

                            <button type="button"
                                onclick="editTask(${task.id})">
                                Editar
                            </button>

                            <button type="button"
                                onclick="deleteTask(${task.id})">
                                Eliminar
                            </button>
                        </div>
                    </article>
                `;
            }).join("");
        }

        updateTaskCounters(tasks);
        updateUpcomingTasks(tasks, subjectMap);

    } catch (error) {
        console.error("Error al cargar tareas:", error);
        container.innerHTML = "<p>No se pudieron cargar las tareas.</p>";
    }
}

// EDITAR TAREA
async function editTask(id) {
    try {
        const tasks = await getAllRecords("tasks");
        const task = tasks.find(item => item.id === id);

        if (!task) return;

        editingTaskId = id;

        document.getElementById("task-name").value = task.title;
        document.getElementById("task-description").value = task.description || "";
        document.getElementById("task-date").value = task.dueDate || "";
        document.getElementById("task-priority").value = task.priority || "media";

        await loadSubjectOptions(task.subjectId);

        document.getElementById("task-form-title").textContent = "Editar tarea";

        document.getElementById("task-form-container")
            .classList.remove("hidden");

    } catch (error) {
        console.error("Error al editar tarea:", error);
        alert("No se pudo abrir la tarea.");
    }
}

// MARCAR COMO COMPLETADA O PENDIENTE
async function toggleTaskCompleted(id) {
    try {
        const tasks = await getAllRecords("tasks");
        const task = tasks.find(item => item.id === id);

        if (!task) return;

        task.completed = !task.completed;
        task.updatedAt = new Date().toISOString();

        await saveRecord("tasks", task);

        // Registrar el cambio de estado.
        await registerTaskSync("update", task);

        await loadTasks();

    } catch (error) {
        console.error("Error al actualizar el estado de la tarea:", error);
    }
}

// ELIMINAR TAREA
async function deleteTask(id) {
    if (!confirm("¿Seguro que deseas eliminar esta tarea?")) return;

    try {
        const tasks = await getAllRecords("tasks");
        const taskToDelete = tasks.find(item => item.id === id);

        await deleteRecord("tasks", id);

        // Registrar eliminación antes de perder los datos.
        if (taskToDelete) {
            await registerTaskSync("delete", taskToDelete);
        }

        await loadTasks();

        alert("Tarea eliminada correctamente.");

    } catch (error) {
        console.error("Error al eliminar tarea:", error);
        alert("No se pudo eliminar la tarea.");
    }
}

// ACTUALIZAR CONTADORES DEL PANEL PRINCIPAL
function updateTaskCounters(tasks) {
    const pending = tasks.filter(task => !task.completed).length;
    const completed = tasks.filter(task => task.completed).length;

    const pendingElement = document.getElementById("total-pending");
    const completedElement = document.getElementById("total-completed");

    if (pendingElement) pendingElement.textContent = pending;
    if (completedElement) completedElement.textContent = completed;
}

// ACTUALIZAR PRÓXIMAS TAREAS DEL INICIO
function updateUpcomingTasks(tasks, subjectMap) {
    const container = document.getElementById("upcoming-tasks");

    if (!container) return;

    const upcoming = tasks
        .filter(task => !task.completed)
        .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
        .slice(0, 5);

    if (upcoming.length === 0) {
        container.innerHTML =
            "<p>No tienes tareas pendientes. ¡Buen trabajo!</p>";
        return;
    }

    container.innerHTML = upcoming.map(task => `
        <div class="upcoming-task">
            <strong>${escapeTaskHTML(task.title)}</strong>
            <span>${formatTaskDate(task.dueDate)}</span>
            <small>${escapeTaskHTML(
                subjectMap.get(task.subjectId) || "Sin materia"
            )}</small>
        </div>
    `).join("");
}

// FORMATEAR FECHA
function formatTaskDate(dateString) {
    if (!dateString) return "Sin fecha";

    const parts = dateString.split("-");

    if (parts.length !== 3) return "Fecha no válida";

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// PROTEGER TEXTO INSERTADO EN HTML
function escapeTaskHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}
