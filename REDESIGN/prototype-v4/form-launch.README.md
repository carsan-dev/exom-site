# D114 — Formulario preparado y probado localmente

## Cierre local vigente — 5 de noviembre de 2026

La prueba posterior del correo con diseño EXOM está en la Preview protegida `exom-site-7oo2zn1b2-crolyx16-3282s-projects.vercel.app`, despliegue `dpl_EhjhDYSgo7PZQnu88rAWkj8DKvBs`. Un único envío ficticio autorizado; el propietario confirmó en Gmail «lo muestra perfecto». Se mantienen `contacto@exommethod.com` como remitente y la bandeja preferida `exom.method@gmail.com` (constante técnica `exommethod@gmail.com`). Confirmación de interfaz: «Solicitud enviada. La revisaré y contactaré contigo por WhatsApp.» Privacidad breve visible y detalles plegados; proveedores Vercel, Resend, Gmail y WhatsApp.

El correo combina HTML y texto; cabecera Barlow en PNG interno `cid:exom-header`, respuestas escapadas como texto. El avatar personal lo configuró el propietario. Ver `email.README.md`. El adaptador de prueba externa vence el 5 de noviembre a las 21:43:06.593 UTC y usa `exom-email-design-test-20261105-v1`; no forma parte del repo ni del paquete final. **No promover ninguna Preview de envío temporal a producción.** No se ha comprobado aquí su caducidad remota ni revocado `exom-form-test`.

Producción sigue fuera de este trabajo local; último despliegue comprobado `dpl_6cBqPuU5cM2cjyxz5MF33B9GEB9t`. Pendientes con autorización separada: cerrar las pruebas/retirar la clave específica, revisar configuración final y decidir publicación y activación. L3 y L6 confirmados por el propietario; deudas L1-DPA/C1/C2/L2/L4-RAT/L5 conservadas, no reabiertas. Los estados remotos siguientes son históricos: sus verificaciones no se han repetido durante este cierre local.

## Estado vigente — prueba real privada del 5 de noviembre de 2026

- El propietario exige probar antes de publicar producción y autorizó un único correo ficticio, de `contacto@exommethod.com` a `exommethod@gmail.com`.
- Preview protegida `https://exom-site-ivpi4jx5i-crolyx16-3282s-projects.vercel.app/`, despliegue `dpl_8N8SddKqUaNiZWcUepma4k66UaYj`: Chrome confirma «Solicitud enviada»; aceptación por Resend acreditada por el contrato del receptor. **El propietario confirmó la recepción en Gmail y señala `exom.method@gmail.com` como dirección preferida.** No se inspeccionó su bandeja ni se cambió el destinatario en código. No se repitió el clic aunque la herramienta de navegador agotó su espera; se comprobó primero el resultado visible.
- Nombre de prueba: `PRUEBA EXOM - DATOS FICTICIOS`; asunto: `EXOM · Nueva solicitud web`. Once respuestas ficticias; sin información médica ni contacto real de solicitantes. Campos obligatorios, bloqueo de menores y retroceso comprobados antes del envío.
- `test/formulario` existe en GitHub, idéntica a `main`, sin nuevos commits. Secret `EXOM_FORM_SECRET` y `RESEND_API_KEY` guardados por el propietario exclusivamente para esa rama Preview; clave de Resend específica `exom-form-test`. Valores no leídos; claves de producción preservadas. No implica inspección independiente de los permisos de la nueva clave en Resend.
- La copia externa del receptor admite solo esta prueba, desde su origen de Vercel, y las respuestas ficticias exactas. Clave de idempotencia fija entre instancias/sesiones; caducidad **5 de noviembre, 21:39:26 CET**, menor que las 24 horas de deduplicación de Resend. Pruebas con transporte simulado: concurrencia, reintentos, nueva sesión, caducidad y rechazo de configuraciones incorrectas. La API del repositorio mantiene su origen de producción y sus indicadores apagados; no incorporar el adaptador temporal a producción.
- T1-EDGE: regla activa de 5 intentos POST / 600 segundos / IP para `/api/solicitudes` y `/api/solicitudes/`, sin condición de host; protección de acceso Vercel mantenida. Se conserva la decisión de omitir la comprobación del reinicio del contador. No se añadieron bypass ni enlaces públicos.
- Producción no modificada, mismo despliegue y hash de portada. Pendientes: cerrar la prueba y retirar su clave específica. Ninguna autorización de publicación o activación de producción.

