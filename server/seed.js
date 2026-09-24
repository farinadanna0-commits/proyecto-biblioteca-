/**
 * Carga datos de demostración en la base de datos SQLite.
 * Ejecutar una sola vez, luego de instalar las dependencias:
 *     npm run seed
 */
const bcrypt = require('bcryptjs');
const db = require('./db');

function isoOffset(dias) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function existeUsuario(username) {
  return db.prepare('SELECT id FROM usuarios WHERE username = ?').get(username);
}

// ---------- Usuarios del equipo (Módulo 7 y 8) ----------
const usuarios = [
  { username: 'Enzo', nombre_completo: 'Lezcano Enzo Gabriel', rol: 'ADMIN', turno: 'MAÑANA', password: 'enzo123' },
  { username: 'martin', nombre_completo: 'Benítez Martín Esteban', rol: 'BIBLIOTECARIO', turno: 'TARDE', password: 'martin123' },
  { username: 'danna', nombre_completo: 'Fariña Danna Maricela', rol: 'ENCARGADO', turno: 'CESPA', password: 'danna123' },
];

const insertUsuario = db.prepare(
  `INSERT INTO usuarios (username, password_hash, nombre_completo, rol, turno, estado)
   VALUES (?, ?, ?, ?, ?, 'activo')`
);

for (const u of usuarios) {
  if (!existeUsuario(u.username)) {
    insertUsuario.run(u.username, bcrypt.hashSync(u.password, 10), u.nombre_completo, u.rol, u.turno);
  }
}

const idUsuarios = {
  admin: db.prepare('SELECT id FROM usuarios WHERE username = ?').get('Enzo').id,
  bibliotecario: db.prepare('SELECT id FROM usuarios WHERE username = ?').get('martin').id,
  encargado: db.prepare('SELECT id FROM usuarios WHERE username = ?').get('danna').id,
};

