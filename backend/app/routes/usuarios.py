from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models.usuario import Usuario, ROLES, TURNOS
from ..utils.decorators import roles_required

usuarios_bp = Blueprint('usuarios', __name__)


@usuarios_bp.route('', methods=['GET'])
@roles_required('ADMIN')
def listar_usuarios():
    usuarios = Usuario.query.order_by(Usuario.nombre_completo).all()
    return jsonify([u.to_dict() for u in usuarios])


@usuarios_bp.route('', methods=['POST'])
@roles_required('ADMIN')
def crear_usuario():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    nombre = (data.get('nombre_completo') or '').strip()
    rol = data.get('rol')
    turno = data.get('turno')

    if not username or not password or not nombre:
        return jsonify({'error': 'Usuario, contraseña y nombre completo son obligatorios'}), 400
    if rol not in ROLES:
        return jsonify({'error': f'Rol inválido. Debe ser uno de: {", ".join(ROLES)}'}), 400
    if turno not in TURNOS:
        return jsonify({'error': f'Turno inválido. Debe ser uno de: {", ".join(TURNOS)}'}), 400
    if Usuario.query.filter_by(username=username).first():
        return jsonify({'error': 'Ese nombre de usuario ya existe'}), 409

    usuario = Usuario(username=username, nombre_completo=nombre, rol=rol, turno=turno, estado='activo')
    usuario.set_password(password)
    db.session.add(usuario)
    db.session.commit()
    return jsonify(usuario.to_dict()), 201


@usuarios_bp.route('/<int:usuario_id>/estado', methods=['PUT'])
@roles_required('ADMIN')
def cambiar_estado_usuario(usuario_id):
    usuario = Usuario.query.get_or_404(usuario_id)
    data = request.get_json(silent=True) or {}
    estado = data.get('estado')

    if estado not in ('activo', 'inactivo'):
        return jsonify({'error': "El estado debe ser 'activo' o 'inactivo'"}), 400

    usuario.estado = estado
    db.session.commit()
    return jsonify(usuario.to_dict())


@usuarios_bp.route('/<int:usuario_id>', methods=['PUT'])
@roles_required('ADMIN')
def actualizar_usuario(usuario_id):
    usuario = Usuario.query.get_or_404(usuario_id)
    data = request.get_json(silent=True) or {}

    if 'nombre_completo' in data:
        usuario.nombre_completo = data['nombre_completo']
    if 'rol' in data and data['rol'] in ROLES:
        usuario.rol = data['rol']
    if 'turno' in data and data['turno'] in TURNOS:
        usuario.turno = data['turno']
    if data.get('password'):
        usuario.set_password(data['password'])

    db.session.commit()
    return jsonify(usuario.to_dict())
