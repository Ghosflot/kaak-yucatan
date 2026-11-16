// Video del demo para el pitch de 5 minutos (sección 5 del guion): sin voz ni subtítulos, porque Leo
// lo narra en vivo. Sigue sus frases con pausas holgadas: la portada, Muna, «8 de cada 10 después del
// 3 de abril», tocar 2024 y la ficha para WhatsApp.
// Uso: KAAK_CHROME=1 KAAK_FFMPEG=<ruta> [KAAK_IDIOMA=en] [KAAK_PUERTO=<puerto>] node tests/web/pitch.mjs
//   →  videos/pitch-demo.mp4, o videos/pitch-demo-en.mp4 en inglés (1920 × 1080), y su primer cuadro en .png
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WEB = process.env.KAAK_WEB || path.join(RAIZ, 'web');
const FFMPEG = process.env.KAAK_FFMPEG || 'ffmpeg';
const FPS = process.env.KAAK_FPS || '60';
const PUERTO = Number(process.env.KAAK_PUERTO) || 8794;
const IDIOMA = process.env.KAAK_IDIOMA === 'en' ? 'en' : 'es';
const BASE = `http://127.0.0.1:${PUERTO}`;
const VIDEOS = path.join(RAIZ, 'videos');
mkdirSync(VIDEOS, { recursive: true });

const servidor = spawn('python3', ['-m', 'http.server', String(PUERTO), '-d', WEB, '--bind', '127.0.0.1'], { stdio: 'ignore' });
process.on('exit', () => servidor.kill());
await new Promise((r) => setTimeout(r, 800));
const navegador = await chromium.launch(process.env.KAAK_CHROME === '1' ? { channel: 'chrome' } : {});

// 1440 × 810 de página a escala 4/3: el video sale en 1920 × 1080 con letra grande para el proyector.
const ANCHO = 1440, ALTO = 810, ESCALA = 4 / 3;
const contexto = await navegador.newContext({ viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: ESCALA });
const page = await contexto.newPage();
const espera = (ms) => page.waitForTimeout(ms);
await page.goto(BASE + `/?lang=${IDIOMA}#/?modo=final`);
await page.waitForSelector('#rellenos path', { state: 'attached' });
await espera(1500);

// Un punto casi invisible que cambia sin parar mantiene el flujo de cuadros, y el cursor se dibuja
// (el del sistema no sale en la captura).
await page.addStyleTag({ content: '@keyframes kaak-latido{from{opacity:.01}to{opacity:.02}} .marca.insinua .marca-dice{opacity:0!important}' });
const preparar = () => page.evaluate(() => {
  if (document.getElementById('kaakCursor')) return;
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;background:#000;z-index:10000;pointer-events:none;animation:kaak-latido .1s linear infinite alternate';
  const cur = document.createElement('div');
  cur.id = 'kaakCursor';
  cur.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2v17l4.5-4 3 7 3-1.2-2.9-6.8H18z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  cur.style.cssText = 'position:fixed;left:0;top:0;z-index:10002;pointer-events:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))';
  cur.style.transform = `translate(${(window.kaakX ?? 1000) - 4}px,${(window.kaakY ?? 300) - 2}px)`;
  document.body.append(d, cur);
  addEventListener('mousemove', (e) => { window.kaakX = e.clientX; window.kaakY = e.clientY; cur.style.transform = `translate(${e.clientX - 4}px,${e.clientY - 2}px)`; }, true);
  const svg = cur.firstChild; svg.style.transition = 'transform .12s ease-out'; svg.style.transformOrigin = '4px 2px';
  addEventListener('mousedown', () => { svg.style.transform = 'scale(.82)'; setTimeout(() => { svg.style.transform = ''; }, 140); }, true);
});
await preparar();

const carpeta = mkdtempSync(path.join(VIDEOS, '.cuadros-pitch-'));
const cuadros = [];
const cdp = await contexto.newCDPSession(page);
cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
  const archivo = path.join(carpeta, String(cuadros.length).padStart(5, '0') + '.jpg');
  writeFileSync(archivo, Buffer.from(data, 'base64'));
  cuadros.push([archivo, metadata.timestamp]);
  cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 94, maxWidth: Math.round(ANCHO * ESCALA), maxHeight: Math.round(ALTO * ESCALA) });

