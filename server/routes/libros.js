const express = require('express');

const { one, many, run } = require('../db');
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

async function toDictLibro(libro, incluirEjemplares = true) {
  const ejemplares = await many('SELECT * FROM ejemplares WHERE libro_id = $1', [libro.id]);
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

router.get('/', requireAuth, async (req, res) => {
  const { titulo, autor, genero, categoria, isbn, disponible } = req.query;

  let sql = 'SELECT * FROM libros WHERE 1=1';
  const params = [];
  if (titulo) { params.push(`%${titulo}%`); sql += ` AND titulo ILIKE $${params.length}`; }
  if (autor) { params.push(`%${autor}%`); sql += ` AND autor ILIKE $${params.length}`; }
  if (genero) { params.push(`%${genero}%`); sql += ` AND genero ILIKE $${params.length}`; }
  if (categoria) { params.push(`%${categoria}%`); sql += ` AND categoria ILIKE $${params.length}`; }
  if (isbn) { params.push(`%${isbn}%`); sql += ` AND isbn ILIKE $${params.length}`; }
  sql += ' ORDER BY titulo';

  const libros = await many(sql, params);
  let resultado = await Promise.all(libros.map((l) => toDictLibro(l)));

  if (disponible === 'true') {
    resultado = resultado.filter((l) => l.ejemplares_disponibles > 0);
  }

  res.json(resultado);
});

router.get('/:id', requireAuth, async (req, res) => {
  const libro = await one('SELECT * FROM libros WHERE id = $1', [Number(req.params.id)]);
  if (!libro) return res.status(404).json({ error: 'Recurso no encontrado' });
  res.json(await toDictLibro(libro));
});

router.post('/', requireRoles('ADMIN', 'BIBLIOTECARIO'), async (req, res) => {
  const data = req.body || {};
  const titulo = (data.titulo || '').trim();
  const autor = (data.autor || '').trim();

  if (!titulo) return res.status(400).json({ error: 'El título es obligatorio' });

  let cantidad = parseInt(data.cantidad_ejemplares, 10);
  if (!Number.isFinite(cantidad)) cantidad = 1;
  cantidad = Math.max(cantidad, 1);

  const libro = await one(
    `INSERT INTO libros (titulo, autor, editorial, edicion, anio_publicacion, genero, categoria, isbn, ubicacion_fisica, precio_reposicion)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      titulo,
      autor || 'Desconocido',
      data.editorial || null,
      data.edicion || null,
      data.anio_publicacion || null,
      data.genero || null,
      data.categoria || null,
      data.isbn || null,
      data.ubicacion_fisica || null,
      data.precio_reposicion || null,
    ]
  );

  for (let n = 1; n <= cantidad; n++) {
    await run('INSERT INTO ejemplares (libro_id, numero_ejemplar, estado) VALUES ($1, $2, $3)', [libro.id, n, 'disponible']);
  }

  res.status(201).json(await toDictLibro(libro));
});

router.put('/:id', requireRoles('ADMIN', 'BIBLIOTECARIO'), async (req, res) => {
  const libroId = Number(req.params.id);
  const libro = await one('SELECT * FROM libros WHERE id = $1', [libroId]);
  if (!libro) return res.status(404).json({ error: 'Recurso no encontrado' });

  const data = req.body || {};
  const campos = [
    'titulo', 'autor', 'editorial', 'edicion', 'anio_publicacion',
    'genero', 'categoria', 'isbn', 'ubicacion_fisica', 'precio_reposicion',
  ];
  const actualizaciones = campos.filter((c) => c in data);
  if (actualizaciones.length) {
    const valores = actualizaciones.map((c) => data[c]);
    const set = actualizaciones.map((c, i) => `${c} = $${i + 1}`).join(', ');
    await run(`UPDATE libros SET ${set} WHERE id = $${valores.length + 1}`, [...valores, libroId]);
  }

  const actualizado = await one('SELECT * FROM libros WHERE id = $1', [libroId]);
  res.json(await toDictLibro(actualizado));
});

router.delete('/:id', requireRoles('ADMIN'), async (req, res) => {
  const libroId = Number(req.params.id);
  const libro = await one('SELECT * FROM libros WHERE id = $1', [libroId]);
  if (!libro) return res.status(404).json({ error: 'Recurso no encontrado' });

  await run('DELETE FROM ejemplares WHERE libro_id = $1', [libroId]);
  await run('DELETE FROM libros WHERE id = $1', [libroId]);
  res.json({ mensaje: 'Libro eliminado del catálogo' });
});

router.post('/:id/ejemplares', requireRoles('ADMIN', 'BIBLIOTECARIO'), async (req, res) => {
  const libroId = Number(req.params.id);
  const libro = await one('SELECT * FROM libros WHERE id = $1', [libroId]);
  if (!libro) return res.status(404).json({ error: 'Recurso no encontrado' });

  const data = req.body || {};
  let cantidad = parseInt(data.cantidad, 10);
  if (!Number.isFinite(cantidad)) cantidad = 1;
  cantidad = Math.max(cantidad, 1);

  const existentes = await many('SELECT numero_ejemplar FROM ejemplares WHERE libro_id = $1', [libroId]);
  const ultimo = existentes.reduce((max, e) => Math.max(max, e.numero_ejemplar), 0);

  for (let i = 1; i <= cantidad; i++) {
    await run('INSERT INTO ejemplares (libro_id, numero_ejemplar, estado) VALUES ($1, $2, $3)', [libroId, ultimo + i, 'disponible']);
  }

  res.status(201).json(await toDictLibro(libro));
});

router.put('/ejemplares/:id/estado', requireRoles('ADMIN', 'BIBLIOTECARIO', 'ENCARGADO'), async (req, res) => {
  const ejemplarId = Number(req.params.id);
  const ejemplar = await one('SELECT * FROM ejemplares WHERE id = $1', [ejemplarId]);
  if (!ejemplar) return res.status(404).json({ error: 'Recurso no encontrado' });

  const estado = (req.body || {}).estado;
  if (!ESTADOS_EJEMPLAR.includes(estado)) {
    return res.status(400).json({ error: `Estado inválido. Debe ser uno de: ${ESTADOS_EJEMPLAR.join(', ')}` });
  }
  if (ejemplar.estado === 'prestado' && estado === 'disponible') {
    return res.status(400).json({ error: 'No se puede marcar disponible un ejemplar que está prestado' });
  }

  await run('UPDATE ejemplares SET estado = $1 WHERE id = $2', [estado, ejemplarId]);
  const actualizado = await one('SELECT * FROM ejemplares WHERE id = $1', [ejemplarId]);
  res.json(toDictEjemplar(actualizado));
});

module.exports = { router, toDictLibro, toDictEjemplar };
