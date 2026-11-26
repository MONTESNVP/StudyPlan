
// ==========================================
// STUDYPLAN - MÓDULO DE CALIFICACIONES
// ==========================================

// ==========================================
// CONSULTAR CALIFICACIONES DEL SERVIDOR
// ==========================================

async function loadRemoteGrades() {
    try {
        const response = await fetch(
            "http://127.0.0.1:5000/api/grades"
        );

        if (!response.ok) {
            throw new Error("No se pudieron consultar las calificaciones.");
        }

        const data = await response.json();

        console.log("Calificaciones del servidor:", data);

        alert(
            `Consulta exitosa. Calificaciones encontradas: ${
                (data.grades || []).length
            }`
        );

    } catch (error) {
        console.error("Error consultando calificaciones remotas:", error);
        alert("No se pudieron consultar las calificaciones del servidor.");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const addButton = document.getElementById("add-grade");
    const formContainer = document.getElementById("grade-form-container");
    const gradeForm = document.getElementById("grade-form");
    const cancelButton = document.getElementById("cancel-grade");
    const remoteGradesButton = document.getElementById("load-grades-remote");

remoteGradesButton?.addEventListener("click", loadRemoteGrades);

    let editingGradeId = null;

    // Abrir formulario
    addButton?.addEventListener("click", openGradeForm);

    // Guardar formulario
    gradeForm?.addEventListener("submit", saveGrade);

    // Cancelar
    cancelButton?.addEventListener("click", closeGradeForm);

    // Cargar calificaciones al iniciar
    loadGrades();

    // ABRIR FORMULARIO
    async function openGradeForm() {
        if (!formContainer || !gradeForm) return;

        editingGradeId = null;
        gradeForm.reset();

        document.getElementById("grade-form-title").textContent =
            "Nueva calificación";

        document.getElementById("grade-date").value =
            getLocalDateString(new Date());

        await loadSubjectOptions();

        formContainer.classList.remove("hidden");
    }

    // CARGAR MATERIAS EN SELECT
    async function loadSubjectOptions(selectedId = "") {
        const select = document.getElementById("grade-subject");

        if (!select) return;

        try {
            const subjects = await getAllRecords("subjects");

            select.innerHTML =
                '<option value="">Selecciona una materia</option>';

            subjects.forEach(subject => {
                const option = document.createElement("option");

                option.value = subject.id;
                option.textContent = subject.name;

                if (String(subject.id) === String(selectedId)) {
                    option.selected = true;
                }

                select.appendChild(option);
            });

            if (subjects.length === 0) {
                select.innerHTML =
                    '<option value="">Primero registra una materia</option>';
            }

        } catch (error) {
            console.error("Error al cargar materias:", error);
        }
    }

    // CERRAR FORMULARIO
    function closeGradeForm() {
        if (!formContainer || !gradeForm) return;

        formContainer.classList.add("hidden");
        gradeForm.reset();
        editingGradeId = null;
    }

    // REGISTRAR OPERACIÓN EN COLA
    async function registerGradeSync(operation, gradeData) {
        try {
            if (typeof window.addPendingSync !== "function") {
                console.warn("El módulo de sincronización no está disponible.");
                return;
            }

            await window.addPendingSync(
                "grades",
                operation,
                gradeData
            );

        } catch (error) {
            console.error(
                "Error registrando sincronización de calificación:",
                error
            );
        }
    }

    // GUARDAR CALIFICACIÓN
    async function saveGrade(event) {
        event.preventDefault();

        const title = document.getElementById("grade-name").value.trim();

        const subjectId = Number(
            document.getElementById("grade-subject").value
        );

        const score = Number(
            document.getElementById("grade-score").value
        );

        const weight = Number(
            document.getElementById("grade-weight").value
        );

        const date = document.getElementById("grade-date").value;

        if (!title || !subjectId || !date) {
            alert("Completa todos los campos.");
            return;
        }

        if (score < 0 || score > 10 || !Number.isFinite(score)) {
            alert("La calificación debe estar entre 0 y 10.");
            return;
        }

        if (weight <= 0 || weight > 100 || !Number.isFinite(weight)) {
            alert("La ponderación debe estar entre 0 y 100.");
            return;
        }

        try {
            const grades = await getAllRecords("grades");

            const wasEditing = editingGradeId !== null;

            const previousGrade = grades.find(
                grade => grade.id === editingGradeId
            );

            const accumulatedWeight = grades
                .filter(grade =>
                    Number(grade.subjectId) === subjectId &&
                    grade.id !== editingGradeId
                )
                .reduce(
                    (total, grade) => total + Number(grade.weight || 0),
                    0
                );

            if (accumulatedWeight + weight > 100) {
                const confirmed = confirm(
                    "Las ponderaciones de esta materia superarán el 100%. " +
                    "¿Deseas continuar?"
                );

                if (!confirmed) return;
            }

            const gradeData = {
                title,
                subjectId,
                score,
                weight,
                date,
                createdAt: previousGrade?.createdAt ||
                    new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const operation = wasEditing ? "update" : "create";

            if (wasEditing) {
                gradeData.id = editingGradeId;
            }

            await saveRecord("grades", gradeData);

            // Recuperar el registro guardado.
            let savedGrade = gradeData;

            if (!wasEditing) {
                const updatedGrades = await getAllRecords("grades");

                savedGrade = updatedGrades.find(grade =>
                    grade.title === gradeData.title &&
                    grade.subjectId === gradeData.subjectId &&
                    grade.score === gradeData.score &&
                    grade.weight === gradeData.weight &&
                    grade.date === gradeData.date &&
                    grade.updatedAt === gradeData.updatedAt
                ) || gradeData;
            }

            // Registrar operación en la cola.
            await registerGradeSync(operation, savedGrade);

            closeGradeForm();
            await loadGrades();

            alert(
                wasEditing
                    ? "Calificación actualizada."
                    : "Calificación guardada."
            );

        } catch (error) {
            console.error("Error al guardar:", error);
            alert("No se pudo guardar la calificación.");
        }
    }

    // CARGAR CALIFICACIONES
    async function loadGrades() {
        const gradesContainer = document.getElementById("grades-list");
        const averagesContainer = document.getElementById("subject-averages");

        if (!gradesContainer) return;

        try {
            const [grades, subjects] = await Promise.all([
                getAllRecords("grades"),
                getAllRecords("subjects")
            ]);

            grades.sort((a, b) =>
                String(b.date).localeCompare(String(a.date))
            );

            const subjectMap = new Map(
                subjects.map(subject => [Number(subject.id), subject])
            );

            if (grades.length === 0) {
                gradesContainer.innerHTML = `
                    <div class="empty-state">
                        <h3>Aún no hay calificaciones</h3>
                        <p>Agrega tu primera evaluación.</p>
                    </div>
                `;
            } else {
                gradesContainer.innerHTML = grades.map(grade => {
                    const subject = subjectMap.get(
                        Number(grade.subjectId)
                    );

                    return `
                        <article class="grade-card">
                            <h3>${escapeGradeHTML(grade.title)}</h3>

                            <p>${escapeGradeHTML(
                                subject?.name || "Materia eliminada"
                            )}</p>

                            <strong>
                                ${Number(grade.score).toFixed(1)}/10
                            </strong>

                            <p>
                                Ponderación:
                                ${Number(grade.weight).toFixed(1)}%
                            </p>

                            <p>Fecha: ${formatGradeDate(grade.date)}</p>

                            <button
                                class="secondary-button"
                                onclick="editGrade(${grade.id})">
                                Editar
                            </button>

                            <button
                                class="danger-button"
                                onclick="deleteGrade(${grade.id})">
                                Eliminar
                            </button>
                        </article>
                    `;
                }).join("");
            }

            renderSubjectAverages(grades, subjects, averagesContainer);

        } catch (error) {
            console.error("Error al cargar calificaciones:", error);

            gradesContainer.innerHTML =
                "<p>No se pudieron cargar las calificaciones.</p>";
        }
    }

    // CALCULAR PROMEDIOS POR MATERIA
    function renderSubjectAverages(grades, subjects, container) {
        if (!container) return;

        const results = subjects.map(subject => {
            const subjectGrades = grades.filter(
                grade => Number(grade.subjectId) === Number(subject.id)
            );

            const totalWeight = subjectGrades.reduce(
                (sum, grade) => sum + Number(grade.weight),
                0
            );

            const totalPoints = subjectGrades.reduce(
                (sum, grade) =>
                    sum + Number(grade.score) * Number(grade.weight),
                0
            );

            return {
                name: subject.name,
                average: totalWeight > 0
                    ? totalPoints / totalWeight
                    : null,
                totalWeight
            };
        });

        container.innerHTML = results.map(result => `
            <article class="subject-average-card">
                <h3>${escapeGradeHTML(result.name)}</h3>

                ${
                    result.average === null
                        ? "<p>Sin calificaciones</p>"
                        : `
                            <strong>${result.average.toFixed(2)}/10</strong>
                            <p>
                                Ponderación registrada:
                                ${result.totalWeight.toFixed(1)}%
                            </p>
                        `
                }
            </article>
        `).join("");

        const validAverages = results
            .filter(result => result.average !== null)
            .map(result => result.average);

        const generalAverage = validAverages.length
            ? validAverages.reduce((sum, value) => sum + value, 0) /
                validAverages.length
            : 0;

        const generalElement = document.getElementById("general-average");

        if (generalElement) {
            generalElement.textContent = generalAverage.toFixed(2);
        }
    }

    // PROTEGER TEXTO
    function escapeGradeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[character]);
    }

    // FORMATEAR FECHA
    function formatGradeDate(date) {
        if (!date) return "Sin fecha";

        const parts = date.split("-");

        return parts.length === 3
            ? `${parts[2]}/${parts[1]}/${parts[0]}`
            : date;
    }

    // FECHA LOCAL
    function getLocalDateString(date) {
        const localDate = new Date(
            date.getTime() - date.getTimezoneOffset() * 60000
        );

        return localDate.toISOString().split("T")[0];
    }

    // EDITAR CALIFICACIÓN
    window.editGrade = async function(id) {
        try {
            const grades = await getAllRecords("grades");

            const grade = grades.find(
                item => item.id === Number(id)
            );

            if (!grade) return;

            editingGradeId = grade.id;

            await loadSubjectOptions(grade.subjectId);

            document.getElementById("grade-name").value = grade.title;
            document.getElementById("grade-subject").value = grade.subjectId;
            document.getElementById("grade-score").value = grade.score;
            document.getElementById("grade-weight").value = grade.weight;
            document.getElementById("grade-date").value = grade.date;

            document.getElementById("grade-form-title").textContent =
                "Editar calificación";

            formContainer.classList.remove("hidden");

        } catch (error) {
            console.error("Error al editar calificación:", error);
            alert("No se pudo abrir la calificación.");
        }
    };

    // ELIMINAR CALIFICACIÓN
    window.deleteGrade = async function(id) {
        if (!confirm("¿Deseas eliminar esta calificación?")) return;

        try {
            const grades = await getAllRecords("grades");

            const gradeToDelete = grades.find(
                item => item.id === Number(id)
            );

            await deleteRecord("grades", Number(id));

            // Registrar eliminación en cola.
            if (gradeToDelete) {
                await registerGradeSync("delete", gradeToDelete);
            }

            await loadGrades();

            alert("Calificación eliminada.");

        } catch (error) {
            console.error("Error al eliminar calificación:", error);
            alert("No se pudo eliminar.");
        }
    };
});
