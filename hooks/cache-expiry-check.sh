#!/bin/bash
# Cache expiry block hook
# - 3590s+ (3600s TTL - 10s buffer): cache expired block (one-time gate, re-send to bypass)
# - Main sessions use 1-hour cache tier (ephemeral_1h), not 5-minute
# - i18n: 23 languages based on OS locale

INPUT=$(cat)
# Extract JSON fields without jq — input is a single-line flat JSON object
TRANSCRIPT=$(echo "$INPUT" | sed -n 's/.*"transcript_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
SESSION_ID=$(echo "$INPUT" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

WARN_FLAG="${TMPDIR:-${TEMP:-${TMP:-/tmp}}}/claude-cache-warn-${SESSION_ID}"

# Detect language from OS locale
LOCALE_LANG="${LANG%%_*}"
LOCALE_LANG="${LOCALE_LANG%%.*}"

get_expired_msg() {
  local m="$1" s="$2"
  case "$LOCALE_LANG" in
    ko) echo "🚨 캐시 만료 (${m}분 ${s}초 경과)\n\n프롬프트 캐시가 만료되어 이대로 실행하면 전체 컨텍스트를 다시 전송합니다.\n비용이 크게 증가할 수 있습니다.\n\n👉 /context — 현재 컨텍스트 사용량 확인 후 판단\n👉 /clear → /continue — 초기화 후 이전 컨텍스트 복원 (권장, 최저비용)\n👉 그냥 다시 보내기 — 현재 상태로 계속 진행 (전체 재캐시 비용 발생)" ;;
    ja) echo "🚨 キャッシュ期限切れ (${m}分${s}秒経過)\n\nプロンプトキャッシュが切れました。このまま実行すると全コンテキストを再送信します。\nコストが大幅に増加する可能性があります。\n\n👉 /context — 現在のコンテキスト使用量を確認してから判断\n👉 /clear → /continue — リセット後、以前のコンテキストを復元（推奨、最安）\n👉 再送信 — そのまま続行（全再キャッシュコスト発生）" ;;
    zh) echo "🚨 缓存已过期 (已空闲${m}分${s}秒)\n\n提示缓存已过期，继续将重新发送全部上下文。\n费用可能大幅增加。\n\n👉 /context — 查看当前上下文使用量后再决定\n👉 /clear → /continue — 重置后恢复之前的上下文（推荐，费用最低）\n👉 直接重新发送 — 继续当前状态（全量重新缓存费用产生）" ;;
    es) echo "🚨 Caché expirada (${m}m ${s}s inactivo)\n\nLa caché ha expirado. Continuar reenviará todo el contexto.\nEl costo puede aumentar significativamente.\n\n👉 /context — Verificar el uso actual del contexto antes de decidir\n👉 /clear → /continue — Reiniciar y restaurar contexto previo (recomendado, menor costo)\n👉 Reenviar — Continuar tal cual (costo total de re-caché incurrido)" ;;
    fr) echo "🚨 Cache expiré (${m}m ${s}s d'inactivité)\n\nLe cache a expiré. Continuer renverra tout le contexte.\nLe coût peut augmenter considérablement.\n\n👉 /context — Vérifier l'utilisation actuelle du contexte avant de décider\n👉 /clear → /continue — Réinitialiser puis restaurer le contexte précédent (recommandé, coût minimal)\n👉 Renvoyer — Continuer tel quel (coût total de re-cache engendré)" ;;
    de) echo "🚨 Cache abgelaufen (${m}m ${s}s inaktiv)\n\nDer Cache ist abgelaufen. Fortfahren sendet den gesamten Kontext erneut.\nDie Kosten können erheblich steigen.\n\n👉 /context — Aktuelle Kontextnutzung prüfen, bevor Sie entscheiden\n👉 /clear → /continue — Zurücksetzen, dann vorherigen Kontext wiederherstellen (empfohlen, günstigste Option)\n👉 Erneut senden — Fortfahren wie gehabt (volle Re-Cache-Kosten anfallend)" ;;
    pt) echo "🚨 Cache expirado (${m}m ${s}s inativo)\n\nO cache expirou. Continuar reenviará todo o contexto.\nO custo pode aumentar significativamente.\n\n👉 /context — Verificar o uso atual do contexto antes de decidir\n👉 /clear → /continue — Reiniciar e restaurar contexto anterior (recomendado, menor custo)\n👉 Reenviar — Continuar como está (custo total de re-cache incorrido)" ;;
    it) echo "🚨 Cache scaduta (${m}m ${s}s inattivo)\n\nLa cache è scaduta. Continuare reinvierà tutto il contesto.\nIl costo potrebbe aumentare notevolmente.\n\n👉 /context — Controlla l'utilizzo attuale del contesto prima di decidere\n👉 /clear → /continue — Reimposta e ripristina il contesto precedente (consigliato, costo minimo)\n👉 Reinvia — Continua così com'è (costo totale di re-cache sostenuto)" ;;
    ru) echo "🚨 Кэш истёк (${m}м ${s}с простоя)\n\nКэш истёк. Продолжение отправит весь контекст заново.\nСтоимость может значительно возрасти.\n\n👉 /context — Проверить текущее использование контекста перед принятием решения\n👉 /clear → /continue — Сбросить и восстановить предыдущий контекст (рекомендуется, минимальная стоимость)\n👉 Отправить снова — Продолжить как есть (возникнет полная стоимость повторного кэширования)" ;;
    ar) echo "🚨 انتهت صلاحية الذاكرة المؤقتة (${m}د ${s}ث خمول)\n\nانتهت صلاحية الذاكرة المؤقتة. المتابعة ستعيد إرسال كل السياق.\nقد تزداد التكلفة بشكل كبير.\n\n👉 /context — تحقق من استخدام السياق الحالي قبل اتخاذ القرار\n👉 /clear → /continue — إعادة التعيين ثم استعادة السياق السابق (موصى به، أقل تكلفة)\n👉 إعادة الإرسال — المتابعة كما هو (تكلفة إعادة التخزين المؤقت الكاملة تُتكبّد)" ;;
    hi) echo "🚨 कैश समाप्त (${m}मि ${s}से निष्क्रिय)\n\nकैश समाप्त हो गया है। जारी रखने पर पूरा संदर्भ दोबारा भेजा जाएगा।\nलागत काफी बढ़ सकती है।\n\n👉 /context — निर्णय लेने से पहले वर्तमान संदर्भ उपयोग जांचें\n👉 /clear → /continue — रीसेट करें, फिर पिछला संदर्भ पुनर्स्थापित करें (अनुशंसित, सबसे सस्ता)\n👉 दोबारा भेजें — जारी रखें जैसा है (पूर्ण री-कैश लागत लगेगी)" ;;
    bn) echo "🚨 ক্যাশ মেয়াদোত্তীর্ণ (${m}মি ${s}সে নিষ্ক্রিয়)\n\nক্যাশ মেয়াদোত্তীর্ণ হয়েছে। চালিয়ে যেতে পুরো প্রসঙ্গ পুনরায় পাঠাতে হবে।\n\n👉 /context — সিদ্ধান্ত নেওয়ার আগে বর্তমান প্রসঙ্গ ব্যবহার পরীক্ষা করুন\n👉 /clear → /continue — রিসেট করে পূর্ববর্তী প্রসঙ্গ পুনরুদ্ধার করুন (প্রস্তাবিত, সর্বনিম্ন খরচ)\n👉 পুনরায় পাঠান — যেমন আছে চালিয়ে যান (সম্পূর্ণ রি-ক্যাশ খরচ হবে)" ;;
    id) echo "🚨 Cache kedaluwarsa (${m}m ${s}d tidak aktif)\n\nCache telah kedaluwarsa. Melanjutkan akan mengirim ulang seluruh konteks.\nBiaya dapat meningkat secara signifikan.\n\n👉 /context — Periksa penggunaan konteks saat ini sebelum memutuskan\n👉 /clear → /continue — Reset lalu pulihkan konteks sebelumnya (disarankan, biaya terendah)\n👉 Kirim ulang — Lanjutkan apa adanya (biaya re-cache penuh timbul)" ;;
    ms) echo "🚨 Cache tamat tempoh (${m}m ${s}s tidak aktif)\n\nCache telah tamat. Meneruskan akan menghantar semula semua konteks.\nKos mungkin meningkat dengan ketara.\n\n👉 /context — Semak penggunaan konteks semasa sebelum membuat keputusan\n👉 /clear → /continue — Tetapkan semula lalu pulihkan konteks sebelumnya (disyorkan, kos terendah)\n👉 Hantar semula — Teruskan seperti sedia ada (kos re-cache penuh ditanggung)" ;;
    th) echo "🚨 แคชหมดอายุ (ไม่ใช้งาน ${m}น. ${s}วิ.)\n\nแคชหมดอายุแล้ว ดำเนินการต่อจะส่งบริบททั้งหมดใหม่\nค่าใช้จ่ายอาจเพิ่มขึ้นอย่างมาก\n\n👉 /context — ตรวจสอบการใช้งานบริบทปัจจุบันก่อนตัดสินใจ\n👉 /clear → /continue — รีเซ็ตแล้วกู้คืนบริบทก่อนหน้า (แนะนำ, ประหยัดที่สุด)\n👉 ส่งอีกครั้ง — ดำเนินการต่อตามเดิม (เกิดค่าใช้จ่ายรีแคชเต็ม)" ;;
    vi) echo "🚨 Bộ nhớ đệm hết hạn (không hoạt động ${m}p ${s}g)\n\nBộ nhớ đệm đã hết hạn. Tiếp tục sẽ gửi lại toàn bộ ngữ cảnh.\nChi phí có thể tăng đáng kể.\n\n👉 /context — Kiểm tra mức sử dụng ngữ cảnh hiện tại trước khi quyết định\n👉 /clear → /continue — Đặt lại rồi khôi phục ngữ cảnh trước đó (khuyến nghị, tiết kiệm nhất)\n👉 Gửi lại — Tiếp tục như hiện tại (chi phí re-cache đầy đủ phát sinh)" ;;
    tr) echo "🚨 Önbellek süresi doldu (${m}dk ${s}sn boşta)\n\nÖnbellek süresi doldu. Devam etmek tüm bağlamı yeniden gönderecektir.\nMaliyet önemli ölçüde artabilir.\n\n👉 /context — Karar vermeden önce mevcut bağlam kullanımını kontrol edin\n👉 /clear → /continue — Sıfırla, ardından önceki bağlamı geri yükle (önerilen, en düşük maliyet)\n👉 Tekrar gönder — Olduğu gibi devam et (tam re-cache maliyeti oluşur)" ;;
    pl) echo "🚨 Pamięć podręczna wygasła (${m}m ${s}s bezczynności)\n\nPamięć podręczna wygasła. Kontynuowanie wyśle ponownie cały kontekst.\nKoszt może znacząco wzrosnąć.\n\n👉 /context — Sprawdź bieżące użycie kontekstu przed podjęciem decyzji\n👉 /clear → /continue — Zresetuj, potem przywróć poprzedni kontekst (zalecane, najniższy koszt)\n👉 Wyślij ponownie — Kontynuuj jak jest (pełny koszt ponownego cache zostanie naliczony)" ;;
    nl) echo "🚨 Cache verlopen (${m}m ${s}s inactief)\n\nDe cache is verlopen. Doorgaan verstuurt de volledige context opnieuw.\nDe kosten kunnen aanzienlijk stijgen.\n\n👉 /context — Controleer het huidige contextgebruik voordat u beslist\n👉 /clear → /continue — Resetten en daarna vorige context herstellen (aanbevolen, laagste kosten)\n👉 Opnieuw verzenden — Doorgaan zoals het is (volledige re-cache kosten gemaakt)" ;;
    he) echo "🚨 המטמון פג תוקף (${m} דקות ${s} שניות ללא פעילות)\n\nמטמון ההנחיה פג תוקף. המשך ישלח מחדש את כל ההקשר.\nהעלות עלולה לעלות משמעותית.\n\n👉 /context — בדוק את השימוש הנוכחי בהקשר לפני קבלת החלטה\n👉 /clear → /continue — איפוס ואז שחזור ההקשר הקודם (מומלץ, עלות מינימלית)\n👉 שליחה מחדש — המשך כפי שזה (עלות מלאה של מטמון מחדש תיגרם)" ;;
    sv) echo "🚨 Cache har gått ut (${m}m ${s}s inaktiv)\n\nPrompt-cachen har gått ut. Att fortsätta skickar om hela kontexten.\nKostnaden kan öka avsevärt.\n\n👉 /context — Kontrollera aktuell kontextanvändning innan du bestämmer dig\n👉 /clear → /continue — Återställ, sedan återställ tidigare kontext (rekommenderat, lägst kostnad)\n👉 Skicka igen — Fortsätt som det är (full re-cache-kostnad uppstår)" ;;
    no) echo "🚨 Cache utløpt (${m}m ${s}s inaktiv)\n\nPrompt-cachen har utløpt. Å fortsette sender hele konteksten på nytt.\nKostnaden kan øke betydelig.\n\n👉 /context — Sjekk nåværende kontekstbruk før du bestemmer deg\n👉 /clear → /continue — Tilbakestill, deretter gjenopprett tidligere kontekst (anbefalt, lavest kostnad)\n👉 Send på nytt — Fortsett som det er (full re-cache-kostnad påløper)" ;;
    en) echo "🚨 Cache expired (${m}m ${s}s idle)\n\nThe prompt cache has expired. Continuing will resend the full context.\nCost may increase significantly.\n\n👉 /context — Check current context usage before deciding\n👉 /clear → /continue — Reset, then restore previous context (recommended, cheapest)\n👉 Re-send — Continue as-is (full re-cache cost incurred)" ;;
    *)  echo "🚨 Cache expired (${m}m ${s}s idle)\n\nThe prompt cache has expired. Continuing will resend the full context.\nCost may increase significantly.\n\n👉 /context — Check current context usage before deciding\n👉 /clear → /continue — Reset, then restore previous context (recommended, cheapest)\n👉 Re-send — Continue as-is (full re-cache cost incurred)" ;;
  esac
}


