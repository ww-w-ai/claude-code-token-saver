# cc-token-saver

> **Claude Code te corta a cada rato? Se acabó.**
>
> Gasta menos, programa más tiempo y ve exactamente a dónde van tus tokens — sin configurar nada.

¿Cómo? Gestión automática de context, seguimiento de costos en tiempo real y control de session con reconocimiento de cache — todo en un solo plugin.

---

## 😤 El Problema: $200/mes y Aún Así No Puedes Trabajar

Claude Code Max Plan ($200/mes). Debería ser suficiente. No lo es.

**Rate limit con ventana rodante de 5 horas.** Estás en pleno flujo de trabajo y simplemente se detiene. Sin temporizador. Sin hora estimada. Solo esperar.

**Cache expiry.** Vuelves del almuerzo. Pasó más de una hora. Envías un prompt y 900K tokens se reenvían a precio completo. ¿Costo? $9 de un solo golpe.

**Costos invisibles.** No hay forma de ver cuánto estás gastando en tiempo real. Solo te enteras cuando el rate limit te frena.

**Todo manual.** Tamaño de context, tiempos de cache expiry, delegación a SubTask, limpieza de session. Nadie puede llevar cuenta de todo esto mientras programa.

cc-token-saver maneja todo esto automáticamente. **Instala una vez. Listo.**

---

## 🚀 Instalación

```
claude plugin marketplace add ww-w-ai/cc-token-saver
claude plugin install cc-token-saver
```

