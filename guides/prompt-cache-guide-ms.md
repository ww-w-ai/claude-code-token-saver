# Panduan Kos Cache — Mengapa Kebanyakan Kos Anda Datang dari Cache

Adalah normal jika kebanyakan kos alat AI coding anda datang dari operasi cache (write + read). Dokumen ini menerangkan sebabnya dan cara menguruskannya.

## Rahsianya: Setiap Mesej Menghantar Semula Keseluruhan Perbualan

LLM bersifat **stateless**. Tidak seperti manusia, model AI tidak "mengingat" perbualan sebelumnya — mereka menerima keseluruhan sejarah perbualan sebagai input pada setiap permintaan.

Ia kelihatan seperti chat, tetapi panggilan API sebenar berfungsi seperti ini:

```
[ Permintaan 1 ]
→ System prompt + "Baiki bug ini"
← Respons AI

[ Permintaan 2 ]
→ System prompt + "Baiki bug ini" + Respons AI + "Tambah ujian juga"
← Respons AI

[ Permintaan 3 ]
→ System prompt + "Baiki bug ini" + Respons AI + "Tambah ujian juga" + Respons AI + "Commit"
← Respons AI
```

Setiap permintaan menyertakan **semua** kandungan sebelumnya. Contohnya, permintaan ke-50 mengandungi keseluruhan perbualan dan semua respons AI dari 49 permintaan sebelumnya. Inilah sebabnya token input meningkat dengan cepat apabila perbualan semakin panjang.

Tambahan pula, alat AI coding menghantar system prompt (arahan terbina dalam, fail konfigurasi, plugin, definisi tool MCP, dll.) dengan setiap permintaan — jadi walaupun mesej satu baris menghasilkan puluhan ribu token input.

## Apa Itu Caching?

**Prompt caching** mengurangkan kos penghantaran berulang ini. Ia menyimpan bahagian input yang tidak berubah di server supaya permintaan seterusnya boleh menggunakannya semula pada kadar diskaun.

- **Cache Write**: Kos menyimpan kandungan perbualan di server. Berlaku pada permintaan pertama atau selepas cache tamat tempoh.
- **Cache Read**: Kos menggunakan semula kandungan yang sudah tersimpan. Dicaj pada **diskaun 90%** berbanding input standard.

Alat AI coding secara semula jadi menghasilkan perbualan panjang dan konteks besar, sehingga 1 juta token setiap permintaan. Walaupun soalan baru anda pendek, keseluruhan perbualan sebelumnya dicaj bersama, jadi kos terkumpul dengan pantas apabila perbualan semakin panjang.

Untuk mengurangkan beban ini, penyedia AI utama memberikan diskaun 90% pada cache read, menurunkan kos penghantaran semula kandungan yang sudah diproses dengan ketara.

## Mengapa Cache Mendominasi Jumlah Kos?

| Kategori | Token per Panggilan | Nota |
|---|---|---|
| Input pengguna (token baru) | Puluhan hingga ratusan | Apa yang sebenarnya ditaip pengguna |
| Output AI | Ratusan hingga ribuan | Respons AI |
| **Cache read** | **100K–ratusan K** | Keseluruhan perbualan terkumpul dicaj setiap panggilan |

Jumlah cache read per panggilan adalah **beribu kali lebih besar** daripada input. Walaupun dengan diskaun 90%, cache read masih mendominasi dari segi nilai dolar mutlak.

Dan panggilan ini bukan hanya dari mesej pengguna:

| Pemanggil | Kekerapan | Cache Read per Panggilan |
|---|---|---|
| Mesej pengguna | Apabila pengguna menghantar mesej | Keseluruhan perbualan terkumpul |
| **Keputusan AI sendiri** | **Beberapa panggilan per mesej pengguna** | Keseluruhan perbualan terkumpul |

