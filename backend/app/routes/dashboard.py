from flask import Blueprint, jsonify, current_app
from flask_jwt_extended import jwt_required

from ..models.prestamo import Prestamo
from ..models.libro import Libro
from ..models.socio import Socio
from ..services.prestamo_service import detectar_y_procesar_atrasos

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/resumen', methods=['GET'])
@jwt_required()
def resumen():
    """Módulo 9: datos que alimentan el panel principal, incluyendo accesos
    rápidos a notificaciones (préstamos vencidos)."""
    detectar_y_procesar_atrasos(current_app.config)

    activos = Prestamo.query.filter_by(estado='activo').count()
    vencidos = Prestamo.query.filter_by(estado='atrasado').count()
    total_libros = Libro.query.count()
    total_socios = Socio.query.count()

    notificaciones = (
        Prestamo.query.filter(Prestamo.estado == 'atrasado')
        .order_by(Prestamo.fecha_estimada_devolucion)
        .limit(10)
        .all()
    )

    return jsonify({
        'prestamos_activos': activos,
        'prestamos_vencidos': vencidos,
        'total_libros': total_libros,
        'total_socios': total_socios,
        'notificaciones': [p.to_dict() for p in notificaciones],
    })
