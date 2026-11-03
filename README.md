# Dashboard Kehadiran Murid (SEMARAK HEM)

Google Sheets + Apps Script. Upload CSV kehadiran harian dari IDME, simpan per kelas per tarikh, papar dashboard dalam Sheet.

## Fail

| Fail | Isi |
|---|---|
| `apps-script/Code.gs` | `setupSistem`, `parseKehadiran`, `simpanKehadiran`, `prosesUpload`, `doGet`, `testParse` |
| `apps-script/Api.gs` | `getDashboard`, `getAnalisis`, `getTrend` — data untuk web app (sasaran KPI 95%) |
| `apps-script/App.html` | Web app (URL utama): Dashboard Utama, Analisis Kelas, Trend Kehadiran. Upload di `?p=upload` |
| `apps-script/Dashboard.gs` | `binaDashboard` — bina tab Dashboard, Analisis, Trend |
| `apps-script/Padam.gs` | Menu **Kehadiran > Padam data satu tarikh** dalam Sheet |
| `apps-script/Index.html` | Borang upload (tarikh + fail CSV) |
| `apps-script/appsscript.json` | Zon masa `Asia/Kuala_Lumpur`, web app "Me" / "Only myself" |
| `test/*.test.js` | Ujian di luar Apps Script: `node test/parse.test.js` |

## Pasang

1. Buka Sheet `Dashboard Kehadiran` > **Extensions > Apps Script**.
2. Salin semua fail dalam `apps-script/` (nama fail HTML mesti `Index` dan `App`).
3. **Project Settings** > tanda *Show "appsscript.json"* > salin isi `appsscript.json`.
4. **File > Settings** dalam Sheet: pastikan zon masa `(GMT+08:00) Kuala Lumpur`.

## Langkah uji (ikut turutan)

1. Run `testParse` > semak Execution log: `testParse LULUS`.
2. Run `setupSistem` (sekali sahaja; ia berhenti sendiri jika Data dah ada isi).
3. **Deploy > New deployment > Web app** (Execute as: Me, Who has access: Only myself). Buka URL.
4. Upload `kehadiran_30_10_26.csv` dengan tarikh 30/10/2026 > tab Data patut ada 39 baris, lajur F berisi peratus.
5. Upload semula tarikh sama > patut ditolak, tiada baris baharu.
6. Run `binaDashboard` > tab Dashboard, Analisis, Trend dibina.

`binaDashboard` boleh dijalankan semula bila-bila masa; ia hanya bina semula tiga tab tersebut dan tidak menyentuh tab Data.

## Peraturan data

- Satu tarikh hanya boleh diupload sekali. Upload kedua untuk tarikh sama ditolak.
- Jika satu baris CSV gagal, seluruh upload dibatalkan dan baris bermasalah dipaparkan.
- Jika fail pernah dibuka dalam Excel, nilai seperti `12/18` jadi `18-Dec`. Sistem baca semula sebagai hadir 12 / jumlah 18 (bulan = hadir, hari = jumlah), paparkan senarai pembetulan, dan hanya simpan selepas pengguna tekan **Sahkan & Simpan**.
- Tarikh akan datang ditolak.
- Data tersalah tarikh dipadam melalui menu **Kehadiran > Padam data satu tarikh**. Jangan padam seluruh baris secara manual (formula peratus di F2 akan hilang).
- Kelas dikenal pasti dengan gabungan Tingkatan + Kelas.
- Peratus dalam Analisis dan Trend ialah purata berwajaran (jumlah hadir / jumlah murid), bukan purata peratus kelas.