Las notas siguientes conservan el historial local anterior a esta prueba; las deudas legales y operativas aceptadas no se reabren. Evidencias y paquete aislado fuera del repo: `private-form-test/`.

**Actualización de empaquetado, 5 de noviembre de 2026:** versión pública local generada y comprobada según `release.README.md`. No desplegada ni activada. Se conserva el prototipo; los textos sin avisos de prueba se generan únicamente en `dist/`. Versión del aviso del receptor: `web-2026-11-05-v1`.

**Estado: receptor y pruebas locales operativos, correo real desactivado.** Se conservan los once campos, las opciones, los tres pasos y el diseño aprobado. Después de D114 se inspeccionaron Vercel y Resend con autorización de solo lectura. No se han leído secretos completos, cambiado cuentas, enviado correos ni publicado; V1/V2/V3, originales y sitio público permanecen intactos.

## Comprobarlo

Desde esta carpeta, con Node.js 22 o 24 (la cuenta Vercel está configurada en 24.x):

```text
node serve.cjs
node checks.cjs
```

La vista local es `http://127.0.0.1:4176/prototype-v4/`. Hay que reiniciar el proceso de `serve.cjs` si ya estaba abierto antes de D114: los archivos estáticos se releen, pero un servidor antiguo no incorpora la ruta POST. No detener procesos ajenos ni todos los procesos Node.

El servidor local **solo utiliza transporte simulado**, incluso si existen variables de Resend en el entorno. Usar datos ficticios. La confirmación dice que no se ha enviado correo; se vacían los controles únicamente tras esa confirmación. Los logs de pruebas deben guardarse fuera del repositorio.

## Recorrido y límites verificados

| Parte | Comportamiento |
| --- | --- |
| Navegador | Obtiene una sesión sin datos personales; valida cada paso; conserva respuestas durante errores y retroceso; solo envía mediante POST JSON al mismo origen. Sin persistencia del formulario en navegador. |
| Servidor | Valida tipos, once respuestas, opciones cerradas, exclusión de ocupación, edad entera 18–120, teléfono internacional y campos desconocidos. El cliente no puede elegir destinatario ni cabeceras. |
| Tamaños | Cuerpo de hasta 8192 bytes; nombre 100, país 80, objetivos abiertos 300 caracteres (unidades UTF-16), teléfono de hasta 32 caracteres antes de normalizar a 8–15 cifras con `+`. Lectura del cuerpo limitada a 5 segundos. |
| Antiabuso | Origen exacto, JSON, token firmado de 20 minutos con espera mínima de 3 segundos y campo trampa vacío. Ventana de 10 minutos: 30 peticiones y 3 intentos de correo por conexión; 20 intentos globales por proceso. Hasta 1000 entradas por mapa. No sustituye una defensa contra bots distribuidos. |
| Duplicados | Misma sesión y respuestas normalizadas comparten una promesa durante el envío y una confirmación posterior. Cambio de respuestas después de iniciar envío: conflicto, sin nuevo correo. Resend recibe clave de idempotencia y cuerpo estables, incluso al reintentar. |
| Respuesta perdida | Reintento con la misma sesión y datos. Si esa sesión caduca después de una entrega incierta, el cliente no genera una clave nueva: indica contactar con EXOM para evitar duplicados. No existe garantía de entrega exactamente una vez ni de conciliación automática. |
| Correo preparado | Destino fijo `exommethod@gmail.com`, asunto fijo «EXOM · Nueva solicitud web», remitente de configuración con nombre visible «EXOM», texto plano; ninguna respuesta se interpola en HTML, cabeceras o URL. Referencia aleatoria y versión del aviso en el cuerpo. Sin `reply-to` del usuario ni adjuntos. |
| Privacidad técnica | Sin logs de respuestas ni base de datos. Contadores y huellas HMAC en memoria, limpieza al llegar otra petición o finalizar el proceso; no almacenamiento persistente. No equivale al plazo de conservación de los correos. Los logs de los proveedores no se han inspeccionado. |

