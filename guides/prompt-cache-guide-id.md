# Panduan Biaya Cache — Mengapa Sebagian Besar Biaya Anda Berasal dari Cache

Wajar jika sebagian besar biaya alat AI coding Anda berasal dari operasi cache (write + read). Dokumen ini menjelaskan alasannya dan cara mengelolanya.

## Rahasianya: Setiap Pesan Mengirim Ulang Seluruh Percakapan

LLM bersifat **stateless**. Tidak seperti manusia, model AI tidak "mengingat" percakapan sebelumnya — mereka menerima seluruh riwayat percakapan sebagai input di setiap permintaan.

Terlihat seperti chat biasa, tetapi panggilan API sebenarnya bekerja seperti ini:

```
[ Permintaan 1 ]
→ System prompt + "Perbaiki bug ini"
← Respons AI

[ Permintaan 2 ]
→ System prompt + "Perbaiki bug ini" + Respons AI + "Tambahkan juga testnya"
← Respons AI

[ Permintaan 3 ]
→ System prompt + "Perbaiki bug ini" + Respons AI + "Tambahkan juga testnya" + Respons AI + "Commit"
← Respons AI
```

Setiap permintaan menyertakan **semua** konten sebelumnya. Misalnya, permintaan ke-50 berisi seluruh percakapan dan semua respons AI dari 49 permintaan sebelumnya. Inilah mengapa token input bertambah cepat seiring percakapan semakin panjang.

Selain itu, alat AI coding mengirimkan system prompt (instruksi bawaan, file konfigurasi, plugin, definisi tool MCP, dll.) di setiap permintaan — sehingga bahkan pesan satu baris menghasilkan puluhan ribu token input.

## Apa Itu Caching?

**Prompt caching** mengurangi biaya pengiriman berulang ini. Sistem menyimpan bagian input yang tidak berubah di server sehingga permintaan berikutnya dapat menggunakannya kembali dengan harga diskon.

- **Cache Write**: Biaya menyimpan konten percakapan di server. Terjadi pada permintaan pertama atau setelah cache kedaluwarsa.
- **Cache Read**: Biaya menggunakan kembali konten yang sudah tersimpan. Dikenakan dengan **diskon 90%** dibandingkan input standar.

Alat AI coding secara alami menghasilkan percakapan panjang dan konteks besar, hingga 1 juta token per permintaan. Meskipun pertanyaan baru Anda singkat, seluruh percakapan sebelumnya tetap dihitung biayanya, sehingga biaya terakumulasi cepat seiring percakapan semakin panjang.

Untuk meringankan beban ini, penyedia AI utama memberikan diskon 90% pada cache read, secara signifikan menurunkan biaya pengiriman ulang konten yang sudah diproses.

## Mengapa Cache Mendominasi Total Biaya?

| Kategori | Token per Panggilan | Catatan |
|---|---|---|
| Input pengguna (token baru) | Puluhan hingga ratusan | Yang sebenarnya diketik pengguna |
| Output AI | Ratusan hingga ribuan | Respons AI |
| **Cache read** | **100K–ratusan K** | Seluruh percakapan terakumulasi dihitung setiap panggilan |

Volume cache read per panggilan **ribuan kali lebih besar** dari input. Meskipun dengan diskon 90%, cache read tetap mendominasi dalam jumlah dolar absolut.

Dan panggilan ini bukan hanya dari pesan pengguna:

| Pemanggil | Frekuensi | Cache Read per Panggilan |
|---|---|---|
| Pesan pengguna | Saat pengguna mengirim pesan | Seluruh percakapan terakumulasi |
| **Keputusan AI sendiri** | **Beberapa panggilan per pesan pengguna** | Seluruh percakapan terakumulasi |

