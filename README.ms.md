# cc-token-saver

> **Claude Code selalu tergendala? Tak lagi.**
>
> Jimat kos, kod lebih lama, dan lihat ke mana token anda pergi — tanpa konfigurasi.

Bagaimana? Pengurusan context automatik, penjejakan kos masa nyata, dan kawalan session sedar-cache — semuanya dalam satu plugin.

---

## 😤 Masalah: $200/bulan Tapi Masih Tak Produktif

Plan Claude Code Max ($200/bulan). Patut cukup. Tapi tak cukup.

**Rate limit tetingkap bergulir 5 jam.** Anda tengah fokus menulis kod dan tiba-tiba berhenti. Tiada pemasa. Tiada anggaran masa. Hanya menunggu.

**Cache expiry.** Anda balik dari makan tengahari. Dah lebih sejam. Anda hantar satu prompt dan 900K token dihantar semula pada harga penuh. Kos? $9 sekali hantar.

**Kos tersembunyi.** Tiada cara untuk melihat berapa yang anda belanjakan secara masa nyata. Anda hanya tahu selepas rate limit dicapai.

**Semuanya manual.** Saiz context, masa cache expiry, delegasi SubTask, pembersihan session. Siapa boleh jejak semua ini sambil menulis kod?

cc-token-saver mengendalikan semuanya secara automatik. **Pasang sekali. Siap.**

---

## 🚀 Pemasangan

```
claude plugin marketplace add ww-w-ai/cc-token-saver
claude plugin install cc-token-saver
```

