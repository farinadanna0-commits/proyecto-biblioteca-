const express = require('express');

const db = require('../db');
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

router.get('/', requireAuth, (req, res) => {
  const { nombre, dni, tipo, estado_plan, es_socio } = req.query;

  let sql = 'SELECT * FROM socios WHERE 1=1';
  const params = [];
  if (nombre) { sql += ' AND nombre_completo LIKE ? COLLATE NOCASE'; params.push(`%${nombre}%`); }
  if (dni) { sql += ' AND dni LIKE ? COLLATE NOCASE'; params.push(`%${dni}%`); }
  if (tipo) { sql += ' AND tipo = ?'; params.push(tipo); }
  if (estado_plan) { sql += ' AND estado_plan = ?'; params.push(estado_plan); }
  if (es_socio !== undefined) { sql += ' AND es_socio = ?'; params.push(toBool(es_socio) ? 1 : 0); }
  sql += ' ORDER BY nombre_completo';

  const socios = db.prepare(sql).all(...params);
  res.json(socios.map(toDictSocio));
});

router.get('/:id', requireAuth, (req, res) => {
  const socio = db.prepare('SELECT * FROM socios WHERE id = ?').get(Number(req.params.id));
  if (!socio) return res.status(404).json({ error: 'Recurso no encontrado' });
  res.json(toDictSocio(socio));
});

router.post('/', requireRoles('ADMIN', 'BIBLIOTECARIO'), (req, res) => {
  const data = req.body || {};
  const nombre = (data.nombre_completo || '').trim();
  const dni = (data.dni || '').trim();

  if (!nombre || !dni) {
    return res.status(400).json({ error: 'Nombre completo y DNI son obligatorios' });
  }
  if (db.prepare('SELECT id FROM socios WHERE dni = ?').get(dni)) {
    return res.status(409).json({ error: 'Ya existe una persona registrada con ese DNI' });
  }

  const esSocio = toBool(data.es_socio, true);
  const info = db
    .prepare(
      `INSERT INTO socios (tipo, nombre_completo, dni, telefono, email, curso, division, materia, estado_plan, es_socio)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'al_dia', ?)`
    )
    .run(
      data.tipo || 'alumno',
      nombre,
      dni,
      data.telefono || null,
      data.email || null,
      data.curso || null,
      data.division || null,
      data.materia || null,
      esSocio ? 1 : 0
    );

  const socio = db.prepare('SELECT * FROM socios WHERE id = ?').get(Number(info.lastInsertRowid));
  res.status(201).json(toDictSocio(socio));
});

router.put('/:id', requireRoles('ADMIN', 'BIBLIOTECARIO'), (req, res) => {
  const socioId = Number(req.params.id);
  const socio = db.prepare('SELECT * FROM socios WHERE id = ?').get(socioId);
  if (!socio) return res.status(404).json({ error: 'Recurso no encontrado' });

  const data = req.body || {};
  const campos = ['tipo', 'nombre_completo', 'telefono', 'email', 'curso', 'division', 'materia'];
  const actualizaciones = campos.filter((c) => c in data);
  if (actualizaciones.length) {
    const set = actualizaciones.map((c) => `${c} = ?`).join(', ');
    const valores = actualizaciones.map((c) => data[c]);
    db.prepare(`UPDATE socios SET ${set} WHERE id = ?`).run(...valores, socioId);
  }

  if ('estado_plan' in data && ESTADOS_PLAN.includes(data.estado_plan)) {
    db.prepare('UPDATE socios SET estado_plan = ? WHERE id = ?').run(data.estado_plan, socioId);
  }

  if ('es_socio' in data) {
    db.prepare('UPDATE socios SET es_socio = ? WHERE id = ?').run(toBool(data.es_socio) ? 1 : 0, socioId);
  }

  const actualizado = db.prepare('SELECT * FROM socios WHERE id = ?').get(socioId);
  res.json(toDictSocio(actualizado));
});

router.delete('/:id', requireRoles('ADMIN'), (req, res) => {
  const socioId = Number(req.params.id);
  const socio = db.prepare('SELECT * FROM socios WHERE id = ?').get(socioId);
  if (!socio) return res.status(404).json({ error: 'Recurso no encontrado' });

  db.prepare('DELETE FROM socios WHERE id = ?').run(socioId);
  res.json({ mensaje: 'Socio eliminado' });
});

module.exports = { router, toDictSocio };