Funciona automáticamente después de instalar. Sin configuración. Requiere [Claude Code](https://claude.ai/claude-code) v2.1.71+.

Para monitoreo en vivo:

```
/setup-statusline install
```

---

## 🛡️ Función 1: Token Guardian

**Detecta cache expiry y bloquea automáticamente reenvíos costosos.**

El TTL del prompt cache de Claude Code es 1 hora. Si te ausentas más de una hora, el cache expira. Tu siguiente mensaje reenvía todo el context a precio completo. Con 900K tokens, eso son $9 de un solo golpe.

Token Guardian rastrea cuándo se recibió la última respuesta. Si han pasado más de 3,590 segundos (TTL menos 10 segundos de margen), bloquea el prompt y muestra una advertencia.

```
🚨 Caché expirada (68m 23s inactivo)

La caché ha expirado. Continuar reenviará todo el contexto.
El costo puede aumentar significativamente.

👉 /context — Verificar el uso actual del contexto antes de decidir
👉 /clear → /continue — Reiniciar y restaurar contexto previo (recomendado, menor costo)
👉 Reenviar — Continuar tal cual (costo total de re-caché incurrido)
```

Reenvía el mismo prompt después de la advertencia y se ejecuta normalmente. La advertencia solo se activa una vez por periodo de inactividad, así que nunca molesta. Los mensajes de advertencia se muestran en 23 idiomas según la configuración regional de tu sistema operativo.

**Resultado:** Los costos de re-cache se previenen automáticamente. Sin ningún esfuerzo.

---

## 🧠 Función 2: Smart Session Architecture

**Instálalo y los patrones de trabajo optimizados en costo se activan automáticamente.**

La mayoría de los usuarios hacen todo en la session Main. Lectura de archivos, generación de código, ejecución de pruebas. Cada salida se acumula en el context y se reenvía con cada mensaje. La session se infla. Los costos se disparan.

Session Architect inyecta una estrategia de delegación al inicio de la session automáticamente.

|                  | Session Main                      | SubTask                               |
| ---------------- | --------------------------------- | ------------------------------------- |
| Rol              | Diseño, decisiones, revisión      | Implementación, generación de código, multi-archivo |
| Nivel de cache   | 1 hora (ephemeral_1h)             | 5 min                                 |
| Costo de cache write | ＄10/MTok                          | ＄6.25/MTok                            |
| Tamaño de context | ~94K promedio                     | ~33K promedio                         |

Los SubTask tienen **cache writes 37.5% más baratos** que Main. El context también es mucho menor. Delegar el trabajo pesado a SubTask reduce costos drásticamente.

**Resultado:** Claude trabaja automáticamente con un patrón eficiente en costos. No tienes que pensar en ello.

---

## 🪶 Modo Conciso

**Mismo contenido. Menos relleno. Activado por defecto.**

El mismo hook SessionStart también inyecta una regla de estilo de respuesta que se aplica en **cada sesión y cada modelo** — sin flags, sin configuración. Tres cosas cambian:

- **Fuera el preámbulo** — nada de "Déjame verificar…", "Ahora voy a…", repetir tu pregunta, o resumir lo que el diff ya muestra
- **Formato adecuado al contenido** — viñetas para listas, prosa para razonamiento (tradeoffs, causalidad, justificaciones). Ninguno se fuerza
- **Expresión más ajustada** — mismo punto, menos palabras. La prosa más clara es prosa más corta

Límite estricto: nunca eliminar contenido, saltar verificación, ni colapsar matices en una sola frase. La sustancia se mantiene íntegra; solo se reduce el envoltorio.

Instala una vez, se aplica en todas partes.

---


## 🔄 Función 3: /continue — Restauración de Context

**Reemplaza `/compact`. Cero llamadas LLM. Cero costo en tokens.**

`/compact` envía todo tu context (~1M tokens) al LLM para producir un resumen del 3.3%. Si el cache ha expirado, eso solo ya dispara un re-cache completo. La pérdida de información es inevitable.

`/continue` toma un enfoque completamente diferente. Preprocesa la transcripción de la session anterior y la lee directamente. Sin llamada LLM. Sin costo. La conversación original se restaura tal cual.

|                         | /compact                          | /continue                        |
| ----------------------- | --------------------------------- | -------------------------------- |
| Cómo funciona           | Envía context completo al LLM para resumen | Preprocesa transcripción, lectura directa |
| Llamadas LLM            | Requerida (típicamente 100K+ tokens) | 0                                |
| Costo en tokens         | Alto                              | 0                                |
| Pérdida de información  | Sí (resumen del 3.3%)             | Ninguna (original preservado)    |
| Velocidad de procesamiento | Decenas de segundos              | < 1 seg (incluso archivos de 60MB+) |
| Cuando cache expira     | Costo de re-cache completo adicional | Sin impacto                    |
| Restauración multi-session | No disponible                   | Soportada                        |

Uso: `/clear` luego `/continue`. Verás una lista de sessions anteriores. Elige cuál restaurar. Para recuperación rápida: `/continue last`.

**Resultado:** Retoma el trabajo anterior a costo cero. Sin pérdida de información.

---

## 📊 Función 4: Live Status Line

**Monitoreo de tokens/costos en tiempo real. Menos de 50ms de overhead.**

Ejecuta `/setup-statusline install` una vez y aparece una barra de estado persistente en la parte inferior de Claude Code.

```
[RUN🟢] $0.10/$12.23 | [5H🟢] 9% ⏳1h32m | [CTX🟢] 22%
```

| Indicador        | Qué muestra                         | 🟢 Normal | 🟡 Advertencia | 🔴 Crítico |
| ---------------- | ----------------------------------- | --------- | -------------- | ---------- |
| RUN (delta)      | Costo de la última llamada API      | < ＄0.30   | >= ＄0.30       | >= ＄1.00   |
| RUN (acumulado)  | Costo acumulado para esta carpeta   | —         | —              | —          |
| 5H               | Uso de ventana de 5 horas + cuenta regresiva | < 70%     | >= 70%         | >= 90%     |
| CTX              | Uso de la ventana de context        | < 35%     | >= 35%         | >= 70%     |

Cuando cualquier indicador llega a advertencia o crítico, aparece automáticamente una sugerencia `→ /usage-view current`.

Para desinstalar: `/setup-statusline uninstall` (la configuración anterior se restaura automáticamente).

**Resultado:** Ve el estado de tus costos de un vistazo. Actúa antes de que sea demasiado tarde.

---

## 📈 Panel de Uso (/usage-view)

**Por fin responde: "¿Por qué me dieron rate limit?"**

Hasta ahora, alcanzar el rate limit solo te hacía enojar. Sin forma de saber la causa. ¿Qué session quemó más tokens? ¿Cuándo se dispararon los costos? ¿Qué patrones existen en tu uso? Todo invisible.

`/usage-view` muestra todo. Un dashboard HTML interactivo se abre en tu navegador, permitiéndote analizar patrones de uso y rastrear la causa raíz de picos de costo. Sin dependencias externas. Funciona de forma independiente. Compartible como archivo.

Qué incluye:

- Tendencias de costo diario / por hora / por día de la semana — detecta cuándo quemas más tokens
- Desglose de tokens (input, output, cache write, cache read) — ve qué impulsa los costos
- Análisis de costo por session — identifica qué tareas fueron caras
- Línea temporal de ventana de 5 horas (suscriptores del Max Plan) — rastrea disparadores de rate limit
- Análisis de insights con IA — interpreta datos y sugiere mejoras
- 23 idiomas soportados (RTL incluido; gráficos/tablas permanecen LTR)

```
/usage-view                  # Todo el historial, todos los proyectos
/usage-view current          # Solo la ventana actual de 5 horas
/usage-view last 7 days      # Últimos 7 días
/usage-view locale es        # Español
```

---

## 🔬 Investigación de Rate Limit (/report-limit)

**Proyecto comunitario para descifrar la fórmula del rate limit.**

Anthropic no publica la fórmula exacta de la ventana de 5 horas. Vamos a descubrirla juntos.

Cuando te toque un rate limit, ejecuta `/report-limit`. Tus datos de uso en ese momento se envían automáticamente como GitHub Discussion. Cuantos más datos recolectemos, más clara será la fórmula.

---

## ✂️ Función 5: /setup-git-lite — Recorta las Instrucciones Git Integradas de CC

**Los 2.200 tokens ocultos por sesión que no sabías que estabas pagando.**

### El descubrimiento

El 2026-04-12, un [issue de GitHub](https://github.com/anthropics/claude-code/issues/47107) reveló que la configuración `includeGitInstructions` integrada en Claude Code quema tokens silenciosamente en cada sesión. Una reproducción independiente mediante [este gist (spilist)](https://gist.github.com/spilist/b0db92a859192f5ec6199d3f35a81b98) confirmó los números: **+6.031 tokens en cache writes** por sesión tras cada commit git, **+1.690 tokens en cache reads** en cada llamada API.

### Análisis del código fuente de CC — a dónde van los tokens

Rastreamos los tokens hasta dos puntos de inyección independientes en el código fuente de Claude Code (v2.1.88):

**1. Snapshot `gitStatus` (~500 tok) — system prompt**
- `context.ts:36-111` `getGitStatus()` recopila rama + rama principal + user.name + estado completo (hasta 2000 caracteres) + **los 5 commits recientes**
- Se une y agrega al system prompt mediante `appendSystemContext` (`utils/api.ts:437`)
- Cada nuevo commit, cada archivo modificado, cada cambio de rama modifica el texto → invalidación del prefix cache

**2. Instrucciones de flujo commit/PR (~1.700 tok) — descripción de la herramienta Bash**
- `tools/BashTool/prompt.ts:53` agrega 60+ líneas de protocolo de seguridad, procedimiento de commit paso a paso, ejemplos HEREDOC y plantillas de creación de PR a la descripción de la herramienta `Bash`
- Se cachea junto al system prompt, pero se envía como parámetro `tools[]`

### Por qué es costoso

La estructura de cache (`utils/api.ts:321` `splitSysPromptPrefix`) tiene tres rutas según si tienes herramientas MCP activas:

- **Path A** (MCP activo — la mayoría de usuarios): `gitStatus` está dentro de un bloque `cacheScope: 'org'`. Cualquier cambio → todo el bloque se recachea al inicio de la siguiente sesión → miss de 6K tok `cache_create`.
- **Path B** (sin MCP): `gitStatus` va a un bloque dinámico `cacheScope: null`, lo que significa que se reenvía como `input_tokens` frescos en cada llamada API — sin miss de cache, pero tampoco ahorro de cache.
- **Path C** (proveedor de terceros / betas experimentales desactivados): igual que Path A.

En sesiones interactivas típicas, las instrucciones de commit/PR (1,7K tok) se acumulan **en cada llamada API** mediante `cache_read`. En una sesión de 100 llamadas con precios de Opus 4.7, eso equivale a aproximadamente **$0,08 por sesión** solo por instrucciones que el entrenamiento de Claude ya cubre en su mayor parte.

### Cómo lo gestiona cc-token-saver

`/setup-git-lite` desactiva la ruta nativa e inyecta un **reemplazo curado de 280 tokens** mediante un hook SessionStart. Conservamos exactamente lo que anula el comportamiento predeterminado de Claude (reglas de seguridad), y eliminamos todo lo que Claude ya conoce por entrenamiento (flujos de trabajo paso a paso, plantillas de PR, patrones de uso de gh).

**Conservado — 11 reglas críticas de anulación** (las que convierten la utilidad predeterminada de Claude en precaución):
- Nunca hacer commit/push/amend/PR/tag/merge sin solicitud explícita del usuario
- Nunca omitir hooks, hacer force-push a main/master, ejecutar operaciones destructivas ni modificar la config de git
- Nunca hacer commit de archivos que coincidan con `.env`, `credentials`, `*.pem`, `secret.*`
- Evitar `git add -A` / `git add .`
- HEREDOC para mensajes de commit multilínea + trailer `Co-Authored-By: Claude`
- Nunca usar flags interactivos (-i), sin commits vacíos
- Si falla un pre-commit hook → crear un NUEVO commit (no `--amend`)

**Eliminado** — flujo de commit paso a paso (3 pasos), flujo de PR paso a paso (3 pasos), plantilla de título/cuerpo de PR, referencias al comando `gh`, advertencia de flag `-uall`, advertencia de `--no-edit` con rebase, restricción `NEVER use TodoWrite or Agent tools during commit`. Son verbosidad de flujo de trabajo que Claude compone correctamente desde su entrenamiento.

**Añadido** — línea compacta de estado git: rama + HEAD short-sha + subject + estado actual (hasta 20 archivos modificados, si no, un conteo). Sin lista de commits recientes (Claude puede ejecutar `git log` bajo demanda).

### Ahorro esperado (precios de Opus 4.7, $25/MTok output, $5/MTok input, $0,50/MTok cache read)

| Elemento | Original | Con setup-git-lite | Ahorro |
| -------- | -------- | ------------------- | ------ |
| Carga de system prompt (por nueva sesión) | ~2.200 tok cache_create | ~280 tok cache_create | ~1.920 tok |
| Llamadas repetidas en la misma sesión | ~1.700 tok cache_read/llamada | ~280 tok cache_read/llamada | ~1.420 tok/llamada |
| Sesión de 100 llamadas (Opus 4.7) | — | — | **~$0,11 ahorrados** |
| 20 sesiones/día × 22 días laborables | — | — | **~$48 ahorrados/mes** |

### Uso

```bash
/setup-git-lite status     # Diagnóstico de solo lectura — estado actual + qué cambiaría
/setup-git-lite install    # Desactiva CC nativo + activa nuestro hook mínimo
/setup-git-lite revert     # Restaura el comportamiento predeterminado (agresivo; ver abajo)
/setup-git-lite dismiss-banner    # Silencia el aviso de recomendación ocasional
/setup-git-lite undismiss-banner  # Reactiva el aviso
/setup-git-lite help       # Uso completo
```

### Semántica de install

`install` modifica **dos** lugares por robustez:

1. `~/.claude/settings.json` — agrega `"includeGitInstructions": false`
2. Perfil de shell (`~/.zshrc`, `~/.bashrc`, etc.) — añade un bloque marcador que exporta `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`

Cualquiera de los dos por separado es suficiente para desactivar CC nativo; establecemos ambos para que una anulación de entorno no reactive accidentalmente el comportamiento nativo. El cambio de shell toma efecto solo en shells nuevas.

### Semántica de revert — agresivo

`revert` **elimina TODAS las exportaciones de `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` de tu perfil de shell**, incluidas las que puedas haber añadido manualmente antes de instalar este skill. Esto es intencional — ejecutaste `revert`, así que restauramos el predeterminado limpio. Siempre creamos primero una copia de seguridad con marca de tiempo del perfil de shell.

Si necesitas la variable de entorno por razones no relacionadas, anótala antes de ejecutar `revert` y vuelve a añadirla después.

### Antes de desinstalar cc-token-saver

**Ejecuta `/setup-git-lite revert` primero**, o te quedará `includeGitInstructions: false` en tu settings.json pero sin hook de reemplazo (Claude no recibirá ninguna guía de git). Claude Code actualmente no tiene un hook de ciclo de vida para desinstalar plugins, por lo que no podemos automatizarlo.

### Compensaciones

Lo que pierdes (y por qué normalmente no importa):
- Claude ya no recibe un `git status` / `git log -n 5` precalculado al inicio de la sesión. Si preguntas "¿qué ha cambiado?" en una nueva sesión, Claude ejecutará esos comandos por sí mismo (una llamada a herramienta extra, ~300 tok).
- Claude ya no ve el procedimiento de commit canónico de 3 pasos de CC. En nuestras pruebas con cientos de flujos de commit, el conocimiento de entrenamiento maneja los casos críticos (formato HEREDOC, no `--amend`, no force-push) porque mantenemos esos como reglas explícitas.
- La plantilla de cuerpo de PR (`## Summary` + `## Test plan`) no se inyecta. Si te importa exactamente ese formato, ponlo en el CLAUDE.md de tu proyecto.

### Banner de recomendación

Cuando las instrucciones git nativas de CC todavía están activas en tu máquina, cc-token-saver muestra un aviso de un párrafo al inicio de la sesión **~20% de las veces** (además en las salidas de `/usage-view` y `/report-limit`). Descarta permanentemente con `/setup-git-lite dismiss-banner`.

---

## 💡 Cómo Funciona Realmente el Cache

Claude Code envía todo el historial de conversación al modelo en cada llamada API. "Llamada API" no significa "un mensaje que escribiste". Un solo prompt activa llamadas internas de herramientas — Grep, Read, Edit, Write — y cada una es una llamada API separada. Un prompt puede causar fácilmente 10+ llamadas API.

El prompt cache reduce este costo en un 90%. Pero el cache tiene un tiempo de vida.

|                     | Session Main                          | SubTask                                |
| ------------------- | ------------------------------------- | -------------------------------------- |
| Cache TTL           | 1 hora (ephemeral_1h)                 | 5 min                                  |
| Cache write         | ＄10/MTok                              | ＄6.25/MTok                             |
| Cache read          | ＄0.50/MTok                            | ＄0.50/MTok                             |
| Cuando cache expira | Context completo reenviado a precio completo | Bajo impacto (context es pequeño)   |

Incluso con cache activo, los costos se acumulan. Aquí un escenario extremo para mostrar la diferencia.

### Escenario: Día completo programando (3h mañana → 2h almuerzo/reunión → 3h tarde)

Condiciones: Precios de Opus 4, 1 prompt por minuto, ~5 llamadas API por prompt (~300 llamadas/hora).

#### ❌ Sin cc-token-saver

La mayor parte del trabajo ocurre en la session Main. El context crece rápido.

| Fase        | Situación                         | Tamaño de context            | Costo                                  |
| ----------- | --------------------------------- | ---------------------------- | -------------------------------------- |
| Mañana 3h   | Programando (mayoría en Main)     | 100K → 600K (promedio 350K)  | 900 llamadas × 350K × ＄0.50/M = ＄157.50 |
| Almuerzo    | Fuera por 2 horas                 | —                            | —                                      |
| Regreso     | Cache expirado → reenvío completo | 600K precio completo         | 600K × ＄5/M + 600K × ＄10/M = ＄9       |
| Regreso     | /compact (resumir)                | 600K → enviado al LLM       | 600K × ＄0.50/M + salida del resumen = ~＄1.50 |
| Tarde 3h    | Programando (context vuelve a crecer) | 100K → 600K (promedio 350K) | 900 llamadas × 350K × ＄0.50/M = ＄157.50 |
|             | Total                             |                              | ~＄326                                  |

> Con este nivel de uso, probablemente alcanzarás el rate limit de la ventana de 5 horas. **El costo es malo, pero el verdadero problema es que tu trabajo se detiene por completo. Este es el momento exacto en que Claude Code deja de funcionar.**

#### ✅ Con cc-token-saver

El trabajo pesado se delega a SubTask. Main solo maneja diseño/decisiones.

| Fase        | Situación                                    | Tamaño de context             | Costo                              |
| ----------- | -------------------------------------------- | ----------------------------- | ---------------------------------- |
| Mañana 3h   | Programando (Main: diseño, SubTask: implementación) | Main 100K → 300K (promedio 200K) | 900 llamadas × 200K × ＄0.50/M = ＄90 |
| Almuerzo    | Fuera por 2 horas                            | —                             | —                                  |
| Regreso     | ⚡ Token Guardian bloquea → /clear + /continue | —                            | ＄0 (sin llamadas LLM)              |
| Tarde 3h    | Programando                                  | Main 100K → 300K (promedio 200K) | 900 llamadas × 200K × ＄0.50/M = ＄90 |
|             | Total                                        |                               | ~＄180                              |

#### 💰 Resultado

> **＄326 → ＄180. ＄146 ahorrados por día (45%).**
>
> No se trata solo de costo. Menos tokens en el mismo tiempo significa **que no alcanzas el rate limit y puedes seguir trabajando.** Esa es la verdadera diferencia.

### Dónde interviene cc-token-saver

```
[Inicio de Session]
    │
    ├─ Session Architect → Inyecta automáticamente patrón de delegación a SubTask
    │                       Mantiene el context de Main bajo 250K
    │
[Trabajando]
    │
    ├─ Status Line → Monitoreo en tiempo real de costo/context/rate limit
    │                  Alerta instantánea al entrar en zona de advertencia
    │
[1+ hora inactivo]
    │
    ├─ Token Guardian → Detecta cache expiry, bloquea antes de reenviar
    │
[Reinicio de session]
    │
    └─ /continue → Restaura context anterior a costo cero (sin llamadas LLM)
```

---

## 🔧 Instalación desde Código Fuente y Personalización

```bash
git clone https://github.com/ww-w-ai/cc-token-saver.git
claude plugin marketplace add /path/to/cc-token-saver
claude plugin install cc-token-saver@cc-token-saver
```

cc-token-saver es completamente abierto. Todo el código fuente es JavaScript puro + scripts Bash siguiendo la estructura estándar de plugins. Modifica lo que quieras.

- **hooks/** — Cambia el umbral de cache expiry, personaliza mensajes de advertencia, modifica reglas de session architecture
- **scripts/** — Lógica de análisis, generador de reportes, formato de status line
- **skills/** — Cómo funcionan /continue y /usage-view, plantillas de prompts
- **locales/** — Agrega/edita traducciones, agrega nuevos idiomas
- **skills/usage-view/** — Cambios de UI/UX del dashboard

Hazlo tuyo. Haz fork, experimenta y envía un PR si encuentras algo mejor.

---

## 🌐 Idiomas Soportados

23 idiomas soportados. Seleccionados cruzando los 20 principales países por uso de Claude Code con los 20 idiomas principales por cantidad de hablantes globales. El idioma de visualización se detecta automáticamente desde la configuración regional de tu sistema operativo. También puedes especificarlo manualmente: `/usage-view locale es`

|                 |                 |                |                 |
| --------------- | --------------- | -------------- | --------------- |
| 🇺🇸 English    | 🇰🇷 Korean     | 🇯🇵 Japanese  | 🇨🇳 Chinese    |
| 🇪🇸 Spanish    | 🇫🇷 French     | 🇩🇪 German    | 🇧🇷 Portuguese |
| 🇮🇹 Italian    | 🇷🇺 Russian    | 🇸🇦 Arabic    | 🇮🇳 Hindi      |
| 🇧🇩 Bengali    | 🇮🇩 Indonesian | 🇲🇾 Malay     | 🇹🇭 Thai       |
| 🇻🇳 Vietnamese | 🇹🇷 Turkish    | 🇵🇱 Polish    | 🇳🇱 Dutch      |
| 🇮🇱 Hebrew     | 🇸🇪 Swedish    | 🇳🇴 Norwegian |                 |

Las traducciones actuales son generadas por IA. Las contribuciones de hablantes nativos son bienvenidas — edita el archivo JSON de tu idioma en `locales/` y envía un PR.

---

## 💡 Consejos

### Entiende el cache y verás a dónde va el dinero

- **1 prompt ≠ 1 llamada API.** Cada vez que Claude llama a Grep, Read o Edit, todo el context se reenvía. Un solo prompt fácilmente dispara 10+ llamadas API. Escribe prompts claros para reducir llamadas innecesarias a herramientas y recortar costos.
- **El cache se cuenta desde la última llamada API, no desde el último prompt.** Sigue trabajando y el cache nunca expira. El peligro es alejarte. Token Guardian bloquea automáticamente una vez, así que cuando regresas puedes elegir: reiniciar context o continuar tal cual.
- **Tamaño de context = multiplicador de costo.** La misma llamada API a 200K vs 800K cuesta 4x más. Cuando el [CTX] de la status line cruza 35% (🟡), es tu señal para delegar más a SubTask.

### Hábitos que reducen costos

- **Mantén CLAUDE.md ligero.** Se carga en el system prompt en cada llamada API. Cada línea cuesta dinero.
- **Delega el trabajo pesado a SubTask.** Generación de código, ediciones multi-archivo, ejecución de pruebas no pertenecen a Main. Los SubTask tienen context más pequeño y un nivel de cache más barato.
- **¿Ausente por 1+ horas?** `/clear` → regresa → `/continue`. Context restaurado a $0.
- **¿[5H] arriba del 70% (🟡)?** Reduce el ritmo. Cambia a tareas de revisión ligeras o aumenta la delegación a SubTask para reducir el conteo de llamadas API de Main.
- **Usa `/btw` para preguntas secundarias.** No entra al historial de conversación, así que tu context se mantiene ligero.

---

## License

Apache-2.0
