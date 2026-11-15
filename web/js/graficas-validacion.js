// Las gráficas de las cuatro pruebas de la validación (tarea 7), dibujadas en la página con los
// datos de web/datos/validacion.json. Dicen lo mismo que las PNG de salidas/graficas/ que hace
// pipeline/validar.py, pero con la letra, los colores y el idioma de la página.
// Cada función dibuja en `svg` con el ancho que tiene en pantalla y devuelve su leyenda.
// Colores: el rojo es 2026 y nada más (no aparece aquí). Lo corregido va en tinta sólida o con el
// rayado de MODIS de todo el sitio; lo sin corregir, en blanco con borde gris; S-NPP, en gris.
// Ninguna letra mide menos de 11 px.
import { t, idioma } from './textos.js';
import { fmt, el } from './comun.js';

const TINTA = '#121212';
const TINTA_2 = '#4A4743';
const LINEA = '#E4E1DC';
const GRIS = '#8F877D';    // S-NPP: la escala de la serie
const BANDA = '#EFECE6';   // la meta fijada de antemano
const BANDA_2 = '#DCD6CC'; // la variación normal
const BLANCO = '#FFFFFF';
const RAYAS = 'gv-rayas';  // MODIS corregido: el mismo rayado de la portada

// El patrón del rayado, una vez por gráfica.
function rayas(svg) {
  const pat = el('pattern', { id: RAYAS + '-' + svg.dataset.prueba, width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, el('defs', {}, svg));
  el('rect', { width: 5, height: 5, fill: GRIS }, pat);
  el('rect', { width: 2, height: 5, fill: BLANCO, 'fill-opacity': 0.55 }, pat);
  return 'url(#' + RAYAS + '-' + svg.dataset.prueba + ')';
}

const dec = (n, d) => n.toLocaleString(idioma() === 'en' ? 'en-US' : 'es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });

function texto(svg, x, y, s, extra = {}) {
  const n = el('text', { x: x.toFixed(1), y: y.toFixed(1), 'font-size': 11, fill: TINTA_2, ...extra }, svg);
  n.textContent = s;
  return n;
}

// Un rótulo largo se parte en renglones de `ancho` como máximo; devuelve cuántos renglones quedaron.
function partir(n, ancho, alto = 16) {
  if (!n.getComputedTextLength || n.getComputedTextLength() <= ancho) return 1;
  const palabras = n.textContent.split(' '), x = n.getAttribute('x');
  n.textContent = '';
  let linea = el('tspan', { x, dy: 0 }, n), renglones = 1;
  for (const w of palabras) {
    const antes = linea.textContent;
    linea.textContent = antes ? antes + ' ' + w : w;
    if (antes && linea.getComputedTextLength() > ancho) {
      linea.textContent = antes;
      linea = el('tspan', { x, dy: alto }, n);
      linea.textContent = w;
      renglones++;
    }
  }
  return renglones;
}

// Rejilla horizontal con sus números a la izquierda; devuelve la función de la escala.
function ejeY(svg, { izq, der, arriba, base, max, marcas }) {
  const Y = (v) => base - (v / max) * (base - arriba);
  for (const v of marcas) {
    el('line', { x1: izq, x2: der, y1: Y(v), y2: Y(v), stroke: LINEA, 'stroke-width': 1 }, svg);
    texto(svg, izq - 6, Y(v) + 4, fmt(v), { 'text-anchor': 'end' });
  }
  el('line', { x1: izq, x2: der, y1: base + 0.5, y2: base + 0.5, stroke: TINTA, 'stroke-width': 1 }, svg);
  return Y;
}

const marcasDe = (max) => {
  const paso = max > 30000 ? 10000 : max > 12000 ? 5000 : 2500;
  const m = [];
  for (let v = 0; v <= max; v += paso) m.push(v);
  return m;
};

function barra(svg, x, y, w, base, fill, titulo, extra = {}) {
  const r = el('rect', { x: x.toFixed(1), y: y.toFixed(1), width: Math.max(1, w).toFixed(1), height: Math.max(0, base - y).toFixed(1), fill, ...extra }, svg);
  if (titulo) el('title', {}, r).textContent = titulo;
  return r;
}

/** Prueba 1: el salto de 2012, por año, y la razón después ÷ antes contra la meta y la variación normal. */
function salto(svg, g, ancho) {
  const izq = 52, der = ancho - 4, arriba = 14, base = 170;
  const anios = g.totales;
  const RAYADO = rayas(svg);
  const max = Math.max(...anios.map((a) => Math.max(a.crudo, a.cal))) * 1.08;
  const Y = ejeY(svg, { izq, der, arriba, base, max, marcas: marcasDe(max) });
  const paso = (der - izq) / anios.length, hueco = Math.max(4, paso * 0.18);
  const X = (i) => izq + i * paso + hueco / 2;
  const w = paso - hueco;
  anios.forEach((a, i) => {
    const etiqueta = a.y + ': ';
    if (a.transicion) {
      barra(svg, X(i), Y(a.cal), w, base, BANDA_2, etiqueta + fmt(a.cal), { stroke: GRIS, 'stroke-width': 1, 'stroke-dasharray': '3 2' });
    } else if (a.crudo !== a.cal) {
      barra(svg, X(i) + 0.75, Y(a.crudo), w / 2 - 1.5, base, BLANCO, etiqueta + fmt(a.crudo), { stroke: GRIS, 'stroke-width': 1.5 });
      barra(svg, X(i) + w / 2, Y(a.cal), w / 2, base, RAYADO, etiqueta + fmt(a.cal));
    } else {
      barra(svg, X(i), Y(a.cal), w, base, GRIS, etiqueta + fmt(a.cal));
    }
    texto(svg, X(i) + w / 2, base + 15, String(a.y).slice(paso < 44 ? 2 : 0), { 'text-anchor': 'middle' });
  });
  // El rótulo de la transición va después de las barras, para que ninguna lo tape.
  anios.forEach((a, i) => {
    if (a.transicion) texto(svg, X(i) + w / 2, Y(a.cal) - 5, t('mGvTransicion'), { 'text-anchor': 'middle', 'paint-order': 'stroke', stroke: BLANCO, 'stroke-width': 3 });
  });
  // Promedios calibrados de antes y de después (los que compara la razón).
  const tramos = [anios.filter((a) => a.y < 2012), anios.filter((a) => a.y > 2012)];
  for (const tramo of tramos) {
    if (!tramo.length) continue;
    const i0 = anios.indexOf(tramo[0]), i1 = anios.indexOf(tramo[tramo.length - 1]);
    const v = tramo.reduce((s, a) => s + a.cal, 0) / tramo.length;
    el('line', { x1: X(i0) - 2, x2: X(i1) + w + 2, y1: Y(v), y2: Y(v), stroke: TINTA, 'stroke-width': 2, 'stroke-dasharray': '6 3' }, svg);
  }
  // La razón en una recta: meta, variación normal, 1 = sin salto, y los dos valores.
  const a1 = tramos[0][0].y, a2 = tramos[0][tramos[0].length - 1].y, d1 = tramos[1][0].y, d2 = tramos[1][tramos[1].length - 1].y;
  const r0 = base + 68, alto = 26;
  texto(svg, 0, r0 - 28, t('mGvRazonT', { a1, a2, d1, d2 }), { 'font-size': 13, 'font-weight': 700, fill: TINTA, style: 'font-family: var(--texto)' });
  const tope = Math.max(4, Math.ceil(g.razonCruda + 0.5));
  const R = (v) => izq + (v / tope) * (der - izq);
  el('rect', { x: R(g.meta[0]), y: r0, width: R(g.meta[1]) - R(g.meta[0]), height: alto, fill: BANDA }, svg);
  el('rect', { x: R(g.natural[0]), y: r0 + 5, width: R(g.natural[1]) - R(g.natural[0]), height: alto - 10, fill: BANDA_2 }, svg);
  el('line', { x1: izq, x2: der, y1: r0 + alto + 0.5, y2: r0 + alto + 0.5, stroke: TINTA, 'stroke-width': 1 }, svg);
  el('line', { x1: R(1), x2: R(1), y1: r0 - 2, y2: r0 + alto + 4, stroke: TINTA, 'stroke-width': 1.2 }, svg);
  for (let v = 0; v <= tope; v++) texto(svg, R(v), r0 + alto + 15, String(v), { 'text-anchor': 'middle' });
  texto(svg, R(1) + 5, r0 + alto + 29, t('mGvSinSalto'));
  el('circle', { cx: R(g.razonCruda), cy: r0 + alto / 2, r: 5, fill: BLANCO, stroke: TINTA_2, 'stroke-width': 2 }, svg);
  const rc = texto(svg, R(g.razonCruda), r0 - 5, t('mGvRazonCrudo', { r: dec(g.razonCruda, 2) }), { 'text-anchor': 'middle', 'font-weight': 700, fill: TINTA });
  // Que no se salga por la derecha en el teléfono.
  const largo = rc.getComputedTextLength ? rc.getComputedTextLength() : 0;
  if (R(g.razonCruda) + largo / 2 > der) { rc.setAttribute('x', der); rc.setAttribute('text-anchor', 'end'); }
  el('circle', { cx: R(g.razonCal), cy: r0 + alto / 2, r: 5.5, fill: TINTA, stroke: BLANCO, 'stroke-width': 1.5 }, svg);
  // El valor corregido va a la derecha de la meta; si ahí choca con el de sin corregir, va arriba.
  const rk = texto(svg, R(g.meta[1]) + 6, r0 + alto / 2 + 4, t('mGvRazonCal', { r: dec(g.razonCal, 2) }), { 'font-weight': 700, fill: TINTA });
  const largoK = rk.getComputedTextLength ? rk.getComputedTextLength() : 0;
  if (R(g.meta[1]) + 6 + largoK > R(g.razonCruda) - 8) { rk.setAttribute('x', R(g.razonCal)); rk.setAttribute('y', r0 - 5); rk.setAttribute('text-anchor', 'middle'); }
  svg.setAttribute('viewBox', `0 0 ${ancho} ${r0 + alto + 36}`);
  return [
    ['hueco-cuadro', GRIS, t('mGvModisCrudo')], ['rayado', GRIS, t('mGvModisCal')], ['cuadro', GRIS, t('mGvSnpp')],
    ['raya', TINTA, t('mGvPromedio', { a: a1, b: a2, c: d1, d: d2 })],
    ['cuadro', BANDA, t('mGvMeta') + ' ' + dec(g.meta[0], 2) + '–' + dec(g.meta[1], 2)],
    ['cuadro', BANDA_2, t('mGvNatural') + ' ' + dec(g.natural[0], 2) + '–' + dec(g.natural[1], 2)],
  ];
}

/** Prueba 2: lo que vio S-NPP contra Aqua convertido, en años que no se usaron para calibrar. */
function aqua(svg, g, ancho) {
  const izq = 52, der = ancho - 4, arriba = 10, base = 180;
  const max = Math.max(...g.anios.map((a) => Math.max(a.snpp, a.zonaEpoca, a.unico))) * 1.08;
  const Y = ejeY(svg, { izq, der, arriba, base, max, marcas: marcasDe(max) });
  const paso = (der - izq) / g.anios.length, hueco = Math.max(6, paso * 0.22), w = (paso - hueco) / 3;
  g.anios.forEach((a, i) => {
    const x = izq + i * paso + hueco / 2;
    barra(svg, x, Y(a.snpp), w, base, GRIS, `${a.y} · ${t('mGvObservado')}: ${fmt(a.snpp)}`);
    barra(svg, x + w, Y(a.zonaEpoca), w, base, TINTA, `${a.y} · ${t('mGvZonaEpoca')}: ${fmt(a.zonaEpoca)}`);
    barra(svg, x + 2 * w + 0.75, Y(a.unico), w - 1.5, base, BLANCO, `${a.y} · ${t('mGvUnico')}: ${fmt(a.unico)}`, { stroke: TINTA, 'stroke-width': 1.5 });
    texto(svg, x + 1.5 * w, base + 15, String(a.y), { 'text-anchor': 'middle' });
  });
  svg.setAttribute('viewBox', `0 0 ${ancho} ${base + 22}`);
  return [['cuadro', GRIS, t('mGvObservado')], ['cuadro', TINTA, t('mGvZonaEpoca')], ['hueco-cuadro', TINTA, t('mGvUnico')]];
}

/** Prueba 3: incendios de la CONAFOR con focos cerca, contra el azar y según su tamaño. */
function conafor(svg, g, ancho) {
  const izq = 0, der = ancho - 44;
  const P = (v) => izq + (v / 100) * (der - izq);
  let y = 14;
  for (const [txt, v, color] of [[t('mGvConaforReal'), g.real, TINTA], [t('mGvConaforAzar'), g.azar, GRIS]]) {
    y += (partir(texto(svg, izq, y, txt, { 'font-size': 13, fill: TINTA, style: 'font-family: var(--texto)' }), ancho - izq) - 1) * 16;
    el('rect', { x: izq, y: y + 5, width: P(v) - izq, height: 16, fill: color }, svg);
    texto(svg, P(v) + 6, y + 18, t('mPct', { n: v }), { 'font-weight': 700, fill: TINTA });
    y += 42;
  }
  // Según el tamaño.
  const titulo = texto(svg, izq, y + 6, t('mGvTamanosT'), { 'font-size': 13, fill: TINTA, style: 'font-family: var(--texto)' });
  const t0 = y + 6 + (partir(titulo, ancho - izq) - 1) * 16, base = t0 + 130, izq2 = 30, der2 = ancho - 4;
  const Y = (v) => base - (v / 100) * (base - t0 - 22);
  for (const v of [0, 50, 100]) {
    el('line', { x1: izq2, x2: der2, y1: Y(v), y2: Y(v), stroke: LINEA, 'stroke-width': 1 }, svg);
    texto(svg, izq2 - 6, Y(v) + 4, String(v), { 'text-anchor': 'end' });
  }
  // La meta va antes que las barras: las barras y sus cifras quedan encima.
  el('line', { x1: izq2, x2: der2, y1: Y(g.metaGrandes), y2: Y(g.metaGrandes), stroke: TINTA, 'stroke-width': 1.2, 'stroke-dasharray': '5 3' }, svg);
  texto(svg, izq2 + 4, Y(g.metaGrandes) - 4, t('mGvMetaGrandes', { n: g.metaGrandes }), { fill: TINTA, 'paint-order': 'stroke', stroke: BLANCO, 'stroke-width': 4 });
  const paso = (der2 - izq2) / g.tamanos.length, w = paso * 0.68;
  g.tamanos.forEach((c, i) => {
    const x = izq2 + i * paso + (paso - w) / 2;
    barra(svg, x, Y(c.pct), w, base, i === g.tamanos.length - 1 ? TINTA : GRIS, `${c.t} ha: ${t('mPct', { n: c.pct })} (${fmt(c.n)})`);
    // Con halo blanco: la raya de la meta puede pasar por la cifra.
    texto(svg, x + w / 2, Y(c.pct) - 4, String(c.pct), { 'text-anchor': 'middle', 'font-weight': 700, fill: TINTA, 'paint-order': 'stroke', stroke: BLANCO, 'stroke-width': 4 });
    texto(svg, x + w / 2, base + 15, c.t, { 'text-anchor': 'middle' });
  });
  el('line', { x1: izq2, x2: der2, y1: base + 0.5, y2: base + 0.5, stroke: TINTA, 'stroke-width': 1 }, svg);
  svg.setAttribute('viewBox', `0 0 ${ancho} ${base + 22}`);
  return [];
}

/** Prueba 4: cuántos focos ve cada NOAA por cada uno de S-NPP, año por año, contra la meta. */
function viirs(svg, g, ancho) {
  const izq = 40, der = ancho - 8, arriba = 8, base = 170, lo = 0.88, hi = 1.12;
  const anios = [...new Set([...g.noaa20, ...g.noaa21].map((a) => a.y))].sort((a, b) => a - b);
  const paso = (der - izq) / anios.length;
  const X = (y) => izq + (anios.indexOf(y) + 0.5) * paso;
  const Y = (v) => base - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (base - arriba);
  el('rect', { x: izq, y: Y(g.meta[1]), width: der - izq, height: Y(g.meta[0]) - Y(g.meta[1]), fill: BANDA }, svg);
  for (const v of [0.9, 1, 1.1]) {
    if (v !== 1) el('line', { x1: izq, x2: der, y1: Y(v), y2: Y(v), stroke: LINEA, 'stroke-width': 1 }, svg);
    texto(svg, izq - 6, Y(v) + 4, dec(v, 2), { 'text-anchor': 'end' });
  }
  el('line', { x1: izq, x2: der, y1: Y(1), y2: Y(1), stroke: TINTA, 'stroke-width': 1 }, svg);
  el('line', { x1: izq, x2: der, y1: base + 0.5, y2: base + 0.5, stroke: TINTA, 'stroke-width': 1 }, svg);
  const corto = paso < 40;
  for (const y of anios) texto(svg, X(y), base + 15, corto ? "'" + String(y).slice(2) : String(y), { 'text-anchor': 'middle' });
  // NOAA-20 a la izquierda del centro de su año y NOAA-21 a la derecha: no se enciman aunque cuenten lo mismo.
  const lado = Math.min(paso * 0.25, 9);
  for (const a of g.noaa21) {
    const s = el('rect', { x: (X(a.y) + lado - 4.5).toFixed(1), y: (Y(a.razon) - 4.5).toFixed(1), width: 9, height: 9, fill: a.completo ? GRIS : BLANCO, stroke: GRIS, 'stroke-width': 2 }, svg);
    el('title', {}, s).textContent = `${a.y} · NOAA-21: ${dec(a.razon, 2)}`;
  }
  for (const a of g.noaa20) {
    const c = el('circle', { cx: (X(a.y) - lado).toFixed(1), cy: Y(a.razon).toFixed(1), r: 4.5, fill: a.completo ? TINTA : BLANCO, stroke: TINTA, 'stroke-width': 2 }, svg);
    el('title', {}, c).textContent = `${a.y} · NOAA-20: ${dec(a.razon, 2)}`;
  }
  svg.setAttribute('viewBox', `0 0 ${ancho} ${base + 22}`);
  return [
    ['punto', TINTA, t('mGvNoaa20')], ['caja', GRIS, t('mGvNoaa21')], ['hueco', TINTA_2, t('mGvParcial')],
    ['cuadro', BANDA, t('mGvMeta') + ' ' + dec(g.meta[0], 2) + '–' + dec(g.meta[1], 2)],
  ];
}

const DIBUJOS = { salto_2012: salto, aqua_fuera_muestra: aqua, conafor, viirs };
const TITULOS = { salto_2012: 'mGvSaltoT', aqua_fuera_muestra: 'mGvAquaT', viirs: 'mGvViirsT' };

/** Dibuja la gráfica de la prueba `p` en `svg`; devuelve [título o null, leyenda]. */
export function dibujarPrueba(svg, p, nombre) {
  svg.textContent = '';
  svg.dataset.prueba = p.id;
  const ancho = Math.max(280, Math.round(svg.parentNode.clientWidth || 440));
  const ley = (DIBUJOS[p.id] || (() => []))(svg, p.grafica, ancho);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', t('mGvAria', { n: nombre }));
  return [TITULOS[p.id] ? t(TITULOS[p.id]) : null, ley];
}
