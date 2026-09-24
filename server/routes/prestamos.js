const express = require('express');
const crypto = require('crypto');

const db = require('../db');
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

function toDictPrestamo(p) {
  const ejemplar = db.prepare('SELECT * FROM ejemplares WHERE id = ?').get(p.ejemplar_id);
  const libro = ejemplar ? db.prepare('SELECT * FROM libros WHERE id = ?').get(ejemplar.libro_id) : null;
  const socio = db.prepare('SELECT * FROM socios WHERE id = ?').get(p.socio_id);

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

router.get('/', requireAuth, (req, res) => {
  detectarYProcesarAtrasos(req.appConfig);

  const { estado, socio_id } = req.query;
  let sql = 'SELECT * FROM prestamos WHERE 1=1';
  const params = [];
  if (estado) { sql += ' AND estado = ?'; params.push(estado); }
  if (socio_id) { sql += ' AND socio_id = ?'; params.push(Number(socio_id)); }
  sql += ' ORDER BY fecha_prestamo DESC';

  const prestamos = db.prepare(sql).all(...params);
  res.json(prestamos.map(toDictPrestamo));
});

router.post('/', requireRoles('ADMIN', 'BIBLIOTECARIO', 'ENCARGADO'), (req, res) => {
  detectarYProcesarAtrasos(req.appConfig);

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

  const socio = db.prepare('SELECT * FROM socios WHERE id = ?').get(Number(socioId));
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

  const libro = db.prepare('SELECT * FROM libros WHERE id = ?').get(Number(libroId));
  if (!libro) return res.status(404).json({ error: 'Libro no encontrado' });

  if (modalidad === 'domicilio') {
    const { n: disponibles } = db
      .prepare(`SELECT COUNT(*) AS n FROM ejemplares WHERE libro_id = ? AND estado = 'disponible'`)
      .get(Number(libroId));
    if (disponibles === 1 && req.user.rol !== 'ADMIN') {
      return res.status(403).json({
        error: 'Este es el último ejemplar disponible de este libro: se reserva para leer en la biblioteca (modalidad "sala"). Sólo un administrador puede autorizar llevarlo a domicilio.',
      });
    }
  }

  const ejemplar = db
    .prepare(`SELECT * FROM ejemplares WHERE libro_id = ? AND estado = 'disponible' LIMIT 1`)
    .get(Number(libroId));
  if (!ejemplar) return res.status(409).json({ error: 'No hay ejemplares disponibles de este libro' });

  if (!esFechaValida(fechaPrestamo) || (fechaEstimadaInput && !esFechaValida(fechaEstimadaInput))) {
    return res.status(400).json({ error: 'Formato de fecha inválido (usar AAAA-MM-DD)' });
  }
  const dias = Number.isFinite(diasPrestamo) && diasPrestamo > 0 ? diasPrestamo : req.appConfig.DIAS_PRESTAMO_DEFAULT;
  const fechaEstimada = fechaEstimadaInput || sumarDias(fechaPrestamo, dias);

  const codigo = generarCodigo();
  const info = db
    .prepare(
      `INSERT INTO prestamos (codigo, ejemplar_id, socio_id, encargado_id, fecha_prestamo, fecha_estimada_devolucion, estado, modalidad)
       VALUES (?, ?, ?, ?, ?, ?, 'activo', ?)`
    )
    .run(codigo, ejemplar.id, Number(socioId), req.user.id, fechaPrestamo, fechaEstimada, modalidad);

  db.prepare(`UPDATE ejemplares SET estado = 'prestado' WHERE id = ?`).run(ejemplar.id);

  const prestamo = db.prepare('SELECT * FROM prestamos WHERE id = ?').get(Number(info.lastInsertRowid));
  res.status(201).json(toDictPrestamo(prestamo));
});

router.put('/:id/renovar', requireRoles('ADMIN', 'BIBLIOTECARIO', 'ENCARGADO'), (req, res) => {
  detectarYProcesarAtrasos(req.appConfig);

  const prestamoId = Number(req.params.id);
  const prestamo = db.prepare('SELECT * FROM prestamos WHERE id = ?').get(prestamoId);
  if (!prestamo) return res.status(404).json({ error: 'Recurso no encontrado' });
  if (prestamo.estado !== 'activo') {
    return res.status(400).json({ error: 'Sólo se pueden renovar préstamos activos (no vencidos, devueltos o perdidos)' });
  }

  const diasInput = parseInt((req.body || {}).dias, 10);
  const dias = Number.isFinite(diasInput) && diasInput > 0 ? diasInput : req.appConfig.DIAS_PRESTAMO_DEFAULT;
  const nuevaFecha = sumarDias(prestamo.fecha_estimada_devolucion, dias);
  db.prepare('UPDATE prestamos SET fecha_estimada_devolucion = ? WHERE id = ?').run(nuevaFecha, prestamoId);

  const actualizado = db.prepare('SELECT * FROM prestamos WHERE id = ?').get(prestamoId);
  res.json(toDictPrestamo(actualizado));
});

router.put('/:id/devolver', requireRoles('ADMIN', 'BIBLIOTECARIO', 'ENCARGADO'), (req, res) => {
  const prestamoId = Number(req.params.id);
  const prestamo = db.prepare('SELECT * FROM prestamos WHERE id = ?').get(prestamoId);
  if (!prestamo) return res.status(404).json({ error: 'Recurso no encontrado' });
  if (prestamo.estado === 'devuelto') {
    return res.status(400).json({ error: 'Este préstamo ya fue devuelto' });
  }

  const data = req.body || {};
  const estadoLibro = data.estado_libro_devuelto || 'buen_estado';
  const observaciones = data.observaciones || null;
  const hoy = hoyISO();

  const ejemplar = db.prepare('SELECT * FROM ejemplares WHERE id = ?').get(prestamo.ejemplar_id);

  if (estadoLibro === 'perdida') {
    db.prepare(
      `UPDATE prestamos SET fecha_real_devolucion = ?, estado_libro_devuelto = ?, observaciones = ?,
        encargado_recepcion_id = ?, estado = 'perdido' WHERE id = ?`
    ).run(hoy, estadoLibro, observaciones, req.user.id, prestamoId);

    if (ejemplar) db.prepare(`UPDATE ejemplares SET estado = 'perdido' WHERE id = ?`).run(ejemplar.id);

    const libro = ejemplar ? db.prepare('SELECT * FROM libros WHERE id = ?').get(ejemplar.libro_id) : null;
    const costo = libro && libro.precio_reposicion ? libro.precio_reposicion : req.appConfig.COSTO_REPOSICION_DEFAULT;

    db.prepare(
      `INSERT INTO sanciones (prestamo_id, socio_id, tipo, monto_reposicion, estado_pago)
       VALUES (?, ?, 'perdida', ?, 'pendiente')`
    ).run(prestamoId, prestamo.socio_id, costo);
  } else {
    db.prepare(
      `UPDATE prestamos SET fecha_real_devolucion = ?, estado_libro_devuelto = ?, observaciones = ?,
        encargado_recepcion_id = ?, estado = 'devuelto' WHERE id = ?`
    ).run(hoy, estadoLibro, observaciones, req.user.id, prestamoId);

    if (ejemplar) {
      const nuevoEstado = ['dano_menor', 'dano_mayor'].includes(estadoLibro) ? 'dañado' : 'disponible';
      db.prepare('UPDATE ejemplares SET estado = ? WHERE id = ?').run(nuevoEstado, ejemplar.id);
    }
  }

  actualizarEstadoPlanSocio(prestamo.socio_id);
  const actualizado = db.prepare('SELECT * FROM prestamos WHERE id = ?').get(prestamoId);
  res.json(toDictPrestamo(actualizado));
});

router.put('/:id/reabrir', requireRoles('ADMIN', 'BIBLIOTECARIO'), (req, res) => {
  const prestamoId = Number(req.params.id);
  const prestamo = db.prepare('SELECT * FROM prestamos WHERE id = ?').get(prestamoId);
  if (!prestamo) return res.status(404).json({ error: 'Recurso no encontrado' });
  if (!['devuelto', 'perdido'].includes(prestamo.estado)) {
    return res.status(400).json({ error: 'Sólo se puede reabrir un préstamo devuelto o marcado como perdido' });
  }

  const ejemplar = db.prepare('SELECT * FROM ejemplares WHERE id = ?').get(prestamo.ejemplar_id);
  if (ejemplar) db.prepare(`UPDATE ejemplares SET estado = 'prestado' WHERE id = ?`).run(ejemplar.id);

  const nuevoEstado = prestamo.fecha_estimada_devolucion >= hoyISO() ? 'activo' : 'atrasado';
  db.prepare(
    `UPDATE prestamos SET estado = ?, fecha_real_devolucion = NULL, estado_libro_devuelto = NULL WHERE id = ?`
  ).run(nuevoEstado, prestamoId);

  db.prepare(`DELETE FROM sanciones WHERE prestamo_id = ? AND tipo = 'perdida'`).run(prestamoId);

  actualizarEstadoPlanSocio(prestamo.socio_id);
  const actualizado = db.prepare('SELECT * FROM prestamos WHERE id = ?').get(prestamoId);
  res.json(toDictPrestamo(actualizado));
});

router.delete('/:id', requireRoles('ADMIN'), (req, res) => {
  const prestamoId = Number(req.params.id);
  const prestamo = db.prepare('SELECT * FROM prestamos WHERE id = ?').get(prestamoId);
  if (!prestamo) return res.status(404).json({ error: 'Recurso no encontrado' });

  const ejemplar = db.prepare('SELECT * FROM ejemplares WHERE id = ?').get(prestamo.ejemplar_id);
  if (ejemplar && ejemplar.estado === 'prestado') {
    db.prepare(`UPDATE ejemplares SET estado = 'disponible' WHERE id = ?`).run(ejemplar.id);
  }

  db.prepare('DELETE FROM sanciones WHERE prestamo_id = ?').run(prestamoId);
  db.prepare('DELETE FROM prestamos WHERE id = ?').run(prestamoId);
  res.json({ mensaje: 'Préstamo eliminado' });
});

module.exports = { router, toDictPrestamo };