Secara tidak terlihat, AI melakukan beberapa keputusan berurutan untuk satu pesan pengguna — memutuskan tool mana yang digunakan, menginterpretasikan hasil tool, memutuskan tindakan selanjutnya. Setiap keputusan ini adalah panggilan LLM penuh yang mencakup seluruh konteks. Eksekusi tool itu sendiri (membaca file, pencarian) berjalan secara lokal, tetapi pengambilan keputusan sebelum dan sesudah setiap penggunaan tool menimbulkan biaya cache read.

### Mengapa Biaya Cache Write Juga Lebih Besar dari Perkiraan?

Untuk Anthropic, biaya cache write adalah 1,25x input (tier 5 menit) atau 2x input (tier 1 jam). Dengan pengali tersebut, tampaknya cache write tidak akan melebihi 2x biaya input+output — tetapi dalam praktiknya, cache write mengambil porsi yang jauh lebih besar.

Dua alasan:

| Penyebab | Penjelasan |
|---|---|
| **System prompt** | Puluhan ribu token sebelum pengguna mengetik apa pun (dengan plugin/MCP). Semua ini dikenakan biaya cache write |
| **Pembuatan ulang setelah kedaluwarsa** | Setelah TTL (5 menit / 1 jam) berakhir, seluruh percakapan terakumulasi harus di-cache ulang. Semakin panjang percakapan, semakin tinggi biaya pembuatan ulang |

Dengan kata lain, cache write tidak hanya terjadi untuk "token baru yang diketik pengguna." Saat sesi dimulai, seluruh system prompt di-cache; setelah kedaluwarsa, seluruh percakapan terakumulasi menjadi target cache write. Jika cache percakapan 100K token kedaluwarsa, satu pesan memicu cache write 100K token sekaligus.

**Inilah mengapa plugin super-token-saver menampilkan peringatan kedaluwarsa cache setelah 1 jam tidak aktif.** Saat peringatan muncul, periksa ukuran konteks Anda saat ini:

- **Konteks kecil**: Biaya pembuatan ulang cache masih terjangkau. Lanjutkan saja — biayanya rendah.
- **Konteks besar**: Biaya cache akan signifikan. Kami merekomendasikan `/clear` diikuti `/s-continue last` untuk melanjutkan di sesi baru. Skill continue secara otomatis memulihkan konteks percakapan sebelumnya, sehingga alur kerja Anda tidak terganggu.

## Strategi Mengurangi Biaya Cache

Plugin super-token-saver dirancang untuk mengotomatiskan atau menyederhanakan semua strategi ini.

### 1. Jaga Konteks Tetap Kecil — `/clear` + `/s-continue` ⭐

**Ini adalah cara paling penting untuk mengurangi biaya.** Biaya cache yang tinggi berarti Anda mendapatkan diskon 90% — itu normal. Tetapi jika konteks tumbuh terlalu besar tanpa perlu dan tetap seperti itu, biaya absolut per panggilan meningkat meskipun ada diskon. **Menjaga ukuran konteks tetap terkendali adalah strategi manajemen biaya yang paling efektif.**

Saat topik berubah atau percakapan menjadi panjang, jalankan `/clear` untuk mereset, lalu `/s-continue last` untuk memulihkan konteks sebelumnya. `/s-continue` memulihkan percakapan sebelumnya tanpa panggilan LLM apa pun, sehingga biayanya nol.

`/compact` mengurangi konteks dengan merangkum percakapan, tetapi proses perangkuman itu sendiri menimbulkan biaya panggilan LLM dan menghilangkan detail percakapan. Tidak direkomendasikan.

### 2. Cegah Kedaluwarsa Cache — Token Guardian (Otomatis)

Cache sesi utama Anthropic menggunakan **tier 1 jam**. Setelah kedaluwarsa, permintaan pertama harus membuat ulang seluruh percakapan sebagai cache write, yang mahal.

super-token-saver mendeteksi status idle 1 jam dan **secara otomatis menampilkan peringatan**. Saat peringatan muncul, menggunakan metode 1 di atas (`/clear` + `/s-continue`) untuk melanjutkan di sesi baru adalah pendekatan paling ekonomis.

### 3. Delegasikan Pekerjaan Berat ke SubTask

