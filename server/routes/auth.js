const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const { one } = require('../db');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

function toDictUsuario(u) {
  return {
    id: u.id,
    username: u.username,
    nombre_completo: u.nombre_completo,
    rol: u.rol,
    turno: u.turno,
    estado: u.estado,
    creado_en: u.creado_en,
  };
}

router.post('/login', async (req, res) => {
  const data = req.body || {};
  const username = (data.username || '').trim();
  const password = data.password || '';

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
  }

  const usuario = await one('SELECT * FROM usuarios WHERE username = $1', [username]);
  if (!usuario || !bcrypt.compareSync(password, usuario.password_hash)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  if (usuario.estado !== 'activo') {
    return res.status(403).json({ error: 'Este usuario está inactivo. Contactá al administrador.' });
  }

  const token = jwt.sign(
    { rol: usuario.rol, turno: usuario.turno, nombre: usuario.nombre_completo },
    JWT_SECRET,
    { subject: String(usuario.id), expiresIn: '8h' }
  );

  res.json({ token, usuario: toDictUsuario(usuario) });
});

router.get('/me', requireAuth, async (req, res) => {
  const usuario = await one('SELECT * FROM usuarios WHERE id = $1', [req.user.id]);
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(toDictUsuario(usuario));
});

module.exports = { router, toDictUsuario };
