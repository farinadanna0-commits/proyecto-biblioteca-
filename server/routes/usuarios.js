const express = require('express');
const bcrypt = require('bcryptjs');

const { one, many, run } = require('../db');
const { requireRoles } = require('../middleware/auth');
const { toDictUsuario } = require('./auth');

const router = express.Router();

const ROLES = ['ADMIN', 'BIBLIOTECARIO', 'ENCARGADO'];
const TURNOS = ['MAÑANA', 'TARDE', 'CESPA'];

router.get('/', requireRoles('ADMIN'), async (req, res) => {
  const usuarios = await many('SELECT * FROM usuarios ORDER BY nombre_completo');
  res.json(usuarios.map(toDictUsuario));
});

router.post('/', requireRoles('ADMIN'), async (req, res) => {
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
  if (await one('SELECT id FROM usuarios WHERE username = $1', [username])) {
    return res.status(409).json({ error: 'Ese nombre de usuario ya existe' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const usuario = await one(
    `INSERT INTO usuarios (username, password_hash, nombre_completo, rol, turno, estado)
     VALUES ($1, $2, $3, $4, $5, 'activo') RETURNING *`,
    [username, passwordHash, nombre, rol, turno]
  );

  res.status(201).json(toDictUsuario(usuario));
});

router.put('/:id/estado', requireRoles('ADMIN'), async (req, res) => {
  const usuarioId = Number(req.params.id);
  const usuario = await one('SELECT * FROM usuarios WHERE id = $1', [usuarioId]);
  if (!usuario) return res.status(404).json({ error: 'Recurso no encontrado' });

  const estado = (req.body || {}).estado;
  if (!['activo', 'inactivo'].includes(estado)) {
    return res.status(400).json({ error: "El estado debe ser 'activo' o 'inactivo'" });
  }

  await run('UPDATE usuarios SET estado = $1 WHERE id = $2', [estado, usuarioId]);
  const actualizado = await one('SELECT * FROM usuarios WHERE id = $1', [usuarioId]);
  res.json(toDictUsuario(actualizado));
});

router.put('/:id', requireRoles('ADMIN'), async (req, res) => {
  const usuarioId = Number(req.params.id);
  const usuario = await one('SELECT * FROM usuarios WHERE id = $1', [usuarioId]);
  if (!usuario) return res.status(404).json({ error: 'Recurso no encontrado' });

  const data = req.body || {};
  if ('nombre_completo' in data) {
    await run('UPDATE usuarios SET nombre_completo = $1 WHERE id = $2', [data.nombre_completo, usuarioId]);
  }
  if ('rol' in data && ROLES.includes(data.rol)) {
    await run('UPDATE usuarios SET rol = $1 WHERE id = $2', [data.rol, usuarioId]);
  }
  if ('turno' in data && TURNOS.includes(data.turno)) {
    await run('UPDATE usuarios SET turno = $1 WHERE id = $2', [data.turno, usuarioId]);
  }
  if (data.password) {
    await run('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [bcrypt.hashSync(data.password, 10), usuarioId]);
  }

  const actualizado = await one('SELECT * FROM usuarios WHERE id = $1', [usuarioId]);
  res.json(toDictUsuario(actualizado));
});

module.exports = { router };
