from datetime import datetime

from ..extensions import db

TIPOS_SOCIO = ('alumno', 'maestro')
ESTADOS_PLAN = ('al_dia', 'suspendido', 'bloqueado')


class Socio(db.Model):
    __tablename__ = 'socios'

    id = db.Column(db.Integer, primary_key=True)
    tipo = db.Column(db.String(20), nullable=False, default='alumno')
    nombre_completo = db.Column(db.String(150), nullable=False, index=True)
    dni = db.Column(db.String(20), unique=True, nullable=False, index=True)
    telefono = db.Column(db.String(30))
    email = db.Column(db.String(120))
    curso = db.Column(db.String(50))       # si es alumno
    division = db.Column(db.String(20))    # si es alumno
    materia = db.Column(db.String(80))     # si es maestro
    estado_plan = db.Column(db.String(20), nullable=False, default='al_dia')
    creado_en = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'tipo': self.tipo,
            'nombre_completo': self.nombre_completo,
            'dni': self.dni,
            'telefono': self.telefono,
            'email': self.email,
            'curso': self.curso,
            'division': self.division,
            'materia': self.materia,
            'estado_plan': self.estado_plan,
        }

    def __repr__(self):
        return f'<Socio {self.nombre_completo!r} ({self.estado_plan})>'
