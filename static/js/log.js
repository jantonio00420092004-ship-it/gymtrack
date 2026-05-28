// ── Timer ────────────────────────────────────────────────────────────────────
const TIMER_KEY = 'gymtrack_timer_start';
let timerInterval = null;

function toggleTimer() {
  const running = localStorage.getItem(TIMER_KEY);
  if (running) { stopTimer(); } else { startTimer(); }
}

function startTimer() {
  localStorage.setItem(TIMER_KEY, Date.now());
  updateTimerUI(true);
  timerInterval = setInterval(tickTimer, 1000);
}

function stopTimer() {
  const start = parseInt(localStorage.getItem(TIMER_KEY));
  if (start) {
    const minutes = Math.round((Date.now() - start) / 60000);
    document.getElementById('sessionDuration').value = Math.max(1, minutes);
  }
  localStorage.removeItem(TIMER_KEY);
  clearInterval(timerInterval);
  timerInterval = null;
  document.getElementById('timerDisplay').textContent = '00:00:00';
  updateTimerUI(false);
  document.getElementById('timerHint').textContent = '✓ Tiempo registrado automáticamente';
}

function tickTimer() {
  const start = parseInt(localStorage.getItem(TIMER_KEY));
  if (!start) return;
  const elapsed = Math.floor((Date.now() - start) / 1000);
  const h = Math.floor(elapsed / 3600).toString().padStart(2, '0');
  const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
  const s = (elapsed % 60).toString().padStart(2, '0');
  document.getElementById('timerDisplay').textContent = `${h}:${m}:${s}`;
}

function updateTimerUI(running) {
  const btn = document.getElementById('timerBtn');
  const card = document.getElementById('timerCard');
  if (running) {
    btn.textContent = '⏹ Terminar Entreno';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-danger');
    card.classList.add('timer-running');
    document.getElementById('timerHint').textContent = 'Entrenando… presiona para terminar y registrar el tiempo';
  } else {
    btn.textContent = '▶ Iniciar Entreno';
    btn.classList.remove('btn-danger');
    btn.classList.add('btn-primary');
    card.classList.remove('timer-running');
  }
}

function resumeTimerIfRunning() {
  const start = localStorage.getItem(TIMER_KEY);
  if (start) {
    updateTimerUI(true);
    tickTimer();
    timerInterval = setInterval(tickTimer, 1000);
  }
}

// ── Superset ─────────────────────────────────────────────────────────────────
let supersetCounter = 0;

function toggleSuperset(btn) {
  const block = btn.closest('.exercise-block');
  const allBlocks = [...document.querySelectorAll('.exercise-block')];
  const idx = allBlocks.indexOf(block);
  const nextBlock = allBlocks[idx + 1];

  if (!nextBlock) {
    alert('Agrega el segundo ejercicio debajo primero');
    return;
  }

  const currentGroup = block.dataset.supersetGroup;

  if (currentGroup) {
    [block, nextBlock].forEach(b => {
      if (b.dataset.supersetGroup === currentGroup) {
        delete b.dataset.supersetGroup;
        b.classList.remove('superset-member', 'superset-first', 'superset-last');
        const sbtn = b.querySelector('.superset-btn');
        if (sbtn) { sbtn.textContent = '🔗 Biserie'; sbtn.classList.remove('active'); }
      }
    });
  } else {
    const letter = String.fromCharCode(65 + (supersetCounter++ % 26));
    block.dataset.supersetGroup = letter;
    nextBlock.dataset.supersetGroup = letter;
    block.classList.add('superset-member', 'superset-first');
    nextBlock.classList.add('superset-member', 'superset-last');
    const b1 = block.querySelector('.superset-btn');
    const b2 = nextBlock.querySelector('.superset-btn');
    if (b1) { b1.textContent = '🔗 Biserie'; b1.classList.add('active'); }
    if (b2) { b2.textContent = '🔗 Biserie'; b2.classList.add('active'); }
  }
}

