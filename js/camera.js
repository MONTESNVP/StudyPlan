
document.addEventListener("DOMContentLoaded", () => {
    const video = document.getElementById("camera-preview");
    const canvas = document.getElementById("camera-canvas");
    const startButton = document.getElementById("start-camera");
    const captureButton = document.getElementById("take-photo");
    const stopButton = document.getElementById("stop-camera");
    const resultContainer = document.getElementById("photo-result");

    let cameraStream = null;
    let capturedImage = null;

    if (!video || !canvas || !resultContainer) return;

    startButton?.addEventListener("click", startCamera);
    captureButton?.addEventListener("click", takePhoto);
    stopButton?.addEventListener("click", stopCamera);

    captureButton.disabled = true;
    stopButton.disabled = true;

    loadPhotos();

    // ACTIVAR CÁMARA
    async function startCamera() {
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                alert("Tu navegador no permite acceder a la cámara.");
                return;
            }

            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: "environment" }
                },
                audio: false
            });

            video.srcObject = cameraStream;
            await video.play();

            video.classList.remove("hidden");

            captureButton.disabled = false;
            stopButton.disabled = false;
            startButton.disabled = true;

        } catch (error) {
            console.error("Error al activar la cámara:", error);

            if (error.name === "NotAllowedError") {
                alert("Debes permitir el acceso a la cámara.");
            } else if (error.name === "NotFoundError") {
                alert("No se encontró ninguna cámara disponible.");
            } else {
                alert("No se pudo activar la cámara.");
            }
        }
    }

    // TOMAR FOTOGRAFÍA
    async function takePhoto() {
        if (!cameraStream) {
            alert("Primero debes activar la cámara.");
            return;
        }

        if (!video.videoWidth || !video.videoHeight) {
            alert("La cámara todavía no está lista.");
            return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const context = canvas.getContext("2d");
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        capturedImage = canvas.toDataURL("image/jpeg", 0.85);

        // MOSTRAR VISTA PREVIA
        resultContainer.innerHTML = `
            <div class="photo-preview-card">
                <h3>Vista previa de la fotografía</h3>

                <img
                    src="${capturedImage}"
                    alt="Vista previa de la fotografía"
                    class="saved-photo">

                <div class="form-actions">
                    <button type="button" id="save-preview-photo"
                        class="primary-button">
                        Guardar fotografía
                    </button>

                    <button type="button" id="cancel-preview-photo"
                        class="secondary-button">
                        Volver a tomar
                    </button>
                </div>
            </div>
        `;

        document.getElementById("save-preview-photo")
            .addEventListener("click", saveCapturedPhoto);

        document.getElementById("cancel-preview-photo")
            .addEventListener("click", () => {
                capturedImage = null;
                loadPhotos();
            });
    }

    // GUARDAR FOTOGRAFÍA CONFIRMADA
    async function saveCapturedPhoto() {
        if (!capturedImage) return;

        const photo = {
            name: `Apunte ${new Date().toLocaleString("es-MX")}`,
            imageData: capturedImage,
            createdAt: new Date().toISOString()
        };

        try {
            await saveRecord("photos", photo);

            capturedImage = null;

            alert("Fotografía guardada correctamente.");
            await loadPhotos();

        } catch (error) {
            console.error("Error al guardar fotografía:", error);
            alert("No se pudo guardar la fotografía.");
        }
    }

    // DETENER CÁMARA
    function stopCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }

        video.srcObject = null;

        video.classList.add("hidden");

        captureButton.disabled = true;
        stopButton.disabled = true;
        startButton.disabled = false;
    }

    // CARGAR FOTOGRAFÍAS GUARDADAS
    async function loadPhotos() {
        try {
            const photos = await getAllRecords("photos");

            if (photos.length === 0) {
                resultContainer.innerHTML = `
                    <div class="empty-state">
                        <h3>No hay fotografías guardadas</h3>
                        <p>Tus documentos capturados aparecerán aquí.</p>
                    </div>
                `;
                return;
            }

            photos.sort((a, b) =>
                String(b.createdAt).localeCompare(String(a.createdAt))
            );

            resultContainer.innerHTML = `
                <div class="photos-grid">
                    ${photos.map(photo => `
                        <article class="photo-card">
                            <img
                                src="${photo.imageData}"
                                alt="Documento capturado"
                                class="saved-photo">

                            <div class="photo-card-info">
                                <h4>${escapePhotoHTML(photo.name)}</h4>
                                <p>${formatPhotoDate(photo.createdAt)}</p>

                                <button
                                    type="button"
                                    class="danger-button"
                                    onclick="deletePhoto(${photo.id})">
                                    Eliminar
                                </button>
                            </div>
                        </article>
                    `).join("")}
                </div>
            `;

        } catch (error) {
            console.error("Error al cargar fotografías:", error);
            resultContainer.innerHTML =
                "<p>No se pudieron cargar las fotografías.</p>";
        }
    }

    // ELIMINAR FOTOGRAFÍA
    window.deletePhoto = async function(id) {
        const confirmed = confirm(
            "¿Deseas eliminar esta fotografía?"
        );

        if (!confirmed) return;

        try {
            await deleteRecord("photos", Number(id));
            await loadPhotos();
            alert("Fotografía eliminada correctamente.");

        } catch (error) {
            console.error("Error al eliminar fotografía:", error);
            alert("No se pudo eliminar la fotografía.");
        }
    };

    function escapePhotoHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[character]);
    }

    function formatPhotoDate(date) {
        return new Date(date).toLocaleString("es-MX");
    }

    window.addEventListener("beforeunload", stopCamera);
});
