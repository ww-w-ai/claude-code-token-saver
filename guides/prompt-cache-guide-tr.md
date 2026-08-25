# Cache Maliyet Rehberi — Maliyetlerinizin Çoğu Neden Cache'den Geliyor

AI coding aracınızın maliyetlerinin büyük bölümünün cache işlemlerinden (write + read) gelmesi normaldir. Bu belge nedenini ve nasıl yönetileceğini açıklar.

## Sır: Her Mesaj Tüm Konuşmayı Yeniden Gönderir

LLM'ler **stateless**'tir. İnsanlardan farklı olarak, AI modelleri önceki konuşmayı "hatırlamaz" — her istekte tüm konuşma geçmişini input olarak alırlar.

Sohbet gibi görünür, ancak gerçek API çağrıları şöyle çalışır:

```
[ İstek 1 ]
→ System prompt + "Bu hatayı düzelt"
← AI yanıtı

[ İstek 2 ]
→ System prompt + "Bu hatayı düzelt" + AI yanıtı + "Test de ekle"
← AI yanıtı

[ İstek 3 ]
→ System prompt + "Bu hatayı düzelt" + AI yanıtı + "Test de ekle" + AI yanıtı + "Commit et"
← AI yanıtı
```

Her istek önceki **tüm** içeriği kapsar. Örneğin 50. istek, önceki 49 isteğin tüm konuşmasını ve AI yanıtlarını içerir. Input tokenlarının konuşma uzadıkça hızla artmasının nedeni budur.

Bunun yanı sıra AI coding araçları, her istekte system prompt'u (yerleşik talimatlar, yapılandırma dosyaları, plugin'ler, MCP tool tanımları vb.) gönderir — dolayısıyla tek satırlık bir mesaj bile on binlerce input tokena neden olur.

## Cache Nedir?

**Prompt caching**, bu tekrarlanan gönderimin maliyetini düşürür. Input'un değişmeyen bölümlerini sunucuda saklayarak sonraki isteklerin bunları indirimli fiyatla yeniden kullanmasını sağlar.

- **Cache Write**: Konuşma içeriğini sunucuda depolamanın maliyeti. İlk istekte veya cache süresi dolduğunda gerçekleşir.
- **Cache Read**: Zaten depolanmış içeriği yeniden kullanmanın maliyeti. Standart input'a göre **%90 indirimli** olarak faturalanır.

AI coding araçları doğası gereği uzun konuşmalar ve büyük bağlamlar üretir — istek başına 1 milyon tokena kadar. Yeni sorunuz kısa olsa bile, önceki tüm konuşma birlikte faturalanır, bu nedenle konuşma uzadıkça maliyetler hızla birikir.

Bu yükü hafifletmek için büyük AI sağlayıcıları cache read'e %90 indirim uygular ve önceden işlenmiş içeriğin yeniden gönderim maliyetini önemli ölçüde düşürür.

## Cache Neden Toplam Maliyete Hakim?

| Kategori | Çağrı Başına Token | Not |
|---|---|---|
| Kullanıcı girdisi (yeni tokenlar) | Onlar ila yüzler | Kullanıcının gerçekten yazdığı |
| AI çıktısı | Yüzler ila binler | AI'ın yanıtı |
| **Cache read** | **100K–yüzlerce K** | Biriken tüm konuşma her çağrıda faturalanır |

Çağrı başına cache read hacmi, input'tan **binlerce kat büyüktür**. %90 indirimle bile cache read, mutlak dolar cinsinden hâlâ baskındır.

Ve bu çağrılar sadece kullanıcı mesajlarından gelmez:

| Çağıran | Sıklık | Çağrı Başına Cache Read |
|---|---|---|
| Kullanıcı mesajları | Kullanıcı mesaj gönderdiğinde | Biriken tüm konuşma |
| **AI'ın kendi kararları** | **Kullanıcı mesajı başına birden fazla çağrı** | Biriken tüm konuşma |

Görünmez biçimde AI, tek bir kullanıcı mesajı için art arda birden fazla karar verir — hangi tool'un kullanılacağına karar verir, tool sonucunu yorumlar, bir sonraki eyleme karar verir. Bu kararların her biri, tüm bağlamı içeren tam bir LLM çağrısıdır. Tool'un çalıştırılması (dosya okuma, arama) yerel olarak yapılır, ancak her tool kullanımından önceki ve sonraki karar verme süreci cache read maliyeti oluşturur.

