from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

from ..extensions import db

# Roles definidos para el equipo (Módulo 7: Usuarios y Permisos)
ROLES = ('ADMIN', 'BIBLIOTECARIO', 'ENCARGADO')
TURNOS = ('MAÑANA', 'TARDE', 'CESPA')
ESTADOS_USUARIO = ('activo', 'inactivo')


class Usuario(db.Model):
    __tablename__ = 'usuarios'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    nombre_completo = db.Column(db.String(150), nullable=False)
    rol = db.Column(db.String(20), nullable=False, default='ENCARGADO')
    turno = db.Column(db.String(20), nullable=False, default='MAÑANA')
    estado = db.Column(db.String(20), nullable=False, default='activo')
    creado_en = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'nombre_completo': self.nombre_completo,
            'rol': self.rol,
            'turno': self.turno,
            'estado': self.estado,
            'creado_en': self.creado_en.isoformat() if self.creado_en else None,
        }

    def __repr__(self):
        return f'<Usuario {self.username} ({self.rol})>'
