// Paneles para consultar los registros almacenados en SQLite.
document.addEventListener("DOMContentLoaded", () => {
    addRemotePanel("tasks", "Tareas", "title", "due_date", "priority");
    addRemotePanel("grades", "Calificaciones", "title", "score", "weight");
});

function addRemotePanel(store, label, fieldA, fieldB, fieldC) {
    const list = document.getElementById(store === "tasks" ? "tasks-list" : "grades-list");
    if (!list || document.getElementById(`remote-${store}-panel`)) return;
    const panel = document.createElement("section");
    panel.className = "card remote-panel";
    panel.id = `remote-${store}-panel`;
    panel.innerHTML = `<h3>${label} en el servidor</h3><p>Envía los cambios pendientes desde la sección Sincronización del Inicio.</p><button type="button" class="secondary-button" id="load-remote-${store}">Consultar ${label.toLowerCase()} remotas</button><p id="remote-${store}-status" role="status">Aún no se han consultado.</p><div id="remote-${store}-list"></div>`;
    list.parentNode.insertBefore(panel, list.nextSibling);
    document.getElementById(`load-remote-${store}`).addEventListener("click", () => loadRemoteRecords(store, label));
}

async function loadRemoteRecords(store, label) {
    const status = document.getElementById(`remote-${store}-status`);
    const container = document.getElementById(`remote-${store}-list`);
    status.textContent = "Consultando servidor...";
    try {
        const response = await fetch(`http://127.0.0.1:5000/api/${store}`);
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || "Error de consulta.");
        const records = data[store] || [];
        if (!records.length) container.innerHTML = `<p>No hay ${label.toLowerCase()} guardadas en el servidor.</p>`;
        else container.innerHTML = records.map(record => {
            const title = escapeRemoteHTML(record.title || record.name || "Registro");
            const detail = store === "tasks"
                ? `Entrega: ${escapeRemoteHTML(record.due_date || "Sin fecha")} · Prioridad: ${escapeRemoteHTML(record.priority || "media")} · ${Number(record.completed) ? "Completada" : "Pendiente"}`
                : `Calificación: ${Number(record.score).toFixed(1)}/10 · Ponderación: ${Number(record.weight).toFixed(1)}% · Fecha: ${escapeRemoteHTML(record.grade_date || "Sin fecha")}`;
            return `<article class="remote-record"><strong>${title}</strong><p>${detail}</p><small>ID remoto: ${record.id} · ID local: ${record.local_id ?? "No vinculado"}</small></article>`;
        }).join("");
        status.textContent = `Consulta completada: ${records.length} ${label.toLowerCase()}.`;
    } catch (error) {
        status.textContent = `Error: ${error.message}. Comprueba que Flask esté activo.`;
        container.innerHTML = "";
    }
}

function escapeRemoteHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[character]));
}
