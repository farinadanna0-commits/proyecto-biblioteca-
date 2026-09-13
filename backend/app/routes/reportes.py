from datetime import date

from flask import Blueprint, request, jsonify
from sqlalchemy import func

from ..extensions import db
from ..models.prestamo import Prestamo
from ..models.socio import Socio
from ..models.libro import Libro, Ejemplar
from ..models.sancion import Sancion
from ..utils.decorators import roles_required

reportes_bp = Blueprint('reportes', __name__)


def _rango_fechas():
    desde = request.args.get('desde')
    hasta = request.args.get('hasta')
    desde_d = date.fromisoformat(desde) if desde else date(2000, 1, 1)
    hasta_d = date.fromisoformat(hasta) if hasta else date.today()
    return desde_d, hasta_d


@reportes_bp.route('/vencidos', methods=['GET'])
@roles_required('ADMIN', 'BIBLIOTECARIO')
def reporte_vencidos():
    """Préstamos vencidos cuya fecha estimada de devolución cae en el rango dado."""
    desde, hasta = _rango_fechas()
    prestamos = Prestamo.query.filter(
        Prestamo.estado.in_(['atrasado', 'activo']),
        Prestamo.fecha_estimada_devolucion.between(desde, hasta),
        Prestamo.fecha_estimada_devolucion < date.today(),
    ).order_by(Prestamo.fecha_estimada_devolucion).all()
    return jsonify([p.to_dict() for p in prestamos])


@reportes_bp.route('/socios-atrasados', methods=['GET'])
@roles_required('ADMIN', 'BIBLIOTECARIO')
def reporte_socios_atrasados():
    socios = Socio.query.filter(Socio.estado_plan.in_(['suspendido', 'bloqueado'])).all()
    return jsonify([s.to_dict() for s in socios])


@reportes_bp.route('/mas-solicitados', methods=['GET'])
@roles_required('ADMIN', 'BIBLIOTECARIO')
def reporte_mas_solicitados():
    """Ranking de libros más solicitados en el rango de fechas dado."""
    desde, hasta = _rango_fechas()
    resultados = (
        db.session.query(
            Libro.id, Libro.titulo, Libro.autor, func.count(Prestamo.id).label('total')
        )
        .join(Ejemplar, Ejemplar.libro_id == Libro.id)
        .join(Prestamo, Prestamo.ejemplar_id == Ejemplar.id)
        .filter(Prestamo.fecha_prestamo.between(desde, hasta))
        .group_by(Libro.id)
        .order_by(func.count(Prestamo.id).desc())
        .limit(20)
        .all()
    )
    return jsonify([
        {'libro_id': r.id, 'titulo': r.titulo, 'autor': r.autor, 'total_prestamos': r.total}
        for r in resultados
    ])


@reportes_bp.route('/danos-perdidas', methods=['GET'])
@roles_required('ADMIN', 'BIBLIOTECARIO')
def reporte_danos_perdidas():
    desde, hasta = _rango_fechas()
    prestamos = Prestamo.query.filter(
        Prestamo.estado_libro_devuelto.in_(['dano_menor', 'dano_mayor', 'perdida']),
        Prestamo.fecha_real_devolucion.between(desde, hasta),
    ).order_by(Prestamo.fecha_real_devolucion.desc()).all()
    return jsonify([p.to_dict() for p in prestamos])


@reportes_bp.route('/ingresos-multas', methods=['GET'])
@roles_required('ADMIN', 'BIBLIOTECARIO')
def reporte_ingresos_multas():
    desde, hasta = _rango_fechas()
    sanciones = Sancion.query.filter(
        Sancion.estado_pago == 'pagado',
        func.date(Sancion.fecha_pagada).between(desde.isoformat(), hasta.isoformat()),
    ).order_by(Sancion.fecha_pagada.desc()).all()

    total = sum((s.monto_multa or 0) + (s.monto_reposicion or 0) for s in sanciones)
    return jsonify({
        'total_recaudado': total,
        'cantidad_sanciones': len(sanciones),
        'detalle': [s.to_dict() for s in sanciones],
    })
