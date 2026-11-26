
document.addEventListener("DOMContentLoaded", () => {
    const notificationButton = document.getElementById("notification-btn");

    let notificationsEnabled = false;
    let notificationInterval = null;

    // Revisar si las notificaciones estaban activadas
    notificationsEnabled =
        localStorage.getItem("studyplan_notifications") === "true";

    updateNotificationButton();

    notificationButton?.addEventListener("click", toggleNotifications);

    // Si estaban activadas, comenzar a revisar tareas
    if (notificationsEnabled && Notification.permission === "granted") {
        startNotificationChecks();
    }

    // ACTIVAR / DESACTIVAR NOTIFICACIONES
    async function toggleNotifications() {
        if (!("Notification" in window)) {
            alert("Tu navegador no soporta notificaciones.");
            return;
        }

        if (!notificationsEnabled) {
            const permission = await Notification.requestPermission();

            if (permission !== "granted") {
                alert("Debes permitir las notificaciones en tu navegador.");
                notificationsEnabled = false;
                updateNotificationButton();
                return;
            }

            notificationsEnabled = true;
            localStorage.setItem("studyplan_notifications", "true");

            startNotificationChecks();

            showNotification(
                "StudyPlan",
                "¡Notificaciones activadas! Te avisaremos sobre tus tareas."
            );

        } else {
            notificationsEnabled = false;
            localStorage.setItem("studyplan_notifications", "false");

            stopNotificationChecks();

            alert("Notificaciones desactivadas.");
        }

        updateNotificationButton();
    }

    // INICIAR REVISIÓN DE TAREAS
    function startNotificationChecks() {
        stopNotificationChecks();

        checkTasks();

        // Revisar las tareas cada minuto
        notificationInterval = setInterval(checkTasks, 60000);
    }

    // DETENER REVISIÓN
    function stopNotificationChecks() {
        if (notificationInterval) {
            clearInterval(notificationInterval);
            notificationInterval = null;
        }
    }

    // REVISAR TAREAS
    async function checkTasks() {
        if (!notificationsEnabled || Notification.permission !== "granted") {
            return;
        }

        try {
            const tasks = await getAllRecords("tasks");

            const today = getDateString(new Date());

            for (const task of tasks) {
                // Ignorar tareas completadas
                if (task.completed) continue;

                const dueDate = task.dueDate;

                if (!dueDate) continue;

                const taskDate = dueDate.substring(0, 10);

                // Tarea vencida
                if (taskDate < today) {
                    sendTaskNotification(
                        task,
                        "Tienes una tarea vencida. ¡No olvides completarla!"
                    );
                }

                // Tarea que vence hoy
                else if (taskDate === today) {
                    sendTaskNotification(
                        task,
                        "Esta tarea vence hoy. ¡Recuerda entregarla!"
                    );
                }

                // Tarea que vence mañana
                else if (taskDate === getTomorrowDate()) {
                    sendTaskNotification(
                        task,
                        "Esta tarea vence mañana. ¡Prepárate!"
                    );
                }
            }

        } catch (error) {
            console.error("Error revisando tareas:", error);
        }
    }

    // ENVIAR NOTIFICACIÓN DE UNA TAREA
    function sendTaskNotification(task, message) {
        const taskId = task.id;
        const today = getDateString(new Date());

        const notificationKey =
            `studyplan_notification_${taskId}_${today}`;

        // Evitar enviar la misma notificación varias veces al día
        if (localStorage.getItem(notificationKey)) {
            return;
        }

        const taskName = task.title || task.name || "Tarea pendiente";

        showNotification(taskName, message);

        localStorage.setItem(notificationKey, "true");
    }

    // MOSTRAR NOTIFICACIÓN
    function showNotification(title, message) {
        if (!notificationsEnabled && title !== "StudyPlan") return;

        if (Notification.permission !== "granted") return;

        const notification = new Notification(title, {
            body: message,
            icon: "./icons/icon-192.png",
            tag: title,
            renotify: false
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    }

    // OBTENER FECHA YYYY-MM-DD
    function getDateString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    // OBTENER FECHA DE MAÑANA
    function getTomorrowDate() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        return getDateString(tomorrow);
    }

    // ACTUALIZAR BOTÓN
    function updateNotificationButton() {
    if (!notificationButton) return;

    notificationButton.classList.toggle("active", notificationsEnabled);

    notificationButton.innerHTML = notificationsEnabled
        ? '<i data-lucide="bell-ring"></i><span>Notificaciones activadas</span>'
        : '<i data-lucide="bell-off"></i><span>Activar notificaciones</span>';

    notificationButton.title = notificationsEnabled
        ? "Desactivar notificaciones"
        : "Activar notificaciones";

    if (window.lucide) {
        lucide.createIcons();
    }
}
});
