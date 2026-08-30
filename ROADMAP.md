# Roadmap — Mareia

> Terminado = ~200–300 puertos españoles con página completa (mareas + coeficiente + sol/luna +
> solunar + meteo) desplegada en producción, transparente (metodología, QC y dataset abiertos) y con
> los gates del enjambre en verde. No apto para navegación, no comercial, AGPL-3.0.

## Hito 1 — Cimientos (scaffold + dominio)

- [x] T-01 · Monorepo (Astro web + API Deno/Express + packages) con los 4 gates en CI
- [x] T-02 · Motor de mareas TS (suma armónica + correcciones nodales) con golden tests
- [x] T-03 · Astronomía + solunar (Astronomy Engine, periodos 2+2 y rating)
- [x] T-04 · Coeficiente de mareas (Brest, U = 3,05 m)
- [x] T-06 · Contrato de módulo `AppModule` + registries + test de capas

## Hito 2 — Datos y API

- [x] T-05 · Pipeline Python → JSON canónico (`station/v1`) para 12 puertos piloto con QC vs IOC
      (Portus no publica constantes por vía automatizable; ver el informe QC)
- [x] T-07 · Endpoints core (`tides`, `astro`, `solunar`, `almanac`, `ports`) con contract tests
      (el de coeficiente se añade cuando merjee T-04)
- [x] T-08 · Módulo weather backend (Open-Meteo + AEMET + caché Deno KV)
      (los códigos de zona costera de AEMET quedan sin verificar hasta que haya `AEMET_API_KEY`;
      la caducidad de esa clave se vigila sola y avisa a 21, 7 y 1 días)
- [x] T-18 · La credencial de AEMET deja de publicar el manual del operador en el borde público
      (fix forward de T-08): la respuesta HTTP lleva el hecho —estado, caducidad, días, procedencia—
      con una frase neutra, y la instrucción completa se queda en el canal de quien puede renovarla
      (`aemet-key.yml`). Con gate que mira la **respuesta entera serializada** en los cinco estados
      de la credencial, no un campo, porque el defecto se mueve de campo
      (pase adversario cerrado: los 4 hallazgos arreglados y sus 7 ataques como gate permanente
      —5 sobre el cuerpo HTTP y 2 sobre la pantalla— más 7 recorridos que no vienen de un hallazgo
      (6 `GATE ·` del punto ciego, los fixtures y el borde; 1 `LÍMITE ·`): la frase pública dice el
      estado de la credencial y no una consecuencia que la caché desmiente, el texto que escribe
      AEMET se filtra en el borde antes de llegar al JSON y a la pantalla, un `exp` que no es una
      fecha degrada a `unreadable` en vez de devolver un 500, y `daysLeft` cuadra con el `expiresAt`
      que viaja a su lado; ver `docs/qa/informe-adversario-t18.md`)
      (rechazo del verificador atendido: el filtro del borde casaba texto crudo y fallaba contra sus
      propias señas —`NFD`, guion, ancho cero, dominio partido—, y «la única puerta hacia el
      `reason`» no era una sino dos. Ahora el texto se sanea antes de casar, la rama sin zona
      marítima también pasa por `reasonFrom`, las cinco variantes son casos del gate y lo que la
      lista negra NO cubre —las codificaciones— está dicho y tiene recorrido propio)
      (residuo R-1 cerrado: `scripts/check-aemet-key.ts` —lo que el operador lee dentro del issue—
      ya tiene siete recorridos que lo **ejecutan**, y un job de CI que los corre)

## Hito 3 — Portal (10 puertos piloto)

- [x] T-09 · Página de puerto SSG (tabla + gráfico + coeficiente + sol/luna) + índices geográficos,
      con canónicas, sitemap y JSON-LD (la medida Lighthouse SEO ≥ 95 queda pendiente de T-15: no
      hay navegador en CI; el comando está documentado en `apps/web/design-brief.md` §8)
- [x] T-11 · Módulo weather UI (isla meteo con estados ok/stale/no disponible/carga sin datos)
      (el HTML construido no lleva ninguna magnitud meteo: entra por isla y con sello de antigüedad,
      ver `docs/adr/ADR-01`; el boletín de AEMET se cita con su esquema aún sin verificar)
      (pase adversario cerrado: los 7 hallazgos arreglados y sus 13 ataques como gate permanente —
      el sello envejece con la pestaña abierta, un 200 hostil no deja la sección pidiendo para
      siempre y el trinquete de ADR-01 ya ve los atributos sin comillas y los comentarios;
      ver `docs/qa/informe-adversario-t11.md`)