**Límite de infraestructura:** las cuotas y confirmaciones en memoria son por proceso y se reinician al reiniciarlo. No se presenta esto como límite global entre instancias. `T1-EDGE` exige verificar una protección compartida antes de habilitar producción; no se ha añadido otro proveedor, dependencia, base de datos ni servicio de pago. La idempotencia de Resend dura 24 horas según su documentación; el token de 20 minutos impide reutilizarlo fuera de esa ventana. El contrato de Resend se ha simulado, no probado contra su API real.

## Textos preparados, sin garantías inventadas

Primera capa, Privacidad y Aviso legal distinguen prueba local de flujo real preparado. Se mantienen las finalidades aprobadas D104/D105 y la revisión humana. Se describen Hobby, Resend Free, Gmail gratuito, WhatsApp normal, el reenvío de soporte Cloudflare y la copia iCloud declarada; el POST preparado no pasa por el alias de soporte.

El art. 6.1.b se indica para la solicitud precontractual; no se extiende artificialmente a la seguridad técnica, cuya base prevista 6.1.f y ponderación pendiente se separan. Se conserva el plazo acordado de 90 días desde el último intercambio real, sin afirmar borrado automático, archivo de bloqueo, revisión de cuentas o verificación de transferencias inexistentes. Los datos de identificación existentes del titular permanecen solo en el aviso, sin duplicarlos en documentación ni pruebas.

`L6` resuelto por confirmación del propietario: al preguntarle si su abogado indicó que debía mostrar algún número de registro profesional o autorización, responde «Si, no necesito mostrar nada». Se retiran el marcador y su enlace del aviso local, sin añadir números ni afirmar habilitaciones. Es consejo externo comunicado por el propietario, no un dictamen inspeccionado ni una validación jurídica independiente. **Los textos siguen siendo una preparación local** hasta verificar el funcionamiento real y retirar los avisos de prueba al publicar. Las secciones de privacidad de la App y sus fechas se conservan sin reinterpretarlas como auditadas.

## Seguimiento y alcance

La clasificación «no bloqueante por decisión del propietario» registra su alcance de trabajo; no certifica la legalidad ni cambia obligaciones legales o condiciones de proveedores. No se modifica el informe D100 ni la propuesta jurídica histórica.

| ID | Estado | Responsable / cierre pendiente |
| --- | --- | --- |
| T1-LOCAL | PASS | Receptor, validación, UI, transporte simulado y regresiones locales. |
| T1-EDGE | PENDIENTE antes de activar | Desarrollo: verificar límite compartido y cabeceras/origen en el entorno elegido. No aprobado por pasar pruebas por proceso. |
| T1-DEPLOY | PREPARADO Y PROBADO LOCAL; verificación remota pendiente | Raíz con build y salida `dist`, función raíz, recursos, CSP, canónicas www, `cleanUrls`, `trailingSlash`, sitemap/robots. `vercel.json` actualizado localmente; no desplegado ni comprobado en Vercel. Ver `release.README.md`. |
| T2 / P1 | NO EJECUTADO | Cuentas inspeccionadas en Chrome con permiso de solo lectura; prueba real al destino autorizado y despliegue quedan fuera de esta entrega local. |
| L1-DPA | APLAZADO, no bloqueante por decisión del propietario | Moi: migración a buzón con acuerdo de tratamiento; ninguna migración aprobada/ejecutada. No atribuir DPA a Gmail gratuito ni Hobby. |
| C1 | FUERA DE ALCANCE, no bloqueante por decisión del propietario | Moi: contratación antes de contratar. El formulario no contrata ni cobra. |
| C2 | FUERA DE ALCANCE, no bloqueante por decisión del propietario | Moi: representación antes de prestar servicio a menores. Ahora solo consulta general del adulto, no expediente ni contratación del menor. |
| L2 | FUERA DE ALCANCE, no bloqueante por decisión del propietario | Moi: conservación efectiva, copias, bloqueo y soporte cifrado. No configurados ni dados por implantados. |
| L4-TEXTOS | PREPARADO LOCAL | Avisos coherentes con código local y límites declarados; no habilita por sí solo publicación. |
| L4-RAT | FUERA DE ALCANCE, no bloqueante por decisión del propietario | Moi: actualizar/validar el RAT externo existente. No se ha tocado ni duplicado. |
| L5 | FUERA DE ALCANCE, no bloqueante por decisión del propietario | Moi/asesor: evaluación de riesgo/EIPD. No se ha determinado que no sea necesaria. |
| L3 | CONFIRMADO por el propietario, 2026-11-05 | Tras revisar la Preview, confirma «Las tengo» al preguntarle por las autorizaciones para mostrar fotos, vídeos y resultados de las personas de la web. No se han inspeccionado los documentos ni se emite validación jurídica independiente. Esta confirmación no autoriza por sí misma producción ni envíos. |
| L6 | RESUELTO por confirmación del propietario | Su abogado le ha indicado que no necesita mostrar número de registro profesional ni autorización. Marcador y enlace retirados; no se ha inspeccionado el dictamen ni se certifica el resto del aviso. |

