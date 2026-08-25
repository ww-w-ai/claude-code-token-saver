# Guia de costes de cache — Por que la mayor parte de tu gasto es cache

Es normal que la mayor parte del coste de las herramientas de programacion con IA provenga de operaciones de cache (escrituras + lecturas). Este documento explica por que y como gestionarlo.

## El secreto: cada mensaje reenvia toda la conversacion

Los LLM son **sin estado**. A diferencia de los humanos, los modelos de IA no "recuerdan" la conversacion anterior — reciben el historial completo de la conversacion como entrada en cada solicitud.

Parece un chat, pero las llamadas reales a la API funcionan asi:

```
[ Solicitud 1 ]
→ Prompt del sistema + "Arregla este bug"
← Respuesta de la IA

[ Solicitud 2 ]
→ Prompt del sistema + "Arregla este bug" + Respuesta de la IA + "Anade tambien tests"
← Respuesta de la IA

[ Solicitud 3 ]
→ Prompt del sistema + "Arregla este bug" + Respuesta de la IA + "Anade tambien tests" + Respuesta de la IA + "Haz commit"
← Respuesta de la IA
```

Cada solicitud incluye **todo** el contenido anterior. Por ejemplo, la solicitud numero 50 contiene toda la conversacion y todas las respuestas de la IA de las 49 solicitudes previas. Por eso los tokens de entrada crecen rapidamente a medida que la conversacion se alarga.

Ademas, las herramientas de programacion con IA envian el prompt del sistema (instrucciones integradas, archivos de configuracion, plugins, definiciones de herramientas MCP, etc.) con cada solicitud — asi que incluso un mensaje de una linea genera decenas de miles de tokens de entrada.

## Que es el caching?

El **prompt caching** reduce el coste de esta transmision repetida. Almacena las partes sin cambios de tu entrada en el servidor para que las solicitudes posteriores puedan reutilizarlas con un precio reducido.

- **Cache Write**: El coste de almacenar el contenido de la conversacion en el servidor. Ocurre en la primera solicitud o cuando expira la cache.
- **Cache Read**: El coste de reutilizar conversacion ya almacenada. Se cobra con un **90% de descuento** en comparacion con la entrada estandar.

Las herramientas de programacion con IA inevitablemente producen conversaciones largas y contextos grandes, de hasta 1 millon de tokens por solicitud. Aunque tu nueva pregunta sea corta, toda la conversacion anterior se factura junto con ella, asi que los costes se acumulan rapidamente a medida que la conversacion crece.

Para reducir esta carga, los principales proveedores de IA aplican un descuento del 90% en las lecturas de cache, lo que reduce significativamente el coste de retransmitir contenido ya procesado.

## Por que la cache domina el coste total?

| Categoria | Tokens por llamada | Nota |
|---|---|---|
| Entrada del usuario (tokens nuevos) | Decenas a cientos | Lo que el usuario realmente escribe |
| Salida de la IA | Cientos a miles | Respuesta de la IA |
| **Lectura de cache** | **100K–cientos de K** | Toda la conversacion acumulada se factura en cada llamada |

El volumen de lecturas de cache por llamada es **miles de veces** mayor que la entrada. Incluso con un descuento del 90%, las lecturas de cache siguen dominando en terminos absolutos de coste.

Y estas llamadas no provienen solo de los mensajes del usuario:

| Origen | Frecuencia | Lectura de cache por llamada |
|---|---|---|
| Mensajes del usuario | Cuando el usuario envia un mensaje | Toda la conversacion acumulada |
| **Decisiones propias de la IA** | **Multiples llamadas por mensaje del usuario** | Toda la conversacion acumulada |

De forma invisible, la IA realiza multiples decisiones en secuencia para un solo mensaje del usuario — decidir que herramienta usar, interpretar el resultado de la herramienta, decidir la siguiente accion. Cada una de estas decisiones es una llamada completa al LLM que incluye todo el contexto. La ejecucion de la herramienta en si (lecturas de archivos, busquedas) se ejecuta localmente, pero la toma de decisiones antes y despues de cada uso de herramienta incurre en costes de lectura de cache.

### Por que el coste de escritura de cache tambien es mayor de lo esperado?

Para Anthropic, los costes de escritura de cache son 1.25x la entrada (nivel de 5 minutos) o 2x la entrada (nivel de 1 hora). Con esos multiplicadores, parece que la escritura de cache no deberia superar 2x el coste de entrada+salida — pero en la practica, la escritura de cache ocupa una proporcion mucho mayor.

Dos razones:

| Causa | Explicacion |
|---|---|
| **Prompt del sistema** | Decenas de miles de tokens antes de que el usuario escriba nada (con plugins/MCP). Todo esto esta sujeto a costes de escritura de cache |
| **Recreacion tras expiracion** | Despues de que expire el TTL (5 min / 1 hora), toda la conversacion acumulada debe volver a almacenarse en cache. Cuanto mas larga la conversacion, mayor el coste de recreacion |