- [x] T-10 · Módulo pesca UI (overlay solunar + rating), primer módulo que aporta interfaz por el
      contrato `AppModule` (el rating se publica como convención declarada, con su desglose y el
      aviso de que la teoría solunar no tiene respaldo experimental sólido)
- [x] T-12 · PWA offline (almanaque de favoritos sin red): service worker + manifiesto instalable,
      favoritos en IndexedDB (cero cuentas, cero servidor) y **cálculo de cualquier día en el
      navegador** con las constantes armónicas del puerto y el motor de `domain-core` — no es un
      caché de páginas. Un favorito guarda **constantes** (2,6 kB) y no el almanaque del año
      (49,2 kB): 18,6× menos y sin tope de año. La política de actualización del worker está en
      `docs/adr/ADR-02` (HTML `network-first` con `cache: "no-store"`, sin `skipWaiting`, sin banner)
      (pase adversario cerrado: los 4 hallazgos arreglados y sus 6 ataques como gate permanente — el
      sello mira los dos almacenes y ya no promete una copia que no está, la poda exige un censo
      completo, la app instalada guarda su puerta de entrada y sin cobertura no se ofrece borrar el
      almanaque que se está leyendo; ver `docs/qa/informe-adversario-t12.md`)

## Hito 4 — España completa y transparencia

- [x] T-13 · **153 puertos** con grade ≥ B o flag «estimado» (8 A · 15 B · 130 C; 120 estimados)
      · La horquilla de 200-300 **no se alcanza y es un hecho medido, no un recorte**: el catálogo
      se deriva del volcado público de GeoNames y la cornisa cantábrica está poco documentada ahí
      (Asturias 2 puertos, Cantabria 3, Lugo 2, Gipuzkoa 2). 19 candidatos más se descartan por no
      tener mareógrafo a menos de 60 km —toda la Costa Brava—, con su lista en el informe QC.
      Subir de ahí pide una segunda fuente de topónimos portuarios, no relajar el filtro.
      (pase adversario cerrado: 3 de los 4 hallazgos arreglados y sus recorridos como gate
      permanente — el detector de curva congelada mira **todas** las mesetas del día y no sólo la
      más larga (65 de 153 puertos admitían una congelación invisible), su prueba de sensibilidad
      elige la ventana en vez de bajar el umbral (enrojecía 33 días de cada 365 sin avería) y las
      cifras que justifican la estimación se publican en español (130 páginas, 283 ocurrencias).
      **A-20 queda abierto con trinquete** y escalado al rol `seguridad`: la procedencia del error
      medido es autodeclarada y ningún puerto real está afectado hoy;
      ver `docs/qa/informe-adversario-t13.md`. El `verificador` rechazó el primer intento porque el
      recorrido de A-17 medía con una **copia** del detector y no trinqueteaba —estrechar el gate
      real lo dejaba verde—: el detector vive ahora en `apps/web/src/curva-congelada.ts` y lo
      importan los dos ficheros, comprobado en rojo con los 65 puertos)
- [x] T-14A · **La licencia del dataset dice la verdad.** El README anunciaba «dataset CC-BY 4.0» y
      atribuía las constantes a REDMAR, TICON-4 y FES2022. Contado sobre las 153 estaciones: **104
      son `cc-by-nc-4.0` y 49 `cc-by-4.0`** —la mayoría es NC, no «algunas»— y de REDMAR y FES2022
      **no sale ni un dato**, mientras que `openwatersio/tide-database` (153) y `GeoNames` (141),
      que sí se usan, no se acreditaban en ningún sitio. Ahora el reparto va con su cifra, la tabla
      de fuentes es **exactamente** el conjunto usado y las descartadas se nombran con su motivo
      fuera de la atribución. Y el permiso de redistribución pasa a ser un **filtro delante del
      rango** en `reconcile.py`: REDMAR tenía la máxima prioridad de fuente y sus condiciones
      prohíben transferir los datos a terceros. Ningún dato publicado cambia; lo que cambia es que
      ya no puede colarse. Dos gates lo sostienen: uno **recomputa** cifra y conjunto desde los JSON
      y exige igualdad exacta (sobrar y faltar dan mensajes distintos), y otro **inyecta** una
      fuente impublicable con rango 0 y exige que pierda — los cuatro comprobados en rojo
