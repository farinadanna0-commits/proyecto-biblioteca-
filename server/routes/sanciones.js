const express = require('express');

const db = require('../db');
const { requireRoles } = require('../middleware/auth');
const { detectarYProcesarAtrasos, actualizarEstadoPlanSocio } = require('../services/atrasos');

const router = express.Router();

function toDictSancion(s) {
  const prestamo = db.prepare('SELECT * FROM prestamos WHERE id = ?').get(s.prestamo_id);
  const socio = db.prepare('SELECT * FROM socios WHERE id = ?').get(s.socio_id);
  const montoMulta = s.monto_multa || 0;
  const montoReposicion = s.monto_reposicion || 0;

  return {
    id: s.id,
    prestamo_id: s.prestamo_id,
    prestamo_codigo: prestamo ? prestamo.codigo : null,
    socio_id: s.socio_id,
    socio_nombre: socio ? socio.nombre_completo : null,
    tipo: s.tipo,
    dias_atraso: s.dias_atraso,
    monto_multa: s.monto_multa,
    monto_reposicion: s.monto_reposicion,
    monto_total: montoMulta + montoReposicion,
    estado_pago: s.estado_pago,
    fecha_generada: s.fecha_generada,
    fecha_pagada: s.fecha_pagada,
  };
}

router.get('/', requireRoles('ADMIN', 'BIBLIOTECARIO'), (req, res) => {
  detectarYProcesarAtrasos(req.appConfig);

  const { estado_pago, tipo } = req.query;
  let sql = 'SELECT * FROM sanciones WHERE 1=1';
  const params = [];
  if (estado_pago) { sql += ' AND estado_pago = ?'; params.push(estado_pago); }
  if (tipo) { sql += ' AND tipo = ?'; params.push(tipo); }
  sql += ' ORDER BY fecha_generada DESC';

  const sanciones = db.prepare(sql).all(...params);
  res.json(sanciones.map(toDictSancion));
});

router.put('/:id/pagar', requireRoles('ADMIN', 'BIBLIOTECARIO'), (req, res) => {
  const sancionId = Number(req.params.id);
  const sancion = db.prepare('SELECT * FROM sanciones WHERE id = ?').get(sancionId);
  if (!sancion) return res.status(404).json({ error: 'Recurso no encontrado' });
  if (sancion.estado_pago === 'pagado') {
    return res.status(400).json({ error: 'Esta sanción ya fue pagada' });
  }

  db.prepare(
    `UPDATE sanciones SET estado_pago = 'pagado', fecha_pagada = datetime('now') WHERE id = ?`
  ).run(sancionId);

  actualizarEstadoPlanSocio(sancion.socio_id);
  const actualizado = db.prepare('SELECT * FROM sanciones WHERE id = ?').get(sancionId);
  res.json(toDictSancion(actualizado));
});

module.exports = { router, toDictSancion };
