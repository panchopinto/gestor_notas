
const DEFAULT_ASSESSMENTS = [
  { slot: 1, title: 'Prueba 1', weight_pct: 20, requirement_pct: 60, total_points: 40 },
  { slot: 2, title: 'Prueba 2', weight_pct: 20, requirement_pct: 60, total_points: 40 },
  { slot: 3, title: 'Prueba 3', weight_pct: 20, requirement_pct: 60, total_points: 40 },
  { slot: 4, title: 'Prueba 4', weight_pct: 20, requirement_pct: 60, total_points: 40 },
  { slot: 5, title: 'Prueba 5', weight_pct: 20, requirement_pct: 60, total_points: 40 }
];

const LS_KEYS = {
  settings: 'biotec_accessibility_supabase'
};

const state = {
  supabase: null,
  session: null,
  profile: null,
  courses: [],
  courseSubjects: [],
  currentCourseId: null,
  currentCourseSubjectId: null,
  currentSemester: 1,
  roster: [],
  assessments: [],
  scoresMap: {},
  notesMap: {},
  studentSearchResults: [],
  distributionChart: null,
  accessibility: {
    theme: localStorage.getItem('theme') || 'dark',
    contrast: localStorage.getItem('contrast') || 'normal',
    fontScale: Number(localStorage.getItem('fontScale') || '1')
  }
};

const el = (id) => document.getElementById(id);

const dom = {
  configBanner: el('configBanner'),
  datasetBadge: el('datasetBadge'),
  heroStats: el('heroStats'),
  globalSearch: el('globalSearch'),
  globalSearchBtn: el('globalSearchBtn'),
  studentQuery: el('studentQuery'),
  studentCourseFilter: el('studentCourseFilter'),
  studentLookupBtn: el('studentLookupBtn'),
  studentLookupResults: el('studentLookupResults'),
  studentView: el('studentView'),
  loginForm: el('loginForm'),
  loginEmail: el('loginEmail'),
  loginPassword: el('loginPassword'),
  teacherWorkspace: el('teacherWorkspace'),
  sessionTitle: el('sessionTitle'),
  sessionMeta: el('sessionMeta'),
  teacherCourse: el('teacherCourse'),
  teacherSemester: el('teacherSemester'),
  teacherSubject: el('teacherSubject'),
  teacherStudentFilter: el('teacherStudentFilter'),
  teacherCourseMeta: el('teacherCourseMeta'),
  assessmentConfigBody: el('assessmentConfigBody'),
  assessmentMeta: el('assessmentMeta'),
  weightSummary: el('weightSummary'),
  saveAssessmentsBtn: el('saveAssessmentsBtn'),
  teacherTableHead: el('teacherTableHead'),
  teacherTableBody: el('teacherTableBody'),
  avgAcademic: el('avgAcademic'),
  avgProc: el('avgProc'),
  avgAct: el('avgAct'),
  avgIntegral: el('avgIntegral'),
  avgBars: el('avgBars'),
  suggestions: el('suggestions'),
  distributionChart: el('distributionChart'),
  refreshBtn: el('refreshBtn'),
  logoutBtn: el('logoutBtn'),
  addSubjectBtn: el('addSubjectBtn'),
  subjectDialog: el('subjectDialog'),
  subjectForm: el('subjectForm'),
  newSubjectName: el('newSubjectName'),
  cancelSubjectBtn: el('cancelSubjectBtn'),
  accessibilityBtn: el('accessibilityBtn'),
  accessibilityPanel: el('accessibilityPanel')
};

function toast(message) {
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 2400);
}

