
const DATA_URL = './data/students.json';
const CONFIG_URL = './data/config.json';

const LS_KEYS = {
  grades: 'biotec_grades_v2',
  subjects: 'biotec_subjects_v2',
  settings: 'biotec_accessibility_v2',
  teachers: 'biotec_teachers_v2',
  assessments: 'biotec_assessment_configs_v2'
};

const DEFAULT_ASSESSMENTS = [
  { id:'prueba1', name:'Prueba 1', weight:20, requirement:60, totalPoints:40 },
  { id:'prueba2', name:'Prueba 2', weight:20, requirement:60, totalPoints:40 },
  { id:'prueba3', name:'Prueba 3', weight:20, requirement:60, totalPoints:40 },
  { id:'prueba4', name:'Prueba 4', weight:20, requirement:60, totalPoints:40 },
  { id:'prueba5', name:'Prueba 5', weight:20, requirement:60, totalPoints:40 }
];

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
  extraTeachers: loadJSON(LS_KEYS.teachers, []),
  assessmentConfigs: loadJSON(LS_KEYS.assessments, {})
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
    'avgProc','avgAct','avgAcademic','avgIntegral','dashboardSummary','barChart','distributionChart','approvalChart',
    'loginForm','loginEmail','loginPassword','sessionTitle','sessionMeta','logoutBtn','globalSearch','globalSearchBtn',
    'accessibilityBtn','accessibilityPanel','backupExportBtn','backupImportInput','teacherAccountForm',
    'teacherAccountList','accountManager','teacherCourseMeta','addSubjectBtn','addSubjectDialog','newSubjectName',
    'saveSubjectDialogBtn','teacherTableHead','assessmentConfigBody','weightSummary','assessmentMeta','resetAssessmentsBtn'
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
  const stats = [
    ['Estudiantes', state.roster.length],
    ['Cursos 2026', state.courses.length],
    ['Correos cargados', state.roster.filter(s => s.email).length],
    ['Docentes habilitados', getTeacherAccounts().length]
  ];
  els.heroStats.innerHTML = stats.map(([label, value]) => `
    <div class="stat-card">
      <strong>${escapeHtml(String(value))}</strong>
      <span>${escapeHtml(label)}</span>
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
  els.resetAssessmentsBtn?.addEventListener('click', resetAssessmentConfig);

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
  if(tab === 'teacher') els.loginEmail.focus();
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
  const rows = subjects.map(subject => buildStudentSubjectRow(student, subject, semester));
  const avgAcademic = average(rows.map(r => r.academicAverage));
  const avgProc = average(rows.map(r => r.procedimental));
  const avgAct = average(rows.map(r => r.actitudinal));
  const avgIntegral = average(rows.map(r => r.integralAverage));

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
      <div class="mini-stat"><span>Promedio académico</span><strong>${formatGrade(avgAcademic)}</strong></div>
      <div class="mini-stat"><span>Promedio procedimental</span><strong>${formatGrade(avgProc)}</strong></div>
      <div class="mini-stat"><span>Promedio actitudinal</span><strong>${formatGrade(avgAct)}</strong></div>
      <div class="mini-stat"><span>Promedio integral</span><strong>${formatGrade(avgIntegral)}</strong></div>
    </div>

    <div class="subject-stack">
      ${rows.map(row => `
        <article class="subject-card">
          <div class="subject-head">
            <div>
              <h4>${escapeHtml(row.subject)}</h4>
              <div class="subject-metrics">
                <span class="badge neutral">Académico: ${formatGrade(row.academicAverage)}</span>
                <span class="badge neutral">Procedimental: ${formatGrade(row.procedimental)}</span>
                <span class="badge neutral">Actitudinal: ${formatGrade(row.actitudinal)}</span>
                <span class="badge ${Number(row.integralAverage) >= 4 ? 'ok' : 'warn'}">Integral: ${formatGrade(row.integralAverage)}</span>
              </div>
            </div>
          </div>
          <div class="assessment-grid">
            ${row.assessments.map(item => `
              <div class="assessment-card">
                <div class="topline">
                  <strong>${escapeHtml(item.name)}</strong>
                  <span class="badge neutral">${formatPercent(item.weight)}</span>
                </div>
                <small>Exigencia: ${formatPercent(item.requirement)} · Total: ${formatPoints(item.totalPoints)} · Aprobación: ${formatPoints(item.passingPoints)}</small>
                <small>Puntaje obtenido: ${formatPoints(item.obtainedPoints)} · Nota: <strong>${formatGrade(item.grade)}</strong></small>
              </div>
            `).join('')}
          </div>
          <div class="observation-box">
            <strong>Observaciones</strong>
            <div>${escapeHtml(row.observation || 'Sin observaciones registradas.')}</div>
          </div>
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
    els.teacherTableBody.innerHTML = '<tr><td colspan="20">No hay curso seleccionado.</td></tr>';
    return;
  }
  const subjects = getSubjectsForCourse(state.currentCourse);
  els.teacherSubject.innerHTML = subjects.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  state.currentSubject = subjects.includes(state.currentSubject) ? state.currentSubject : subjects[0];
  els.teacherSubject.value = state.currentSubject;
  els.teacherCourseMeta.textContent = `${state.currentCourse} · ${state.currentSubject} · ${state.currentSemester}° semestre`;
  renderAssessmentConfig();
  refreshTeacherTable();
  renderDashboard();
}

