// =====================================================================
// Biblioteca Colegio Secundario San Carlos — Frontend
// Conectado a la API REST del backend Flask (ver carpeta /backend).
// Si el backend corre en otra URL/puerto, editar la siguiente constante.
// =====================================================================
const API_BASE = 'http://127.0.0.1:5000/api';

// ---------- Estado de sesión ----------
let authToken = null;
let currentUser = null; // {id, username, nombre_completo, rol, turno, estado}

// ---------- Estado de datos (poblado desde la API) ----------
let books = [];
let members = [];
let loans = [];
let sanciones = [];
let usuarios = [];
let dashboardResumen = null;

let activeLoanFilter = 'todos';
let activeMemberFilter = 'todos';
let activeBookGenreFilter = 'todos';
let activeSancionFilter = 'todos';
let selectedMemberType = 'alumno';

// ---------------------------------------------------------------------
// Autenticación (Módulo 8) y arranque de sesión
// ---------------------------------------------------------------------
async function doLogin(evt){
  if(evt) evt.preventDefault();
  const username = document.getElementById('f-login-user').value.trim();
  const password = document.getElementById('f-login-pass').value;
  const errorEl = document.getElementById('loginError');
  errorEl.textContent = '';

  if(!username || !password){
    errorEl.textContent = 'Ingresá usuario y contraseña';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username, password}),
    });
    const data = await res.json().catch(() => null);

    if(!res.ok){
      errorEl.textContent = (data && data.error) || 'Usuario o contraseña incorrectos';
      return;
    }

    authToken = data.token;
    currentUser = data.usuario;
    sessionStorage.setItem('lib_token', authToken);
    sessionStorage.setItem('lib_user', JSON.stringify(currentUser));
    await showApp();
  } catch (err){
    errorEl.textContent = 'No se pudo conectar con el servidor. ¿Está corriendo el backend?';
  }
}

function doLogout(evt){
  if(evt) evt.preventDefault();
  authToken = null;
  currentUser = null;
  sessionStorage.removeItem('lib_token');
  sessionStorage.removeItem('lib_user');
  document.getElementById('f-login-user').value = '';
  document.getElementById('f-login-pass').value = '';
  document.getElementById('appContent').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
}

async function showApp(){
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appContent').style.display = 'block';
  aplicarVisibilidadPorRol();
  actualizarInfoUsuario();
  await cargarDatosIniciales();
}

function checkSession(){
  const token = sessionStorage.getItem('lib_token');
  const userRaw = sessionStorage.getItem('lib_user');
  if(token && userRaw){
    authToken = token;
    try { currentUser = JSON.parse(userRaw); } catch(e){ currentUser = null; }
    if(currentUser){
      showApp();
      return;
    }
  }
  document.getElementById('loginScreen').style.display = 'flex';
}

// Permite iniciar sesión presionando Enter
document.addEventListener('DOMContentLoaded', () => {
  ['f-login-user', 'f-login-pass'].forEach(id => {
    const el = document.getElementById(id);
    if(el){
      el.addEventListener('keydown', (e) => { if(e.key === 'Enter') doLogin(e); });
    }
  });
});

// ---------- Panel dinámico por rol (Módulo 9) ----------
function rolLabel(rol){
  return {ADMIN: 'Administrador', BIBLIOTECARIO: 'Bibliotecaria', ENCARGADO: 'Encargado/a'}[rol] || rol;
}

function actualizarInfoUsuario(){
  const el = document.getElementById('currentUserInfo');
  if(el && currentUser){
    el.textContent = `${currentUser.nombre_completo} · ${rolLabel(currentUser.rol)} · Turno ${currentUser.turno}`;
  }
}

function aplicarVisibilidadPorRol(){
  document.querySelectorAll('[data-roles]').forEach(el => {
    const roles = el.getAttribute('data-roles').split(',');
    el.style.display = (currentUser && roles.includes(currentUser.rol)) ? '' : 'none';
  });
}

