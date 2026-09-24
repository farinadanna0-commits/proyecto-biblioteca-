const express = require('express');

const db = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');

const router = express.Router();

const ESTADOS_EJEMPLAR = ['disponible', 'prestado', 'dañado', 'perdido'];

function toDictEjemplar(e) {
  return {
    id: e.id,
    libro_id: e.libro_id,
    numero_ejemplar: e.numero_ejemplar,
    estado: e.estado,
  };
}

function toDictLibro(libro, incluirEjemplares = true) {
  const ejemplares = db.prepare('SELECT * FROM ejemplares WHERE libro_id = ?').all(libro.id);
  const data = {
    id: libro.id,
    titulo: libro.titulo,
    autor: libro.autor,
    editorial: libro.editorial,
    edicion: libro.edicion,
    anio_publicacion: libro.anio_publicacion,
    genero: libro.genero,
    categoria: libro.categoria,
    isbn: libro.isbn,
    ubicacion_fisica: libro.ubicacion_fisica,
    precio_reposicion: libro.precio_reposicion,
    cantidad_ejemplares: ejemplares.length,
    ejemplares_disponibles: ejemplares.filter((e) => e.estado === 'disponible').length,
  };
  if (incluirEjemplares) {
    data.ejemplares = ejemplares.map(toDictEjemplar);
  }
  return data;
}

router.get('/', requireAuth, (req, res) => {
  const { titulo, autor, genero, categoria, isbn, disponible } = req.query;

  let sql = 'SELECT * FROM libros WHERE 1=1';
  const params = [];
  if (titulo) { sql += ' AND titulo LIKE ? COLLATE NOCASE'; params.push(`%${titulo}%`); }
  if (autor) { sql += ' AND autor LIKE ? COLLATE NOCASE'; params.push(`%${autor}%`); }
  if (genero) { sql += ' AND genero LIKE ? COLLATE NOCASE'; params.push(`%${genero}%`); }
  if (categoria) { sql += ' AND categoria LIKE ? COLLATE NOCASE'; params.push(`%${categoria}%`); }
  if (isbn) { sql += ' AND isbn LIKE ? COLLATE NOCASE'; params.push(`%${isbn}%`); }
  sql += ' ORDER BY titulo';

  const libros = db.prepare(sql).all(...params);
  let resultado = libros.map((l) => toDictLibro(l));

  if (disponible === 'true') {
    resultado = resultado.filter((l) => l.ejemplares_disponibles > 0);
  }

  res.json(resultado);
});

router.get('/:id', requireAuth, (req, res) => {
  const libro = db.prepare('SELECT * FROM libros WHERE id = ?').get(Number(req.params.id));
  if (!libro) return res.status(404).json({ error: 'Recurso no encontrado' });
  res.json(toDictLibro(libro));
});

