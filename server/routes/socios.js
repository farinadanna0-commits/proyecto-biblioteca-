const express = require('express');

const { one, many, run } = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');

const router = express.Router();

const ESTADOS_PLAN = ['al_dia', 'suspendido', 'bloqueado'];

function toBool(valor, porDefecto = true) {
  if (valor === undefined || valor === null) return porDefecto;
  if (typeof valor === 'string') {
    return !['0', 'false', 'no', ''].includes(valor.trim().toLowerCase());
  }
  return Boolean(valor);
}

function toDictSocio(s) {
  return {
    id: s.id,
    tipo: s.tipo,
    nombre_completo: s.nombre_completo,
    dni: s.dni,
    telefono: s.telefono,
    email: s.email,
    curso: s.curso,
    division: s.division,
    materia: s.materia,
    estado_plan: s.estado_plan,
    es_socio: Boolean(s.es_socio),
  };
}

router.get('/', requireAuth, async (req, res) => {
  const { nombre, dni, tipo, estado_plan, es_socio } = req.query;

  let sql = 'SELECT * FROM socios WHERE 1=1';
  const params = [];
  if (nombre) { params.push(`%${nombre}%`); sql += ` AND nombre_completo ILIKE $${params.length}`; }
  if (dni) { params.push(`%${dni}%`); sql += ` AND dni ILIKE $${params.length}`; }
  if (tipo) { params.push(tipo); sql += ` AND tipo = $${params.length}`; }
  if (estado_plan) { params.push(estado_plan); sql += ` AND estado_plan = $${params.length}`; }
  if (es_socio !== undefined) { params.push(toBool(es_socio)); sql += ` AND es_socio = $${params.length}`; }
  sql += ' ORDER BY nombre_completo';

  const socios = await many(sql, params);
  res.json(socios.map(toDictSocio));
});

router.get('/:id', requireAuth, async (req, res) => {
  const socio = await one('SELECT * FROM socios WHERE id = $1', [Number(req.params.id)]);
  if (!socio) return res.status(404).json({ error: 'Recurso no encontrado' });
  res.json(toDictSocio(socio));
});

router.post('/', requireRoles('ADMIN', 'BIBLIOTECARIO'), async (req, res) => {
  const data = req.body || {};
  const nombre = (data.nombre_completo || '').trim();
  const dni = (data.dni || '').trim();

  if (!nombre || !dni) {
    return res.status(400).json({ error: 'Nombre completo y DNI son obligatorios' });
  }
  if (await one('SELECT id FROM socios WHERE dni = $1', [dni])) {
    return res.status(409).json({ error: 'Ya existe una persona registrada con ese DNI' });
  }

  const esSocio = toBool(data.es_socio, true);
  const socio = await one(
    `INSERT INTO socios (tipo, nombre_completo, dni, telefono, email, curso, division, materia, estado_plan, es_socio)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'al_dia', $9) RETURNING *`,
    [
      data.tipo || 'alumno',
      nombre,
      dni,
      data.telefono || null,
      data.email || null,
      data.curso || null,
      data.division || null,
      data.materia || null,
      esSocio,
    ]
  );

  res.status(201).json(toDictSocio(socio));
});

router.put('/:id', requireRoles('ADMIN', 'BIBLIOTECARIO'), async (req, res) => {
  const socioId = Number(req.params.id);
  const socio = await one('SELECT * FROM socios WHERE id = $1', [socioId]);
  if (!socio) return res.status(404).json({ error: 'Recurso no encontrado' });

  const data = req.body || {};
  const campos = ['tipo', 'nombre_completo', 'telefono', 'email', 'curso', 'division', 'materia'];
  const actualizaciones = campos.filter((c) => c in data);
  if (actualizaciones.length) {
    const valores = actualizaciones.map((c) => data[c]);
    const set = actualizaciones.map((c, i) => `${c} = $${i + 1}`).join(', ');
    await run(`UPDATE socios SET ${set} WHERE id = $${valores.length + 1}`, [...valores, socioId]);
  }

  if ('estado_plan' in data && ESTADOS_PLAN.includes(data.estado_plan)) {
    await run('UPDATE socios SET estado_plan = $1 WHERE id = $2', [data.estado_plan, socioId]);
  }

  if ('es_socio' in data) {
    await run('UPDATE socios SET es_socio = $1 WHERE id = $2', [toBool(data.es_socio), socioId]);
  }

  const actualizado = await one('SELECT * FROM socios WHERE id = $1', [socioId]);
  res.json(toDictSocio(actualizado));
});

router.delete('/:id', requireRoles('ADMIN'), async (req, res) => {
  const socioId = Number(req.params.id);
  const socio = await one('SELECT * FROM socios WHERE id = $1', [socioId]);
  if (!socio) return res.status(404).json({ error: 'Recurso no encontrado' });

  await run('DELETE FROM socios WHERE id = $1', [socioId]);
  res.json({ mensaje: 'Socio eliminado' });
});

module.exports = { router, toDictSocio };
