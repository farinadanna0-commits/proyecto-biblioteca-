// ---------- Usuario Administrador ----------
const ADMIN_USER = 'enzo';
const ADMIN_PASS = 'enzo123';

function doLogin(evt){
  if(evt) evt.preventDefault();
  const user = document.getElementById('f-login-user').value.trim();
  const pass = document.getElementById('f-login-pass').value;
  const errorEl = document.getElementById('loginError');

  if(user === ADMIN_USER && pass === ADMIN_PASS){
    sessionStorage.setItem('lib_session', 'ok');
    errorEl.textContent = '';
    showApp();
  } else {
    errorEl.textContent = 'Usuario o contraseña incorrectos';
  }
}

function doLogout(evt){
  if(evt) evt.preventDefault();
  sessionStorage.removeItem('lib_session');
  document.getElementById('f-login-user').value = '';
  document.getElementById('f-login-pass').value = '';
  document.getElementById('appContent').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
}

function showApp(){
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appContent').style.display = 'block';
  renderAll();
}

function checkSession(){
  if(sessionStorage.getItem('lib_session') === 'ok'){
    showApp();
  } else {
    document.getElementById('loginScreen').style.display = 'flex';
  }
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

// ---------- Base de Datos (LocalStorage) ----------
let loans = JSON.parse(localStorage.getItem('lib_loans')) || [];
let books = JSON.parse(localStorage.getItem('lib_books')) || [
  {id: 1, title: 'Cien años de soledad', author: 'Gabriel García Márquez', genre: 'Realismo Mágico', isbn: '978-0307474728', copies: 3},
  {id: 2, title: 'Rayuela', author: 'Julio Cortázar', genre: 'Novela', isbn: '978-8437604572', copies: 2}
];
let members = JSON.parse(localStorage.getItem('lib_members')) || [
  {id: 1, name: 'Carlos Gómez', dni: '38901234', phone: '555-0192', email: 'carlos@mail.com', tipo: 'maestro', course: '', subject: 'Historia'},
  {id: 2, name: 'Lucía Fernández', dni: '40123456', phone: '555-0143', email: 'lucia@mail.com', tipo: 'alumno', course: '4° Año A', subject: ''}
];

let activeLoanFilter = 'todos';
let activeMemberFilter = 'todos';
let selectedMemberType = 'alumno';

function persist(){
  localStorage.setItem('lib_loans', JSON.stringify(loans));
  localStorage.setItem('lib_books', JSON.stringify(books));
  localStorage.setItem('lib_members', JSON.stringify(members));
  renderAll();
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
  if(loan.returned) return 'returned';
  const diff = daysBetween(todayISO(), loan.due);
  if(diff < 0) return 'overdue';
  if(diff <= 3) return 'due-soon';
  return 'on-time';
}

function statusLabel(s, loan){
  if(s === 'returned') return 'Devuelto';
  if(s === 'overdue'){
    const d = Math.abs(daysBetween(todayISO(), loan.due));
    return `${d}d tarde`;
  }
  if(s === 'due-soon') return 'Por vencer';
  return 'Activo';
}

// ---------- Navegación ----------
function switchTab(tabId, evt){
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  if(evt && evt.target) evt.target.classList.add('active');
  document.getElementById(`tab-${tabId}`).classList.add('active');
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

  bookSel.innerHTML = books.length ? books.map(b => `<option value="${b.id}">${b.title} (${b.author})</option>`).join('') : '<option value="">No hay libros guardados</option>';
  memberSel.innerHTML = members.length ? members.map(m => `<option value="${m.id}">${tipoLabel(m.tipo)} — ${m.name} (DNI: ${m.dni})</option>`).join('') : '<option value="">No hay socios guardados</option>';
}

// ---------- Tipo de Socio (Alumno / Maestro) ----------
function tipoLabel(tipo){ return tipo === 'maestro' ? 'Maestro' : 'Alumno'; }

function setMemberType(tipo){
  selectedMemberType = tipo;
  document.getElementById('typeBtn-alumno').classList.toggle('active', tipo === 'alumno');
  document.getElementById('typeBtn-maestro').classList.toggle('active', tipo === 'maestro');
  document.getElementById('field-member-extra-alumno').style.display = tipo === 'alumno' ? 'flex' : 'none';
  document.getElementById('field-member-extra-maestro').style.display = tipo === 'maestro' ? 'flex' : 'none';
}

// ---------- Operaciones Guardar ----------
function saveLoan(){
  const bookId = document.getElementById('f-loan-book').value;
  const memberId = document.getElementById('f-loan-member').value;
  const start = document.getElementById('f-loan-start').value;
  const due = document.getElementById('f-loan-due').value;

  if(!bookId || !memberId || !due){ showToast('Completá todos los campos del préstamo', 'danger'); return; }

  const book = books.find(b => b.id == bookId);
  const member = members.find(m => m.id == memberId);

  loans.push({
    id: Date.now(),
    bookTitle: book ? book.title : 'Libro desconocido',
    bookAuthor: book ? book.author : '',
    borrower: member ? member.name : 'Socio desconocido',
    start, due, returned: false
  });

  persist();
  closeModal('modalLoan');
  showToast('Préstamo registrado correctamente', 'success');
}

function saveBook(){
  const title = document.getElementById('f-book-title').value.trim();
  const author = document.getElementById('f-book-author').value.trim();
  const genre = document.getElementById('f-book-genre').value.trim();
  const isbn = document.getElementById('f-book-isbn').value.trim();
  const copies = parseInt(document.getElementById('f-book-copies').value) || 1;

  if(!title){ showToast('Ingresá al menos el título del libro', 'danger'); return; }

  books.push({ id: Date.now(), title, author, genre, isbn, copies });
  persist();
  closeModal('modalBook');
  document.querySelectorAll('#modalBook input').forEach(i => i.value = '');
  showToast('Libro añadido al catálogo', 'success');
}

function saveMember(){
  const name = document.getElementById('f-member-name').value.trim();
  const dni = document.getElementById('f-member-dni').value.trim();
  const phone = document.getElementById('f-member-phone').value.trim();
  const email = document.getElementById('f-member-email').value.trim();
  const tipo = selectedMemberType;
  const course = document.getElementById('f-member-course').value.trim();
  const subject = document.getElementById('f-member-subject').value.trim();

  if(!name || !dni){ showToast('Ingresá nombre y DNI del socio', 'danger'); return; }

  members.push({ id: Date.now(), name, dni, phone, email, tipo, course, subject });
  persist();
  closeModal('modalMember');
  document.querySelectorAll('#modalMember input').forEach(i => i.value = '');
  setMemberType('alumno');
  showToast(`${tipoLabel(tipo)} registrado correctamente`, 'success');
}

// ---------- Acciones sobre préstamos ----------
function toggleReturnLoan(id){
  const l = loans.find(x => x.id == id);
  if(!l) return;
  l.returned = !l.returned;
  l.returnedOn = l.returned ? todayISO() : null;
  persist();
  showToast(l.returned ? 'Préstamo marcado como devuelto' : 'Préstamo reabierto', l.returned ? 'success' : 'info');
}

function deleteLoan(id){
  loans = loans.filter(x => x.id != id);
  persist();
  showToast('Préstamo eliminado', 'danger');
}

function deleteBook(id){
  books = books.filter(x => x.id != id);
  persist();
  showToast('Libro eliminado del catálogo', 'danger');
}

function deleteMember(id){
  members = members.filter(x => x.id != id);
  persist();
  showToast('Socio eliminado', 'danger');
}

// ---------- Renders / Renderizado ----------
function renderHome(){
  const activeCount = loans.filter(l => !l.returned).length;
  const overdueCount = loans.filter(l => statusOf(l) === 'overdue').length;

  document.getElementById('dashActiveLoans').textContent = activeCount;
  document.getElementById('dashOverdueLoans').textContent = overdueCount;
  document.getElementById('dashTotalBooks').textContent = books.length;
  document.getElementById('dashTotalMembers').textContent = members.length;

  const urgentLoans = loans.filter(l => !l.returned && (statusOf(l) === 'overdue' || statusOf(l) === 'due-soon'));
  const container = document.getElementById('homeRecentLoans');

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
    list = list.filter(l => l.bookTitle.toLowerCase().includes(query) || l.borrower.toLowerCase().includes(query));
  }

  const container = document.getElementById('loansList');
  if(!list.length){
    container.innerHTML = '<div class="empty-state glass">No se encontraron préstamos.</div>';
    return;
  }
  container.innerHTML = list.map(l => renderTicketHtml(l)).join('');
}