### Cache Write Maliyeti Neden Beklenenden Büyük?

Anthropic'te cache write maliyeti input'un 1,25 katı (5 dakikalık tier) veya 2 katıdır (1 saatlik tier). Bu çarpanlarla cache write, input+output maliyetinin 2 katını geçmemeli gibi görünür — ancak pratikte cache write çok daha büyük bir pay alır.

İki neden:

| Sebep | Açıklama |
|---|---|
| **System prompt** | Kullanıcı herhangi bir şey yazmadan önce on binlerce token (plugin/MCP ile). Tamamı cache write maliyetine tabidir |
| **Süre dolumu sonrası yeniden oluşturma** | TTL (5 dakika / 1 saat) sona erdikten sonra, biriken tüm konuşmanın yeniden cache'lenmesi gerekir. Konuşma ne kadar uzunsa, yeniden oluşturma maliyeti o kadar yüksektir |

Başka bir deyişle, cache write yalnızca "kullanıcının yazdığı yeni tokenlar" için gerçekleşmez. Oturum başlangıcında tüm system prompt cache'lenir; süre dolduktan sonra biriken tüm konuşma cache write hedefi olur. 100K tokenlik bir konuşmanın cache'i sona ererse, tek bir mesaj aynı anda 100K tokenlik cache write tetikler.

**super-token-saver plugin'inin 1 saat hareketsizlikten sonra cache süre dolumu uyarısı göstermesinin nedeni tam olarak budur.** Uyarı göründüğünde mevcut bağlam boyutunuzu kontrol edin:

- **Küçük bağlam**: Cache yeniden oluşturma maliyeti yönetilebilir. Çalışmaya devam edin — maliyet düşüktür.
- **Büyük bağlam**: Cache maliyeti önemli olacaktır. Yeni bir oturumda devam etmek için `/clear` ardından `/s-continue last` kullanmanızı öneririz. continue skill'i önceki konuşma bağlamınızı otomatik olarak geri yükler, böylece iş akışınız kesintiye uğramaz.

## Cache Maliyetlerini Düşürme Stratejileri

super-token-saver plugin'i bu stratejilerin tümünü otomatikleştirmek veya basitleştirmek için tasarlanmıştır.

### 1. Bağlamı Küçük Tutun — `/clear` + `/s-continue` ⭐

**Maliyetleri düşürmenin en önemli yolu budur.** Yüksek cache maliyetleri %90 indirim aldığınız anlamına gelir — bu normaldir. Ancak bağlam gereksiz yere büyür ve öyle kalırsa, indirime rağmen çağrı başına mutlak maliyet artar. **Bağlam boyutunu kontrol altında tutmak, en etkili maliyet yönetimi stratejisidir.**

Konu değiştiğinde veya konuşma uzadığında, sıfırlamak için `/clear` çalıştırın, ardından önceki bağlamı geri yüklemek için `/s-continue last` kullanın. `/s-continue` önceki konuşmaları herhangi bir LLM çağrısı olmadan geri yükler, dolayısıyla maliyeti sıfırdır.

`/compact` konuşmayı özetleyerek bağlamı küçültür, ancak özetleme sürecinin kendisi LLM çağrı maliyeti oluşturur ve konuşma detayını kaybettirir. Önerilmez.

### 2. Cache Süre Dolumunu Önleyin — Token Guardian (Otomatik)

Anthropic'in ana oturum cache'i **1 saatlik tier** kullanır. Süre dolduktan sonra ilk istek, tüm konuşmayı cache write olarak yeniden oluşturmak zorundadır — bu pahalıdır.

super-token-saver, 1 saatlik boşta kalma durumlarını algılar ve **otomatik olarak uyarı gösterir**. Uyarı göründüğünde, yukarıdaki 1. yöntemi (`/clear` + `/s-continue`) kullanarak yeni bir oturumda devam etmek en ekonomik yaklaşımdır.

### 3. Ağır İşleri SubTask'lara Devredin

