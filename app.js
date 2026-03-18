
const DATA_URL = './data/students.json';
const CONFIG_URL = './data/config.json';
const LS_KEYS = {
  grades: 'biotec_grades_v1',
  subjects: 'biotec_subjects_v1',
  settings: 'biotec_accessibility_v1',
  teachers: 'biotec_teachers_v1'
};

const state = {
  roster: [],
  courses: [],
  config: null,
  selectedStudent: null,
  activeStudentSemester: '1',
  currentUser: null,
  currentCourse: '',
  currentSemester: '1',
  currentSubject: '',
  grades: loadJSON(LS_KEYS.grades, {}),
  subjects: loadJSON(LS_KEYS.subjects, {}),
  extraTeachers: loadJSON(LS_KEYS.teachers, [])
};

const els = {};

init();

async function init(){
  cacheDom();
  await loadData();
  hydrateAccessibility();
  bindGeneralEvents();
  populateCourseFilters();
  renderHero();
  showToast('Sitio cargado correctamente.');
}

function cacheDom(){
  const ids = [
    'datasetBadge','heroStats','studentCourseFilter','studentQuery','studentLookupBtn','studentLookupResults','studentView',
    'teacherWorkspace','teacherCourse','teacherSemester','teacherSubject','teacherStudentFilter','teacherTableBody',
    'avgProc','avgAct','avgFinal','dashboardSummary','barChart','distributionChart','loginForm','loginEmail','loginPassword',
    'sessionTitle','sessionMeta','logoutBtn','globalSearch','globalSearchBtn','accessibilityBtn','accessibilityPanel',
    'backupExportBtn','backupImportInput','teacherAccountForm','teacherAccountList','accountManager','teacherCourseMeta',
    'addSubjectBtn','addSubjectDialog','newSubjectName','saveSubjectDialogBtn'
  ];
  ids.forEach(id => els[id] = document.getElementById(id));
}

async function loadData(){
  const [dataRes, configRes] = await Promise.all([fetch(DATA_URL), fetch(CONFIG_URL)]);
  const data = await dataRes.json();
  const config = await configRes.json();
  state.roster = data.students || [];
  state.courses = data.courses || [];
  state.config = config;
  els.datasetBadge.textContent = `${data.meta.studentCount} estudiantes · ${data.meta.courseCount} cursos cargados desde nómina oficial`;
}

function renderHero(){
  const countsByCourse = state.courses.length;
  const totalTeachers = getTeacherAccounts().length;
  const withEmail = state.roster.filter(s => s.email).length;
  const stats = [
    ['Estudiantes', state.roster.length],
    ['Cursos 2026', countsByCourse],
    ['Correos cargados', withEmail],
    ['Docentes habilitados', totalTeachers]
  ];
  els.heroStats.innerHTML = stats.map(([label, value]) => `
    <div class="stat-card">
      <strong>${value}</strong>
      <span>${label}</span>
    </div>
  `).join('');
}

function bindGeneralEvents(){
  document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  document.querySelectorAll('[data-open]').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.open)));
  els.studentLookupBtn.addEventListener('click', runStudentLookup);
  els.studentQuery.addEventListener('keydown', e => { if(e.key === 'Enter') runStudentLookup(); });
  els.studentCourseFilter.addEventListener('change', runStudentLookup);
  els.loginForm.addEventListener('submit', handleLogin);
  els.teacherCourse.addEventListener('change', () => { state.currentCourse = els.teacherCourse.value; refreshTeacherWorkspace(); });
  els.teacherSemester.addEventListener('change', () => { state.currentSemester = els.teacherSemester.value; refreshTeacherWorkspace(); });
  els.teacherSubject.addEventListener('change', () => { state.currentSubject = els.teacherSubject.value; refreshTeacherWorkspace(); });
  els.teacherStudentFilter.addEventListener('input', refreshTeacherTable);
  els.logoutBtn.addEventListener('click', logout);
  els.globalSearchBtn.addEventListener('click', () => quickSearch(els.globalSearch.value));
  els.globalSearch.addEventListener('keydown', e => { if(e.key === 'Enter') quickSearch(els.globalSearch.value); });
  els.accessibilityBtn.addEventListener('click', toggleAccessibilityPanel);
  els.backupExportBtn.addEventListener('click', exportBackup);
  els.backupImportInput.addEventListener('change', importBackup);
  els.addSubjectBtn.addEventListener('click', () => els.addSubjectDialog.showModal());
  els.saveSubjectDialogBtn.addEventListener('click', saveNewSubject);
  els.teacherAccountForm?.addEventListener('submit', saveTeacherAccount);

  document.querySelectorAll('#accessibilityPanel button').forEach(btn => {
    btn.addEventListener('click', () => handleAccessibilityAction(btn.dataset.action));
  });
}

