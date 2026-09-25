const express = require('express');

const { one, many, run } = require('../db');
const { requireRoles } = require('../middleware/auth');
const { detectarYProcesarAtrasos, actualizarEstadoPlanSocio } = require('../services/atrasos');

const router = express.Router();

async function toDictSancion(s) {
  const prestamo = await one('SELECT * FROM prestamos WHERE id = $1', [s.prestamo_id]);
  const socio = await one('SELECT * FROM socios WHERE id = $1', [s.socio_id]);
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

router.get('/', requireRoles('ADMIN', 'BIBLIOTECARIO'), async (req, res) => {
  await detectarYProcesarAtrasos(req.appConfig);

  const { estado_pago, tipo } = req.query;
  let sql = 'SELECT * FROM sanciones WHERE 1=1';
  const params = [];
  if (estado_pago) { params.push(estado_pago); sql += ` AND estado_pago = $${params.length}`; }
  if (tipo) { params.push(tipo); sql += ` AND tipo = $${params.length}`; }
  sql += ' ORDER BY fecha_generada DESC';

  const sanciones = await many(sql, params);
  res.json(await Promise.all(sanciones.map(toDictSancion)));
});

router.put('/:id/pagar', requireRoles('ADMIN', 'BIBLIOTECARIO'), async (req, res) => {
  const sancionId = Number(req.params.id);
  const sancion = await one('SELECT * FROM sanciones WHERE id = $1', [sancionId]);
  if (!sancion) return res.status(404).json({ error: 'Recurso no encontrado' });
  if (sancion.estado_pago === 'pagado') {
    return res.status(400).json({ error: 'Esta sanción ya fue pagada' });
  }

  await run(`UPDATE sanciones SET estado_pago = 'pagado', fecha_pagada = now() WHERE id = $1`, [sancionId]);

  await actualizarEstadoPlanSocio(sancion.socio_id);
  const actualizado = await one('SELECT * FROM sanciones WHERE id = $1', [sancionId]);
  res.json(await toDictSancion(actualizado));
});

module.exports = { router, toDictSancion };
