📻 Armbian 24/7 Music Streaming
Aplikasi server-side audio broadcast berbasis Python Flask dan FFmpeg yang didesain khusus untuk STB Armbian / server Linux lokal. Aplikasi ini menyiarkan musik secara real-time dan continuous loop 24 jam nonstop dengan penggunaan CPU yang sangat rendah.
🌟 Fitur Utama
 * 24/7 Continuous Audio Stream: Aliran audio non-stop di endpoint /stream.mp3 tanpa terputus saat berganti lagu.
 * Synchronized Broadcast: Seluruh peramban web dan OBS Studio mendengarkan lagu dan detik yang sama secara sinkron.
 * Audio Boost Engine: Fitur penguat volume otomatis via FFmpeg (volume=1.8) agar output suara jernih dan nyaring.
 * Neubrutalism UI & Mobile Responsive: Tampilan modern dengan garis tepi hitam tebal, warna solid kontras tinggi, serta layout yang pas di layar HP maupun PC.
 * 7-Mode Visualizer Equalizer Canvas:
   * Neubrutalism Bars (Batang solid klasik)
   * Waveform Line (Garis sinyal audio)
   * Matrix LED Blocks (Balok LED digital)
   * Radial Circle (Lingkaran audio 360°)
   * Mirror Bars (Spektrum cermin ganda)
   * Bouncing Dots (Titik melompat)
   * Cyber Strobe (Batang kontras puncak)
 * Dashboard Admin Aman (Server-Side Session):
   * Mengendalikan status lagu: Pause/Resume (lanjut tanpa reset), Skip Track, dan Select Specific Track.
   * Menambah (Upload) dan Menghapus (Delete) file musik.
   * Fitur Ubah Username & Password Admin (Tersimpan di config.json).
 * Widget Jam & Tanggal Realtime: Menampilkan waktu lokal dan tanggal secara akurat.
 * Uptime Counter: Indikator durasi total server siaran aktif berjalan.
 * HTTP Fallback Copy Link: Tombol penyalin URL stream yang kompatibel dengan IP lokal non-SSL.
📁 Struktur Proyek
```
armbian-music-streamer/
├── app.py                  # Backend utama Python Flask & Stream Broadcaster
├── config.json             # File kredensial admin (otomatis dibuat)
├── music/                  # Direktori penyimpanan file audio (.mp3, .wav, .flac, dll)
├── static/
│   ├── style.css           # Styling UI Neubrutalism, Sidebar, & Responsif
│   ├── script.js           # Client Logic Public (Player, Visualizer 7-Mode, Clock)
│   └── admin.js            # Client Logic Admin (Uptime, Controls, Upload, Delete, Auth)
└── templates/
    ├── index.html          # Halaman Pemutar Musik Publik
    ├── login.html          # Halaman Login Admin
    └── admin.html          # Halaman Dashboard Kontrol Admin
```
🛠️ Prasyarat Sistem
Sebelum menjalankan script, pastikan STB Armbian / Linux Anda telah terpasang:
 * Python 3 dan pip3
 * FFmpeg (Wajib untuk pengolahan audio stream)
🚀 Langkah Instalasi & Pengoperasian
1. Update Repository Sistem & Instal Dependensi
Buka terminal Armbian Anda dan jalankan perintah berikut:
# Update paket sistem & instal FFmpeg
```bash
sudo apt update && sudo apt install python3 python3-pip ffmpeg -y
```
# Instal modul Flask
```bash
sudo apt install python3-flask -y
```
> Catatan: Jika menginstal Flask via pip, gunakan perintah:
```bash
pip3 install flask --break-system-packages
```
2. Menyiapkan Proyek
# Download
```bash
git clone https://github.com/minz666/music-streaming
cd ~/music-streaming
```

3. Menambahkan Musik Awal
Pindahkan beberapa file audio (.mp3, .wav, .ogg, atau .flac) ke dalam folder music/:
```bash
cp /path/ke/lagu/anda/*.mp3 ~/music-streaming/music/
```
4. Menjalankan Server
```bash
cd ~/music-streaming
python3 app.py
```
Server akan aktif di port 5000. Akses melalui peramban:
 * Public Player: http://IP_STB_ARMBIAN:5000
 * Login Admin: http://IP_STB_ARMBIAN:5000/login
⚙️ Konfigurasi Auto-Run 24/7 (Systemd Service)
Agar aplikasi streaming tetap berjalan secara otomatis saat STB Armbian dinyalakan (reboot), buat layanan systemd:
 * Buat berkas unit service:
```bash
sudo nano /etc/systemd/system/music-streaming.service
```
 * Tempelkan konfigurasi berikut (sesuaikan lokasi folder dan user Anda):
```
[Unit]
Description=Armbian 24/7 Music Streaming
After=network.target

[Service]
User=root
WorkingDirectory=/root/music-streaming
ExecStart=/usr/bin/python3 /root/music-streaming/app.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
 * Simpan dan keluar (Ctrl+O, Enter, Ctrl+X).
 * Aktifkan dan jalankan service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable music-streaming
sudo systemctl start music-streaming
```
 * Cek status layanan:
```bash
sudo systemctl status music-streaming
```
🔑 Kredensial Default Admin
 * Username Bawaan: admin
 * Password Bawaan: admin
> Kredensial dapat diubah kapan saja melalui form Ganti Kredensial Admin di Sidebar Dashboard Admin. Perubahan akan tersimpan secara permanen pada berkas config.json.
> 
📺 Integrasi ke OBS Studio
 * Buka OBS Studio di PC streaming Anda.
 * Pada panel Sources, klik tombol + lalu pilih Media Source.
 * Beri nama (misal: Radio Armbian 24/7), klik OK.
 * Hapus centang pada opsi Local File.
 * Masukkan URL stream pada kolom Input:
   http://IP_STB_ARMBIAN:5000/stream.mp3

 * Klik OK. Audio siaran akan langsung masuk secara realtime ke mixer OBS.
📝 Lisensi & Kredit
Made with ❤️ by hendrik