// ── Exercise database (for picker) ───────────────────────────────────────────
const EXERCISE_DB = {
  'Pecho': [
    'Press de banca plano', 'Press de banca inclinado', 'Press de banca declinado',
    'Aperturas con mancuernas', 'Aperturas en polea', 'Press con mancuernas',
    'Press inclinado con mancuernas', 'Fondos en paralelas', 'Pullover con mancuerna',
    'Press de banca agarre cerrado'
  ],
  'Espalda': [
    'Jalón al pecho', 'Remo con barra', 'Remo con mancuerna', 'Dominadas',
    'Peso muerto', 'Remo en polea baja', 'Pullover en polea', 'Jalón tras nuca',
    'Hiperextensiones', 'Remo con barra T'
  ],
  'Pierna': [
    'Sentadilla', 'Prensa de pierna', 'Hip thrust', 'Curl femoral tumbado',
    'Extensiones de cuádriceps', 'Peso muerto rumano', 'Sentadilla búlgara',
    'Zancadas', 'Abductores', 'Pantorrillas de pie', 'Sentadilla sumo',
    'Curl femoral sentado'
  ],
  'Hombro': [
    'Press militar con barra', 'Press con mancuernas', 'Elevaciones laterales',
    'Elevaciones frontales', 'Pájaros', 'Press Arnold', 'Face pull',
    'Elevaciones laterales en polea', 'Encogimientos de hombros'
  ],
  'Bíceps': [
    'Curl con barra', 'Curl con mancuernas', 'Curl martillo', 'Curl en polea baja',
    'Curl concentrado', 'Curl en banco inclinado', 'Curl de muñeca', 'Curl araña'
  ],
  'Tríceps': [
    'Press francés', 'Extensión en polea alta', 'Fondos en banco', 'Patada de tríceps',
    'Extensión con mancuerna sobre la cabeza', 'Pushdown agarre estrecho',
    'Press cerrado', 'Extensión en polea con cuerda'
  ],
  'Core': [
    'Crunch abdominal', 'Plancha', 'Plancha lateral', 'Rueda abdominal',
    'Elevación de piernas', 'Russian twist', 'Crunch en polea', 'Crunch inverso',
    'Tijeras', 'Mountain climbers', 'Dead bug'
  ],
  'Cardio': [
    'Caminadora', 'Bicicleta estática', 'Elíptica', 'Remo (cardio)',
    'Saltar la cuerda', 'Burpees', 'HIIT', 'Escaladora', 'Sprints'
  ]
};

// SVG silhouettes highlighting each muscle group (front/back body diagram)
const MUSCLE_SVGS = {
  'Pecho': `<svg viewBox="0 0 40 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="20" cy="30" rx="11" ry="22" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
    <ellipse cx="14" cy="22" rx="5" ry="4" fill="#22c55e" opacity="0.85"/>
    <ellipse cx="26" cy="22" rx="5" ry="4" fill="#22c55e" opacity="0.85"/>
    <circle cx="20" cy="10" r="5" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
    <rect x="10" y="38" width="4" height="14" rx="2" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
    <rect x="26" y="38" width="4" height="14" rx="2" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
  </svg>`,
  'Espalda': `<svg viewBox="0 0 40 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="20" cy="30" rx="11" ry="22" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
    <ellipse cx="14" cy="24" rx="5" ry="7" fill="#22c55e" opacity="0.85"/>
    <ellipse cx="26" cy="24" rx="5" ry="7" fill="#22c55e" opacity="0.85"/>
    <circle cx="20" cy="10" r="5" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
    <rect x="10" y="38" width="4" height="14" rx="2" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
    <rect x="26" y="38" width="4" height="14" rx="2" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
  </svg>`,
  'Pierna': `<svg viewBox="0 0 40 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="20" cy="22" rx="11" ry="14" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
    <circle cx="20" cy="8" r="5" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
    <rect x="10" y="36" width="8" height="22" rx="4" fill="#22c55e" opacity="0.85"/>
    <rect x="22" y="36" width="8" height="22" rx="4" fill="#22c55e" opacity="0.85"/>
  </svg>`,
  'Hombro': `<svg viewBox="0 0 40 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="20" cy="30" rx="11" ry="22" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
    <circle cx="20" cy="10" r="5" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
    <circle cx="9" cy="19" r="4" fill="#22c55e" opacity="0.85"/>
    <circle cx="31" cy="19" r="4" fill="#22c55e" opacity="0.85"/>
    <rect x="10" y="38" width="4" height="14" rx="2" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
    <rect x="26" y="38" width="4" height="14" rx="2" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
  </svg>`,
  'Bíceps': `<svg viewBox="0 0 40 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="20" cy="28" rx="11" ry="18" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
    <circle cx="20" cy="10" r="5" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
    <rect x="10" y="24" width="4" height="14" rx="2" fill="#22c55e" opacity="0.85"/>
    <rect x="26" y="24" width="4" height="14" rx="2" fill="#22c55e" opacity="0.85"/>
    <rect x="10" y="46" width="4" height="10" rx="2" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
    <rect x="26" y="46" width="4" height="10" rx="2" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
  </svg>`,
  'Tríceps': `<svg viewBox="0 0 40 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="20" cy="28" rx="11" ry="18" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
    <circle cx="20" cy="10" r="5" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
    <rect x="9" y="24" width="5" height="16" rx="2.5" fill="#22c55e" opacity="0.85"/>
    <rect x="26" y="24" width="5" height="16" rx="2.5" fill="#22c55e" opacity="0.85"/>
    <rect x="10" y="46" width="4" height="10" rx="2" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
    <rect x="26" y="46" width="4" height="10" rx="2" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
  </svg>`,
  'Core': `<svg viewBox="0 0 40 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="20" cy="30" rx="11" ry="22" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
    <circle cx="20" cy="10" r="5" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
    <rect x="16" y="24" width="8" height="14" rx="2" fill="#22c55e" opacity="0.85"/>
    <rect x="10" y="38" width="4" height="14" rx="2" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
    <rect x="26" y="38" width="4" height="14" rx="2" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
  </svg>`,
  'Cardio': `<svg viewBox="0 0 40 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="20" cy="30" rx="11" ry="22" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
    <circle cx="20" cy="10" r="5" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
    <path d="M14 26 Q17 20 20 26 Q23 32 26 26" stroke="#22c55e" stroke-width="2" fill="none" stroke-linecap="round"/>
    <rect x="10" y="38" width="4" height="14" rx="2" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
    <rect x="26" y="38" width="4" height="14" rx="2" fill="#1d1d1d" stroke="#333" stroke-width="0.8"/>
  </svg>`
};