function populateCourseFilters(){
  const options = ['<option value="">Todos los cursos</option>']
    .concat(state.courses.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`));
  els.studentCourseFilter.innerHTML = options.join('');
  els.teacherCourse.innerHTML = state.courses.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  state.currentCourse = state.courses[0] || '';
  els.teacherCourse.value = state.currentCourse;
  refreshTeacherWorkspace();
}

function switchTab(tab){
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tab}`));
  if(tab === 'teacher'){ document.getElementById('loginEmail').focus(); }
}

function runStudentLookup(){
  const q = normalize(els.studentQuery.value);
  const course = els.studentCourseFilter.value;
  let results = state.roster.filter(s => {
    const haystack = [s.rut, s.email, s.apellidoPaterno, s.apellidoMaterno, s.nombres, s.nombreCompleto, s.curso].join(' ');
    const matchQuery = !q || normalize(haystack).includes(q);
    const matchCourse = !course || s.curso === course;
    return matchQuery && matchCourse;
  }).slice(0, 40);

  if(!q && !course){
    results = [];
    els.studentLookupResults.innerHTML = '';
    els.studentView.innerHTML = '<p>Ingresa un criterio de búsqueda para ver resultados.</p>';
    els.studentView.className = 'student-view empty-state';
    return;
  }

  els.studentLookupResults.innerHTML = results.length ? results.map(student => `
    <button class="result-item" data-rut="${escapeHtml(student.rut)}">
      <strong>${escapeHtml(student.nombreCompleto)}</strong>
      <small>${escapeHtml(student.curso)} · ${escapeHtml(student.rut)} · ${escapeHtml(student.email || 'sin correo')}</small>
    </button>
  `).join('') : '<div class="empty-state">No se encontraron estudiantes con ese criterio.</div>';

  els.studentLookupResults.querySelectorAll('.result-item').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedStudent = state.roster.find(s => s.rut === btn.dataset.rut);
      state.activeStudentSemester = '1';
      renderStudentView();
    });
  });

  if(results.length === 1){
    state.selectedStudent = results[0];
    state.activeStudentSemester = '1';
    renderStudentView();
  }
}