// ---------------------------------------------------------------------
// Cliente HTTP genérico hacia la API
// ---------------------------------------------------------------------
async function apiFetch(path, options = {}){
  const headers = Object.assign({'Content-Type': 'application/json'}, options.headers || {});
  if(authToken) headers['Authorization'] = `Bearer ${authToken}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, Object.assign({}, options, {headers}));
  } catch (err){
    showToast('No se pudo conectar con el servidor', 'danger');
    throw err;
  }

  let data = null;
  try { data = await res.json(); } catch(e){ data = null; }

  if(res.status === 401){
    showToast('Tu sesión expiró. Iniciá sesión nuevamente.', 'danger');
    doLogout();
    throw new Error('No autorizado');
  }
  if(!res.ok){
    const msg = (data && data.error) ? data.error : 'Ocurrió un error inesperado';
    showToast(msg, 'danger');
    throw new Error(msg);
  }
  return data;
}

async function cargarDatosIniciales(){
  try {
    const tareas = [
      apiFetch('/libros').then(d => { books = d; }),
      apiFetch('/socios').then(d => { members = d; }),
      apiFetch('/prestamos').then(d => { loans = d; }),
      apiFetch('/dashboard/resumen').then(d => { dashboardResumen = d; }),
    ];
    if(currentUser && ['ADMIN', 'BIBLIOTECARIO'].includes(currentUser.rol)){
      tareas.push(apiFetch('/sanciones').then(d => { sanciones = d; }));
    }
    if(currentUser && currentUser.rol === 'ADMIN'){
      tareas.push(apiFetch('/usuarios').then(d => { usuarios = d; }));
    }
    await Promise.all(tareas);
    renderAll();
  } catch(err){
    console.error(err);
  }
}

// ---------- Toasts ----------
function showToast(message, type){
  type = type || 'info';
  const icons = {success:'✓', info:'ℹ', danger:'✕'};
  const wrap = document.getElementById('toastWrap');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ---------- Ripple ----------
function addRipple(evt){
  if(!evt || !evt.currentTarget) return;
  const btn = evt.currentTarget;
  const rect = btn.getBoundingClientRect();
  const circle = document.createElement('span');
  const size = Math.max(rect.width, rect.height);
  circle.className = 'ripple';
  circle.style.width = circle.style.height = size + 'px';
  circle.style.left = (evt.clientX - rect.left - size/2) + 'px';
  circle.style.top = (evt.clientY - rect.top - size/2) + 'px';
  btn.appendChild(circle);
  setTimeout(() => circle.remove(), 550);
}
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn, .nav-tab, .action-btn');
  if(btn){
    btn.style.position = btn.style.position || 'relative';
    btn.style.overflow = 'hidden';
    addRipple({currentTarget: btn, clientX: e.clientX, clientY: e.clientY});
  }
});

// ---------- Fechas & Utilidades ----------
function todayISO(){ return new Date().toISOString().slice(0,10); }
function daysBetween(a, b){ return Math.round((new Date(b) - new Date(a)) / 86400000); }
function formatDate(iso){
  if(!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  const meses = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  return `${String(d.getDate()).padStart(2,'0')} ${meses[d.getMonth()]}`;
}

function statusOf(loan){
  if(loan.estado === 'perdido') return 'overdue';
  if(loan.estado === 'devuelto') return 'returned';
  if(loan.estado === 'atrasado') return 'overdue';
  const diff = daysBetween(todayISO(), loan.fecha_estimada_devolucion);
  if(diff < 0) return 'overdue';
  if(diff <= 3) return 'due-soon';
  return 'on-time';
}

function statusLabel(s, loan){
  if(loan.estado === 'perdido') return 'Perdido';
  if(s === 'returned') return 'Devuelto';
  if(s === 'overdue'){
    const d = Math.abs(daysBetween(todayISO(), loan.fecha_estimada_devolucion));
    return `${d}d tarde`;
  }
  if(s === 'due-soon') return 'Por vencer';
  return 'Activo';
}

function tipoLabel(tipo){ return tipo === 'maestro' ? 'Maestro' : 'Alumno'; }
function estadoPlanLabel(estado){
  return {al_dia: 'Al día', suspendido: 'Suspendido', bloqueado: 'Bloqueado'}[estado] || estado;
}
function estadoPlanEdgeClass(estado){
  return {al_dia: 'on-time', suspendido: 'due-soon', bloqueado: 'overdue'}[estado] || 'on-time';
}
function estadoEjemplarLabel(estado){
  return {disponible: 'Disponible', prestado: 'Prestado', 'dañado': 'Dañado', perdido: 'Perdido'}[estado] || estado;
}
function ejemplarChipClass(estado){
  return {disponible: 'on-time', prestado: 'returned', 'dañado': 'due-soon', perdido: 'overdue'}[estado] || 'returned';
}
function estadoDevueltoLabel(estado){
  return {buen_estado: 'Buen estado', dano_menor: 'Daño menor', dano_mayor: 'Daño mayor', perdida: 'Pérdida'}[estado] || (estado || '—');
}

// ---------- Navegación ----------
function switchTab(tabId, evt){
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  if(evt && evt.target) evt.target.classList.add('active');
  const target = document.getElementById(`tab-${tabId}`);
  if(target) target.classList.add('active');
  renderAll();
}

// ---------- Modales ----------
function openModal(id){
  document.getElementById(id).classList.add('open');
  if(id === 'modalLoan'){
    populateSelects();
    document.getElementById('f-loan-start').value = todayISO();
    const d = new Date(); d.setDate(d.getDate() + 14);
    document.getElementById('f-loan-due').value = d.toISOString().slice(0,10);
  }
  if(id === 'modalMember'){
    setMemberType('alumno');
  }
}
function closeModal(id){ document.getElementById(id).classList.remove('open'); }

function populateSelects(){
  const bookSel = document.getElementById('f-loan-book');
  const memberSel = document.getElementById('f-loan-member');

  const librosConStock = books.filter(b => b.ejemplares_disponibles > 0);
  bookSel.innerHTML = librosConStock.length
    ? librosConStock.map(b => `<option value="${b.id}">${b.titulo} (${b.autor}) — ${b.ejemplares_disponibles} disp.</option>`).join('')
    : '<option value="">No hay libros con ejemplares disponibles</option>';

  memberSel.innerHTML = members.length
    ? members.map(m => `<option value="${m.id}" ${m.estado_plan !== 'al_dia' ? 'disabled' : ''}>${tipoLabel(m.tipo)} — ${m.nombre_completo} (DNI: ${m.dni})${m.estado_plan !== 'al_dia' ? ' · ' + estadoPlanLabel(m.estado_plan) : ''}</option>`).join('')
    : '<option value="">No hay socios guardados</option>';
}

// ---------- Tipo de Socio (Alumno / Maestro) ----------
function setMemberType(tipo){
  selectedMemberType = tipo;
  document.getElementById('typeBtn-alumno').classList.toggle('active', tipo === 'alumno');
  document.getElementById('typeBtn-maestro').classList.toggle('active', tipo === 'maestro');
  document.getElementById('field-member-extra-alumno').style.display = tipo === 'alumno' ? 'flex' : 'none';
  document.getElementById('field-member-division').style.display = tipo === 'alumno' ? 'flex' : 'none';
  document.getElementById('field-member-extra-maestro').style.display = tipo === 'maestro' ? 'flex' : 'none';
}

// ---------------------------------------------------------------------
// Préstamos y Devoluciones (Módulo 3)
// ---------------------------------------------------------------------
async function saveLoan(evt){
  if(evt) evt.preventDefault();
  const libroId = document.getElementById('f-loan-book').value;
  const socioId = document.getElementById('f-loan-member').value;
  const inicio = document.getElementById('f-loan-start').value;
  const vencimiento = document.getElementById('f-loan-due').value;

  if(!libroId || !socioId || !vencimiento){
    showToast('Completá todos los campos del préstamo', 'danger');
    return;
  }

  try {
    await apiFetch('/prestamos', {
      method: 'POST',
      body: JSON.stringify({
        libro_id: Number(libroId), socio_id: Number(socioId),
        fecha_prestamo: inicio, fecha_estimada_devolucion: vencimiento,
      }),
    });
    closeModal('modalLoan');
    showToast('Préstamo registrado correctamente', 'success');
    await cargarDatosIniciales();
  } catch(err){ /* apiFetch ya mostró el error */ }
}

function abrirDevolucion(prestamoId){
  document.getElementById('f-devolucion-prestamo-id').value = prestamoId;
  document.getElementById('f-devolucion-estado').value = 'buen_estado';
  document.getElementById('f-devolucion-obs').value = '';
  openModal('modalDevolucion');
}

async function confirmarDevolucion(evt){
  if(evt) evt.preventDefault();
  const id = document.getElementById('f-devolucion-prestamo-id').value;
  const estado = document.getElementById('f-devolucion-estado').value;
  const obs = document.getElementById('f-devolucion-obs').value.trim();

  try {
    await apiFetch(`/prestamos/${id}/devolver`, {
      method: 'PUT',
      body: JSON.stringify({estado_libro_devuelto: estado, observaciones: obs}),
    });
    closeModal('modalDevolucion');
    showToast(estado === 'perdida' ? 'Pérdida registrada y sanción generada' : 'Devolución registrada', 'success');
    await cargarDatosIniciales();
  } catch(err){}
}

async function reabrirPrestamo(id){
  try {
    await apiFetch(`/prestamos/${id}/reabrir`, {method: 'PUT'});
    showToast('Préstamo reabierto', 'info');
    await cargarDatosIniciales();
  } catch(err){}
}

async function deleteLoan(id){
  if(!confirm('¿Eliminar este préstamo? Esta acción no se puede deshacer.')) return;
  try {
    await apiFetch(`/prestamos/${id}`, {method: 'DELETE'});
    showToast('Préstamo eliminado', 'danger');
    await cargarDatosIniciales();
  } catch(err){}
}

// ---------------------------------------------------------------------
// Libros y Ejemplares (Módulos 1 y 4)
// ---------------------------------------------------------------------
async function saveBook(evt){
  if(evt) evt.preventDefault();
  const titulo = document.getElementById('f-book-title').value.trim();
  const autor = document.getElementById('f-book-author').value.trim();
  const editorial = document.getElementById('f-book-editorial').value.trim();
  const edicion = document.getElementById('f-book-edicion').value.trim();
  const anio = document.getElementById('f-book-anio').value;
  const genero = document.getElementById('f-book-genre').value.trim();
  const categoria = document.getElementById('f-book-categoria').value.trim();
  const isbn = document.getElementById('f-book-isbn').value.trim();
  const ubicacion = document.getElementById('f-book-ubicacion').value.trim();
  const cantidad = parseInt(document.getElementById('f-book-copies').value) || 1;

  if(!titulo){ showToast('Ingresá al menos el título del libro', 'danger'); return; }

  try {
    await apiFetch('/libros', {
      method: 'POST',
      body: JSON.stringify({
        titulo, autor, editorial, edicion,
        anio_publicacion: anio ? Number(anio) : null,
        genero, categoria, isbn, ubicacion_fisica: ubicacion,
        cantidad_ejemplares: cantidad,
      }),
    });
    closeModal('modalBook');
    document.querySelectorAll('#modalBook input').forEach(i => i.value = '');
    document.getElementById('f-book-copies').value = 1;
    showToast('Libro añadido al catálogo', 'success');
    await cargarDatosIniciales();
  } catch(err){}
}

async function deleteBook(id){
  if(!confirm('¿Eliminar este libro del catálogo?')) return;
  try {
    await apiFetch(`/libros/${id}`, {method: 'DELETE'});
    showToast('Libro eliminado del catálogo', 'danger');
    await cargarDatosIniciales();
  } catch(err){}
}

async function ciclarEstadoEjemplar(ejemplarId, estadoActual){
  if(estadoActual === 'prestado'){
    showToast('Este ejemplar está prestado; no se puede cambiar su estado', 'info');
    return;
  }
  const siguiente = {disponible: 'dañado', 'dañado': 'perdido', perdido: 'disponible'}[estadoActual] || 'disponible';
  try {
    await apiFetch(`/libros/ejemplares/${ejemplarId}/estado`, {
      method: 'PUT', body: JSON.stringify({estado: siguiente}),
    });
    showToast(`Ejemplar marcado como ${estadoEjemplarLabel(siguiente)}`, 'info');
    await cargarDatosIniciales();
  } catch(err){}
}

// ---------------------------------------------------------------------
// Socios (Módulo 2)
// ---------------------------------------------------------------------
async function saveMember(evt){
  if(evt) evt.preventDefault();
  const nombre = document.getElementById('f-member-name').value.trim();
  const dni = document.getElementById('f-member-dni').value.trim();
  const phone = document.getElementById('f-member-phone').value.trim();
  const email = document.getElementById('f-member-email').value.trim();
  const tipo = selectedMemberType;
  const course = document.getElementById('f-member-course').value.trim();
  const division = document.getElementById('f-member-division').value.trim();
  const subject = document.getElementById('f-member-subject').value.trim();

  if(!nombre || !dni){ showToast('Ingresá nombre y DNI del socio', 'danger'); return; }

  try {
    await apiFetch('/socios', {
      method: 'POST',
      body: JSON.stringify({
        nombre_completo: nombre, dni, telefono: phone, email,
        tipo, curso: course, division, materia: subject,
      }),
    });
    closeModal('modalMember');
    document.querySelectorAll('#modalMember input').forEach(i => i.value = '');
    setMemberType('alumno');
    showToast(`${tipoLabel(tipo)} registrado correctamente`, 'success');
    await cargarDatosIniciales();
  } catch(err){}
}

async function deleteMember(id){
  if(!confirm('¿Eliminar este socio?')) return;
  try {
    await apiFetch(`/socios/${id}`, {method: 'DELETE'});
    showToast('Socio eliminado', 'danger');
    await cargarDatosIniciales();
  } catch(err){}
}

async function toggleBloqueoSocio(id, estadoPlanActual){
  const nuevoEstado = estadoPlanActual === 'bloqueado' ? 'al_dia' : 'bloqueado';
  try {
    await apiFetch(`/socios/${id}`, {method: 'PUT', body: JSON.stringify({estado_plan: nuevoEstado})});
    showToast(nuevoEstado === 'bloqueado' ? 'Socio bloqueado' : 'Socio desbloqueado', 'info');
    await cargarDatosIniciales();
  } catch(err){}
}

// ---------------------------------------------------------------------
// Sanciones (Módulo 5)
// ---------------------------------------------------------------------
function setSancionFilter(key, btn){
  activeSancionFilter = key;
  document.querySelectorAll('#sancionFilters .filter').forEach(f => f.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderSanciones();
}

async function pagarSancion(id){
  try {
    await apiFetch(`/sanciones/${id}/pagar`, {method: 'PUT'});
    showToast('Sanción marcada como pagada', 'success');
    await cargarDatosIniciales();
  } catch(err){}
}

// ---------------------------------------------------------------------
// Reportes (Módulo 6)
// ---------------------------------------------------------------------
async function generarReporte(evt){
  if(evt) evt.preventDefault();
  const tipo = document.getElementById('f-reporte-tipo').value;
  const desde = document.getElementById('f-reporte-desde').value;
  const hasta = document.getElementById('f-reporte-hasta').value;

  const params = new URLSearchParams();
  if(desde) params.set('desde', desde);
  if(hasta) params.set('hasta', hasta);

  try {
    const data = await apiFetch(`/reportes/${tipo}?${params.toString()}`);
    renderReporte(tipo, data);
  } catch(err){}
}

function renderReporte(tipo, data){
  const resumen = document.getElementById('reporteResumen');
  const resultados = document.getElementById('reporteResultados');
  resumen.style.display = 'none';
  resumen.innerHTML = '';

  if(tipo === 'vencidos' || tipo === 'danos-perdidas'){
    resultados.innerHTML = data.length ? data.map(p => `
      <div class="ticket glass">
        <div class="edge overdue"></div>
        <div class="ticket-main">
          <div class="title">${p.libro_titulo || 'Libro'}</div>
          <div class="sub">Socio: <strong>${p.socio_nombre || '—'}</strong> · Código: ${p.codigo}</div>
          <span class="badge">Venc.: ${formatDate(p.fecha_estimada_devolucion)}</span>
        </div>
        <div class="ticket-stub">
          <span class="badge mono">${p.estado_libro_devuelto ? estadoDevueltoLabel(p.estado_libro_devuelto) : p.estado}</span>
        </div>
      </div>
    `).join('') : '<div class="empty-state glass">Sin resultados para el rango elegido.</div>';

  } else if(tipo === 'socios-atrasados'){
    resultados.innerHTML = data.length ? data.map(s => `
      <div class="ticket glass">
        <div class="edge overdue"></div>
        <div class="ticket-main">
          <div class="title">${s.nombre_completo}</div>
          <div class="sub">DNI: ${s.dni}</div>
        </div>
        <div class="ticket-stub">
          <span class="status-chip overdue">${estadoPlanLabel(s.estado_plan)}</span>
        </div>
      </div>
    `).join('') : '<div class="empty-state glass">No hay socios con atrasos.</div>';

  } else if(tipo === 'mas-solicitados'){
    resultados.innerHTML = data.length ? data.map((r, i) => `
      <div class="ticket glass">
        <div class="edge on-time"></div>
        <div class="ticket-main">
          <div class="title">#${i + 1} · ${r.titulo}</div>
          <div class="sub">Autor: ${r.autor}</div>
        </div>
        <div class="ticket-stub">
          <span class="badge mono">${r.total_prestamos} préstamos</span>
        </div>
      </div>
    `).join('') : '<div class="empty-state glass">Sin préstamos en el rango elegido.</div>';

  } else if(tipo === 'ingresos-multas'){
    resumen.style.display = 'grid';
    resumen.innerHTML = `
      <div class="dash-card glass">
        <div class="num mono" style="color:var(--green);">$${Number(data.total_recaudado).toFixed(2)}</div>
        <div class="lbl">Total Recaudado</div>
      </div>
      <div class="dash-card glass">
        <div class="num mono" style="color:var(--ink);">${data.cantidad_sanciones}</div>
        <div class="lbl">Sanciones Pagadas</div>
      </div>
    `;
    resultados.innerHTML = data.detalle.length ? data.detalle.map(s => `
      <div class="ticket glass is-returned">
        <div class="edge returned"></div>
        <div class="ticket-main">
          <div class="title">${s.socio_nombre || 'Socio eliminado'}</div>
          <div class="sub">${s.tipo === 'atraso' ? 'Multa por atraso' : 'Reposición por pérdida'}</div>
        </div>
        <div class="ticket-stub">
          <span class="badge mono">$${Number(s.monto_total).toFixed(2)}</span>
        </div>
      </div>
    `).join('') : '<div class="empty-state glass">Sin ingresos en el rango elegido.</div>';
  }
}

// ---------------------------------------------------------------------
// Usuarios y Permisos (Módulo 7)
// ---------------------------------------------------------------------
async function saveUsuario(evt){
  if(evt) evt.preventDefault();
  const username = document.getElementById('f-usuario-username').value.trim();
  const password = document.getElementById('f-usuario-password').value;
  const nombre = document.getElementById('f-usuario-nombre').value.trim();
  const rol = document.getElementById('f-usuario-rol').value;
  const turno = document.getElementById('f-usuario-turno').value;

  if(!username || !password || !nombre){
    showToast('Completá usuario, contraseña y nombre completo', 'danger');
    return;
  }

  try {
    await apiFetch('/usuarios', {
      method: 'POST',
      body: JSON.stringify({username, password, nombre_completo: nombre, rol, turno}),
    });
    closeModal('modalUsuario');
    document.querySelectorAll('#modalUsuario input').forEach(i => i.value = '');
    showToast('Usuario creado correctamente', 'success');
    await cargarDatosIniciales();
  } catch(err){}
}

async function toggleEstadoUsuario(id, estadoActual){
  const nuevo = estadoActual === 'activo' ? 'inactivo' : 'activo';
  try {
    await apiFetch(`/usuarios/${id}/estado`, {method: 'PUT', body: JSON.stringify({estado: nuevo})});
    showToast(nuevo === 'activo' ? 'Usuario activado' : 'Usuario desactivado', 'info');
    await cargarDatosIniciales();
  } catch(err){}
}

// ---------------------------------------------------------------------
// Renders / Renderizado
// ---------------------------------------------------------------------
function renderHome(){
  if(dashboardResumen){
    document.getElementById('dashActiveLoans').textContent = dashboardResumen.prestamos_activos;
    document.getElementById('dashOverdueLoans').textContent = dashboardResumen.prestamos_vencidos;
    document.getElementById('dashTotalBooks').textContent = dashboardResumen.total_libros;
    document.getElementById('dashTotalMembers').textContent = dashboardResumen.total_socios;
  }

  const urgentLoans = loans.filter(l =>
    (l.estado === 'activo' || l.estado === 'atrasado') &&
    (statusOf(l) === 'overdue' || statusOf(l) === 'due-soon')
  );
  const container = document.getElementById('homeRecentLoans');
  if(!container) return;

  if(!urgentLoans.length){
    container.innerHTML = '<div class="empty-state glass">No hay préstamos urgentes o vencidos. ¡Todo al día! ✨</div>';
    return;
  }
  container.innerHTML = urgentLoans.map(l => renderTicketHtml(l)).join('');
}

function setLoanFilter(key, btn){
  activeLoanFilter = key;
  document.querySelectorAll('#loanFilters .filter').forEach(f => f.classList.remove('active'));
  btn.classList.add('active');
  renderLoans();
}

function renderLoans(){
  const query = (document.getElementById('loanSearch')?.value || '').toLowerCase();
  let list = loans.slice();

  if(activeLoanFilter !== 'todos') list = list.filter(l => statusOf(l) === activeLoanFilter);
  if(query){
    list = list.filter(l =>
      (l.libro_titulo || '').toLowerCase().includes(query) ||
      (l.socio_nombre || '').toLowerCase().includes(query)
    );
  }

  const container = document.getElementById('loansList');
  if(!container) return;
  if(!list.length){
    container.innerHTML = '<div class="empty-state glass">No se encontraron préstamos.</div>';
    return;
  }
  container.innerHTML = list.map(l => renderTicketHtml(l)).join('');
}

function renderTicketHtml(l){
  const s = statusOf(l);
  const yaCerrado = l.estado === 'devuelto' || l.estado === 'perdido';
  return `
    <div class="ticket glass ${yaCerrado ? 'is-returned' : ''}">
      <div class="edge ${s}"></div>
      <div class="ticket-main">
        <div class="title">${l.libro_titulo || 'Libro eliminado'}</div>
        <div class="sub">Prestado a: <strong>${l.socio_nombre || 'Socio eliminado'}</strong></div>
        <span class="badge">Inicio: ${formatDate(l.fecha_prestamo)}</span>
        <span class="badge mono" style="margin-left:6px;">${l.codigo}</span>
      </div>
      <div class="ticket-stub">
        <span class="status-chip ${s}">${statusLabel(s, l)}</span>
        <div class="mono" style="font-weight:600; font-size:0.85rem;">${formatDate(l.fecha_estimada_devolucion)}</div>
        ${yaCerrado
          ? `<button class="action-link" onclick="reabrirPrestamo(${l.id})">Reabrir</button>`
          : `<button class="action-link" onclick="abrirDevolucion(${l.id})">Devolver</button>`}
        <button class="action-link danger" onclick="deleteLoan(${l.id})">Eliminar</button>
      </div>
    </div>
  `;
}

function generosDisponibles(){
  const set = new Set(books.map(b => b.genero).filter(Boolean));
  return Array.from(set).sort();
}

function setBookGenreFilter(key, btn){
  activeBookGenreFilter = key;
  document.querySelectorAll('#bookGenreFilters .filter').forEach(f => f.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderBooks();
}

function renderBookGenreFilters(){
  const container = document.getElementById('bookGenreFilters');
  if(!container) return;
  const generos = generosDisponibles();
  const chips = [`<button class="filter ${activeBookGenreFilter === 'todos' ? 'active' : ''}" onclick="setBookGenreFilter('todos', this)">Todos los géneros</button>`]
    .concat(generos.map(g => `<button class="filter ${activeBookGenreFilter === g ? 'active' : ''}" onclick="setBookGenreFilter('${g.replace(/'/g, "\\'")}', this)">${g}</button>`));
  container.innerHTML = chips.join('');
}

