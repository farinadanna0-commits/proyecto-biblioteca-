const express = require('express');

const { one, many } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { detectarYProcesarAtrasos } = require('../services/atrasos');
const { toDictPrestamo } = require('./prestamos');

const router = express.Router();

router.get('/resumen', requireAuth, async (req, res) => {
  await detectarYProcesarAtrasos(req.appConfig);

  const activos = (await one(`SELECT COUNT(*)::int AS n FROM prestamos WHERE estado = 'activo'`)).n;
  const vencidos = (await one(`SELECT COUNT(*)::int AS n FROM prestamos WHERE estado = 'atrasado'`)).n;
  const totalLibros = (await one('SELECT COUNT(*)::int AS n FROM libros')).n;
  const totalSocios = (await one('SELECT COUNT(*)::int AS n FROM socios')).n;

  const notificaciones = await many(
    `SELECT * FROM prestamos WHERE estado = 'atrasado' ORDER BY fecha_estimada_devolucion LIMIT 10`
  );

  res.json({
    prestamos_activos: activos,
    prestamos_vencidos: vencidos,
    total_libros: totalLibros,
    total_socios: totalSocios,
    notificaciones: await Promise.all(notificaciones.map(toDictPrestamo)),
  });
});

module.exports = { router };
