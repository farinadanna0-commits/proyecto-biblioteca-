from datetime import datetime

from ..extensions import db

TIPOS_SANCION = ('atraso', 'perdida')
ESTADOS_PAGO = ('pendiente', 'pagado')


class Sancion(db.Model):
    __tablename__ = 'sanciones'

    id = db.Column(db.Integer, primary_key=True)
    prestamo_id = db.Column(db.Integer, db.ForeignKey('prestamos.id'), nullable=False)
    socio_id = db.Column(db.Integer, db.ForeignKey('socios.id'), nullable=False)

    tipo = db.Column(db.String(20), nullable=False)  # 'atraso' | 'perdida'
    dias_atraso = db.Column(db.Integer, default=0)
    monto_multa = db.Column(db.Float, default=0)
    monto_reposicion = db.Column(db.Float, default=0)
    estado_pago = db.Column(db.String(20), nullable=False, default='pendiente')

    fecha_generada = db.Column(db.DateTime, default=datetime.utcnow)
    fecha_pagada = db.Column(db.DateTime, nullable=True)

    prestamo = db.relationship('Prestamo')
    socio = db.relationship('Socio')

    def to_dict(self):
        return {
            'id': self.id,
            'prestamo_id': self.prestamo_id,
            'prestamo_codigo': self.prestamo.codigo if self.prestamo else None,
            'socio_id': self.socio_id,
            'socio_nombre': self.socio.nombre_completo if self.socio else None,
            'tipo': self.tipo,
            'dias_atraso': self.dias_atraso,
            'monto_multa': self.monto_multa,
            'monto_reposicion': self.monto_reposicion,
            'monto_total': (self.monto_multa or 0) + (self.monto_reposicion or 0),
            'estado_pago': self.estado_pago,
            'fecha_generada': self.fecha_generada.isoformat() if self.fecha_generada else None,
            'fecha_pagada': self.fecha_pagada.isoformat() if self.fecha_pagada else None,
        }

    def __repr__(self):
        return f'<Sancion {self.tipo} socio={self.socio_id} ({self.estado_pago})>'