Secara tidak ketara, AI membuat beberapa keputusan berturutan untuk satu mesej pengguna — memutuskan tool mana yang digunakan, mentafsir hasil tool, memutuskan tindakan seterusnya. Setiap keputusan ini adalah panggilan LLM penuh yang merangkumi keseluruhan konteks. Pelaksanaan tool itu sendiri (membaca fail, carian) berjalan secara tempatan, tetapi proses membuat keputusan sebelum dan selepas setiap penggunaan tool menimbulkan kos cache read.

### Mengapa Kos Cache Write Juga Lebih Besar Daripada Jangkaan?

Untuk Anthropic, kos cache write ialah 1.25x input (tier 5 minit) atau 2x input (tier 1 jam). Pada pengganda tersebut, nampaknya cache write tidak sepatutnya melebihi 2x kos input+output — tetapi dalam praktik, cache write mengambil bahagian yang jauh lebih besar.

Dua sebab:

| Punca | Penjelasan |
|---|---|
| **System prompt** | Puluhan ribu token sebelum pengguna menaip apa-apa (dengan plugin/MCP). Semua ini dikenakan kos cache write |
| **Penciptaan semula selepas tamat tempoh** | Selepas TTL (5 minit / 1 jam) tamat, keseluruhan perbualan terkumpul perlu di-cache semula. Semakin panjang perbualan, semakin tinggi kos penciptaan semula |

Dengan kata lain, cache write tidak hanya berlaku untuk "token baru yang ditaip pengguna." Pada permulaan sesi, keseluruhan system prompt di-cache; selepas tamat tempoh, keseluruhan perbualan terkumpul menjadi sasaran cache write. Jika cache perbualan 100K token tamat tempoh, satu mesej mencetuskan cache write 100K token sekaligus.

**Inilah sebabnya plugin super-token-saver memaparkan amaran tamat tempoh cache selepas 1 jam tidak aktif.** Apabila amaran muncul, semak saiz konteks semasa anda:

- **Konteks kecil**: Kos penciptaan semula cache masih terurus. Teruskan sahaja — kosnya rendah.
- **Konteks besar**: Kos cache akan menjadi ketara. Kami mengesyorkan `/clear` diikuti `/s-continue last` untuk menyambung dalam sesi baru. Skill continue secara automatik memulihkan konteks perbualan sebelumnya, jadi aliran kerja anda tidak terganggu.

## Strategi Mengurangkan Kos Cache

Plugin super-token-saver direka untuk mengautomatikkan atau memudahkan semua strategi ini.

### 1. Kekalkan Konteks Kecil — `/clear` + `/s-continue` ⭐

**Ini adalah cara paling penting untuk mengurangkan kos.** Kos cache yang tinggi bermaksud anda mendapat diskaun 90% — itu normal. Tetapi jika konteks membesar tanpa perlu dan kekal begitu, kos mutlak per panggilan meningkat walaupun ada diskaun. **Mengekalkan saiz konteks terkawal adalah strategi pengurusan kos yang paling berkesan.**

Apabila topik berubah atau perbualan menjadi panjang, jalankan `/clear` untuk menetapkan semula, kemudian `/s-continue last` untuk memulihkan konteks sebelumnya. `/s-continue` memulihkan perbualan sebelumnya tanpa sebarang panggilan LLM, jadi kosnya sifar.

`/compact` mengurangkan konteks dengan merumuskan perbualan, tetapi proses perumusan itu sendiri menimbulkan kos panggilan LLM dan membuang butiran perbualan. Tidak disyorkan.

### 2. Elakkan Tamat Tempoh Cache — Token Guardian (Automatik)

Cache sesi utama Anthropic menggunakan **tier 1 jam**. Selepas tamat tempoh, permintaan pertama perlu mencipta semula keseluruhan perbualan sebagai cache write, yang mahal.

super-token-saver mengesan keadaan idle 1 jam dan **secara automatik memaparkan amaran**. Apabila amaran muncul, menggunakan kaedah 1 di atas (`/clear` + `/s-continue`) untuk menyambung dalam sesi baru adalah pendekatan paling jimat.

### 3. Wakilkan Kerja Berat kepada SubTask

