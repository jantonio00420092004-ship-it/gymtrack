from flask import Flask, render_template, request, jsonify
import os
from datetime import date, timedelta

app = Flask(__name__)

# ── Database abstraction (SQLite local / PostgreSQL on Render) ─────────────────

DATABASE_URL = os.environ.get('DATABASE_URL')  # Set by Render free PostgreSQL

if DATABASE_URL:
    import psycopg2
    import psycopg2.extras

    def get_db():
        conn = psycopg2.connect(DATABASE_URL)
        return conn

    def qmark(sql):
        """Convert ? placeholders to %s for psycopg2."""
        return sql.replace('?', '%s')

    def fetchall(cur):
        return [dict(r) for r in cur.fetchall()]

    def fetchone(cur):
        row = cur.fetchone()
        return dict(row) if row else None

    def row_value(row, key):
        if row is None:
            return None
        if isinstance(row, dict):
            return row.get(key)
        return row[key]

    DB_MODE = 'pg'
else:
    import sqlite3
    DATABASE = os.environ.get('DATABASE_PATH',
                              os.path.join(os.path.dirname(os.path.abspath(__file__)), 'workout.db'))

    def get_db():
        conn = sqlite3.connect(DATABASE)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def qmark(sql):
        return sql

    def fetchall(cur):
        rows = cur.fetchall()
        return [dict(r) for r in rows]

    def fetchone(cur):
        row = cur.fetchone()
        return dict(row) if row else None

    def row_value(row, key):
        if row is None:
            return None
        if isinstance(row, dict):
            return row.get(key)
        return row[key]

    DB_MODE = 'sqlite'


def db_execute(conn, sql, params=()):
    """Execute a query, auto-converting ? to %s for PostgreSQL."""
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) if DB_MODE == 'pg' else conn.cursor()
    cur.execute(qmark(sql), params)
    return cur


def db_insert(conn, sql, params=()):
    """Execute an INSERT and return the new row id."""
    if DB_MODE == 'pg':
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        # Replace last ) with RETURNING id)
        pg_sql = qmark(sql) + ' RETURNING id'
        cur.execute(pg_sql, params)
        row = cur.fetchone()
        return row['id']
    else:
        cur = conn.cursor()
        cur.execute(sql, params)
        return cur.lastrowid


def sql_date_ago(days):
    if DB_MODE == 'pg':
        return f"(CURRENT_DATE - INTERVAL '{days} days')::TEXT"
    return f"date('now', '-{days} days')"


def sql_month(col):
    if DB_MODE == 'pg':
        return f"TO_CHAR({col}::date, 'YYYY-MM')"
    return f"strftime('%Y-%m', {col})"


def sql_now():
    if DB_MODE == 'pg':
        return 'NOW()'
    return "datetime('now')"


def sql_like_month(col, month):
    if DB_MODE == 'pg':
        return f"{col}::TEXT LIKE %s"
    return f"{col} LIKE ?"


# ── Schema ────────────────────────────────────────────────────────────────────

