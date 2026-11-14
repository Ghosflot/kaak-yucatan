// Tarjetas para la vista previa de los enlaces (WhatsApp, Facebook, X): web/og/<municipio>.png,
// web/og/inicio.jpg y web/og/textos.json, con el título y la descripción de cada una.
// functions/_middleware.js las pone en el <head> de cada dirección (kaak.pages.dev/tekax).
//
// Se dibujan con el mismo código de la ficha (web/js/ficha.js), en Chrome. Hay que volver a correrlo
// cuando cambien las cifras de 2026 de los municipios: `node pipeline/tarjetas.mjs`.
// Necesita Playwright (npm ci) y Chrome o el Chromium de Playwright (KAAK_CHROME=1 usa Chrome).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(RAIZ, 'web');
const SALIDA = path.join(WEB, 'og');
const PUERTO = 8794;
mkdirSync(SALIDA, { recursive: true });

const servidor = spawn('python3', ['-m', 'http.server', String(PUERTO), '-d', WEB, '--bind', '127.0.0.1'], { stdio: 'ignore' });
process.on('exit', () => servidor.kill());
await new Promise((r) => setTimeout(r, 800));
const navegador = await chromium.launch(process.env.KAAK_CHROME === '1' ? { channel: 'chrome' } : {});
const page = await navegador.newPage();
await page.goto(`http://127.0.0.1:${PUERTO}/?lang=es#/metodo`);
await page.waitForSelector('#vista > *');

const resultado = await page.evaluate(async () => {
  const ficha = await import('/js/ficha.js');
  const { t } = await import('/js/textos.js');
  const { frase, cifras } = await import('/js/comun.js');
  const json = (r) => fetch(r).then((x) => x.json());
  // La de la portada lleva la foto de satélite: en JPEG pesa una sexta parte.
  const png = async (canvas, tipo = 'image/png') => {
    const blob = await new Promise((r) => canvas.toBlob(r, tipo, 0.86));
    const b = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const sinPunto = (s) => s.replace(/\.$/, '');
  const minuscula = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  const canvas = document.createElement('canvas');
  const salida = { imagenes: {}, textos: { municipios: {} } };

  const lista = await json('/datos/municipios.json');
  for (const { id } of lista) {
    const m = await json('/datos/municipio/' + id + '.json');
    await ficha.dibujarTarjeta(canvas, m);
    salida.imagenes[id + '.png'] = await png(canvas);
    const f = ficha.fechasDeLaFicha(m);
    salida.textos.municipios[id] = {
      titulo: m.nombre + ': ' + minuscula(sinPunto(frase(m))),
      descripcion: cifras('fCifras', m) + ' ' + f.titulo + ': ' + minuscula(f.valor) + '.',
    };
  }

  const D = await json('/datos/portada.json');
  const foto = new Image();
  foto.src = '/img/mosaico.jpg';
  await foto.decode();
  await ficha.dibujarTarjetaInicio(canvas, {
    foto, puntos: D.pts,
    lienzo: { x0: 0, y0: -90, w0: 825, h0: 681, recorte: { x: 150, y: -40, w: 675, h: 600 } },
    titulo: t('titulo'),
  });
  salida.imagenes['inicio.jpg'] = await png(canvas, 'image/jpeg');
  salida.textos.inicio = { titulo: t('tituloPagina'), descripcion: t('descripcionPagina') };
  return salida;
});

for (const [id, b64] of Object.entries(resultado.imagenes)) writeFileSync(path.join(SALIDA, id), Buffer.from(b64, 'base64'));
writeFileSync(path.join(SALIDA, 'textos.json'), JSON.stringify(resultado.textos, null, 1) + '\n');
console.log(`web/og: ${Object.keys(resultado.imagenes).length} tarjetas`);
await navegador.close();
servidor.kill();
process.exit(0);
