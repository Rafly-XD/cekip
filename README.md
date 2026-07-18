# IP Checker · Static Edition

Versi 100% client-side dari aplikasi IP Checker. Tidak butuh backend, tidak butuh database — semua jalan di browser kamu dengan `localStorage` untuk riwayat.

## Fitur

- Auto-detect IP publik saat halaman dibuka
- Riwayat pengecekan tersimpan di browser (tidak hilang saat refresh/close)
- Peringatan otomatis (warning + pulse border + toast) saat IP muncul lagi
- Info lokasi (negara, kota, region, timezone, koordinat)
- Info network (ISP, ASN, Cloudflare colo, HTTP protocol, TLS)
- Copy IP ke clipboard 1-klik
- Dialog konfirmasi sebelum hapus riwayat

## Isi File

```
index.html   # Struktur halaman
style.css    # Design Swiss Brutalist dark
app.js       # Logic + IP detection + history
```

## Cara Deploy ke GitHub Pages

### 1. Buat Repository Baru
1. Login ke [github.com](https://github.com)
2. Klik **New repository** → beri nama, misal `myip` → **Public** → **Create**

### 2. Upload 3 File
Ada dua cara:

**Cara A — Via Web UI (paling gampang):**
1. Di repo baru, klik **Add file → Upload files**
2. Drag & drop `index.html`, `style.css`, `app.js`
3. Commit changes

**Cara B — Via Git CLI:**
```bash
git clone https://github.com/USERNAME/myip.git
cd myip
# copy 3 file ke folder ini
git add .
git commit -m "Initial IP Checker"
git push
```

### 3. Aktifkan GitHub Pages
1. Buka repo → **Settings** → **Pages** (sidebar kiri)
2. Source → **Deploy from a branch**
3. Branch → **main** → **/(root)** → **Save**
4. Tunggu ~1 menit, GitHub akan kasih URL:
   `https://USERNAME.github.io/myip/`

Selesai! Website kamu live.

## Alternatif Hosting Gratis

Semua tiga file ini bisa juga di-deploy ke:

- **Netlify** — drag & drop folder ke [netlify.com/drop](https://app.netlify.com/drop)
- **Cloudflare Pages** — connect GitHub → auto deploy
- **Vercel** — `vercel deploy` di folder ini
- **Surge.sh** — `npx surge` di folder ini

## APIs yang Dipakai (semua gratis, tanpa key)

- `cloudflare.com/cdn-cgi/trace` — IP + country + TLS + colo (primary)
- `api.ipify.org` — IP fallback
- `ipapi.co/json` — enrichment lokasi + ISP (rate-limited per browser IP, ~30k req/bulan)

## Catatan

- Riwayat disimpan di **browser lokal kamu** — bukan di server. Jadi kalau kamu ganti device atau clear browser data, riwayat hilang.
- `ipapi.co` bisa kena rate limit kalau kamu refresh terlalu sering — info lokasi mungkin gagal muncul sementara, tapi IP tetap terdeteksi.
- Tidak ada tracking, tidak ada analytics, tidak ada iklan.
