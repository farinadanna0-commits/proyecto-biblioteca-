from datetime import date

from ..extensions import db
from ..models.prestamo import Prestamo
from ..models.sancion import Sancion
from ..models.socio import Socio


def detectar_y_procesar_atrasos(app_config):
    """Recorre los préstamos activos vencidos, los marca como 'atrasado',
    genera (o actualiza) la sanción por atraso correspondiente y suspende
    el plan del socio si todavía está 'al_dia'.

    Se llama al principio de los endpoints de lectura/escritura de préstamos
    y sanciones para que la detección sea siempre automática, sin depender
    de un cron externo.
    """
    hoy = date.today()
    activos_vencidos = Prestamo.query.filter(
        Prestamo.estado == 'activo',
        Prestamo.fecha_estimada_devolucion < hoy,
    ).all()

    for prestamo in activos_vencidos:
        prestamo.estado = 'atrasado'
        dias = (hoy - prestamo.fecha_estimada_devolucion).days

        sancion = Sancion.query.filter_by(prestamo_id=prestamo.id, tipo='atraso').first()
        monto = dias * app_config['MULTA_POR_DIA_ATRASO']

        if sancion:
            sancion.dias_atraso = dias
            if sancion.estado_pago == 'pendiente':
                sancion.monto_multa = monto
        else:
            sancion = Sancion(
                prestamo_id=prestamo.id,
                socio_id=prestamo.socio_id,
                tipo='atraso',
                dias_atraso=dias,
                monto_multa=monto,
                estado_pago='pendiente',
            )
            db.session.add(sancion)

        socio = Socio.query.get(prestamo.socio_id)
        if socio and socio.estado_plan == 'al_dia':
            socio.estado_plan = 'suspendido'

    if activos_vencidos:
        db.session.commit()

    return len(activos_vencidos)


def actualizar_estado_plan_socio(socio_id):
    """Recalcula el estado del plan de un socio en base a sus sanciones
    pendientes. Un socio 'bloqueado' manualmente no se reactiva solo."""
    socio = Socio.query.get(socio_id)
    if not socio or socio.estado_plan == 'bloqueado':
        return

    pendientes = Sancion.query.filter_by(socio_id=socio_id, estado_pago='pendiente').count()
    socio.estado_plan = 'al_dia' if pendientes == 0 else 'suspendido'
    db.session.commit()