function fmtNumber(n, digits = 1) {
  return Number.isFinite(Number(n)) ? Number(n).toFixed(digits) : '—';
}
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function normalizeText(value = '') {
  return value.toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function gradeFromPoints(obtained, total, requirement) {
  obtained = Number(obtained);
  total = Number(total);
  requirement = Number(requirement);
  if (!Number.isFinite(obtained) || !Number.isFinite(total) || total <= 0 || !Number.isFinite(requirement) || requirement <= 0) return null;
  const pct = (obtained / total) * 100;
  let grade;
  if (pct >= requirement) {
    grade = 4 + ((pct - requirement) * 3) / Math.max(100 - requirement, 1);
  } else {
    grade = 1 + (pct * 3) / Math.max(requirement, 1);
  }
  return clamp(Math.round(grade * 10) / 10, 1, 7);
}

function weightedAcademicFromAssessments(items = []) {
  let sum = 0;
  let weightSum = 0;
  items.forEach(item => {
    const g = Number(item.grade);
    const w = Number(item.weight_pct);
    if (Number.isFinite(g) && Number.isFinite(w) && w > 0) {
      sum += g * w;
      weightSum += w;
    }
  });
  return weightSum > 0 ? Math.round((sum / weightSum) * 10) / 10 : null;
}

function integralAverage(academic, proc, act) {
  const values = [academic, proc, act].map(Number).filter(Number.isFinite);
  if (!values.length) return null;
  return Math.round((values.reduce((a,b)=>a+b,0) / values.length) * 10) / 10;
}

function applyAccessibility() {
  document.documentElement.dataset.theme = state.accessibility.theme;
  document.documentElement.style.fontSize = `${state.accessibility.fontScale * 100}%`;
  document.body.classList.toggle('high-contrast', state.accessibility.contrast === 'high');
  localStorage.setItem('theme', state.accessibility.theme);
  localStorage.setItem('contrast', state.accessibility.contrast);
  localStorage.setItem('fontScale', String(state.accessibility.fontScale));
}

function setupAccessibility() {
  applyAccessibility();
  dom.accessibilityBtn.addEventListener('click', () => {
    dom.accessibilityPanel.classList.toggle('hidden');
  });
  dom.accessibilityPanel.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
    if (action === 'narrator') {
      const text = document.body.innerText.slice(0, 3000);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-CL';
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    }
    if (action === 'theme') state.accessibility.theme = state.accessibility.theme === 'dark' ? 'light' : 'dark';
    if (action === 'contrast') state.accessibility.contrast = state.accessibility.contrast === 'high' ? 'normal' : 'high';
    if (action === 'font-up') state.accessibility.fontScale = clamp(state.accessibility.fontScale + 0.05, 0.9, 1.35);
    if (action === 'font-down') state.accessibility.fontScale = clamp(state.accessibility.fontScale - 0.05, 0.9, 1.35);
    if (action === 'find') dom.globalSearch.focus();
    applyAccessibility();
  });
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      el(`panel-${btn.dataset.tab}`).classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
  document.querySelectorAll('[data-open]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.open;
      document.querySelector(`.tab[data-tab="${target}"]`)?.click();
    });
  });
}

function supabaseReady() {
  return !!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY);
}

function buildSupabaseClient() {
  if (!supabaseReady()) {
    dom.configBanner.classList.remove('hidden');
    dom.configBanner.innerHTML = `Falta configurar <code>supabase-config.js</code>. Completa <code>window.SUPABASE_URL</code> y <code>window.SUPABASE_ANON_KEY</code> antes de publicar.`;
    dom.datasetBadge.textContent = 'Pendiente de configuración de Supabase';
    return null;
  }
  return window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
}

async function loadHeroStats() {
  if (!state.supabase) return;
  const year = window.BIOTEC_YEAR || 2026;
  const [{ count: studentCount }, { count: courseCount }, { count: subjectCount }] = await Promise.all([
    state.supabase.from('students').select('*', { count: 'exact', head: true }),
    state.supabase.from('courses').select('*', { count: 'exact', head: true }).eq('school_year', year),
    state.supabase.from('subjects').select('*', { count: 'exact', head: true })
  ]);
  dom.heroStats.innerHTML = [
    statCard(studentCount ?? 0, 'Estudiantes cargados'),
    statCard(courseCount ?? 0, 'Cursos 2026'),
    statCard(subjectCount ?? 0, 'Asignaturas base'),
    statCard('1-7', 'Escala de notas')
  ].join('');
  dom.datasetBadge.textContent = `Base conectada · ${studentCount ?? 0} estudiantes · ${courseCount ?? 0} cursos`;
}

function statCard(value, label) {
  return `<article class="stat-card"><strong>${value}</strong><span>${label}</span></article>`;
}