def init_db():
    if DB_MODE == 'sqlite':
        db_dir = os.path.dirname(DATABASE)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)

    conn = get_db()

    if DB_MODE == 'pg':
        cur = conn.cursor()
        cur.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                id SERIAL PRIMARY KEY,
                date TEXT NOT NULL UNIQUE,
                duration_minutes INTEGER,
                muscle_group TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        ''')
        cur.execute('''
            CREATE TABLE IF NOT EXISTS entries (
                id SERIAL PRIMARY KEY,
                session_id INTEGER NOT NULL,
                exercise TEXT NOT NULL,
                set_number INTEGER NOT NULL,
                reps INTEGER,
                weight_lbs REAL,
                superset_group TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
            )
        ''')
        cur.execute('''
            CREATE TABLE IF NOT EXISTS routines (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        ''')
        cur.execute('''
            CREATE TABLE IF NOT EXISTS routine_exercises (
                id SERIAL PRIMARY KEY,
                routine_id INTEGER NOT NULL,
                exercise_name TEXT NOT NULL,
                sort_order INTEGER DEFAULT 0,
                FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE
            )
        ''')
        conn.commit()
    else:
        conn.executescript(f'''
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL UNIQUE,
                duration_minutes INTEGER,
                muscle_group TEXT,
                notes TEXT,
                created_at TEXT DEFAULT ({sql_now()})
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
                created_at TEXT DEFAULT ({sql_now()})
            );
            CREATE TABLE IF NOT EXISTS routine_exercises (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                routine_id INTEGER NOT NULL,
                exercise_name TEXT NOT NULL,
                sort_order INTEGER DEFAULT 0,
                FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE
            );
        ''')
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
        conn.commit()

    conn.close()


# ── Calendar helper ────────────────────────────────────────────────────────────

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


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    conn = get_db()

    sessions = fetchall(db_execute(conn, '''
        SELECT s.id, s.date, s.duration_minutes, s.muscle_group,
               COUNT(DISTINCT e.exercise) as exercise_count,
               COALESCE(ROUND(SUM(e.weight_lbs * e.reps)), 0) as volume
        FROM sessions s
        LEFT JOIN entries e ON s.id = e.session_id
        GROUP BY s.id, s.date, s.duration_minutes, s.muscle_group
        ORDER BY s.date DESC
        LIMIT 6
    '''))

    total_sessions = fetchone(db_execute(conn, 'SELECT COUNT(*) as cnt FROM sessions'))['cnt']
    this_month = date.today().strftime('%Y-%m')
    sessions_this_month = fetchone(db_execute(conn,
        f"SELECT COUNT(*) as cnt FROM sessions WHERE {sql_like_month('date', this_month)}",
        (f'{this_month}%',)
    ))['cnt']
    total_volume = fetchone(db_execute(conn,
        'SELECT COALESCE(SUM(weight_lbs * reps), 0) as vol FROM entries'
    ))['vol'] or 0

    trained_dates = [r['date'] for r in fetchall(db_execute(conn,
        f"SELECT date FROM sessions WHERE date >= {sql_date_ago(130)}"
    ))]

    all_dates = sorted([r['date'] for r in fetchall(db_execute(conn,
        'SELECT date FROM sessions ORDER BY date DESC'
    ))], reverse=True)

    conn.close()

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
    conn = get_db()
    exercises = [r['exercise'] for r in fetchall(db_execute(conn,
        'SELECT DISTINCT exercise FROM entries ORDER BY exercise'
    ))]
    routines = fetchall(db_execute(conn, 'SELECT id, name FROM routines ORDER BY name'))
    conn.close()
    return render_template('log.html', exercises=exercises, routines=routines, today=date.today().isoformat())


@app.route('/progress')
def progress():
    conn = get_db()
    exercises = [r['exercise'] for r in fetchall(db_execute(conn,
        'SELECT DISTINCT exercise FROM entries ORDER BY exercise'
    ))]
    conn.close()
    return render_template('progress.html', exercises=exercises)


@app.route('/stats')
def stats():
    conn = get_db()
    total_sessions = fetchone(db_execute(conn, 'SELECT COUNT(*) as cnt FROM sessions'))['cnt']
    total_volume = fetchone(db_execute(conn,
        'SELECT COALESCE(SUM(weight_lbs * reps), 0) as vol FROM entries'
    ))['vol'] or 0
    avg_duration = fetchone(db_execute(conn,
        'SELECT AVG(duration_minutes) as avg FROM sessions WHERE duration_minutes IS NOT NULL'
    ))['avg'] or 0
    total_exercises = fetchone(db_execute(conn,
        'SELECT COUNT(DISTINCT exercise) as cnt FROM entries'
    ))['cnt']

    top_exercises = fetchall(db_execute(conn, '''
        SELECT exercise,
               COUNT(DISTINCT session_id) as sessions,
               MAX(weight_lbs) as pr,
               SUM(reps) as total_reps
        FROM entries
        GROUP BY exercise
        ORDER BY sessions DESC
        LIMIT 10
    '''))

    records = fetchall(db_execute(conn, '''
        SELECT e.exercise, MAX(e.weight_lbs) as max_weight, MAX(s.date) as record_date
        FROM entries e
        JOIN sessions s ON e.session_id = s.id
        GROUP BY e.exercise
        ORDER BY e.exercise
    '''))

    monthly = list(reversed(fetchall(db_execute(conn, f'''
        SELECT {sql_month('date')} as month, COUNT(*) as count
        FROM sessions GROUP BY {sql_month('date')} ORDER BY month DESC LIMIT 12
    '''))))

    conn.close()
    return render_template('stats.html',
                           total_sessions=total_sessions,
                           total_volume=int(total_volume),
                           avg_duration=int(avg_duration),
                           total_exercises=total_exercises,
                           top_exercises=top_exercises,
                           records=records,
                           monthly=monthly)


@app.route('/routines')
def routines_page():
    conn = get_db()
    routines_raw = fetchall(db_execute(conn, 'SELECT id, name, created_at FROM routines ORDER BY name'))
    routines = []
    for r in routines_raw:
        exercises = [e['exercise_name'] for e in fetchall(db_execute(conn,
            'SELECT exercise_name FROM routine_exercises WHERE routine_id = ? ORDER BY sort_order',
            (r['id'],)
        ))]
        routines.append({'id': r['id'], 'name': r['name'], 'exercises': exercises})
    conn.close()
    return render_template('routines.html', routines=routines)


# ── API ───────────────────────────────────────────────────────────────────────

@app.route('/api/sessions', methods=['POST'])
def save_session():
    data = request.get_json()
    if not data or not data.get('date'):
        return jsonify({'error': 'date required'}), 400

    conn = get_db()
    try:
        existing = fetchone(db_execute(conn, 'SELECT id FROM sessions WHERE date=?', (data['date'],)))
        if existing:
            session_id = existing['id']
            db_execute(conn, 'UPDATE sessions SET duration_minutes=?, muscle_group=?, notes=? WHERE id=?',
                       (data.get('duration'), data.get('muscle_group'), data.get('notes', ''), session_id))
            db_execute(conn, 'DELETE FROM entries WHERE session_id=?', (session_id,))
        else:
            session_id = db_insert(conn,
                'INSERT INTO sessions (date, duration_minutes, muscle_group, notes) VALUES (?,?,?,?)',
                (data['date'], data.get('duration'), data.get('muscle_group'), data.get('notes', ''))
            )

        for ex in data.get('entries', []):
            name = ex.get('exercise', '').strip()
            if not name:
                continue
            for i, s in enumerate(ex.get('sets', []), 1):
                reps = s.get('reps')
                weight = s.get('weight')
                if reps or weight:
                    db_insert(conn,
                        'INSERT INTO entries (session_id, exercise, set_number, reps, weight_lbs, superset_group) VALUES (?,?,?,?,?,?)',
                        (session_id, name, i, reps, weight, ex.get('superset_group'))
                    )

        conn.commit()
        return jsonify({'success': True, 'session_id': session_id})
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@app.route('/api/sessions/by-date/<date_str>')
def get_session_by_date(date_str):
    conn = get_db()
    session = fetchone(db_execute(conn, 'SELECT * FROM sessions WHERE date=?', (date_str,)))
    if not session:
        conn.close()
        return jsonify({'session': None, 'exercises': []})

    entries = fetchall(db_execute(conn,
        'SELECT * FROM entries WHERE session_id=? ORDER BY exercise, set_number', (session['id'],)
    ))
    conn.close()

    ex_map = {}
    for e in entries:
        name = e['exercise']
        if name not in ex_map:
            ex_map[name] = {'sets': [], 'superset_group': e['superset_group']}
        ex_map[name]['sets'].append({'set': e['set_number'], 'reps': e['reps'], 'weight': e['weight_lbs']})

    return jsonify({
        'session': session,
        'exercises': [{'name': k, 'sets': v['sets'], 'superset_group': v['superset_group']} for k, v in ex_map.items()]
    })


@app.route('/api/sessions/<int:sid>', methods=['GET'])
def get_session(sid):
    conn = get_db()
    session = fetchone(db_execute(conn, 'SELECT * FROM sessions WHERE id=?', (sid,)))
    if not session:
        conn.close()
        return jsonify({'error': 'not found'}), 404

    entries = fetchall(db_execute(conn,
        'SELECT * FROM entries WHERE session_id=? ORDER BY exercise, set_number', (sid,)
    ))
    conn.close()

    ex_map = {}
    for e in entries:
        name = e['exercise']
        if name not in ex_map:
            ex_map[name] = {'sets': [], 'superset_group': e['superset_group']}
        ex_map[name]['sets'].append({'set': e['set_number'], 'reps': e['reps'], 'weight': e['weight_lbs']})

    return jsonify({
        'session': session,
        'exercises': [{'name': k, 'sets': v['sets'], 'superset_group': v['superset_group']} for k, v in ex_map.items()]
    })


@app.route('/api/sessions/<int:sid>', methods=['DELETE'])
def delete_session(sid):
    conn = get_db()
    db_execute(conn, 'DELETE FROM sessions WHERE id=?', (sid,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


@app.route('/api/progress/<path:exercise>')
def get_progress(exercise):
    conn = get_db()
    data = fetchall(db_execute(conn, '''
        SELECT s.date,
               MAX(e.weight_lbs) as max_weight,
               ROUND(CAST(SUM(e.weight_lbs * e.reps) AS NUMERIC), 1) as volume,
               COUNT(e.id) as total_sets,
               SUM(e.reps) as total_reps,
               ROUND(CAST(MAX(e.weight_lbs * (1 + CAST(e.reps AS REAL) / 30.0)) AS NUMERIC), 1) as est_1rm
        FROM entries e
        JOIN sessions s ON e.session_id = s.id
        WHERE LOWER(e.exercise) = LOWER(?)
        GROUP BY s.date
        ORDER BY s.date
    ''', (exercise,)))
    conn.close()
    return jsonify(data)


# ── Routines API ──────────────────────────────────────────────────────────────

@app.route('/api/routines', methods=['GET'])
def get_routines():
    conn = get_db()
    routines = fetchall(db_execute(conn, 'SELECT * FROM routines ORDER BY name'))
    conn.close()
    return jsonify(routines)


@app.route('/api/routines/<int:rid>', methods=['GET'])
def get_routine(rid):
    conn = get_db()
    exercises = fetchall(db_execute(conn,
        'SELECT exercise_name FROM routine_exercises WHERE routine_id=? ORDER BY sort_order', (rid,)
    ))
    conn.close()
    return jsonify([e['exercise_name'] for e in exercises])


@app.route('/api/routines', methods=['POST'])
def save_routine():
    data = request.get_json()
    name = (data.get('name') or '').strip()
    exercises = data.get('exercises', [])
    if not name or not exercises:
        return jsonify({'error': 'name and exercises required'}), 400

    conn = get_db()
    try:
        existing = fetchone(db_execute(conn, 'SELECT id FROM routines WHERE name=?', (name,)))
        if existing:
            rid = existing['id']
            db_execute(conn, 'DELETE FROM routine_exercises WHERE routine_id=?', (rid,))
        else:
            rid = db_insert(conn, 'INSERT INTO routines (name) VALUES (?)', (name,))

        for i, ex in enumerate(exercises):
            db_insert(conn,
                'INSERT INTO routine_exercises (routine_id, exercise_name, sort_order) VALUES (?,?,?)',
                (rid, ex, i)
            )
        conn.commit()
        return jsonify({'success': True, 'routine_id': rid, 'name': name})
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@app.route('/api/routines/<int:rid>', methods=['DELETE'])
def delete_routine(rid):
    conn = get_db()
    db_execute(conn, 'DELETE FROM routines WHERE id=?', (rid,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
