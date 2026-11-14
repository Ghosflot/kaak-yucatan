// La ficha para WhatsApp: una imagen de 1080 × 1350 que se entiende sola (spec, «La ficha para WhatsApp»).
import { t } from './textos.js';
import { fmt, fechaDia, deMesDia, frase, cifras } from './comun.js';

export const ANCHO = 1080, ALTO = 1350;
export const SITIO = 'kaak.pages.dev';
const M = 64; // margen de los lados
const PAPEL = '#FAFAF7', TINTA = '#141414', GRIS = '#8F877D', ROJO = '#D7261E';
const DISPLAY = '"Alfa Slab One", Rockwell, Georgia, serif';
const TEXTO = '"Atkinson Hyperlegible Next", system-ui, sans-serif';
const MONO = '"Atkinson Hyperlegible Mono", ui-monospace, monospace';

async function fuentes() {
  await Promise.all([
    document.fonts.load('400 64px "Alfa Slab One"'),
    document.fonts.load('400 32px "Atkinson Hyperlegible Next"'),
    document.fonts.load('700 32px "Atkinson Hyperlegible Next"'),
    document.fonts.load('800 32px "Atkinson Hyperlegible Next"'),
    document.fonts.load('400 32px "Atkinson Hyperlegible Mono"'),
    document.fonts.load('700 32px "Atkinson Hyperlegible Mono"'),
  ]).catch(() => {});
}

function renglones(ctx, texto, ancho) {
  const palabras = texto.split(' ');
  const lineas = [];
  let actual = '';
  for (const p of palabras) {
    const prueba = actual ? actual + ' ' + p : p;
    if (ctx.measureText(prueba).width > ancho && actual) { lineas.push(actual); actual = p; } else actual = prueba;
  }
  if (actual) lineas.push(actual);
  return lineas;
}

// Lo que dice la franja de abajo: las fechas de la SEDER de su zona, o que no hay.
export function fechasDeLaFicha(m) {
  const zona = (m.zona || '').replace(/^\D+/, '');
  if (!m.ventana) return { titulo: t('fSinFechas', { m: m.nombre }), valor: t('fSinFechasValor') };
  const clave = m.zona_inferida ? 'fFechasProbables' : 'fFechas';
  return {
    titulo: t(clave, { m: m.nombre, z: zona }),
    valor: t('rango', { i: fechaDia(deMesDia(m.ventana.inicio)), f: fechaDia(deMesDia(m.ventana.fin)) }),
  };
}

