
// ==========================================
// STUDYPLAN - SISTEMA DE SINCRONIZACIÓN
// ==========================================

const API_BASE = "http://127.0.0.1:5000/api";

let synchronizationRunning = false;
let synchronizationRequested = false;

// ==========================================
// INICIALIZACIÓN
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    const status = document.getElementById("sync-status");
    const count = document.getElementById("pending-sync-count");
    const refresh = document.getElementById("sync-refresh-btn");
    const syncButton = document.getElementById("remote-sync-btn");
    const loadButton = document.getElementById("remote-load-btn");

    async function updateStatus() {

        if (status) {
            status.textContent = navigator.onLine
                ? "Con conexión a internet"
                : "Sin conexión — modo offline";

            status.className = navigator.onLine
                ? "sync-online"
                : "sync-offline";
        }

        try {
            const pending = await getAllRecords("pendingSync");

            if (count) {
                count.textContent = pending.length;
            }

        } catch (error) {
            console.error("Error leyendo la cola:", error);
        }
    }

    window.refreshSyncStatus = updateStatus;

    // Actualizar estado manualmente.
    refresh?.addEventListener("click", updateStatus);

    // Sincronización manual de respaldo.
    syncButton?.addEventListener("click", async () => {

        syncButton.disabled = true;

        try {
            const result = await window.syncPendingToServer();

            const output = document.getElementById("remote-data-status");

            if (output) {
                output.textContent =
                    `Sincronización terminada. Enviados: ${result.sent}; ` +
                    `eliminados: ${result.deleted}; ` +
                    `pendientes: ${result.remaining}.`;
            }

        } catch (error) {

            const output = document.getElementById("remote-data-status");

            if (output) {
                output.textContent =
                    `No se pudo sincronizar: ${error.message}`;
            }

        } finally {
            syncButton.disabled = false;
            await updateStatus();
        }
    });

    // Consultar información remota.
    loadButton?.addEventListener("click", async () => {

        const output = document.getElementById("remote-data-status");

        try {

            const [subjects, tasks, grades] = await Promise.all([
                fetch(`${API_BASE}/subjects`).then(r => {
                    if (!r.ok) throw new Error("Error consultando materias");
                    return r.json();
                }),
                fetch(`${API_BASE}/tasks`).then(r => {
                    if (!r.ok) throw new Error("Error consultando tareas");
                    return r.json();
                }),
                fetch(`${API_BASE}/grades`).then(r => {
                    if (!r.ok) throw new Error("Error consultando calificaciones");
                    return r.json();
                })
            ]);

            if (
                !subjects.success ||
                !tasks.success ||
                !grades.success
            ) {
                throw new Error("Respuesta incorrecta del servidor.");
            }

            if (output) {
                output.textContent =
                    `Servidor disponible: ${subjects.subjects.length} materias, ` +
                    `${tasks.tasks.length} tareas y ` +
                    `${grades.grades.length} calificaciones.`;
            }

        } catch (error) {

            if (output) {
                output.textContent =
                    "No se pudo consultar Flask. Verifica que esté ejecutándose.";
            }

            console.error(error);
        }
    });

    // Recuperación automática de conexión.
    window.addEventListener("online", async () => {

        await updateStatus();

        try {
            await window.syncPendingToServer();
        } catch (error) {
            console.warn("Pendientes de sincronización:", error);
        }

        await updateStatus();
    });

    window.addEventListener("offline", updateStatus);

    updateStatus();

    // Recuperar pendientes después de abrir la aplicación.
    if (navigator.onLine) {
        setTimeout(() => {
            window.syncPendingToServer().catch(error => {
                console.warn("Sincronización inicial:", error);
            });
        }, 1000);
    }
});

// ==========================================
// COMBINAR OPERACIONES PENDIENTES
// ==========================================

function determineOperation(previous, next) {

    if (previous === "create" && next === "delete") {
        return "cancel";
    }

    if (previous === "create" && next === "update") {
        return "create";
    }

    if (previous === "delete" && next !== "delete") {
        return "update";
    }

    if (previous === "update" && next === "delete") {
        return "delete";
    }

    return next;
}

// ==========================================
// AGREGAR OPERACIÓN A LA COLA
// ==========================================

