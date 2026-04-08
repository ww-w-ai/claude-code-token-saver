# cc-token-saver

> **Claude Code sürekli mi kesiyor? Artık değil.**
>
> Daha az harca, daha uzun kodla ve token'larının nereye gittiğini tam olarak gör — yapılandırma gerektirmez.

Nasıl mı? Otomatik context yönetimi, gerçek zamanlı maliyet takibi ve cache-bilinçli session kontrolü — hepsi tek bir eklentide.

---

## 😤 Sorun: Aylık $200 ve hâlâ iş yapamıyorsunuz

Claude Code Max Plan (aylık $200). Yetmesi lazım. Ama yetmiyor.

**5 saatlik kayan pencere rate limit.** Kodlamanın tam ortasındasınız ve bir anda duruyor. Zamanlayıcı yok. Tahmini süre yok. Sadece bekleyin.

**Cache süresi dolması.** Öğle yemeğinden döndünüz. Bir saatten fazla geçmiş. Tek bir prompt gönderdiniz, 900K token tam fiyattan yeniden gönderildi. Maliyet? Tek seferde $9.

**Görünmeyen maliyetler.** Gerçek zamanlı ne kadar harcadığınızı görmenin yolu yok. Ancak rate limit'e çarptığınızda fark ediyorsunuz.

**Tamamen manuel.** Context boyutu, cache süresi takibi, SubTask delegasyonu, session temizliği. Kod yazarken bunların hepsini takip etmek imkansız.

cc-token-saver hepsini otomatik halleder. **Bir kez kur. Bitti.**

---

## 🚀 Kurulum

```
claude plugin marketplace add ww-w-ai/cc-token-saver
claude plugin install cc-token-saver
```

