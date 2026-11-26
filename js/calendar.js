
document.addEventListener("DOMContentLoaded", () => {
    const calendarContainer = document.getElementById("calendar-container");

    if (!calendarContainer) return;

    let currentDate = new Date();
    let selectedDate = getLocalDateString(new Date());

    renderCalendar();

    calendarContainer.addEventListener("click", event => {
        const button = event.target.closest("[data-calendar-action]");
        if (!button) return;

        const action = button.dataset.calendarAction;

        if (action === "previous") {
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderCalendar();
        }

        if (action === "next") {
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderCalendar();
        }

        if (action === "today") {
            currentDate = new Date();
            selectedDate = getLocalDateString(new Date());
            renderCalendar();
        }

        if (action === "select-day") {
            selectedDate = button.dataset.date;
            renderCalendar();
        }
    });

    async function renderCalendar() {
        try {
            const tasks = await getAllRecords("tasks");

            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();

            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);

            // Ajustar para que la semana comience en lunes.
            const startingDay = (firstDay.getDay() + 6) % 7;
            const daysInMonth = lastDay.getDate();

            const monthName = currentDate.toLocaleDateString("es-MX", {
                month: "long",
                year: "numeric"
            });

            const tasksByDate = {};

            tasks.forEach(task => {
                if (!task.dueDate) return;

                if (!tasksByDate[task.dueDate]) {
                    tasksByDate[task.dueDate] = [];
                }

                tasksByDate[task.dueDate].push(task);
            });

            let daysHTML = "";

            // Espacios antes del primer día del mes.
            for (let i = 0; i < startingDay; i++) {
                daysHTML += `<div class="calendar-day empty"></div>`;
            }

            // Días del mes.
            for (let day = 1; day <= daysInMonth; day++) {
                const dateString = [
                    year,
                    String(month + 1).padStart(2, "0"),
                    String(day).padStart(2, "0")
                ].join("-");

                const dayTasks = tasksByDate[dateString] || [];
                const isToday =
                    dateString === getLocalDateString(new Date());

                const isSelected = dateString === selectedDate;

                const hasPending = dayTasks.some(task => !task.completed);
                const hasCompleted = dayTasks.some(task => task.completed);

                daysHTML += `
                    <button
                        type="button"
                        class="calendar-day
                            ${isToday ? "today" : ""}
                            ${isSelected ? "selected" : ""}
                            ${dayTasks.length ? "has-tasks" : ""}"
                        data-calendar-action="select-day"
                        data-date="${dateString}">

                        <span class="calendar-day-number">${day}</span>

                        <span class="calendar-day-indicators">
                            ${hasPending ? '<i class="calendar-dot pending"></i>' : ""}
                            ${hasCompleted ? '<i class="calendar-dot completed"></i>' : ""}
                        </span>
                    </button>
                `;
            }

            const selectedTasks = tasksByDate[selectedDate] || [];

            const selectedDateText = formatDate(selectedDate);

            let selectedTasksHTML = "";

            if (selectedTasks.length === 0) {
                selectedTasksHTML = `
                    <div class="empty-state">
                        <p>No hay tareas programadas para este día.</p>
                    </div>
                `;
            } else {
                selectedTasksHTML = selectedTasks.map(task => `
                    <article class="calendar-task-card">
                        <div>
                            <h4>${escapeCalendarHTML(task.title || task.name || "Tarea sin título")}</h4>
                            <span class="${task.completed ? "calendar-completed" : "calendar-pending"}">
                                ${task.completed ? "Completada" : "Pendiente"}
                            </span>
                        </div>
                        <span class="calendar-task-priority priority-${escapeCalendarHTML(task.priority || "media")}">
                            ${escapeCalendarHTML(task.priority || "media")}
                        </span>
                    </article>
                `).join("");
            }

            calendarContainer.innerHTML = `
                <div class="calendar-toolbar">
                    <button type="button"
                        class="secondary-button"
                        data-calendar-action="previous">
                        ← Anterior
                    </button>

                    <h3>${monthName}</h3>

                    <button type="button"
                        class="secondary-button"
                        data-calendar-action="next">
                        Siguiente →
                    </button>
                </div>

                <div class="calendar-today-action">
                    <button type="button"
                        class="secondary-button"
                        data-calendar-action="today">
                        Ir a hoy
                    </button>
                </div>

                <div class="calendar-grid">
                    ${["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
                        .map(day => `<div class="calendar-weekday">${day}</div>`)
                        .join("")}

                    ${daysHTML}
                </div>

                <div class="calendar-legend">
                    <span><i class="calendar-dot pending"></i> Pendiente</span>
                    <span><i class="calendar-dot completed"></i> Completada</span>
                </div>

                <div class="calendar-selected-day">
                    <h3>Actividades del ${selectedDateText}</h3>
                    <div class="calendar-selected-tasks">
                        ${selectedTasksHTML}
                    </div>
                </div>
            `;

        } catch (error) {
            console.error("Error al cargar el calendario:", error);

            calendarContainer.innerHTML = `
                <div class="empty-state">
                    <p>No se pudo cargar el calendario.</p>
                </div>
            `;
        }
    }

    function getLocalDateString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function formatDate(dateString) {
        const [year, month, day] = dateString.split("-");

        return `${day}/${month}/${year}`;
    }

    function escapeCalendarHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[character]);
    }
});
