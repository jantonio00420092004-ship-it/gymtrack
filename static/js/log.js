let exerciseCount = 0;

function initLogPage() {
  const dateInput = document.getElementById('sessionDate');
  dateInput.addEventListener('change', () => loadExistingSession(dateInput.value));
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

        if (data.exercises && data.exercises.length) {
          data.exercises.forEach(ex => {
            const block = addExercise();
            block.querySelector('.exercise-name').value = ex.name;
            const setsContainer = block.querySelector('.sets-container');
            setsContainer.innerHTML = '';
            ex.sets.forEach((s, i) => {
              setsContainer.appendChild(createSetRow(i + 1, s.reps, s.weight));
            });
          });
        } else {
          addExercise();
        }
      } else {
        document.getElementById('sessionDuration').value = '';
        document.getElementById('sessionNotes').value = '';
        document.getElementById('editingLabel').textContent = '';
        document.getElementById('saveBtn').textContent = 'Guardar sesión';
        addExercise();
      }
    });
}

function addExercise() {
  exerciseCount++;
  const id = exerciseCount;
  const div = document.createElement('div');
  div.className = 'exercise-block';
  div.dataset.id = id;
  div.innerHTML = `
    <div class="exercise-header">
      <input type="text" class="form-input exercise-name" placeholder="Ejercicio (ej: Press de banca)" list="exercisesSuggestions" autocomplete="off">
      <button class="btn-icon" onclick="removeExercise(this)" title="Eliminar ejercicio">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>
    <div class="sets-container">
      ${createSetRow(1).outerHTML}
    </div>
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
    <input type="number" class="form-input set-reps" placeholder="Reps" min="1" max="999" value="${reps ?? ''}">
    <input type="number" class="form-input set-weight" placeholder="kg" min="0" max="999" step="0.5" value="${weight ?? ''}">
    <button class="btn-icon" onclick="removeSet(this)" title="Eliminar serie">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;
  return div;
}

function addSet(btn) {
  const container = btn.previousElementSibling;
  const num = container.children.length + 1;

  // Copy weight from last set for convenience
  let lastWeight = '';
  if (container.children.length > 0) {
    const lastSet = container.children[container.children.length - 1];
    lastWeight = lastSet.querySelector('.set-weight').value;
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
  // Renumber
  Array.from(container.children).forEach((r, i) => {
    r.querySelector('.set-label').textContent = i + 1;
  });
}

function removeExercise(btn) {
  btn.closest('.exercise-block').remove();
}

function saveSession() {
  const date = document.getElementById('sessionDate').value;
  if (!date) { alert('Selecciona una fecha'); return; }

  const duration = document.getElementById('sessionDuration').value;
  const notes = document.getElementById('sessionNotes').value.trim();

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
    if (sets.length) entries.push({ exercise: exerciseName, sets });
  }

  if (!entries.length) {
    alert('Agrega al menos un ejercicio con datos');
    return;
  }

  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, duration: duration ? parseInt(duration) : null, notes, entries })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
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
