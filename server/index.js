const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const http = require('http');
const https = require('https');
const os = require('os');
const express = require('express');
const { obtenerCertificado } = require('./cert');

const appConfig = {
  MULTA_POR_DIA_ATRASO: parseFloat(process.env.MULTA_POR_DIA_ATRASO || '100'),
  DIAS_PRESTAMO_DEFAULT: parseInt(process.env.DIAS_PRESTAMO_DEFAULT || '14', 10),
  COSTO_REPOSICION_DEFAULT: parseFloat(process.env.COSTO_REPOSICION_DEFAULT || '5000'),
};

const { router: authRouter } = require('./routes/auth');
const { router: librosRouter } = require('./routes/libros');
const { router: sociosRouter } = require('./routes/socios');
const { router: prestamosRouter } = require('./routes/prestamos');
const { router: sancionesRouter } = require('./routes/sanciones');
const { router: reportesRouter } = require('./routes/reportes');
const { router: usuariosRouter } = require('./routes/usuarios');
const { router: dashboardRouter } = require('./routes/dashboard');

const app = express();

app.use(express.json());
app.use((req, res, next) => {
  req.appConfig = appConfig;
  next();
});

// ---------- Frontend estático (raíz del proyecto) ----------
app.use(express.static(path.join(__dirname, '..')));

// ---------- API: un router por módulo funcional ----------
app.use('/api/auth', authRouter);
app.use('/api/libros', librosRouter);
app.use('/api/socios', sociosRouter);
app.use('/api/prestamos', prestamosRouter);
app.use('/api/sanciones', sancionesRouter);
app.use('/api/reportes', reportesRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/dashboard', dashboardRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

function direccionesLan() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

const PORT = process.env.PORT || 5000;
const HTTPS_PORT = process.env.HTTPS_PORT || 5443;
const ips = direccionesLan();

http.createServer(app).listen(PORT, () => {
  console.log(`Biblioteca CESPA (HTTP) en esta PC: http://127.0.0.1:${PORT}`);
});

obtenerCertificado().then(({ key, cert }) => {
  https.createServer({ key, cert }, app).listen(HTTPS_PORT, () => {
    console.log('');
    console.log('Para entrar desde el celular u otra compu (misma red WiFi),');
    console.log('con la cámara habilitada para escanear códigos de barras:');
    if (ips.length) {
      ips.forEach((ip) => console.log(`  https://${ip}:${HTTPS_PORT}`));
    } else {
      console.log(`  https://127.0.0.1:${HTTPS_PORT}`);
    }
    console.log('(el navegador va a avisar "sitio no seguro" la primera vez — es normal,');
    console.log(' es un certificado local; tocar "Avanzado" > "Continuar de todos modos")');
  });
}).catch((err) => {
  console.error('No se pudo generar el certificado HTTPS local:', err.message);
});