async function loadCourses() {
  const year = window.BIOTEC_YEAR || 2026;
  const { data, error } = await state.supabase
    .from('courses')
    .select('*')
    .eq('school_year', year)
    .order('name');
  if (error) throw error;
  state.courses = data || [];
  const options = [`<option value="">Selecciona curso</option>`]
    .concat(state.courses.map(c => `<option value="${c.id}">${c.name}</option>`))
    .join('');
  dom.teacherCourse.innerHTML = options;
  dom.studentCourseFilter.innerHTML = `<option value="">Todos los cursos</option>` + state.courses.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

async function loadCourseSubjects(courseId) {
  if (!courseId) {
    state.courseSubjects = [];
    dom.teacherSubject.innerHTML = '<option value="">Selecciona asignatura</option>';
    return;
  }
  const { data, error } = await state.supabase
    .from('course_subjects')
    .select('id, course_id, subject_id, active, subjects(id, name)')
    .eq('course_id', courseId)
    .eq('active', true)
    .order('subject_id');
  if (error) throw error;
  state.courseSubjects = data || [];
  dom.teacherSubject.innerHTML = `<option value="">Selecciona asignatura</option>` + state.courseSubjects
    .map(x => `<option value="${x.id}">${x.subjects?.name || 'Sin nombre'}</option>`)
    .join('');
}

async function loadAssessments() {
  const courseSubjectId = Number(dom.teacherSubject.value || state.currentCourseSubjectId);
  const semester = Number(dom.teacherSemester.value);
  if (!courseSubjectId) {
    state.assessments = [];
    renderAssessmentConfig();
    return;
  }
  state.currentCourseSubjectId = courseSubjectId;
  state.currentSemester = semester;
  const { data, error } = await state.supabase
    .from('assessments')
    .select('*')
    .eq('course_subject_id', courseSubjectId)
    .eq('semester', semester)
    .order('slot');
  if (error) throw error;
  state.assessments = data && data.length ? data : DEFAULT_ASSESSMENTS.map(item => ({ ...item, course_subject_id: courseSubjectId, semester }));
  renderAssessmentConfig();
}

function renderAssessmentConfig() {
  const rows = state.assessments.length ? state.assessments : DEFAULT_ASSESSMENTS;
  dom.assessmentConfigBody.innerHTML = rows.map((item, idx) => `
    <tr>
      <td><input data-field="title" data-idx="${idx}" value="${item.title || `Prueba ${idx+1}`}"></td>
      <td><input type="number" step="0.1" min="0" max="100" data-field="weight_pct" data-idx="${idx}" value="${item.weight_pct ?? 20}"></td>
      <td><input type="number" step="0.1" min="1" max="100" data-field="requirement_pct" data-idx="${idx}" value="${item.requirement_pct ?? 60}"></td>
      <td><input type="number" step="0.1" min="1" data-field="total_points" data-idx="${idx}" value="${item.total_points ?? 40}"></td>
      <td>${fmtNumber((Number(item.total_points || 0) * Number(item.requirement_pct || 0)) / 100, 1)}</td>
    </tr>
  `).join('');
  dom.assessmentMeta.innerHTML = rows.map(item => {
    const pass = (Number(item.total_points || 0) * Number(item.requirement_pct || 0)) / 100;
    return `<div class="stats-row"><span>${item.title}</span><strong>${fmtNumber(item.weight_pct, 1)}% · aprueba con ${fmtNumber(pass,1)} pts</strong></div>`;
  }).join('');
  const sum = rows.reduce((acc, item) => acc + Number(item.weight_pct || 0), 0);
  dom.weightSummary.textContent = `Ponderación total: ${fmtNumber(sum,1)}%`;
  dom.weightSummary.className = `badge ${Math.round(sum) === 100 ? 'ok' : 'warn'}`;
}

dom.assessmentConfigBody.addEventListener('input', (ev) => {
  const input = ev.target;
  const idx = Number(input.dataset.idx);
  const field = input.dataset.field;
  if (!Number.isInteger(idx) || !field) return;
  const value = ['weight_pct','requirement_pct','total_points'].includes(field) ? Number(input.value || 0) : input.value;
  state.assessments[idx] = { ...state.assessments[idx], [field]: value, slot: idx + 1, course_subject_id: state.currentCourseSubjectId, semester: state.currentSemester };
  renderAssessmentConfig();
});

async function saveAssessments() {
  if (!state.currentCourseSubjectId) return toast('Selecciona curso y asignatura.');
  const payload = state.assessments.map((item, index) => ({
    id: item.id,
    course_subject_id: state.currentCourseSubjectId,
    semester: state.currentSemester,
    slot: index + 1,
    title: item.title || `Prueba ${index + 1}`,
    weight_pct: Number(item.weight_pct || 0),
    requirement_pct: Number(item.requirement_pct || 60),
    total_points: Number(item.total_points || 40)
  }));
  const { error } = await state.supabase.from('assessments').upsert(payload, { onConflict: 'course_subject_id,semester,slot' });
  if (error) throw error;
  await loadAssessments();
  await loadRoster();
  toast('Configuración guardada.');
}

async function loadRoster() {
  const courseId = Number(dom.teacherCourse.value || state.currentCourseId);
  if (!courseId) {
    state.roster = [];
    renderTeacherTable();
    return;
  }
  state.currentCourseId = courseId;
  const year = window.BIOTEC_YEAR || 2026;
  const { data, error } = await state.supabase
    .from('enrollments')
    .select('student_id, students(id, rut, email, first_names, last_name_1, last_name_2, full_name), courses(name)')
    .eq('course_id', courseId)
    .eq('school_year', year)
    .order('student_id');
  if (error) throw error;
  state.roster = (data || []).map(item => ({
    student_id: item.student_id,
    course_name: item.courses?.name || '',
    ...(item.students || {})
  }));
  dom.teacherCourseMeta.textContent = `${state.roster.length} estudiantes en ${state.roster[0]?.course_name || 'curso seleccionado'}`;
  await loadExistingScoresAndNotes();
  renderTeacherTable();
}

async function loadExistingScoresAndNotes() {
  state.scoresMap = {};
  state.notesMap = {};
  if (!state.currentCourseSubjectId || !state.assessments.length || !state.roster.length) return;
  const assessmentIds = state.assessments.filter(a => a.id).map(a => a.id);
  const studentIds = state.roster.map(s => s.id);
  if (assessmentIds.length) {
    const { data: scores, error: sError } = await state.supabase
      .from('assessment_scores')
      .select('*')
      .in('assessment_id', assessmentIds)
      .in('student_id', studentIds);
    if (sError) throw sError;
    (scores || []).forEach(item => {
      state.scoresMap[`${item.student_id}_${item.assessment_id}`] = item;
    });
  }
  const { data: notes, error: nError } = await state.supabase
    .from('subject_notes')
    .select('*')
    .eq('course_subject_id', state.currentCourseSubjectId)
    .eq('semester', state.currentSemester)
    .in('student_id', studentIds);
  if (nError) throw nError;
  (notes || []).forEach(item => { state.notesMap[item.student_id] = item; });
}

function getAssessmentBySlot(slot) {
  return state.assessments.find(a => Number(a.slot) === Number(slot)) || DEFAULT_ASSESSMENTS.find(a => a.slot === slot);
}

function renderTeacherTable() {
  const filter = normalizeText(dom.teacherStudentFilter.value);
  const assessments = [1,2,3,4,5].map(getAssessmentBySlot);
  dom.teacherTableHead.innerHTML = `
    <tr>
      <th>Estudiante</th>
      <th>RUT</th>
      ${assessments.map(a => `<th>${a.title}<br><small>${fmtNumber(a.weight_pct,1)}% · ${fmtNumber(a.total_points,1)} pts</small></th><th>Nota</th>`).join('')}
      <th>Procedimental</th>
      <th>Actitudinal</th>
      <th>Prom. académico</th>
      <th>Prom. integral</th>
      <th>Observaciones</th>
    </tr>
  `;
  const rows = state.roster.filter(student => {
    if (!filter) return true;
    const blob = normalizeText(`${student.full_name} ${student.rut} ${student.email} ${student.course_name}`);
    return blob.includes(filter);
  });
  dom.teacherTableBody.innerHTML = rows.map(student => {
    const note = state.notesMap[student.id] || {};
    const assessmentItems = assessments.map(a => {
      const key = `${student.id}_${a.id}`;
      const score = state.scoresMap[key] || {};
      const grade = Number.isFinite(Number(score.calculated_grade))
        ? Number(score.calculated_grade)
        : gradeFromPoints(score.obtained_points, a.total_points, a.requirement_pct);
      return {
        assessment_id: a.id,
        weight_pct: a.weight_pct,
        obtained_points: score.obtained_points,
        grade
      };
    });
    const academic = weightedAcademicFromAssessments(assessmentItems);
    const integral = integralAverage(academic, note.procedural_grade, note.attitudinal_grade);
    return `
      <tr data-student-id="${student.id}">
        <td><strong>${student.full_name}</strong><br><small>${student.email || 'Sin correo'}</small></td>
        <td>${student.rut || '—'}</td>
        ${assessments.map(a => {
          const key = `${student.id}_${a.id}`;
          const score = state.scoresMap[key] || {};
          const grade = Number.isFinite(Number(score.calculated_grade))
            ? Number(score.calculated_grade)
            : gradeFromPoints(score.obtained_points, a.total_points, a.requirement_pct);
          return `
            <td><input type="number" step="0.1" min="0" max="${a.total_points || 999}" data-kind="score" data-student-id="${student.id}" data-assessment-id="${a.id || ''}" data-slot="${a.slot}" value="${score.obtained_points ?? ''}" placeholder="pts"></td>
            <td><span class="badge neutral">${Number.isFinite(grade) ? grade.toFixed(1) : '—'}</span></td>
          `;
        }).join('')}
        <td><input type="number" step="0.1" min="1" max="7" data-kind="procedural_grade" data-student-id="${student.id}" value="${note.procedural_grade ?? ''}"></td>
        <td><input type="number" step="0.1" min="1" max="7" data-kind="attitudinal_grade" data-student-id="${student.id}" value="${note.attitudinal_grade ?? ''}"></td>
        <td><span class="badge ${academic >= 4 ? 'ok' : 'warn'}">${academic ? academic.toFixed(1) : '—'}</span></td>
        <td><span class="badge ${integral >= 4 ? 'ok' : 'warn'}">${integral ? integral.toFixed(1) : '—'}</span></td>
        <td><textarea rows="2" data-kind="observation" data-student-id="${student.id}" placeholder="Observaciones">${note.observation || ''}</textarea></td>
      </tr>
    `;
  }).join('');
  renderDashboardFromTable();
}

async function saveScore(studentId, assessmentId, slot, obtainedPoints) {
  let assessment = state.assessments.find(a => Number(a.id) === Number(assessmentId));
  if (!assessment) assessment = state.assessments.find(a => Number(a.slot) === Number(slot));
  if (!assessment?.id) {
    await saveAssessments();
    assessment = state.assessments.find(a => Number(a.slot) === Number(slot));
  }
  const payload = {
    assessment_id: assessment.id,
    student_id: Number(studentId),
    obtained_points: obtainedPoints === '' ? null : Number(obtainedPoints)
  };
  const { error } = await state.supabase.from('assessment_scores').upsert(payload, { onConflict: 'assessment_id,student_id' });
  if (error) throw error;
  await loadExistingScoresAndNotes();
  renderTeacherTable();
}

async function saveNote(studentId, kind, value) {
  const current = state.notesMap[studentId] || {
    student_id: Number(studentId),
    course_subject_id: state.currentCourseSubjectId,
    semester: state.currentSemester
  };
  current[kind] = kind === 'observation' ? value : (value === '' ? null : Number(value));
  const payload = {
    student_id: Number(studentId),
    course_subject_id: state.currentCourseSubjectId,
    semester: state.currentSemester,
    procedural_grade: current.procedural_grade ?? null,
    attitudinal_grade: current.attitudinal_grade ?? null,
    observation: current.observation ?? null
  };
  const { error } = await state.supabase.from('subject_notes').upsert(payload, { onConflict: 'course_subject_id,semester,student_id' });
  if (error) throw error;
  state.notesMap[studentId] = { ...current };
  renderTeacherTable();
}

dom.teacherTableBody.addEventListener('change', async (ev) => {
  const input = ev.target;
  const studentId = Number(input.dataset.studentId);
  if (!studentId) return;
  try {
    if (input.dataset.kind === 'score') {
      await saveScore(studentId, input.dataset.assessmentId, input.dataset.slot, input.value);
      toast('Puntaje guardado.');
    } else if (['procedural_grade','attitudinal_grade','observation'].includes(input.dataset.kind)) {
      await saveNote(studentId, input.dataset.kind, input.value);
      toast('Registro guardado.');
    }
  } catch (error) {
    console.error(error);
    toast(`Error: ${error.message}`);
  }
});

function renderDashboardFromTable() {
  const assessments = [1,2,3,4,5].map(getAssessmentBySlot);
  const rows = state.roster.filter(student => {
    const filter = normalizeText(dom.teacherStudentFilter.value);
    if (!filter) return true;
    const blob = normalizeText(`${student.full_name} ${student.rut} ${student.email}`);
    return blob.includes(filter);
  }).map(student => {
    const note = state.notesMap[student.id] || {};
    const academic = weightedAcademicFromAssessments(assessments.map(a => {
      const item = state.scoresMap[`${student.id}_${a.id}`] || {};
      return {
        weight_pct: a.weight_pct,
        grade: Number.isFinite(Number(item.calculated_grade))
          ? Number(item.calculated_grade)
          : gradeFromPoints(item.obtained_points, a.total_points, a.requirement_pct)
      };
    }));
    const proc = Number(note.procedural_grade);
    const act = Number(note.attitudinal_grade);
    const integral = integralAverage(academic, proc, act);
    return { academic, proc, act, integral };
  });

  const avgAcademic = average(rows.map(r => r.academic));
  const avgProc = average(rows.map(r => r.proc));
  const avgAct = average(rows.map(r => r.act));
  const avgIntegral = average(rows.map(r => r.integral));

  dom.avgAcademic.textContent = avgAcademic ? avgAcademic.toFixed(1) : '—';
  dom.avgProc.textContent = avgProc ? avgProc.toFixed(1) : '—';
  dom.avgAct.textContent = avgAct ? avgAct.toFixed(1) : '—';
  dom.avgIntegral.textContent = avgIntegral ? avgIntegral.toFixed(1) : '—';

  dom.avgBars.innerHTML = [
    ['Académico', avgAcademic],
    ['Procedimental', avgProc],
    ['Actitudinal', avgAct],
    ['Integral', avgIntegral]
  ].map(([label, val]) => `
    <div class="bar-row">
      <div class="bar-label"><span>${label}</span><strong>${val ? val.toFixed(1) : '—'}</strong></div>
      <div class="bar-track"><div class="bar-fill" style="width:${((val || 0) / 7) * 100}%"></div></div>
    </div>
  `).join('');

  const dist = {
    '<4.0': rows.filter(r => Number(r.integral) < 4).length,
    '4.0-4.9': rows.filter(r => Number(r.integral) >= 4 && Number(r.integral) < 5).length,
    '5.0-5.9': rows.filter(r => Number(r.integral) >= 5 && Number(r.integral) < 6).length,
    '6.0-7.0': rows.filter(r => Number(r.integral) >= 6).length
  };

  renderDistributionChart(dist);
  renderSuggestions(rows, dist, avgAcademic, avgIntegral);
}

function average(values) {
  const arr = values.map(Number).filter(Number.isFinite);
  if (!arr.length) return null;
  return Math.round((arr.reduce((a,b)=>a+b,0) / arr.length) * 10) / 10;
}

function renderDistributionChart(dist) {
  const ctx = dom.distributionChart.getContext('2d');
  if (state.distributionChart) state.distributionChart.destroy();
  state.distributionChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(dist),
      datasets: [{ label: 'Estudiantes', data: Object.values(dist) }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function renderSuggestions(rows, dist, avgAcademic, avgIntegral) {
  const total = rows.length || 1;
  const approvalRate = Math.round((((rows.filter(r => Number(r.integral) >= 4).length) / total) * 100) || 0);
  const cards = [
    {
      title: 'Aprobación global',
      text: `${approvalRate}% del grupo registra promedio integral 4.0 o superior.`
    },
    {
      title: 'Foco inmediato',
      text: `${dist['<4.0'] || 0} estudiantes requieren seguimiento pedagógico prioritario.`
    },
    {
      title: 'Lectura del bloque',
      text: `Promedio académico ${avgAcademic ? avgAcademic.toFixed(1) : '—'} · promedio integral ${avgIntegral ? avgIntegral.toFixed(1) : '—'}.`
    },
    {
      title: 'Sugerencia UTP',
      text: approvalRate < 70 ? 'Conviene reforzar la evaluación formativa y revisar ponderaciones del bloque.' : 'El bloque muestra estabilidad; prioriza retroalimentación individual en casos críticos.'
    }
  ];
  dom.suggestions.innerHTML = cards.map(card => `<article><strong>${card.title}</strong><p>${card.text}</p></article>`).join('');
}

async function login(ev) {
  ev.preventDefault();
  try {
    const { error } = await state.supabase.auth.signInWithPassword({
      email: dom.loginEmail.value.trim(),
      password: dom.loginPassword.value
    });
    if (error) throw error;
    dom.loginForm.reset();
  } catch (error) {
    console.error(error);
    toast(`No fue posible iniciar sesión: ${error.message}`);
  }
}

async function logout() {
  await state.supabase.auth.signOut();
}

async function bootstrapSession() {
  if (!state.supabase) return;
  const { data } = await state.supabase.auth.getSession();
  state.session = data.session;
  await syncSessionUI();
  state.supabase.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    await syncSessionUI();
  });
}

async function syncSessionUI() {
  if (!state.session?.user) {
    state.profile = null;
    dom.teacherWorkspace.classList.add('hidden');
    dom.sessionTitle.textContent = 'Sesión iniciada';
    dom.sessionMeta.textContent = 'Carga, edición y análisis en tiempo real con Supabase.';
    return;
  }
  const { data: profile, error } = await state.supabase
    .from('profiles')
    .select('*')
    .eq('id', state.session.user.id)
    .maybeSingle();
  if (error) {
    console.error(error);
    toast('No se pudo cargar el perfil.');
    return;
  }
  state.profile = profile;
  const role = profile?.role || 'student';
  dom.sessionTitle.textContent = `${profile?.full_name || state.session.user.email}`;
  dom.sessionMeta.textContent = `Rol: ${role} · ${state.session.user.email}`;
  if (!['teacher', 'utp', 'admin'].includes(role)) {
    dom.teacherWorkspace.classList.add('hidden');
    toast('Tu cuenta inició sesión, pero no tiene permisos docentes/UTP.');
    return;
  }
  dom.teacherWorkspace.classList.remove('hidden');
  if (!state.courses.length) await loadCourses();
  if (!dom.teacherCourse.value && state.courses[0]) {
    dom.teacherCourse.value = state.courses[0].id;
    await onTeacherFiltersChanged();
  }
}

async function onTeacherFiltersChanged() {
  try {
    state.currentCourseId = Number(dom.teacherCourse.value || 0);
    state.currentSemester = Number(dom.teacherSemester.value || 1);
    await loadCourseSubjects(state.currentCourseId);
    if (!dom.teacherSubject.value && state.courseSubjects[0]) dom.teacherSubject.value = state.courseSubjects[0].id;
    state.currentCourseSubjectId = Number(dom.teacherSubject.value || 0);
    await loadAssessments();
    await loadRoster();
  } catch (error) {
    console.error(error);
    toast(`Error al cargar bloque: ${error.message}`);
  }
}

async function studentLookup() {
  const query = dom.studentQuery.value.trim() || dom.globalSearch.value.trim();
  const courseName = dom.studentCourseFilter.value || null;
  if (!query) return toast('Escribe un RUT, apellido o correo.');
  try {
    const { data, error } = await state.supabase.rpc('student_search', {
      p_query: query,
      p_course: courseName
    });
    if (error) throw error;
    state.studentSearchResults = data || [];
    renderStudentSearchResults();
    if (!state.studentSearchResults.length) {
      dom.studentView.className = 'student-view empty-state';
      dom.studentView.innerHTML = '<p>No se encontraron coincidencias.</p>';
    }
  } catch (error) {
    console.error(error);
    toast(`No se pudo buscar: ${error.message}`);
  }
}

function renderStudentSearchResults() {
  dom.studentLookupResults.innerHTML = state.studentSearchResults.map(item => `
    <button class="result-item" data-student-id="${item.student_id}">
      <strong>${item.full_name}</strong>
      <small>${item.course_name} · ${item.rut || 'Sin RUT'} · ${item.email || 'Sin correo'}</small>
    </button>
  `).join('');
}

dom.studentLookupResults.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('[data-student-id]');
  if (!btn) return;
  await openStudentReport(Number(btn.dataset.studentId));
});

