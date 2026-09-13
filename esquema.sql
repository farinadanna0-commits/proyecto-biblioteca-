CREATE TABLE Usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    nombre_completo TEXT,
    rol TEXT NOT NULL, -- 'administrador', 'bibliotecaria'
    estado TEXT DEFAULT 'activo'
);

CREATE TABLE Libros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    autor TEXT NOT NULL,
    editorial TEXT,
    edicion TEXT,
    anio_publicacion INTEGER,
    genero_literario TEXT,
    categoria_area TEXT,
    cantidad_ejemplares INTEGER DEFAULT 1,
    ubicacion_fisica TEXT,
    isbn TEXT,
    estado TEXT DEFAULT 'disponible'
);

CREATE TABLE Socios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre_completo TEXT NOT NULL,
    dni TEXT NOT NULL UNIQUE,
    telefono TEXT,
    correo TEXT,
    tipo_socio TEXT,
    curso_division TEXT,
    materia TEXT,
    estado TEXT DEFAULT 'activo', 
    estado_pago TEXT DEFAULT 'al_dia'
);

CREATE TABLE Prestamos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_prestamo TEXT UNIQUE,
    id_libro INTEGER,
    id_socio INTEGER,
    fecha_prestamo DATE,
    fecha_devolucion_estimada DATE,
    fecha_devolucion_real DATE,
    estado TEXT DEFAULT 'activo', -- 'activo', 'devuelto', 'atrasado', 'perdido'
    multa_calculada REAL DEFAULT 0,
    observaciones TEXT,
    FOREIGN KEY(id_libro) REFERENCES Libros(id),
    FOREIGN KEY(id_socio) REFERENCES Socios(id)
);