En otras palabras, la escritura de cache no ocurre solo por "nuevos tokens que el usuario escribio". Al inicio de la sesion, todo el prompt del sistema se almacena en cache; tras la expiracion, toda la conversacion acumulada se convierte en objetivo de escritura de cache. Si la cache de una conversacion de 100K tokens expira, un solo mensaje genera una escritura de cache de 100K tokens de golpe.

**Exactamente por eso el plugin super-token-saver muestra una advertencia de expiracion de cache tras 1 hora de inactividad.** Cuando aparezca la advertencia, comprueba el tamano de tu contexto actual:

- **Contexto pequeno**: El coste de recreacion de cache es manejable. Simplemente sigue trabajando — el coste es bajo.
- **Contexto grande**: El coste de cache sera significativo. Recomendamos `/clear` seguido de `/s-continue last` para reanudar en una nueva sesion. La habilidad continue restaura automaticamente el contexto de tu conversacion anterior, asi que tu flujo de trabajo no se interrumpe.

## Estrategias para reducir los costes de cache

El plugin super-token-saver esta disenado para automatizar o simplificar todas estas estrategias.

### 1. Mantener el contexto pequeno — `/clear` + `/s-continue` ⭐

**Esta es la forma mas importante de reducir costes.** Los costes altos de cache significan que estas recibiendo el descuento del 90% — eso es normal. Pero si el contexto crece innecesariamente y se mantiene asi, el coste absoluto por llamada aumenta incluso con el descuento. **Mantener el tamano del contexto bajo control es la estrategia de gestion de costes mas efectiva.**

Cuando el tema cambia o la conversacion se alarga, ejecuta `/clear` para reiniciar, y luego `/s-continue last` para restaurar el contexto anterior. `/s-continue` restaura conversaciones anteriores sin ninguna llamada al LLM, asi que el coste es cero.

`/compact` reduce el contexto resumiendo la conversacion, pero el proceso de resumen en si incurre en costes de llamadas al LLM y descarta detalles de la conversacion. No recomendado.

### 2. Prevenir la expiracion de cache — Token Guardian (Automatico)

La cache de sesion principal de Anthropic usa un **nivel de 1 hora**. Tras la expiracion, la primera solicitud debe recrear toda la conversacion como escritura de cache, lo cual es costoso.

super-token-saver detecta estados de inactividad de 1 hora y **muestra automaticamente una advertencia**. Cuando aparezca la advertencia, usar el metodo 1 anterior (`/clear` + `/s-continue`) para continuar en una nueva sesion es el enfoque mas economico.

### 3. Delegar trabajo pesado a SubTasks

Las tareas pesadas como generacion de codigo o ediciones de multiples archivos pueden delegarse a SubTasks en lugar de ejecutarlas directamente en la sesion principal. Los SubTasks usan el nivel de cache de 5 minutos, haciendo las **escrituras de cache un 37.5% mas baratas**, y se ejecutan en un contexto aislado mas pequeno, reduciendo el volumen de lectura de cache por llamada.

super-token-saver guia automaticamente este patron de separacion de trabajo al inicio de la sesion.

### 4. Monitoreo de costes en tiempo real — `/setup-statusline`

Instala `/setup-statusline` para mostrar el estado de coste/tokens en tiempo real en la parte inferior de tu CLI: `[RUN] \$0.10/\$12.23 | [5H] 9% | [CTX] 22%`. Puedes detectar costes anormalmente altos por llamada o un contexto creciente de inmediato, permitiendote actuar antes de que los costes se disparen.

### 5. Analisis de patrones de coste — `/usage-view`

Usa `/usage-view` para revisar tu historial completo de uso como un panel interactivo. Visualiza tendencias de costes diarias/por hora, composicion de tokens por sesion y eficiencia de cache. Identifica de un vistazo que tareas causaron picos de coste y que patrones son ineficientes.

### 6. Optimizacion del prompt del sistema

Cuantos mas plugins, servidores MCP y habilidades se carguen en el prompt del sistema, mayor sera el coste inicial de escritura de cache. Elimina lo que no estes usando.

`/setup-git-lite` de super-token-saver reduce las instrucciones Git predeterminadas de Claude Code (~2,200 tokens) a un nucleo de 280 tokens — una reduccion de aproximadamente el 88% en el prompt del sistema relacionado con Git por sesion.

### 7. Seleccion de herramientas — El impacto en el contexto varia segun la herramienta

Una vez que se lee un archivo, su contenido permanece en el contexto y se acumula en las lecturas de cache de todas las llamadas posteriores. Leer un solo archivo completo anade miles a decenas de miles de tokens al contexto, y esa cantidad se factura en cada llamada posterior.

Las tareas de programacion a menudo involucran multiples archivos simultaneamente — leer solo 3-4 archivos completos puede hacer que el contexto crezca dramaticamente. Elegir la herramienta adecuada marca una diferencia significativa en el crecimiento del contexto.

