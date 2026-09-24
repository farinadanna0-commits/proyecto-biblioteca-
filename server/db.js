const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'biblioteca.sqlite');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);

db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nombre_completo TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'ENCARGADO',
  turno TEXT NOT NULL DEFAULT 'MAÑANA',
  estado TEXT NOT NULL DEFAULT 'activo',
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS libros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  autor TEXT NOT NULL,
  editorial TEXT,
  edicion TEXT,
  anio_publicacion INTEGER,
  genero TEXT,
  categoria TEXT,
  isbn TEXT,
  ubicacion_fisica TEXT,
  precio_reposicion REAL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ejemplares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  libro_id INTEGER NOT NULL REFERENCES libros(id),
  numero_ejemplar INTEGER NOT NULL,
  estado TEXT NOT NULL DEFAULT 'disponible'
);

CREATE TABLE IF NOT EXISTS socios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL DEFAULT 'alumno',
  nombre_completo TEXT NOT NULL,
  dni TEXT NOT NULL UNIQUE,
  telefono TEXT,
  email TEXT,
  curso TEXT,
  division TEXT,
  materia TEXT,
  estado_plan TEXT NOT NULL DEFAULT 'al_dia',
  es_socio INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS prestamos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  ejemplar_id INTEGER NOT NULL REFERENCES ejemplares(id),
  socio_id INTEGER NOT NULL REFERENCES socios(id),
  encargado_id INTEGER REFERENCES usuarios(id),
  encargado_recepcion_id INTEGER REFERENCES usuarios(id),
  fecha_prestamo TEXT NOT NULL,
  fecha_estimada_devolucion TEXT NOT NULL,
  fecha_real_devolucion TEXT,
  estado TEXT NOT NULL DEFAULT 'activo',
  estado_libro_devuelto TEXT,
  observaciones TEXT,
  modalidad TEXT NOT NULL DEFAULT 'domicilio',
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sanciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prestamo_id INTEGER NOT NULL REFERENCES prestamos(id),
  socio_id INTEGER NOT NULL REFERENCES socios(id),
  tipo TEXT NOT NULL,
  dias_atraso INTEGER DEFAULT 0,
  monto_multa REAL DEFAULT 0,
  monto_reposicion REAL DEFAULT 0,
  estado_pago TEXT NOT NULL DEFAULT 'pendiente',
  fecha_generada TEXT NOT NULL DEFAULT (datetime('now')),
  fecha_pagada TEXT
);
`);

// ---------- Mini-migración: agrega columnas nuevas a bases ya existentes ----------
// (no reemplaza a una herramienta de migraciones real, pero alcanza para este proyecto)
const columnasPrestamos = db.prepare("PRAGMA table_info(prestamos)").all().map((c) => c.name);
if (!columnasPrestamos.includes('modalidad')) {
  db.exec("ALTER TABLE prestamos ADD COLUMN modalidad TEXT NOT NULL DEFAULT 'domicilio'");
}

module.exports = db;