// ── Exercise picker ───────────────────────────────────────────────────────────
let pickerTargetInput = null;

function openExercisePicker(inputEl) {
  pickerTargetInput = inputEl;
  const overlay = document.getElementById('exercisePickerOverlay');
  overlay.classList.add('open');
  document.getElementById('pickerSearch').value = '';
  renderPickerGroups('');
  setTimeout(() => document.getElementById('pickerSearch').focus(), 150);
}

function closeExercisePicker() {
  document.getElementById('exercisePickerOverlay').classList.remove('open');
  pickerTargetInput = null;
}

function selectExercise(name) {
  if (pickerTargetInput) {
    pickerTargetInput.value = name;
    pickerTargetInput.dispatchEvent(new Event('input'));
    updateOneRM(pickerTargetInput.closest('.exercise-block'));
  }
  closeExercisePicker();
}

function renderPickerGroups(query) {
  const q = query.toLowerCase().trim();
  const container = document.getElementById('pickerGroups');
  container.innerHTML = '';

  // Also include previously used exercises from suggestions
  const usedExercises = [...new Set(EXERCISES_SUGGESTIONS)];

  let hasResults = false;

  // If searching, flatten all exercises
  if (q) {
    const matches = [];
    Object.entries(EXERCISE_DB).forEach(([group, exs]) => {
      exs.forEach(ex => {
        if (ex.toLowerCase().includes(q)) matches.push({ group, ex });
      });
    });
    usedExercises.forEach(ex => {
      if (ex.toLowerCase().includes(q) && !Object.values(EXERCISE_DB).flat().includes(ex)) {
        matches.push({ group: 'Mis ejercicios', ex });
      }
    });

    if (matches.length) {
      hasResults = true;
      const groupDiv = document.createElement('div');
      groupDiv.className = 'picker-group';
      groupDiv.innerHTML = `<div class="picker-group-label">Resultados</div><div class="picker-items"></div>`;
      const itemsDiv = groupDiv.querySelector('.picker-items');
      matches.forEach(({ ex }) => {
        const btn = document.createElement('button');
        btn.className = 'picker-item';
        btn.textContent = ex;
        btn.onclick = () => selectExercise(ex);
        itemsDiv.appendChild(btn);
      });
      container.appendChild(groupDiv);
    }
  } else {
    // Show "Mis ejercicios" first if any
    const customExercises = usedExercises.filter(ex => !Object.values(EXERCISE_DB).flat().includes(ex));
    if (customExercises.length) {
      hasResults = true;
      const groupDiv = createPickerGroup('Mis ejercicios', customExercises, null);
      container.appendChild(groupDiv);
    }

    // Show muscle groups
    Object.entries(EXERCISE_DB).forEach(([group, exercises]) => {
      hasResults = true;
      const groupDiv = createPickerGroup(group, exercises, MUSCLE_SVGS[group]);
      container.appendChild(groupDiv);
    });
  }

  if (!hasResults) {
    container.innerHTML = `<div class="picker-empty">Sin resultados para "<strong>${query}</strong>"<br><span>Escribe el nombre directamente en el campo</span></div>`;
  }
}

