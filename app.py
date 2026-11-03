import os
import json
import time
import random
import subprocess
import threading
from functools import wraps
from queue import Queue
from flask import Flask, Response, jsonify, render_template, request, redirect, url_for, session

app = Flask(__name__)
app.secret_key = 'armbian-streamer-secret-key-change-this'

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MUSIC_DIR = os.path.join(BASE_DIR, 'music')
CONFIG_FILE = os.path.join(BASE_DIR, 'config.json')
os.makedirs(MUSIC_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {'.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.wma'}

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            pass
    return {"username": "admin", "password": "admin"}

def save_config(data):
    with open(CONFIG_FILE, 'w') as f:
        json.dump(data, f, indent=4)

admin_config = load_config()

current_track_title = ""
listeners = []
listeners_lock = threading.Lock()
server_start_time = time.time()

requested_track = None
current_proc = None
is_paused = False

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('logged_in'):
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def get_audio_files():
    return [f for f in os.listdir(MUSIC_DIR) if os.path.splitext(f)[1].lower() in ALLOWED_EXTENSIONS]

def start_broadcaster():
    """Broadcaster terpusat FFmpeg dengan Audio Boost & Continuous Pause/Resume."""
    global current_track_title, requested_track, current_proc, is_paused
    while True:
        files = get_audio_files()
        if not files:
            with listeners_lock:
                current_track_title = ""
            time.sleep(2)
            continue

        if requested_track and requested_track in files:
            filename = requested_track
            requested_track = None
        else:
            filename = random.choice(files)

        with listeners_lock:
            current_track_title = filename

        filepath = os.path.join(MUSIC_DIR, filename)

        # Perintah FFmpeg dengan filter penguat volume (volume=1.8)
        cmd = [
            'ffmpeg', '-loglevel', 'quiet',
            '-re', '-i', filepath,
            '-vn',
            '-filter:a', 'volume=1.8',
            '-codec:a', 'libmp3lame',
            '-ar', '44100',
            '-b:a', '128k',
            '-f', 'mp3',
            'pipe:1'
        ]

        try:
            current_proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            while True:
                # Tahan pembacaan chunk jika status di-pause TANPA mematikan FFmpeg
                if is_paused:
                    time.sleep(0.1)
                    continue

                # Jika ada perintah skip/pindah lagu dari admin
                if requested_track:
                    break

                chunk = current_proc.stdout.read(4096)
                if not chunk:
                    break

                with listeners_lock:
                    for q in listeners[:]:
                        try:
                            if q.full():
                                q.get_nowait()
                            q.put_nowait(chunk)
                        except Exception:
                            pass

            if current_proc and current_proc.poll() is None:
                current_proc.terminate()
            current_proc = None
        except Exception as e:
            print(f"Error streaming {filename}: {e}")
            time.sleep(1)

broadcaster_thread = threading.Thread(target=start_broadcaster, daemon=True)
broadcaster_thread.start()

# --- ROUTE PUBLIC ---

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/stream.mp3')
def stream():
    def generate():
        q = Queue(maxsize=100)
        with listeners_lock:
            listeners.append(q)
        try:
            while True:
                yield q.get()
        finally:
            with listeners_lock:
                if q in listeners:
                    listeners.remove(q)

    headers = {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    }
    return Response(generate(), headers=headers)

@app.route('/api/now-playing')
def now_playing():
    with listeners_lock:
        title = "⏸️ STREAM DIJEDA ADMIN" if is_paused else current_track_title
        return jsonify({'title': title, 'is_paused': is_paused})

@app.route('/api/tracks')
def get_tracks():
    return jsonify(sorted(get_audio_files()))

@app.route('/api/uptime')
def get_uptime():
    elapsed = int(time.time() - server_start_time)
    days = elapsed // 86400
    hours = (elapsed % 86400) // 3600
    minutes = (elapsed % 3600) // 60
    seconds = elapsed % 60

    formatted = f"{days}d {hours:02d}h {minutes:02d}m {seconds:02d}s" if days > 0 else f"{hours:02d}h {minutes:02d}m {seconds:02d}s"
    return jsonify({'uptime_seconds': elapsed, 'formatted': formatted})

# --- ROUTE AUTHENTICATION ---

@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        if username == admin_config.get('username') and password == admin_config.get('password'):
            session['logged_in'] = True
            return redirect(url_for('admin_dashboard'))
        else:
            error = 'Username atau Password salah!'
    return render_template('login.html', error=error)

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('login'))

# --- ROUTE ADMIN ---

@app.route('/admin')
@login_required
def admin_dashboard():
    return render_template('admin.html')

@app.route('/api/admin/change-credentials', methods=['POST'])
@login_required
def change_credentials():
    data = request.get_json() or {}
    new_username = data.get('username', '').strip()
    new_password = data.get('password', '').strip()

    if not new_username or not new_password:
        return jsonify({'success': False, 'error': 'Username dan Password tidak boleh kosong'}), 400

    admin_config['username'] = new_username
    admin_config['password'] = new_password
    save_config(admin_config)
    
    return jsonify({'success': True, 'message': 'Kredensial Admin berhasil diperbarui!'})

@app.route('/api/admin/toggle-pause', methods=['POST'])
@login_required
def admin_toggle_pause():
    """Toggle status Jeda/Lanjutkan lagu tanpa mematikan proses FFmpeg."""
    global is_paused
    is_paused = not is_paused
    return jsonify({'success': True, 'is_paused': is_paused})

@app.route('/api/admin/skip', methods=['POST'])
@login_required
def admin_skip_track():
    global requested_track, current_proc, is_paused
    is_paused = False
    files = get_audio_files()
    if files:
        other_files = [f for f in files if f != current_track_title]
        requested_track = random.choice(other_files) if other_files else files[0]
        if current_proc and current_proc.poll() is None:
            current_proc.terminate()
        return jsonify({'success': True, 'message': 'Lagu berhasil di-skip!'})
    return jsonify({'success': False, 'error': 'Tidak ada lagu'}), 400

@app.route('/api/admin/play-track', methods=['POST'])
@login_required
def admin_play_specific_track():
    global requested_track, current_proc, is_paused
    is_paused = False
    data = request.get_json() or {}
    filename = data.get('filename')

    if filename and filename in get_audio_files():
        requested_track = filename
        if current_proc and current_proc.poll() is None:
            current_proc.terminate()
        return jsonify({'success': True, 'message': f'Memutar: {filename}'})
    return jsonify({'success': False, 'error': 'File tidak ditemukan'}), 400

@app.route('/upload', methods=['POST'])
@login_required
def upload_file():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'Tidak ada file'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'Nama file kosong'}), 400

    ext = os.path.splitext(file.filename)[1].lower()
    if ext in ALLOWED_EXTENSIONS:
        filepath = os.path.join(MUSIC_DIR, file.filename)
        file.save(filepath)
        return jsonify({'success': True, 'filename': file.filename})
    return jsonify({'success': False, 'error': 'Format file tidak didukung'}), 400

@app.route('/api/admin/delete-track', methods=['POST'])
@login_required
def delete_track():
    data = request.get_json() or {}
    filename = data.get('filename')
    if not filename:
        return jsonify({'success': False, 'error': 'Nama file tidak valid'}), 400

    filepath = os.path.join(MUSIC_DIR, filename)
    if os.path.exists(filepath):
        try:
            os.remove(filepath)
            return jsonify({'success': True, 'filename': filename})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
    return jsonify({'success': False, 'error': 'File tidak ditemukan'}), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, threaded=True)
