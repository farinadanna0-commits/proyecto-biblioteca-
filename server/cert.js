const fs = require('fs');
const path = require('path');
const selfsigned = require('selfsigned');

const DATA_DIR = path.join(__dirname, '..', 'data');
const KEY_PATH = path.join(DATA_DIR, 'dev-key.pem');
const CERT_PATH = path.join(DATA_DIR, 'dev-cert.pem');

/**
 * Certificado autofirmado para poder servir HTTPS en la red local (la
 * cámara del celular sólo funciona en un "contexto seguro": HTTPS, o
 * localhost). Se genera una sola vez y se reutiliza en los siguientes
 * arranques; el navegador va a mostrar un aviso de "sitio no seguro"
 * la primera vez que cada dispositivo entra, hay que aceptarlo.
 */
async function obtenerCertificado() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
    return {
      key: fs.readFileSync(KEY_PATH),
      cert: fs.readFileSync(CERT_PATH),
    };
  }

  const notAfterDate = new Date();
  notAfterDate.setFullYear(notAfterDate.getFullYear() + 10);

  const pems = await selfsigned.generate([{ name: 'commonName', value: 'biblioteca-local' }], {
    keySize: 2048,
    notAfterDate,
  });
  fs.writeFileSync(KEY_PATH, pems.private);
  fs.writeFileSync(CERT_PATH, pems.cert);
  return { key: pems.private, cert: pems.cert };
}

module.exports = { obtenerCertificado };