- [x] T-14B · **La calidad deja de ser un dato que hay que ir a buscar.** El grade y el flag
      «estimado» se publicaban bien en la ficha y no estaban en los dos sitios donde se **elige**
      puerto, así que los 153 se presentaban como si valieran lo mismo —y **120 son estimados**.
      Ahora `GET /v1/ports` lleva `quality` (`grade`, `estimated`, `rmse_m`, `hw_time_err_p95_min`,
      con los `null` intactos): filtrar el catálogo pasa de **153 peticiones a una**. Y la portada lo
      dice en cada entrada («Almería · estimada»), **horneado en el HTML**, con filtro por calidad de
      **cero bytes de JavaScript** —tres radios y reglas de hermano en CSS, no una isla: la portada
      conserva su cero scripts—. No se inventa escala, no se reordena la lista (la geografía sigue
      mandando) y los umbrales de cada grade se publican con su cifra en `apps/api/README.md`. Tres
      gates que recomputan desde el catálogo y **nombran el puerto** que falta, comprobados en rojo,
      uno de ellos en un navegador con el JavaScript apagado. **Cerrado tras el pase adversario**:
      la señal alcanza también las **12** páginas de región y las **24** de provincia —eran 306
      entradas mudas y el último clic antes de la ficha se daba a ciegas—, y el contrato del API
      explica los dos `null` de `hw_time_err_p95_min` con su motivo y su cifra (118 sin observación,
      13 micromareales medidos), con gates que atan el **significado** y no la presencia
- [x] T-19 · **Tallas mínimas por caladero, dichas como las dice la norma.** La página de puerto
      publica las **118** tallas del RD 560/1995 (texto consolidado `BOE-A-1995-8639`): **53** del
      Anexo I, **34** del II y **31** del III, con la fecha de la redacción en vigor, el día en que
      una máquina comprobó la vigencia y el enlace ELI. Los **153** puertos declaran su caladero
      (**47** cantábrico-noroeste-y-golfo-de-Cádiz · **80** mediterráneo · **26** canario), y doce se
      curan a mano con su motivo publicado porque Cádiz es la única provincia que cruza el límite
      entre dos caladeros. El parser selecciona la **versión en vigor** por `fecha_vigencia` y aborta
      si el bloque no trae ninguna: leer el bloque entero mezclaría las tres redacciones apiladas y
      publicaría en el caladero canario seis cifras derogadas, **cinco del lado que multa**. `talla`
      es una **unión cerrada de cinco clases** —17 de las 118 no son un entero de centímetros— y se
      publican las cinco como lo que son, incluido el `1 1` de la boga, que **no se corrige**. Las
      **9** especies con excepción llevan la nota **entera y pegada a la cifra**, no en un pie: la
      lubina son 36 cm salvo en las divisiones 8a/8b del CIEM —los puertos cantábricos de aquí—,
      donde son 44. Entra por el contrato `AppModule` como módulo propio (`ModuleId` se amplía a
      cuatro), en `static` y con **cero JavaScript**; ver `docs/adr/ADR-03`, hermano de ADR-01 para
      el dato que no caduca pero se deroga. G2 vigila la vigencia a diario con **tres desenlaces**
      (verde escribe el sello, rojo rompe CI, ámbar no toca la fecha y la página degrada sola: dos
      umbrales con nombre —**7** días y **60**— y tres estados que cambian lo que se publica, no
      solo el rótulo). El pase adversario cazó **cinco** roturas, **tres de ellas afirmaciones
      falsas**; se arreglaron cuatro y la quinta se documentó como tradeoff en el ADR: **G4**
      regenera las 118 cifras desde la fuente capturada y las diffea (G3 miraba 6), **G5** impide
      publicar un cero, el aviso de sin-red dice ahora **su condición** y la excepción balear **se
      resuelve** en los 17 puertos que excepciona y en los 63 que no