function refreshTeacherTable(){
  const roster = state.roster.filter(s => s.curso === state.currentCourse);
  const q = normalize(els.teacherStudentFilter.value);
  const filtered = roster.filter(s => !q || normalize([s.rut, s.email, s.nombreCompleto].join(' ')).includes(q));
  const configs = getAssessmentConfig(state.currentCourse, state.currentSemester, state.currentSubject);

  els.teacherTableHead.innerHTML = `
    <tr>
      <th>Estudiante</th>
      <th>RUT</th>
      <th>Correo</th>
      ${configs.map(cfg => `<th>${escapeHtml(cfg.name)}<br><small>${formatPercent(cfg.weight)}</small></th>`).join('')}
      <th>Promedio académico</th>
      <th>Procedimental</th>
      <th>Actitudinal</th>
      <th>Promedio integral</th>
      <th>Observaciones</th>
    </tr>
  `;

  if(!filtered.length){
    els.teacherTableBody.innerHTML = '<tr><td colspan="20">No hay estudiantes para mostrar con este filtro.</td></tr>';
    updateTeacherAverages([]);
    return;
  }

  const rows = filtered.map(student => {
    const record = getGradeRecord(student.rut, state.currentCourse, state.currentSemester, state.currentSubject);
    const academic = computeAcademicAverage(record, configs);
    const integral = computeIntegralAverage(record, configs);
    return { student, record, academic, integral };
  });

  els.teacherTableBody.innerHTML = rows.map(({ student, record, academic, integral }) => `
    <tr data-rut="${escapeHtml(student.rut)}">
      <td>
        <strong>${escapeHtml(student.nombreCompleto)}</strong><br>
        <small>${escapeHtml(student.estado || '')}</small>
      </td>
      <td>${escapeHtml(student.rut)}</td>
      <td>${escapeHtml(student.email || '—')}</td>
      ${configs.map(cfg => {
        const obtained = record.assessments?.[cfg.id]?.obtainedPoints ?? '';
        const grade = calculateChileanGrade(obtained, cfg.totalPoints, cfg.requirement);
        return `
          <td>
            <input type="number" min="0" step="0.1" value="${obtained}" data-field="assessment" data-assessment="${escapeHtml(cfg.id)}" placeholder="Puntaje">
            <small>${formatGrade(grade)}</small>
          </td>
        `;
      }).join('')}
      <td><span class="badge ${Number(academic) >= 4 ? 'ok' : 'warn'}">${formatGrade(academic)}</span></td>
      <td><input type="number" min="1" max="7" step="0.1" value="${record.procedimental ?? ''}" data-field="procedimental"></td>
      <td><input type="number" min="1" max="7" step="0.1" value="${record.actitudinal ?? ''}" data-field="actitudinal"></td>
      <td><span class="badge ${Number(integral) >= 4 ? 'ok' : 'warn'}">${formatGrade(integral)}</span></td>
      <td><textarea data-field="observation" placeholder="Observaciones">${escapeHtml(record.observation || '')}</textarea></td>
    </tr>
  `).join('');

  els.teacherTableBody.querySelectorAll('input, textarea').forEach(input => {
    input.addEventListener('change', e => {
      const row = e.target.closest('tr');
      const rut = row.dataset.rut;
      const field = e.target.dataset.field;
      if(field === 'assessment'){
        saveAssessmentScore(rut, state.currentCourse, state.currentSemester, state.currentSubject, e.target.dataset.assessment, e.target.value);
      } else {
        saveGradeField(rut, state.currentCourse, state.currentSemester, state.currentSubject, field, e.target.value);
      }
      refreshTeacherTable();
      renderDashboard();
      if(state.selectedStudent && state.selectedStudent.rut === rut) renderStudentView();
    });
  });

  updateTeacherAverages(rows);
}