// El cursor se mueve como una mano: rápido y sin rodeos, con una curva leve, frenando al llegar
// (perfil de jerk mínimo) y con una duración que crece poco con la distancia (ley de Fitts). Entre una
// acción y otra se queda quieto.
let cx = 230, cy = 560;
await page.mouse.move(cx, cy);
const deslizar = async (x, y) => {
  const x0 = cx, y0 = cy, d = Math.hypot(x - x0, y - y0);
  const ms = Math.round(180 + 110 * Math.log2(1 + d / 30));
  const n = Math.max(1, Math.round(ms / 16));
  const curva = Math.min(26, d * 0.06), nx = -(y - y0) / (d || 1), ny = (x - x0) / (d || 1);
  for (let k = 1; k <= n; k++) {
    const e = k / n, s = 10 * e ** 3 - 15 * e ** 4 + 6 * e ** 5, b = Math.sin(Math.PI * s) * curva;
    cx = x0 + (x - x0) * s + nx * b; cy = y0 + (y - y0) * s + ny * b;
    await page.mouse.move(cx, cy); await espera(8);
  }
};
const caja = async (loc) => { await loc.first().waitFor(); return loc.first().boundingBox(); };
const hacia = async (loc, dx = 0.5, dy = 0.5) => { const b = await caja(loc); await deslizar(b.x + b.width * dx, b.y + b.height * dy); };
const clic = async () => { await page.mouse.down(); await espera(70); await page.mouse.up(); };
// Desplazamiento suave, como el de un trackpad: arranca y frena sin tirones.
const desplazar = (y, ms) => page.evaluate(([y, ms]) => new Promise((listo) => {
  const y0 = scrollY, t0 = performance.now();
  const paso = (t) => {
    const e = Math.min(1, (t - t0) / ms), s = e < 0.5 ? 4 * e * e * e : 1 - (-2 * e + 2) ** 3 / 2;
    scrollTo(0, y0 + (y - y0) * s);
    if (e < 1) requestAnimationFrame(paso); else listo();
  };
  requestAnimationFrame(paso);
}), [y, ms]);
const alturaDe = (loc, margen) => loc.first().evaluate((el, m) => el.getBoundingClientRect().top + scrollY - m, margen);

const t0 = Date.now();
const hasta = (ms) => espera(Math.max(0, ms - (Date.now() - t0)));
const marca = (n) => console.log('  ', n, ((Date.now() - t0) / 1000).toFixed(1), 's');

// «Esto es K'áak'… Así lo abriría la Protección Civil de Muna. [Abrir.]»
marca('portada');
await hasta(900);
const entrada = page.locator('#buscador2 input');
await hacia(entrada, 0.32);
await clic();
await entrada.pressSequentially('Muna', { delay: 95 });
await hasta(2000);
await hacia(page.locator('#buscador2 li', { hasText: 'Muna' }), 0.25);
await clic();
marca('Muna en el mapa');
// La cámara vuela a Muna y abre su tarjeta; el enlace de la tarjeta lleva a su página.
const enlace = page.locator('a[href="#/municipio/muna"]').filter({ visible: true });
await enlace.first().waitFor();
await hasta(3900);
await hacia(enlace, 0.4);
await hasta(4700);
await clic();
await page.waitForSelector('#barrasMun rect.toque', { state: 'attached' });
await preparar();
marca('Muna abierta');
// El cursor se aparta al margen derecho para no tapar nada.
await hasta(5600);
await deslizar(1330, 330);

// «Aquí está la respuesta: de cada 10 focos de un año normal, 8 aparecen después del 3 de abril.»
const cuando = page.locator('#cuandoTitulo');
await hasta(6600);
await desplazar(await alturaDe(cuando, 150), 900);
marca('8 de cada 10');
await hasta(11300);

// «Voy a tocar 2024. [Tocar.] … Muna tuvo 81 focos, casi 1.5 veces lo normal.»
await desplazar(0, 900);
await hacia(page.locator('#barrasMun rect.toque[data-y="2024"]'), 0.5, 0.7);
await hasta(12900);
await clic();
marca('2024 tocado');
await hasta(16200);

// «Todo cabe en una ficha que se reenvía por WhatsApp.»
await hacia(page.locator('#compartir'), 0.45, 0.55);
marca('ficha');
await hasta(19800);
marca('fin');

await cdp.send('Page.stopScreencast');
const fin = cuadros[0][1] + Math.min(20, cuadros[cuadros.length - 1][1] + 0.2 - cuadros[0][1]);
await contexto.close();
await navegador.close();

const lineas = [];
cuadros.forEach(([archivo, t], i) => {
  const siguiente = i + 1 < cuadros.length ? cuadros[i + 1][1] : fin;
  lineas.push(`file '${archivo}'`, `duration ${Math.max(0.001, siguiente - t).toFixed(3)}`);
});
lineas.push(`file '${cuadros[cuadros.length - 1][0]}'`);
const lista = path.join(carpeta, 'lista.txt');
writeFileSync(lista, lineas.join('\n') + '\n');
const destino = path.join(VIDEOS, IDIOMA === 'en' ? 'pitch-demo-en.mp4' : 'pitch-demo.mp4');
const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lista,
  '-vf', `fps=${FPS},scale=1920:1080:flags=lanczos,format=yuv420p`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-movflags', '+faststart', destino], { stdio: 'inherit' });
if (r.status !== 0) throw new Error('ffmpeg no pudo codificar');
// El primer cuadro, para la imagen que se ve antes de que arranque el video.
spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', destino, '-frames:v', '1', destino.replace(/\.mp4$/, '.png')], { stdio: 'inherit' });
rmSync(carpeta, { recursive: true, force: true });
console.log('escrito', destino, `(${cuadros.length} cuadros, ${(fin - cuadros[0][1]).toFixed(1)} s)`);
process.exit(0);
