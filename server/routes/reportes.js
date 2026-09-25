const express = require('express');

const { many } = require('../db');
const { requireRoles } = require('../middleware/auth');
const { toDictPrestamo } = require('./prestamos');
const { toDictSocio } = require('./socios');
const { toDictSancion } = require('./sanciones');
const { hoyISO } = require('../services/atrasos');

const router = express.Router();

function rangoFechas(req) {
  const desde = req.query.desde || '2000-01-01';
  const hasta = req.query.hasta || hoyISO();
  return { desde, hasta };
}

router.get('/prestados-actualmente', requireRoles('ADMIN', 'BIBLIOTECARIO'), async (req, res) => {
  const prestamos = await many(
    `SELECT * FROM prestamos WHERE estado IN ('activo', 'atrasado') ORDER BY fecha_prestamo DESC`
  );
  res.json(await Promise.all(prestamos.map(toDictPrestamo)));
});

router.get('/vencidos', requireRoles('ADMIN', 'BIBLIOTECARIO'), async (req, res) => {
  const { desde, hasta } = rangoFechas(req);
  const hoy = hoyISO();
  const prestamos = await many(
    `SELECT * FROM prestamos
     WHERE estado IN ('atrasado', 'activo')
       AND fecha_estimada_devolucion BETWEEN $1 AND $2
       AND fecha_estimada_devolucion < $3
     ORDER BY fecha_estimada_devolucion`,
    [desde, hasta, hoy]
  );
  res.json(await Promise.all(prestamos.map(toDictPrestamo)));
});

router.get('/socios-atrasados', requireRoles('ADMIN', 'BIBLIOTECARIO'), async (req, res) => {
  const socios = await many(`SELECT * FROM socios WHERE estado_plan IN ('suspendido', 'bloqueado')`);
  res.json(socios.map(toDictSocio));
});

router.get('/mas-solicitados', requireRoles('ADMIN', 'BIBLIOTECARIO'), async (req, res) => {
  const { desde, hasta } = rangoFechas(req);
  const resultados = await many(
    `SELECT l.id AS libro_id, l.titulo, l.autor, COUNT(p.id)::int AS total_prestamos
     FROM libros l
     JOIN ejemplares e ON e.libro_id = l.id
     JOIN prestamos p ON p.ejemplar_id = e.id
     WHERE p.fecha_prestamo BETWEEN $1 AND $2
     GROUP BY l.id
     ORDER BY total_prestamos DESC
     LIMIT 20`,
    [desde, hasta]
  );
  res.json(resultados);
});

router.get('/danos-perdidas', requireRoles('ADMIN', 'BIBLIOTECARIO'), async (req, res) => {
  const { desde, hasta } = rangoFechas(req);
  const prestamos = await many(
    `SELECT * FROM prestamos
     WHERE estado_libro_devuelto IN ('dano_menor', 'dano_mayor', 'perdida')
       AND fecha_real_devolucion BETWEEN $1 AND $2
     ORDER BY fecha_real_devolucion DESC`,
    [desde, hasta]
  );
  res.json(await Promise.all(prestamos.map(toDictPrestamo)));
});

router.get('/ingresos-multas', requireRoles('ADMIN', 'BIBLIOTECARIO'), async (req, res) => {
  const { desde, hasta } = rangoFechas(req);
  const sanciones = await many(
    `SELECT * FROM sanciones
     WHERE estado_pago = 'pagado'
       AND fecha_pagada::date BETWEEN $1 AND $2
     ORDER BY fecha_pagada DESC`,
    [desde, hasta]
  );

  const total = sanciones.reduce((acc, s) => acc + (s.monto_multa || 0) + (s.monto_reposicion || 0), 0);
  res.json({
    total_recaudado: total,
    cantidad_sanciones: sanciones.length,
    detalle: await Promise.all(sanciones.map(toDictSancion)),
  });
});

module.exports = { router };