/** Dibuja la ficha de un municipio (el JSON de web/datos/municipio/<id>.json) en `canvas`. */
export async function dibujarFicha(canvas, m) {
  await fuentes();
  canvas.width = ANCHO;
  canvas.height = ALTO;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PAPEL;
  ctx.fillRect(0, 0, ANCHO, ALTO);
  ctx.textBaseline = 'alphabetic';
  const util = ANCHO - 2 * M;

  // Franja de abajo: se mide primero para saber cuánto alto les queda a las barras.
  const f = fechasDeLaFicha(m);
  ctx.font = `700 38px ${TEXTO}`;
  const lineasTitulo = renglones(ctx, f.titulo, util);
  ctx.font = `400 60px ${DISPLAY}`;
  const lineasValor = renglones(ctx, f.valor, util);
  // Fuente y dirección comparten renglón si caben; si no (nombres largos), la dirección baja.
  const direccion = SITIO + '/' + m.id;
  ctx.font = `400 32px ${TEXTO}`;
  const anchoFuente = ctx.measureText(t('fFuente')).width;
  ctx.font = `800 32px ${TEXTO}`;
  const juntas = anchoFuente + 32 + ctx.measureText(direccion).width <= util;
  const franja = 34 + lineasTitulo.length * 46 + lineasValor.length * 70 + 22 + (juntas ? 40 : 82) + 34;

  // Encabezado
  let y = 52 + 44;
  ctx.fillStyle = TINTA;
  ctx.font = `400 44px ${DISPLAY}`;
  ctx.textAlign = 'left';
  ctx.fillText("K'ÁAK'", M, y);
  ctx.font = `700 38px ${TEXTO}`;
  ctx.textAlign = 'right';
  ctx.fillText(t('fTemporada'), ANCHO - M, y);
  ctx.textAlign = 'left';

  // Nombre: se achica si no cabe.
  let tam = 128;
  ctx.font = `400 ${tam}px ${DISPLAY}`;
  const w = ctx.measureText(m.nombre).width;
  if (w > util) { tam = Math.max(72, Math.floor(tam * util / w)); ctx.font = `400 ${tam}px ${DISPLAY}`; }
  y += 20 + tam * 0.92;
  for (const l of renglones(ctx, m.nombre, util)) { ctx.fillText(l, M, y); y += tam; }
  y -= tam;

  // Veredicto y cifras
  ctx.font = `800 58px ${TEXTO}`;
  y += 18;
  for (const l of renglones(ctx, frase(m), util)) { y += 66; ctx.fillText(l, M, y); }
  ctx.font = `400 40px ${TEXTO}`;
  y += 8;
  for (const l of renglones(ctx, cifras('fCifras', m), util)) { y += 52; ctx.fillText(l, M, y); }

  // Lo normal
  y += 36 + 34;
  ctx.strokeStyle = TINTA;
  ctx.lineWidth = 5;
  ctx.setLineDash([12, 7]);
  ctx.beginPath(); ctx.moveTo(M, y - 11); ctx.lineTo(M + 60, y - 11); ctx.stroke();
  ctx.font = `700 34px ${MONO}`;
  ctx.fillText(t('loNormal', { n: fmt(m.normal) }), M + 80, y);

  // Barras: ocupan lo que queda entre la leyenda y la nota.
  ctx.font = `400 38px ${TEXTO}`;
  const nota = renglones(ctx, t('fNota'), util);
  const debajo = 12 + 44 + 14 + nota.length * 48 + 24;
  const arriba = y + 18;
  const alto = Math.max(160, Math.min(320, ALTO - franja - debajo - arriba));
  const base = arriba + alto;
  const anios = m.anios;
  const tope = Math.max(...anios.map((a) => a.total), m.normal, 1);
  const hueco = 8, bw = (util - hueco * (anios.length - 1)) / anios.length;
  anios.forEach((a, i) => {
    const h = Math.max(4, (a.total / tope) * (alto - 8));
    ctx.fillStyle = a.y === 2026 ? ROJO : GRIS;
    ctx.fillRect(M + i * (bw + hueco), base - h, bw, h);
  });
  ctx.setLineDash([]);
  ctx.fillStyle = TINTA;
  ctx.fillRect(M, base, util, 4);
  const yn = base - (m.normal / tope) * (alto - 8);
  ctx.setLineDash([12, 7]);
  ctx.beginPath(); ctx.moveTo(M, yn); ctx.lineTo(ANCHO - M, yn); ctx.stroke();
  ctx.setLineDash([]);

  y = base + 12 + 38;
  ctx.font = `400 38px ${MONO}`;
  ctx.fillText(String(anios[0].y), M, y);
  ctx.font = `700 38px ${MONO}`;
  ctx.fillStyle = ROJO;
  ctx.textAlign = 'right';
  ctx.fillText('2026: ' + fmt(m.v26), ANCHO - M, y);
  ctx.textAlign = 'left';
  ctx.fillStyle = TINTA;
  ctx.font = `400 38px ${TEXTO}`;
  y += 14;
  for (const l of nota) { y += 48; ctx.fillText(l, M, y); }

  // Franja negra con las fechas y la dirección.
  let yf = ALTO - franja;
  ctx.fillStyle = TINTA;
  ctx.fillRect(0, yf, ANCHO, franja);
  ctx.fillStyle = PAPEL;
  yf += 34;
  ctx.font = `700 38px ${TEXTO}`;
  for (const l of lineasTitulo) { yf += 40; ctx.fillText(l, M, yf); yf += 6; }
  ctx.font = `400 60px ${DISPLAY}`;
  for (const l of lineasValor) { yf += 66; ctx.fillText(l, M, yf); yf += 4; }
  yf += 22 + 32;
  ctx.font = `400 32px ${TEXTO}`;
  ctx.fillStyle = '#E3E1DA';
  ctx.fillText(t('fFuente'), M, yf);
  ctx.font = `800 32px ${TEXTO}`;
  ctx.fillStyle = '#FFFFFF';
  if (juntas) {
    ctx.textAlign = 'right';
    ctx.fillText(direccion, ANCHO - M, yf);
    ctx.textAlign = 'left';
  } else ctx.fillText(direccion, M, yf + 42);
}

