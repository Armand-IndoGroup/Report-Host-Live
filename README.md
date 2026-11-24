# Laporan Harian Host Live

Form laporan pengganti Tally. Website statis (GitHub Pages) yang menulis langsung ke Google Sheet
**Form Laporan Harian Host Live (Indogroup)** → tab `RAW_DATA`, kolom A–P (sama persis seperti Tally),
sehingga DASHBOARD LIVE, CEK LAPORAN, KREDIT, dll. tetap berjalan tanpa diubah.

```
index.html   style.css   app.js   config.js      ← website (GitHub Pages)
apps-script/Code.gs                               ← penghubung ke Google Sheet (dipasang di Apps Script)
```

## Fitur
- Nama host diambil dari **ROSTER** (hanya yang berstatus Aktif di tanggal live).
- **Brand otomatis** dari ROSTER; centang "Live untuk brand lain" bila memang membantu brand lain.
- **Cegah laporan dobel**: sesi yang sama (host + tanggal + platform + jam) ditolak; jam yang bertabrakan diberi peringatan.
- **Cek jam & tanggal**: tanggal tidak boleh di masa depan, durasi ditampilkan, lewat tengah malam dikenali.
- **Pengingat per tanggal & sesi**: setelah memilih nama, host melihat laporan yang belum masuk
  sepanjang bulan dari Tanggal Live yang dipilih (tanggal 1–7 ikut bulan sebelumnya), termasuk sesi/platform yang belum lengkap (mis. "Sesi 2 Shopee" atau "Baru 1 dari 2 sesi").
  Sumbernya sheet tersembunyi `SESI` di Google Sheet. Sesi yang dibebaskan admin (PENGATURAN tabel D)
  dan izin setengah hari di ROSTER tidak dihitung.
- Setelah kirim: tombol **"Kirim platform lain (sesi sama)"** — tanggal, nama, jam tetap terisi.
- **Nama tidak diingat** — aman untuk komputer yang dipakai bergantian; host wajib memilih nama setiap kali.
- **Tampilan komputer 2 kolom** (Host & Platform di kiri, Performa & tombol Kirim di kanan); di HP tetap 1 kolom.
- **Keyboard**: `Enter` pindah ke kotak berikutnya, `Ctrl`+`Enter` kirim.
- **Angka**: angka bulat boleh pakai titik ribuan (`12.500`); Jumlah Share & Klik Produk Shopee boleh desimal (`13,2`).

## Pasang (sekali saja)

### 1. Apps Script (akun Google pemilik / editor sheet)
1. Buka Google Sheet laporan → **Extensions → Apps Script**.
2. Hapus isi `Code.gs`, tempel isi file `apps-script/Code.gs`, simpan.
3. Pilih fungsi `tesKoneksi` → **Run** → beri izin (Allow).
4. **Deploy → New deployment** → jenis **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Salin **Web app URL** (berakhiran `/exec`).

### 2. Website
1. Buka `config.js`, isi `window.API_URL = "URL_/exec_tadi";`, commit.
2. Repo → **Settings → Pages** → Source: *Deploy from a branch* → `main` / `(root)` → Save.
3. Link website: `https://<username>.github.io/<nama-repo>/`.

> Kalau `API_URL` kosong atau salah, website menampilkan pesan merah **"belum tersambung"** dan tombol kirim dikunci.

### Memperbarui Apps Script (wajib setelah versi ini)
Tempel ulang `apps-script/Code.gs` lalu **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.

### Mengubah kode Apps Script nanti
Setelah mengedit `Code.gs`: **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**
(URL tetap sama, tidak perlu ubah `config.js`).

## Catatan teknis
- `Submitted at` (kolom C) disimpan dalam **UTC**, sama seperti Tally, agar aturan terlambat (H+1 17:00 WIB) tetap benar.
- Submission ID diawali `W` dan Respondent ID = `web`, jadi laporan dari website mudah dibedakan dari Tally.
- Script memakai kunci (LockService) agar dua laporan yang dikirim bersamaan tidak saling menimpa.
- Tidak ada kunci rahasia di repo ini — aman sebagai repo publik.
