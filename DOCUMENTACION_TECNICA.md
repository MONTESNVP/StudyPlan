# Documentación técnica — StudyPlan

## 1. Descripción general
StudyPlan es una aplicación web progresiva para organizar materias, tareas, calificaciones y fechas académicas. Está construida con HTML, CSS y JavaScript sin frameworks en el cliente; utiliza IndexedDB para persistencia local, un Service Worker para caché offline y Flask con SQLite para almacenamiento remoto.

## 2. Arquitectura

```text
Navegador (Live Server / PWA)
  ├── index.html + css/styles.css
  ├── JavaScript
  │    ├── database.js       IndexedDB
  │    ├── subjects.js       CRUD materias
  │    ├── tasks.js          CRUD tareas
  │    ├── grades.js         CRUD calificaciones y promedios
  │    ├── calendar.js       calendario basado en tareas
  │    ├── camera.js         captura y almacenamiento de fotos
  │    ├── notifications.js  recordatorios del navegador
  │    ├── sync.js           cola y envío de cambios
  │    └── remote-panels.js  consulta de datos remotos
  └── service-worker.js      caché de recursos estáticos

Servidor Flask (127.0.0.1:5000)
  ├── API REST
  ├── vista /reporte
  └── SQLite: subjects, tasks, grades
```

## 3. Modelo de datos local

IndexedDB utiliza la base `StudyPlanDB` y los almacenes:

| Almacén | Uso |
|---|---|
| subjects | Materias del estudiante |
| tasks | Actividades, fecha, prioridad y estado |
| grades | Evaluaciones, calificación y ponderación |
| photos | Fotografías capturadas con la cámara |
| pendingSync | Operaciones pendientes de enviar al servidor |

Los almacenes principales usan `id` autoincremental. `pendingSync` conserva el almacén, la operación, los datos y el estado pendiente.

## 4. Modelo de datos remoto

SQLite conserva las tablas `subjects`, `tasks` y `grades`. Cada tabla incluye una llave primaria remota `id`; las tablas sincronizables incluyen `local_id`, que identifica el registro de IndexedDB. Este identificador permite hacer inserciones idempotentes (un reenvío actualiza el registro asociado en vez de duplicarlo).

`subject_id` en tareas y calificaciones conserva el ID local de la materia. No es una llave foránea al ID remoto.

## 5. API REST

| Método | Ruta | Acción |
|---|---|---|
| GET | `/api/subjects` | Consultar materias |
| POST | `/api/subjects` | Crear/actualizar materia vinculada por `local_id` |
| DELETE | `/api/subjects/<local_id>` | Eliminar materia vinculada |
| GET | `/api/tasks` | Consultar tareas |
| POST | `/api/tasks` | Crear/actualizar tarea vinculada |
| DELETE | `/api/tasks/<local_id>` | Eliminar tarea vinculada |
| GET | `/api/grades` | Consultar calificaciones |
| POST | `/api/grades` | Crear/actualizar calificación vinculada |
| DELETE | `/api/grades/<local_id>` | Eliminar calificación vinculada |
| GET/POST | `/reporte` | Mostrar y generar reporte HTML |

Las respuestas de API utilizan JSON con la propiedad `success` y datos o mensajes.

## 6. Flujos funcionales

### Persistencia local
1. El usuario captura un registro en un formulario.
2. JavaScript valida los campos.
3. `database.js` guarda el registro en IndexedDB.
4. La vista vuelve a consultar IndexedDB y se actualiza.
5. La operación se agrega a `pendingSync`.

### Sincronización remota
1. El usuario inicia Flask.
2. Selecciona “Sincronizar ahora” en Inicio.
3. `sync.js` lee las operaciones pendientes.
4. Envía POST para altas/ediciones o DELETE para bajas.
5. Si el servidor confirma éxito, elimina esa operación de la cola.
6. Si ocurre un error, la operación permanece pendiente para reintentar.

### Funcionamiento offline
Los registros continúan disponibles en IndexedDB. El Service Worker almacena los recursos de la interfaz. Las operaciones remotas permanecen en la cola hasta que exista conexión y el servidor esté disponible.

## 7. Seguridad y validaciones
- Consultas SQLite parametrizadas para evitar concatenar valores en SQL.
- Escape de texto al generar tarjetas HTML.
- Validación de campos obligatorios y rangos de calificaciones en frontend y backend.
- Acceso a cámara sujeto al permiso del usuario y a un contexto seguro.
- CORS abierto para el entorno académico local. Para producción debe restringirse al origen autorizado y proteger el servidor.

## 8. Instalación y ejecución
1. Instalar Python 3.10+.
2. En la carpeta del proyecto ejecutar `py -m pip install -r requirements.txt`.
3. Abrir terminal en `server` y ejecutar `py app.py`.
4. Abrir `index.html` con Live Server en VS Code.
5. Mantener Flask activo para consultar/sincronizar datos remotos.

## 9. Pruebas de aceptación
- Crear, editar y eliminar una materia; recargar y comprobar persistencia.
- Crear, editar, completar y eliminar una tarea; verificar calendario y contadores.
- Registrar calificaciones y comprobar promedios por materia y general.
- Apagar Flask, crear registros y comprobar que quedan en IndexedDB y en la cola.
- Encender Flask y ejecutar sincronización; consultar los endpoints GET.
- Desconectar internet después de cargar la PWA y verificar que la interfaz local abre desde caché.
- Conceder permiso de notificaciones y probar una tarea con vencimiento cercano.
- Conceder permiso de cámara, capturar una imagen y comprobar que aparece en la galería local.

## 10. Correspondencia con la rúbrica

| Criterio | Evidencia dentro de StudyPlan |
|---|---|
| 1. Splash y Home | Splash inicial, Inicio e indicadores |
| 2. Vistas del cliente | Inicio, Materias, Tareas, Calificaciones, Calendario y Escáner |
| 3. Vistas del servidor | Vista HTML `/reporte` y endpoints JSON Flask |
| 4. Datos locales | CRUD y IndexedDB |
| 5. Datos remotos | CRUD remoto por API y SQLite |
| 6. Offline | Service Worker, caché y persistencia local |
| 7. Notificaciones | Notificaciones web para tareas próximas/vencidas |
| 8. Elementos físicos | Cámara del dispositivo y captura fotográfica |
| 9. Documentación | Este documento y README |
| 10. Integración y demostración | Flujo local-remoto y pruebas de aceptación |

## 11. Alcance y limitaciones conocidas
- La sincronización implementada envía cambios desde IndexedDB hacia Flask. Las consultas remotas muestran los registros del servidor, pero no descargan cambios remotos a IndexedDB.
- Las notificaciones se revisan periódicamente mientras la página está abierta; no se implementa Web Push en segundo plano.
- El escáner guarda fotografías; no incluye reconocimiento óptico de caracteres (OCR).
- El endpoint remoto apunta a `127.0.0.1`; para otros equipos debe configurarse la IP/host del servidor y las reglas de red/CORS.
- La cámara y la instalación PWA requieren HTTPS o localhost.
