# App V4 · D92

**Preview actual autorizada:** [ver el ajuste de escritorio](https://exom-site-bl88t61lg-crolyx16-3282s-projects.vercel.app/app/#pelicula). Incluye la separación reducida a 115 px, con acceso protegido, formulario apagado y producción intacta. No se ha repetido la comprobación visual en Chrome porque no está disponible; el vídeo mantiene la aprobación anterior. La nota local siguiente describe la preparación previa.

**Ajuste posterior aprobado, solo local:** separación entre el bloque del vídeo y las funciones reducida de 175 a 115 px para anchos desde 901 px (45 px debajo y 70 px encima). Móvil conserva 100 px y tablet no cambia. Tamaño, encuadre, reproducción y archivos de vídeo intactos. Build y suites general/del paquete PASS; no nueva revisión visual en Chrome. La Preview `owcd6jnbp` todavía conserva la separación anterior.

Página independiente de presentación de la app. Conserva la estética V4, las versiones anteriores y los medios originales. **App D92 aprobada visualmente por el propietario el 4 de noviembre de 2026**, al igual que Historia D84. La aprobación sustituye el estado pendiente anterior; no autoriza publicación ni acredita pruebas en un teléfono físico. Los cambios compartidos autorizados se indican en el alcance.

## Abrir y comprobar

- Vista local: http://127.0.0.1:4176/prototype-v4/app.html
- Servidor existente: `node REDESIGN/prototype-v4/serve.cjs`
- Pruebas de la app: `node REDESIGN/prototype-v4/app-page-checks.cjs`
- Regresión V4: `node REDESIGN/prototype-v4/checks.cjs`

La suite completa V4 pasó en D91. Tras el refinamiento del marco en D92 pasó la suite específica de App; no se repitió la suite completa. D92 se revisó en escritorio a 1440 × 900 y viewport móvil de 390 × 844; 320 × 740 corresponde a revisiones anteriores. Esto NO equivale a probar un teléfono físico.

## Composición y movimiento

Hero con Portada, Entreno y Logros; espacio audiovisual horizontal; entrenamiento/alimentación/evolución/seguimiento y acceso para clientes separado del inicio del acompañamiento. Se reutilizan siete capturas distintas sin alterar los originales. Evolución conserva la gráfica; Seguimiento incorpora Recap. La captura de Fotos Progreso queda fuera por su presentación poco legible.

Tipografía, colores, logotipo, fuentes y GSAP locales de V4. Del dossier se adaptan la jerarquía tipográfica/audiovisual de Gotham, las capas de Lando y la progresión narrativa de ARCHON/ATLAS, sin copiar sus composiciones.

GSAP anima la entrada, la apertura del marco audiovisual y el cambio de pantallas al desplazarse. En escritorio, un marco fijo inspirado en un iPhone contiene las capturas, que se deslizan horizontalmente sin salir de la pantalla. El marco está dibujado en CSS, sin imágenes nuevas ni modelo 3D pesado. Las cuatro pantallas y la barra comparten una sola timeline: cada pantalla ocupa un cuarto del recorrido, con transiciones centradas en 25%, 50% y 75%. El contador cambia en esos mismos puntos. La barra termina después del tramo de lectura de Recap, sin alargar el scroll total. Los valores iniciales se fijan también en el tiempo cero para restaurar correctamente el inicio tras invertir o invalidar la secuencia.

En móvil las funciones aparecen en flujo vertical, cada captura con el mismo marco, sin recorrido fijado. Pausar efectos, movimiento reducido o JavaScript ausente mantienen todo el contenido accesible. Sin desplazamiento secuestrado, nuevas dependencias, formularios ni llamadas de datos.

D92 refina únicamente el teléfono: isla dinámica con detalle de cámara, borde metálico con bisel fino y botones laterales. La isla ocupa una zona superior reservada para no cubrir las capturas. Los detalles son decorativos y están ocultos a tecnologías de asistencia. Se mantienen intactos el deslizamiento interior y los cuatro tramos iguales de D91.

## Vídeo recibido — integración local del 5 de noviembre de 2026

**Aprobación posterior:** el propietario confirma que el vídeo está perfecto en su móvil y da su visto bueno. Escritorio local revisado con reproducción completa; captura y archivos idénticos al paquete desplegado comprobados de nuevo, sin defecto observado. Chrome no disponible para repetir la prueba remota autenticada. Las menciones de revisión móvil/aceptación pendiente de abajo son históricas; Safari y red limitada siguen sin comprobar. No implica permiso de producción.

**Actualización:** el propietario autorizó después una nueva Preview protegida para verlo desde el móvil. Está en [esta versión](https://exom-site-owcd6jnbp-crolyx16-3282s-projects.vercel.app/app/#pelicula), con formulario apagado y producción intacta. La revisión móvil sigue pendiente; las pruebas descritas debajo fueron locales. Detalles en `release.README.md`.

El propietario entregó las versiones finales de `REDESIGN/video/renders/launch/`. Se restaura `#pelicula` y su enlace «EXOM por dentro»: horizontal 1920 × 1080 en escritorio y vertical 1080 × 1920 hasta 600 px, sin recortar el contenido. Los testimonios de la landing siguen ocultos; este cambio solo restaura el vídeo de App.

Reproductores nativos con controles, `playsinline`, `preload="none"` y póster. Reproducción manual y sonido inicialmente silenciado; el visitante puede activarlo. Contiene música y textos en pantalla, sin narración. No se añaden servicios externos ni reproducción automática. El vídeo que queda oculto al cambiar de tamaño se pausa; ambos se pausan al ocultar la pestaña, sin reanudación automática.

| Versión MP4 | Entrega original | Copia web | Resolución / cadencia |
| --- | ---: | ---: | --- |
| Horizontal | 10.453.553 bytes | 4.916.340 bytes | 1920 × 1080 / 30 fps |
| Vertical | 10.419.493 bytes | 4.939.150 bytes | 1080 × 1920 / 30 fps |

Ambas conservan los 1.330 fotogramas, unos 44,33 segundos y el audio AAC idéntico al entregado. H.264, dos pasadas desde los masters, preset slow, 740 kb/s y cabecera al principio del archivo. **Es compresión con pérdida, no una copia idéntica píxel a píxel.** VMAF medio frente al MP4 entregado: 95,56 horizontal / 94,82 vertical; estos valores no sustituyen la aprobación visual del propietario. Originales MP4, WebM, masters y pósteres conservados. Solo las copias MP4 se usan en la web; pósteres WebP al 80 (51.260 / 64.002 bytes), sin cambiar dimensiones.

Chrome local: horizontal reproducido hasta el final; vertical probado a 390 × 844 con avance real, sin error de reproducción ni desbordamiento. Volver a escritorio pausa el vertical. La alternativa oculta no había cargado vídeo antes de usarla. Evidencias externas en `app-film-integration/`: codificación, hashes, comparación de los 1.330 fotogramas, fotogramas de peor puntuación y capturas de la página. **Pendiente revisión del propietario y prueba del nuevo vídeo en teléfono físico/Safari/red limitada.** No está publicado.

Tras integrar el vídeo: build, suite general, pruebas de App y del paquete PASS con Node.js 24.22.2. La navegación comprueba ahora 11 capturas de App (las tres del espacio provisional se sustituyen por el vídeo); el resto conserva las mismas pantallas. El paquete final y sus límites están en `release.README.md`.

## Alcance y pendientes

- Archivos propios: `app.html`, `app-page.css`, `app-page.js`, `app-page-checks.cjs` y este documento. El README general conserva el contexto D84 con el estado de aprobación actualizado; el manifiesto D84 permanece intacto.
- D86: cabecera común aplicada a landing, Historia y App: El método · Mi historia · La app · Empezar; logo al inicio, página actual indicada y menú móvil. Capturas recortadas visualmente 90 px superiores, sin modificar originales.
- D93: el pie enlaza Ayuda, Privacidad y Eliminar datos de V4, aprobadas visualmente el 4 de noviembre de 2026; el enlace de ayuda de acceso apunta a `support.html`. Sin cambios en la presentación ni animaciones aprobadas de App. Ver [utility-pages.README.md](utility-pages.README.md).
- Enlaces de instalación heredados de la página pública existente, sin verificar su disponibilidad externa. Android conserva la indicación de programa de pruebas; la cuenta la crea el entrenador.
- Pendientes actuales: aprobación del nuevo vídeo integrado y comprobación en teléfono físico, Safari y red limitada; la disponibilidad externa de los enlaces de tiendas sigue sin verificar. La aprobación anterior del resto de App se conserva. Sin publicación ni operaciones Git de escritura.
