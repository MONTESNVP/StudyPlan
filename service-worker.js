
const CACHE_VERSION = "v9";

const STATIC_CACHE = `studyplan-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `studyplan-dynamic-${CACHE_VERSION}`;

const STATIC_FILES = [
    "./",
    "./index.html",
    "./manifest.json",
    "./css/styles.css",
    "./js/app.js",
    "./js/database.js",
    "./js/subjects.js",
    "./js/tasks.js",
    "./js/grades.js",
    "./js/calendar.js",
    "./js/camera.js",
    "./js/notifications.js",
    "./js/sync.js",
    "./js/remote-panels.js",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
];

self.addEventListener("install", event => {
    console.log("Instalando StudyPlan Service Worker...");

    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => cache.addAll(STATIC_FILES))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    console.log("Activando StudyPlan Service Worker...");

    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames.map(cacheName => {
                    const isStudyPlanCache =
                        cacheName.startsWith("studyplan-");

                    const isCurrentCache =
                        cacheName === STATIC_CACHE ||
                        cacheName === DYNAMIC_CACHE;

                    if (isStudyPlanCache && !isCurrentCache) {
                        return caches.delete(cacheName);
                    }
                })
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    const request = event.request;
    const url = new URL(request.url);

    if (
        request.method !== "GET" ||
        url.origin !== self.location.origin
    ) {
        return;
    }

    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok) {
                        const copy = response.clone();

                        caches.open(DYNAMIC_CACHE)
                            .then(cache => cache.put(request, copy));
                    }

                    return response;
                })
                .catch(async () => {
                    return await caches.match(request) ||
                        await caches.match("./index.html");
                })
        );

        return;
    }

    const isStaticFile = STATIC_FILES.some(file => {
        return new URL(file, self.registration.scope).href === request.url;
    });

    if (isStaticFile) {
        event.respondWith(
            caches.match(request)
                .then(response => response || fetch(request))
        );

        return;
    }

    event.respondWith(
        fetch(request)
            .then(response => {
                if (response.ok) {
                    const copy = response.clone();

                    caches.open(DYNAMIC_CACHE)
                        .then(cache => cache.put(request, copy));
                }

                return response;
            })
            .catch(async () => {
                const cachedResponse = await caches.match(request);

                if (cachedResponse) return cachedResponse;

                return new Response(
                    "Recurso no disponible sin conexión.",
                    {
                        status: 503,
                        headers: {
                            "Content-Type": "text/plain; charset=utf-8"
                        }
                    }
                );
            })
    );
});