const express = require('express');

const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { detectarYProcesarAtrasos } = require('../services/atrasos');
const { toDictPrestamo } = require('./prestamos');

const router = express.Router();

router.get('/resumen', requireAuth, (req, res) => {
  detectarYProcesarAtrasos(req.appConfig);

  const activos = db.prepare(`SELECT COUNT(*) AS n FROM prestamos WHERE estado = 'activo'`).get().n;
  const vencidos = db.prepare(`SELECT COUNT(*) AS n FROM prestamos WHERE estado = 'atrasado'`).get().n;
  const totalLibros = db.prepare('SELECT COUNT(*) AS n FROM libros').get().n;
  const totalSocios = db.prepare('SELECT COUNT(*) AS n FROM socios').get().n;

  const notificaciones = db
    .prepare(
      `SELECT * FROM prestamos WHERE estado = 'atrasado' ORDER BY fecha_estimada_devolucion LIMIT 10`
    )
    .all();

  res.json({
    prestamos_activos: activos,
    prestamos_vencidos: vencidos,
    total_libros: totalLibros,
    total_socios: totalSocios,
    notificaciones: notificaciones.map(toDictPrestamo),
  });
});

module.exports = { router };
