const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'cambiar-esta-clave-jwt-en-produccion';

function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Falta el token de autenticación' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: Number(payload.sub),
      rol: payload.rol,
      turno: payload.turno,
      nombre: payload.nombre,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function requireRoles(...rolesPermitidos) {
  return function (req, res, next) {
    requireAuth(req, res, (err) => {
      if (err) return next(err);
      if (!rolesPermitidos.includes(req.user.rol)) {
        return res.status(403).json({ error: 'No tenés permisos para realizar esta acción' });
      }
      next();
    });
  };
}

module.exports = { requireAuth, requireRoles, JWT_SECRET };
