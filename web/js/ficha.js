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
