document.addEventListener('DOMContentLoaded', () => {
    const streamUrl = window.location.origin + '/stream.mp3';
    document.getElementById('stream-url').innerText = streamUrl;

    const audio = document.getElementById('audio-player');
    const canvas = document.getElementById('visualizer-canvas');
    const ctx = canvas.getContext('2d');
    const playBtn = document.getElementById('custom-play-btn');
    const copyBtn = document.getElementById('copy-btn');
    const visModeSelect = document.getElementById('vis-mode-select');

    let currentVisMode = localStorage.getItem('vis_mode') || 'bars';
    if (visModeSelect) {
        visModeSelect.value = currentVisMode;
        visModeSelect.addEventListener('change', (e) => {
            currentVisMode = e.target.value;
            localStorage.setItem('vis_mode', currentVisMode);
        });
    }

    // 1. Clock Engine Jam & Tanggal
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

    // 2. Control Tombol Putar / Hentikan Custom
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            initAudioContext();
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            if (audio.paused) {
                audio.play().then(() => {
                    playBtn.innerText = '⏸️ HENTIKAN STREAMING';
                    playBtn.style.background = '#ff595e';
                    playBtn.style.color = '#fff';
                }).catch(err => console.error("Gagal memutar audio:", err));
            } else {
                audio.pause();
                playBtn.innerText = '▶ PUTAR STREAM';
                playBtn.style.background = '#ffca3a';
                playBtn.style.color = '#000';
            }
        });
    }

    // 3. Tombol Copy Link Stream (HTTP Fallback)
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            copyToClipboardFallback(streamUrl).then(() => {
                const originalText = copyBtn.innerText;
                copyBtn.innerText = '✅ LINK TERCOPY!';
                setTimeout(() => { copyBtn.innerText = originalText; }, 2000);
            }).catch(err => {
                alert('Gagal menyalin link: ' + err);
            });
        });
    }

    function copyToClipboardFallback(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        } else {
            return new Promise((resolve, reject) => {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    const successful = document.execCommand('copy');
                    document.body.removeChild(textArea);
                    successful ? resolve() : reject("Fitur copy tidak didukung.");
                } catch (err) {
                    document.body.removeChild(textArea);
                    reject(err);
                }
            });
        }
    }

    // 4. Controls Sidebar Drawer Public
    const openSidebarBtn = document.getElementById('open-sidebar-btn');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    if (openSidebarBtn && sidebar) {
        openSidebarBtn.addEventListener('click', () => {
            sidebar.classList.add('active');
            sidebarOverlay.classList.add('active');
        });

        const closeSidebar = () => {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
        };

        closeSidebarBtn.addEventListener('click', closeSidebar);
        sidebarOverlay.addEventListener('click', closeSidebar);
    }

    function resizeCanvas() {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    function autoReconnect() {
        if (audio.paused && playBtn.innerText.includes('HENTIKAN')) {
            audio.src = '/stream.mp3?t=' + Date.now();
            audio.play().catch(() => {});
        }
    }
    audio.addEventListener('stalled', autoReconnect);
    audio.addEventListener('error', autoReconnect);

    let audioCtx, source, analyser;
    let isAudioContextSetup = false;

    function initAudioContext() {
        if (isAudioContextSetup) return;

        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;

        source = audioCtx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);

        isAudioContextSetup = true;
        drawMultiModeVisualizer();
    }

    const barColors = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff6b6b'];

    // 5. Mesin Render Visualizer Multi-Mode (7 Mode Pilihan)
    function drawMultiModeVisualizer() {
        requestAnimationFrame(drawMultiModeVisualizer);
        if (!analyser) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (currentVisMode === 'waveform') {
            // Mode: Waveform Line
            ctx.beginPath();
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#ff0055';

            const sliceWidth = canvas.width / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 255.0;
                const y = canvas.height - (v * canvas.height * 0.9) - 5;

                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);

                x += sliceWidth;
            }
            ctx.stroke();

        } else if (currentVisMode === 'blocks') {
            // Mode: Matrix LED Blocks
            const barWidth = (canvas.width / bufferLength) * 1.2;
            let x = 0;
            const blockHeight = 8;
            const blockGap = 3;

            for (let i = 0; i < bufferLength; i++) {
                const totalBlocks = Math.floor((dataArray[i] / 255) * (canvas.height / (blockHeight + blockGap)));
                
                for (let j = 0; j < totalBlocks; j++) {
                    const y = canvas.height - ((j + 1) * (blockHeight + blockGap));
                    ctx.fillStyle = barColors[(i + j) % barColors.length];
                    ctx.fillRect(x, y, barWidth - 2, blockHeight);
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(x, y, barWidth - 2, blockHeight);
                }
                x += barWidth;
            }

        } else if (currentVisMode === 'circle') {
            // Mode: Radial Circle Ring
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const radius = Math.min(centerX, centerY) * 0.4;

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#000000';
            ctx.stroke();

            for (let i = 0; i < bufferLength; i++) {
                const angle = (i / bufferLength) * (2 * Math.PI);
                const barLen = (dataArray[i] / 255) * 40;

                const x1 = centerX + Math.cos(angle) * radius;
                const y1 = centerY + Math.sin(angle) * radius;
                const x2 = centerX + Math.cos(angle) * (radius + barLen);
                const y2 = centerY + Math.sin(angle) * (radius + barLen);

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.lineWidth = 4;
                ctx.strokeStyle = barColors[i % barColors.length];
                ctx.stroke();
            }

        } else if (currentVisMode === 'mirror') {
            // Mode BARU: Mirror Bars (Tengah ke Atas & Bawah)
            const centerY = canvas.height / 2;
            const barGap = 3;
            const barWidth = (canvas.width / bufferLength) - barGap;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const halfHeight = (dataArray[i] / 255) * (canvas.height / 2);
                const color = barColors[i % barColors.length];

                ctx.fillStyle = color;
                ctx.fillRect(x, centerY - halfHeight, barWidth, halfHeight * 2);

                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, centerY - halfHeight, barWidth, halfHeight * 2);

                x += barWidth + barGap;
            }

        } else if (currentVisMode === 'dots') {
            // Mode BARU: Bouncing Dots
            const barWidth = canvas.width / bufferLength;
            let x = barWidth / 2;

            for (let i = 0; i < bufferLength; i++) {
                const dotY = canvas.height - ((dataArray[i] / 255) * (canvas.height - 15)) - 8;
                const radius = 6;

                ctx.beginPath();
                ctx.arc(x, dotY, radius, 0, 2 * Math.PI);
                ctx.fillStyle = barColors[i % barColors.length];
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#000000';
                ctx.stroke();

                x += barWidth;
            }

        } else if (currentVisMode === 'cyber') {
            // Mode BARU: Cyber Strobe (Bar Warna + Garis Top Cap)
            const barGap = 4;
            const barWidth = (canvas.width / bufferLength) - barGap;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * canvas.height;
                
                // Batang Hitam Solid
                ctx.fillStyle = '#000000';
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

                // Top Cap Warna Pop Neon
                ctx.fillStyle = barColors[i % barColors.length];
                ctx.fillRect(x, canvas.height - barHeight - 4, barWidth, 6);
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(x, canvas.height - barHeight - 4, barWidth, 6);

                x += barWidth + barGap;
            }

        } else {
            // Mode: Neubrutalism Bars (Default)
            const barGap = 4;
            const totalGaps = (bufferLength - 1) * barGap;
            const barWidth = (canvas.width - totalGaps) / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = Math.max(6, (dataArray[i] / 255) * canvas.height);
                const color = barColors[i % barColors.length];

                ctx.fillStyle = color;
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 2.5;
                ctx.strokeRect(x, canvas.height - barHeight, barWidth, barHeight);

                x += barWidth + barGap;
            }
        }
    }

    async function fetchPlaylist() {
        try {
            const [tracksRes, nowPlayingRes] = await Promise.all([
                fetch('/api/tracks'),
                fetch('/api/now-playing')
            ]);

            const playlist = await tracksRes.json();
            const nowPlayingData = await nowPlayingRes.json();
            const currentTrack = nowPlayingData.title || "";

            const listEl = document.getElementById('playlist-list');

            if (playlist.length === 0) {
                listEl.innerHTML = '<div style="padding: 8px; border:2px solid #000; font-size: 0.75rem;">Folder <b>music/</b> masih kosong.</div>';
                return;
            }

            listEl.innerHTML = playlist.map((track, i) => {
                const isPlaying = track === currentTrack;
                return `
                    <div class="track-item ${isPlaying ? 'playing' : ''}">
                        <span>${i + 1}. ${track}</span>
                        ${isPlaying ? '<span style="background:#ff0055; color:#fff; border:1px solid #000; padding:2px 6px; font-weight:900;">▶ PLAYING</span>' : ''}
                    </div>
                `;
            }).join('');
        } catch (e) {
            console.error("Gagal memuat playlist", e);
        }
    }

    setInterval(fetchPlaylist, 2000);
    fetchPlaylist();
});
