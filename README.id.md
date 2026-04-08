# cc-token-saver

> **Claude Code terus-terusan berhenti di tengah jalan? Tidak lagi.**
>
> Hemat biaya, coding lebih lama, dan lihat ke mana token Anda pergi — tanpa konfigurasi.

Caranya? Manajemen context otomatis, pelacakan biaya real-time, dan kontrol session berbasis cache — semua dalam satu plugin.

---

## 😤 Masalahnya: $200/bulan Tapi Tetap Tidak Produktif

Claude Code Max Plan ($200/bulan). Seharusnya cukup. Ternyata tidak.

**Rate limit rolling window 5 jam.** Anda sedang fokus coding lalu tiba-tiba berhenti. Tidak ada timer. Tidak ada estimasi waktu. Hanya menunggu.

**Cache kedaluwarsa.** Anda kembali dari makan siang. Sudah lebih dari satu jam. Anda mengirim satu prompt dan 900K token dikirim ulang dengan harga penuh. Biayanya? $9 dalam satu kali kirim.

**Biaya tidak terlihat.** Tidak ada cara untuk melihat berapa yang Anda habiskan secara real-time. Anda baru tahu setelah terkena rate limit.

**Semuanya manual.** Ukuran context, waktu kedaluwarsa cache, delegasi SubTask, pembersihan session. Siapa yang bisa melacak semua ini sambil coding?

cc-token-saver menangani semuanya secara otomatis. **Instal sekali. Selesai.**

---

## 🚀 Instalasi

```
claude plugin marketplace add ww-w-ai/cc-token-saver
claude plugin install cc-token-saver
```

