import os
from datetime import timedelta

# Carpeta backend/ (un nivel arriba de app/)
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
INSTANCE_DIR = os.path.join(BASE_DIR, 'instance')


class Config:
    """Configuración de la aplicación. Todos los valores se pueden sobrescribir
    con variables de entorno (ver .env.example)."""

    SECRET_KEY = os.environ.get('SECRET_KEY', 'cambiar-esta-clave-en-produccion')

    # Por defecto usa SQLite (alternativa de desarrollo). Para PostgreSQL, definir
    # DATABASE_URL, por ejemplo:
    # postgresql://usuario:password@localhost:5432/biblioteca_cespa
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL', f"sqlite:///{os.path.join(INSTANCE_DIR, 'biblioteca.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'cambiar-esta-clave-jwt-en-produccion')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)

    # ---------- Reglas de negocio (Módulo 5: Penalizaciones y Sanciones) ----------
    # Monto de multa por cada día de atraso en la devolución de un préstamo.
    MULTA_POR_DIA_ATRASO = float(os.environ.get('MULTA_POR_DIA_ATRASO', 100))
    # Días de plazo por defecto entre el préstamo y la fecha estimada de devolución.
    DIAS_PRESTAMO_DEFAULT = int(os.environ.get('DIAS_PRESTAMO_DEFAULT', 14))
    # Costo de reposición cuando un libro se pierde y el libro no tiene un
    # precio_reposicion propio cargado.
    COSTO_REPOSICION_DEFAULT = float(os.environ.get('COSTO_REPOSICION_DEFAULT', 5000))