| Herramienta | Proposito | Impacto en el contexto | Cuando usar |
|---|---|---|---|
| **Grep** | Buscar codigo por patron | **Minimo** — solo devuelve lineas coincidentes | Buscar nombres de funciones, variables, cadenas especificas |
| **Glob** | Buscar archivos por patron de nombre | **Minimo** — solo devuelve rutas de archivos | Buscar ubicaciones de archivos como `*.ts`, `src/**/*.test.js` |
| **LSP** | Definiciones de simbolos, referencias, tipos | **Minimo** — solo devuelve definiciones/firmas | Ir a definicion, buscar referencias, comprobar tipos |
| **Read** (offset/limit) | Leer parte especifica de un archivo | **Moderado** — solo devuelve el rango especificado | Cuando necesitas un rango especifico de lineas |
| **Read** (completo) | Leer archivo completo | **Grande** — archivo completo anadido al contexto | Solo cuando necesitas entender la estructura completa del archivo |

"Lee este archivo completo" usa de decenas a cientos de veces mas contexto que "Encuentra esta funcion".

El mismo principio aplica para editar y comparar:

| Herramienta | Proposito | Impacto en el contexto |
|---|---|---|
| **Edit** | Modificar archivo existente | **Minimo** — solo el diff se anade al contexto |
| **Write** | Crear archivo nuevo / reescritura completa | **Grande** — archivo completo anadido al contexto |
| **git diff / diff** | Comparar archivos/carpetas | **Minimo** — solo se devuelven las diferencias |
| Leer ambos archivos por separado | Comparar archivos/carpetas | **Grande** — ambos archivos completos anadidos al contexto |

super-token-saver inyecta automaticamente esta guia de seleccion de herramientas a la IA al inicio de la sesion, fomentando el uso de herramientas ligeras primero.

## Apendice: Comparacion de cache entre proveedores de IA

### Costes de cache

| Proveedor | Coste de escritura de cache | Descuento en lectura de cache | Coste de almacenamiento de cache |
|---|---|---|---|
| **Anthropic**<br/>(Claude Code) | Nivel 5 min: 1.25x entrada<br/>Nivel 1 hora: 2x entrada | 90% de descuento | Ninguno |
| **OpenAI**<br/>(Codex) | Sin recargo (igual que entrada) | 90% de descuento | Ninguno |
| **Google Gemini**<br/>(Gemini CLI) | Sin recargo (igual que entrada) | 90% de descuento | Ninguno |

> **Nota**: Las tasas de descuento en lectura de cache varian segun el modelo. Estas cifras reflejan los ultimos modelos insignia de cada proveedor.

### Tiempo de vida de la cache (TTL)

| Proveedor | TTL | Garantia |
|---|---|---|
| **Anthropic**<br/>(Claude Code) | 5 minutos o 1 hora | **Explicitamente definido** |
| **OpenAI**<br/>(Codex) | Generalmente se elimina tras 5-10 min de inactividad; puede persistir hasta 1 hora en periodos de baja demanda | **No garantizado** — la documentacion oficial usa "generalmente", "hasta" |
| **Google Gemini**<br/>(Gemini CLI) | No revelado | **No garantizado** — el caching explicito con TTL garantizado esta disponible via API (de pago) |

> **Nota**: Segun nuestros experimentos con Claude Code, las sesiones principales suelen usar el nivel de 1 hora, mientras que los SubTasks usan el nivel de 5 minutos.

### Opciones adicionales de control de cache via llamadas directas a la API

La comparacion anterior es desde la perspectiva de los usuarios de herramientas de programacion con IA (Claude Code, Codex, Gemini CLI). Los desarrolladores que llaman directamente a las APIs tienen un control de cache mas detallado.

**Anthropic**

- `cache_control`: Establece puntos de corte para definir explicitamente los limites de la cache. Se determina automaticamente si no se especifica.
- El nivel de TTL (5 min / 1 hora) puede seleccionarse por solicitud.

**OpenAI**

- `prompt_cache_key`: Dirige las solicitudes con la misma clave al mismo servidor, mejorando las tasas de acierto de cache. Codex internamente establece esto como `conversation_id` automaticamente.
- `prompt_cache_retention: "24h"`: Retencion extendida de cache. Extiende el valor predeterminado de 5-10 min hasta 24 horas (sin coste adicional, no garantizado). Codex no usa esta opcion.

**Google Gemini**

- Caching explicito (`CachedContent`): Establece TTL de 1 minuto a 48 horas para garantizar aciertos de cache. Se aplica tarifa de almacenamiento (\$4.50/MTok/hora para Pro). Las actualizaciones del contenido en cache requieren crear manualmente un nuevo CachedContent. Gemini CLI no usa esta caracteristica.

> **Nota**: Estas opciones no estan expuestas en las herramientas de programacion con IA y no pueden ser controladas directamente por los usuarios. Los usuarios de herramientas de programacion con IA deben consultar la seccion "Estrategias para reducir los costes de cache" en el texto principal.

### Fuentes

- Anthropic: [Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- OpenAI: [Prompt Caching](https://platform.openai.com/docs/guides/prompt-caching), [Pricing](https://platform.openai.com/docs/pricing)
- Google: [Context Caching](https://ai.google.dev/gemini-api/docs/caching), [Pricing](https://ai.google.dev/gemini-api/docs/pricing)