Tugas berat seperti penjanaan kod atau penyuntingan berbilang fail boleh diwakilkan kepada SubTask daripada dijalankan terus dalam sesi utama. SubTask menggunakan tier cache 5 minit, menjadikan **cache write 37.5% lebih murah**, dan berjalan dalam konteks terpencil yang lebih kecil, mengurangkan jumlah cache read per panggilan.

super-token-saver secara automatik membimbing pola pemisahan kerja ini pada permulaan sesi.

### 4. Pemantauan Kos Masa Nyata — `/setup-statusline`

Pasang `/setup-statusline` untuk memaparkan status kos/token masa nyata di bahagian bawah CLI anda: `[RUN] \$0.10/\$12.23 | [5H] 9% | [CTX] 22%`. Anda boleh mengesan kos per panggilan yang luar biasa tinggi atau konteks yang membesar dengan serta-merta, membolehkan anda bertindak sebelum kos melonjak.

### 5. Analisis Pola Kos — `/usage-view`

Gunakan `/usage-view` untuk menyemak keseluruhan sejarah penggunaan anda sebagai dashboard. Visualisasikan trend kos harian/per jam, komposisi token per sesi, dan kecekapan cache. Lihat sekilas tugas mana yang menyebabkan lonjakan kos dan pola mana yang tidak cekap.

### 6. Pengoptimuman System Prompt

Semakin banyak plugin, pelayan MCP, dan skill dimuatkan ke system prompt, semakin tinggi kos cache write awal. Buang apa yang anda tidak gunakan.

`/setup-git-lite` dari super-token-saver mengurangkan arahan Git terbina dalam Claude Code (~2,200 token) kepada 280 token teras — pengurangan kira-kira 88% pada system prompt berkaitan Git bagi setiap sesi.

### 7. Pemilihan Tool — Kesan Konteks Berbeza Mengikut Tool

Sebaik sahaja fail dibaca, kandungannya kekal dalam konteks dan terkumpul dalam cache read untuk semua panggilan seterusnya. Membaca satu fail secara penuh menambah beribu hingga berpuluh ribu token ke konteks, dan jumlah tersebut dicaj pada setiap panggilan seterusnya.

Tugas coding sering melibatkan beberapa fail serentak — membaca 3-4 fail secara penuh sahaja boleh menyebabkan konteks membesar secara mendadak. Memilih tool yang betul membuat perbezaan ketara dalam pertumbuhan konteks.

| Tool | Tujuan | Kesan Konteks | Bila Digunakan |
|---|---|---|---|
| **Grep** | Cari kod mengikut pola | **Minimum** — hanya memulangkan baris yang sepadan | Mencari nama fungsi, pembolehubah, rentetan tertentu |
| **Glob** | Cari fail mengikut pola nama | **Minimum** — hanya memulangkan laluan fail | Mencari lokasi fail seperti `*.ts`, `src/**/*.test.js` |
| **LSP** | Definisi simbol, rujukan, jenis | **Minimum** — hanya memulangkan definisi/signature | Go to definition, find references, semak jenis |
| **Read** (offset/limit) | Baca bahagian tertentu fail | **Sederhana** — hanya memulangkan julat yang dinyatakan | Apabila anda memerlukan julat baris tertentu |
| **Read** (penuh) | Baca keseluruhan fail | **Besar** — keseluruhan fail ditambah ke konteks | Hanya apabila anda perlu memahami struktur fail sepenuhnya |

"Baca keseluruhan fail ini" menggunakan konteks berpuluh hingga beratus kali lebih banyak daripada "Cari fungsi ini."

Prinsip yang sama terpakai untuk penyuntingan dan perbandingan:

| Tool | Tujuan | Kesan Konteks |
|---|---|---|
| **Edit** | Ubah suai fail sedia ada | **Minimum** — hanya diff yang ditambah ke konteks |
| **Write** | Cipta fail baru / tulis semula penuh | **Besar** — keseluruhan fail ditambah ke konteks |
| **git diff / diff** | Bandingkan fail/folder | **Minimum** — hanya perbezaan yang dikembalikan |
| Baca kedua-dua fail berasingan | Bandingkan fail/folder | **Besar** — kedua-dua fail penuh ditambah ke konteks |

