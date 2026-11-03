document.addEventListener('DOMContentLoaded', () => {
    const uptimeEl = document.getElementById('uptime-display');
    const nowPlayingEl = document.getElementById('admin-now-playing');
    const skipBtn = document.getElementById('skip-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const playlistEl = document.getElementById('admin-playlist-list');
    const uploadForm = document.getElementById('admin-upload-form');
    const changeCredForm = document.getElementById('change-credentials-form');

    // Controls Sidebar Admin
    const openAdminSidebarBtn = document.getElementById('open-admin-sidebar-btn');
    const closeAdminSidebarBtn = document.getElementById('close-admin-sidebar-btn');
    const adminSidebar = document.getElementById('admin-sidebar');
    const adminSidebarOverlay = document.getElementById('admin-sidebar-overlay');

    if (openAdminSidebarBtn && adminSidebar) {
        openAdminSidebarBtn.addEventListener('click', () => {
            adminSidebar.classList.add('active');
            adminSidebarOverlay.classList.add('active');
        });

        const closeAdminSidebar = () => {
            adminSidebar.classList.remove('active');
            adminSidebarOverlay.classList.remove('active');
        };

        closeAdminSidebarBtn.addEventListener('click', closeAdminSidebar);
        adminSidebarOverlay.addEventListener('click', closeAdminSidebar);
    }

    // 1. Clock Engine Jam & Tanggal Admin
    function updateClock() {
        const now = new Date();
        const timeEl = document.getElementById('clock-time');
        const dateEl = document.getElementById('clock-date');

        if (timeEl) {
            timeEl.innerText = now.toLocaleTimeString('id-ID', { hour12: false });
        }
        if (dateEl) {
            const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
            dateEl.innerText = now.toLocaleDateString('id-ID', options).toUpperCase();
        }
    }
    setInterval(updateClock, 1000);
    updateClock();

    // 2. Ganti Username & Password Handler
    if (changeCredForm) {
        changeCredForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('new-username').value.trim();
            const password = document.getElementById('new-password').value.trim();

            if (!username || !password) return;

            try {
                const res = await fetch('/api/admin/change-credentials', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const result = await res.json();
                if (result.success) {
                    alert('Kredensial Admin berhasil diubah!');
                    document.getElementById('new-username').value = '';
                    document.getElementById('new-password').value = '';
                } else {
                    alert('Gagal mengubah akun: ' + result.error);
                }
            } catch (err) {
                alert('Terjadi kesalahan saat mengubah akun.');
            }
        });
    }

    // 3. Live Uptime Polling
    async function updateUptime() {
        try {
            const res = await fetch('/api/uptime');
            const data = await res.json();
            uptimeEl.innerText = data.formatted;
        } catch (e) {
            uptimeEl.innerText = "Error memuat uptime";
        }
    }
    setInterval(updateUptime, 1000);
    updateUptime();

    // 4. Fetch Playlist & Status lagu aktif / pause
    async function fetchAdminPlaylist() {
        try {
            const [tracksRes, nowPlayingRes] = await Promise.all([
                fetch('/api/tracks'),
                fetch('/api/now-playing')
            ]);

            const playlist = await tracksRes.json();
            const nowPlayingData = await nowPlayingRes.json();
            const currentTrack = nowPlayingData.title || "Tidak ada lagu";
            const isPaused = nowPlayingData.is_paused || false;

            nowPlayingEl.innerText = currentTrack;
            updatePauseButton(isPaused);

            if (playlist.length === 0) {
                playlistEl.innerHTML = '<div style="padding: 8px; border:2px solid #000; font-size: 0.75rem;">Folder <b>music/</b> kosong. Gunakan form di atas untuk menambah lagu.</div>';
                return;
            }

            playlistEl.innerHTML = playlist.map((track, i) => {
                const isPlaying = track === currentTrack;
                return `
                    <div class="track-item ${isPlaying ? 'playing' : ''}">
                        <span>${i + 1}. ${track}</span>
                        <div class="track-actions">
                            ${!isPlaying ? `<button class="btn btn-sm btn-green" onclick="playSpecificTrack('${encodeURIComponent(track)}')">PUTAR</button>` : '<span style="background:#000; color:#fff; padding:3px 6px; font-weight:900;">LIVE</span>'}
                            <button class="btn btn-sm btn-danger" onclick="deleteTrack('${encodeURIComponent(track)}')">HAPUS</button>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (e) {
            console.error("Gagal memuat playlist admin", e);
        }
    }

    function updatePauseButton(isPaused) {
        if (isPaused) {
            pauseBtn.innerText = '▶️ LANJUTKAN';
            pauseBtn.classList.remove('btn-yellow');
            pauseBtn.classList.add('btn-green');
        } else {
            pauseBtn.innerText = '⏸️ JEDA LAGU';
            pauseBtn.classList.remove('btn-green');
            pauseBtn.classList.add('btn-yellow');
        }
    }

    // 5. Pause / Resume Handler
    pauseBtn.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/admin/toggle-pause', { method: 'POST' });
            const result = await res.json();
            if (result.success) {
                updatePauseButton(result.is_paused);
                fetchAdminPlaylist();
            }
        } catch (e) {
            alert('Gagal mengubah status jeda lagu.');
        }
    });

    // 6. Skip Track Handler
    skipBtn.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/admin/skip', { method: 'POST' });
            const result = await res.json();
            if (result.success) {
                fetchAdminPlaylist();
            } else {
                alert('Gagal skip: ' + result.error);
            }
        } catch (e) {
            alert('Terjadi kesalahan saat skip lagu.');
        }
    });

    // 7. Play Specific Track
    window.playSpecificTrack = async (filename) => {
        try {
            const res = await fetch('/api/admin/play-track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: decodeURIComponent(filename) })
            });
            const result = await res.json();
            if (result.success) {
                fetchAdminPlaylist();
            } else {
                alert('Gagal memutar lagu: ' + result.error);
            }
        } catch (e) {
            alert('Kesalahan saat memutar lagu.');
        }
    };

    // 8. Delete Track Handler
    window.deleteTrack = async (filename) => {
        const decodedName = decodeURIComponent(filename);
        if (!confirm(`Yakin ingin menghapus lagu "${decodedName}" dari server?`)) return;

        try {
            const res = await fetch('/api/admin/delete-track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: decodedName })
            });
            const result = await res.json();
            if (result.success) {
                alert('File lagu berhasil dihapus!');
                fetchAdminPlaylist();
            } else {
                alert('Gagal menghapus: ' + result.error);
            }
        } catch (e) {
            alert('Terjadi kesalahan saat menghapus file.');
        }
    };

    // 9. Upload Form Handler
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('file-input');
        if (!fileInput.files.length) return;

        const formData = new FormData();
        formData.append('file', fileInput.files[0]);

        try {
            const res = await fetch('/upload', { method: 'POST', body: formData });
            const result = await res.json();

            if (result.success) {
                alert('File musik berhasil diunggah!');
                fileInput.value = '';
                fetchAdminPlaylist();
            } else {
                alert('Gagal upload: ' + result.error);
            }
        } catch (err) {
            alert('Terjadi kesalahan saat upload.');
        }
    });

    setInterval(fetchAdminPlaylist, 2000);
    fetchAdminPlaylist();
});
