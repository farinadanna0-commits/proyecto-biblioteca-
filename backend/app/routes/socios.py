from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from ..extensions import db
from ..models.socio import Socio, ESTADOS_PLAN
from ..utils.decorators import roles_required

socios_bp = Blueprint('socios', __name__)


@socios_bp.route('', methods=['GET'])
@jwt_required()
def listar_socios():
    query = Socio.query

    nombre = request.args.get('nombre')
    dni = request.args.get('dni')
    tipo = request.args.get('tipo')
    estado_plan = request.args.get('estado_plan')
    es_socio = request.args.get('es_socio')

    if nombre:
        query = query.filter(Socio.nombre_completo.ilike(f'%{nombre}%'))
    if dni:
        query = query.filter(Socio.dni.ilike(f'%{dni}%'))
    if tipo:
        query = query.filter(Socio.tipo == tipo)
    if estado_plan:
        query = query.filter(Socio.estado_plan == estado_plan)
    if es_socio is not None:
        query = query.filter(Socio.es_socio == (es_socio.strip().lower() not in ('0', 'false', 'no', '')))

    socios = query.order_by(Socio.nombre_completo).all()
    return jsonify([s.to_dict() for s in socios])


@socios_bp.route('/<int:socio_id>', methods=['GET'])
@jwt_required()
def obtener_socio(socio_id):
    socio = Socio.query.get_or_404(socio_id)
    return jsonify(socio.to_dict())


@socios_bp.route('', methods=['POST'])
@roles_required('ADMIN', 'BIBLIOTECARIO')
def crear_socio():
    data = request.get_json(silent=True) or {}
    nombre = (data.get('nombre_completo') or '').strip()
    dni = (data.get('dni') or '').strip()

    if not nombre or not dni:
        return jsonify({'error': 'Nombre completo y DNI son obligatorios'}), 400

    if Socio.query.filter_by(dni=dni).first():
        return jsonify({'error': 'Ya existe una persona registrada con ese DNI'}), 409

    es_socio = data.get('es_socio', True)
    if isinstance(es_socio, str):
        es_socio = es_socio.strip().lower() not in ('0', 'false', 'no', '')

    socio = Socio(
        tipo=data.get('tipo') or 'alumno',
        nombre_completo=nombre,
        dni=dni,
        telefono=data.get('telefono'),
        email=data.get('email'),
        curso=data.get('curso'),
        division=data.get('division'),
        materia=data.get('materia'),
        estado_plan='al_dia',
        es_socio=bool(es_socio),
    )
    db.session.add(socio)
    db.session.commit()
    return jsonify(socio.to_dict()), 201


@socios_bp.route('/<int:socio_id>', methods=['PUT'])
@roles_required('ADMIN', 'BIBLIOTECARIO')
def actualizar_socio(socio_id):
    socio = Socio.query.get_or_404(socio_id)
    data = request.get_json(silent=True) or {}

    campos = ['tipo', 'nombre_completo', 'telefono', 'email', 'curso', 'division', 'materia']
    for campo in campos:
        if campo in data:
            setattr(socio, campo, data[campo])

    if 'estado_plan' in data and data['estado_plan'] in ESTADOS_PLAN:
        socio.estado_plan = data['estado_plan']

    if 'es_socio' in data:
        valor = data['es_socio']
        if isinstance(valor, str):
            valor = valor.strip().lower() not in ('0', 'false', 'no', '')
        socio.es_socio = bool(valor)

    db.session.commit()
    return jsonify(socio.to_dict())


@socios_bp.route('/<int:socio_id>', methods=['DELETE'])
@roles_required('ADMIN')
def eliminar_socio(socio_id):
    socio = Socio.query.get_or_404(socio_id)
    db.session.delete(socio)
    db.session.commit()
    return jsonify({'mensaje': 'Socio eliminado'})
