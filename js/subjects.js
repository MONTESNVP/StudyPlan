
let editingSubjectId = null;

document.addEventListener("DOMContentLoaded", () => {
    const addButton = document.getElementById("add-subject");
    const form = document.getElementById("subject-form");
    const cancelButton = document.getElementById("cancel-subject");

    addButton?.addEventListener("click", openSubjectForm);
    form?.addEventListener("submit", saveSubject);
    cancelButton?.addEventListener("click", closeSubjectForm);

    loadSubjects();
});

// ABRIR FORMULARIO
function openSubjectForm() {
    const form = document.getElementById("subject-form");

    form.reset();
    editingSubjectId = null;

    document.getElementById("subject-form-title").textContent =
        "Agregar materia";

    document.getElementById("subject-form-container")
        .classList.remove("hidden");
}

// CERRAR FORMULARIO
function closeSubjectForm() {
    document.getElementById("subject-form-container")
        .classList.add("hidden");

    editingSubjectId = null;
}

// REGISTRAR OPERACIÓN EN LA COLA DE SINCRONIZACIÓN
async function registerSubjectSync(operation, subjectData) {
    try {
        if (typeof window.addPendingSync !== "function") {
            console.warn("El módulo de sincronización no está disponible.");
            return;
        }

        await window.addPendingSync(
            "subjects",
            operation,
            subjectData
        );

    } catch (error) {
        console.error("Error registrando sincronización de materia:", error);
    }
}

// GUARDAR MATERIA
async function saveSubject(event) {
    event.preventDefault();

    const subject = {
        name: document.getElementById("subject-name").value.trim(),
        teacher: document.getElementById("subject-teacher").value.trim(),
        schedule: document.getElementById("subject-schedule").value.trim(),
        color: document.getElementById("subject-color").value,
        updatedAt: new Date().toISOString()
    };

    if (!subject.name) {
        alert("Debes escribir el nombre de la materia.");
        return;
    }

    const operation = editingSubjectId !== null ? "update" : "create";

    try {
        if (editingSubjectId !== null) {
            subject.id = editingSubjectId;
        }

        await saveRecord("subjects", subject);

        // Para una nueva materia, recuperar el registro con su ID generado.
        let savedSubject = subject;

        if (operation === "create") {
            const allSubjects = await getAllRecords("subjects");

            savedSubject = allSubjects.find(item =>
                item.name === subject.name &&
                item.updatedAt === subject.updatedAt
            ) || subject;
        }

        // Registrar operación pendiente.
        await registerSubjectSync(operation, savedSubject);

        closeSubjectForm();
        await loadSubjects();

        alert("Materia guardada correctamente.");

    } catch (error) {
        console.error("Error al guardar materia:", error);
        alert("No se pudo guardar la materia.");
    }
}

