# Correo del formulario — preparación local

## Estado — 5 de noviembre de 2026

Plantilla HTML probada con un único correo ficticio en Preview protegida `exom-site-7oo2zn1b2-crolyx16-3282s-projects.vercel.app` (`dpl_EhjhDYSgo7PZQnu88rAWkj8DKvBs`). El propietario confirmó en Gmail: «lo muestra perfecto». Producción y formulario público no se modificaron. Se conservan la alternativa de texto anterior, las once respuestas, asunto, destinatario y remitente. El adaptador temporal de esa prueba vive fuera del repo: no promover esa Preview ni copiarlo al paquete final.

El propietario confirma que ya añadió el logo a su contacto de Gmail, desde otro equipo. No se verificó su bandeja de forma independiente; no es un avatar público garantizado para otros destinatarios. Sin cuenta nueva, compra de certificado ni cambio DNS. Las notas de preparación siguientes conservan el historial anterior a estas confirmaciones.

- Fondo oscuro, blanco y lima de EXOM; una columna de hasta 600 px, tablas y estilos en línea, sin dependencias nuevas.
- Cabecera aprobada con símbolo blanco/lima y tipografía real Barlow Condensed 800 de la web. `assets/email-header.png`: 1104 × 380, 66.155 bytes; se muestra hasta 552 × 190 y se adapta al ancho disponible. Se adjunta como imagen interna `cid:exom-header`, sin cargas remotas. `assets/email-exom.png` se conserva como recurso de origen; los iconos de la raíz no cambian.
- Todas las respuestas y la referencia se escapan antes de entrar en HTML. Ningún dato del solicitante se incorpora a atributos, direcciones, cabeceras o enlaces. Los saltos de línea se conservan y los reintentos generan el mismo contenido.
- `createResendTransport` envía `text`, `html` y el PNG adjunto, conforme a la [API de Resend](https://resend.com/docs/api-reference/emails/send-email) y su [documentación de imágenes internas](https://resend.com/docs/dashboard/emails/embed-inline-images).
- El destinatario técnico sigue siendo `exommethod@gmail.com`; el propietario confirmó recepción y prefiere escribirlo `exom.method@gmail.com` (misma bandeja personal Gmail). El remitente sigue siendo `contacto@exommethod.com`.

## Verificación y límites

`application-checks.cjs`, `checks.cjs` y `release-checks.cjs`: PASS. Cobertura de escape, igualdad del texto anterior, once respuestas en HTML, acentos/saltos, entradas largas, imagen PNG, transporte simulado, reintentos idénticos y controles existentes. Node File Trace local incluye el nuevo PNG en las dependencias de la función, sin advertencias.

Chrome: muestra ficticia a 1440 y 390 px; logo visible, sin desbordamiento. Entradas largas también comprobadas a 320 px. Posteriormente se envió la prueba real y el propietario aprobó el resultado en Gmail. Outlook, otros clientes/modos oscuros y dispositivos no comprobados.

Evidencia externa en `email-branding/`: copias anteriores de los dos módulos, mensajes HTML/texto ficticios, capturas, logs y `trace.json`. La página de muestra sustituye únicamente `cid:exom-header` por una ruta local para visualizarlo en el navegador.

**Próxima preparación de Preview:** incluir `REDESIGN/prototype-v4/assets/email-header.png` entre las fuentes del servidor. El generador histórico externo de paquetes copia los recursos leídos por el constructor público y una lista fija de módulos; no detecta por sí solo este nuevo adjunto. El PNG no es un recurso público de `dist`. Verificar el inventario contra `trace.json` antes de cualquier subida autorizada. No modificar ni reutilizar la prueba temporal de correo ya consumida.

## Fuente — cabecera aprobada e implementada en local

El propietario aprobó convertir solo la marca y cabecera en imagen. Usa el archivo real `assets/barlow-condensed-800.ttf`, no una fuente de sustitución. Las respuestas siguen siendo texto Arial/Helvetica seleccionable, con el mismo contenido y alternativa de texto anterior.

La imagen tiene el texto alternativo «EXOM. Nueva solicitud. Un nuevo punto de partida.» dentro de un encabezado. La frase explicativa y las once respuestas no dependen de cargar imágenes. Las pruebas comprueban este texto alternativo, el CID y dimensiones del adjunto.

Generación con ImageMagick instalado: lienzo 1104 × 380, fondo #191b19; símbolo 120 × 112 en +0+10; marca construida con etiquetas E/X/OM en Barlow 112, colores #f2f1e9/#baf23a/#f2f1e9, en +144+0. Títulos Barlow 96 en +0+176 (blanco) y +0+272 (lima), gravedad northwest. Usar rutas de fuente con barras / en Windows: las barras invertidas hicieron que ImageMagick no encontrase la fuente en el primer intento; ese resultado se descartó y se regeneró correctamente. Los textos completos caben: la línea más larga mide 1048 px de los 1104 disponibles.

Revalidación: application-checks, checks y release-checks PASS; Node File Trace incluye email-header.png sin advertencias. DOM de Chrome a 1440 y 390 px confirma imagen cargada y sin desbordamiento; una página local con imagen deliberadamente ausente conserva el encabezado accesible y todas las respuestas. Se inspeccionó visualmente el PNG. La captura del correo en Chrome falló por tiempo de espera; no se presenta como comprobación visual final del cliente de correo. Las capturas anteriores en email-branding/ corresponden a la versión Arial, no a esta cabecera. Pendiente envío real autorizado y revisión en Gmail/móvil físico.

## Logo junto al remitente — investigado, no configurado

El logo del mensaje no modifica el avatar que el destinatario ve junto a `contacto@exommethod.com`.

- Google permite [crear una cuenta con una dirección externa](https://support.google.com/accounts/answer/27441?hl=es) y configurar una [foto de perfil](https://support.google.com/mail/answer/35529). Podría explorarse esa vía para la dirección exacta del remitente, sin cambiar el proveedor de envío. No se ha comprobado si esa cuenta existe ni se garantiza que Gmail utilice su foto para mensajes enviados por Resend.
- Para la identidad de marca mediante BIMI, [Google exige certificados VMC o CMC y configuración del dominio](https://knowledge.workspace.google.com/admin/security/set-up-bimi). [Resend explica sus requisitos y certificados de pago](https://resend.com/blog/email-changes-for-bimi). No se ha comprado, creado ni cambiado nada; no se modifica DMARC para resolver un avatar sin autorización y revisión del correo existente.

Pendientes actuales: cierre de las pruebas y retirada de su clave específica, revisión final de configuración de producción y autorización separada para publicación/activación. El correo ya está aprobado y el avatar personal configurado según el propietario. No se reabren proveedores ni riesgos aceptados.