export const aBlob = (canvas) => new Promise((r) => canvas.toBlob(r, 'image/png'));

export function descargar(blob, nombre) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** Comparte la imagen con la hoja de compartir del teléfono; si no se puede, abre WhatsApp con el enlace. */
export async function compartir(blob, nombre, texto) {
  const archivo = new File([blob], nombre, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try { await navigator.share({ files: [archivo], text: texto }); return 'hoja'; } catch (e) { if (e.name === 'AbortError') return 'cancelado'; }
  }
  window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener');
  return 'whatsapp';
}

/* ---------- Tarjetas para la vista previa de un enlace (WhatsApp, Facebook, X): 1200 × 630 ---------- */
export const TARJETA = { ancho: 1200, alto: 630 };

/** La tarjeta de un municipio: nombre, veredicto, sus barras y la franja de fechas. La escribe pipeline/tarjetas.mjs. */
export async function dibujarTarjeta(canvas, m) {
  await fuentes();
  const { ancho: W, alto: H } = TARJETA;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PAPEL;
  ctx.fillRect(0, 0, W, H);
  const F = 150; // alto de la franja negra
  const izq = 60, col = 590; // columna de texto
  const gx = izq + col + 40, gw = W - 60 - gx; // gráfica

  ctx.fillStyle = TINTA;
  ctx.textAlign = 'left';
  ctx.font = `400 34px ${DISPLAY}`;
  ctx.fillText("K'ÁAK'", izq, 78);
  ctx.font = `700 26px ${TEXTO}`;
  ctx.textAlign = 'right';
  ctx.fillText(t('fTemporada'), W - 60, 76);
  ctx.textAlign = 'left';

  // Nombre: se achica hasta caber en un renglón de la columna.
  let tam = 96;
  ctx.font = `400 ${tam}px ${DISPLAY}`;
  const w = ctx.measureText(m.nombre).width;
  if (w > col) { tam = Math.max(46, Math.floor(tam * col / w)); ctx.font = `400 ${tam}px ${DISPLAY}`; }
  let y = 112 + tam * 0.86;
  ctx.fillText(m.nombre, izq, y);

  ctx.font = `800 38px ${TEXTO}`;
  y += 12;
  for (const l of renglones(ctx, frase(m), col).slice(0, 3)) { y += 46; ctx.fillText(l, izq, y); }
  ctx.font = `400 25px ${TEXTO}`;
  y += 10;
  ctx.fillStyle = '#3A3733';
  for (const l of renglones(ctx, cifras('fCifras', m), col).slice(0, 2)) { y += 36; ctx.fillText(l, izq, y); }

  // Barras de cada año, con lo normal punteado.
  const arriba = 128, base = H - F - 64, alto = base - arriba;
  const anios = m.anios;
  const tope = Math.max(...anios.map((a) => a.total), m.normal, 1);
  const hueco = 5, bw = (gw - hueco * (anios.length - 1)) / anios.length;
  anios.forEach((a, i) => {
    const h = Math.max(3, (a.total / tope) * alto);
    ctx.fillStyle = a.y === 2026 ? ROJO : GRIS;
    ctx.fillRect(gx + i * (bw + hueco), base - h, bw, h);
  });
  ctx.fillStyle = TINTA;
  ctx.fillRect(gx, base, gw, 3);
  const yn = base - (m.normal / tope) * alto;
  ctx.strokeStyle = TINTA;
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 6]);
  ctx.beginPath(); ctx.moveTo(gx, yn); ctx.lineTo(gx + gw, yn); ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = `700 24px ${MONO}`;
  ctx.fillText(t('loNormal', { n: fmt(m.normal) }), gx, Math.max(arriba - 14, 100));
  ctx.font = `400 24px ${MONO}`;
  ctx.fillText(String(anios[0].y), gx, base + 34);
  ctx.font = `700 24px ${MONO}`;
  ctx.fillStyle = ROJO;
  ctx.textAlign = 'right';
  ctx.fillText('2026: ' + fmt(m.v26), gx + gw, base + 34);
  ctx.textAlign = 'left';

  // Franja de abajo: las fechas de su zona y la dirección.
  const f = fechasDeLaFicha(m);
  ctx.fillStyle = TINTA;
  ctx.fillRect(0, H - F, W, F);
  ctx.fillStyle = PAPEL;
  ctx.font = `700 26px ${TEXTO}`;
  ctx.fillText(renglones(ctx, f.titulo, W - 120)[0], izq, H - F + 50);
  let tv = 48;
  ctx.font = `400 ${tv}px ${DISPLAY}`;
  const direccion = SITIO + '/' + m.id;
  const anchoDir = (() => { ctx.save(); ctx.font = `800 26px ${TEXTO}`; const a = ctx.measureText(direccion).width; ctx.restore(); return a; })();
  const libre = W - 120 - anchoDir - 40;
  const wv = ctx.measureText(f.valor).width;
  if (wv > libre) { tv = Math.max(28, Math.floor(tv * libre / wv)); ctx.font = `400 ${tv}px ${DISPLAY}`; }
  ctx.fillText(f.valor, izq, H - 38);
  ctx.font = `800 26px ${TEXTO}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'right';
  ctx.fillText(direccion, W - 60, H - 40);
  ctx.textAlign = 'left';
}

/** La tarjeta de la página: la foto de satélite con los focos del día con más fuego y la pregunta. */
export async function dibujarTarjetaInicio(canvas, { foto, puntos, lienzo, titulo }) {
  await fuentes();
  const { ancho: W, alto: H } = TARJETA;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0A0E14';
  ctx.fillRect(0, 0, W, H);
  // La foto ocupa la mitad derecha, recortada a la península; las coordenadas de los puntos son las del lienzo de la portada.
  const { x0, y0, w0, h0, recorte } = lienzo;
  const k = H / recorte.h;
  const ox = W - recorte.w * k;
  const X = (x) => ox + (x - recorte.x) * k, Y = (y) => (y - recorte.y) * k;
  ctx.drawImage(foto, X(x0), Y(y0), w0 * k, h0 * k);
  // La foto se funde con el fondo desde su borde izquierdo: no queda un corte recto.
  const borde = Math.max(0, X(x0));
  const g = ctx.createLinearGradient(borde, 0, borde + 340, 0);
  g.addColorStop(0, 'rgba(10,14,20,1)'); g.addColorStop(1, 'rgba(10,14,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, borde + 341, H);
  ctx.fillStyle = 'rgba(10,14,20,0.25)';
  ctx.fillRect(borde, 0, W - borde, H);
  ctx.fillStyle = '#FFC94D';
  ctx.globalAlpha = 0.92;
  for (const [x, y] of puntos) { ctx.beginPath(); ctx.arc(X(x), Y(y), 3.6, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.font = `400 38px ${DISPLAY}`;
  ctx.fillText("K'ÁAK'", 64, 92);
  ctx.font = `400 62px ${DISPLAY}`;
  let y = 170;
  for (const l of renglones(ctx, titulo, 560)) { y += 70; ctx.fillText(l, 64, y); }
  ctx.font = `800 26px ${TEXTO}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(SITIO, 64, H - 52);
}