## Configuración futura, no ejecutada

`api/solicitudes.mjs` es una entrada Web Request/Response de Node para Vercel. No está instalada en la raíz publicada ni se ha probado un despliegue. Por defecto devuelve 503 sin crear transporte. Solo podría activarse después de verificar configuración y alcance con:

- `EXOM_FORM_ENABLED=true` y `EXOM_FORM_EDGE_LIMIT_VERIFIED=true`. La segunda es una confirmación operativa, **no instala** un limitador ni acredita su existencia por sí sola.
- `EXOM_FORM_SECRET`: secreto aleatorio de al menos 32 bytes, sin comunicarlo por chat; se mantiene estable para validar reintentos entre instancias.
- `RESEND_API_KEY` y `RESEND_FORM_EMAIL`: nombres observados en producción. El segundo se conserva tal como aparece en Vercel, sin renombrarlo a `RESEND_FROM_EMAIL` ni a `EXOM_FORM_FROM`. El remitente previamente elegido es `contacto@exommethod.com`, sin el nombre visible en la variable: el adaptador añade «EXOM». El valor guardado sigue oculto y debe comprobarse antes de activar; no se ha demostrado que la clave oculta de Vercel sea la clave dedicada observada en Resend.
- Origen fijo `https://www.exommethod.com`, coincidente con producción: Vercel redirige el dominio sin `www` mediante 307 hacia `www`. La entrada rechaza el dominio sin `www`, las vistas previas y otros alias; no reenvía respuestas entre dominios. El navegador sigue enviando a su mismo origen. Las URL canónicas y el empaquetado público están preparados localmente en `T1-DEPLOY`; su funcionamiento efectivo en Vercel sigue pendiente.

El servidor local no usa ninguna de estas variables. La inspección posterior de Vercel/Resend fue de solo lectura, sin cambiar planes, DNS, claves o cuentas. Los dos indicadores de activación y el secreto de sesión siguen pendientes; no se generan ni activan en esta entrega.

### Inspección posterior y ajuste local

- Vercel `exom-site`: Hobby, repositorio `carsan-dev/exom-site`, producción desde `main`, raíz del repositorio, preset Other y Node 24.x. Sin reglas personalizadas de protección; el editor ofrece límite de peticiones, pero no se guardó ni se verificó su aplicación o coste. `T1-EDGE` permanece pendiente.
- Resend: dominio `exommethod.com` verificado, región Irlanda, clave `exom-site-form` con permiso de envío restringido a ese dominio y sin uso. Plan Free: 100 correos diarios y 3.000 mensuales compartidos con los otros servicios de la cuenta. No son cuotas exclusivas del formulario.
- Resend muestra TLS oportunista, no obligatorio. No se cambió: la configuración del dominio también puede afectar a otros servicios. La inspección no acredita entrega ni revisión contractual completa.
- Se ajustaron únicamente los archivos locales para aceptar el origen real con `www` y el nombre de variable existente. No se cambia el destino del correo ni se habilitan envíos.
- La entrada de producción se prueba en un proceso aislado, sin heredar credenciales, con variables ficticias, reloj controlado y toda llamada al proveedor sustituida por una respuesta simulada. La regresión falló antes del ajuste (503 en lugar de 200) y pasó después; comprueba además alias rechazados, menores, requisitos de activación, cabecera de plataforma y duplicados.