Tugas berat seperti pembuatan kode atau editing multi-file dapat didelegasikan ke SubTask alih-alih dijalankan langsung di sesi utama. SubTask menggunakan tier cache 5 menit, membuat **cache write 37,5% lebih murah**, dan berjalan dalam konteks terisolasi yang lebih kecil, mengurangi volume cache read per panggilan.

super-token-saver secara otomatis membimbing pola pemisahan kerja ini saat sesi dimulai.

### 4. Pemantauan Biaya Real-Time — `/setup-statusline`

Pasang `/setup-statusline` untuk menampilkan status biaya/token real-time di bagian bawah CLI Anda: `[RUN] \$0.10/\$12.23 | [5H] 9% | [CTX] 22%`. Anda dapat segera mendeteksi biaya per panggilan yang abnormal tinggi atau konteks yang membesar, sehingga dapat bertindak sebelum biaya melonjak.

### 5. Analisis Pola Biaya — `/usage-view`

Gunakan `/usage-view` untuk meninjau seluruh riwayat penggunaan Anda sebagai dashboard. Visualisasikan tren biaya harian/per jam, komposisi token per sesi, dan efisiensi cache. Lihat sekilas tugas mana yang menyebabkan lonjakan biaya dan pola mana yang tidak efisien.

### 6. Optimasi System Prompt

Semakin banyak plugin, server MCP, dan skill yang dimuat ke system prompt, semakin tinggi biaya cache write awal. Hapus yang tidak Anda gunakan.

`/setup-git-lite` dari super-token-saver mengurangi instruksi Git bawaan Claude Code (~2.200 token) menjadi inti 280 token — pengurangan sekitar 88% pada system prompt terkait Git per sesi.

### 7. Pemilihan Tool — Dampak Konteks Berbeda per Tool

Setelah file dibaca, kontennya tetap berada dalam konteks dan terakumulasi dalam cache read untuk semua panggilan berikutnya. Membaca satu file secara penuh menambahkan ribuan hingga puluhan ribu token ke konteks, dan jumlah tersebut dikenakan biaya di setiap panggilan berikutnya.

Tugas coding sering melibatkan beberapa file secara bersamaan — membaca 3-4 file secara penuh saja dapat menyebabkan konteks membesar secara dramatis. Memilih tool yang tepat membuat perbedaan signifikan dalam pertumbuhan konteks.

| Tool | Tujuan | Dampak Konteks | Kapan Digunakan |
|---|---|---|---|
| **Grep** | Cari kode berdasarkan pola | **Minimal** — hanya mengembalikan baris yang cocok | Mencari nama fungsi, variabel, string tertentu |
| **Glob** | Cari file berdasarkan pola nama | **Minimal** — hanya mengembalikan path file | Mencari lokasi file seperti `*.ts`, `src/**/*.test.js` |
| **LSP** | Definisi simbol, referensi, tipe | **Minimal** — hanya mengembalikan definisi/signature | Go to definition, find references, cek tipe |
| **Read** (offset/limit) | Baca bagian tertentu dari file | **Sedang** — hanya mengembalikan rentang yang ditentukan | Saat Anda membutuhkan rentang baris tertentu |
| **Read** (penuh) | Baca seluruh file | **Besar** — seluruh file ditambahkan ke konteks | Hanya saat Anda perlu memahami struktur file secara keseluruhan |

"Baca seluruh file ini" menggunakan konteks puluhan hingga ratusan kali lebih banyak dari "Cari fungsi ini."

Prinsip yang sama berlaku untuk editing dan perbandingan:

| Tool | Tujuan | Dampak Konteks |
|---|---|---|
| **Edit** | Modifikasi file yang ada | **Minimal** — hanya diff yang ditambahkan ke konteks |
| **Write** | Buat file baru / tulis ulang penuh | **Besar** — seluruh file ditambahkan ke konteks |
| **git diff / diff** | Bandingkan file/folder | **Minimal** — hanya perbedaan yang dikembalikan |
| Baca kedua file terpisah | Bandingkan file/folder | **Besar** — kedua file penuh ditambahkan ke konteks |

