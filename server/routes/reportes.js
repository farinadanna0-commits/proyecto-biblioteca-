const express = require('express');

const db = require('../db');
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

router.get('/prestados-actualmente', requireRoles('ADMIN', 'BIBLIOTECARIO'), (req, res) => {
  const prestamos = db
    .prepare(`SELECT * FROM prestamos WHERE estado IN ('activo', 'atrasado') ORDER BY fecha_prestamo DESC`)
    .all();
  res.json(prestamos.map(toDictPrestamo));
});

router.get('/vencidos', requireRoles('ADMIN', 'BIBLIOTECARIO'), (req, res) => {
  const { desde, hasta } = rangoFechas(req);
  const hoy = hoyISO();
  const prestamos = db
    .prepare(
      `SELECT * FROM prestamos
       WHERE estado IN ('atrasado', 'activo')
         AND fecha_estimada_devolucion BETWEEN ? AND ?
         AND fecha_estimada_devolucion < ?
       ORDER BY fecha_estimada_devolucion`
    )
    .all(desde, hasta, hoy);
  res.json(prestamos.map(toDictPrestamo));
});

router.get('/socios-atrasados', requireRoles('ADMIN', 'BIBLIOTECARIO'), (req, res) => {
  const socios = db
    .prepare(`SELECT * FROM socios WHERE estado_plan IN ('suspendido', 'bloqueado')`)
    .all();
  res.json(socios.map(toDictSocio));
});

router.get('/mas-solicitados', requireRoles('ADMIN', 'BIBLIOTECARIO'), (req, res) => {
  const { desde, hasta } = rangoFechas(req);
  const resultados = db
    .prepare(
      `SELECT l.id AS libro_id, l.titulo, l.autor, COUNT(p.id) AS total_prestamos
       FROM libros l
       JOIN ejemplares e ON e.libro_id = l.id
       JOIN prestamos p ON p.ejemplar_id = e.id
       WHERE p.fecha_prestamo BETWEEN ? AND ?
       GROUP BY l.id
       ORDER BY total_prestamos DESC
       LIMIT 20`
    )
    .all(desde, hasta);
  res.json(resultados);
});

router.get('/danos-perdidas', requireRoles('ADMIN', 'BIBLIOTECARIO'), (req, res) => {
  const { desde, hasta } = rangoFechas(req);
  const prestamos = db
    .prepare(
      `SELECT * FROM prestamos
       WHERE estado_libro_devuelto IN ('dano_menor', 'dano_mayor', 'perdida')
         AND fecha_real_devolucion BETWEEN ? AND ?
       ORDER BY fecha_real_devolucion DESC`
    )
    .all(desde, hasta);
  res.json(prestamos.map(toDictPrestamo));
});

router.get('/ingresos-multas', requireRoles('ADMIN', 'BIBLIOTECARIO'), (req, res) => {
  const { desde, hasta } = rangoFechas(req);
  const sanciones = db
    .prepare(
      `SELECT * FROM sanciones
       WHERE estado_pago = 'pagado'
         AND date(fecha_pagada) BETWEEN ? AND ?
       ORDER BY fecha_pagada DESC`
    )
    .all(desde, hasta);

  const total = sanciones.reduce((acc, s) => acc + (s.monto_multa || 0) + (s.monto_reposicion || 0), 0);
  res.json({
    total_recaudado: total,
    cantidad_sanciones: sanciones.length,
    detalle: sanciones.map(toDictSancion),
  });
});

module.exports = { router };
