from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

from ..models.usuario import Usuario

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    if not username or not password:
        return jsonify({'error': 'Usuario y contraseña son obligatorios'}), 400

    usuario = Usuario.query.filter_by(username=username).first()
    if not usuario or not usuario.check_password(password):
        return jsonify({'error': 'Usuario o contraseña incorrectos'}), 401

    if usuario.estado != 'activo':
        return jsonify({'error': 'Este usuario está inactivo. Contactá al administrador.'}), 403

    token = create_access_token(
        identity=str(usuario.id),
        additional_claims={
            'rol': usuario.rol,
            'turno': usuario.turno,
            'nombre': usuario.nombre_completo,
        },
    )
    return jsonify({'token': token, 'usuario': usuario.to_dict()})


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    usuario_id = get_jwt_identity()
    usuario = Usuario.query.get(usuario_id)
    if not usuario:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    return jsonify(usuario.to_dict())
