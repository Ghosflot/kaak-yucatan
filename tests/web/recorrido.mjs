// Graba el recorrido de la página para el PR, con subtítulos dentro de la página (?subtitulos=1).
// Uso: node tests/web/recorrido.mjs <nombre> [portada|temporada|fechas|pulido|revision]
//   →   videos/<nombre>-escritorio.mp4 y videos/<nombre>-telefono.mp4
//
// Cada cuadro sale de Chrome en JPEG de alta calidad (el teléfono, a doble resolución) y ffmpeg lo
// codifica en H.264: el grabador de Playwright comprime tanto que el texto se ve pixelado.
// Necesita ffmpeg con libx264 (KAAK_FFMPEG=<ruta> si no está en el PATH); KAAK_WEB=<carpeta> graba
// otra carpeta web/ (por ejemplo, la de una rama anterior); KAAK_CRF ajusta la calidad (20 por omisión).
//
// En el PR, el video se sube con `gh pr edit --attach` (gh 2.99 o más nuevo) o con el endpoint
// user-attachments; solo así GitHub muestra su reproductor con barra de tiempo.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const NOMBRE = process.argv[2] || 'recorrido';
const RECORRIDO = process.argv[3] || 'temporada';
const WEB = process.env.KAAK_WEB || path.join(RAIZ, 'web');
const FFMPEG = process.env.KAAK_FFMPEG || 'ffmpeg';
const CRF = process.env.KAAK_CRF || '20';
const PUERTO = 8793;
const BASE = `http://127.0.0.1:${PUERTO}`;
const VIDEOS = path.join(RAIZ, 'videos');
mkdirSync(VIDEOS, { recursive: true });

const servidor = spawn('python3', ['-m', 'http.server', String(PUERTO), '-d', WEB, '--bind', '127.0.0.1'], { stdio: 'ignore' });
process.on('exit', () => servidor.kill());
await new Promise((r) => setTimeout(r, 800));
const navegador = await chromium.launch(process.env.KAAK_CHROME === '1' ? { channel: 'chrome' } : {});

// Junta los cuadros con la duración real de cada uno y los codifica a 30 cuadros por segundo.
function codificar(cuadros, fin, carpeta, destino) {
  const lineas = [];
  cuadros.forEach(([archivo, t], i) => {
    const siguiente = i + 1 < cuadros.length ? cuadros[i + 1][1] : fin;
    lineas.push(`file '${archivo}'`, `duration ${Math.max(0.001, siguiente - t).toFixed(3)}`);
  });
  lineas.push(`file '${cuadros[cuadros.length - 1][0]}'`); // ffmpeg ignora la duración del último si no se repite
  const lista = path.join(carpeta, 'lista.txt');
  writeFileSync(lista, lineas.join('\n') + '\n');
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lista,
    '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-movflags', '+faststart', destino], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg no pudo codificar ' + destino);
}

