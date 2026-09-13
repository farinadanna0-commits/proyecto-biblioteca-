from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from ..extensions import db
from ..models.libro import Libro, Ejemplar, ESTADOS_EJEMPLAR
from ..utils.decorators import roles_required

libros_bp = Blueprint('libros', __name__)


@libros_bp.route('', methods=['GET'])
@jwt_required()
def listar_libros():
    """Módulo 4: búsqueda y catálogo con filtros por título, autor, género,
    categoría/área e ISBN, con disponibilidad inmediata."""
    query = Libro.query

    titulo = request.args.get('titulo')
    autor = request.args.get('autor')
    genero = request.args.get('genero')
    categoria = request.args.get('categoria')
    isbn = request.args.get('isbn')

    if titulo:
        query = query.filter(Libro.titulo.ilike(f'%{titulo}%'))
    if autor:
        query = query.filter(Libro.autor.ilike(f'%{autor}%'))
    if genero:
        query = query.filter(Libro.genero.ilike(f'%{genero}%'))
    if categoria:
        query = query.filter(Libro.categoria.ilike(f'%{categoria}%'))
    if isbn:
        query = query.filter(Libro.isbn.ilike(f'%{isbn}%'))

    libros = query.order_by(Libro.titulo).all()
    resultado = [l.to_dict() for l in libros]

    if request.args.get('disponible') == 'true':
        resultado = [l for l in resultado if l['ejemplares_disponibles'] > 0]

    return jsonify(resultado)


@libros_bp.route('/<int:libro_id>', methods=['GET'])
@jwt_required()
def obtener_libro(libro_id):
    libro = Libro.query.get_or_404(libro_id)
    return jsonify(libro.to_dict())


@libros_bp.route('', methods=['POST'])
@roles_required('ADMIN', 'BIBLIOTECARIO')
def crear_libro():
    """Módulo 1: alta de un libro nuevo en el catálogo, generando automáticamente
    sus ejemplares físicos."""
    data = request.get_json(silent=True) or {}
    titulo = (data.get('titulo') or '').strip()
    autor = (data.get('autor') or '').strip()

    if not titulo:
        return jsonify({'error': 'El título es obligatorio'}), 400

    try:
        cantidad = int(data.get('cantidad_ejemplares') or 1)
    except (TypeError, ValueError):
        cantidad = 1
    cantidad = max(cantidad, 1)

    libro = Libro(
        titulo=titulo,
        autor=autor or 'Desconocido',
        editorial=data.get('editorial'),
        edicion=data.get('edicion'),
        anio_publicacion=data.get('anio_publicacion') or None,
        genero=data.get('genero'),
        categoria=data.get('categoria'),
        isbn=data.get('isbn'),
        ubicacion_fisica=data.get('ubicacion_fisica'),
        precio_reposicion=data.get('precio_reposicion') or None,
    )
    db.session.add(libro)
    db.session.flush()  # asigna libro.id sin cerrar la transacción

    for n in range(1, cantidad + 1):
        db.session.add(Ejemplar(libro_id=libro.id, numero_ejemplar=n, estado='disponible'))

    db.session.commit()
    return jsonify(libro.to_dict()), 201


@libros_bp.route('/<int:libro_id>', methods=['PUT'])
@roles_required('ADMIN', 'BIBLIOTECARIO')
def actualizar_libro(libro_id):
    """Módulo 1: modificar la información del libro."""
    libro = Libro.query.get_or_404(libro_id)
    data = request.get_json(silent=True) or {}

    campos = [
        'titulo', 'autor', 'editorial', 'edicion', 'anio_publicacion',
        'genero', 'categoria', 'isbn', 'ubicacion_fisica', 'precio_reposicion',
    ]
    for campo in campos:
        if campo in data:
            setattr(libro, campo, data[campo])

    db.session.commit()
    return jsonify(libro.to_dict())


@libros_bp.route('/<int:libro_id>', methods=['DELETE'])
@roles_required('ADMIN')
def eliminar_libro(libro_id):
    libro = Libro.query.get_or_404(libro_id)
    db.session.delete(libro)
    db.session.commit()
    return jsonify({'mensaje': 'Libro eliminado del catálogo'})


@libros_bp.route('/<int:libro_id>/ejemplares', methods=['POST'])
@roles_required('ADMIN', 'BIBLIOTECARIO')
def agregar_ejemplares(libro_id):
    """Amplía la cantidad de ejemplares de un libro ya existente."""
    libro = Libro.query.get_or_404(libro_id)
    data = request.get_json(silent=True) or {}
    try:
        cantidad = int(data.get('cantidad') or 1)
    except (TypeError, ValueError):
        cantidad = 1
    cantidad = max(cantidad, 1)

    ultimo = max([e.numero_ejemplar for e in libro.ejemplares], default=0)
    for i in range(1, cantidad + 1):
        db.session.add(Ejemplar(libro_id=libro.id, numero_ejemplar=ultimo + i, estado='disponible'))

    db.session.commit()
    return jsonify(libro.to_dict()), 201


@libros_bp.route('/ejemplares/<int:ejemplar_id>/estado', methods=['PUT'])
@roles_required('ADMIN', 'BIBLIOTECARIO', 'ENCARGADO')
def cambiar_estado_ejemplar(ejemplar_id):
    """Módulo 1: marcar un ejemplar como disponible, dañado o perdido."""
    ejemplar = Ejemplar.query.get_or_404(ejemplar_id)
    data = request.get_json(silent=True) or {}
    estado = data.get('estado')

    if estado not in ESTADOS_EJEMPLAR:
        return jsonify({'error': f'Estado inválido. Debe ser uno de: {", ".join(ESTADOS_EJEMPLAR)}'}), 400
    if ejemplar.estado == 'prestado' and estado == 'disponible':
        return jsonify({'error': 'No se puede marcar disponible un ejemplar que está prestado'}), 400

    ejemplar.estado = estado
    db.session.commit()
    return jsonify(ejemplar.to_dict())