// ---------- Libros y ejemplares (Módulo 1) ----------
const libroIds = {};
const totalLibros = db.prepare('SELECT COUNT(*) AS n FROM libros').get().n;
if (totalLibros === 0) {
  const insertLibro = db.prepare(
    `INSERT INTO libros (titulo, autor, editorial, edicion, anio_publicacion, genero, categoria, isbn, ubicacion_fisica, precio_reposicion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertEjemplar = db.prepare(
    'INSERT INTO ejemplares (libro_id, numero_ejemplar, estado) VALUES (?, ?, ?)'
  );

  const libros = [
    { key: 'cien_anios', titulo: 'Cien años de soledad', autor: 'Gabriel García Márquez', editorial: 'Sudamericana', edicion: '1ra', anio: 1967, genero: 'Realismo Mágico', categoria: 'Lengua', isbn: '978-0307474728', ubicacion: 'Estante A1', precio: 8000, ejemplares: ['disponible', 'disponible', 'disponible'] },
    { key: 'rayuela', titulo: 'Rayuela', autor: 'Julio Cortázar', editorial: 'Sudamericana', edicion: '1ra', anio: 1963, genero: 'Novela', categoria: 'Lengua', isbn: '978-8437604572', ubicacion: 'Estante A2', precio: 7500, ejemplares: ['disponible', 'disponible'] },
    { key: 'principito', titulo: 'El Principito', autor: 'Antoine de Saint-Exupéry', editorial: 'Salamandra', edicion: '3ra', anio: 1943, genero: 'Fábula', categoria: 'Lengua', isbn: '978-8498381498', ubicacion: 'Estante A1', precio: 6000, ejemplares: ['disponible', 'disponible', 'disponible', 'disponible'] },
    { key: 'martin_fierro', titulo: 'Martín Fierro', autor: 'José Hernández', editorial: 'Colihue', edicion: '2da', anio: 1872, genero: 'Poesía', categoria: 'Lengua', isbn: '978-9505815078', ubicacion: 'Estante A3', precio: 5500, ejemplares: ['disponible', 'disponible'] },
    { key: 'derechos_humanos', titulo: 'Los Derechos Humanos y su Historia', autor: 'Enrique Dussel', editorial: 'Docencia', edicion: '1ra', anio: 2004, genero: 'Ensayo', categoria: 'Formación Ética y Ciudadana', isbn: '978-9505464523', ubicacion: 'Estante C1', precio: 6500, ejemplares: ['disponible'] },
    { key: 'historia_arg', titulo: 'Historia Argentina Contemporánea', autor: 'Felipe Pigna', editorial: 'Planeta', edicion: '4ta', anio: 2011, genero: 'Ensayo', categoria: 'Historia', isbn: '978-9504935108', ubicacion: 'Estante B1', precio: 9000, ejemplares: ['disponible', 'disponible', 'disponible'] },
    { key: 'quimica', titulo: 'Introducción a la Química General', autor: 'Raymond Chang', editorial: 'McGraw-Hill', edicion: '11va', anio: 2013, genero: 'Manual', categoria: 'Ciencias', isbn: '978-6071511932', ubicacion: 'Estante D1', precio: 12000, ejemplares: ['disponible', 'disponible'] },
    { key: 'fisica', titulo: 'Física I', autor: 'Raymond A. Serway', editorial: 'Cengage', edicion: '9na', anio: 2015, genero: 'Manual', categoria: 'Ciencias', isbn: '978-6075199617', ubicacion: 'Estante D2', precio: 12500, ejemplares: ['disponible', 'dañado'] },
    { key: 'eternauta', titulo: 'El Eternauta', autor: 'H. G. Oesterheld', editorial: 'Doedytores', edicion: '1ra', anio: 1957, genero: 'Historieta', categoria: 'Arte', isbn: '978-9871220058', ubicacion: 'Estante E1', precio: 7000, ejemplares: ['disponible', 'disponible'] },
    { key: 'atlas', titulo: 'Atlas Geográfico Mundial', autor: 'Varios autores', editorial: 'Clarín', edicion: '2da', anio: 2018, genero: 'Manual', categoria: 'Geografía', isbn: '978-9500728841', ubicacion: 'Estante D3', precio: 8500, ejemplares: ['dañado', 'perdido'] },
  ];

  for (const l of libros) {
    const info = insertLibro.run(l.titulo, l.autor, l.editorial, l.edicion, l.anio, l.genero, l.categoria, l.isbn, l.ubicacion, l.precio);
    const libroId = Number(info.lastInsertRowid);
    libroIds[l.key] = libroId;
    l.ejemplares.forEach((estado, i) => insertEjemplar.run(libroId, i + 1, estado));
  }
}

// ---------- Socios (Módulo 2) ----------
const socioIds = {};
const totalSocios = db.prepare('SELECT COUNT(*) AS n FROM socios').get().n;
if (totalSocios === 0) {
  const insertSocio = db.prepare(
    `INSERT INTO socios (tipo, nombre_completo, dni, telefono, email, curso, division, materia, estado_plan, es_socio)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const socios = [
    { key: 'carlos', tipo: 'maestro', nombre: 'Carlos Gómez', dni: '38901234', tel: '555-0192', email: 'carlos@mail.com', curso: null, division: null, materia: 'Historia', estado: 'al_dia', esSocio: 1 },
    { key: 'lucia', tipo: 'alumno', nombre: 'Lucía Fernández', dni: '40123456', tel: '555-0143', email: 'lucia@mail.com', curso: '4° Año', division: 'A', materia: null, estado: 'al_dia', esSocio: 1 },
    { key: 'tomas', tipo: 'alumno', nombre: 'Tomás Ibarra', dni: '41987654', tel: '555-0177', email: 'tomas@mail.com', curso: '2° Año', division: 'B', materia: null, estado: 'al_dia', esSocio: 0 },
    { key: 'martina', tipo: 'alumno', nombre: 'Martina Sosa', dni: '42556677', tel: '555-0201', email: 'martina@mail.com', curso: '5° Año', division: 'B', materia: null, estado: 'al_dia', esSocio: 1 },
    { key: 'julian', tipo: 'alumno', nombre: 'Julián Acosta', dni: '43112233', tel: '555-0212', email: 'julian@mail.com', curso: '1° Año', division: 'A', materia: null, estado: 'suspendido', esSocio: 1 },
    { key: 'rocio', tipo: 'alumno', nombre: 'Rocío Medina', dni: '44223344', tel: '555-0223', email: 'rocio@mail.com', curso: '3° Año', division: 'C', materia: null, estado: 'al_dia', esSocio: 1 },
    { key: 'bruno', tipo: 'alumno', nombre: 'Bruno Ledesma', dni: '45334455', tel: '555-0234', email: 'bruno@mail.com', curso: '6° Año', division: 'A', materia: null, estado: 'bloqueado', esSocio: 1 },
    { key: 'valentina', tipo: 'maestro', nombre: 'Valentina Rojas', dni: '30778899', tel: '555-0245', email: 'valentina@mail.com', curso: null, division: null, materia: 'Matemática', estado: 'al_dia', esSocio: 1 },
    { key: 'sergio', tipo: 'maestro', nombre: 'Sergio Paz', dni: '29556611', tel: '555-0256', email: 'sergio@mail.com', curso: null, division: null, materia: 'Lengua y Literatura', estado: 'al_dia', esSocio: 0 },
    { key: 'agustina', tipo: 'alumno', nombre: 'Agustina Herrera', dni: '46667788', tel: '555-0267', email: 'agustina@mail.com', curso: '4° Año', division: 'B', materia: null, estado: 'al_dia', esSocio: 0 },
    { key: 'nicolas', tipo: 'alumno', nombre: 'Nicolás Funes', dni: '47778899', tel: '555-0278', email: 'nicolas@mail.com', curso: '2° Año', division: 'A', materia: null, estado: 'al_dia', esSocio: 1 },
    { key: 'camila', tipo: 'maestro', nombre: 'Camila Ortiz', dni: '31445566', tel: '555-0289', email: 'camila@mail.com', curso: null, division: null, materia: 'Biología', estado: 'suspendido', esSocio: 1 },
  ];

  for (const s of socios) {
    const info = insertSocio.run(s.tipo, s.nombre, s.dni, s.tel, s.email, s.curso, s.division, s.materia, s.estado, s.esSocio);
    socioIds[s.key] = Number(info.lastInsertRowid);
  }
}

// ---------- Préstamos de ejemplo (Módulo 3) ----------
// Sólo tiene sentido si hay libros y socios recién creados en esta misma
// corrida (si ya existían de antes, no sabemos qué ejemplares siguen
// disponibles, así que no se tocan para no romper datos reales).
const totalPrestamos = db.prepare('SELECT COUNT(*) AS n FROM prestamos').get().n;
if (totalPrestamos === 0 && Object.keys(libroIds).length && Object.keys(socioIds).length) {
  const ejemplarPorLibro = (libroKey, numero) =>
    db.prepare('SELECT id FROM ejemplares WHERE libro_id = ? AND numero_ejemplar = ?').get(libroIds[libroKey], numero).id;

  const insertPrestamo = db.prepare(
    `INSERT INTO prestamos (codigo, ejemplar_id, socio_id, encargado_id, encargado_recepcion_id, fecha_prestamo, fecha_estimada_devolucion, fecha_real_devolucion, estado, estado_libro_devuelto, observaciones)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const marcarEjemplar = db.prepare('UPDATE ejemplares SET estado = ? WHERE id = ?');

  // 1) Activo, recién prestado (no vencido).
  const ej1 = ejemplarPorLibro('principito', 1);
  insertPrestamo.run('PR-DEMO0001', ej1, socioIds.nicolas, idUsuarios.bibliotecario, null, isoOffset(-3), isoOffset(11), null, 'activo', null, null);
  marcarEjemplar.run('prestado', ej1);

  // 2) Activo, por vencer en 2 días.
  const ej2 = ejemplarPorLibro('historia_arg', 1);
  insertPrestamo.run('PR-DEMO0002', ej2, socioIds.martina, idUsuarios.encargado, null, isoOffset(-12), isoOffset(2), null, 'activo', null, null);
  marcarEjemplar.run('prestado', ej2);

  // 3) Vencido: queda como 'activo' a propósito — el sistema lo detecta y
  //    pasa a 'atrasado' (con su sanción y suspensión del socio) solo,
  //    la primera vez que se consulta /prestamos, /sanciones o el dashboard.
  const ej3 = ejemplarPorLibro('quimica', 1);
  insertPrestamo.run('PR-DEMO0003', ej3, socioIds.rocio, idUsuarios.bibliotecario, null, isoOffset(-20), isoOffset(-6), null, 'activo', null, null);
  marcarEjemplar.run('prestado', ej3);

  // 4) Devuelto en buen estado.
  insertPrestamo.run(
    'PR-DEMO0004', ejemplarPorLibro('martin_fierro', 1), socioIds.lucia, idUsuarios.encargado, idUsuarios.encargado,
    isoOffset(-30), isoOffset(-16), isoOffset(-18), 'devuelto', 'buen_estado', null
  );

  // 5) Devuelto con daño menor (el ejemplar de "El Eternauta" #1 ya quedó
  //    'dañado' reflejando ese resultado).
  insertPrestamo.run(
    'PR-DEMO0005', ejemplarPorLibro('eternauta', 1), socioIds.carlos, idUsuarios.admin, idUsuarios.admin,
    isoOffset(-25), isoOffset(-11), isoOffset(-10), 'devuelto', 'dano_menor', 'Tapa despegada, se encuadernó de nuevo.'
  );
  marcarEjemplar.run('dañado', ejemplarPorLibro('eternauta', 1));
}

console.log('Datos de demostración cargados correctamente.');
console.log('  ADMIN         -> usuario: Enzo    / contraseña: enzo123');
console.log('  BIBLIOTECARIO -> usuario: martin  / contraseña: martin123');
console.log('  ENCARGADO     -> usuario: danna   / contraseña: danna123');