async function openStudentReport(studentId) {
  try {
    const { data, error } = await state.supabase.rpc('student_full_report', {
      p_student_id: studentId,
      p_school_year: window.BIOTEC_YEAR || 2026
    });
    if (error) throw error;
    renderStudentReport(data || []);
  } catch (error) {
    console.error(error);
    toast(`No se pudo cargar el reporte: ${error.message}`);
  }
}

function renderStudentReport(rows) {
  if (!rows.length) {
    dom.studentView.className = 'student-view empty-state';
    dom.studentView.innerHTML = '<p>Este estudiante aún no tiene registros en la base.</p>';
    return;
  }
  dom.studentView.className = 'student-view';
  const student = rows[0];
  const bySemester = groupBy(rows, row => row.semester || 1);
  const semesterButtons = Object.keys(bySemester).sort().map((sem, idx) => `
    <button class="semester-btn ${idx === 0 ? 'active' : ''}" data-semester-btn="${sem}">${sem}° semestre</button>
  `).join('');
  const panels = Object.entries(bySemester).sort((a,b)=>a[0]-b[0]).map(([semester, items], idx) => {
    const bySubject = groupBy(items, row => row.subject_name);
    const academicList = [];
    const noteProc = [];
    const noteAct = [];
    const subjectCards = Object.entries(bySubject).map(([subjectName, subjectRows]) => {
      const assessments = subjectRows.filter(r => r.assessment_title);
      const academic = weightedAcademicFromAssessments(assessments.map(a => ({ grade: a.calculated_grade, weight_pct: a.weight_pct })));
      const procedural = subjectRows.find(r => r.procedural_grade !== null)?.procedural_grade ?? null;
      const attitudinal = subjectRows.find(r => r.attitudinal_grade !== null)?.attitudinal_grade ?? null;
      const observation = subjectRows.find(r => r.observation)?.observation ?? '';
      if (Number.isFinite(Number(academic))) academicList.push(Number(academic));
      if (Number.isFinite(Number(procedural))) noteProc.push(Number(procedural));
      if (Number.isFinite(Number(attitudinal))) noteAct.push(Number(attitudinal));
      const integral = integralAverage(academic, procedural, attitudinal);
      return `
        <article class="subject-card">
          <div class="subject-head">
            <div>
              <h4>${subjectName}</h4>
              <div class="subject-metrics">
                <span class="badge ${academic >= 4 ? 'ok' : 'warn'}">Prom. académico: ${academic ? academic.toFixed(1) : '—'}</span>
                <span class="badge neutral">Procedimental: ${procedural ? Number(procedural).toFixed(1) : '—'}</span>
                <span class="badge neutral">Actitudinal: ${attitudinal ? Number(attitudinal).toFixed(1) : '—'}</span>
                <span class="badge ${integral >= 4 ? 'ok' : 'warn'}">Integral: ${integral ? integral.toFixed(1) : '—'}</span>
              </div>
            </div>
          </div>
          <div class="assessment-grid">
            ${assessments.map(a => `
              <div class="assessment-card">
                <div class="topline">
                  <strong>${a.assessment_title}</strong>
                  <span class="badge neutral">${a.calculated_grade ? Number(a.calculated_grade).toFixed(1) : '—'}</span>
                </div>
                <small>Ponderación: ${fmtNumber(a.weight_pct,1)}%</small>
                <small>Exigencia: ${fmtNumber(a.requirement_pct,1)}%</small>
                <small>Puntaje: ${fmtNumber(a.obtained_points,1)} / ${fmtNumber(a.total_points,1)}</small>
                <small>Aprobación: ${fmtNumber(a.passing_points,1)} pts</small>
              </div>
            `).join('')}
          </div>
          ${observation ? `<div class="observation-box"><strong>Observación:</strong> ${observation}</div>` : ''}
        </article>
      `;
    }).join('');

    const semesterAcademic = average(academicList);
    const semesterProc = average(noteProc);
    const semesterAct = average(noteAct);
    const semesterIntegral = integralAverage(semesterAcademic, semesterProc, semesterAct);

    return `
      <section class="semester-panel ${idx === 0 ? 'active' : 'hidden'}" data-semester-panel="${semester}">
        <div class="summary-strip">
          <div class="mini-stat"><span>Prom. académico</span><strong>${semesterAcademic ? semesterAcademic.toFixed(1) : '—'}</strong></div>
          <div class="mini-stat"><span>Prom. procedimental</span><strong>${semesterProc ? semesterProc.toFixed(1) : '—'}</strong></div>
          <div class="mini-stat"><span>Prom. actitudinal</span><strong>${semesterAct ? semesterAct.toFixed(1) : '—'}</strong></div>
          <div class="mini-stat"><span>Prom. integral</span><strong>${semesterIntegral ? semesterIntegral.toFixed(1) : '—'}</strong></div>
        </div>
        <div class="subject-stack">${subjectCards}</div>
      </section>
    `;
  }).join('');

  dom.studentView.innerHTML = `
    <div class="student-head">
      <div>
        <h3>${student.full_name}</h3>
        <div class="student-meta">
          <span>${student.course_name}</span>
          <span>${student.rut || 'Sin RUT'}</span>
          <span>${student.email || 'Sin correo'}</span>
        </div>
      </div>
    </div>
    <div class="semester-switch">${semesterButtons}</div>
    ${panels}
  `;

  dom.studentView.querySelectorAll('[data-semester-btn]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sem = btn.dataset.semesterBtn;
      dom.studentView.querySelectorAll('[data-semester-btn]').forEach(x => x.classList.remove('active'));
      dom.studentView.querySelectorAll('[data-semester-panel]').forEach(x => x.classList.add('hidden'));
      btn.classList.add('active');
      dom.studentView.querySelector(`[data-semester-panel="${sem}"]`)?.classList.remove('hidden');
    });
  });
}

