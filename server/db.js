const { Pool, types } = require('pg');

// Devolver fechas y timestamps como texto plano (igual que SQLite antes),
// en vez de que 'pg' los convierta a objetos Date de JavaScript.
types.setTypeParser(1082, (val) => val); // DATE
types.setTypeParser(1114, (val) => val); // TIMESTAMP
types.setTypeParser(1184, (val) => val); // TIMESTAMPTZ

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function query(text, params) {
  return pool.query(text, params);
}

async function one(text, params) {
  const { rows } = await pool.query(text, params);
  return rows[0] || null;
}

async function many(text, params) {
  const { rows } = await pool.query(text, params);
  return rows;
}

async function run(text, params) {
  return pool.query(text, params);
}

async function initSchema() {
  await pool.query(`
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nombre_completo TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'ENCARGADO',
  turno TEXT NOT NULL DEFAULT 'MAÑANA',
  estado TEXT NOT NULL DEFAULT 'activo',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS libros (
  id SERIAL PRIMARY KEY,
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
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ejemplares (
  id SERIAL PRIMARY KEY,
  libro_id INTEGER NOT NULL REFERENCES libros(id),
  numero_ejemplar INTEGER NOT NULL,
  estado TEXT NOT NULL DEFAULT 'disponible'
);

CREATE TABLE IF NOT EXISTS socios (
  id SERIAL PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'alumno',
  nombre_completo TEXT NOT NULL,
  dni TEXT NOT NULL UNIQUE,
  telefono TEXT,
  email TEXT,
  curso TEXT,
  division TEXT,
  materia TEXT,
  estado_plan TEXT NOT NULL DEFAULT 'al_dia',
  es_socio BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prestamos (
  id SERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  ejemplar_id INTEGER NOT NULL REFERENCES ejemplares(id),
  socio_id INTEGER NOT NULL REFERENCES socios(id),
  encargado_id INTEGER REFERENCES usuarios(id),
  encargado_recepcion_id INTEGER REFERENCES usuarios(id),
  fecha_prestamo DATE NOT NULL,
  fecha_estimada_devolucion DATE NOT NULL,
  fecha_real_devolucion DATE,
  estado TEXT NOT NULL DEFAULT 'activo',
  estado_libro_devuelto TEXT,
  observaciones TEXT,
  modalidad TEXT NOT NULL DEFAULT 'domicilio',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sanciones (
  id SERIAL PRIMARY KEY,
  prestamo_id INTEGER NOT NULL REFERENCES prestamos(id),
  socio_id INTEGER NOT NULL REFERENCES socios(id),
  tipo TEXT NOT NULL,
  dias_atraso INTEGER DEFAULT 0,
  monto_multa REAL DEFAULT 0,
  monto_reposicion REAL DEFAULT 0,
  estado_pago TEXT NOT NULL DEFAULT 'pendiente',
  fecha_generada TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_pagada TIMESTAMPTZ
);
  `);

  // Mini-migración: agrega 'modalidad' si faltara en una base ya existente.
  await pool.query(`
    ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS modalidad TEXT NOT NULL DEFAULT 'domicilio';
  `);
}

module.exports = { pool, query, one, many, run, initSchema };
