const db = require('../db');

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function diasEntre(desdeISO, hastaISO) {
  const desde = new Date(desdeISO + 'T00:00:00Z');
  const hasta = new Date(hastaISO + 'T00:00:00Z');
  return Math.round((hasta - desde) / (1000 * 60 * 60 * 24));
}

/**
 * Recorre los préstamos activos vencidos, los marca como 'atrasado',
 * genera (o actualiza) la sanción por atraso correspondiente y suspende
 * el plan del socio si todavía está 'al_dia'. Se llama al principio de
 * los endpoints de lectura/escritura de préstamos, sanciones y dashboard
 * para que la detección sea siempre automática, sin depender de un cron.
 */
function detectarYProcesarAtrasos(config) {
  const hoy = hoyISO();
  const activosVencidos = db
    .prepare(
      `SELECT * FROM prestamos WHERE estado = 'activo' AND fecha_estimada_devolucion < ?`
    )
    .all(hoy);

  for (const prestamo of activosVencidos) {
    db.prepare(`UPDATE prestamos SET estado = 'atrasado' WHERE id = ?`).run(prestamo.id);
    const dias = diasEntre(prestamo.fecha_estimada_devolucion, hoy);
    const monto = dias * config.MULTA_POR_DIA_ATRASO;

    const sancion = db
      .prepare(`SELECT * FROM sanciones WHERE prestamo_id = ? AND tipo = 'atraso'`)
      .get(prestamo.id);

    if (sancion) {
      if (sancion.estado_pago === 'pendiente') {
        db.prepare(`UPDATE sanciones SET dias_atraso = ?, monto_multa = ? WHERE id = ?`).run(
          dias,
          monto,
          sancion.id
        );
      } else {
        db.prepare(`UPDATE sanciones SET dias_atraso = ? WHERE id = ?`).run(dias, sancion.id);
      }
    } else {
      db.prepare(
        `INSERT INTO sanciones (prestamo_id, socio_id, tipo, dias_atraso, monto_multa, estado_pago)
         VALUES (?, ?, 'atraso', ?, ?, 'pendiente')`
      ).run(prestamo.id, prestamo.socio_id, dias, monto);
    }

    const socio = db.prepare(`SELECT * FROM socios WHERE id = ?`).get(prestamo.socio_id);
    if (socio && socio.estado_plan === 'al_dia') {
      db.prepare(`UPDATE socios SET estado_plan = 'suspendido' WHERE id = ?`).run(socio.id);
    }
  }

  return activosVencidos.length;
}

/**
 * Recalcula el estado del plan de un socio en base a sus sanciones
 * pendientes. Un socio 'bloqueado' manualmente no se reactiva solo.
 */
function actualizarEstadoPlanSocio(socioId) {
  const socio = db.prepare(`SELECT * FROM socios WHERE id = ?`).get(socioId);
  if (!socio || socio.estado_plan === 'bloqueado') return;

  const { total } = db
    .prepare(`SELECT COUNT(*) AS total FROM sanciones WHERE socio_id = ? AND estado_pago = 'pendiente'`)
    .get(socioId);

  const nuevoEstado = total === 0 ? 'al_dia' : 'suspendido';
  db.prepare(`UPDATE socios SET estado_plan = ? WHERE id = ?`).run(nuevoEstado, socioId);
}

module.exports = { detectarYProcesarAtrasos, actualizarEstadoPlanSocio, hoyISO };