super-token-saver secara automatik menyuntik panduan pemilihan tool ini kepada AI pada permulaan sesi, menggalakkan penggunaan tool ringan terlebih dahulu.

## Lampiran: Perbandingan Cache Merentas Penyedia AI

### Kos Cache

| Penyedia | Kos Cache Write | Diskaun Cache Read | Kos Penyimpanan Cache |
|---|---|---|---|
| **Anthropic**<br/>(Claude Code) | Tier 5 minit: 1.25x input<br/>Tier 1 jam: 2x input | Diskaun 90% | Tiada |
| **OpenAI**<br/>(Codex) | Tanpa premium (sama dengan input) | Diskaun 90% | Tiada |
| **Google Gemini**<br/>(Gemini CLI) | Tanpa premium (sama dengan input) | Diskaun 90% | Tiada |

> **Nota**: Kadar diskaun cache read berbeza mengikut model. Angka ini mencerminkan model flagship terkini setiap penyedia.

### Cache Time-to-Live (TTL)

| Penyedia | TTL | Jaminan |
|---|---|---|
| **Anthropic**<br/>(Claude Code) | 5 minit atau 1 jam | **Ditakrifkan secara eksplisit** |
| **OpenAI**<br/>(Codex) | Biasanya dibuang selepas 5-10 minit tidak aktif; mungkin bertahan sehingga 1 jam semasa waktu lengang | **Tidak dijamin** — dokumentasi rasmi menggunakan "generally", "up to" |
| **Google Gemini**<br/>(Gemini CLI) | Tidak didedahkan | **Tidak dijamin** — explicit caching dengan TTL terjamin tersedia melalui API (berbayar) |

> **Nota**: Berdasarkan eksperimen kami dengan Claude Code, sesi utama biasanya menggunakan tier 1 jam, manakala SubTask menggunakan tier 5 minit.

### Pilihan Kawalan Cache Tambahan melalui Panggilan API Langsung

Perbandingan di atas dari perspektif pengguna alat AI coding (Claude Code, Codex, Gemini CLI). Pembangun yang memanggil API secara langsung mempunyai kawalan cache yang lebih terperinci.

**Anthropic**

- `cache_control`: Tetapkan breakpoint untuk mentakrifkan sempadan cache secara eksplisit. Ditentukan secara automatik jika tidak dinyatakan.
- Tier TTL (5 minit / 1 jam) boleh dipilih bagi setiap permintaan.

**OpenAI**

- `prompt_cache_key`: Menghalakan permintaan dengan kunci yang sama ke pelayan yang sama, meningkatkan kadar cache hit. Codex secara dalaman menetapkan ini kepada `conversation_id` secara automatik.
- `prompt_cache_retention: "24h"`: Penahanan cache yang dilanjutkan. Memanjangkan lalai 5-10 minit sehingga 24 jam (tanpa kos tambahan, tidak dijamin). Codex tidak menggunakan pilihan ini.

**Google Gemini**

- Explicit caching (`CachedContent`): Tetapkan TTL dari 1 minit hingga 48 jam untuk menjamin cache hit. Yuran penyimpanan dikenakan (\$4.50/MTok/jam untuk Pro). Kemas kini kandungan cache memerlukan penciptaan CachedContent baharu secara manual. Gemini CLI tidak menggunakan ciri ini.

> **Nota**: Pilihan ini tidak didedahkan dalam alat AI coding dan tidak boleh dikawal secara langsung oleh pengguna. Pengguna alat AI coding sepatutnya merujuk bahagian "Strategi Mengurangkan Kos Cache" dalam teks utama.

### Sumber

- Anthropic: [Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- OpenAI: [Prompt Caching](https://platform.openai.com/docs/guides/prompt-caching), [Pricing](https://platform.openai.com/docs/pricing)
- Google: [Context Caching](https://ai.google.dev/gemini-api/docs/caching), [Pricing](https://ai.google.dev/gemini-api/docs/pricing)