Kod oluşturma veya çoklu dosya düzenleme gibi ağır görevler, ana oturumda doğrudan çalıştırılmak yerine SubTask'lara devredilebilir. SubTask'lar 5 dakikalık cache tier'ını kullanır, bu da **cache write'ı %37,5 daha ucuz** yapar ve daha küçük, izole bir bağlamda çalışarak çağrı başına cache read hacmini azaltır.

super-token-saver, oturum başlangıcında bu iş ayırma kalıbını otomatik olarak yönlendirir.

### 4. Gerçek Zamanlı Maliyet İzleme — `/setup-statusline`

CLI'nizin alt kısmında gerçek zamanlı maliyet/token durumunu görüntülemek için `/setup-statusline` kurun: `[RUN] \$0.10/\$12.23 | [5H] 9% | [CTX] 22%`. Anormal derecede yüksek çağrı başına maliyetleri veya büyüyen bağlamı anında fark ederek maliyetler artmadan önce önlem alabilirsiniz.

### 5. Maliyet Kalıbı Analizi — `/usage-view`

Tüm kullanım geçmişinizi bir dashboard olarak incelemek için `/usage-view` kullanın. Günlük/saatlik maliyet trendlerini, oturum başına token bileşimini ve cache verimliliğini görselleştirin. Hangi görevlerin maliyet artışına neden olduğunu ve hangi kalıpların verimsiz olduğunu bir bakışta görün.

### 6. System Prompt Optimizasyonu

System prompt'a ne kadar çok plugin, MCP sunucusu ve skill yüklenirse, başlangıç cache write maliyeti o kadar yüksek olur. Kullanmadıklarınızı kaldırın.

super-token-saver'ın `/setup-git-lite` komutu, Claude Code'un varsayılan Git talimatlarını (~2.200 token) 280 tokenlık çekirdeğe düşürür — oturum başına Git ile ilgili system prompt'ta yaklaşık %88 azalma sağlar.

### 7. Tool Seçimi — Bağlam Etkisi Tool'a Göre Değişir

Bir dosya okunduktan sonra içeriği bağlamda kalır ve sonraki tüm çağrılarda cache read'e eklenir. Tek bir dosyayı tamamen okumak bağlama binlerce ila on binlerce token ekler ve bu miktar sonraki her çağrıda faturalanır.

Coding görevleri genellikle aynı anda birden fazla dosyayla ilgilidir — sadece 3-4 dosyayı tamamen okumak bile bağlamın dramatik biçimde büyümesine neden olabilir. Doğru tool'u seçmek, bağlam büyümesinde önemli bir fark yaratır.

| Tool | Amaç | Bağlam Etkisi | Ne Zaman Kullanılır |
|---|---|---|---|
| **Grep** | Kalıba göre kod arama | **Minimal** — yalnızca eşleşen satırları döner | Belirli fonksiyon adları, değişkenler, stringler arama |
| **Glob** | Ad kalıbına göre dosya arama | **Minimal** — yalnızca dosya yollarını döner | `*.ts`, `src/**/*.test.js` gibi dosya konumları bulma |
| **LSP** | Sembol tanımları, referanslar, türler | **Minimal** — yalnızca tanım/imza döner | Go to definition, find references, tür kontrolü |
| **Read** (offset/limit) | Dosyanın belirli bölümünü okuma | **Orta** — yalnızca belirtilen aralığı döner | Belirli bir satır aralığına ihtiyaç duyduğunuzda |
| **Read** (tam) | Dosyanın tamamını okuma | **Büyük** — dosyanın tamamı bağlama eklenir | Yalnızca dosya yapısının tamamını anlamanız gerektiğinde |

"Bu dosyanın tamamını oku" ifadesi, "Bu fonksiyonu bul" ifadesinden onlarca ila yüzlerce kat daha fazla bağlam kullanır.

Aynı ilke düzenleme ve karşılaştırma için de geçerlidir:

| Tool | Amaç | Bağlam Etkisi |
|---|---|---|
| **Edit** | Mevcut dosyayı değiştirme | **Minimal** — yalnızca diff bağlama eklenir |
| **Write** | Yeni dosya oluşturma / tam yeniden yazma | **Büyük** — dosyanın tamamı bağlama eklenir |
| **git diff / diff** | Dosya/klasör karşılaştırma | **Minimal** — yalnızca farklar döner |
| Her iki dosyayı ayrı ayrı okuma | Dosya/klasör karşılaştırma | **Büyük** — her iki dosyanın tamamı bağlama eklenir |