function groupBy(list, fn) {
  return list.reduce((acc, item) => {
    const key = fn(item);
    (acc[key] ||= []).push(item);
    return acc;
  }, {});
}

async function addSubject(ev) {
  ev?.preventDefault();
  if (!state.currentCourseId) return toast('Selecciona un curso primero.');
  const subjectName = dom.newSubjectName.value.trim();
  if (!subjectName) return;
  try {
    const slug = normalizeText(subjectName).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g,'');
    const { data: subjectData, error: subjectError } = await state.supabase
      .from('subjects')
      .upsert({ name: subjectName, slug }, { onConflict: 'slug' })
      .select()
      .single();
    if (subjectError) throw subjectError;
    const { error: mapError } = await state.supabase
      .from('course_subjects')
      .upsert({ course_id: state.currentCourseId, subject_id: subjectData.id, active: true }, { onConflict: 'course_id,subject_id' });
    if (mapError) throw mapError;
    dom.subjectDialog.close();
    dom.subjectForm.reset();
    await loadCourseSubjects(state.currentCourseId);
    dom.teacherSubject.value = state.courseSubjects.find(x => x.subjects?.name === subjectName)?.id || '';
    await onTeacherFiltersChanged();
    toast('Asignatura agregada.');
  } catch (error) {
    console.error(error);
    toast(`No se pudo agregar: ${error.message}`);
  }
}