function renderBooks(){
  renderBookGenreFilters();
  const query = (document.getElementById('bookSearch')?.value || '').toLowerCase();
  let list = books.filter(b =>
    (b.titulo || '').toLowerCase().includes(query) ||
    (b.autor || '').toLowerCase().includes(query) ||
    (b.isbn || '').includes(query) ||
    (b.categoria || '').toLowerCase().includes(query)
  );
  if(activeBookGenreFilter !== 'todos') list = list.filter(b => b.genero === activeBookGenreFilter);

  const container = document.getElementById('booksList');
  if(!container) return;
  if(!list.length){
    container.innerHTML = '<div class="empty-state glass">No hay libros registrados en el catálogo.</div>';
    return;
  }

  container.innerHTML = list.map(b => `
    <div class="ticket glass">
      <div class="edge ${b.ejemplares_disponibles > 0 ? 'on-time' : 'overdue'}"></div>
      <div class="ticket-main">
        <div class="title">${b.titulo}</div>
        <div class="sub">Autor: ${b.autor || 'Desconocido'} | Género: ${b.genero || 'N/A'} | ${b.categoria || 'Sin categoría'}</div>
        <span class="badge">ISBN: ${b.isbn || 'Sin ISBN'}</span>
        <span class="badge" style="margin-left:6px;">${b.ubicacion_fisica || 'Sin ubicación'}</span>
        <div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap;">
          ${(b.ejemplares || []).map(e => `<span class="status-chip ${ejemplarChipClass(e.estado)}" style="cursor:${e.estado === 'prestado' ? 'default' : 'pointer'};" title="Ejemplar #${e.numero_ejemplar}: ${estadoEjemplarLabel(e.estado)}${e.estado === 'prestado' ? '' : ' (click para cambiar estado)'}" onclick="ciclarEstadoEjemplar(${e.id}, '${e.estado}')">#${e.numero_ejemplar} ${estadoEjemplarLabel(e.estado)}</span>`).join('')}
        </div>
      </div>
      <div class="ticket-stub">
        <span class="badge mono">${b.ejemplares_disponibles}/${b.cantidad_ejemplares} disp.</span>
        <button class="action-link danger" onclick="deleteBook(${b.id})">Eliminar</button>
      </div>
    </div>
  `).join('');
}

function setMemberFilter(key, btn){
  activeMemberFilter = key;
  document.querySelectorAll('#memberFilters .filter').forEach(f => f.classList.remove('active'));
  btn.classList.add('active');
  renderMembers();
}

function renderMembers(){
  const query = (document.getElementById('memberSearch')?.value || '').toLowerCase();
  let list = members.filter(m =>
    (m.nombre_completo || '').toLowerCase().includes(query) ||
    (m.dni || '').includes(query) ||
    (m.email || '').toLowerCase().includes(query)
  );
  if(activeMemberFilter !== 'todos') list = list.filter(m => (m.tipo || 'alumno') === activeMemberFilter);

  const container = document.getElementById('membersList');
  if(!container) return;
  if(!list.length){
    container.innerHTML = '<div class="empty-state glass">No se encontraron socios registrados.</div>';
    return;
  }

  container.innerHTML = list.map(m => {
    const tipo = m.tipo || 'alumno';
    const extra = tipo === 'maestro'
      ? (m.materia ? `Materia: ${m.materia}` : 'Maestro/a')
      : (m.curso ? `Curso: ${m.curso}${m.division ? ' "' + m.division + '"' : ''}` : 'Alumno/a');
    return `
    <div class="ticket glass">
      <div class="edge ${estadoPlanEdgeClass(m.estado_plan)}"></div>
      <div class="ticket-main">
        <div class="title">${m.nombre_completo}</div>
        <div class="sub">DNI: ${m.dni} | Tel: ${m.telefono || 'S/N'}</div>
        <span class="badge">${tipoLabel(tipo)}</span>
        <span class="badge" style="margin-left:6px;">${extra}</span>
        <span class="badge" style="margin-left:6px;">${estadoPlanLabel(m.estado_plan)}</span>
      </div>
      <div class="ticket-stub">
        <span class="badge mono">${m.email || 'Sin correo'}</span>
        <button class="action-link" onclick="toggleBloqueoSocio(${m.id}, '${m.estado_plan}')">${m.estado_plan === 'bloqueado' ? 'Desbloquear' : 'Bloquear'}</button>
        <button class="action-link danger" onclick="deleteMember(${m.id})">Eliminar</button>
      </div>
    </div>
  `;
  }).join('');
}

function renderSanciones(){
  const container = document.getElementById('sancionesList');
  if(!container) return;

  let list = sanciones.slice();
  if(activeSancionFilter !== 'todos') list = list.filter(s => s.estado_pago === activeSancionFilter);

  if(!list.length){
    container.innerHTML = '<div class="empty-state glass">No hay sanciones registradas.</div>';
    return;
  }

  container.innerHTML = list.map(s => `
    <div class="ticket glass ${s.estado_pago === 'pagado' ? 'is-returned' : ''}">
      <div class="edge ${s.estado_pago === 'pagado' ? 'returned' : 'overdue'}"></div>
      <div class="ticket-main">
        <div class="title">${s.socio_nombre || 'Socio eliminado'}</div>
        <div class="sub">${s.tipo === 'atraso' ? `Atraso de ${s.dias_atraso} día(s) · Préstamo ${s.prestamo_codigo || ''}` : `Reposición por pérdida · Préstamo ${s.prestamo_codigo || ''}`}</div>
        <span class="badge">$${Number(s.monto_total).toFixed(2)}</span>
      </div>
      <div class="ticket-stub">
        <span class="status-chip ${s.estado_pago === 'pagado' ? 'returned' : 'overdue'}">${s.estado_pago === 'pagado' ? 'Pagado' : 'Pendiente'}</span>
        ${s.estado_pago === 'pendiente' ? `<button class="action-link" onclick="pagarSancion(${s.id})">Marcar pagado</button>` : ''}
      </div>
    </div>
  `).join('');
}

function renderUsuarios(){
  const container = document.getElementById('usuariosList');
  if(!container) return;

  const query = (document.getElementById('usuarioSearch')?.value || '').toLowerCase();
  const list = usuarios.filter(u =>
    (u.nombre_completo || '').toLowerCase().includes(query) ||
    (u.username || '').toLowerCase().includes(query)
  );

  if(!list.length){
    container.innerHTML = '<div class="empty-state glass">No hay usuarios registrados.</div>';
    return;
  }

  container.innerHTML = list.map(u => `
    <div class="ticket glass ${u.estado === 'inactivo' ? 'is-returned' : ''}">
      <div class="edge ${u.estado === 'activo' ? 'on-time' : 'returned'}"></div>
      <div class="ticket-main">
        <div class="title">${u.nombre_completo}</div>
        <div class="sub">Usuario: ${u.username} · Turno: ${u.turno}</div>
        <span class="badge">${rolLabel(u.rol)}</span>
      </div>
      <div class="ticket-stub">
        <span class="status-chip ${u.estado === 'activo' ? 'on-time' : 'returned'}">${u.estado === 'activo' ? 'Activo' : 'Inactivo'}</span>
        <button class="action-link" onclick="toggleEstadoUsuario(${u.id}, '${u.estado}')">${u.estado === 'activo' ? 'Desactivar' : 'Activar'}</button>
      </div>
    </div>
  `).join('');
}

function renderAll(){
  renderHome();
  renderLoans();
  renderBooks();
  renderMembers();
  renderSanciones();
  renderUsuarios();
}

checkSession();
console.log('Firebase está conectado');