function renderStudentView(){
  const student = state.selectedStudent;
  if(!student){
    els.studentView.innerHTML = '<p>Selecciona un estudiante para ver la información.</p>';
    els.studentView.className = 'student-view empty-state';
    return;
  }

  const subjects = getSubjectsForCourse(student.curso);
  const semester = state.activeStudentSemester;
  const rows = subjects.map(subject => {
    const g = getGrade(student.rut, student.curso, semester, subject);
    const final = computeFinal(g);
    return { subject, ...g, final };
  });
  const avgProc = average(rows.map(r => r.procedimental));
  const avgAct = average(rows.map(r => r.actitudinal));
  const avgFinal = average(rows.map(r => r.final));

  els.studentView.className = 'student-view';
  els.studentView.innerHTML = `
    <div class="student-head">
      <div>
        <h4>${escapeHtml(student.nombreCompleto)}</h4>
        <div class="student-meta">
          <span>${escapeHtml(student.curso)}</span>
          <span>${escapeHtml(student.rut)}</span>
          <span>${escapeHtml(student.email || 'Sin correo')}</span>
          <span>${escapeHtml(student.estado || 'Sin estado')}</span>
        </div>
      </div>
      <span class="badge">${student.pie ? 'PIE' : 'Seguimiento general'}</span>
    </div>

    <div class="semester-switch">
      <button class="semester-btn ${semester === '1' ? 'active' : ''}" data-sem="1">1° semestre</button>
      <button class="semester-btn ${semester === '2' ? 'active' : ''}" data-sem="2">2° semestre</button>
    </div>

    <div class="summary-strip">
      <div class="mini-stat"><span>Promedio procedimental</span><strong>${formatGrade(avgProc)}</strong></div>
      <div class="mini-stat"><span>Promedio actitudinal</span><strong>${formatGrade(avgAct)}</strong></div>
      <div class="mini-stat"><span>Promedio final</span><strong>${formatGrade(avgFinal)}</strong></div>
    </div>

    <div class="grade-grid">
      ${rows.map(r => `
        <article class="grade-card">
          <h5>${escapeHtml(r.subject)}</h5>
          <div>Procedimental: <strong>${formatGrade(r.procedimental)}</strong></div>
          <div>Actitudinal: <strong>${formatGrade(r.actitudinal)}</strong></div>
          <div>Promedio: <strong>${formatGrade(r.final)}</strong></div>
          <p>${escapeHtml(r.observation || 'Sin observaciones registradas.')}</p>
        </article>
      `).join('')}
    </div>
  `;

  els.studentView.querySelectorAll('.semester-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeStudentSemester = btn.dataset.sem;
      renderStudentView();
    });
  });
}

function handleLogin(e){
  e.preventDefault();
  const email = els.loginEmail.value.trim().toLowerCase();
  const password = els.loginPassword.value;
  const account = getTeacherAccounts().find(acc => acc.email.toLowerCase() === email && acc.password === password);

  if(!account){
    showToast('Credenciales no válidas.');
    return;
  }

  state.currentUser = account;
  els.teacherWorkspace.classList.remove('hidden');
  els.sessionTitle.textContent = `${account.name} · ${account.role === 'admin' ? 'UTP / Admin' : 'Profesor'}`;
  els.sessionMeta.textContent = `Curso inicial: ${state.currentCourse || 'sin curso'} · Semestre ${state.currentSemester}`;
  els.accountManager.classList.toggle('hidden', account.role !== 'admin');
  renderTeacherAccounts();
  refreshTeacherWorkspace();
  switchTab('teacher');
  window.scrollTo({ top: els.teacherWorkspace.offsetTop - 20, behavior: 'smooth' });
  showToast(`Sesión iniciada como ${account.name}.`);
}

function logout(){
  state.currentUser = null;
  els.teacherWorkspace.classList.add('hidden');
  els.loginForm.reset();
  showToast('Sesión cerrada.');
}

function refreshTeacherWorkspace(){
  if(!state.currentCourse){
    els.teacherTableBody.innerHTML = '<tr><td colspan="7">No hay curso seleccionado.</td></tr>';
    return;
  }
  const subjects = getSubjectsForCourse(state.currentCourse);
  els.teacherSubject.innerHTML = subjects.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  state.currentSubject = subjects.includes(state.currentSubject) ? state.currentSubject : subjects[0];
  els.teacherSubject.value = state.currentSubject;
  els.teacherCourseMeta.textContent = `${state.currentCourse} · ${state.currentSubject} · ${state.currentSemester}° semestre`;
  refreshTeacherTable();
  renderDashboard();
}

