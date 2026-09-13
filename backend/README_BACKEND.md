# Backend — Biblioteca Colegio Secundario San Carlos

API REST en Flask + SQLAlchemy + JWT que implementa los 9 módulos del
análisis funcional (Libros, Socios, Préstamos y Devoluciones, Búsqueda y
Catálogo, Penalizaciones y Sanciones, Consultas y Reportes, Usuarios y
Permisos, Autenticación, Panel Principal).

## 1. Instalación

Requiere Python 3.10+.

```bash
cd backend
python -m venv venv
source venv/bin/activate        # En Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## 2. Configuración

```bash
cp .env.example .env
```

Por defecto usa SQLite (no requiere instalar nada más). Para usar PostgreSQL,
editar `DATABASE_URL` en `.env` con la cadena de conexión de tu servidor.

## 3. Cargar datos de demostración

```bash
python seed.py
```

Esto crea la base de datos y tres usuarios:

| Usuario | Contraseña | Rol           | Turno   |
|---------|------------|---------------|---------|
| Enzo    | enzo123    | ADMIN         | MAÑANA  |
| martin  | martin123  | BIBLIOTECARIO | TARDE   |
| danna   | danna123   | ENCARGADO     | CESPA   |

**Importante:** cambiar estas contraseñas antes de usar el sistema en un
entorno real (se pueden actualizar desde el panel de "Usuarios" una vez
logueado como ADMIN, o volviendo a ejecutar `seed.py` con otros valores).

## 4. Levantar el servidor

```bash
python run.py
```

La API queda disponible en `http://127.0.0.1:5000/api`. Podés verificar que
está funcionando entrando a `http://127.0.0.1:5000/api/health`.

## 5. Conectar el frontend

El archivo `../script.js` ya apunta a `http://127.0.0.1:5000/api` mediante la
constante `API_BASE` al principio del archivo. Si el backend corre en otra
URL o puerto, sólo hay que editar esa línea.

Para servir el frontend (recomendado, en vez de abrir el `.html` directo con
`file://`, para evitar problemas de CORS en algunos navegadores):

```bash
cd ..              # volver a la carpeta del proyecto (donde está index.html)
python -m http.server 5500
```

Y abrir `http://127.0.0.1:5500` en el navegador.

## Estructura

```
backend/
  app/
    config.py          Configuración y reglas de negocio (multas, plazos)
    extensions.py       Instancias de SQLAlchemy, JWT y CORS
    models/              Un archivo por entidad (usuario, libro, socio, prestamo, sancion)
    routes/               Un blueprint por módulo funcional
    services/              Lógica de negocio compartida (detección de atrasos)
    utils/                  Decorador de permisos por rol
  seed.py             Datos de demostración
  run.py              Punto de entrada del servidor
  requirements.txt
```

## Notas de diseño

- **Ejemplares**: cada libro tiene N "ejemplares" (copias físicas), cada uno
  con su propio estado (`disponible` / `prestado` / `dañado` / `perdido`).
  Esto permite que un mismo título tenga varias copias en distintos estados
  a la vez, tal como pide el análisis.
- **Detección de atrasos**: no depende de un cron externo. Cada vez que se
  consultan préstamos, sanciones o el dashboard, el backend revisa préstamos
  vencidos, los marca como `atrasado`, genera la multa correspondiente y
  suspende el plan del socio automáticamente.
- **Roles**: `ADMIN` (todo, incluida la gestión de usuarios), `BIBLIOTECARIO`
  (libros, socios, préstamos, sanciones, reportes), `ENCARGADO` (préstamos y
  consultas del día a día). Cada endpoint valida el rol con el decorador
  `@roles_required(...)`.
