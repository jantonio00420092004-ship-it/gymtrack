from flask import Flask, render_template, request, jsonify
import sqlite3
import os
from datetime import date, timedelta

app = Flask(__name__)
DATABASE = os.environ.get('DATABASE_PATH', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'workout.db'))


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    db_dir = os.path.dirname(DATABASE)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    conn = get_db()
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL UNIQUE,
            duration_minutes INTEGER,
            muscle_group TEXT,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            exercise TEXT NOT NULL,
            set_number INTEGER NOT NULL,
            reps INTEGER,
            weight_lbs REAL,
            superset_group TEXT,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS routines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS routine_exercises (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            routine_id INTEGER NOT NULL,
            exercise_name TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0,
            FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE
        );
    ''')
    # Migrations for existing deployments
    for col_sql in [
        'ALTER TABLE sessions ADD COLUMN muscle_group TEXT',
        'ALTER TABLE entries ADD COLUMN weight_lbs REAL',
        'ALTER TABLE entries ADD COLUMN superset_group TEXT',
    ]:
        try:
            conn.execute(col_sql)
            conn.commit()
        except Exception:
            pass
    # Migrate old weight_kg data to weight_lbs
    try:
        conn.execute('UPDATE entries SET weight_lbs = weight_kg WHERE weight_lbs IS NULL AND weight_kg IS NOT NULL')
        conn.commit()
    except Exception:
        pass
    conn.commit()
    conn.close()


def generate_calendar(trained_set, weeks=17):
    today = date.today()
    start = today - timedelta(weeks=weeks)
    start = start - timedelta(days=start.weekday())
    calendar = []
    current = start
    while current <= today:
        week = []
        for i in range(7):
            d = current + timedelta(days=i)
            if d > today:
                week.append(None)
            else:
                week.append({
                    'date': d.isoformat(),
                    'trained': d.isoformat() in trained_set,
                    'day': d.day,
                })
        calendar.append(week)
        current += timedelta(weeks=1)
    return calendar


with app.app_context():
    init_db()


@app.route('/')
def index():
    db = get_db()

    sessions = db.execute('''
        SELECT s.id, s.date, s.duration_minutes, s.muscle_group,
               COUNT(DISTINCT e.exercise) as exercise_count,
               COALESCE(ROUND(SUM(e.weight_lbs * e.reps), 0), 0) as volume
        FROM sessions s
        LEFT JOIN entries e ON s.id = e.session_id
        GROUP BY s.id
        ORDER BY s.date DESC
        LIMIT 6
    ''').fetchall()

    total_sessions = db.execute('SELECT COUNT(*) FROM sessions').fetchone()[0]
    this_month = date.today().strftime('%Y-%m')
    sessions_this_month = db.execute(
        "SELECT COUNT(*) FROM sessions WHERE date LIKE ?", (f'{this_month}%',)
    ).fetchone()[0]
    total_volume = db.execute('SELECT COALESCE(SUM(weight_lbs * reps), 0) FROM entries').fetchone()[0] or 0

    trained_dates = [r['date'] for r in db.execute(
        "SELECT date FROM sessions WHERE date >= date('now', '-130 days')"
    ).fetchall()]

    all_dates = sorted([r['date'] for r in db.execute(
        'SELECT date FROM sessions ORDER BY date DESC'
    ).fetchall()], reverse=True)
    db.close()

    streak = 0
    check = date.today()
    for d in all_dates:
        d_date = date.fromisoformat(d)
        diff = (check - d_date).days
        if diff <= 1:
            streak += 1
            check = d_date - timedelta(days=1)
        else:
            break

    calendar = generate_calendar(set(trained_dates))

    return render_template('index.html',
                           sessions=sessions,
                           total_sessions=total_sessions,
                           sessions_this_month=sessions_this_month,
                           total_volume=int(total_volume),
                           calendar=calendar,
                           streak=streak)


@app.route('/log')
def log_page():
    db = get_db()
    exercises = [e['exercise'] for e in
                 db.execute('SELECT DISTINCT exercise FROM entries ORDER BY exercise').fetchall()]
    routines = [dict(r) for r in
                db.execute('SELECT id, name FROM routines ORDER BY name').fetchall()]
    db.close()
    return render_template('log.html', exercises=exercises, routines=routines, today=date.today().isoformat())


@app.route('/progress')
def progress():
    db = get_db()
    exercises = [e['exercise'] for e in
                 db.execute('SELECT DISTINCT exercise FROM entries ORDER BY exercise').fetchall()]
    db.close()
    return render_template('progress.html', exercises=exercises)


@app.route('/stats')
def stats():
    db = get_db()
    total_sessions = db.execute('SELECT COUNT(*) FROM sessions').fetchone()[0]
    total_volume = db.execute('SELECT COALESCE(SUM(weight_lbs * reps), 0) FROM entries').fetchone()[0] or 0
    avg_duration = db.execute('SELECT AVG(duration_minutes) FROM sessions WHERE duration_minutes IS NOT NULL').fetchone()[0] or 0
    total_exercises = db.execute('SELECT COUNT(DISTINCT exercise) FROM entries').fetchone()[0]

    top_exercises = db.execute('''
        SELECT exercise,
               COUNT(DISTINCT session_id) as sessions,
               MAX(weight_lbs) as pr,
               SUM(reps) as total_reps
        FROM entries
        GROUP BY exercise
        ORDER BY sessions DESC
        LIMIT 10
    ''').fetchall()

    records = db.execute('''
        SELECT e.exercise, MAX(e.weight_lbs) as max_weight, s.date as record_date
        FROM entries e
        JOIN sessions s ON e.session_id = s.id
        GROUP BY e.exercise
        ORDER BY e.exercise
    ''').fetchall()

    monthly = list(reversed(db.execute('''
        SELECT strftime('%Y-%m', date) as month, COUNT(*) as count
        FROM sessions GROUP BY month ORDER BY month DESC LIMIT 12
    ''').fetchall()))

    db.close()
    return render_template('stats.html',
                           total_sessions=total_sessions,
                           total_volume=int(total_volume),
                           avg_duration=int(avg_duration),
                           total_exercises=total_exercises,
                           top_exercises=top_exercises,
                           records=records,
                           monthly=monthly)


# ── API ──────────────────────────────────────────────────────────────────────

@app.route('/api/sessions', methods=['POST'])
def save_session():
    data = request.get_json()
    if not data or not data.get('date'):
        return jsonify({'error': 'date required'}), 400

    db = get_db()
    try:
        existing = db.execute('SELECT id FROM sessions WHERE date=?', (data['date'],)).fetchone()
        if existing:
            session_id = existing['id']
            db.execute('UPDATE sessions SET duration_minutes=?, muscle_group=?, notes=? WHERE id=?',
                       (data.get('duration'), data.get('muscle_group'), data.get('notes', ''), session_id))
            db.execute('DELETE FROM entries WHERE session_id=?', (session_id,))
        else:
            cur = db.execute(
                'INSERT INTO sessions (date, duration_minutes, muscle_group, notes) VALUES (?,?,?,?)',
                (data['date'], data.get('duration'), data.get('muscle_group'), data.get('notes', ''))
            )
            session_id = cur.lastrowid

        for ex in data.get('entries', []):
            name = ex.get('exercise', '').strip()
            if not name:
                continue
            for i, s in enumerate(ex.get('sets', []), 1):
                reps = s.get('reps')
                weight = s.get('weight')
                if reps or weight:
                    db.execute(
                        'INSERT INTO entries (session_id, exercise, set_number, reps, weight_lbs, superset_group) VALUES (?,?,?,?,?,?)',
                        (session_id, name, i, reps, weight, ex.get('superset_group'))
                    )

        db.commit()
        return jsonify({'success': True, 'session_id': session_id})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@app.route('/api/sessions/by-date/<date_str>')
def get_session_by_date(date_str):
    db = get_db()
    session = db.execute('SELECT * FROM sessions WHERE date=?', (date_str,)).fetchone()
    if not session:
        db.close()
        return jsonify({'session': None, 'exercises': []})

    entries = db.execute(
        'SELECT * FROM entries WHERE session_id=? ORDER BY exercise, set_number', (session['id'],)
    ).fetchall()
    db.close()

    ex_map = {}
    for e in entries:
        name = e['exercise']
        if name not in ex_map:
            ex_map[name] = {'sets': [], 'superset_group': e['superset_group']}
        ex_map[name]['sets'].append({'set': e['set_number'], 'reps': e['reps'], 'weight': e['weight_lbs']})

    return jsonify({
        'session': dict(session),
        'exercises': [{'name': k, 'sets': v['sets'], 'superset_group': v['superset_group']} for k, v in ex_map.items()]
    })


@app.route('/api/sessions/<int:sid>', methods=['GET'])
def get_session(sid):
    db = get_db()
    session = db.execute('SELECT * FROM sessions WHERE id=?', (sid,)).fetchone()
    if not session:
        db.close()
        return jsonify({'error': 'not found'}), 404

    entries = db.execute(
        'SELECT * FROM entries WHERE session_id=? ORDER BY exercise, set_number', (sid,)
    ).fetchall()
    db.close()

    ex_map = {}
    for e in entries:
        name = e['exercise']
        if name not in ex_map:
            ex_map[name] = {'sets': [], 'superset_group': e['superset_group']}
        ex_map[name]['sets'].append({'set': e['set_number'], 'reps': e['reps'], 'weight': e['weight_lbs']})

    return jsonify({
        'session': dict(session),
        'exercises': [{'name': k, 'sets': v['sets'], 'superset_group': v['superset_group']} for k, v in ex_map.items()]
    })


@app.route('/api/sessions/<int:sid>', methods=['DELETE'])
def delete_session(sid):
    db = get_db()
    db.execute('DELETE FROM sessions WHERE id=?', (sid,))
    db.commit()
    db.close()
    return jsonify({'success': True})


@app.route('/api/progress/<path:exercise>')
def get_progress(exercise):
    db = get_db()
    data = db.execute('''
        SELECT s.date,
               MAX(e.weight_lbs) as max_weight,
               ROUND(SUM(e.weight_lbs * e.reps), 1) as volume,
               COUNT(e.id) as total_sets,
               SUM(e.reps) as total_reps,
               ROUND(MAX(e.weight_lbs * (1 + CAST(e.reps AS REAL) / 30.0)), 1) as est_1rm
        FROM entries e
        JOIN sessions s ON e.session_id = s.id
        WHERE LOWER(e.exercise) = LOWER(?)
        GROUP BY s.date
        ORDER BY s.date
    ''', (exercise,)).fetchall()
    db.close()
    return jsonify([dict(d) for d in data])


# ── Routines API ──────────────────────────────────────────────────────────────

@app.route('/api/routines', methods=['GET'])
def get_routines():
    db = get_db()
    routines = db.execute('SELECT * FROM routines ORDER BY name').fetchall()
    db.close()
    return jsonify([dict(r) for r in routines])


@app.route('/api/routines/<int:rid>', methods=['GET'])
def get_routine(rid):
    db = get_db()
    exercises = db.execute(
        'SELECT exercise_name FROM routine_exercises WHERE routine_id=? ORDER BY sort_order',
        (rid,)
    ).fetchall()
    db.close()
    return jsonify([e['exercise_name'] for e in exercises])


@app.route('/api/routines', methods=['POST'])
def save_routine():
    data = request.get_json()
    name = (data.get('name') or '').strip()
    exercises = data.get('exercises', [])
    if not name or not exercises:
        return jsonify({'error': 'name and exercises required'}), 400

    db = get_db()
    try:
        existing = db.execute('SELECT id FROM routines WHERE name=?', (name,)).fetchone()
        if existing:
            rid = existing['id']
            db.execute('DELETE FROM routine_exercises WHERE routine_id=?', (rid,))
        else:
            cur = db.execute('INSERT INTO routines (name) VALUES (?)', (name,))
            rid = cur.lastrowid

        for i, ex in enumerate(exercises):
            db.execute(
                'INSERT INTO routine_exercises (routine_id, exercise_name, sort_order) VALUES (?,?,?)',
                (rid, ex, i)
            )
        db.commit()
        return jsonify({'success': True, 'routine_id': rid, 'name': name})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@app.route('/api/routines/<int:rid>', methods=['DELETE'])
def delete_routine(rid):
    db = get_db()
    db.execute('DELETE FROM routines WHERE id=?', (rid,))
    db.commit()
    db.close()
    return jsonify({'success': True})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