## Verificación y evidencias

- Ajuste posterior a la inspección: `checks.cjs` completo, **17 PASS en Node 22.21.0 y 17 PASS en Node 24.22.2**. Incluye `application-entry-checks.cjs` y HTTP local, siempre sin correo real. Node 24 se ejecutó desde una copia portátil oficial fuera del repositorio, contrastada con su SHA-256; no se instaló ni cambió PATH. No equivale a ejecutar en Vercel ni a una nueva revisión visual en navegador.
- Evidencia de este ajuste: subcarpeta externa `form-host-alignment/`, `regression-before.log` (FAIL), `regression-after.log` (PASS), `checks-node22.log`, `checks-node24.log`, instantáneas antes/después y manifiesto. El resto de esta sección documenta la verificación inicial D114.
- Baseline `checks.cjs`: PASS con HTTP local autorizado; primer intento restringido falló por EACCES, no por una aserción del sitio.
- `application-checks.cjs`: PASS, incluyendo cuerpo por fragmentos, UTF-8 inválido, lectura detenida, cupos/capacidad/recuperación, duplicados simultáneos, errores y transporte Resend simulado.
- `form-client-checks.cjs`: PASS, campos obligatorios, menores, tres pasos, errores, doble clic, reintento estable y expiración. Regresión de respuesta perdida + expiración: FAIL antes de corregir, PASS después.
- `application-http-checks.cjs`: PASS contra servidor real de loopback, incluido POST simulado, duplicados, menores, origen, tamaño, URL inválida y aislamiento de código interno.
- Suite `checks.cjs`: incorpora todas las anteriores y conserva las regresiones visuales/animaciones existentes. Los asserts de «demostración sin formulario» se sustituyen por tests del comportamiento autorizado; la paridad de las once preguntas y todas sus opciones sigue siendo exacta.
- Navegador: 1280×720 y viewport 390×844, bloqueo de 17 años, recorrido completo y confirmación simulada, sin desbordamiento horizontal. Inputs a 16px. Sin errores observados de consola en la comprobación de escritorio. Enlace de privacidad probado por teclado después de timeout del clic automático sobre texto multilínea; no se interpreta ese timeout como un fallo del sitio.
- No teléfono físico, Safari, red limitada, correo real, prueba contra Vercel, eliminación de datos ni verificación jurídica integral. Cambios posteriores de UI se limitan a la conciliación de una entrega incierta y están cubiertos por regresión; no se afirma una nueva inspección visual de ese estado excepcional.

Evidencias fuera del repo, carpeta de trabajo de este chat: `form-baseline.json`, `form-before/`, `form-checks-v4-final.log`, `form-http-checks.log`, `form-expired-regression-{before,after}.log`, `form-{desktop-success,mobile-step2,mobile-success,privacy-mobile}.png`, manifiesto y parches finales. No contienen copias del NIF/domicilio: el antes del aviso y su parche están redactados.

## Referencias verificadas el 4 de noviembre de 2026

- [Funciones Node de Vercel](https://vercel.com/docs/functions/runtimes/node-js), [cabeceras de Vercel](https://vercel.com/docs/headers/request-headers).
- [API de correo Resend](https://resend.com/docs/api-reference/emails/send-email), [idempotencia](https://resend.com/docs/dashboard/emails/idempotency-keys), [tratamiento y retención](https://resend.com/security/gdpr).
- [Condiciones Hobby](https://vercel.com/docs/plans/hobby), [DPA Vercel](https://vercel.com/legal/dpa), [Gmail de consumo](https://support.google.com/policies/answer/9581826?hl=es).
- [RGPD](https://www.boe.es/buscar/doc.php?id=DOUE-L-2016-80807).
- [Node.js 24.22.2 oficial](https://nodejs.org/dist/v24.22.2/), [sumas SHA-256](https://nodejs.org/dist/v24.22.2/SHASUMS256.txt).