function createPickerGroup(group, exercises, svgIcon) {
  const div = document.createElement('div');
  div.className = 'picker-group';

  const labelRow = document.createElement('div');
  labelRow.className = 'picker-group-label';
  if (svgIcon) {
    const iconWrap = document.createElement('span');
    iconWrap.className = 'picker-muscle-icon';
    iconWrap.innerHTML = svgIcon;
    labelRow.appendChild(iconWrap);
  }
  labelRow.appendChild(document.createTextNode(group));
  div.appendChild(labelRow);

  const itemsDiv = document.createElement('div');
  itemsDiv.className = 'picker-items';
  exercises.forEach(ex => {
    const btn = document.createElement('button');
    btn.className = 'picker-item';
    btn.textContent = ex;
    btn.onclick = () => selectExercise(ex);
    itemsDiv.appendChild(btn);
  });
  div.appendChild(itemsDiv);
  return div;
}

// ── Exercises ────────────────────────────────────────────────────────────────
let exerciseCount = 0;

function initLogPage() {
  const dateInput = document.getElementById('sessionDate');
  dateInput.addEventListener('change', () => loadExistingSession(dateInput.value));

  document.querySelectorAll('.muscle-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('active');
      const selected = [...document.querySelectorAll('.muscle-chip.active')].map(c => c.dataset.value);
      document.getElementById('muscleGroup').value = selected.join(', ');
    });
  });

  // Picker search
  const searchInput = document.getElementById('pickerSearch');
  if (searchInput) {
    searchInput.addEventListener('input', () => renderPickerGroups(searchInput.value));
  }

  // Close picker on overlay click
  const overlay = document.getElementById('exercisePickerOverlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeExercisePicker();
    });
  }

  resumeTimerIfRunning();
  loadExistingSession(dateInput.value);
}

function loadExistingSession(dateStr) {
  fetch('/api/sessions/by-date/' + dateStr)
    .then(r => r.json())
    .then(data => {
      document.getElementById('exercisesList').innerHTML = '';
      exerciseCount = 0;

      if (data.session) {
        const s = data.session;
        document.getElementById('sessionDuration').value = s.duration_minutes || '';
        document.getElementById('sessionNotes').value = s.notes || '';
        document.getElementById('editingLabel').textContent = 'Editando sesión existente';
        document.getElementById('saveBtn').textContent = 'Actualizar sesión';

        document.querySelectorAll('.muscle-chip').forEach(c => c.classList.remove('active'));
        document.getElementById('muscleGroup').value = s.muscle_group || '';
        if (s.muscle_group) {
          const saved = s.muscle_group.split(', ');
          document.querySelectorAll('.muscle-chip').forEach(c => {
            if (saved.includes(c.dataset.value)) c.classList.add('active');
          });
        }

        if (data.exercises && data.exercises.length) {
          data.exercises.forEach(ex => {
            const block = addExercise();
            block.querySelector('.exercise-name').value = ex.name;
            if (ex.superset_group) block.dataset.supersetGroup = ex.superset_group;
            const setsContainer = block.querySelector('.sets-container');
            setsContainer.innerHTML = '';
            ex.sets.forEach((s, i) => {
              setsContainer.appendChild(createSetRow(i + 1, s.reps, s.weight));
            });
            updateOneRM(block);
          });
          const allBlocks = [...document.querySelectorAll('.exercise-block')];
          const groups = {};
          allBlocks.forEach(b => {
            const g = b.dataset.supersetGroup;
            if (g) { if (!groups[g]) groups[g] = []; groups[g].push(b); }
          });
          Object.values(groups).forEach(pair => {
            if (pair.length >= 2) {
              pair[0].classList.add('superset-member', 'superset-first');
              pair[1].classList.add('superset-member', 'superset-last');
              pair.forEach(b => {
                const sbtn = b.querySelector('.superset-btn');
                if (sbtn) sbtn.classList.add('active');
              });
            }
          });
        } else {
          addExercise();
        }
      } else {
        document.getElementById('sessionDuration').value = '';
        document.getElementById('sessionNotes').value = '';
        document.getElementById('editingLabel').textContent = '';
        document.getElementById('saveBtn').textContent = 'Guardar sesión';
        document.querySelectorAll('.muscle-chip').forEach(c => c.classList.remove('active'));
        document.getElementById('muscleGroup').value = '';
        addExercise();
      }

      document.getElementById('showSaveRoutineBtn').style.display = 'block';
      document.getElementById('saveRoutineRow').style.display = 'none';
    });
}

