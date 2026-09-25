const express = require('express');
const crypto = require('crypto');

const { one, many, run } = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { detectarYProcesarAtrasos, actualizarEstadoPlanSocio, hoyISO } = require('../services/atrasos');

const router = express.Router();

function generarCodigo() {
  return `PR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function sumarDias(fechaISO, dias) {
  const fecha = new Date(fechaISO + 'T00:00:00Z');
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

function esFechaValida(valor) {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) && !Number.isNaN(new Date(valor + 'T00:00:00Z').getTime());
}

const MODALIDADES = ['domicilio', 'sala'];

async function toDictPrestamo(p) {
  const ejemplar = await one('SELECT * FROM ejemplares WHERE id = $1', [p.ejemplar_id]);
  const libro = ejemplar ? await one('SELECT * FROM libros WHERE id = $1', [ejemplar.libro_id]) : null;
  const socio = await one('SELECT * FROM socios WHERE id = $1', [p.socio_id]);

  return {
    id: p.id,
    codigo: p.codigo,
    ejemplar_id: p.ejemplar_id,
    libro_id: libro ? libro.id : null,
    libro_titulo: libro ? libro.titulo : null,
    libro_autor: libro ? libro.autor : null,
    numero_ejemplar: ejemplar ? ejemplar.numero_ejemplar : null,
    socio_id: p.socio_id,
    socio_nombre: socio ? socio.nombre_completo : null,
    socio_dni: socio ? socio.dni : null,
    encargado_id: p.encargado_id,
    encargado_recepcion_id: p.encargado_recepcion_id,
    fecha_prestamo: p.fecha_prestamo,
    fecha_estimada_devolucion: p.fecha_estimada_devolucion,
    fecha_real_devolucion: p.fecha_real_devolucion,
    estado: p.estado,
    estado_libro_devuelto: p.estado_libro_devuelto,
    observaciones: p.observaciones,
    modalidad: p.modalidad,
  };
}

router.get('/', requireAuth, async (req, res) => {
  await detectarYProcesarAtrasos(req.appConfig);

  const { estado, socio_id } = req.query;
  let sql = 'SELECT * FROM prestamos WHERE 1=1';
  const params = [];
  if (estado) { params.push(estado); sql += ` AND estado = $${params.length}`; }
  if (socio_id) { params.push(Number(socio_id)); sql += ` AND socio_id = $${params.length}`; }
  sql += ' ORDER BY fecha_prestamo DESC';

  const prestamos = await many(sql, params);
  res.json(await Promise.all(prestamos.map(toDictPrestamo)));
});

router.post('/', requireRoles('ADMIN', 'BIBLIOTECARIO', 'ENCARGADO'), async (req, res) => {
  await detectarYProcesarAtrasos(req.appConfig);

  const data = req.body || {};
  const libroId = data.libro_id;
  const socioId = data.socio_id;
  const fechaPrestamo = data.fecha_prestamo || hoyISO();
  const fechaEstimadaInput = data.fecha_estimada_devolucion;
  const diasPrestamo = parseInt(data.dias_prestamo, 10);
  const modalidad = data.modalidad || 'domicilio';

  if (!libroId || !socioId) {
    return res.status(400).json({ error: 'Libro y socio son obligatorios' });
  }
  if (!MODALIDADES.includes(modalidad)) {
    return res.status(400).json({ error: `Modalidad inválida. Debe ser una de: ${MODALIDADES.join(', ')}` });
  }

  const socio = await one('SELECT * FROM socios WHERE id = $1', [Number(socioId)]);
  if (!socio) return res.status(404).json({ error: 'Socio no encontrado' });
  if (socio.estado_plan !== 'al_dia') {
    return res.status(403).json({
      error: `El socio no puede solicitar préstamos: estado del plan "${socio.estado_plan}"`,
    });
  }
  if (modalidad === 'domicilio' && !socio.es_socio) {
    return res.status(403).json({
      error: 'Sólo los socios pueden llevarse libros a domicilio. A quienes no son socios se les presta para leer en la biblioteca (modalidad "sala").',
    });
  }

  const libro = await one('SELECT * FROM libros WHERE id = $1', [Number(libroId)]);
  if (!libro) return res.status(404).json({ error: 'Libro no encontrado' });

  if (modalidad === 'domicilio') {
    const { n: disponibles } = await one(
      `SELECT COUNT(*)::int AS n FROM ejemplares WHERE libro_id = $1 AND estado = 'disponible'`,
      [Number(libroId)]
    );
    if (disponibles === 1 && req.user.rol !== 'ADMIN') {
      return res.status(403).json({
        error: 'Este es el último ejemplar disponible de este libro: se reserva para leer en la biblioteca (modalidad "sala"). Sólo un administrador puede autorizar llevarlo a domicilio.',
      });
    }
  }

  const ejemplar = await one(
    `SELECT * FROM ejemplares WHERE libro_id = $1 AND estado = 'disponible' LIMIT 1`,
    [Number(libroId)]
  );
  if (!ejemplar) return res.status(409).json({ error: 'No hay ejemplares disponibles de este libro' });

  if (!esFechaValida(fechaPrestamo) || (fechaEstimadaInput && !esFechaValida(fechaEstimadaInput))) {
    return res.status(400).json({ error: 'Formato de fecha inválido (usar AAAA-MM-DD)' });
  }
  const dias = Number.isFinite(diasPrestamo) && diasPrestamo > 0 ? diasPrestamo : req.appConfig.DIAS_PRESTAMO_DEFAULT;
  const fechaEstimada = fechaEstimadaInput || sumarDias(fechaPrestamo, dias);

  const codigo = generarCodigo();
  const prestamo = await one(
    `INSERT INTO prestamos (codigo, ejemplar_id, socio_id, encargado_id, fecha_prestamo, fecha_estimada_devolucion, estado, modalidad)
     VALUES ($1, $2, $3, $4, $5, $6, 'activo', $7) RETURNING *`,
    [codigo, ejemplar.id, Number(socioId), req.user.id, fechaPrestamo, fechaEstimada, modalidad]
  );

  await run(`UPDATE ejemplares SET estado = 'prestado' WHERE id = $1`, [ejemplar.id]);

  res.status(201).json(await toDictPrestamo(prestamo));
});

router.put('/:id/renovar', requireRoles('ADMIN', 'BIBLIOTECARIO', 'ENCARGADO'), async (req, res) => {
  await detectarYProcesarAtrasos(req.appConfig);

  const prestamoId = Number(req.params.id);
  const prestamo = await one('SELECT * FROM prestamos WHERE id = $1', [prestamoId]);
  if (!prestamo) return res.status(404).json({ error: 'Recurso no encontrado' });
  if (prestamo.estado !== 'activo') {
    return res.status(400).json({ error: 'Sólo se pueden renovar préstamos activos (no vencidos, devueltos o perdidos)' });
  }

  const diasInput = parseInt((req.body || {}).dias, 10);
  const dias = Number.isFinite(diasInput) && diasInput > 0 ? diasInput : req.appConfig.DIAS_PRESTAMO_DEFAULT;
  const nuevaFecha = sumarDias(prestamo.fecha_estimada_devolucion, dias);
  await run('UPDATE prestamos SET fecha_estimada_devolucion = $1 WHERE id = $2', [nuevaFecha, prestamoId]);

  const actualizado = await one('SELECT * FROM prestamos WHERE id = $1', [prestamoId]);
  res.json(await toDictPrestamo(actualizado));
});

router.put('/:id/devolver', requireRoles('ADMIN', 'BIBLIOTECARIO', 'ENCARGADO'), async (req, res) => {
  const prestamoId = Number(req.params.id);
  const prestamo = await one('SELECT * FROM prestamos WHERE id = $1', [prestamoId]);
  if (!prestamo) return res.status(404).json({ error: 'Recurso no encontrado' });
  if (prestamo.estado === 'devuelto') {
    return res.status(400).json({ error: 'Este préstamo ya fue devuelto' });
  }

  const data = req.body || {};
  const estadoLibro = data.estado_libro_devuelto || 'buen_estado';
  const observaciones = data.observaciones || null;
  const hoy = hoyISO();

  const ejemplar = await one('SELECT * FROM ejemplares WHERE id = $1', [prestamo.ejemplar_id]);

  if (estadoLibro === 'perdida') {
    await run(
      `UPDATE prestamos SET fecha_real_devolucion = $1, estado_libro_devuelto = $2, observaciones = $3,
        encargado_recepcion_id = $4, estado = 'perdido' WHERE id = $5`,
      [hoy, estadoLibro, observaciones, req.user.id, prestamoId]
    );

    if (ejemplar) await run(`UPDATE ejemplares SET estado = 'perdido' WHERE id = $1`, [ejemplar.id]);

    const libro = ejemplar ? await one('SELECT * FROM libros WHERE id = $1', [ejemplar.libro_id]) : null;
    const costo = libro && libro.precio_reposicion ? libro.precio_reposicion : req.appConfig.COSTO_REPOSICION_DEFAULT;

    await run(
      `INSERT INTO sanciones (prestamo_id, socio_id, tipo, monto_reposicion, estado_pago)
       VALUES ($1, $2, 'perdida', $3, 'pendiente')`,
      [prestamoId, prestamo.socio_id, costo]
    );
  } else {
    await run(
      `UPDATE prestamos SET fecha_real_devolucion = $1, estado_libro_devuelto = $2, observaciones = $3,
        encargado_recepcion_id = $4, estado = 'devuelto' WHERE id = $5`,
      [hoy, estadoLibro, observaciones, req.user.id, prestamoId]
    );

    if (ejemplar) {
      const nuevoEstado = ['dano_menor', 'dano_mayor'].includes(estadoLibro) ? 'dañado' : 'disponible';
      await run('UPDATE ejemplares SET estado = $1 WHERE id = $2', [nuevoEstado, ejemplar.id]);
    }
  }

  await actualizarEstadoPlanSocio(prestamo.socio_id);
  const actualizado = await one('SELECT * FROM prestamos WHERE id = $1', [prestamoId]);
  res.json(await toDictPrestamo(actualizado));
});

router.put('/:id/reabrir', requireRoles('ADMIN', 'BIBLIOTECARIO'), async (req, res) => {
  const prestamoId = Number(req.params.id);
  const prestamo = await one('SELECT * FROM prestamos WHERE id = $1', [prestamoId]);
  if (!prestamo) return res.status(404).json({ error: 'Recurso no encontrado' });
  if (!['devuelto', 'perdido'].includes(prestamo.estado)) {
    return res.status(400).json({ error: 'Sólo se puede reabrir un préstamo devuelto o marcado como perdido' });
  }

  const ejemplar = await one('SELECT * FROM ejemplares WHERE id = $1', [prestamo.ejemplar_id]);
  if (ejemplar) await run(`UPDATE ejemplares SET estado = 'prestado' WHERE id = $1`, [ejemplar.id]);

  const nuevoEstado = prestamo.fecha_estimada_devolucion >= hoyISO() ? 'activo' : 'atrasado';
  await run(
    `UPDATE prestamos SET estado = $1, fecha_real_devolucion = NULL, estado_libro_devuelto = NULL WHERE id = $2`,
    [nuevoEstado, prestamoId]
  );

  await run(`DELETE FROM sanciones WHERE prestamo_id = $1 AND tipo = 'perdida'`, [prestamoId]);

  await actualizarEstadoPlanSocio(prestamo.socio_id);
  const actualizado = await one('SELECT * FROM prestamos WHERE id = $1', [prestamoId]);
  res.json(await toDictPrestamo(actualizado));
});

router.delete('/:id', requireRoles('ADMIN'), async (req, res) => {
  const prestamoId = Number(req.params.id);
  const prestamo = await one('SELECT * FROM prestamos WHERE id = $1', [prestamoId]);
  if (!prestamo) return res.status(404).json({ error: 'Recurso no encontrado' });

  const ejemplar = await one('SELECT * FROM ejemplares WHERE id = $1', [prestamo.ejemplar_id]);
  if (ejemplar && ejemplar.estado === 'prestado') {
    await run(`UPDATE ejemplares SET estado = 'disponible' WHERE id = $1`, [ejemplar.id]);
  }

  await run('DELETE FROM sanciones WHERE prestamo_id = $1', [prestamoId]);
  await run('DELETE FROM prestamos WHERE id = $1', [prestamoId]);
  res.json({ mensaje: 'Préstamo eliminado' });
});

module.exports = { router, toDictPrestamo };