super-token-saver, oturum başlangıcında bu tool seçim rehberini AI'a otomatik olarak enjekte eder ve önce hafif tool'ların kullanımını teşvik eder.

## Ek: AI Sağlayıcıları Arasında Cache Karşılaştırması

### Cache Maliyetleri

| Sağlayıcı | Cache Write Maliyeti | Cache Read İndirimi | Cache Depolama Maliyeti |
|---|---|---|---|
| **Anthropic**<br/>(Claude Code) | 5 dakikalık tier: 1,25x input<br/>1 saatlik tier: 2x input | %90 indirim | Yok |
| **OpenAI**<br/>(Codex) | Ek ücret yok (input ile aynı) | %90 indirim | Yok |
| **Google Gemini**<br/>(Gemini CLI) | Ek ücret yok (input ile aynı) | %90 indirim | Yok |

> **Not**: Cache read indirim oranları modele göre değişir. Bu rakamlar her sağlayıcının en güncel amiral gemisi modellerini yansıtır.

### Cache Time-to-Live (TTL)

| Sağlayıcı | TTL | Garanti |
|---|---|---|
| **Anthropic**<br/>(Claude Code) | 5 dakika veya 1 saat | **Açıkça tanımlanmış** |
| **OpenAI**<br/>(Codex) | Genellikle 5-10 dakika hareketsizlikten sonra temizlenir; yoğun olmayan dönemlerde 1 saate kadar kalabilir | **Garanti yok** — resmi dokümantasyon "generally", "up to" ifadelerini kullanır |
| **Google Gemini**<br/>(Gemini CLI) | Açıklanmamış | **Garanti yok** — garantili TTL ile explicit caching API üzerinden kullanılabilir (ücretli) |

> **Not**: Claude Code ile yaptığımız deneylere göre, ana oturumlar genellikle 1 saatlik tier'ı, SubTask'lar ise 5 dakikalık tier'ı kullanır.

### Doğrudan API Çağrıları ile Ek Cache Kontrol Seçenekleri

Yukarıdaki karşılaştırma, AI coding araçları kullanıcılarının (Claude Code, Codex, Gemini CLI) perspektifinden yapılmıştır. API'yi doğrudan çağıran geliştiriciler daha ayrıntılı cache kontrolüne sahiptir.

**Anthropic**

- `cache_control`: Cache sınırlarını açıkça tanımlamak için kesme noktaları belirler. Belirtilmezse otomatik olarak belirlenir.
- TTL tier'ı (5 dakika / 1 saat) istek başına seçilebilir.

**OpenAI**

- `prompt_cache_key`: Aynı anahtara sahip istekleri aynı sunucuya yönlendirerek cache hit oranını artırır. Codex bunu dahili olarak otomatik olarak `conversation_id` olarak ayarlar.
- `prompt_cache_retention: "24h"`: Uzatılmış cache saklama. Varsayılan 5-10 dakikayı 24 saate kadar uzatır (ek maliyet yok, garanti yok). Codex bu seçeneği kullanmaz.

**Google Gemini**

- Explicit caching (`CachedContent`): Cache hit'i garanti etmek için 1 dakikadan 48 saate kadar TTL belirler. Depolama ücreti uygulanır (Pro için \$4,50/MTok/saat). Cache içeriği güncellemeleri, manuel olarak yeni bir CachedContent oluşturmayı gerektirir. Gemini CLI bu özelliği kullanmaz.

> **Not**: Bu seçenekler AI coding araçlarında açığa çıkarılmaz ve kullanıcılar tarafından doğrudan kontrol edilemez. AI coding araçları kullanıcıları, ana metindeki "Cache Maliyetlerini Düşürme Stratejileri" bölümüne başvurmalıdır.

### Kaynaklar

- Anthropic: [Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- OpenAI: [Prompt Caching](https://platform.openai.com/docs/guides/prompt-caching), [Pricing](https://platform.openai.com/docs/pricing)
- Google: [Context Caching](https://ai.google.dev/gemini-api/docs/caching), [Pricing](https://ai.google.dev/gemini-api/docs/pricing)
