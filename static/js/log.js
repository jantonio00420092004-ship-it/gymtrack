// ── Timer ────────────────────────────────────────────────────────────────────
const TIMER_KEY = 'gymtrack_timer_start';
let timerInterval = null;

function toggleTimer() {
  const running = localStorage.getItem(TIMER_KEY);
  if (running) {
    stopTimer();
  } else {
    startTimer();
  }
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
    document.getElementById('timerHint').textContent = 'Entrenando... presiona para terminar y registrar el tiempo';
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
    // Desagrupar
    [block, nextBlock].forEach(b => {
      if (b.dataset.supersetGroup === currentGroup) {
        delete b.dataset.supersetGroup;
        b.classList.remove('superset-member', 'superset-first', 'superset-last');
        const sbtn = b.querySelector('.superset-btn');
        if (sbtn) { sbtn.textContent = '🔗 Biserie'; sbtn.classList.remove('active'); }
      }
    });
  } else {
    // Agrupar
    const letter = String.fromCharCode(65 + (supersetCounter++ % 26));
    block.dataset.supersetGroup = letter;
    nextBlock.dataset.supersetGroup = letter;
    block.classList.add('superset-member', 'superset-first');
    nextBlock.classList.add('superset-member', 'superset-last');
    const b1 = block.querySelector('.superset-btn');
    const b2 = nextBlock.querySelector('.superset-btn');
    if (b1) { b1.textContent = `🔗 Biserie`; b1.classList.add('active'); }
    if (b2) { b2.textContent = `🔗 Biserie`; b2.classList.add('active'); }
  }
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
          // Build exercise blocks
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
          // Restore superset visuals
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
  const div = document.createElement('div');
  div.className = 'exercise-block';
  div.dataset.id = exerciseCount;
  div.innerHTML = `
    <div class="exercise-header">
      <input type="text" class="form-input exercise-name" placeholder="Ejercicio (ej: Press de banca)"
             list="exercisesSuggestions" autocomplete="off" value="${name}"
             oninput="updateOneRM(this.closest('.exercise-block'))">
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
    <div class="one-rm-display" id="orm-${exerciseCount}"></div>
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

// ── 1RM Calculator (Epley formula) ───────────────────────────────────────────
function calcOneRM(weight, reps) {
  if (!weight || !reps || reps <= 0) return null;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

function updateOneRM(block) {
  const id = block.dataset.id;
  const display = document.getElementById('orm-' + id);
  if (!display) return;

  let max1rm = null;
  block.querySelectorAll('.set-row').forEach(row => {
    const reps = parseInt(row.querySelector('.set-reps').value);
    const weight = parseFloat(row.querySelector('.set-weight').value);
    const orm = calcOneRM(weight, reps);
    if (orm && (!max1rm || orm > max1rm)) max1rm = orm;
  });

  if (max1rm) {
    display.innerHTML = `<span class="orm-badge">1RM estimado: <strong>${max1rm} lbs</strong></span>`;
  } else {
    display.innerHTML = '';
  }
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
        alert(`✓ Rutina "${data.name}" guardada`);
        location.reload();
      } else {
        alert('Error: ' + data.error);
      }
    });
}

// ── Save session ──────────────────────────────────────────────────────────────
function saveSession() {
  const date = document.getElementById('sessionDate').value;
  if (!date) { alert('Selecciona una fecha'); return; }

  const duration = document.getElementById('sessionDuration').value;
  const notes = document.getElementById('sessionNotes').value.trim();
  const muscle_group = document.getElementById('muscleGroup').value;

  const blocks = document.querySelectorAll('.exercise-block');
  const entries = [];

  for (const block of blocks) {
    const exerciseName = block.querySelector('.exercise-name').value.trim();
    if (!exerciseName) continue;
    const sets = [];
    for (const row of block.querySelectorAll('.set-row')) {
      const reps = row.querySelector('.set-reps').value;
      const weight = row.querySelector('.set-weight').value;
      if (reps || weight) {
        sets.push({
          reps: reps ? parseInt(reps) : null,
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
    body: JSON.stringify({ date, duration: duration ? parseInt(duration) : null, muscle_group: muscle_group || null, notes, entries })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        if (localStorage.getItem(TIMER_KEY)) {
          localStorage.removeItem(TIMER_KEY);
          clearInterval(timerInterval);
        }
        document.getElementById('saveHint').textContent = '✓ Sesión guardada';
        setTimeout(() => { window.location.href = '/'; }, 800);
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