Berfungsi secara automatik selepas pemasangan. Tanpa konfigurasi. Memerlukan [Claude Code](https://claude.ai/claude-code) v2.1.71+.

Untuk pemantauan langsung:

```
/setup-statusline install
```

---

## 🛡️ Ciri 1: Token Guardian

**Mengesan cache expiry dan menyekat penghantaran semula yang mahal secara automatik.**

TTL cache prompt Claude Code ialah 1 jam. Tinggalkan lebih sejam dan cache tamat tempoh. Mesej seterusnya menghantar semula keseluruhan context pada harga penuh. Pada 900K token, itu $9 sekali hantar.

Token Guardian menjejak bila respons terakhir diterima. Jika lebih daripada 3,590 saat telah berlalu (TTL tolak buffer 10 saat), ia menyekat prompt dan memaparkan amaran.

```
🚨 Cache tamat tempoh (68m 23s tidak aktif)

Cache telah tamat. Meneruskan akan menghantar semula semua konteks.
Kos mungkin meningkat dengan ketara.

👉 /context — Semak penggunaan konteks semasa sebelum membuat keputusan
👉 /clear → /continue — Tetapkan semula lalu pulihkan konteks sebelumnya (disyorkan, kos terendah)
👉 Hantar semula — Teruskan seperti sedia ada (kos re-cache penuh ditanggung)
```

Hanya hantar semula prompt yang sama selepas amaran — ia akan melalui. Amaran hanya muncul sekali bagi setiap tempoh idle, jadi ia tidak mengganggu. Mesej amaran dipaparkan dalam 23 bahasa berdasarkan locale OS anda.

**Hasil:** Kos re-cache yang mahal dicegah secara automatik. Tiada usaha diperlukan.

---

## 🧠 Ciri 2: Smart Session Architecture

**Pasang sahaja dan corak kerja yang dioptimumkan kos bermula secara automatik.**

Kebanyakan pengguna melakukan segala-galanya dalam Main session. Membaca fail, menjana kod, menjalankan ujian. Setiap output bertimbun dalam context dan dihantar semula dengan setiap mesej. Session membengkak. Kos melambung.

Session Architect secara automatik menyuntik strategi delegasi pada permulaan session.

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Peranan          | Reka bentuk, keputusan, semakan   | Pelaksanaan, penjanaan kod, pelbagai fail |
| Cache tier       | 1 jam (ephemeral_1h)              | 5 min                                 |
| Kos cache write  | ＄10/MTok                          | ＄6.25/MTok                            |
| Saiz context     | ~94K purata                       | ~33K purata                           |

SubTask mempunyai **cache write 37.5% lebih murah** berbanding Main. Context juga lebih kecil. Mendelegasikan kerja berat ke SubTask mengurangkan kos secara drastik.

**Hasil:** Claude secara automatik bekerja dalam corak yang cekap kos. Anda tak perlu fikirkan.

---

## 🔄 Ciri 3: /continue — Pemulihan Context

**Menggantikan `/compact`. Sifar panggilan LLM. Sifar kos token.**

`/compact` menghantar keseluruhan context anda (~1M token) kepada LLM untuk dimampatkan menjadi ringkasan 3.3%. Jika cache telah tamat tempoh, itu sahaja sudah mencetuskan re-cache penuh. Kehilangan maklumat pasti berlaku.

`/continue` mengambil pendekatan yang sama sekali berbeza. Ia memproses transkrip session sebelumnya dan memuatkannya terus. Tiada panggilan LLM. Tiada kos. Perbualan asal dipulihkan seperti sedia ada.

|                         | /compact                          | /continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| Cara ia berfungsi       | Menghantar context penuh kepada LLM untuk ringkasan | Memproses transkrip, membaca terus |
| Panggilan LLM           | Diperlukan (biasanya 100K+ token) | 0                                |
| Kos token               | Tinggi                            | 0                                |
| Kehilangan maklumat     | Ya (ringkasan 3.3%)              | Tiada (asal terpelihara)         |
| Kelajuan pemprosesan    | Berpuluh saat                     | < 1 saat (walaupun fail 60MB+)   |
| Bila cache tamat tempoh | Kos re-cache penuh ditambah       | Tiada kesan                      |
| Pemulihan pelbagai session | Tidak boleh                    | Disokong                         |

Penggunaan: `/clear` kemudian `/continue`. Anda akan melihat senarai session sebelumnya. Pilih satu untuk dipulihkan. Untuk pemulihan pantas: `/continue last`.

**Hasil:** Sambung semula kerja sebelumnya pada kos sifar. Tiada kehilangan maklumat.

---

## 📊 Ciri 4: Live Status Line

**Pemantauan token/kos masa nyata. Overhed di bawah 50ms.**

Jalankan `/setup-statusline install` sekali dan bar status kekal muncul di bahagian bawah Claude Code.

```
[RUN🟢] $0.10/$12.23 | [5H🟢] 9% ⏳1h32m | [CTX🟢] 22%
```

| Penunjuk         | Apa yang dipaparkan                 | 🟢 Normal | 🟡 Amaran  | 🔴 Kritikal |
| ---------------- | ----------------------------------- | --------- | ---------- | ----------- |
| RUN (delta)      | Kos panggilan API terakhir          | < ＄0.30   | >= ＄0.30   | >= ＄1.00    |
| RUN (kumulatif)  | Kos kumulatif untuk folder ini      | —         | —          | —           |
| 5H               | Penggunaan tetingkap 5 jam + undur masa reset | < 70%     | >= 70%     | >= 90%      |
| CTX              | Penggunaan tetingkap context        | < 35%     | >= 35%     | >= 70%      |

Apabila mana-mana penunjuk mencapai amaran atau kritikal, petunjuk `→ /usage-view current` muncul secara automatik.

Untuk membuang: `/setup-statusline uninstall` (konfigurasi sebelumnya dipulihkan secara automatik).

**Hasil:** Lihat keadaan kos anda sepintas lalu. Bertindak sebelum terlambat.

---

## 📈 Usage Dashboard (/usage-view)

**Akhirnya jawab: "Kenapa saya kena rate limit?"**

Selama ini, kena rate limit hanya buat anda marah. Tiada cara untuk tahu puncanya. Session mana yang paling banyak membakar token? Bila kos melonjak? Apa corak penggunaan anda? Semuanya tak nampak.

`/usage-view` menunjukkan semuanya. Dashboard HTML interaktif dibuka dalam pelayar anda, membolehkan anda menganalisis corak penggunaan dan menjejak punca lonjakan kos. Tiada kebergantungan luaran. Berfungsi sendiri. Boleh dikongsi sebagai fail.

Apa yang termasuk:

- Trend kos harian / setiap jam / hari dalam minggu — kenal pasti bila anda paling banyak membakar token
- Pecahan token (input, output, cache write, cache read) — lihat apa yang mendorong kos
- Analisis kos mengikut session — kenal pasti tugas mana yang mahal
- Garis masa tetingkap 5 jam (pelanggan Max Plan) — jejak pencetus rate limit
- Analisis insight dikuasakan AI — mentafsir data dan mencadangkan penambahbaikan
- 23 bahasa disokong (RTL termasuk; carta/jadual kekal LTR)

```
/usage-view                  # Sepanjang masa, semua projek
/usage-view current          # Tetingkap 5 jam semasa sahaja
/usage-view last 7 days      # 7 hari lepas
/usage-view locale ms        # Bahasa Melayu
```

---

## 🔬 Kajian Rate Limit (/report-limit)

**Projek komuniti untuk merekayasa balik formula rate limit.**

Anthropic tidak menerbitkan formula tepat tetingkap 5 jam. Jom kita cari bersama.

Apabila anda kena rate limit, jalankan `/report-limit`. Data penggunaan semasa anda dihantar secara automatik sebagai GitHub Discussion. Semakin banyak data yang dikumpul, semakin jelas formulanya.

---

## ✂️ Ciri 5: /setup-git-lite — Pangkas Arahan Git Terbina dalam CC

**2,200 token tersembunyi setiap session yang tidak anda sedar anda bayar.**

### Penemuan

Pada 2026-04-12, sebuah [isu GitHub](https://github.com/anthropics/claude-code/issues/47107) mendedahkan bahawa tetapan `includeGitInstructions` terbina dalam Claude Code secara senyap membakar token setiap session. Pengesahan bebas melalui [gist ini (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) mengesahkan angkanya: **+6,031 token dalam cache write** setiap session selepas setiap git commit, **+1,690 token dalam cache read** pada setiap panggilan API.

### Analisis sumber CC — ke mana token pergi

Kami mengesan token ke dua titik suntikan bebas dalam sumber Claude Code (v2.1.88):

**1. Syot `gitStatus` (~500 tok) — system prompt**
- `context.ts:36-111` `getGitStatus()` mengumpul branch + main branch + user.name + status penuh (sehingga 2000 aksara) + **5 commit terbaru**
- Digabung dan ditambah ke system prompt melalui `appendSystemContext` (`utils/api.ts:437`)
- Setiap commit baharu, setiap fail diubah suai, setiap pertukaran branch mengubah teks → prefix cache invalidation

**2. Arahan aliran kerja Commit/PR (~1,700 tok) — penerangan alat Bash**
- `tools/BashTool/prompt.ts:53` menambah 60+ baris protokol keselamatan, prosedur commit langkah demi langkah, contoh HEREDOC, dan templat penciptaan PR ke penerangan alat `Bash`
- Di-cache bersama system prompt, tetapi dihantar sebagai parameter `tools[]`

### Sebab ia mahal

Struktur cache (`utils/api.ts:321` `splitSysPromptPrefix`) mempunyai tiga laluan berdasarkan sama ada anda mempunyai alat MCP aktif:

- **Path A** (MCP aktif — kebanyakan pengguna): `gitStatus` berada dalam blok `cacheScope: 'org'`. Sebarang perubahan → keseluruhan blok di-cache semula pada permulaan session seterusnya → 6K tok `cache_create` miss.
- **Path B** (tiada MCP): `gitStatus` ke blok dinamik `cacheScope: null`, bermakna ia dihantar semula sebagai `input_tokens` segar pada setiap panggilan API — tiada cache miss, tetapi tiada penjimatan cache juga.
- **Path C** (penyedia 3P / beta eksperimental dilumpuhkan): sama seperti Path A.

Dalam session interaktif biasa, arahan commit/PR (1.7K tok) terkumpul **pada setiap panggilan API** melalui `cache_read`. Sepanjang session 100 panggilan pada harga Opus 4.7, itu kira-kira **$0.08 setiap session** hanya untuk arahan yang latihan Claude sudah sebahagian besarnya merangkumi.

### Cara cc-token-saver mengendalikannya

`/setup-git-lite` melumpuhkan laluan natif dan menyuntik **penggantian 280-token yang diperhalus** melalui hook SessionStart. Kami mengekalkan tepat perkara yang mengatasi tingkah laku lalai Claude (peraturan keselamatan), dan membuang semua yang Claude sudah tahu daripada latihan (aliran kerja langkah demi langkah, templat PR, corak penggunaan gh).

**Dikekalkan — 11 peraturan penggantian kritikal** (yang menukar pertolongan lalai Claude kepada berhati-hati):
- Jangan sekali-kali commit/push/amend/PR/tag/merge tanpa permintaan pengguna yang jelas
- Jangan sekali-kali langkau hooks, force-push ke main/master, jalankan operasi merosakkan, ubah suai git config
- Jangan sekali-kali commit fail yang sepadan dengan `.env`, `credentials`, `*.pem`, `secret.*`
- Elakkan `git add -A` / `git add .`
- HEREDOC untuk mesej commit berbilang baris + trailer `Co-Authored-By: Claude`
- Jangan sekali-kali gunakan bendera interaktif (-i), tiada commit kosong
- Jika hook pra-commit gagal → buat commit BAHARU (bukan `--amend`)

**Dibuang** — aliran kerja commit langkah demi langkah (3 langkah), aliran kerja PR langkah demi langkah (3 langkah), templat tajuk/badan PR, rujukan perintah `gh`, amaran bendera `-uall`, amaran `--no-edit` dengan rebase, kekangan `JANGAN gunakan alat TodoWrite atau Agent semasa commit`. Ini adalah keverbosan aliran kerja yang Claude hasilkan dengan betul daripada latihan sahaja.

**Ditambah** — baris keadaan git ringkas: branch + HEAD short-sha + subjek + status semasa (sehingga 20 fail diubah suai, atau kiraan jika melebihi). Tiada senarai commit terbaru (Claude boleh jalankan `git log` atas permintaan).

### Jangkaan penjimatan (harga Opus 4.7, $25/MTok output, $5/MTok input, $0.50/MTok cache read)

| Item | Asal | Dengan setup-git-lite | Dijimatkan |
| ---- | ---- | --------------------- | ---------- |
| Muatan system prompt (setiap session baharu) | ~2,200 tok cache_create | ~280 tok cache_create | ~1,920 tok |
| Panggilan berulang dalam session yang sama | ~1,700 tok cache_read/panggilan | ~280 tok cache_read/panggilan | ~1,420 tok/panggilan |
| Session 100 panggilan (Opus 4.7) | — | — | **~$0.11 dijimatkan** |
| 20 session/hari × 22 hari bekerja | — | — | **~$48 dijimatkan/bulan** |

### Penggunaan

```bash
/setup-git-lite status     # Diagnostik baca sahaja — keadaan semasa + apa yang akan berubah
/setup-git-lite install    # Lumpuhkan CC natif + aktifkan hook minimal kami
/setup-git-lite revert     # Pulihkan lalai (agresif; lihat di bawah)
/setup-git-lite dismiss-banner    # Senyapkan tip cadangan sesekali
/setup-git-lite undismiss-banner  # Aktifkan semula tip
/setup-git-lite help       # Penggunaan penuh
```

### Semantik pemasangan

`install` mengubah suai **dua** tempat untuk keteguhan:

1. `~/.claude/settings.json` — menambah `"includeGitInstructions": false`
2. Profil shell (`~/.zshrc`, `~/.bashrc`, dsb.) — menambah blok penanda yang mengeksport `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`

Mana-mana satu sahaja sudah cukup untuk melumpuhkan CC natif; kami menetapkan kedua-duanya supaya penggantian persekitaran tidak secara tidak sengaja mengaktifkan semula tingkah laku natif. Perubahan shell berkuat kuasa dalam shell baharu sahaja.

### Semantik revert — agresif

`revert` **mengalih keluar SEMUA eksport `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` daripada profil shell anda**, termasuk yang mungkin anda tambah secara manual sebelum memasang skill ini. Ini disengajakan — anda menjalankan `revert`, jadi kami memulihkan lalai yang bersih. Kami sentiasa membuat sandaran profil shell berstempel masa terlebih dahulu.

Jika anda memerlukan pemboleh ubah persekitaran itu untuk sebab yang tidak berkaitan, catat sebelum menjalankan `revert` dan tambah semula selepasnya.

### Sebelum menyahpasang cc-token-saver

**Jalankan `/setup-git-lite revert` dahulu**, atau anda akan ditinggalkan dengan `includeGitInstructions: false` dalam settings.json tetapi tiada hook penggantian (Claude langsung tidak mendapat panduan git). Claude Code pada masa ini tidak mempunyai hook kitaran hayat penyahpasangan plugin, jadi kami tidak dapat mengautomasikan ini.

### Pertukaran niaga

Apa yang anda kehilangan (dan mengapa ia biasanya tidak mengapa):
- Claude tidak lagi menerima `git status` / `git log -n 5` pra-dikira pada permulaan session. Jika anda bertanya "apa yang berubah?" dalam session baharu, Claude akan menjalankan perintah tersebut sendiri (satu panggilan alat tambahan, ~300 tok).
- Claude tidak lagi melihat prosedur commit 3-langkah canonical CC. Dalam ujian kami merentasi beratus aliran commit, pengetahuan peringkat latihan mengendalikan kes kritikal (pemformatan HEREDOC, tiada `--amend`, tiada force-push) kerana kami mengekalkan peraturan tersebut secara eksplisit.
- Templat badan PR (`## Summary` + `## Test plan`) tidak disuntik. Jika anda mengambil berat tentang format tepat itu, letakkan dalam CLAUDE.md projek anda.

### Sepanduk cadangan

Apabila arahan git natif CC masih aktif pada mesin anda, cc-token-saver menunjukkan tip satu perenggan pada permulaan session **~20% daripada masa** (ditambah dalam output `/usage-view` dan `/report-limit`). Senyapkan secara kekal dengan `/setup-git-lite dismiss-banner`.

---

## 💡 Cara Cache Sebenarnya Berfungsi

Claude Code menghantar keseluruhan sejarah perbualan kepada model pada setiap panggilan API. "Panggilan API" bukan bermaksud "satu mesej yang anda taip." Satu prompt mencetuskan panggilan alat dalaman — Grep, Read, Edit, Write — dan setiap satu adalah panggilan API berasingan. Satu prompt boleh menyebabkan 10+ panggilan API dengan mudah.

Cache prompt mengurangkan kos ini sebanyak 90%. Tetapi cache mempunyai jangka hayat.

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| Cache TTL           | 1 jam (ephemeral_1h)                  | 5 min                                  |
| Cache write         | ＄10/MTok                              | ＄6.25/MTok                             |
| Cache read          | ＄0.50/MTok                            | ＄0.50/MTok                             |
| Bila cache tamat    | Context penuh dihantar semula pada harga penuh | Kesan rendah (context kecil)     |

Walaupun cache masih aktif, kos tetap bertambah. Berikut senario ekstrem untuk menunjukkan perbezaannya.

### Senario: Pengekodan sehari penuh (3j pagi → 2j makan/mesyuarat → 3j petang)

Syarat: Harga Opus 4, 1 prompt seminit, ~5 panggilan API setiap prompt (~300 panggilan/jam).

#### ❌ Tanpa cc-token-saver

Kebanyakan kerja berlaku dalam Main session. Context membesar dengan cepat.

| Fasa        | Situasi                           | Saiz context               | Kos                                    |
| ----------- | --------------------------------- | -------------------------- | -------------------------------------- |
| Pagi 3j     | Mengekod (kebanyakan dalam Main)  | 100K → 600K (purata 350K) | 900 panggilan × 350K × ＄0.50/M = ＄157.50 |
| Makan/msyrt | Keluar selama 2 jam               | —                          | —                                      |
| Kembali     | Cache tamat → hantar semula penuh | 600K harga penuh           | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| Kembali     | /compact (ringkaskan)             | 600K → dihantar ke LLM    | 600K × ＄0.50/M + output ringkasan = ~＄1.50 |
| Petang 3j   | Terus mengekod (context membesar semula) | 100K → 600K (purata 350K) | 900 panggilan × 350K × ＄0.50/M = ＄157.50 |
|             | Jumlah                            |                            | ~＄326                                  |

> Pada tahap penggunaan ini, anda kemungkinan besar akan kena rate limit tetingkap 5 jam. **Kos memang teruk, tapi masalah sebenar ialah kerja anda terhenti sepenuhnya. Inilah saat Claude Code padam terus.**

#### ✅ Dengan cc-token-saver

Kerja berat didelegasikan ke SubTask. Main hanya mengendalikan reka bentuk/keputusan.

| Fasa        | Situasi                                      | Saiz context                | Kos                                |
| ----------- | --------------------------------------------- | --------------------------- | ---------------------------------- |
| Pagi 3j     | Mengekod (Main: reka bentuk, SubTask: pelaksanaan) | Main 100K → 300K (purata 200K) | 900 panggilan × 200K × ＄0.50/M = ＄90 |
| Makan/msyrt | Keluar selama 2 jam                           | —                           | —                                  |
| Kembali     | ⚡ Token Guardian menyekat → /clear + /continue | —                          | ＄0 (tiada panggilan LLM)          |
| Petang 3j   | Terus mengekod                                | Main 100K → 300K (purata 200K) | 900 panggilan × 200K × ＄0.50/M = ＄90 |
|             | Jumlah                                        |                             | ~＄180                              |

#### 💰 Hasil

> **＄326 → ＄180. ＄146 dijimatkan sehari (45%).**
>
> Bukan soal kos sahaja. Kurang token dalam masa yang sama bermaksud **anda tidak kena rate limit dan boleh terus bekerja.** Itulah perbezaan sebenar.

### Di mana cc-token-saver bertindak

```
[Permulaan Session]
    │
    ├─ Session Architect → Menyuntik corak delegasi SubTask secara automatik
    │                       Mengekalkan context Main di bawah 250K
    │
[Sedang Bekerja]
    │
    ├─ Status Line → Pemantauan kos/context/rate limit masa nyata
    │                  Amaran segera apabila memasuki zon bahaya
    │
[1+ jam idle]
    │
    ├─ Token Guardian → Mengesan cache expiry, menyekat sebelum penghantaran semula
    │
[Session dimulakan semula]
    │
    └─ /continue → Memulihkan context sebelumnya pada kos sifar (tiada panggilan LLM)
```

---

## 🔧 Pemasangan Sumber & Penyesuaian

```bash
git clone https://github.com/ww-w-ai/cc-token-saver.git
claude plugin marketplace add /path/to/cc-token-saver
claude plugin install cc-token-saver@cc-token-saver
```

cc-token-saver sepenuhnya terbuka. Keseluruhan sumber ialah JavaScript biasa + skrip Bash mengikut struktur plugin standard. Ubah suai apa sahaja yang anda mahu.

- **hooks/** — Tukar ambang cache expiry, sesuaikan mesej amaran, ubah peraturan session architecture
- **scripts/** — Logik analisis, pembina laporan, format status line
- **skills/** — Cara /continue dan /usage-view berfungsi, templat prompt
- **locales/** — Tambah/sunting terjemahan, tambah bahasa baharu
- **skills/usage-view/** — Perubahan reka bentuk UI/UX dashboard

Jadikan milik anda. Fork, eksperimen, dan hantar PR jika anda jumpa sesuatu yang lebih baik.

---

## 🌐 Bahasa Disokong

23 bahasa disokong. Dipilih dengan merujuk silang 20 negara teratas mengikut penggunaan Claude Code dengan 20 bahasa teratas mengikut bilangan penutur global. Bahasa paparan dikesan secara automatik daripada locale OS anda. Anda juga boleh tetapkan secara manual: `/usage-view locale ja`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 English    | 🇰🇷 Korean     | 🇯🇵 Japanese  | 🇨🇳 Chinese    |
| 🇪🇸 Spanish    | 🇫🇷 French     | 🇩🇪 German    | 🇧🇷 Portuguese |
| 🇮🇹 Italian    | 🇷🇺 Russian    | 🇸🇦 Arabic    | 🇮🇳 Hindi      |
| 🇧🇩 Bengali    | 🇮🇩 Indonesian | 🇲🇾 Malay     | 🇹🇭 Thai       |
| 🇻🇳 Vietnamese | 🇹🇷 Turkish    | 🇵🇱 Polish    | 🇳🇱 Dutch      |
| 🇮🇱 Hebrew     | 🇸🇪 Swedish    | 🇳🇴 Norwegian |                 |

Terjemahan semasa dijana oleh AI. Sumbangan penutur asli dialu-alukan — sunting fail JSON untuk bahasa anda dalam `locales/` dan hantar PR.

---

## 💡 Tips

### Fahami cache dan anda akan nampak ke mana wang pergi

- **1 prompt ≠ 1 panggilan API.** Setiap kali Claude memanggil Grep, Read, atau Edit, keseluruhan context dihantar semula. Satu prompt boleh mencetuskan 10+ panggilan API dengan mudah. Tulis prompt yang jelas untuk mengurangkan panggilan alat yang tidak perlu dan menjimatkan kos.
- **Pemasa cache ditetapkan semula dari panggilan API terakhir, bukan prompt terakhir anda.** Terus bekerja dan cache tidak akan tamat. Bahayanya ialah meninggalkan tempat kerja. Token Guardian menyekat secara automatik sekali, jadi apabila anda kembali anda boleh pilih: tetapkan semula context atau teruskan seperti sedia ada.
- **Saiz context = pengganda kos.** Panggilan API yang sama pada 200K vs 800K berkos 4x ganda lebih mahal. Apabila status line [CTX] melepasi 35% (🟡), itulah isyarat untuk mendelegasikan lebih banyak ke SubTask.

### Tabiat yang mengurangkan kos

- **Pastikan CLAUDE.md ringkas.** Ia dimuatkan ke dalam system prompt pada setiap panggilan API. Setiap baris ada kosnya.
- **Delegasikan kerja berat ke SubTask.** Penjanaan kod, suntingan pelbagai fail, pelaksanaan ujian bukan untuk Main. SubTask mempunyai context lebih kecil dan cache tier yang lebih murah.
- **Keluar 1+ jam?** `/clear` → balik → `/continue`. Context dipulihkan pada $0.
- **[5H] melebihi 70% (🟡)?** Perlahan. Tukar ke tugas semakan ringan atau tingkatkan delegasi SubTask untuk mengurangkan bilangan panggilan API Main.
- **Gunakan `/btw` untuk soalan sampingan.** Ia tidak masuk sejarah perbualan, jadi context anda kekal kurus.

---

## License

Apache-2.0