router.post('/', requireRoles('ADMIN', 'BIBLIOTECARIO'), (req, res) => {
  const data = req.body || {};
  const titulo = (data.titulo || '').trim();
  const autor = (data.autor || '').trim();

  if (!titulo) return res.status(400).json({ error: 'El título es obligatorio' });

  let cantidad = parseInt(data.cantidad_ejemplares, 10);
  if (!Number.isFinite(cantidad)) cantidad = 1;
  cantidad = Math.max(cantidad, 1);

  const info = db
    .prepare(
      `INSERT INTO libros (titulo, autor, editorial, edicion, anio_publicacion, genero, categoria, isbn, ubicacion_fisica, precio_reposicion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      titulo,
      autor || 'Desconocido',
      data.editorial || null,
      data.edicion || null,
      data.anio_publicacion || null,
      data.genero || null,
      data.categoria || null,
      data.isbn || null,
      data.ubicacion_fisica || null,
      data.precio_reposicion || null
    );

  const libroId = Number(info.lastInsertRowid);
  const insertEjemplar = db.prepare(
    'INSERT INTO ejemplares (libro_id, numero_ejemplar, estado) VALUES (?, ?, ?)'
  );
  for (let n = 1; n <= cantidad; n++) {
    insertEjemplar.run(libroId, n, 'disponible');
  }

  const libro = db.prepare('SELECT * FROM libros WHERE id = ?').get(libroId);
  res.status(201).json(toDictLibro(libro));
});

router.put('/:id', requireRoles('ADMIN', 'BIBLIOTECARIO'), (req, res) => {
  const libroId = Number(req.params.id);
  const libro = db.prepare('SELECT * FROM libros WHERE id = ?').get(libroId);
  if (!libro) return res.status(404).json({ error: 'Recurso no encontrado' });

  const data = req.body || {};
  const campos = [
    'titulo', 'autor', 'editorial', 'edicion', 'anio_publicacion',
    'genero', 'categoria', 'isbn', 'ubicacion_fisica', 'precio_reposicion',
  ];
  const actualizaciones = campos.filter((c) => c in data);
  if (actualizaciones.length) {
    const set = actualizaciones.map((c) => `${c} = ?`).join(', ');
    const valores = actualizaciones.map((c) => data[c]);
    db.prepare(`UPDATE libros SET ${set} WHERE id = ?`).run(...valores, libroId);
  }

  const actualizado = db.prepare('SELECT * FROM libros WHERE id = ?').get(libroId);
  res.json(toDictLibro(actualizado));
});

router.delete('/:id', requireRoles('ADMIN'), (req, res) => {
  const libroId = Number(req.params.id);
  const libro = db.prepare('SELECT * FROM libros WHERE id = ?').get(libroId);
  if (!libro) return res.status(404).json({ error: 'Recurso no encontrado' });

  db.prepare('DELETE FROM ejemplares WHERE libro_id = ?').run(libroId);
  db.prepare('DELETE FROM libros WHERE id = ?').run(libroId);
  res.json({ mensaje: 'Libro eliminado del catálogo' });
});

router.post('/:id/ejemplares', requireRoles('ADMIN', 'BIBLIOTECARIO'), (req, res) => {
  const libroId = Number(req.params.id);
  const libro = db.prepare('SELECT * FROM libros WHERE id = ?').get(libroId);
  if (!libro) return res.status(404).json({ error: 'Recurso no encontrado' });

  const data = req.body || {};
  let cantidad = parseInt(data.cantidad, 10);
  if (!Number.isFinite(cantidad)) cantidad = 1;
  cantidad = Math.max(cantidad, 1);

  const existentes = db.prepare('SELECT numero_ejemplar FROM ejemplares WHERE libro_id = ?').all(libroId);
  const ultimo = existentes.reduce((max, e) => Math.max(max, e.numero_ejemplar), 0);

  const insertEjemplar = db.prepare(
    'INSERT INTO ejemplares (libro_id, numero_ejemplar, estado) VALUES (?, ?, ?)'
  );
  for (let i = 1; i <= cantidad; i++) {
    insertEjemplar.run(libroId, ultimo + i, 'disponible');
  }

  res.status(201).json(toDictLibro(libro));
});

router.put('/ejemplares/:id/estado', requireRoles('ADMIN', 'BIBLIOTECARIO', 'ENCARGADO'), (req, res) => {
  const ejemplarId = Number(req.params.id);
  const ejemplar = db.prepare('SELECT * FROM ejemplares WHERE id = ?').get(ejemplarId);
  if (!ejemplar) return res.status(404).json({ error: 'Recurso no encontrado' });

  const estado = (req.body || {}).estado;
  if (!ESTADOS_EJEMPLAR.includes(estado)) {
    return res.status(400).json({ error: `Estado inválido. Debe ser uno de: ${ESTADOS_EJEMPLAR.join(', ')}` });
  }
  if (ejemplar.estado === 'prestado' && estado === 'disponible') {
    return res.status(400).json({ error: 'No se puede marcar disponible un ejemplar que está prestado' });
  }

  db.prepare('UPDATE ejemplares SET estado = ? WHERE id = ?').run(estado, ejemplarId);
  const actualizado = db.prepare('SELECT * FROM ejemplares WHERE id = ?').get(ejemplarId);
  res.json(toDictEjemplar(actualizado));
});

module.exports = { router, toDictLibro, toDictEjemplar };
