# Biblioteca Colegio Secundario San Carlos

Sistema de gestión de biblioteca — proyecto académico (Tecnicatura Superior
en Desarrollo de Software, CESPA). Implementa los 9 módulos del análisis
funcional: Libros, Socios, Préstamos y Devoluciones, Búsqueda y Catálogo,
Penalizaciones y Sanciones, Consultas y Reportes, Usuarios y Permisos,
Autenticación y Panel Principal.

## Estructura del proyecto

```
proyecto-biblioteca/
  index.html, style.css, script.js   Frontend
  server/                             API REST en Node/Express + SQLite (node:sqlite)
  data/biblioteca.sqlite              Base de datos (se crea sola, no se versiona)
```

## Puesta en marcha rápida

Un solo servidor Node levanta la API y el frontend juntos. Requiere Node 22+.

```bash
npm install    # sólo una vez
npm run seed   # sólo una vez (crea la base y los usuarios de demo)
npm start      # cada vez que quieras usar la app
```

Abrir `http://127.0.0.1:5000` en el navegador.

## Usuarios de demostración

| Usuario | Contraseña | Rol           | Turno   |
|---------|------------|---------------|---------|
| Enzo    | enzo123    | ADMIN         | MAÑANA  |
| martin  | martin123  | BIBLIOTECARIO | TARDE   |
| danna   | danna123   | ENCARGADO     | CESPA   |

Cambiar estas contraseñas antes de un uso real.

## Notas

- El diseño visual (CSS, tipografía, animaciones) no fue modificado: sólo se
  agregaron los campos y pestañas necesarios para cubrir los 9 módulos,
  reutilizando exactamente las mismas clases y variables ya definidas en
  `style.css`.
- El menú y los accesos disponibles cambian dinámicamente según el rol del
  usuario logueado (Módulo 9).
- Reglas de negocio configurables (multa por día de atraso, plazo de
  préstamo, costo de reposición) en el archivo `.env` de la raíz.