// CARGAR MATERIAS
async function loadSubjects() {
    const container = document.getElementById("subjects-list");

    if (!container) return;

    try {
        const subjects = await getAllRecords("subjects");

        if (subjects.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>¡Comienza agregando una materia!</h3>
                    <p>Tus materias aparecerán aquí.</p>
                </div>
            `;

            updateSubjectCounter(0);
            return;
        }

        container.innerHTML = subjects.map(subject => `
            <article class="subject-card"
                style="border-left: 5px solid ${escapeHTML(subject.color || "#635bdb")}">

                <div class="subject-card-content">
                    <h3>${escapeHTML(subject.name)}</h3>
                    <p><strong>Profesor:</strong> ${escapeHTML(subject.teacher || "No especificado")}</p>
                    <p><strong>Horario:</strong> ${escapeHTML(subject.schedule || "No especificado")}</p>
                </div>

                <div class="subject-actions">
                    <button type="button" onclick="editSubject(${subject.id})">
                        Editar
                    </button>

                    <button type="button" onclick="deleteSubject(${subject.id})">
                        Eliminar
                    </button>
                </div>
            </article>
        `).join("");

        updateSubjectCounter(subjects.length);

    } catch (error) {
        console.error("Error al cargar materias:", error);
    }
}

// ACTUALIZAR CONTADOR DEL INICIO
function updateSubjectCounter(total) {
    const counter = document.getElementById("total-subjects");

    if (counter) {
        counter.textContent = total;
    }
}

// EDITAR MATERIA
async function editSubject(id) {
    try {
        const subjects = await getAllRecords("subjects");
        const subject = subjects.find(item => item.id === id);

        if (!subject) return;

        editingSubjectId = id;

        document.getElementById("subject-name").value = subject.name;
        document.getElementById("subject-teacher").value = subject.teacher || "";
        document.getElementById("subject-schedule").value = subject.schedule || "";
        document.getElementById("subject-color").value = subject.color || "#635bdb";

        document.getElementById("subject-form-title").textContent =
            "Editar materia";

        document.getElementById("subject-form-container")
            .classList.remove("hidden");

    } catch (error) {
        console.error("Error al editar materia:", error);
    }
}

// ELIMINAR MATERIA
async function deleteSubject(id) {
    const confirmation = confirm(
        "¿Estás seguro de que deseas eliminar esta materia?"
    );

    if (!confirmation) return;

    try {
        // Recuperar los datos antes de eliminarlos.
        const subjects = await getAllRecords("subjects");
        const subjectToDelete = subjects.find(item => item.id === id);

        await deleteRecord("subjects", id);

        // Registrar eliminación en la cola.
        if (subjectToDelete) {
            await registerSubjectSync("delete", subjectToDelete);
        }

        await loadSubjects();

        alert("Materia eliminada correctamente.");

    } catch (error) {
        console.error("Error al eliminar materia:", error);
        alert("No se pudo eliminar la materia.");
    }
}

// PROTEGER TEXTO INSERTADO EN HTML
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}


// ==========================================
// CONEXIÓN CON EL SERVIDOR REMOTO (FLASK)
// ==========================================

const REMOTE_API_URL = "http://127.0.0.1:5000/api/subjects";

// CREAR PANEL DE CONEXIÓN REMOTA
function initializeRemoteSubjects() {
    const subjectsList = document.getElementById("subjects-list");

    if (!subjectsList || document.getElementById("remote-subjects-panel")) {
        return;
    }

    const panel = document.createElement("div");
    panel.id = "remote-subjects-panel";

    panel.innerHTML = `
        <h3>Servidor remoto</h3>

        <button type="button" id="load-subjects-remote">
            Consultar materias del servidor
        </button>

        <p id="remote-subjects-status">
            Conexión con el servidor pendiente.
        </p>

        <div id="remote-subjects-list"></div>
    `;

    subjectsList.parentNode.insertBefore(panel, subjectsList);

    document.getElementById("send-subjects-remote")
    .addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        console.log("1. CLIC DETECTADO");

        sendLocalSubjectsToServer()
            .then(() => {
                console.log("2. FUNCIÓN DE ENVÍO TERMINADA");
            })
            .catch(error => {
                console.error("3. ERROR EN EL ENVÍO:", error);
            });
    });

    document
    .getElementById("load-subjects-remote")
    .addEventListener("click", (event) => {
        event.preventDefault();
        console.log("BOTÓN CONSULTAR: clic detectado");
        loadRemoteSubjects();
    });
}

function initializeRemoteSubjects() {
    const subjectsList = document.getElementById("subjects-list");

    if (!subjectsList || document.getElementById("remote-subjects-panel")) {
        return;
    }

    const panel = document.createElement("div");
    panel.id = "remote-subjects-panel";

    panel.innerHTML = `
        <h3>Servidor remoto</h3>

        <button type="button" id="load-subjects-remote">
            Consultar materias del servidor
        </button>

        <p id="remote-subjects-status">
            Conexión con el servidor pendiente.
        </p>

        <div id="remote-subjects-list"></div>
    `;

    subjectsList.parentNode.insertBefore(panel, subjectsList);

    document
        .getElementById("load-subjects-remote")
        .addEventListener("click", (event) => {
            event.preventDefault();
            console.log("BOTÓN CONSULTAR: clic detectado");
            loadRemoteSubjects();
        });
}

// ACTUALIZAR MENSAJE DEL PANEL
function updateRemoteStatus(message) {
    const status = document.getElementById("remote-subjects-status");

    if (status) {
        status.textContent = message;
    }
}

// ENVIAR MATERIAS LOCALES AL SERVIDOR

async function sendLocalSubjectsToServer() {
    const button = document.getElementById("send-subjects-remote");

    try {
        button.disabled = true;
        updateRemoteStatus("Preparando envío de materias...");

        // Obtener materias locales
        const localSubjects = await getAllRecords("subjects");

        console.log("MATERIAS LOCALES:", localSubjects);
        console.log("TOTAL LOCAL:", localSubjects.length);

        if (!localSubjects || localSubjects.length === 0) {
            updateRemoteStatus("No hay materias guardadas en IndexedDB.");
            return;
        }

        // Consultar materias del servidor
        const response = await fetch(REMOTE_API_URL);
        const remoteData = await response.json();

        console.log("RESPUESTA DEL SERVIDOR:", remoteData);

        if (!response.ok || !remoteData.success) {
            throw new Error("No se pudieron consultar las materias remotas.");
        }

        const remoteSubjects = remoteData.subjects || [];

        let sent = 0;
        let skipped = 0;

        // Enviar cada materia que todavía no exista
        for (const subject of localSubjects) {

            const alreadyExists = remoteSubjects.some(remote =>
                Number(remote.local_id) === Number(subject.id) ||
                (remote.name.trim().toLowerCase() ===
                    (subject.name || "").trim().toLowerCase() &&
                (remote.teacher || "").trim().toLowerCase() ===
                    (subject.teacher || "").trim().toLowerCase() &&
                (remote.schedule || "").trim().toLowerCase() ===
                    (subject.schedule || "").trim().toLowerCase())
            );

            if (alreadyExists) {
                console.log("MATERIA OMITIDA:", subject.name);
                skipped++;
                continue;
            }

            const newSubject = {
                local_id: subject.id,
                name: subject.name,
                teacher: subject.teacher || "",
                schedule: subject.schedule || "",
                color: subject.color || ""
            };

            console.log("INICIO DEL POST");

const saveResponse = await fetch(REMOTE_API_URL, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(newSubject)
});

const saveData = await saveResponse.json();

console.log("FIN DEL POST", saveData);

            if (!saveResponse.ok || !saveData.success) {
                throw new Error(
                    saveData.message || "No se pudo guardar la materia."
                );
            }

            sent++;

            remoteSubjects.push(newSubject);
        }

        const message =
            `Proceso terminado. Enviadas: ${sent}. Ya existentes: ${skipped}.`;

        updateRemoteStatus(message);
        console.log(message);

        await loadRemoteSubjects();

    } catch (error) {
        console.error("ERROR EN EL ENVÍO:", error);

        updateRemoteStatus("Error: " + error.message);

    } finally {
        button.disabled = false;
    }
}


// CONSULTAR MATERIAS GUARDADAS EN SQLITE
async function loadRemoteSubjects() {
    const container = document.getElementById("remote-subjects-list");

    if (!container) return;

    try {
        updateRemoteStatus("Consultando servidor...");

        const response = await fetch(REMOTE_API_URL);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error("No se pudieron recuperar las materias.");
        }

        const subjects = data.subjects || [];

        if (subjects.length === 0) {
            container.innerHTML = "<p>No hay materias guardadas en el servidor.</p>";
        } else {
            container.innerHTML = subjects.map(subject => `
                <div class="subject-card">
                    <h4>${escapeHTML(subject.name)}</h4>
                    <p>Profesor: ${escapeHTML(subject.teacher || "No especificado")}</p>
                    <p>Horario: ${escapeHTML(subject.schedule || "No especificado")}</p>
                    <small>Registro remoto: ${subject.id}</small>
                </div>
            `).join("");
        }

        updateRemoteStatus(
            `Conectado. Materias encontradas en el servidor: ${subjects.length}.`
        );

    } catch (error) {
        console.error("Error al consultar materias:", error);

        container.innerHTML = "";
        updateRemoteStatus(
            "Error de conexión. Comprueba que Flask esté ejecutándose."
        );
    }
}

// INICIALIZAR EL PANEL CUANDO CARGUE LA PÁGINA
document.addEventListener("DOMContentLoaded", () => {
    initializeRemoteSubjects();
});

console.log("CONEXIÓN REMOTA: subjects.js está cargado");