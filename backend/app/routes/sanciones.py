from datetime import datetime

from flask import Blueprint, request, jsonify, current_app

from ..extensions import db
from ..models.sancion import Sancion
from ..utils.decorators import roles_required
from ..services.prestamo_service import detectar_y_procesar_atrasos, actualizar_estado_plan_socio

sanciones_bp = Blueprint('sanciones', __name__)


@sanciones_bp.route('', methods=['GET'])
@roles_required('ADMIN', 'BIBLIOTECARIO')
def listar_sanciones():
    detectar_y_procesar_atrasos(current_app.config)

    query = Sancion.query
    estado_pago = request.args.get('estado_pago')
    tipo = request.args.get('tipo')

    if estado_pago:
        query = query.filter(Sancion.estado_pago == estado_pago)
    if tipo:
        query = query.filter(Sancion.tipo == tipo)

    sanciones = query.order_by(Sancion.fecha_generada.desc()).all()
    return jsonify([s.to_dict() for s in sanciones])


@sanciones_bp.route('/<int:sancion_id>/pagar', methods=['PUT'])
@roles_required('ADMIN', 'BIBLIOTECARIO')
def pagar_sancion(sancion_id):
    sancion = Sancion.query.get_or_404(sancion_id)
    if sancion.estado_pago == 'pagado':
        return jsonify({'error': 'Esta sanción ya fue pagada'}), 400

    sancion.estado_pago = 'pagado'
    sancion.fecha_pagada = datetime.utcnow()
    db.session.commit()

    actualizar_estado_plan_socio(sancion.socio_id)
    return jsonify(sancion.to_dict())