- [x] T-21 · **Las áreas marinas protegidas que tienes al lado, y ninguna geometría en el móvil.**
      La página de puerto publica los espacios marinos protegidos a menos de **30 km** con su nombre
      oficial, su figura y su distancia: **143 de 153** puertos tienen alguno —**342** relaciones
      salidas de las **86** áreas de RAMPE 2025 (MITECO)— y los **10** que no tienen ninguna **lo
      dicen**, con el radio a la vista, en vez de perder la sección. Se hace **la mitad defendible**
      del encargo «zonas de pesca y zonas prohibidas»: dónde **no** se puede, que tiene fuente
      oficial; dónde sí no se publica porque no hay fuente, y el aviso de que **la ausencia de área
      protegida no es un permiso** va antes de la lista en las 153 páginas, con un gate que busca en
      el `dist/` ocho maneras de sugerir lo contrario. La distancia es al vértice más cercano y por
      eso se publica como **cota entera** («a menos de 9 km»), nunca como una medida. Entra por el
      contrato `AppModule` como módulo propio (`ModuleId` se amplía por segunda vez, a cinco), en
      `static`, **cero JavaScript** y con **`order: 12`: la primera de las secciones de módulo**,
      porque es una advertencia y no una consulta (ese orden manda entre módulos, no sobre los
      bloques del core: se lee justo después del dato de marea, no como un banner). **Ni un vértice cruza a `dist/`** —la
      licencia de la fuente no está declarada en origen y se publican hechos derivados, no
      geometrías—, y el hueco de licencia se publica con esas palabras. Gate P3 comprobado en rojo
      con dos mutaciones (quitarle la frase a la rama vacía y esconder la sección en los 10 puertos)
      · el pase de `qa-adversario` y sus trinquetes se anotan aquí al cerrarlo, como en T-11/T-19
- [ ] T-14 · Metodología pública + QC navegable + dataset con su licencia por puerto declarada
      (el reparto real ya publicado en T-14A) + API pública documentada
- [ ] T-15 · Deploy en producción (Dokploy) + e2e + pase adversario
      · **La web ya está hecha, en T-17**: `apps/web/Dockerfile` construido y probado con `curl`
      (rutas de directorio, 301 a la barra final, 404 con el cuerpo de `404.html`, y ninguna URL del
      dominio contestando con una página ajena al portal), sirviendo en `0.0.0.0:3000` sin root, sin
      toolchain en la imagen y con las bases fijadas por digest — ver `docs/despliegue.md`, que
      incluye por qué **no** se escucha además en el 80.
      · **El API ya está hecho**: `apps/api/Dockerfile` (dos etapas, base por digest, 118,5 MiB de
      los que 104,4 son la base; sin node/npm/pnpm/corepack, sin `node_modules` y sin `__tests__`),
      permisos acotados como `deno.json` y **escucha comprobada contra el kernel** —`/proc/net/tcp`
      dentro del contenedor: `0.0.0.0:8787` y `0.0.0.0:8788` en LISTEN, uid 1000— y desde otro
      contenedor de la misma red, que es lo que hace Traefik. **`/health` fuera del enrutado
      público**, cortado en el código (dos servidores, el interno en el 8788 sin exponer) *y* en el
      dominio, con el 404 idéntico al de cualquier ruta inventada. **Volumen de Deno KV** por
      `MAREIA_KV_PATH`, medido: 288 entradas y **4,1 MiB** tras un ciclo de 153 puertos, estable en
      los tres siguientes, y la caché sobrevive al reinicio. **Rebuild diario** montado, con escrito
      de qué depende (sin él la normativa fechada de T-19 no puede degradar). **`actionlint` +
      `hadolint` sobre los dos Dockerfiles + `shellcheck` arreglado** (SC2046 real en el paso de
      T-17) y **`corepack` hermético** con hash de integridad. **e2e contra producción** que corre
      sin navegador y sin haber desplegado.
      · Quedan **el despliegue en sí** (aplicación en Dokploy, volumen, `AEMET_API_KEY`), lanzar el
      e2e contra el dominio y el **pase adversario de despliegue**.

## Fase 2 (rumbo, sin comprometer)

- [ ] App móvil (shell Capacitor) con widgets de pantalla de inicio (iOS WidgetKit / Android
      Glance) — spec v1 cerrada en `docs/espec-widgets-pwa-capacitor.md` (T-16)
- [ ] Módulo navegación (carta OSM seamark, batimetría GEBCO/EMODnet, AIS)
- [ ] Módulo pesca ampliado (especies GBIF/OBIS, vedas/tallas por CCAA curadas)
- [ ] Cobertura internacional (NOAA EEUU, FES2022 global)
