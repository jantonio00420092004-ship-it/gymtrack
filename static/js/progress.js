let weightChart = null;
let volumeChart = null;

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: { display: false } },
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.05)' },
      ticks: { color: '#a3a3a3', maxTicksLimit: 8, font: { size: 11 } }
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.05)' },
      ticks: { color: '#a3a3a3', font: { size: 11 } },
      beginAtZero: false
    }
  }
};

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

function loadProgress() {
  const exercise = document.getElementById('exerciseSelect').value;
  if (!exercise) {
    document.getElementById('progressContent').style.display = 'none';
    document.getElementById('emptyProgress').style.display = 'none';
    return;
  }

  fetch('/api/progress/' + encodeURIComponent(exercise))
    .then(r => r.json())
    .then(data => {
      if (!data.length) {
        document.getElementById('progressContent').style.display = 'none';
        document.getElementById('emptyProgress').style.display = 'block';
        return;
      }

      document.getElementById('progressContent').style.display = 'block';
      document.getElementById('emptyProgress').style.display = 'none';

      const labels = data.map(d => formatDate(d.date));
      const weights = data.map(d => d.max_weight);
      const volumes = data.map(d => d.volume);

      // PR badge
      const pr = Math.max(...weights.filter(w => w != null));
      document.getElementById('prValue').textContent = pr + ' kg';

      // Weight chart
      if (weightChart) weightChart.destroy();
      weightChart = new Chart(document.getElementById('weightChart'), {
        type: 'line',
        data: {
          labels,
          datasets: [{
            data: weights,
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34,197,94,0.08)',
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: '#22c55e',
            pointHoverRadius: 6,
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          ...CHART_DEFAULTS,
          scales: {
            ...CHART_DEFAULTS.scales,
            y: {
              ...CHART_DEFAULTS.scales.y,
              ticks: {
                ...CHART_DEFAULTS.scales.y.ticks,
                callback: v => v + ' kg'
              }
            }
          },
          plugins: {
            ...CHART_DEFAULTS.plugins,
            tooltip: {
              callbacks: {
                label: ctx => ctx.parsed.y + ' kg'
              }
            }
          }
        }
      });

      // Volume chart
      if (volumeChart) volumeChart.destroy();
      volumeChart = new Chart(document.getElementById('volumeChart'), {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data: volumes,
            backgroundColor: 'rgba(34,197,94,0.5)',
            borderColor: '#22c55e',
            borderWidth: 1,
            borderRadius: 4,
          }]
        },
        options: {
          ...CHART_DEFAULTS,
          scales: {
            ...CHART_DEFAULTS.scales,
            y: {
              ...CHART_DEFAULTS.scales.y,
              beginAtZero: true,
              ticks: {
                ...CHART_DEFAULTS.scales.y.ticks,
                callback: v => v + ' kg'
              }
            }
          },
          plugins: {
            ...CHART_DEFAULTS.plugins,
            tooltip: { callbacks: { label: ctx => ctx.parsed.y + ' kg vol.' } }
          }
        }
      });

      // History table
      const tbody = document.getElementById('historyBody');
      tbody.innerHTML = [...data].reverse().map(d => `
        <tr>
          <td>${d.date}</td>
          <td class="accent-text">${d.max_weight ?? '—'} kg</td>
          <td>${d.total_sets ?? '—'}</td>
          <td>${d.total_reps ?? '—'}</td>
          <td>${d.volume ?? '—'} kg</td>
        </tr>
      `).join('');
    });
}

// Auto-load if query param ?ex= is present
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const ex = params.get('ex');
  if (ex) {
    const sel = document.getElementById('exerciseSelect');
    if (sel) {
      for (const opt of sel.options) {
        if (opt.value.toLowerCase() === ex.toLowerCase()) {
          sel.value = opt.value;
          loadProgress();
          break;
        }
      }
    }
  }
});