# Already warned once → allow through, reset flag
if [ -f "$WARN_FLAG" ]; then
  rm -f "$WARN_FLAG"
  echo '{"decision":"approve"}'
  exit 0
fi

if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
  echo '{"decision":"approve"}'
  exit 0
fi

# Get last assistant message timestamp
LAST_TS=$(tail -200 "$TRANSCRIPT" 2>/dev/null \
  | grep '"type":"assistant"' \
  | sed -n 's/.*"timestamp"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
  | tail -1)

if [ -z "$LAST_TS" ]; then
  echo '{"decision":"approve"}'
  exit 0
fi

# Parse timestamp (UTC) and compute elapsed seconds
if date -j -f "%Y-%m-%dT%H:%M:%S" "2000-01-01T00:00:00" "+%s" 2>/dev/null 1>/dev/null; then
  LAST_EPOCH=$(TZ=UTC date -j -f "%Y-%m-%dT%H:%M:%S" "${LAST_TS%%.*}" "+%s")
else
  LAST_EPOCH=$(TZ=UTC date -d "${LAST_TS%%.*}" "+%s" 2>/dev/null)
fi
if [ -z "$LAST_EPOCH" ]; then
  echo '{"decision":"approve"}'
  exit 0
fi

NOW_EPOCH=$(date "+%s")
ELAPSED=$(( NOW_EPOCH - LAST_EPOCH ))
MINS=$(( ELAPSED / 60 ))
SECS=$(( ELAPSED % 60 ))

# 3590s+ → cache expired, block (3600s TTL - 10s buffer)
if [ "$ELAPSED" -ge 3590 ]; then
  MSG=$(get_expired_msg "$MINS" "$SECS")
  touch "$WARN_FLAG"
  # Escape for JSON
  MSG_JSON=$(echo "$MSG" | sed 's/"/\\"/g')
  echo "{\"decision\":\"block\",\"reason\":\"${MSG_JSON}\"}"

# Under 3590s → cache still alive
else
  echo '{"decision":"approve"}'
fi
