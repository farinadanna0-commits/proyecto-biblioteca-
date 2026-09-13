from functools import wraps

from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt


def roles_required(*roles_permitidos):
    """Exige un JWT válido y que el rol del usuario esté en roles_permitidos.
    Implementa el Módulo 7 (Usuarios y Permisos): cada endpoint sólo es
    accesible para los roles que realmente deberían usarlo."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            rol = claims.get('rol')
            if rol not in roles_permitidos:
                return jsonify({'error': 'No tenés permisos para realizar esta acción'}), 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator
