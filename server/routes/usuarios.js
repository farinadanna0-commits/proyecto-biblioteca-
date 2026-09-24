const express = require('express');
const bcrypt = require('bcryptjs');

const db = require('../db');
const { requireRoles } = require('../middleware/auth');
const { toDictUsuario } = require('./auth');

const router = express.Router();

const ROLES = ['ADMIN', 'BIBLIOTECARIO', 'ENCARGADO'];
const TURNOS = ['MAÑANA', 'TARDE', 'CESPA'];

router.get('/', requireRoles('ADMIN'), (req, res) => {
  const usuarios = db.prepare('SELECT * FROM usuarios ORDER BY nombre_completo').all();
  res.json(usuarios.map(toDictUsuario));
});

router.post('/', requireRoles('ADMIN'), (req, res) => {
  const data = req.body || {};
  const username = (data.username || '').trim();
  const password = data.password || '';
  const nombre = (data.nombre_completo || '').trim();
  const rol = data.rol;
  const turno = data.turno;

  if (!username || !password || !nombre) {
    return res.status(400).json({ error: 'Usuario, contraseña y nombre completo son obligatorios' });
  }
  if (!ROLES.includes(rol)) {
    return res.status(400).json({ error: `Rol inválido. Debe ser uno de: ${ROLES.join(', ')}` });
  }
  if (!TURNOS.includes(turno)) {
    return res.status(400).json({ error: `Turno inválido. Debe ser uno de: ${TURNOS.join(', ')}` });
  }
  if (db.prepare('SELECT id FROM usuarios WHERE username = ?').get(username)) {
    return res.status(409).json({ error: 'Ese nombre de usuario ya existe' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(
      `INSERT INTO usuarios (username, password_hash, nombre_completo, rol, turno, estado)
       VALUES (?, ?, ?, ?, ?, 'activo')`
    )
    .run(username, passwordHash, nombre, rol, turno);

  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(Number(info.lastInsertRowid));
  res.status(201).json(toDictUsuario(usuario));
});

router.put('/:id/estado', requireRoles('ADMIN'), (req, res) => {
  const usuarioId = Number(req.params.id);
  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(usuarioId);
  if (!usuario) return res.status(404).json({ error: 'Recurso no encontrado' });

  const estado = (req.body || {}).estado;
  if (!['activo', 'inactivo'].includes(estado)) {
    return res.status(400).json({ error: "El estado debe ser 'activo' o 'inactivo'" });
  }

  db.prepare('UPDATE usuarios SET estado = ? WHERE id = ?').run(estado, usuarioId);
  const actualizado = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(usuarioId);
  res.json(toDictUsuario(actualizado));
});

router.put('/:id', requireRoles('ADMIN'), (req, res) => {
  const usuarioId = Number(req.params.id);
  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(usuarioId);
  if (!usuario) return res.status(404).json({ error: 'Recurso no encontrado' });

  const data = req.body || {};
  if ('nombre_completo' in data) {
    db.prepare('UPDATE usuarios SET nombre_completo = ? WHERE id = ?').run(data.nombre_completo, usuarioId);
  }
  if ('rol' in data && ROLES.includes(data.rol)) {
    db.prepare('UPDATE usuarios SET rol = ? WHERE id = ?').run(data.rol, usuarioId);
  }
  if ('turno' in data && TURNOS.includes(data.turno)) {
    db.prepare('UPDATE usuarios SET turno = ? WHERE id = ?').run(data.turno, usuarioId);
  }
  if (data.password) {
    db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(data.password, 10), usuarioId);
  }

  const actualizado = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(usuarioId);
  res.json(toDictUsuario(actualizado));
});

module.exports = { router };