function refreshTeacherTable(){
  const roster = state.roster.filter(s => s.curso === state.currentCourse);
  const q = normalize(els.teacherStudentFilter.value);
  const filtered = roster.filter(s => !q || normalize([s.rut, s.email, s.nombreCompleto].join(' ')).includes(q));

  if(!filtered.length){
    els.teacherTableBody.innerHTML = '<tr><td colspan="7">No hay estudiantes para mostrar con este filtro.</td></tr>';
    updateTeacherAverages([]);
    return;
  }

  const rows = filtered.map(student => {
    const grade = getGrade(student.rut, state.currentCourse, state.currentSemester, state.currentSubject);
    const final = computeFinal(grade);
    return { student, grade, final };
  });

  els.teacherTableBody.innerHTML = rows.map(({ student, grade, final }) => `
    <tr data-rut="${escapeHtml(student.rut)}">
      <td>
        <strong>${escapeHtml(student.nombreCompleto)}</strong><br>
        <small>${escapeHtml(student.estado || '')}</small>
      </td>
      <td>${escapeHtml(student.rut)}</td>
      <td>${escapeHtml(student.email || '—')}</td>
      <td><input type="number" min="1" max="7" step="0.1" value="${grade.procedimental ?? ''}" data-field="procedimental"></td>
      <td><input type="number" min="1" max="7" step="0.1" value="${grade.actitudinal ?? ''}" data-field="actitudinal"></td>
      <td><span class="badge">${formatGrade(final)}</span></td>
      <td><textarea data-field="observation" placeholder="Observaciones">${escapeHtml(grade.observation || '')}</textarea></td>
    </tr>
  `).join('');

  els.teacherTableBody.querySelectorAll('input, textarea').forEach(input => {
    input.addEventListener('change', e => {
      const row = e.target.closest('tr');
      const rut = row.dataset.rut;
      const field = e.target.dataset.field;
      saveGradeField(rut, state.currentCourse, state.currentSemester, state.currentSubject, field, e.target.value);
      refreshTeacherTable();
      if(state.selectedStudent && state.selectedStudent.rut === rut){ renderStudentView(); }
    });
  });

  updateTeacherAverages(rows);
}