// `listo`: el elemento que indica que la vista ya pintó sus datos.
async function grabar(nombre, opciones, ruta, listo, pasos) {
  // La ventana crece lo que mide la franja de subtítulos: la página se ve al tamaño de las pruebas.
  const viewport = { width: opciones.viewport.width, height: opciones.viewport.height + (opciones.isMobile ? 84 : 72) };
  const escala = opciones.deviceScaleFactor || 1;
  const contexto = await navegador.newContext({ ...opciones, viewport });
  const page = await contexto.newPage();
  const espera = (ms) => page.waitForTimeout(ms);
  const sub = async (texto, ms) => { await page.evaluate((t) => window.subtitulo(t), texto); await espera(ms); };
  const centro = async (sel) => { const c = await page.locator(sel).boundingBox(); return [c.x + c.width / 2, c.y + c.height / 2]; };
  await page.goto(BASE + '/?subtitulos=1' + ruta);
  await page.waitForSelector(listo, { state: 'attached' });

  const carpeta = mkdtempSync(path.join(VIDEOS, `.cuadros-${nombre}-`));
  const cuadros = [];
  const guardar = (data, t) => {
    const archivo = path.join(carpeta, String(cuadros.length).padStart(5, '0') + '.jpg');
    writeFileSync(archivo, Buffer.from(data, 'base64'));
    cuadros.push([archivo, t]);
  };
  const cdp = await contexto.newCDPSession(page);
  // A escala 1, Chrome manda un cuadro cada vez que cambia la pantalla. Esa captura ignora la escala 2 del
  // teléfono, así que ahí se toman capturas completas una tras otra (unas 15 a 25 por segundo).
  let grabando = true, bucle = null;
  if (escala === 1) {
    cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
      guardar(data, metadata.timestamp);
      cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: viewport.width, maxHeight: viewport.height });
  } else {
    // La escala del teléfono la aplica la sesión de Playwright: una sesión de CDP aparte capturaría a 1x.
    bucle = (async () => {
      while (grabando) {
        const t = Date.now() / 1000;
        const imagen = await page.screenshot({ type: 'jpeg', quality: 92, scale: 'device', caret: 'initial' });
        guardar(imagen.toString('base64'), t);
      }
    })();
  }
  await espera(900);
  await pasos({ page, espera, sub, centro });
  await sub('', 400);
  grabando = false;
  if (bucle) await bucle; else await cdp.send('Page.stopScreencast');
  const fin = cuadros.length ? cuadros[cuadros.length - 1][1] + 0.4 : 0;
  await contexto.close();
  const destino = path.join(VIDEOS, `${NOMBRE}-${nombre}.mp4`);
  codificar(cuadros, fin, carpeta, destino);
  rmSync(carpeta, { recursive: true, force: true });
  console.log('escrito', destino, `(${cuadros.length} cuadros, ${(fin - cuadros[0][1]).toFixed(1)} s)`);
}

const ESCRITORIO = { viewport: { width: 1440, height: 900 } };
const TELEFONO = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

// Persona 1: alguien de SEDER, en su computadora, ve la temporada y busca un municipio.
async function pasosPortada({ page, espera, sub, centro }) {
  await sub('Al abrir: la pregunta, la respuesta a la derecha y los focos del día con más fuego.', 4500);
  await page.click('#verTemporada');
  await sub('«Ver la temporada»: cada foco se enciende el día en que se vio y se apaga en unos días.', 5500);
  await sub('Abajo, el fuego acumulado de 2026 (naranja) contra un año normal (punteado).', 6000);
  await page.waitForSelector('#escenario[data-modo="final"]', { timeout: 30000 });
  await sub('Al cierre, la cámara se acerca a Yucatán y cada municipio se pinta según su fuego contra lo normal.', 5500);
  const [vx, vy] = await centro('.rellenos path[data-id="valladolid"]');
  await page.mouse.move(vx - 40, vy - 30);
  await page.mouse.move(vx, vy, { steps: 12 });
  await sub('Al pasar el mouse por un municipio se ve su tarjeta.', 3500);
  await page.mouse.move(60, 880, { steps: 8 });
  await page.click('#busca2');
  await page.keyboard.type('Tekax', { delay: 140 });
  await sub('O se busca por nombre.', 1800);
  await page.keyboard.press('Enter');
  await sub('La tarjeta dice los focos de 2026, lo normal y el veredicto, y lleva al detalle.', 5000);
  await page.keyboard.press('Escape');
  await page.click('#leyNormal');
  await sub('Tocar «Lo normal» explica qué es.', 4000);
  const tira = await page.locator('#tira').boundingBox();
  const dias = 181;
  for (const d of [80, 85, 90]) await page.mouse.move(tira.x + ((d + 0.5) / dias) * tira.width, tira.y + tira.height * 0.45, { steps: 6 });
  await sub('Al pasar por la tira se ve cada día; tocarlo lleva el mapa a ese día.', 2500);
  await page.mouse.click(tira.x + (90.5 / dias) * tira.width, tira.y + tira.height * 0.45);
  await espera(2500);
  const linea = await page.locator('#tiempo').boundingBox();
  const y = linea.y + linea.height * 0.5;
  await page.mouse.move(linea.x + linea.width * 0.34, y);
  await page.mouse.down();
  await sub('La línea de tiempo se arrastra para ver cualquier día.', 300);
  await page.mouse.move(linea.x + linea.width * 0.75, y, { steps: 40 });
  await espera(1500);
  await page.mouse.move(linea.x + linea.width, y, { steps: 20 });
  await page.mouse.up();
  await espera(2500);
  await page.click('[data-idioma="en"]');
  await sub('Todo está también en inglés.', 4000);
  await page.click('[data-idioma="es"]');
  await page.fill('#busca2', '');
  await page.click('#busca2');
  await page.keyboard.type('Tekax', { delay: 100 });
  await page.keyboard.press('Enter');
  await espera(800);
  await page.click('.tarjeta.fija a');
}

