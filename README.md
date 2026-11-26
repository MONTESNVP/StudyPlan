# StudyPlan — versión integrada

## Requisitos
- Python 3.10 o superior
- Flask (`py -m pip install flask`)
- Navegador actualizado (Chrome, Edge u Opera)
- VS Code con Live Server (o servidor HTTP local)

## Estructura
- `index.html`: interfaz y navegación.
- `css/styles.css`: estilos adaptables.
- `js/`: IndexedDB, CRUD, cámara, notificaciones, calendario y sincronización.
- `server/app.py`: backend Flask y API REST.
- `server/studyplan_remote.db`: base SQLite (se crea automáticamente si no existe).
- `manifest.json`, `service-worker.js`, `icons/`: instalación y modo offline.

## Ejecutar
1. Abre una terminal en `StudyPlan/server`.
2. Ejecuta `py -m pip install flask` (solo la primera vez).
3. Ejecuta `py app.py`. Flask queda en `http://127.0.0.1:5000`.
4. Abre la carpeta `StudyPlan` en VS Code y ejecuta Live Server sobre `index.html` (normalmente `http://127.0.0.1:5500`).
5. Mantén Flask activo para sincronización remota. La interfaz local funciona aunque Flask esté apagado.

## Funciones
- Materias: crear, editar, eliminar y consultar localmente; envío/consulta remota.
- Tareas: crear, editar, eliminar, completar, calendario, próximas entregas y notificaciones.
- Calificaciones: CRUD, promedio ponderado por materia y promedio general.
- IndexedDB: almacenamiento del navegador.
- SQLite: almacenamiento del servidor.
- Sincronización: operaciones locales pendientes se envían al recuperar conexión o al pulsar “Sincronizar ahora”. Las eliminaciones también se replican.
- Offline: el Service Worker almacena los recursos estáticos y la app conserva los datos locales en IndexedDB.
- Cámara: requiere permiso y un contexto seguro (localhost/127.0.0.1 o HTTPS).
- Notificaciones: requieren permiso del navegador; la comprobación periódica se ejecuta mientras la página está abierta.

## API
- `GET/POST /api/subjects`; `DELETE /api/subjects/<local_id>`
- `GET/POST /api/tasks`; `DELETE /api/tasks/<local_id>`
- `GET/POST /api/grades`; `DELETE /api/grades/<local_id>`
- `GET/POST /reporte`

Los POST usan `local_id` para actualizar el mismo registro al sincronizar repetidamente y evitar duplicados. `subject_id` se conserva como referencia al ID local de IndexedDB; no es una clave foránea al ID remoto.

## Demostración sugerida
1. Crear una materia y una tarea sin conexión; verificar que siguen apareciendo en la app.
2. Activar Flask y pulsar “Sincronizar ahora”.
3. Consultar materias/tareas/calificaciones en sus paneles remotos y abrir `/api/tasks`, `/api/grades`.
4. Crear una calificación y mostrar el promedio.
5. Abrir Calendario y seleccionar una fecha con tarea.
6. Activar notificaciones y probar cámara con permiso concedido.
7. Cargar la app una vez; después detener el servidor frontend y recargar para demostrar caché offline (Flask no es necesario para modo local).
8. Instalar desde el menú del navegador.

## Rúbrica: evidencia a presentar
1. Splash y Home: pantalla inicial y panel de indicadores.
2. Vistas cliente: seis secciones y navegación lateral.
3. Vistas servidor: `/reporte` y API JSON de materias, tareas y calificaciones.
4. Datos locales: CRUD y persistencia al recargar mediante IndexedDB.
5. Datos remotos: SQLite y consultas API.
6. Offline: Service Worker y datos locales disponibles sin red.
7. Notificaciones: permiso y recordatorios de tareas vencidas/hoy/mañana.
8. Elementos físicos: cámara y captura guardada localmente.
9. Documentación: este archivo y comentarios en el código.
10. Integración/demo: seguir la demostración sugerida.

## Limitaciones que deben explicarse en la exposición
- La sincronización es desde la cola local hacia Flask; consultar datos remotos muestra lo que está en SQLite, pero no descarga automáticamente cambios remotos a IndexedDB.
- El servidor está configurado para `127.0.0.1`; para usarlo desde otros dispositivos habría que configurar la IP del equipo servidor y CORS/red.
- Las notificaciones web de esta versión se revisan mientras la app está abierta; no son notificaciones push en segundo plano.
- El escáner captura fotografías; no realiza OCR automático.