function renderTicketHtml(l){
  const s = statusOf(l);
  return `
    <div class="ticket glass ${s === 'returned' ? 'is-returned' : ''}">
      <div class="edge ${s}"></div>
      <div class="ticket-main">
        <div class="title">${l.bookTitle}</div>
        <div class="sub">Prestado a: <strong>${l.borrower}</strong></div>
        <span class="badge">Inicio: ${formatDate(l.start)}</span>
      </div>
      <div class="ticket-stub">
        <span class="status-chip ${s}">${statusLabel(s, l)}</span>
        <div class="mono" style="font-weight:600; font-size:0.85rem;">${formatDate(l.due)}</div>
        <button class="action-link" onclick="toggleReturnLoan(${l.id})">${l.returned ? 'Reabrir' : 'Devolver'}</button>
        <button class="action-link danger" onclick="deleteLoan(${l.id})">Eliminar</button>
      </div>
    </div>
  `;
}

function renderBooks(){
  const query = (document.getElementById('bookSearch')?.value || '').toLowerCase();
  const list = books.filter(b => b.title.toLowerCase().includes(query) || b.author.toLowerCase().includes(query) || (b.isbn || '').includes(query));

  const container = document.getElementById('booksList');
  if(!list.length){
    container.innerHTML = '<div class="empty-state glass">No hay libros registrados en el catálogo.</div>';
    return;
  }

  container.innerHTML = list.map(b => `
    <div class="ticket glass">
      <div class="edge on-time"></div>
      <div class="ticket-main">
        <div class="title">${b.title}</div>
        <div class="sub">Autor: ${b.author || 'Desconocido'} | Género: ${b.genre || 'N/A'}</div>
        <span class="badge">ISBN: ${b.isbn || 'Sin ISBN'}</span>
      </div>
      <div class="ticket-stub">
        <span class="badge mono">${b.copies} cpy</span>
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
  let list = members.filter(m => m.name.toLowerCase().includes(query) || m.dni.includes(query) || (m.email || '').toLowerCase().includes(query));
  if(activeMemberFilter !== 'todos') list = list.filter(m => (m.tipo || 'alumno') === activeMemberFilter);

  const container = document.getElementById('membersList');
  if(!list.length){
    container.innerHTML = '<div class="empty-state glass">No se encontraron socios registrados.</div>';
    return;
  }

  container.innerHTML = list.map(m => {
    const tipo = m.tipo || 'alumno';
    const extra = tipo === 'maestro' ? (m.subject ? `Materia: ${m.subject}` : 'Maestro') : (m.course ? `Curso: ${m.course}` : 'Alumno');
    return `
    <div class="ticket glass">
      <div class="edge ${tipo === 'maestro' ? 'due-soon' : 'on-time'}"></div>
      <div class="ticket-main">
        <div class="title">${m.name}</div>
        <div class="sub">DNI: ${m.dni} | Tel: ${m.phone || 'S/N'}</div>
        <span class="badge">${tipoLabel(tipo)}</span>
        <span class="badge" style="margin-left:6px;">${extra}</span>
      </div>
      <div class="ticket-stub">
        <span class="badge mono">${m.email || 'Sin correo'}</span>
        <button class="action-link danger" onclick="deleteMember(${m.id})">Eliminar</button>
      </div>
    </div>
  `;
  }).join('');
}

function renderAll(){
  renderHome();
  renderLoans();
  renderBooks();
  renderMembers();
}

checkSession();