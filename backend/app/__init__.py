import os

from flask import Flask

from .config import Config, INSTANCE_DIR
from .extensions import db, jwt, cors


def create_app(config_class=Config):
    os.makedirs(INSTANCE_DIR, exist_ok=True)

    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(config_class)

    # ---------- Extensiones ----------
    db.init_app(app)
    jwt.init_app(app)
    # CORS habilitado para el frontend estático (Módulo de integración).
    # En producción conviene restringir "origins" al dominio real.
    cors.init_app(app, resources={r"/api/*": {"origins": "*"}})

    # ---------- Modelos (deben importarse antes de create_all) ----------
    from .models import Usuario, Libro, Ejemplar, Socio, Prestamo, Sancion  # noqa: F401

    # ---------- Blueprints: uno por módulo funcional ----------
    from .routes.auth import auth_bp
    from .routes.libros import libros_bp
    from .routes.socios import socios_bp
    from .routes.prestamos import prestamos_bp
    from .routes.sanciones import sanciones_bp
    from .routes.reportes import reportes_bp
    from .routes.usuarios import usuarios_bp
    from .routes.dashboard import dashboard_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')             # Módulo 8
    app.register_blueprint(libros_bp, url_prefix='/api/libros')         # Módulos 1 y 4
    app.register_blueprint(socios_bp, url_prefix='/api/socios')         # Módulo 2
    app.register_blueprint(prestamos_bp, url_prefix='/api/prestamos')   # Módulo 3
    app.register_blueprint(sanciones_bp, url_prefix='/api/sanciones')   # Módulo 5
    app.register_blueprint(reportes_bp, url_prefix='/api/reportes')     # Módulo 6
    app.register_blueprint(usuarios_bp, url_prefix='/api/usuarios')     # Módulo 7
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')   # Módulo 9

    @app.route('/api/health')
    def health():
        return {'status': 'ok'}

    @app.errorhandler(404)
    def not_found(_e):
        return {'error': 'Recurso no encontrado'}, 404

    @app.errorhandler(500)
    def server_error(_e):
        return {'error': 'Error interno del servidor'}, 500

    with app.app_context():
        db.create_all()
        _migrar_columnas_faltantes()

    return app


def _migrar_columnas_faltantes():
    """Mini-migración automática para bases de datos SQLite ya existentes:
    agrega columnas nuevas del modelo (por ejemplo 'es_socio') sin borrar
    los datos cargados previamente. No reemplaza a una herramienta de
    migraciones real, pero alcanza para este proyecto."""
    from sqlalchemy import inspect, text

    inspector = inspect(db.engine)
    if 'socios' not in inspector.get_table_names():
        return
    columnas = {c['name'] for c in inspector.get_columns('socios')}
    if 'es_socio' not in columnas:
        with db.engine.connect() as conn:
            conn.execute(text(
                "ALTER TABLE socios ADD COLUMN es_socio BOOLEAN NOT NULL DEFAULT 1"
            ))
            conn.commit()