function renderAssessmentConfig(){
  const configs = getAssessmentConfig(state.currentCourse, state.currentSemester, state.currentSubject);
  els.assessmentConfigBody.innerHTML = configs.map((cfg, idx) => {
    const passingPoints = calculatePassingPoints(cfg.totalPoints, cfg.requirement);
    return `
      <tr data-assessment="${escapeHtml(cfg.id)}">
        <td><input type="text" value="${escapeHtml(cfg.name)}" data-field="name"></td>
        <td><input type="number" min="0" max="100" step="0.1" value="${cfg.weight}" data-field="weight"></td>
        <td><input type="number" min="1" max="100" step="0.1" value="${cfg.requirement}" data-field="requirement"></td>
        <td><input type="number" min="1" step="0.1" value="${cfg.totalPoints}" data-field="totalPoints"></td>
        <td><span class="badge neutral">${formatPoints(passingPoints)}</span></td>
      </tr>
    `;
  }).join('');

  const totalWeight = round1(configs.reduce((acc, item) => acc + Number(item.weight || 0), 0));
  els.weightSummary.textContent = `Ponderación total: ${formatPercent(totalWeight)}`;
  els.weightSummary.className = `badge ${Math.abs(totalWeight - 100) < 0.01 ? 'ok' : 'warn'}`;

  els.assessmentMeta.innerHTML = [
    ['Curso', state.currentCourse],
    ['Asignatura', state.currentSubject],
    ['Semestre', `${state.currentSemester}° semestre`],
    ['Evaluaciones', configs.length],
    ['Ponderación total', `${formatPercent(totalWeight)}`],
    ['Estado', Math.abs(totalWeight - 100) < 0.01 ? 'Correcto (100%)' : 'Revisar ponderaciones']
  ].map(([k,v]) => `<div class="stats-row"><span>${escapeHtml(String(k))}</span><strong>${escapeHtml(String(v))}</strong></div>`).join('');

  els.assessmentConfigBody.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', e => {
      const tr = e.target.closest('tr');
      const assessmentId = tr.dataset.assessment;
      const field = e.target.dataset.field;
      saveAssessmentConfigField(state.currentCourse, state.currentSemester, state.currentSubject, assessmentId, field, e.target.value);
      renderAssessmentConfig();
      refreshTeacherTable();
      renderDashboard();
      if(state.selectedStudent && state.selectedStudent.curso === state.currentCourse) renderStudentView();
    });
  });
}