function renderDashboard(){
  const courseStudents = state.roster.filter(s => s.curso === state.currentCourse);
  const allSubjects = getSubjectsForCourse(state.currentCourse);
  const semester = state.currentSemester;
  const subjectStats = allSubjects.map(subject => {
    const finals = courseStudents.map(s => computeFinal(getGrade(s.rut, state.currentCourse, semester, subject))).filter(Boolean);
    return { subject, average: average(finals), count: finals.length };
  }).filter(s => s.count > 0);

  const selectedFinals = courseStudents.map(s => computeFinal(getGrade(s.rut, state.currentCourse, semester, state.currentSubject))).filter(Boolean);

  els.dashboardSummary.innerHTML = [
    ['Estudiantes del curso', courseStudents.length],
    ['Asignaturas configuradas', allSubjects.length],
    ['Asignatura seleccionada', state.currentSubject],
    ['Registros con nota', selectedFinals.length]
  ].map(([k, v]) => `<div class="stats-row"><span>${escapeHtml(String(k))}</span><strong>${escapeHtml(String(v))}</strong></div>`).join('');

  els.barChart.innerHTML = subjectStats.length ? subjectStats.map(s => `
    <div class="bar-row">
      <div class="bar-label"><span>${escapeHtml(s.subject)}</span><strong>${formatGrade(s.average)}</strong></div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, (Number(s.average || 0) / 7) * 100)}%"></div></div>
    </div>
  `).join('') : '<div class="empty-state">Aún no hay datos suficientes para graficar.</div>';

  const buckets = { '1.0–3.9':0, '4.0–4.9':0, '5.0–5.9':0, '6.0–7.0':0 };
  selectedFinals.forEach(value => {
    if(value < 4) buckets['1.0–3.9']++;
    else if(value < 5) buckets['4.0–4.9']++;
    else if(value < 6) buckets['5.0–5.9']++;
    else buckets['6.0–7.0']++;
  });

  els.distributionChart.innerHTML = `
    <div class="distribution-grid">
      ${Object.entries(buckets).map(([label, value]) => `
        <div class="dist-box">
          <strong>${value}</strong>
          <div>${label}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function updateTeacherAverages(rows){
  const proc = rows.map(r => Number(r.grade.procedimental)).filter(v => !Number.isNaN(v));
  const act = rows.map(r => Number(r.grade.actitudinal)).filter(v => !Number.isNaN(v));
  const finals = rows.map(r => r.final).filter(Boolean);
  els.avgProc.textContent = formatGrade(average(proc));
  els.avgAct.textContent = formatGrade(average(act));
  els.avgFinal.textContent = formatGrade(average(finals));
}

function getSubjectsForCourse(course){
  const custom = state.subjects[course];
  if(Array.isArray(custom) && custom.length) return custom;
  const lc = normalize(course);
  if(lc.includes('basico')) return [
    'Lenguaje y Comunicación','Matemática','Ciencias Naturales','Historia y Geografía','Inglés',
    'Tecnología','Artes Visuales','Música','Educación Física','Orientación','Religión'
  ];
  if(lc.includes('3') || lc.includes('4') || lc.includes('medio')) return [
    'Lengua y Literatura','Matemática','Biología','Física','Química','Historia',
    'Inglés','Filosofía','Educación Ciudadana','Tecnología','Educación Física'
  ];
  return ['Lenguaje','Matemática','Ciencias','Historia','Inglés','Tecnología'];
}

function saveNewSubject(){
  const name = els.newSubjectName.value.trim();
  if(!name || !state.currentCourse) return;
  const list = getSubjectsForCourse(state.currentCourse);
  if(!list.includes(name)) {
    state.subjects[state.currentCourse] = [...list, name];
    persist(LS_KEYS.subjects, state.subjects);
    refreshTeacherWorkspace();
    showToast(`Asignatura "${name}" agregada.`);
  }
  els.newSubjectName.value = '';
}

function getGrade(rut, course, semester, subject){
  return state.grades?.[course]?.[semester]?.[subject]?.[rut] || { procedimental:'', actitudinal:'', observation:'' };
}

function saveGradeField(rut, course, semester, subject, field, value){
  state.grades[course] ??= {};
  state.grades[course][semester] ??= {};
  state.grades[course][semester][subject] ??= {};
  state.grades[course][semester][subject][rut] ??= { procedimental:'', actitudinal:'', observation:'' };

  const cleanValue = field === 'observation' ? value : clampGrade(value);
  state.grades[course][semester][subject][rut][field] = cleanValue;
  persist(LS_KEYS.grades, state.grades);
}

function renderTeacherAccounts(){
  const accounts = getTeacherAccounts();
  els.teacherAccountList.innerHTML = accounts.map(acc => `
    <div class="account-item">
      <div>
        <strong>${escapeHtml(acc.name)}</strong>
        <div>${escapeHtml(acc.email)}</div>
      </div>
      <span class="badge">${acc.role === 'admin' ? 'UTP / Admin' : 'Profesor'}</span>
    </div>
  `).join('');
}

function saveTeacherAccount(e){
  e.preventDefault();
  const name = document.getElementById('newTeacherName').value.trim();
  const email = document.getElementById('newTeacherEmail').value.trim().toLowerCase();
  const password = document.getElementById('newTeacherPassword').value.trim();
  const role = document.getElementById('newTeacherRole').value;
  if(!name || !email || !password) return;
  state.extraTeachers.push({ name, email, password, role });
  persist(LS_KEYS.teachers, state.extraTeachers);
  e.target.reset();
  renderTeacherAccounts();
  renderHero();
  showToast('Profesor agregado localmente.');
}

function getTeacherAccounts(){
  return [...(state.config?.teacherAccounts || []), ...state.extraTeachers];
}

function exportBackup(){
  const blob = new Blob([JSON.stringify({
    exportedAt: new Date().toISOString(),
    grades: state.grades,
    subjects: state.subjects,
    extraTeachers: state.extraTeachers
  }, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `biotec_respaldo_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importBackup(e){
  const file = e.target.files?.[0];
  if(!file) return;
  try{
    const text = await file.text();
    const data = JSON.parse(text);
    if(data.grades) state.grades = data.grades;
    if(data.subjects) state.subjects = data.subjects;
    if(data.extraTeachers) state.extraTeachers = data.extraTeachers;
    persist(LS_KEYS.grades, state.grades);
    persist(LS_KEYS.subjects, state.subjects);
    persist(LS_KEYS.teachers, state.extraTeachers);
    renderTeacherAccounts();
    refreshTeacherWorkspace();
    if(state.selectedStudent) renderStudentView();
    showToast('Respaldo importado correctamente.');
  }catch{
    showToast('No se pudo importar el respaldo.');
  }finally{
    e.target.value = '';
  }
}

function quickSearch(query){
  els.studentQuery.value = query;
  switchTab('student');
  runStudentLookup();
  window.scrollTo({ top: 0, behavior:'smooth' });
}

function toggleAccessibilityPanel(){
  const hidden = els.accessibilityPanel.classList.toggle('hidden');
  els.accessibilityPanel.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  els.accessibilityBtn.setAttribute('aria-expanded', hidden ? 'false' : 'true');
}

function handleAccessibilityAction(action){
  const html = document.documentElement;
  const currentScale = Number(getComputedStyle(html).getPropertyValue('--font-scale')) || 1;
  if(action === 'home') window.scrollTo({ top:0, behavior:'smooth' });
  if(action === 'theme') html.dataset.theme = html.dataset.theme === 'light' ? 'dark' : 'light';
  if(action === 'contrast') html.classList.toggle('high-contrast');
  if(action === 'font-up') html.style.setProperty('--font-scale', Math.min(1.35, currentScale + 0.05));
  if(action === 'font-down') html.style.setProperty('--font-scale', Math.max(0.9, currentScale - 0.05));
  if(action === 'find') els.globalSearch.focus();
  if(action === 'narrator'){
    const text = document.body.innerText.slice(0, 1800);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-CL';
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }
  persistAccessibility();
}

function hydrateAccessibility(){
  const saved = loadJSON(LS_KEYS.settings, null);
  if(!saved) return;
  const html = document.documentElement;
  if(saved.theme) html.dataset.theme = saved.theme;
  if(saved.contrast) html.classList.add('high-contrast');
  if(saved.fontScale) html.style.setProperty('--font-scale', saved.fontScale);
}

function persistAccessibility(){
  const html = document.documentElement;
  persist(LS_KEYS.settings, {
    theme: html.dataset.theme,
    contrast: html.classList.contains('high-contrast'),
    fontScale: html.style.getPropertyValue('--font-scale') || '1'
  });
}

function average(values){
  const clean = values.map(Number).filter(v => !Number.isNaN(v));
  if(!clean.length) return null;
  return clean.reduce((a,b)=>a+b,0) / clean.length;
}

function computeFinal(grade){
  const p = Number(grade?.procedimental);
  const a = Number(grade?.actitudinal);
  if(Number.isNaN(p) && Number.isNaN(a)) return null;
  if(Number.isNaN(p)) return round1(a);
  if(Number.isNaN(a)) return round1(p);
  return round1((p + a) / 2);
}

function clampGrade(value){
  const num = Number(value);
  if(Number.isNaN(num)) return '';
  return Math.max(1, Math.min(7, round1(num)));
}

function round1(n){ return Math.round(n * 10) / 10; }

function formatGrade(value){
  return value === null || value === undefined || value === '' || Number.isNaN(Number(value)) ? '—' : Number(value).toFixed(1);
}

function persist(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
function loadJSON(key, fallback){
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function normalize(text){
  return String(text || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim();
}

function escapeHtml(text){
  return String(text ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}

function showToast(message){
  const old = document.querySelector('.toast');
  if(old) old.remove();
  const div = document.createElement('div');
  div.className = 'toast';
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2200);
}