function addExercise(name = '') {
  exerciseCount++;
  const id = exerciseCount;
  const div = document.createElement('div');
  div.className = 'exercise-block';
  div.dataset.id = id;
  div.innerHTML = `
    <div class="exercise-header">
      <div class="exercise-name-wrap">
        <input type="text" class="form-input exercise-name" placeholder="Ejercicio (ej: Press de banca)"
               autocomplete="off" value="${name}"
               oninput="updateOneRM(this.closest('.exercise-block'))">
        <button class="picker-open-btn" onclick="openExercisePicker(this.previousElementSibling)" title="Seleccionar ejercicio" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
      </div>
      <button class="superset-btn" onclick="toggleSuperset(this)">🔗 Biserie</button>
      <button class="btn-icon" onclick="removeExercise(this)" title="Eliminar ejercicio">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>
    <div class="sets-container">
      ${createSetRow(1).outerHTML}
    </div>
    <div class="one-rm-display" id="orm-${id}"></div>
    <button class="btn-add-set" onclick="addSet(this)">+ Añadir serie</button>
  `;
  document.getElementById('exercisesList').appendChild(div);
  return div;
}

function createSetRow(num, reps = '', weight = '') {
  const div = document.createElement('div');
  div.className = 'set-row';
  div.innerHTML = `
    <span class="set-label">${num}</span>
    <input type="number" class="form-input set-reps" placeholder="Reps" min="1" max="999" value="${reps ?? ''}"
           oninput="updateOneRM(this.closest('.exercise-block'))">
    <input type="number" class="form-input set-weight" placeholder="lbs" min="0" max="9999" step="0.5" value="${weight ?? ''}"
           oninput="updateOneRM(this.closest('.exercise-block'))">
    <button class="btn-icon" onclick="removeSet(this)" title="Eliminar serie">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;
  return div;
}

function addSet(btn) {
  const container = btn.previousElementSibling.previousElementSibling;
  const num = container.children.length + 1;
  let lastWeight = '';
  if (container.children.length > 0) {
    lastWeight = container.children[container.children.length - 1].querySelector('.set-weight').value;
  }
  const row = createSetRow(num, '', lastWeight);
  container.appendChild(row);
  row.querySelector('.set-reps').focus();
}

function removeSet(btn) {
  const row = btn.closest('.set-row');
  const container = row.parentElement;
  if (container.children.length <= 1) return;
  row.remove();
  Array.from(container.children).forEach((r, i) => {
    r.querySelector('.set-label').textContent = i + 1;
  });
  updateOneRM(container.closest('.exercise-block'));
}

function removeExercise(btn) {
  btn.closest('.exercise-block').remove();
}

// ── 1RM Calculator (promedio Epley + Brzycki + Lander) ───────────────────────
function calcOneRM(weight, reps) {
  if (!weight || !reps || reps <= 0 || weight <= 0) return null;
  if (reps === 1) return Math.round(weight);
  if (reps > 15) return null; // No confiable sobre 15 reps

  const epley   = weight * (1 + reps / 30);
  const brzycki = weight * (36 / (37 - reps));
  const lander  = (100 * weight) / (101.3 - 2.67123 * reps);

  return Math.round((epley + brzycki + lander) / 3);
}

function updateOneRM(block) {
  const id = block.dataset.id;
  const display = document.getElementById('orm-' + id);
  if (!display) return;

  let max1rm = null;
  block.querySelectorAll('.set-row').forEach(row => {
    const reps   = parseInt(row.querySelector('.set-reps').value);
    const weight = parseFloat(row.querySelector('.set-weight').value);
    const orm    = calcOneRM(weight, reps);
    if (orm && (!max1rm || orm > max1rm)) max1rm = orm;
  });

  display.innerHTML = max1rm
    ? `<span class="orm-badge">1RM estimado: <strong>${max1rm} lbs</strong></span>`
    : '';
}

// ── Routines ─────────────────────────────────────────────────────────────────
function loadRoutine() {
  const sel = document.getElementById('routineSelect');
  const rid = sel.value;
  if (!rid) return;

  fetch('/api/routines/' + rid)
    .then(r => r.json())
    .then(exercises => {
      document.getElementById('exercisesList').innerHTML = '';
      exerciseCount = 0;
      if (exercises.length) {
        exercises.forEach(name => addExercise(name));
      } else {
        addExercise();
      }
    });
}

function showSaveRoutine() {
  document.getElementById('saveRoutineRow').style.display = 'flex';
  document.getElementById('showSaveRoutineBtn').style.display = 'none';
  document.getElementById('routineName').focus();
}

function saveRoutine() {
  const name = document.getElementById('routineName').value.trim();
  if (!name) { alert('Escribe un nombre para la rutina'); return; }

  const exercises = [];
  document.querySelectorAll('.exercise-block .exercise-name').forEach(input => {
    const val = input.value.trim();
    if (val) exercises.push(val);
  });

  if (!exercises.length) { alert('Agrega al menos un ejercicio'); return; }

  fetch('/api/routines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, exercises })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        document.getElementById('saveRoutineRow').style.display = 'none';
        document.getElementById('showSaveRoutineBtn').style.display = 'block';
        document.getElementById('routineName').value = '';
        showToast(`✓ Rutina "${data.name}" guardada`);
        // Add to selector if exists
        const sel = document.getElementById('routineSelect');
        if (sel) {
          const exists = [...sel.options].some(o => o.value == data.routine_id);
          if (!exists) {
            const opt = document.createElement('option');
            opt.value = data.routine_id;
            opt.textContent = data.name;
            sel.appendChild(opt);
          }
        }
      } else {
        alert('Error: ' + data.error);
      }
    });
}

// ── Toast notification ────────────────────────────────────────────────────────
function showToast(msg, duration = 3000) {
  let toast = document.getElementById('gymToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'gymToast';
    toast.className = 'gym-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('visible');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('visible'), duration);
}

// ── Save session ──────────────────────────────────────────────────────────────
function saveSession() {
  const dateVal = document.getElementById('sessionDate').value;
  if (!dateVal) { alert('Selecciona una fecha'); return; }

  const duration     = document.getElementById('sessionDuration').value;
  const notes        = document.getElementById('sessionNotes').value.trim();
  const muscle_group = document.getElementById('muscleGroup').value;

  const blocks  = document.querySelectorAll('.exercise-block');
  const entries = [];

  for (const block of blocks) {
    const exerciseName = block.querySelector('.exercise-name').value.trim();
    if (!exerciseName) continue;
    const sets = [];
    for (const row of block.querySelectorAll('.set-row')) {
      const reps   = row.querySelector('.set-reps').value;
      const weight = row.querySelector('.set-weight').value;
      if (reps || weight) {
        sets.push({
          reps:   reps   ? parseInt(reps)   : null,
          weight: weight ? parseFloat(weight) : null
        });
      }
    }
    if (sets.length) entries.push({ exercise: exerciseName, superset_group: block.dataset.supersetGroup || null, sets });
  }

  if (!entries.length) { alert('Agrega al menos un ejercicio con datos'); return; }

  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: dateVal, duration: duration ? parseInt(duration) : null, muscle_group: muscle_group || null, notes, entries })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        // Stop timer if running
        if (localStorage.getItem(TIMER_KEY)) {
          localStorage.removeItem(TIMER_KEY);
          clearInterval(timerInterval);
          timerInterval = null;
          updateTimerUI(false);
          document.getElementById('timerDisplay').textContent = '00:00:00';
        }

        showToast('✓ Sesión guardada correctamente');

        // Auto-clear: reset form and stay on page after short delay
        setTimeout(() => {
          document.getElementById('sessionDuration').value = '';
          document.getElementById('sessionNotes').value   = '';
          document.getElementById('muscleGroup').value    = '';
          document.querySelectorAll('.muscle-chip').forEach(c => c.classList.remove('active'));
          document.getElementById('exercisesList').innerHTML = '';
          exerciseCount = 0;
          document.getElementById('editingLabel').textContent = '';

          // Set date to today for next workout
          const today = new Date().toISOString().split('T')[0];
          document.getElementById('sessionDate').value = today;

          // Re-check if today already has a session or start fresh
          loadExistingSession(today);

          btn.disabled = false;
          btn.textContent = 'Guardar sesión';
          document.getElementById('saveHint').textContent = '';
        }, 1500);

      } else {
        alert('Error: ' + (data.error || 'No se pudo guardar'));
        btn.disabled = false;
        btn.textContent = 'Guardar sesión';
      }
    })
    .catch(() => {
      alert('Error de conexión');
      btn.disabled = false;
      btn.textContent = 'Guardar sesión';
    });
}