super-token-saver secara otomatis menyuntikkan panduan pemilihan tool ini ke AI saat sesi dimulai, mendorong penggunaan tool ringan terlebih dahulu.

## Lampiran: Perbandingan Cache Antar Penyedia AI

### Biaya Cache

| Penyedia | Biaya Cache Write | Diskon Cache Read | Biaya Penyimpanan Cache |
|---|---|---|---|
| **Anthropic**<br/>(Claude Code) | Tier 5 menit: 1,25x input<br/>Tier 1 jam: 2x input | Diskon 90% | Tidak ada |
| **OpenAI**<br/>(Codex) | Tanpa premium (sama dengan input) | Diskon 90% | Tidak ada |
| **Google Gemini**<br/>(Gemini CLI) | Tanpa premium (sama dengan input) | Diskon 90% | Tidak ada |

> **Catatan**: Tingkat diskon cache read bervariasi per model. Angka ini mencerminkan model flagship terbaru dari setiap penyedia.

### Cache Time-to-Live (TTL)

| Penyedia | TTL | Jaminan |
|---|---|---|
| **Anthropic**<br/>(Claude Code) | 5 menit atau 1 jam | **Didefinisikan secara eksplisit** |
| **OpenAI**<br/>(Codex) | Biasanya dihapus setelah 5-10 menit tidak aktif; dapat bertahan hingga 1 jam saat periode sepi | **Tidak dijamin** — dokumentasi resmi menggunakan "generally", "up to" |
| **Google Gemini**<br/>(Gemini CLI) | Tidak diungkapkan | **Tidak dijamin** — explicit caching dengan TTL terjamin tersedia via API (berbayar) |

> **Catatan**: Berdasarkan eksperimen kami dengan Claude Code, sesi utama biasanya menggunakan tier 1 jam, sementara SubTask menggunakan tier 5 menit.

### Opsi Kontrol Cache Tambahan via Panggilan API Langsung

Perbandingan di atas dari perspektif pengguna alat AI coding (Claude Code, Codex, Gemini CLI). Developer yang memanggil API secara langsung memiliki kontrol cache yang lebih detail.

**Anthropic**

- `cache_control`: Atur breakpoint untuk mendefinisikan batas cache secara eksplisit. Ditentukan otomatis jika tidak dispesifikasikan.
- Tier TTL (5 menit / 1 jam) dapat dipilih per permintaan.

**OpenAI**

- `prompt_cache_key`: Mengarahkan permintaan dengan key yang sama ke server yang sama, meningkatkan tingkat cache hit. Codex secara internal mengatur ini ke `conversation_id` secara otomatis.
- `prompt_cache_retention: "24h"`: Retensi cache yang diperpanjang. Memperpanjang default 5-10 menit hingga 24 jam (tanpa biaya tambahan, tidak dijamin). Codex tidak menggunakan opsi ini.

**Google Gemini**

- Explicit caching (`CachedContent`): Atur TTL dari 1 menit hingga 48 jam untuk menjamin cache hit. Biaya penyimpanan berlaku (\$4,50/MTok/jam untuk Pro). Pembaruan konten cache memerlukan pembuatan CachedContent baru secara manual. Gemini CLI tidak menggunakan fitur ini.

> **Catatan**: Opsi ini tidak diekspos di alat AI coding dan tidak dapat dikontrol langsung oleh pengguna. Pengguna alat AI coding sebaiknya merujuk ke bagian "Strategi Mengurangi Biaya Cache" di teks utama.

### Sumber

- Anthropic: [Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- OpenAI: [Prompt Caching](https://platform.openai.com/docs/guides/prompt-caching), [Pricing](https://platform.openai.com/docs/pricing)
- Google: [Context Caching](https://ai.google.dev/gemini-api/docs/caching), [Pricing](https://ai.google.dev/gemini-api/docs/pricing)
