const { one, many, run } = require('../db');

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
async function detectarYProcesarAtrasos(config) {
  const hoy = hoyISO();
  const activosVencidos = await many(
    `SELECT * FROM prestamos WHERE estado = 'activo' AND fecha_estimada_devolucion < $1`,
    [hoy]
  );

  for (const prestamo of activosVencidos) {
    await run(`UPDATE prestamos SET estado = 'atrasado' WHERE id = $1`, [prestamo.id]);
    const dias = diasEntre(prestamo.fecha_estimada_devolucion, hoy);
    const monto = dias * config.MULTA_POR_DIA_ATRASO;

    const sancion = await one(
      `SELECT * FROM sanciones WHERE prestamo_id = $1 AND tipo = 'atraso'`,
      [prestamo.id]
    );

    if (sancion) {
      if (sancion.estado_pago === 'pendiente') {
        await run(`UPDATE sanciones SET dias_atraso = $1, monto_multa = $2 WHERE id = $3`, [dias, monto, sancion.id]);
      } else {
        await run(`UPDATE sanciones SET dias_atraso = $1 WHERE id = $2`, [dias, sancion.id]);
      }
    } else {
      await run(
        `INSERT INTO sanciones (prestamo_id, socio_id, tipo, dias_atraso, monto_multa, estado_pago)
         VALUES ($1, $2, 'atraso', $3, $4, 'pendiente')`,
        [prestamo.id, prestamo.socio_id, dias, monto]
      );
    }

    const socio = await one(`SELECT * FROM socios WHERE id = $1`, [prestamo.socio_id]);
    if (socio && socio.estado_plan === 'al_dia') {
      await run(`UPDATE socios SET estado_plan = 'suspendido' WHERE id = $1`, [socio.id]);
    }
  }

  return activosVencidos.length;
}

/**
 * Recalcula el estado del plan de un socio en base a sus sanciones
 * pendientes. Un socio 'bloqueado' manualmente no se reactiva solo.
 */
async function actualizarEstadoPlanSocio(socioId) {
  const socio = await one(`SELECT * FROM socios WHERE id = $1`, [socioId]);
  if (!socio || socio.estado_plan === 'bloqueado') return;

  const { total } = await one(
    `SELECT COUNT(*)::int AS total FROM sanciones WHERE socio_id = $1 AND estado_pago = 'pendiente'`,
    [socioId]
  );

  const nuevoEstado = total === 0 ? 'al_dia' : 'suspendido';
  await run(`UPDATE socios SET estado_plan = $1 WHERE id = $2`, [nuevoEstado, socioId]);
}

module.exports = { detectarYProcesarAtrasos, actualizarEstadoPlanSocio, hoyISO };