window.addPendingSync = async function (
    storeName,
    operation,
    recordData
) {

    if (!recordData || recordData.id == null) {
        console.warn("Registro sin ID. No se agregó a sincronización.");
        return;
    }

    const pending = await getAllRecords("pendingSync");

    const existing = pending.find(item =>
        item.storeName === storeName &&
        Number(item.recordData?.id) === Number(recordData.id)
    );

    if (!existing) {

        await saveRecord("pendingSync", {
            storeName,
            operation,
            recordData,
            createdAt: new Date().toISOString(),
            status: "pending"
        });

    } else {

        const combined = determineOperation(
            existing.operation,
            operation
        );

        if (combined === "cancel") {

            await deleteRecord("pendingSync", existing.id);

        } else {

            await saveRecord("pendingSync", {
                ...existing,
                operation: combined,
                recordData,
                updatedAt: new Date().toISOString(),
                status: "pending"
            });
        }
    }

    await window.refreshSyncStatus?.();

    // INICIAR SINCRONIZACIÓN AUTOMÁTICA.
    if (navigator.onLine) {
        window.syncPendingToServer().catch(error => {
            console.warn("La operación quedó pendiente:", error);
        });
    }
};

// ==========================================
// CONVERTIR REGISTROS PARA FLASK
// ==========================================

function toRemotePayload(storeName, record) {

    if (storeName === "subjects") {

        return {
            local_id: record.id,
            name: record.name,
            teacher: record.teacher || "",
            schedule: record.schedule || "",
            color: record.color || ""
        };
    }

    if (storeName === "tasks") {

        return {
            local_id: record.id,
            title: record.title,
            description: record.description || "",
            subject_id: record.subjectId ?? null,
            due_date: record.dueDate || "",
            priority: record.priority || "media",
            completed: Boolean(record.completed),
            created_at: record.createdAt,
            updated_at: record.updatedAt
        };
    }

    if (storeName === "grades") {

        return {
            local_id: record.id,
            title: record.title,
            subject_id: record.subjectId ?? null,
            score: Number(record.score),
            weight: Number(record.weight),
            grade_date: record.date || "",
            created_at: record.createdAt,
            updated_at: record.updatedAt
        };
    }

    throw new Error(
        `Módulo no compatible: ${storeName}`
    );
}

// ==========================================
// SINCRONIZAR OPERACIONES CON FLASK
// ==========================================

window.syncPendingToServer = async function () {

    if (!navigator.onLine) {
        throw new Error("No hay conexión a internet.");
    }

    // Evitar dos sincronizaciones simultáneas.
    if (synchronizationRunning) {
        synchronizationRequested = true;

        return {
            sent: 0,
            deleted: 0,
            remaining: (await getAllRecords("pendingSync")).length
        };
    }

    synchronizationRunning = true;

    let sent = 0;
    let deleted = 0;

    try {

        do {

            synchronizationRequested = false;

            const queue = (
                await getAllRecords("pendingSync")
            ).sort((a, b) => a.id - b.id);

            for (const item of queue) {

                if (!navigator.onLine) {
                    throw new Error("Se perdió la conexión.");
                }

                const {
                    storeName,
                    operation,
                    recordData
                } = item;

                if (!["subjects", "tasks", "grades"].includes(storeName)) {
                    continue;
                }

                const localId = Number(recordData.id);

                const endpoint = `${API_BASE}/${storeName}`;

                let response;

                if (operation === "delete") {

                    response = await fetch(
                        `${endpoint}/${localId}`,
                        { method: "DELETE" }
                    );

                } else {

                    response = await fetch(endpoint, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(
                            toRemotePayload(storeName, recordData)
                        )
                    });
                }

                const data = await response.json().catch(() => ({
                    success: false,
                    message: "Respuesta inválida del servidor."
                }));

                if (!response.ok || !data.success) {
                    throw new Error(
                        data.message || `Error sincronizando ${storeName}.`
                    );
                }

                // Eliminar de la cola solamente después de confirmar
                // que Flask recibió correctamente la operación.
                await deleteRecord("pendingSync", item.id);

                if (operation === "delete") {
                    deleted++;
                } else {
                    sent++;
                }

            }

        } while (synchronizationRequested && navigator.onLine);

        const remaining = (
            await getAllRecords("pendingSync")
        ).length;

        await window.refreshSyncStatus?.();

        return {
            sent,
            deleted,
            remaining
        };

    } finally {

        synchronizationRunning = false;

        await window.refreshSyncStatus?.();
    }
};

console.log("StudyPlan: sistema de sincronización cargado.");
