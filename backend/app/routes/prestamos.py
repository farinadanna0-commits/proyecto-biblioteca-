from datetime import date, timedelta

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..extensions import db
from ..models.prestamo import Prestamo
from ..models.libro import Ejemplar
from ..models.socio import Socio
from ..models.sancion import Sancion
from ..utils.decorators import roles_required
from ..services.prestamo_service import detectar_y_procesar_atrasos, actualizar_estado_plan_socio

prestamos_bp = Blueprint('prestamos', __name__)


@prestamos_bp.route('', methods=['GET'])
@jwt_required()
def listar_prestamos():
    detectar_y_procesar_atrasos(current_app.config)

    query = Prestamo.query
    estado = request.args.get('estado')
    socio_id = request.args.get('socio_id')

    if estado:
        query = query.filter(Prestamo.estado == estado)
    if socio_id:
        query = query.filter(Prestamo.socio_id == socio_id)

    prestamos = query.order_by(Prestamo.fecha_prestamo.desc()).all()
    return jsonify([p.to_dict() for p in prestamos])


@prestamos_bp.route('', methods=['POST'])
@roles_required('ADMIN', 'BIBLIOTECARIO', 'ENCARGADO')
def crear_prestamo():
    """Módulo 3: solicitud de préstamo. Verifica disponibilidad de ejemplares
    y que el socio esté al día antes de registrar el préstamo."""
    detectar_y_procesar_atrasos(current_app.config)

    data = request.get_json(silent=True) or {}
    libro_id = data.get('libro_id')
    socio_id = data.get('socio_id')
    fecha_prestamo = data.get('fecha_prestamo') or date.today().isoformat()
    fecha_estimada = data.get('fecha_estimada_devolucion')

    if not libro_id or not socio_id:
        return jsonify({'error': 'Libro y socio son obligatorios'}), 400

    socio = Socio.query.get(socio_id)
    if not socio:
        return jsonify({'error': 'Socio no encontrado'}), 404
    if socio.estado_plan != 'al_dia':
        return jsonify({
            'error': f'El socio no puede solicitar préstamos: estado del plan "{socio.estado_plan}"'
        }), 403

    ejemplar = Ejemplar.query.filter_by(libro_id=libro_id, estado='disponible').first()
    if not ejemplar:
        return jsonify({'error': 'No hay ejemplares disponibles de este libro'}), 409

    try:
        fecha_prestamo_d = date.fromisoformat(fecha_prestamo)
        fecha_estimada_d = (
            date.fromisoformat(fecha_estimada) if fecha_estimada
            else fecha_prestamo_d + timedelta(days=current_app.config['DIAS_PRESTAMO_DEFAULT'])
        )
    except ValueError:
        return jsonify({'error': 'Formato de fecha inválido (usar AAAA-MM-DD)'}), 400

    usuario_id = get_jwt_identity()
    prestamo = Prestamo(
        ejemplar_id=ejemplar.id,
        socio_id=socio_id,
        encargado_id=usuario_id,
        fecha_prestamo=fecha_prestamo_d,
        fecha_estimada_devolucion=fecha_estimada_d,
        estado='activo',
    )
    ejemplar.estado = 'prestado'

    db.session.add(prestamo)
    db.session.commit()
    return jsonify(prestamo.to_dict()), 201


@prestamos_bp.route('/<int:prestamo_id>/devolver', methods=['PUT'])
@roles_required('ADMIN', 'BIBLIOTECARIO', 'ENCARGADO')
def devolver_prestamo(prestamo_id):
    """Módulo 3: registra la devolución, calcula atraso y actualiza el
    ejemplar según el estado físico en que fue devuelto el libro. Si se
    reporta como perdido, genera la sanción de reposición (Módulo 5)."""
    prestamo = Prestamo.query.get_or_404(prestamo_id)
    if prestamo.estado == 'devuelto':
        return jsonify({'error': 'Este préstamo ya fue devuelto'}), 400

    data = request.get_json(silent=True) or {}
    estado_libro = data.get('estado_libro_devuelto') or 'buen_estado'
    observaciones = data.get('observaciones')

    usuario_id = get_jwt_identity()
    prestamo.fecha_real_devolucion = date.today()
    prestamo.estado_libro_devuelto = estado_libro
    prestamo.observaciones = observaciones
    prestamo.encargado_recepcion_id = usuario_id

    ejemplar = Ejemplar.query.get(prestamo.ejemplar_id)

    if estado_libro == 'perdida':
        prestamo.estado = 'perdido'
        if ejemplar:
            ejemplar.estado = 'perdido'
        libro = ejemplar.libro if ejemplar else None
        costo = (
            libro.precio_reposicion if libro and libro.precio_reposicion
            else current_app.config['COSTO_REPOSICION_DEFAULT']
        )
        db.session.add(Sancion(
            prestamo_id=prestamo.id,
            socio_id=prestamo.socio_id,
            tipo='perdida',
            monto_reposicion=costo,
            estado_pago='pendiente',
        ))
    else:
        prestamo.estado = 'devuelto'
        if ejemplar:
            ejemplar.estado = 'dañado' if estado_libro in ('dano_menor', 'dano_mayor') else 'disponible'

    db.session.commit()
    actualizar_estado_plan_socio(prestamo.socio_id)
    return jsonify(prestamo.to_dict())


@prestamos_bp.route('/<int:prestamo_id>/reabrir', methods=['PUT'])
@roles_required('ADMIN', 'BIBLIOTECARIO')
def reabrir_prestamo(prestamo_id):
    """Deshace una devolución cargada por error."""
    prestamo = Prestamo.query.get_or_404(prestamo_id)
    if prestamo.estado not in ('devuelto', 'perdido'):
        return jsonify({'error': 'Sólo se puede reabrir un préstamo devuelto o marcado como perdido'}), 400

    ejemplar = Ejemplar.query.get(prestamo.ejemplar_id)
    if ejemplar:
        ejemplar.estado = 'prestado'

    prestamo.estado = 'activo' if prestamo.fecha_estimada_devolucion >= date.today() else 'atrasado'
    prestamo.fecha_real_devolucion = None
    prestamo.estado_libro_devuelto = None

    Sancion.query.filter_by(prestamo_id=prestamo.id, tipo='perdida').delete()

    db.session.commit()
    actualizar_estado_plan_socio(prestamo.socio_id)
    return jsonify(prestamo.to_dict())


@prestamos_bp.route('/<int:prestamo_id>', methods=['DELETE'])
@roles_required('ADMIN')
def eliminar_prestamo(prestamo_id):
    """Elimina un registro de préstamo cargado por error, liberando el
    ejemplar asociado."""
    prestamo = Prestamo.query.get_or_404(prestamo_id)
    ejemplar = Ejemplar.query.get(prestamo.ejemplar_id)
    if ejemplar and ejemplar.estado == 'prestado':
        ejemplar.estado = 'disponible'

    Sancion.query.filter_by(prestamo_id=prestamo.id).delete()
    db.session.delete(prestamo)
    db.session.commit()
    return jsonify({'mensaje': 'Préstamo eliminado'})