Berjalan otomatis setelah diinstal. Tanpa konfigurasi. Membutuhkan [Claude Code](https://claude.ai/claude-code) v2.1.71+.

Untuk monitoring langsung:

```
/setup-statusline install
```

---

## 🛡️ Fitur 1: Token Guardian

**Mendeteksi cache kedaluwarsa dan otomatis memblokir pengiriman ulang yang mahal.**

TTL prompt cache Claude Code adalah 1 jam. Tinggalkan lebih dari satu jam dan cache kedaluwarsa. Pesan berikutnya mengirim ulang seluruh context dengan harga penuh. Pada 900K token, itu $9 dalam satu kali kirim.

Token Guardian melacak kapan respons terakhir diterima. Jika lebih dari 3.590 detik telah berlalu (TTL dikurangi buffer 10 detik), prompt diblokir dan peringatan ditampilkan.

```
🚨 Cache kedaluwarsa (68m 23d tidak aktif)

Cache telah kedaluwarsa. Melanjutkan akan mengirim ulang seluruh konteks.
Biaya dapat meningkat secara signifikan.

👉 /context — Periksa penggunaan konteks saat ini sebelum memutuskan
👉 /clear → /continue — Reset lalu pulihkan konteks sebelumnya (disarankan, biaya terendah)
👉 Kirim ulang — Lanjutkan apa adanya (biaya re-cache penuh timbul)
```

Cukup kirim ulang prompt yang sama setelah peringatan — prompt akan diproses. Peringatan hanya muncul sekali per periode idle, jadi tidak mengganggu. Pesan peringatan ditampilkan dalam 23 bahasa berdasarkan locale OS Anda.

**Hasil:** Biaya re-cache yang mahal dicegah secara otomatis. Tanpa usaha tambahan.

---

## 🧠 Fitur 2: Smart Session Architecture

**Instal dan pola kerja hemat biaya langsung aktif secara otomatis.**

Kebanyakan pengguna melakukan segalanya di Main session. Membaca file, generate kode, menjalankan test. Setiap output menumpuk ke dalam context dan dikirim ulang di setiap pesan. Session membengkak. Biaya melonjak.

Session Architect otomatis menyisipkan strategi delegasi saat session dimulai.

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Peran            | Desain, keputusan, review         | Implementasi, code gen, multi-file    |
| Cache tier       | 1 jam (ephemeral_1h)              | 5 menit                               |
| Biaya cache write | ＄10/MTok                          | ＄6.25/MTok                            |
| Ukuran context   | ~94K rata-rata                    | ~33K rata-rata                        |

SubTask memiliki **biaya cache write 37,5% lebih murah** dibanding Main. Context-nya juga jauh lebih kecil. Mendelegasikan pekerjaan berat ke SubTask memangkas biaya secara drastis.

**Hasil:** Claude otomatis bekerja dengan pola hemat biaya. Anda tidak perlu memikirkannya.

---

## 🔄 Fitur 3: /continue — Pemulihan Context

**Menggantikan `/compact`. Nol panggilan LLM. Nol biaya token.**

`/compact` mengirim seluruh context (~1M token) ke LLM untuk dikompresi menjadi ringkasan 3,3%. Jika cache sudah kedaluwarsa, itu saja sudah memicu re-cache penuh. Kehilangan informasi tidak terhindarkan.

`/continue` mengambil pendekatan yang sama sekali berbeda. Ia memproses transkrip session sebelumnya dan memuatnya langsung. Tanpa panggilan LLM. Tanpa biaya. Percakapan asli dipulihkan apa adanya.

|                         | /compact                          | /continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| Cara kerja              | Mengirim seluruh context ke LLM untuk diringkas | Memproses transkrip, membaca langsung |
| Panggilan LLM           | Diperlukan (biasanya 100K+ token) | 0                                |
| Biaya token             | Tinggi                            | 0                                |
| Kehilangan informasi    | Ya (ringkasan 3,3%)              | Tidak ada (asli dipertahankan)   |
| Kecepatan pemrosesan    | Puluhan detik                     | < 1 detik (bahkan file 60MB+)   |
| Saat cache kedaluwarsa  | Biaya re-cache penuh di atasnya   | Tidak berdampak                  |
| Pemulihan multi-session | Tidak bisa                        | Didukung                         |

Penggunaan: `/clear` lalu `/continue`. Anda akan melihat daftar session sebelumnya. Pilih satu untuk dipulihkan. Untuk pemulihan cepat: `/continue last`.

**Hasil:** Lanjutkan pekerjaan sebelumnya tanpa biaya. Tanpa kehilangan informasi.

---

## 📊 Fitur 4: Live Status Line

**Monitoring token/biaya real-time. Overhead di bawah 50ms.**

Jalankan `/setup-statusline install` sekali dan status bar persisten muncul di bagian bawah Claude Code.

```
[RUN🟢] $0.10/$12.23 | [5H🟢] 9% ⏳1h32m | [CTX🟢] 22%
```

| Indikator        | Yang ditampilkan                    | 🟢 Normal | 🟡 Peringatan | 🔴 Kritis |
| ---------------- | ----------------------------------- | --------- | ------------- | --------- |
| RUN (delta)      | Biaya panggilan API terakhir        | < ＄0.50   | >= ＄0.50      | >= ＄1.00  |
| RUN (kumulatif)  | Biaya kumulatif untuk folder ini    | —         | —             | —         |
| 5H               | Penggunaan window 5 jam + hitung mundur reset | < 70%     | >= 70%        | >= 90%    |
| CTX              | Penggunaan context window           | < 35%     | >= 35%        | >= 70%    |

Saat indikator mencapai peringatan atau kritis, hint `→ /usage-view current` muncul otomatis.

Untuk menghapus: `/setup-statusline uninstall` (konfigurasi sebelumnya dipulihkan otomatis).

**Hasil:** Lihat status biaya Anda sekilas. Bertindak sebelum terlambat.

---

## 📈 Dashboard Penggunaan (/usage-view)

**Akhirnya bisa menjawab: "Kenapa saya kena rate limit?"**

Selama ini, terkena rate limit hanya membuat Anda kesal. Tidak ada cara mengetahui penyebabnya. Session mana yang menghabiskan token paling banyak? Kapan biaya melonjak? Pola apa yang ada dalam penggunaan Anda? Semuanya tidak terlihat.

`/usage-view` menampilkan semuanya. Dashboard HTML interaktif terbuka di browser Anda, memungkinkan Anda menganalisis pola penggunaan dan melacak akar penyebab lonjakan biaya. Tanpa dependensi eksternal. Berjalan mandiri. Bisa dibagikan sebagai file.

Yang disertakan:

- Tren biaya harian / per jam / per hari dalam seminggu — temukan kapan Anda paling banyak menghabiskan token
- Breakdown token (input, output, cache write, cache read) — lihat apa yang mendorong biaya
- Analisis biaya per session — tentukan task mana yang mahal
- Timeline window 5 jam (pelanggan Max Plan) — lacak pemicu rate limit
- Analisis insight berbasis AI — menginterpretasi data dan menyarankan perbaikan
- 23 bahasa didukung (RTL termasuk; chart/tabel tetap LTR)

```
/usage-view                  # Semua waktu, semua proyek
/usage-view current          # Window 5 jam saat ini saja
/usage-view last 7 days      # 7 hari terakhir
/usage-view locale id        # Bahasa Indonesia
```

---

## 🔬 Riset Rate Limit (/report-limit)

**Proyek berbasis komunitas untuk merekayasa balik formula rate limit.**

Anthropic tidak mempublikasikan formula pasti untuk window 5 jam. Mari kita cari tahu bersama.

Saat Anda terkena rate limit, jalankan `/report-limit`. Data penggunaan Anda saat ini otomatis dikirim sebagai GitHub Discussion. Semakin banyak data yang terkumpul, semakin jelas formulanya.

---

## 💡 Cara Kerja Cache Sebenarnya

Claude Code mengirim seluruh riwayat percakapan ke model di setiap panggilan API. "Panggilan API" bukan berarti "satu pesan yang Anda ketik." Satu prompt memicu panggilan tool internal — Grep, Read, Edit, Write — dan masing-masing adalah panggilan API terpisah. Satu prompt bisa dengan mudah menyebabkan 10+ panggilan API.

Prompt cache mengurangi biaya ini sebesar 90%. Tapi cache memiliki masa berlaku.

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| Cache TTL           | 1 jam (ephemeral_1h)                  | 5 menit                                |
| Cache write         | ＄10/MTok                              | ＄6.25/MTok                             |
| Cache read          | ＄0.50/MTok                            | ＄0.50/MTok                             |
| Saat cache kedaluwarsa | Seluruh context dikirim ulang harga penuh | Dampak rendah (context kecil)       |

Bahkan dengan cache aktif, biaya tetap terakumulasi. Berikut skenario ekstrem untuk menunjukkan perbedaannya.

### Skenario: Coding seharian (3 jam pagi → 2 jam makan siang/meeting → 3 jam sore)

Kondisi: Harga Opus 4, 1 prompt per menit, ~5 panggilan API per prompt (~300 panggilan/jam).

#### ❌ Tanpa cc-token-saver

Sebagian besar pekerjaan dilakukan di Main session. Context membesar dengan cepat.

| Fase        | Situasi                           | Ukuran context             | Biaya                                  |
| ----------- | --------------------------------- | -------------------------- | -------------------------------------- |
| Pagi 3 jam  | Coding (sebagian besar di Main)   | 100K → 600K (rata-rata 350K) | 900 panggilan × 350K × ＄0.50/M = ＄157.50 |
| Siang/mtg   | Tidak di tempat selama 2 jam      | —                          | —                                      |
| Kembali     | Cache kedaluwarsa → kirim ulang penuh | 600K harga penuh        | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| Kembali     | /compact (meringkas)              | 600K → dikirim ke LLM     | 600K × ＄0.50/M + output ringkasan = ~＄1.50 |
| Sore 3 jam  | Coding berlanjut (context membesar lagi) | 100K → 600K (rata-rata 350K) | 900 panggilan × 350K × ＄0.50/M = ＄157.50 |
|             | Total                             |                            | ~＄326                                  |

> Pada tingkat penggunaan ini, kemungkinan besar Anda akan terkena rate limit window 5 jam. **Biaya memang buruk, tapi masalah sebenarnya adalah pekerjaan Anda berhenti total. Inilah saat Claude Code mati total.**

#### ✅ Dengan cc-token-saver

Pekerjaan berat didelegasikan ke SubTask. Main hanya menangani desain/keputusan.

| Fase        | Situasi                                      | Ukuran context              | Biaya                              |
| ----------- | -------------------------------------------- | --------------------------- | ---------------------------------- |
| Pagi 3 jam  | Coding (Main: desain, SubTask: implementasi) | Main 100K → 300K (rata-rata 200K) | 900 panggilan × 200K × ＄0.50/M = ＄90 |
| Siang/mtg   | Tidak di tempat selama 2 jam                 | —                           | —                                  |
| Kembali     | ⚡ Token Guardian memblokir → /clear + /continue | —                       | ＄0 (tanpa panggilan LLM)          |
| Sore 3 jam  | Coding berlanjut                             | Main 100K → 300K (rata-rata 200K) | 900 panggilan × 200K × ＄0.50/M = ＄90 |
|             | Total                                        |                             | ~＄180                              |

#### 💰 Hasil

> **＄326 → ＄180. ＄146 dihemat per hari (45%).**
>
> Ini bukan hanya soal biaya. Lebih sedikit token dalam waktu yang sama berarti **Anda tidak terkena rate limit dan bisa terus bekerja.** Itulah perbedaan sesungguhnya.

### Di mana cc-token-saver berperan

```
[Session Dimulai]
    │
    ├─ Session Architect → Otomatis menyisipkan pola delegasi SubTask
    │                       Menjaga context Main di bawah 250K
    │
[Bekerja]
    │
    ├─ Status Line → Monitoring biaya/context/rate limit real-time
    │                  Alert instan saat memasuki zona peringatan
    │
[1+ jam idle]
    │
    ├─ Token Guardian → Mendeteksi cache kedaluwarsa, memblokir sebelum kirim ulang
    │
[Session restart]
    │
    └─ /continue → Memulihkan context sebelumnya tanpa biaya (tanpa panggilan LLM)
```

---

## 🔧 Instal dari Source & Kustomisasi

```bash
git clone https://github.com/ww-w-ai/cc-token-saver.git
claude plugin marketplace add /path/to/cc-token-saver
claude plugin install cc-token-saver@cc-token-saver
```

cc-token-saver sepenuhnya terbuka. Seluruh source berupa JavaScript + Bash script biasa mengikuti struktur plugin standar. Modifikasi sesuka Anda.

- **hooks/** — Ubah threshold kedaluwarsa cache, sesuaikan pesan peringatan, modifikasi aturan session architecture
- **scripts/** — Logika analisis, pembuat laporan, format status line
- **skills/** — Cara kerja /continue dan /usage-view, template prompt
- **locales/** — Tambah/edit terjemahan, tambah bahasa baru
- **skills/usage-view/** — Perubahan desain UI/UX dashboard

Jadikan milik Anda. Fork, eksperimen, dan kirim PR jika Anda menemukan sesuatu yang lebih baik.

---

## 🌐 Bahasa yang Didukung

23 bahasa didukung. Dipilih dengan mencocokkan 20 negara teratas pengguna Claude Code dengan 20 bahasa teratas berdasarkan jumlah penutur global. Bahasa tampilan terdeteksi otomatis dari locale OS Anda. Anda juga bisa menentukan secara manual: `/usage-view locale id`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 Inggris   | 🇰🇷 Korea      | 🇯🇵 Jepang   | 🇨🇳 Mandarin  |
| 🇪🇸 Spanyol   | 🇫🇷 Prancis    | 🇩🇪 Jerman   | 🇧🇷 Portugis  |
| 🇮🇹 Italia    | 🇷🇺 Rusia      | 🇸🇦 Arab      | 🇮🇳 Hindi      |
| 🇧🇩 Bengali   | 🇮🇩 Indonesia  | 🇲🇾 Melayu   | 🇹🇭 Thai       |
| 🇻🇳 Vietnam   | 🇹🇷 Turki      | 🇵🇱 Polandia | 🇳🇱 Belanda    |
| 🇮🇱 Ibrani    | 🇸🇪 Swedia     | 🇳🇴 Norwegia |                 |

Terjemahan saat ini dihasilkan oleh AI. Kontribusi dari penutur asli sangat diterima — edit file JSON untuk bahasa Anda di `locales/` dan kirim PR.

---

## 💡 Tips

### Pahami cache dan Anda akan tahu ke mana uang pergi

- **1 prompt ≠ 1 panggilan API.** Setiap kali Claude memanggil Grep, Read, atau Edit, seluruh context dikirim ulang. Satu prompt dengan mudah memicu 10+ panggilan API. Tulis prompt yang jelas untuk mengurangi panggilan tool yang tidak perlu dan memangkas biaya.
- **Timer cache direset dari panggilan API terakhir, bukan prompt terakhir Anda.** Terus bekerja dan cache tidak akan pernah kedaluwarsa. Bahayanya adalah saat Anda meninggalkan meja. Token Guardian otomatis memblokir sekali, sehingga saat kembali Anda bisa memilih: reset context atau lanjutkan apa adanya.
- **Ukuran context = pengali biaya.** Panggilan API yang sama pada 200K vs 800K biayanya 4x lipat. Saat status line [CTX] melewati 35% (🟡), itu sinyal untuk mendelegasikan lebih banyak ke SubTask.

### Kebiasaan yang memangkas biaya

- **Jaga CLAUDE.md tetap ringkas.** File ini dimuat ke dalam system prompt di setiap panggilan API. Setiap baris ada biayanya.
- **Delegasikan pekerjaan berat ke SubTask.** Code generation, edit multi-file, menjalankan test tidak seharusnya di Main. SubTask memiliki context lebih kecil dan tier cache lebih murah.
- **Pergi 1+ jam?** `/clear` → kembali → `/continue`. Context dipulihkan dengan biaya $0.
- **[5H] di atas 70% (🟡)?** Pelan-pelan. Beralih ke tugas review ringan atau tingkatkan delegasi SubTask untuk mengurangi jumlah panggilan API Main.
- **Gunakan `/btw` untuk pertanyaan sampingan.** Ini tidak masuk ke riwayat percakapan, sehingga context Anda tetap ramping.

---

## License

Apache-2.0