function setupDialog() {
  dom.addSubjectBtn.addEventListener('click', () => dom.subjectDialog.showModal());
  dom.cancelSubjectBtn.addEventListener('click', () => dom.subjectDialog.close());
  dom.subjectForm.addEventListener('submit', addSubject);
}

function setupEvents() {
  dom.loginForm.addEventListener('submit', login);
  dom.logoutBtn.addEventListener('click', logout);
  dom.refreshBtn.addEventListener('click', onTeacherFiltersChanged);
  dom.teacherCourse.addEventListener('change', onTeacherFiltersChanged);
  dom.teacherSemester.addEventListener('change', onTeacherFiltersChanged);
  dom.teacherSubject.addEventListener('change', async () => {
    state.currentCourseSubjectId = Number(dom.teacherSubject.value || 0);
    await loadAssessments();
    await loadRoster();
  });
  dom.teacherStudentFilter.addEventListener('input', renderTeacherTable);
  dom.saveAssessmentsBtn.addEventListener('click', async () => {
    try {
      await saveAssessments();
    } catch (error) {
      console.error(error);
      toast(`No se pudo guardar: ${error.message}`);
    }
  });
  dom.studentLookupBtn.addEventListener('click', studentLookup);
  dom.globalSearchBtn.addEventListener('click', () => {
    dom.studentQuery.value = dom.globalSearch.value;
    document.querySelector('.tab[data-tab="student"]')?.click();
    studentLookup();
  });
  dom.globalSearch.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      dom.globalSearchBtn.click();
    }
  });
}

async function init() {
  setupAccessibility();
  setupTabs();
  setupDialog();
  setupEvents();

  state.supabase = buildSupabaseClient();
  if (!state.supabase) return;

  try {
    await loadCourses();
    await loadHeroStats();
    await bootstrapSession();
  } catch (error) {
    console.error(error);
    dom.datasetBadge.textContent = 'Error al cargar la base';
    toast(`Error de carga inicial: ${error.message}`);
  }
}

init();
