
document.addEventListener("DOMContentLoaded", () => {

    // =====================================
    // NAVEGACIÓN ENTRE SECCIONES
    // =====================================

    const navItems = document.querySelectorAll(".nav-item");
    const views = document.querySelectorAll(".view");
    const pageTitle = document.getElementById("page-title");

    const titles = {
        inicio: "Inicio",
        materias: "Materias",
        tareas: "Tareas",
        calificaciones: "Calificaciones",
        calendario: "Calendario",
        escaner: "Escáner"
    };

    function navigateTo(target) {
        const selectedView = document.getElementById(target);

        if (!selectedView) {
            console.error("No se encontró la sección:", target);
            return;
        }

        navItems.forEach(item => {
            item.classList.toggle("active", item.dataset.view === target);
        });

        views.forEach(view => {
            view.classList.toggle("active", view.id === target);
        });

        if (pageTitle) {
            pageTitle.textContent = titles[target] || "StudyPlan";
        }

        console.log("Sección abierta:", target);
    }

    navItems.forEach(item => {
        item.addEventListener("click", () => {
            navigateTo(item.dataset.view);
        });
    });

    // BOTONES DE ACCESO RÁPIDO

    document.querySelectorAll("[data-go]").forEach(button => {
        button.addEventListener("click", () => {
            navigateTo(button.dataset.go);
        });
    });

    // =====================================
    // PANTALLA SPLASH
    // =====================================

    const splash = document.getElementById("splash");
    const app = document.getElementById("app");

    setTimeout(() => {
        splash?.classList.add("hidden");
        app?.classList.remove("hidden");
    }, 1200);

    // =====================================
    // ESTADO DE CONEXIÓN
    // =====================================

    function updateConnectionStatus() {
        const status = document.getElementById("connection-status");

        if (!status) return;

        if (navigator.onLine) {
            status.textContent = "Conectado a Internet";
            status.className = "connection-status online";
        } else {
            status.textContent = "Sin conexión a Internet";
            status.className = "connection-status offline";
        }
    }

    updateConnectionStatus();

    window.addEventListener("online", updateConnectionStatus);
    window.addEventListener("offline", updateConnectionStatus);

    // =====================================
    // INICIALIZAR INDEXEDDB
    // =====================================

    openDatabase()
        .then(() => {
            console.log("IndexedDB inicializada correctamente.");
        })
        .catch(error => {
            console.error("Error al inicializar IndexedDB:", error);
        });

    // =====================================
    // SERVICE WORKER
    // =====================================

    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("./service-worker.js")
            .then(registration => {
                console.log(
                    "Service Worker registrado:",
                    registration.scope
                );
            })
            .catch(error => {
                console.error(
                    "Error al registrar Service Worker:",
                    error
                );
            });
    } else {
        console.warn("Este navegador no soporta Service Worker.");
    }

});
