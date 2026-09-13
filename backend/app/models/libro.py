from datetime import datetime

from ..extensions import db

ESTADOS_EJEMPLAR = ('disponible', 'prestado', 'dañado', 'perdido')


class Libro(db.Model):
    """Ficha catalográfica del libro (Módulo 1 y 4)."""
    __tablename__ = 'libros'

    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(200), nullable=False, index=True)
    autor = db.Column(db.String(150), nullable=False, index=True)
    editorial = db.Column(db.String(120))
    edicion = db.Column(db.String(50))
    anio_publicacion = db.Column(db.Integer)
    genero = db.Column(db.String(80), index=True)
    categoria = db.Column(db.String(80), index=True)  # área: Lengua, Historia, Ciencias, etc.
    isbn = db.Column(db.String(30))
    ubicacion_fisica = db.Column(db.String(80))
    precio_reposicion = db.Column(db.Float)
    creado_en = db.Column(db.DateTime, default=datetime.utcnow)

    ejemplares = db.relationship(
        'Ejemplar', backref='libro', cascade='all, delete-orphan', lazy='joined'
    )

    def to_dict(self, incluir_ejemplares=True):
        data = {
            'id': self.id,
            'titulo': self.titulo,
            'autor': self.autor,
            'editorial': self.editorial,
            'edicion': self.edicion,
            'anio_publicacion': self.anio_publicacion,
            'genero': self.genero,
            'categoria': self.categoria,
            'isbn': self.isbn,
            'ubicacion_fisica': self.ubicacion_fisica,
            'precio_reposicion': self.precio_reposicion,
            'cantidad_ejemplares': len(self.ejemplares),
            'ejemplares_disponibles': sum(1 for e in self.ejemplares if e.estado == 'disponible'),
        }
        if incluir_ejemplares:
            data['ejemplares'] = [e.to_dict() for e in self.ejemplares]
        return data

    def __repr__(self):
        return f'<Libro {self.titulo!r}>'


class Ejemplar(db.Model):
    """Copia física individual de un libro, con su propio estado y ubicación
    (Módulo 1: 'Marcar libros como dañados, perdidos o disponibles')."""
    __tablename__ = 'ejemplares'

    id = db.Column(db.Integer, primary_key=True)
    libro_id = db.Column(db.Integer, db.ForeignKey('libros.id'), nullable=False)
    numero_ejemplar = db.Column(db.Integer, nullable=False)
    estado = db.Column(db.String(20), nullable=False, default='disponible')

    def to_dict(self):
        return {
            'id': self.id,
            'libro_id': self.libro_id,
            'numero_ejemplar': self.numero_ejemplar,
            'estado': self.estado,
        }

    def __repr__(self):
        return f'<Ejemplar {self.libro_id}/{self.numero_ejemplar} ({self.estado})>'
