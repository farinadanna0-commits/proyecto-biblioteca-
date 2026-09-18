"""
Carga datos de demostración en la base de datos.

Ejecutar una sola vez, luego de instalar las dependencias:
    python seed.py
"""
from app import create_app
from app.extensions import db
from app.models.usuario import Usuario
from app.models.libro import Libro, Ejemplar
from app.models.socio import Socio

app = create_app()

with app.app_context():
    db.create_all()

    # ---------- Usuarios del equipo (Módulo 7 y 8) ----------
    if not Usuario.query.filter_by(username='Enzo').first():
        admin = Usuario(
            username='Enzo', nombre_completo='Lezcano Enzo Gabriel',
            rol='ADMIN', turno='MAÑANA', estado='activo',
        )
        admin.set_password('enzo123')
        db.session.add(admin)

    if not Usuario.query.filter_by(username='martin').first():
        bibliotecario = Usuario(
            username='martin', nombre_completo='Benítez Martín Esteban',
            rol='BIBLIOTECARIO', turno='TARDE', estado='activo',
        )
        bibliotecario.set_password('martin123')
        db.session.add(bibliotecario)

    if not Usuario.query.filter_by(username='danna').first():
        encargada = Usuario(
            username='danna', nombre_completo='Fariña Danna Maricela',
            rol='ENCARGADO', turno='CESPA', estado='activo',
        )
        encargada.set_password('danna123')
        db.session.add(encargada)

    db.session.commit()

    # ---------- Libros de ejemplo (Módulo 1) ----------
    if Libro.query.count() == 0:
        libro1 = Libro(
            titulo='Cien años de soledad', autor='Gabriel García Márquez',
            editorial='Sudamericana', edicion='1ra', anio_publicacion=1967,
            genero='Realismo Mágico', categoria='Lengua', isbn='978-0307474728',
            ubicacion_fisica='Estante A1', precio_reposicion=8000,
        )
        libro2 = Libro(
            titulo='Rayuela', autor='Julio Cortázar',
            editorial='Sudamericana', edicion='1ra', anio_publicacion=1963,
            genero='Novela', categoria='Lengua', isbn='978-8437604572',
            ubicacion_fisica='Estante A2', precio_reposicion=7500,
        )
        db.session.add_all([libro1, libro2])
        db.session.flush()

        for n in range(1, 4):
            db.session.add(Ejemplar(libro_id=libro1.id, numero_ejemplar=n, estado='disponible'))
        for n in range(1, 3):
            db.session.add(Ejemplar(libro_id=libro2.id, numero_ejemplar=n, estado='disponible'))

        db.session.commit()

    # ---------- Socios de ejemplo (Módulo 2) ----------
    if Socio.query.count() == 0:
        s1 = Socio(
            tipo='maestro', nombre_completo='Carlos Gómez', dni='38901234',
            telefono='555-0192', email='carlos@mail.com', materia='Historia',
            estado_plan='al_dia', es_socio=True,
        )
        s2 = Socio(
            tipo='alumno', nombre_completo='Lucía Fernández', dni='40123456',
            telefono='555-0143', email='lucia@mail.com', curso='4° Año',
            division='A', estado_plan='al_dia', es_socio=True,
        )
        s3 = Socio(
            tipo='alumno', nombre_completo='Tomás Ibarra', dni='41987654',
            telefono='555-0177', email='tomas@mail.com', curso='2° Año',
            division='B', estado_plan='al_dia', es_socio=False,
        )
        db.session.add_all([s1, s2, s3])
        db.session.commit()

    print('Datos de demostración cargados correctamente.')
    print('  ADMIN         -> usuario: Enzo    / contraseña: enzo123')
    print('  BIBLIOTECARIO -> usuario: martin  / contraseña: martin123')
    print('  ENCARGADO     -> usuario: danna   / contraseña: danna123')