Kurulumdan sonra otomatik çalışır. Yapılandırma gerektirmez. [Claude Code](https://claude.ai/claude-code) v2.1.71+ gerektirir.

Canlı izleme için:

```
/setup-statusline install
```

---

## 🛡️ Özellik 1: Token Guardian

**Cache süresinin dolduğunu algılar ve pahalı yeniden gönderimleri otomatik olarak engeller.**

Claude Code'un prompt cache TTL'si 1 saattir. Bir saatten fazla uzaklaşırsanız cache süresi dolar. Bir sonraki mesajınız tüm context'i tam fiyattan yeniden gönderir. 900K token'da bu tek seferde $9 eder.

Token Guardian, son yanıtın ne zaman alındığını takip eder. 3.590 saniyeden fazla geçtiyse (TTL eksi 10 saniyelik tampon), prompt'u engeller ve bir uyarı gösterir.

```
🚨 Önbellek süresi doldu (68dk 23sn boşta)

Önbellek süresi doldu. Devam etmek tüm bağlamı yeniden gönderecektir.
Maliyet önemli ölçüde artabilir.

👉 /context — Karar vermeden önce mevcut bağlam kullanımını kontrol edin
👉 /clear → /continue — Sıfırla, ardından önceki bağlamı geri yükle (önerilen, en düşük maliyet)
👉 Tekrar gönder — Olduğu gibi devam et (tam re-cache maliyeti oluşur)
```

Uyarıdan sonra aynı prompt'u tekrar gönderin — geçer. Uyarı her boşta kalma süresi başına yalnızca bir kez tetiklenir, bu yüzden asla rahatsız etmez. Uyarı mesajları işletim sistemi yerel ayarınıza göre 23 dilde gösterilir.

**Sonuç:** Pahalı yeniden cache maliyetleri otomatik olarak önlenir. Hiçbir çaba gerekmez.

---

## 🧠 Özellik 2: Akıllı Session Mimarisi

**Kurun, maliyet açısından optimize çalışma düzenleri otomatik devreye girsin.**

Çoğu kullanıcı her şeyi Main session'da yapar. Dosya okuma, kod üretme, test çalıştırma. Her çıktı context'e eklenir ve her mesajla birlikte yeniden gönderilir. Session şişer. Maliyetler katlanarak artar.

Session Architect, session başlangıcında otomatik olarak bir delegasyon stratejisi enjekte eder.

|                  | Main Session                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Rol              | Tasarım, kararlar, inceleme       | Uygulama, kod üretme, çoklu dosya    |
| Cache katmanı    | 1 saat (ephemeral_1h)             | 5 dk                                  |
| Cache yazma maliyeti | ＄10/MTok                       | ＄6.25/MTok                            |
| Context boyutu   | ~94K ort                          | ~33K ort                              |

SubTask'lar Main'e göre **%37,5 daha ucuz cache yazma** maliyetine sahiptir. Context de çok daha küçüktür. Ağır işleri SubTask'lara devretmek maliyetleri önemli ölçüde düşürür.

**Sonuç:** Claude otomatik olarak maliyet verimli bir düzende çalışır. Bunu düşünmenize gerek yok.

---

## 🔄 Özellik 3: /continue — Context Geri Yükleme

**`/compact`'ın yerini alır. Sıfır LLM çağrısı. Sıfır token maliyeti.**

`/compact` tüm context'inizi (~1M token) sıkıştırmak için LLM'e gönderir ve %3,3'lük bir özet oluşturur. Cache süresi dolmuşsa, bu tek başına tam bir yeniden cache'leme tetikler. Bilgi kaybı kaçınılmazdır.

`/continue` tamamen farklı bir yaklaşım benimser. Önceki session transkriptini ön işlemden geçirir ve doğrudan yükler. LLM çağrısı yok. Maliyet yok. Orijinal konuşma olduğu gibi geri yüklenir.

|                         | /compact                          | /continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| Nasıl çalışır           | Tam context'i özet için LLM'e gönderir | Transkripti ön işler, doğrudan okur |
| LLM çağrıları           | Gerekli (genellikle 100K+ token)  | 0                                |
| Token maliyeti          | Yüksek                           | 0                                |
| Bilgi kaybı             | Evet (%3,3 özet)                  | Yok (orijinal korunur)           |
| İşlem hızı              | Onlarca saniye                    | < 1 sn (60MB+ dosyalarda bile)   |
| Cache süresi dolduğunda | Ek tam yeniden cache maliyeti     | Etkisi yok                       |
| Çoklu session geri yükleme | Mümkün değil                   | Desteklenir                      |

Kullanım: `/clear` ardından `/continue`. Önceki session'ların listesini görürsünüz. Geri yüklemek istediğinizi seçin. Hızlı kurtarma için: `/continue last`.

**Sonuç:** Önceki çalışmaya sıfır maliyetle devam edin. Bilgi kaybı yok.

---

## 📊 Özellik 4: Canlı Durum Çubuğu

**Gerçek zamanlı token/maliyet izleme. 50ms'nin altında yük.**

`/setup-statusline install` komutunu bir kez çalıştırın; Claude Code'un altında kalıcı bir durum çubuğu belirir.

```
[RUN🟢] $0.10/$12.23 | [5H🟢] 9% ⏳1h32m | [CTX🟢] 22%
```

| Gösterge         | Ne gösterir                         | 🟢 Normal | 🟡 Uyarı  | 🔴 Kritik   |
| ---------------- | ----------------------------------- | --------- | ---------- | ----------- |
| RUN (delta)      | Son API çağrısının maliyeti         | < ＄0.50   | >= ＄0.50   | >= ＄1.00    |
| RUN (kümülatif)  | Bu klasörün toplam maliyeti         | —         | —          | —           |
| 5H               | 5 saatlik pencere kullanımı + sıfırlanma geri sayımı | < %70  | >= %70     | >= %90      |
| CTX              | Context penceresi kullanımı         | < %35     | >= %35     | >= %70      |

Herhangi bir gösterge uyarı veya kritik seviyeye ulaştığında, otomatik olarak `→ /usage-view current` ipucu görünür.

Kaldırmak için: `/setup-statusline uninstall` (önceki yapılandırma otomatik geri yüklenir).

**Sonuç:** Maliyet durumunuzu bir bakışta görün. Çok geç olmadan harekete geçin.

---

## 📈 Kullanım Paneli (/usage-view)

**Sonunda bir cevap: "Neden rate limit'e takıldım?"**

Şimdiye kadar rate limit'e çarpmak sadece sinir bozucuydu. Sebebini bilmenin yolu yoktu. Hangi session en çok token yaktı? Maliyetler ne zaman tırmandı? Kullanım düzeninizde ne gibi kalıplar var? Hepsi görünmezdi.

`/usage-view` her şeyi gösterir. Tarayıcınızda interaktif bir HTML paneli açılır; kullanım kalıplarını analiz edip maliyet artışlarının kök nedenini izlemenizi sağlar. Harici bağımlılık yok. Bağımsız çalışır. Dosya olarak paylaşılabilir.

Neler dahil:

- Günlük / saatlik / haftanın günü maliyet trendleri — en çok token yaktığınız zamanları tespit edin
- Token dağılımı (input, output, cache write, cache read) — maliyetleri neyin artırdığını görün
- Session bazlı maliyet analizi — hangi görevlerin pahalıya mal olduğunu belirleyin
- 5 saatlik pencere zaman çizelgesi (Max Plan aboneleri) — rate limit tetikleyicilerini izleyin
- Yapay zeka destekli analiz — verileri yorumlar ve iyileştirme önerileri sunar
- 23 dil desteklenir (RTL dahil; grafikler/tablolar LTR kalır)

```
/usage-view                  # Tüm zamanlar, tüm projeler
/usage-view current          # Yalnızca mevcut 5 saatlik pencere
/usage-view last 7 days      # Son 7 gün
/usage-view locale tr        # Türkçe
```

---

## 🔬 Rate Limit Araştırması (/report-limit)

**Rate limit formülünü tersine mühendislikle çözmek için topluluk odaklı proje.**

Anthropic, 5 saatlik pencerenin tam formülünü yayınlamıyor. Bunu birlikte çözelim.

Rate limit'e çarptığınızda `/report-limit` çalıştırın. Mevcut kullanım verileriniz otomatik olarak GitHub Discussion olarak gönderilir. Ne kadar çok veri toplarsak, formül o kadar netleşir.

---

## 💡 Cache Gerçekte Nasıl Çalışır

Claude Code, her API çağrısında tüm konuşma geçmişini modele gönderir. "API çağrısı" demek "yazdığınız tek mesaj" demek değil. Tek bir prompt dahili araç çağrılarını tetikler — Grep, Read, Edit, Write — ve her biri ayrı bir API çağrısıdır. Tek bir prompt kolayca 10'dan fazla API çağrısına neden olabilir.

Prompt cache bu maliyeti %90 azaltır. Ancak cache'in bir ömrü vardır.

|                     | Main Session                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| Cache TTL           | 1 saat (ephemeral_1h)                 | 5 dk                                   |
| Cache yazma         | ＄10/MTok                              | ＄6.25/MTok                             |
| Cache okuma         | ＄0.50/MTok                            | ＄0.50/MTok                             |
| Cache süresi dolduğunda | Tam context tam fiyattan yeniden gönderilir | Düşük etki (context küçüktür)     |

Cache aktif olsa bile maliyetler birikir. Farkı göstermek için aşırı bir senaryo:

### Senaryo: Tam gün kodlama (sabah 3 saat → 2 saat öğle/toplantı → öğleden sonra 3 saat)

Koşullar: Opus 4 fiyatlandırması, dakikada 1 prompt, prompt başına ~5 API çağrısı (~300 çağrı/saat).

#### ❌ cc-token-saver olmadan

İşlerin çoğu Main session'da yapılır. Context hızla büyür.

| Aşama           | Durum                             | Context boyutu              | Maliyet                                |
| --------------- | --------------------------------- | --------------------------- | -------------------------------------- |
| Sabah 3 saat    | Kodlama (çoğunlukla Main'de)     | 100K → 600K (ort 350K)     | 900 çağrı × 350K × ＄0.50/M = ＄157.50  |
| Öğle/toplantı   | 2 saat uzakta                     | —                           | —                                      |
| Dönüş           | Cache süresi doldu → tam yeniden gönderim | 600K tam fiyat         | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| Dönüş           | /compact (özetleme)               | 600K → LLM'e gönderildi    | 600K × ＄0.50/M + özet çıktısı = ~＄1.50  |
| Öğleden sonra 3 saat | Kodlama devam (context tekrar büyür) | 100K → 600K (ort 350K) | 900 çağrı × 350K × ＄0.50/M = ＄157.50  |
|                 | Toplam                            |                             | ~＄326                                  |

> Bu kullanım seviyesinde büyük olasılıkla 5 saatlik pencere rate limit'ine çarparsınız. **Maliyet kötü, ama asıl sorun işinizin tamamen durması. Claude Code'un tamamen kapandığı an tam olarak burasıdır.**

#### ✅ cc-token-saver ile

Ağır işler SubTask'lara devredilir. Main yalnızca tasarım/kararlarla ilgilenir.

| Aşama           | Durum                                        | Context boyutu               | Maliyet                            |
| --------------- | -------------------------------------------- | ---------------------------- | ---------------------------------- |
| Sabah 3 saat    | Kodlama (Main: tasarım, SubTask: uygulama)   | Main 100K → 300K (ort 200K)  | 900 çağrı × 200K × ＄0.50/M = ＄90 |
| Öğle/toplantı   | 2 saat uzakta                                | —                            | —                                  |
| Dönüş           | ⚡ Token Guardian engeller → /clear + /continue | —                          | ＄0 (LLM çağrısı yok)              |
| Öğleden sonra 3 saat | Kodlama devam                            | Main 100K → 300K (ort 200K)  | 900 çağrı × 200K × ＄0.50/M = ＄90 |
|                 | Toplam                                       |                              | ~＄180                              |

#### 💰 Sonuç

> **＄326 → ＄180. Günlük ＄146 tasarruf (%45).**
>
> Mesele sadece maliyet değil. Aynı sürede daha az token demek **rate limit'e çarpmadan çalışmaya devam edebilmeniz** demektir. Asıl fark budur.

### cc-token-saver nerede devreye girer

```
[Session Başlangıcı]
    │
    ├─ Session Architect → SubTask delegasyon kalıbını otomatik enjekte eder
    │                       Main context'i 250K altında tutar
    │
[Çalışma]
    │
    ├─ Durum Çubuğu → Gerçek zamanlı maliyet/context/rate limit izleme
    │                   Uyarı bölgesine girildiğinde anında bildirim
    │
[1+ saat boşta]
    │
    ├─ Token Guardian → Cache süresinin dolduğunu algılar, yeniden gönderim öncesi engeller
    │
[Session yeniden başlatma]
    │
    └─ /continue → Önceki context'i sıfır maliyetle geri yükler (LLM çağrısı yok)
```

---

## 🔧 Kaynak Koddan Kurulum ve Özelleştirme

```bash
git clone https://github.com/ww-w-ai/cc-token-saver.git
claude plugin marketplace add /path/to/cc-token-saver
claude plugin install cc-token-saver@cc-token-saver
```

cc-token-saver tamamen açık kaynaklıdır. Tüm kaynak kod, standart eklenti yapısını izleyen düz JavaScript + Bash scriptlerinden oluşur. İstediğiniz her şeyi değiştirin.

- **hooks/** — Cache süresi eşiğini değiştirin, uyarı mesajlarını özelleştirin, session mimarisi kurallarını düzenleyin
- **scripts/** — Analiz mantığı, rapor oluşturucu, durum çubuğu biçimlendirmesi
- **skills/** — /continue ve /usage-view nasıl çalışır, prompt şablonları
- **locales/** — Çevirileri ekleyin/düzenleyin, yeni diller ekleyin
- **skills/usage-view/** — Panel UI/UX tasarım değişiklikleri

Kendinize göre uyarlayın. Fork'layın, deneyin ve daha iyi bir şey bulursanız PR gönderin.

---

## 🌐 Desteklenen Diller

23 dil desteklenmektedir. Claude Code kullanımına göre ilk 20 ülke ile küresel konuşmacı sayısına göre ilk 20 dil karşılaştırılarak seçilmiştir. Görüntüleme dili işletim sistemi yerel ayarınızdan otomatik algılanır. Manuel olarak da belirtebilirsiniz: `/usage-view locale tr`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 İngilizce  | 🇰🇷 Korece     | 🇯🇵 Japonca   | 🇨🇳 Çince      |
| 🇪🇸 İspanyolca | 🇫🇷 Fransızca  | 🇩🇪 Almanca   | 🇧🇷 Portekizce |
| 🇮🇹 İtalyanca  | 🇷🇺 Rusça      | 🇸🇦 Arapça    | 🇮🇳 Hintçe     |
| 🇧🇩 Bengalce   | 🇮🇩 Endonezce  | 🇲🇾 Malayca   | 🇹🇭 Tayca      |
| 🇻🇳 Vietnamca  | 🇹🇷 Türkçe     | 🇵🇱 Lehçe     | 🇳🇱 Felemenkçe |
| 🇮🇱 İbranice   | 🇸🇪 İsveççe    | 🇳🇴 Norveççe  |                 |

Mevcut çeviriler yapay zeka tarafından oluşturulmuştur. Anadili konuşanların katkıları memnuniyetle karşılanır — `locales/` klasöründeki kendi dilinizin JSON dosyasını düzenleyip PR gönderin.

---

## 💡 İpuçları

### Cache'i anlayın, paranın nereye gittiğini görün

- **1 prompt ≠ 1 API çağrısı.** Claude her Grep, Read veya Edit çağrısında tüm context'i yeniden gönderir. Tek bir prompt kolayca 10'dan fazla API çağrısı tetikler. Gereksiz araç çağrılarını azaltmak ve maliyetleri düşürmek için net prompt'lar yazın.
- **Cache zamanlayıcısı son prompt'unuzdan değil, son API çağrısından itibaren sıfırlanır.** Çalışmaya devam ettikçe cache süresi asla dolmaz. Tehlike uzaklaşmaktır. Token Guardian bir kez otomatik engeller, döndüğünüzde seçersiniz: context'i sıfırla veya olduğu gibi devam et.
- **Context boyutu = maliyet çarpanı.** Aynı API çağrısı 200K'da 800K'ya kıyasla 4 kat daha ucuzdur. Durum çubuğunda [CTX] %35'i (🟡) geçtiğinde, SubTask'lara daha fazla iş devretme sinyalidir.

### Maliyeti düşüren alışkanlıklar

- **CLAUDE.md'yi yalın tutun.** Her API çağrısında system prompt'a yüklenir. Her satır para eder.
- **Ağır işleri SubTask'lara devredin.** Kod üretme, çoklu dosya düzenleme, test çalıştırma Main'de olmamalı. SubTask'lar daha küçük context'e ve daha ucuz cache katmanına sahiptir.
- **1+ saat uzakta mı?** `/clear` → dönün → `/continue`. Context $0'a geri yüklenir.
- **[5H] %70'in üzerinde mi (🟡)?** Yavaşlayın. Hafif inceleme görevlerine geçin veya Main'in API çağrı sayısını azaltmak için SubTask delegasyonunu artırın.
- **Ara sorular için `/btw` kullanın.** Konuşma geçmişine girmez, böylece context'iniz yalın kalır.

---

## Lisans

Apache-2.0
