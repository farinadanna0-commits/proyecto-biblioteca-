import uuid
from datetime import datetime

from ..extensions import db

ESTADOS_PRESTAMO = ('activo', 'devuelto', 'atrasado', 'perdido')
ESTADOS_DEVOLUCION = ('buen_estado', 'dano_menor', 'dano_mayor', 'perdida')


def generar_codigo():
    return f"PR-{uuid.uuid4().hex[:8].upper()}"


class Prestamo(db.Model):
    __tablename__ = 'prestamos'

    id = db.Column(db.Integer, primary_key=True)
    codigo = db.Column(db.String(20), unique=True, nullable=False, default=generar_codigo)

    ejemplar_id = db.Column(db.Integer, db.ForeignKey('ejemplares.id'), nullable=False)
    socio_id = db.Column(db.Integer, db.ForeignKey('socios.id'), nullable=False)
    encargado_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=True)
    encargado_recepcion_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'), nullable=True)

    fecha_prestamo = db.Column(db.Date, nullable=False)
    fecha_estimada_devolucion = db.Column(db.Date, nullable=False)
    fecha_real_devolucion = db.Column(db.Date, nullable=True)

    estado = db.Column(db.String(20), nullable=False, default='activo')
    estado_libro_devuelto = db.Column(db.String(20), nullable=True)
    observaciones = db.Column(db.Text)

    creado_en = db.Column(db.DateTime, default=datetime.utcnow)

    ejemplar = db.relationship('Ejemplar')
    socio = db.relationship('Socio', backref=db.backref('prestamos', lazy='dynamic'))

    def to_dict(self):
        libro = self.ejemplar.libro if self.ejemplar else None
        return {
            'id': self.id,
            'codigo': self.codigo,
            'ejemplar_id': self.ejemplar_id,
            'libro_id': libro.id if libro else None,
            'libro_titulo': libro.titulo if libro else None,
            'libro_autor': libro.autor if libro else None,
            'numero_ejemplar': self.ejemplar.numero_ejemplar if self.ejemplar else None,
            'socio_id': self.socio_id,
            'socio_nombre': self.socio.nombre_completo if self.socio else None,
            'socio_dni': self.socio.dni if self.socio else None,
            'encargado_id': self.encargado_id,
            'encargado_recepcion_id': self.encargado_recepcion_id,
            'fecha_prestamo': self.fecha_prestamo.isoformat() if self.fecha_prestamo else None,
            'fecha_estimada_devolucion': (
                self.fecha_estimada_devolucion.isoformat() if self.fecha_estimada_devolucion else None
            ),
            'fecha_real_devolucion': (
                self.fecha_real_devolucion.isoformat() if self.fecha_real_devolucion else None
            ),
            'estado': self.estado,
            'estado_libro_devuelto': self.estado_libro_devuelto,
            'observaciones': self.observaciones,
        }

    def __repr__(self):
        return f'<Prestamo {self.codigo} ({self.estado})>'