function renderDashboard(){
  const courseStudents = state.roster.filter(s => s.curso === state.currentCourse);
  const allSubjects = getSubjectsForCourse(state.currentCourse);
  const semester = state.currentSemester;
  const subjectStats = allSubjects.map(subject => {
    const finals = courseStudents.map(s => computeIntegralAverage(getGradeRecord(s.rut, state.currentCourse, semester, subject), getAssessmentConfig(state.currentCourse, semester, subject))).filter(isNumber);
    return { subject, average: average(finals), count: finals.length };
  }).filter(s => s.count > 0);

  const selectedIntegrals = courseStudents.map(s => {
    const record = getGradeRecord(s.rut, state.currentCourse, semester, state.currentSubject);
    return computeIntegralAverage(record, getAssessmentConfig(state.currentCourse, semester, state.currentSubject));
  }).filter(isNumber);

  const approved = selectedIntegrals.filter(v => Number(v) >= 4).length;
  const failed = selectedIntegrals.filter(v => Number(v) < 4).length;

  els.dashboardSummary.innerHTML = [
    ['Estudiantes del curso', courseStudents.length],
    ['Asignaturas configuradas', allSubjects.length],
    ['Asignatura seleccionada', state.currentSubject],
    ['Registros con promedio integral', selectedIntegrals.length]
  ].map(([k,v]) => `<div class="stats-row"><span>${escapeHtml(String(k))}</span><strong>${escapeHtml(String(v))}</strong></div>`).join('');

  els.barChart.innerHTML = subjectStats.length ? subjectStats.map(s => `
    <div class="bar-row">
      <div class="bar-label"><span>${escapeHtml(s.subject)}</span><strong>${formatGrade(s.average)}</strong></div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, (Number(s.average || 0) / 7) * 100)}%"></div></div>
    </div>
  `).join('') : '<div class="empty-state">Aún no hay datos suficientes para graficar.</div>';

  const buckets = { '1.0–3.9':0, '4.0–4.9':0, '5.0–5.9':0, '6.0–7.0':0 };
  selectedIntegrals.forEach(value => {
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

  els.approvalChart.innerHTML = `
    <div class="distribution-grid">
      <div class="dist-box"><strong>${approved}</strong><div>Aprobados</div></div>
      <div class="dist-box"><strong>${failed}</strong><div>En riesgo</div></div>
    </div>
  `;
}

function updateTeacherAverages(rows){
  const proc = rows.map(r => Number(r.record.procedimental)).filter(isNumber);
  const act = rows.map(r => Number(r.record.actitudinal)).filter(isNumber);
  const academic = rows.map(r => r.academic).filter(isNumber);
  const integral = rows.map(r => r.integral).filter(isNumber);
  els.avgProc.textContent = formatGrade(average(proc));
  els.avgAct.textContent = formatGrade(average(act));
  els.avgAcademic.textContent = formatGrade(average(academic));
  els.avgIntegral.textContent = formatGrade(average(integral));
}

function buildStudentSubjectRow(student, subject, semester){
  const configs = getAssessmentConfig(student.curso, semester, subject);
  const record = getGradeRecord(student.rut, student.curso, semester, subject);
  const assessments = configs.map(cfg => {
    const obtained = record.assessments?.[cfg.id]?.obtainedPoints ?? '';
    return {
      ...cfg,
      passingPoints: calculatePassingPoints(cfg.totalPoints, cfg.requirement),
      obtainedPoints: obtained,
      grade: calculateChileanGrade(obtained, cfg.totalPoints, cfg.requirement)
    };
  });
  return {
    subject,
    procedimental: record.procedimental,
    actitudinal: record.actitudinal,
    observation: record.observation,
    assessments,
    academicAverage: computeAcademicAverage(record, configs),
    integralAverage: computeIntegralAverage(record, configs)
  };
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

function getAssessmentConfig(course, semester, subject){
  state.assessmentConfigs[course] ??= {};
  state.assessmentConfigs[course][semester] ??= {};
  if(!Array.isArray(state.assessmentConfigs[course][semester][subject]) || !state.assessmentConfigs[course][semester][subject].length){
    state.assessmentConfigs[course][semester][subject] = structuredClone(DEFAULT_ASSESSMENTS);
    persist(LS_KEYS.assessments, state.assessmentConfigs);
  }
  return state.assessmentConfigs[course][semester][subject];
}

function saveAssessmentConfigField(course, semester, subject, assessmentId, field, value){
  const configs = getAssessmentConfig(course, semester, subject);
  const item = configs.find(cfg => cfg.id === assessmentId);
  if(!item) return;
  if(field === 'name') item[field] = value.trim() || item[field];
  if(field === 'weight' || field === 'requirement' || field === 'totalPoints') item[field] = toNumberOr(value, item[field], field === 'requirement' ? 1 : 0);
  persist(LS_KEYS.assessments, state.assessmentConfigs);
}

function resetAssessmentConfig(){
  if(!state.currentCourse || !state.currentSubject) return;
  state.assessmentConfigs[state.currentCourse] ??= {};
  state.assessmentConfigs[state.currentCourse][state.currentSemester] ??= {};
  state.assessmentConfigs[state.currentCourse][state.currentSemester][state.currentSubject] = structuredClone(DEFAULT_ASSESSMENTS);
  persist(LS_KEYS.assessments, state.assessmentConfigs);
  renderAssessmentConfig();
  refreshTeacherTable();
  renderDashboard();
  showToast('Se restableció la configuración de Prueba 1 a Prueba 5.');
}

function getGradeRecord(rut, course, semester, subject){
  const record = state.grades?.[course]?.[semester]?.[subject]?.[rut];
  return normalizeRecord(record);
}

function normalizeRecord(record){
  const base = { procedimental:'', actitudinal:'', observation:'', assessments:{} };
  if(!record) return base;
  return {
    procedimental: record.procedimental ?? '',
    actitudinal: record.actitudinal ?? '',
    observation: record.observation ?? '',
    assessments: record.assessments ?? {}
  };
}

function saveGradeField(rut, course, semester, subject, field, value){
  ensureGradePath(course, semester, subject, rut);
  state.grades[course][semester][subject][rut][field] = field === 'observation' ? value : clampGrade(value);
  persist(LS_KEYS.grades, state.grades);
}

function saveAssessmentScore(rut, course, semester, subject, assessmentId, value){
  ensureGradePath(course, semester, subject, rut);
  state.grades[course][semester][subject][rut].assessments ??= {};
  state.grades[course][semester][subject][rut].assessments[assessmentId] ??= { obtainedPoints:'' };
  const num = Number(value);
  state.grades[course][semester][subject][rut].assessments[assessmentId].obtainedPoints = Number.isNaN(num) ? '' : round1(Math.max(0, num));
  persist(LS_KEYS.grades, state.grades);
}

function ensureGradePath(course, semester, subject, rut){
  state.grades[course] ??= {};
  state.grades[course][semester] ??= {};
  state.grades[course][semester][subject] ??= {};
  state.grades[course][semester][subject][rut] ??= { procedimental:'', actitudinal:'', observation:'', assessments:{} };
}

function computeAcademicAverage(record, configs){
  const parts = configs.map(cfg => {
    const obtained = record.assessments?.[cfg.id]?.obtainedPoints;
    const grade = calculateChileanGrade(obtained, cfg.totalPoints, cfg.requirement);
    const weight = Number(cfg.weight || 0);
    if(!isNumber(grade) || !isNumber(weight)) return null;
    return { grade, weight };
  }).filter(Boolean);

  const totalWeight = parts.reduce((acc, p) => acc + p.weight, 0);
  if(!parts.length || totalWeight <= 0) return null;
  const weighted = parts.reduce((acc, p) => acc + p.grade * p.weight, 0) / totalWeight;
  return round1(weighted);
}

function computeIntegralAverage(record, configs){
  const values = [computeAcademicAverage(record, configs), Number(record.procedimental), Number(record.actitudinal)].filter(isNumber);
  return values.length ? round1(values.reduce((a,b)=>a+b,0) / values.length) : null;
}

function calculatePassingPoints(totalPoints, requirement){
  const total = Number(totalPoints);
  const req = Number(requirement);
  if(!isNumber(total) || !isNumber(req) || total <= 0) return null;
  return round1(total * (req / 100));
}

function calculateChileanGrade(obtainedPoints, totalPoints, requirement){
  const score = Number(obtainedPoints);
  const total = Number(totalPoints);
  const req = Number(requirement);
  if(!isNumber(score) || !isNumber(total) || !isNumber(req) || total <= 0 || req <= 0 || req >= 100) return null;

  const passingPoints = total * (req / 100);
  const bounded = Math.max(0, Math.min(score, total));

  if(bounded === 0) return 1.0;

  if(bounded <= passingPoints){
    const ratio = bounded / passingPoints;
    return round1(1 + ratio * 3);
  }

  const ratio = (bounded - passingPoints) / (total - passingPoints || 1);
  return round1(4 + ratio * 3);
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
  if(getTeacherAccounts().some(acc => acc.email.toLowerCase() === email)){
    showToast('Ese correo ya existe.');
    return;
  }
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
  const payload = {
    exportedAt: new Date().toISOString(),
    grades: state.grades,
    subjects: state.subjects,
    extraTeachers: state.extraTeachers,
    assessmentConfigs: state.assessmentConfigs
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
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
    if(data.assessmentConfigs) state.assessmentConfigs = data.assessmentConfigs;
    persist(LS_KEYS.grades, state.grades);
    persist(LS_KEYS.subjects, state.subjects);
    persist(LS_KEYS.teachers, state.extraTeachers);
    persist(LS_KEYS.assessments, state.assessmentConfigs);
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
  const clean = values.map(Number).filter(isNumber);
  if(!clean.length) return null;
  return clean.reduce((a,b)=>a+b,0) / clean.length;
}

function clampGrade(value){
  const num = Number(value);
  if(Number.isNaN(num)) return '';
  return Math.max(1, Math.min(7, round1(num)));
}

function toNumberOr(value, fallback, min=0){
  const num = Number(value);
  if(Number.isNaN(num)) return fallback;
  return round1(Math.max(min, num));
}
function round1(n){ return Math.round(Number(n) * 10) / 10; }
function isNumber(n){ return Number.isFinite(Number(n)); }

function formatGrade(value){
  return value === null || value === undefined || value === '' || Number.isNaN(Number(value)) ? '—' : Number(value).toFixed(1);
}
function formatPercent(value){
  return value === null || value === undefined || value === '' || Number.isNaN(Number(value)) ? '—' : `${Number(value).toFixed(1)}%`;
}
function formatPoints(value){
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