// La portada.
async function portada() {
  await grabar('escritorio', ESCRITORIO, '#/', '#rellenos path', async (c) => {
    await pasosPortada(c);
    await c.sub('«Ver detalle» lleva a la página del municipio (la página completa llega en el siguiente PR).', 4500);
  });
  await grabar('telefono', TELEFONO, '#/', '#rellenos path', async ({ page, espera, sub }) => {
    await sub('En el teléfono: la pregunta, el buscador y el mapa en la primera pantalla.', 4500);
    await page.tap('#buscador1 .ejemplo button');
    await sub('Con «Por ejemplo, Tekax» el mapa se colorea y la tarjeta queda debajo del mapa.', 5000);
    await page.evaluate(() => window.scrollBy({ top: 620, behavior: 'smooth' }));
    await sub('Abajo, la línea de tiempo y la respuesta del estado.', 4000);
    await page.evaluate(() => window.scrollBy({ top: 700, behavior: 'smooth' }));
    await sub('Las fechas permitidas de la zona 2 y cuántos focos cayeron fuera de ellas.', 4500);
    await page.evaluate(() => document.querySelector('.tarjeta.fija').scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await espera(1200);
    await page.tap('.tarjeta.fija a');
    await sub('«Ver detalle» abre la página del municipio.', 3500);
  });
}

// La portada sigue en la página de Tekax; el comisario abre el enlace en su teléfono.
async function temporada() {
  await grabar('escritorio', ESCRITORIO, '#/', '#rellenos path', async (c) => {
    const { page, sub } = c;
    await pasosPortada(c);
    await page.waitForSelector('#ficha');
    await sub('La página de Tekax: el veredicto en una frase, sus años y cuándo se quema.', 5000);
    await page.mouse.wheel(0, 260);
    await sub('Hubo la mitad del fuego que en un año normal; la barra roja es 2026.', 4000);
    await page.click('#barrasMun .toque[aria-label^="2003"]');
    await sub('Tocar un año muestra cómo se repartió su fuego contra un año normal.', 5000);
    await page.click('#barrasMun .toque[aria-label^="2026"]');
    await sub('En 2026 también: la llave dice qué parte cayó después de las fechas permitidas.', 5000);
    await page.click('#verNormal');
    await sub('A la derecha, la ficha para mandar por WhatsApp, la imagen y los datos en CSV.', 5000);
  });
  await grabar('telefono', TELEFONO, '#/municipio/tekax', '#ficha', async ({ page, espera, sub }) => {
    await sub('El comisario abre el enlace de Tekax: arriba, el veredicto y las cifras.', 5000);
    await page.evaluate(() => window.scrollBy({ top: 420, behavior: 'smooth' }));
    await sub('Cada año desde 2001; la barra roja es 2026.', 4000);
    await page.tap('#barrasMun .toque[aria-label^="2026"]');
    await page.evaluate(() => document.querySelector('#cuandoTitulo').scrollIntoView({ behavior: 'smooth', block: 'start' }));
    await sub('Al tocar 2026 se ve cuándo se quemó, contra un año normal y las fechas permitidas.', 5500);
    await page.evaluate(() => document.querySelector('#fichaTitulo').scrollIntoView({ behavior: 'smooth', block: 'start' }));
    await sub('La ficha se entiende sola y se comparte por WhatsApp.', 5000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await espera(900);
    await page.tap('.ruta a');
    await page.waitForSelector('#rellenos path', { state: 'attached' });
    await sub('«Península» vuelve a la temporada de toda la península.', 4000);
  });
}

// PR de Fechas de quema: alguien de SEDER o de la prensa revisa si se quemó en las fechas permitidas,
// y el comisario de Tekax revisa las de su zona en el teléfono.
async function fechas() {
  await grabar('escritorio', ESCRITORIO, '#/fechas', '.fz-dia', async ({ page, espera, sub, centro }) => {
    await sub('Fechas de quema: el calendario de la zona 2, de enero a junio de 2026, y su cifra.', 5000);
    await sub('Los días sombreados son los que la SEDER permite quemar; cada punto rojo es el fuego que vio el satélite.', 6000);
    for (const i of [62, 64, 120]) {
      const [x, y] = await centro(`.fz-dia[data-i="${i}"]`);
      await page.mouse.move(x, y, { steps: 10 });
      await espera(700);
    }
    await sub('Al pasar por un día se ve cuántos focos hubo y si se permitía quemar.', 4000);
    await page.selectOption('#zona', '4');
    await sub('Al cambiar de zona cambian el calendario, la cifra y el mapa.', 5000);
    const [mx, my] = await centro('#zMapa path[data-id="valladolid"]');
    await page.mouse.move(mx, my, { steps: 12 });
    await page.mouse.click(mx, my);
    await sub('Tocar el mapa también cambia de zona.', 4000);
    await page.evaluate(() => document.querySelector('#almTitulo').scrollIntoView({ behavior: 'smooth', block: 'start' }));
    await sub('Abajo, cada municipio con su fuego de un año normal, mes por mes; la raya negra son sus fechas permitidas.', 6500);
    await page.click('#almBuscar');
    await page.keyboard.type('tek', { delay: 160 });
    await sub('Se busca por nombre…', 3000);
    await page.fill('#almBuscar', '');
    await page.click('[data-estado="Campeche"]');
    await sub('…o se filtra por estado. Campeche y Quintana Roo no tienen calendario de la SEDER.', 5000);
    await page.click('[data-anio="2026"]');
    await sub('«2026» pinta los meses de este año.', 4000);
    await page.click('[data-estado=""]');
    await page.click('[data-anio="normal"]');
    await page.click('#almCsv');
    await sub('«Descargar lo que se ve» baja la tabla en CSV, lista para Excel.', 4500);
    await page.click('#almBuscar');
    await page.keyboard.type('tekax', { delay: 100 });
    await espera(600);
    await page.click('#almanaque tr[data-id="tekax"] .a-zona');
    await sub('Tocar la zona de un municipio lleva a su calendario.', 5000);
    await page.click('[data-idioma="en"]');
    await sub('Todo está también en inglés.', 4000);
    await page.click('[data-idioma="es"]');
    await espera(600);
  });
  await grabar('telefono', TELEFONO, '#/fechas', '.fz-dia', async ({ page, espera, sub }) => {
    await sub('El comisario de Tekax no sabe cuál es su zona: escribe su municipio.', 2500);
    await page.tap('#busca3');
    await page.keyboard.type('tekax', { delay: 140 });
    await page.keyboard.press('Enter');
    await sub('La página elige su zona, la 3, y dice cuántos focos cayeron fuera de las fechas.', 5500);
    await page.evaluate(() => document.querySelector('.fz-mes:nth-child(3) h3').scrollIntoView({ behavior: 'smooth', block: 'start' }));
    await sub('Los días permitidos van sombreados; los puntos rojos son el fuego de cada día.', 5000);
    await page.tap('.fz-dia[data-i="104"]');
    await sub('Tocar un día dice cuántos focos hubo y si se permitía quemar.', 5000);
    await page.evaluate(() => document.querySelector('#almTitulo').scrollIntoView({ behavior: 'smooth', block: 'start' }));
    await espera(900);
    await page.tap('#almBuscar');
    await page.keyboard.type('tekax', { delay: 120 });
    await page.evaluate(() => document.querySelector('#almConteo').scrollIntoView({ behavior: 'smooth', block: 'start' }));
    await sub('En el almanaque se busca el municipio: Tekax, con su fuego de cada mes.', 5000);
    await page.tap('#almanaque tr[data-id="tekax"] th a');
    await page.waitForSelector('#ficha');
    await sub('Y de ahí, a la página de Tekax.', 4000);
  });
}

// PR del pulido: el repaso nuevo, tocar un año, interrumpir la animación, «Cómo lo medimos»,
// el menú del teléfono y «Usar mi ubicación».
async function pulido() {
  await grabar('escritorio', ESCRITORIO, '#/', '#rellenos path', async ({ page, espera, sub, centro }) => {
    await sub('Al abrir: la pregunta, la respuesta a la derecha y los focos del día con más fuego.', 4000);
    await page.click('#verTemporada');
    await sub('La temporada de 2026 dura unos 9 segundos: cada foco se enciende el día en que se vio y se apaga.', 4500);
    await sub('Abajo, una barra por día y lo normal en gris; las dos barras de la izquierda comparan lo acumulado.', 4500);
    await page.waitForSelector('#escenario[data-modo="final"]', { timeout: 30000 });
    await sub('Al cierre, cada municipio de Yucatán se pinta según su fuego contra lo normal.', 3500);
    const linea = await page.locator('#tiempo').boundingBox();
    const y = linea.y + linea.height * 0.4;
    await page.mouse.move(linea.x + linea.width * 0.5, y, { steps: 10 });
    await page.mouse.move(linea.x + linea.width * 0.68, y, { steps: 30 });
    await sub('Al pasar el mouse por la línea de tiempo se lee cada día.', 2500);
    await page.mouse.move(linea.x + linea.width * 0.45, y, { steps: 8 });
    await page.mouse.down();
    await page.mouse.move(linea.x + linea.width * 0.8, y, { steps: 50 });
    await sub('Y se arrastra para ver cualquier día.', 1500);
    await page.mouse.move(linea.x + linea.width, y, { steps: 15 });
    await page.mouse.up();
    await espera(1200);
    await page.mouse.move(1200, 300, { steps: 10 });
    await page.click('#barras .toque[aria-label^="2003"]');
    await sub('Tocar un año en las barras lo pinta en el mapa: en 2003, 80 de 106 municipios tuvieron más fuego que lo normal.', 6000);
    const [tx, ty] = await centro('.rellenos path[data-id="tekax"]');
    await page.mouse.move(tx, ty, { steps: 15 });
    await page.mouse.click(tx, ty);
    await sub('La tarjeta y la línea de tiempo también cambian de año.', 4000);
    await page.keyboard.press('Escape');
    await page.click('#volver');
    await sub('«Volver a 2026» regresa.', 2500);
    await page.click('#control');
    await espera(2500);
    const [vx, vy] = await centro('.rellenos path[data-id="valladolid"]');
    await page.mouse.move(vx, vy, { steps: 10 });
    await page.mouse.click(vx, vy);
    await sub('Tocar un municipio a media animación la detiene y abre su tarjeta.', 4500);
    await page.keyboard.press('Escape');
    await page.click('.nav a[data-vista="metodo"]');
    await sub('«Cómo lo medimos»: qué es un foco de calor, cómo se unieron los satélites y si se puede confiar.', 5000);
    await page.mouse.wheel(0, 700);
    await sub('El salto de 2012, sin calibrar y calibrado, en la misma escala.', 4500);
    await page.click('[data-idioma="en"]');
    await sub('Todo está también en inglés.', 3000);
    await page.click('[data-idioma="es"]');
    await espera(500);
  });
  const conUbicacion = { ...TELEFONO, permissions: ['geolocation'], geolocation: { latitude: 19.9829, longitude: -89.339 } };
  await grabar('telefono', conUbicacion, '#/', '#rellenos path', async ({ page, espera, sub }) => {
    await sub('En el teléfono, el menú lleva a las tres secciones.', 3500);
    await page.tap('#buscador1 .ubicacion');
    await page.waitForSelector('#ficha');
    await sub('«Usar mi ubicación» abre directo la página del municipio donde está la persona: aquí, Tekax.', 5000);
    await page.tap('.nav a[data-vista="portada"]');
    await page.waitForSelector('#rellenos path', { state: 'attached' });
    await espera(600);
    await page.tap('#verTemporada');
    await sub('El repaso en el teléfono: puntos nítidos que se apagan, sin manchas.', 5000);
    await page.waitForSelector('#escenario[data-modo="final"]', { timeout: 30000 });
    await sub('Al final, el mapa de los municipios.', 3500);
  });
}

// Revisión: buscar una ciudad, las barras con el teclado, el año que se ve
// en el mapa, Dzán como zona probable y, en el teléfono, desplazar la página sobre la línea de tiempo.
async function revision() {
  await grabar('escritorio', ESCRITORIO, '&modo=final#/', '#rellenos path', async ({ page, espera, sub }) => {
    await sub('El buscador ahora encuentra ciudades: «Cancún» lleva a Benito Juárez.', 1200);
    await page.click('#busca2');
    await page.keyboard.type('cancun', { delay: 110 });
    await espera(2200);
    await page.keyboard.press('Enter');
    await sub('Benito Juárez, el municipio de Cancún.', 3500);
    await page.keyboard.press('Escape');
    await page.locator('#barras .toque[tabindex="0"]').focus();
    await sub('Las barras de los años son una sola parada de Tab y se recorren con las flechas.', 2000);
    for (let i = 0; i < 4; i++) { await page.keyboard.press('ArrowLeft'); await espera(450); }
    await page.keyboard.press('Home');
    await espera(500);
    await page.keyboard.press('ArrowRight'); await espera(450);
    await page.keyboard.press('ArrowRight'); await espera(450);
    await page.keyboard.press('Enter');
    await sub('Con Enter se ve 2003. El foco se queda en la barra, y la pista dice qué año muestra el mapa.', 5500);
    await page.click('#volver');
    await sub('«Volver a 2026» regresa también la línea de tiempo y deja el foco en el resultado. «Tekax», en el mapa, ya va en claro.', 5000);
    await page.click('.nav a[data-vista="fechas"]');
    await page.waitForSelector('#almanaque tr[data-id="dzan"]');
    await page.locator('#almanaque tr[data-id="dzan"]').scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 120);
    await sub('En el almanaque, Dzán ya sale como zona probable, igual que Baca y Tekit.', 5000);
  });
  await grabar('telefono', TELEFONO, '#/', '#rellenos path', async ({ page, espera, sub }) => {
    await page.tap('#verTemporada');
    await espera(2500);
    await page.tap('#control');
    await page.locator('#tiempo').scrollIntoViewIfNeeded();
    await sub('En el teléfono, deslizar hacia arriba sobre la línea de tiempo desplaza la página.', 1500);
    const cdp = await page.context().newCDPSession(page);
    const deslizar = async ([x0, y0], [x1, y1], pasos = 24) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
      for (let i = 1; i <= pasos; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * i) / pasos, y: y0 + ((y1 - y0) * i) / pasos }] });
        await espera(16);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    let r = await page.locator('#tiempo').boundingBox();
    await deslizar([r.x + r.width * 0.7, r.y + r.height / 2], [r.x + r.width * 0.7, r.y + r.height / 2 - 260]);
    await espera(2500);
    await deslizar([195, 300], [195, 560]);
    await espera(800);
    r = await page.locator('#tiempo').boundingBox();
    await sub('Y con un gesto de lado se arrastra el repaso.', 800);
    await deslizar([r.x + r.width * 0.2, r.y + r.height / 2], [r.x + r.width * 0.75, r.y + r.height / 2], 40);
    await espera(3000);
  });
}

await ({ portada, temporada, fechas, pulido, revision })[RECORRIDO]();
await navegador.close();
process.exit(0);
