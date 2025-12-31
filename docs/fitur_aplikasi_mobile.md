# Fitur Aplikasi Presensi Mobile (AttendX / SJS Group)

Berdasarkan struktur kode dan fitur yang telah diimplementasikan/dioptimalkan, berikut adalah fitur utama dari **Aplikasi Presensi Mobile**:

### 1. 📸 Verifikasi Wajah Cerdas (Presensi Biometrik)
*   **Pengenalan Real-time:** Menggunakan teknologi pengenalan wajah canggih (TFLite) untuk memverifikasi identitas pengguna sebelum melakukan presensi.
*   **Kapabilitas Offline:** Verifikasi wajah **tetap bekerja tanpa koneksi internet**. Data wajah (embeddings) disimpan secara aman secara lokal di perangkat, memungkinkan presensi di area basement atau lokasi terpencil.
*   **Pemeriksaan Kehadiran Fisik (Liveness/Similarity Check):** Memastikan orang yang melakukan presensi benar-benar hadir secara fisik (anti-spoofing).

### 2. 📍 Geofencing & Validasi Lokasi
*   **Pemeriksaan Radius Kantor:** Aplikasi secara otomatis memeriksa posisi GPS karyawan. Presensi hanya diizinkan jika pengguna berada dalam radius yang ditentukan (misalnya 50-100 meter) dari kantor yang ditugaskan ("Kantor Pusat", "Cabang", dll).
*   **Detail Koordinat:** Pengguna dapat melihat lokasi kantor dan jarak mereka saat ini dari kantor di menu Profil.

### 3. 📶 Mode Offline Cerdas (Dukungan Offline Penuh)
*   **Login Offline:** Karyawan dapat masuk ke aplikasi bahkan ketika tidak ada sinyal internet (menggunakan kredensial terenkripsi yang tersimpan/cached).
*   **Presensi Offline:** Mendukung Check-In dan Check-Out tanpa koneksi. Data akan disimpan secara lokal dan **disinkronisasi otomatis** ke server begitu internet kembali terhubung.
*   **Riwayat Offline:** Data riwayat kehadiran disimpan (cached), sehingga pengguna dapat melihat rekap dan log kehadiran sebelumnya meskipun sedang offline.

### 4. 📅 Riwayat & Rekap Komprehensif
*   **Tab Bulanan:** Riwayat disusun rapi per bulan ("Bulan Ini", "Bulan Lalu").
*   **Rekap Otomatis:** Menghitung secara otomatis:
    *   Total Hadir.
    *   Total Terlambat.
    *   Tepat Waktu.
    *   Cepat Pulang (Early Departure).
*   **Jam Kerja:** Menampilkan waktu masuk/keluar yang tepat dan total durasi kerja yang dihitung.

### 5. 🏠 Dasbor Beranda Interaktif
*   **UI Dinamis:** Tampilan berubah berdasarkan status (misalnya, menampilkan tombol "Check In" jika belum hadir, atau "Check Out" jika sedang aktif bekerja).
*   **Pembaruan Langsung:** Menggunakan WebSocket untuk pembaruan real-time (misalnya, jika ada perubahan shift atau perpindahan kantor, aplikasi memperbarui data secara instan tanpa perlu reload).

### 6. 👤 Profil Pengguna & Keamanan
*   **Penyimpanan Aman:** Data sensitif (password, data wajah) dienkripsi menggunakan standar keamanan industri (`expo-secure-store`).
*   **Personalisasi:** Mendukung **Mode Gelap / Mode Terang** sesuai preferensi pengguna.
*   **Manajemen Akun:** Fitur untuk mengubah kata sandi dan melihat detail karyawan (ID, Jabatan, Kantor).

Secara ringkas, aplikasi ini adalah **Sistem Presensi Biometrik Hibrida** yang dirancang untuk keandalan tinggi (Offline First) dan keamanan ketat (Validasi Wajah & Lokasi).
