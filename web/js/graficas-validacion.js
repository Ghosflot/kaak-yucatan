// Las gráficas de las cuatro pruebas de la validación (tarea 7), dibujadas en la página con los
// datos de web/datos/validacion.json. Son las mismas que las PNG de salidas/graficas/ que hace
// pipeline/validar.py: las mismas partes, en el mismo orden y con los mismos textos (las claves
// mGv… de web/textos son validar.ETIQUETAS tal cual). Solo cambian los colores, que son los de la
// página. Con poco ancho, el segundo panel va debajo del primero en lugar de a su lado.
// Cada función dibuja en `svg` con el ancho que tiene en pantalla y devuelve el alto que ocupó.
import { t } from './textos.js';
import { fmt, el } from './comun.js';

const TINTA = '#121212';
const TINTA_2 = '#4A4743';
const LINEA = '#E4E1DC';    // la rejilla
const EJE = '#C3BDB3';      // los ejes
const GRIS = '#8F877D';     // sin calibrar, el azar, S-NPP en la prueba de Aqua
const ROJO = '#D7261E';     // calibrado / con su factor / lo que se mide
const ROJO_CLARO = '#EFA29D';
const BANDA = '#EFECE6';    // el umbral fijado de antemano
const BANDA_2 = '#DCD6CC';  // el rango natural
const BLANCO = '#FFFFFF';
const PALABRAS = 'font-family: var(--texto)';
const TITULO = { tam: 12.5, color: TINTA, palabras: true };
let serie = 0; // para que los patrones de cada gráfica tengan su propio id

// Un rótulo de las PNG (validar.ETIQUETAS): «focos_sin_calibrar» → t('mGvFocosSinCalibrar').
const e = (k, v) => t('mGv' + k, v);
const f1 = (v) => (+v).toFixed(1);
const pct = (v) => `${Math.round(v)} %`;

// Texto de una o varias líneas («\n»). alinear: 'base' (y es la línea base de la primera),
// 'abajo' (la última línea queda en y), 'medio' (centrado en y) o 'arriba' (empieza en y).
function texto(svg, x, y, s, o = {}) {
  const { tam = 11, color = TINTA_2, ancla = 'start', peso, palabras = false, alinear = 'base', ...resto } = o;
  const lineas = String(s).split('\n');
  const lh = tam * 1.2;
  let y0 = y;
  if (alinear === 'abajo') y0 = y - (lineas.length - 1) * lh;
  else if (alinear === 'medio') y0 = y - ((lineas.length - 1) * lh) / 2 + tam * 0.35;
  else if (alinear === 'arriba') y0 = y + tam * 0.8;
  const attrs = { x: f1(x), y: f1(y0), 'font-size': tam, fill: color, 'text-anchor': ancla, ...resto };
  if (peso) attrs['font-weight'] = peso;
  if (palabras) attrs.style = PALABRAS;
  const n = el('text', attrs, svg);
  if (lineas.length === 1) n.textContent = lineas[0];
  else lineas.forEach((l, i) => { el('tspan', { x: f1(x), dy: i ? lh.toFixed(1) : 0 }, n).textContent = l; });
  return n;
}

// La caja de un texto ya dibujado (con una estimación si el navegador todavía no lo midió).
function medida(n) {
  try {
    const b = n.getBBox();
    if (b.width) return b;
  } catch { /* sin medir */ }
  const tam = +n.getAttribute('font-size') || 11;
  const lineas = n.querySelectorAll('tspan').length || 1;
  const w = Math.max(...[...(n.querySelectorAll('tspan').length ? n.querySelectorAll('tspan') : [n])].map((x) => x.textContent.length)) * tam * 0.58;
  const ancla = n.getAttribute('text-anchor');
  const x = +n.getAttribute('x') - (ancla === 'end' ? w : ancla === 'middle' ? w / 2 : 0);
  return { x, y: +n.getAttribute('y') - tam * 0.8, width: w, height: lineas * tam * 1.2 };
}

// Achica la letra (el texto no cambia) hasta que quepa en `max` px de ancho.
function ajustar(n, max) {
  let tam = +n.getAttribute('font-size');
  while (medida(n).width > max && tam > 7) {
    tam -= 0.5;
    n.setAttribute('font-size', tam);
  }
}

// El título de un panel; si no cabe entre x y der, empieza en `desde` y, si aún no cabe, se achica.
function titulo(svg, x, y, s, der, desde = x) {
  const n = texto(svg, x, y, s, TITULO);
  if (medida(n).width > der - x && desde < x) {
    n.setAttribute('x', f1(desde));
    n.querySelectorAll('tspan').forEach((ts) => ts.setAttribute('x', f1(desde)));
  }
  ajustar(n, der - Math.min(x, desde));
  return n;
}

// ✓ (o ✗) pegada a un texto ya dibujado, a su derecha o a su izquierda (como _marca de validar.py).
function marca(svg, ok, junto, { izquierda = false, dx = 5 } = {}) {
  const b = medida(junto);
  const x = izquierda ? b.x - dx : b.x + b.width + dx;
  return texto(svg, x, b.y + b.height / 2, ok ? '✓' : '✗', {
    tam: 15, peso: 700, color: ok ? TINTA : ROJO, ancla: izquierda ? 'end' : 'start', alinear: 'medio', palabras: true,
  });
}

function defs(svg) {
  return svg.querySelector('defs') || el('defs', {}, svg);
}

// Barra rayada (la transición de 2012) y barra con puntos (el factor único), como en las PNG.
function rayas(svg, id, color) {
  const p = el('pattern', { id, width: 6, height: 6, patternUnits: 'userSpaceOnUse' }, defs(svg));
  el('rect', { width: 6, height: 6, fill: BLANCO }, p);
  el('path', { d: 'M-1,1 l2,-2 M0,6 l6,-6 M5,7 l2,-2', stroke: color, 'stroke-width': 1 }, p);
  return `url(#${id})`;
}

function puntos(svg, id, fondo) {
  const p = el('pattern', { id, width: 5, height: 5, patternUnits: 'userSpaceOnUse' }, defs(svg));
  el('rect', { width: 5, height: 5, fill: fondo }, p);
  el('circle', { cx: 2.5, cy: 2.5, r: 0.9, fill: BLANCO }, p);
  return `url(#${id})`;
}

// El paso de las marcas del eje: el número redondo más chico que deja 9 marcas o menos.
function pasoBonito(max) {
  const bruto = max / 9;
  const p = 10 ** Math.floor(Math.log10(bruto));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= bruto - 1e-9) return m * p;
  return 10 * p;
}

// Rejilla horizontal con sus números a la izquierda y los ejes; devuelve la escala.
function ejeY(svg, { izq, der, arriba, base, max, min = 0, paso, etiquetas = true, formato = fmt }) {
  const Y = (v) => base - ((v - min) / (max - min)) * (base - arriba);
  for (let k = 0; min + k * paso <= max + 1e-9; k++) {
    const v = min + k * paso;
    el('line', { x1: izq, x2: der, y1: f1(Y(v)), y2: f1(Y(v)), stroke: LINEA, 'stroke-width': 1 }, svg);
    if (etiquetas) texto(svg, izq - 6, Y(v), formato(v), { ancla: 'end', alinear: 'medio' });
  }
  ejes(svg, izq, der, arriba, base);
  return Y;
}

function ejes(svg, izq, der, arriba, base) {
  el('line', { x1: izq, x2: izq, y1: arriba, y2: base, stroke: EJE, 'stroke-width': 1 }, svg);
  el('line', { x1: izq, x2: der, y1: base + 0.5, y2: base + 0.5, stroke: EJE, 'stroke-width': 1 }, svg);
}

function barra(svg, x, y, w, base, fill, titulo, extra = {}) {
  const r = el('rect', { x: f1(x), y: f1(y), width: f1(Math.max(1, w)), height: f1(Math.max(0, base - y)), fill, ...extra }, svg);
  if (titulo) el('title', {}, r).textContent = titulo;
  return r;
}

/** Prueba 1 · Salto de 2012: sin calibrar y calibrada, con sus promedios, y la razón contra el umbral. */
function salto(svg, g, ancho, pre) {
  const lado = ancho >= 620;
  const izq = 52, hueco = 22, altoPlot = 190;
  const anchoPanel = lado ? (ancho - izq - 4 - hueco) / 2 : ancho - izq - 4;
  const alto = Math.max(...g.anios.flatMap((a) => [a.crudo, a.cal])) * 1.15;
  const paso = pasoBonito(alto);
  const a0 = g.anios[0].y, a1 = g.anios[g.anios.length - 1].y;
  let fondo = 0;
  [['crudo', GRIS, 'FocosSinCalibrar'], ['cal', ROJO, 'FocosCalibrada']].forEach(([campo, color, clave], k) => {
    const x0 = lado ? izq + k * (anchoPanel + hueco) : izq;
    const top = lado ? 4 : 4 + k * (altoPlot + 62);
    titulo(svg, x0, top + 13, e(clave), x0 + anchoPanel);
    const arriba = top + 26, base = arriba + altoPlot;
    const Y = ejeY(svg, { izq: x0, der: x0 + anchoPanel, arriba, base, max: alto, paso, etiquetas: !lado || k === 0 });
    const u = anchoPanel / (a1 - a0 + 1.2);
    const X = (a) => x0 + (a - a0 + 0.6) * u;
    const relleno = rayas(svg, `${pre}-rayas-${campo}`, color);
    for (const a of g.anios) {
      const v = a[campo];
      barra(svg, X(a.y) - 0.4 * u, Y(v), 0.8 * u, base, a.transicion ? relleno : color, `${a.y}: ${fmt(v)}`,
        a.transicion ? { stroke: color, 'stroke-width': 1 } : {});
      texto(svg, X(a.y), base + 16, String(a.y), { ancla: 'middle' });
    }
    // El rótulo de la transición va después de las barras, para que ninguna lo tape.
    for (const a of g.anios.filter((x) => x.transicion)) {
      texto(svg, X(a.y), Y(a[campo]) - 5, e('Transicion'), { tam: 9.5, ancla: 'middle', alinear: 'abajo', palabras: true });
    }
    // Los promedios de antes y de después, con su número en una cajita.
    for (const [per, prom] of [[g.antes, g.promAntes], [g.despues, g.promDespues]]) {
      const v = prom[campo];
      el('line', { x1: f1(X(per[0] - 0.45)), x2: f1(X(per[1] + 0.45)), y1: f1(Y(v)), y2: f1(Y(v)), stroke: TINTA, 'stroke-width': 2.2 }, svg);
      const n = texto(svg, X((per[0] + per[1]) / 2), Y(v), `${e('Promedio')} ${fmt(v)}`, { tam: 10, color: TINTA, ancla: 'middle', alinear: 'medio', palabras: true });
      const b = medida(n);
      svg.insertBefore(el('rect', { x: f1(b.x - 4), y: f1(b.y - 2), width: f1(b.width + 8), height: f1(b.height + 4), rx: 3, fill: BLANCO, stroke: TINTA, 'stroke-width': 0.8 }), n);
    }
    fondo = Math.max(fondo, base + 20);
  });

  // Promedio 2013–15 ÷ promedio 2009–11, en una recta.
  const r0 = fondo + 14;
  titulo(svg, izq, r0 + 13, e('RazonSalto'), ancho - 4, 0);
  const top = r0 + 26, altoR = 64, baseR = top + altoR, centro = top + altoR / 2;
  const [lo, hi] = g.umbral, [nmin, nmax] = g.natural;
  const xmin = Math.min(0, g.razonCal - 0.75), xmax = Math.max(g.razonCruda, g.razonCal, hi) * 1.25;
  const derR = ancho - 4;
  const R = (v) => izq + ((v - xmin) / (xmax - xmin)) * (derR - izq);
  el('rect', { x: f1(R(lo)), y: top, width: f1(R(hi) - R(lo)), height: altoR, fill: BANDA }, svg);
  el('rect', { x: f1(R(nmin)), y: f1(top + 0.3 * altoR), width: f1(R(nmax) - R(nmin)), height: f1(0.4 * altoR), fill: BANDA_2 }, svg);
  el('line', { x1: f1(R(1)), x2: f1(R(1)), y1: top, y2: baseR, stroke: TINTA, 'stroke-width': 0.8 }, svg);
  el('line', { x1: izq, x2: derR, y1: baseR + 0.5, y2: baseR + 0.5, stroke: EJE, 'stroke-width': 1 }, svg);
  ajustar(texto(svg, R(lo) + 4, top + 4, e('Umbral'), { tam: 9.5, alinear: 'arriba', palabras: true }), R(1) - R(lo) - 9);
  const natural = texto(svg, R(nmax) + 5, centro, `${e('RangoNatural')} ${nmin.toFixed(2)}–${nmax.toFixed(2)}`, { tam: 9.5, alinear: 'medio', palabras: true });
  // Cada nombre hacia afuera: lo calibrado a la izquierda de su punto, lo crudo a la derecha.
  const etiq = [];
  for (const [v, color, nombre, ok] of [[g.razonCruda, GRIS, 'SinCalibrar', null], [g.razonCal, ROJO, 'Calibrada', g.pasa]]) {
    el('circle', { cx: f1(R(v)), cy: centro, r: 6.5, fill: color, stroke: BLANCO, 'stroke-width': 1.5 }, svg);
    const izquierda = ok !== null;
    const n = texto(svg, R(v) + (izquierda ? -11 : 11), centro, `${e(nombre)}: ${v.toFixed(2)}`, {
      tam: 11.5, peso: 700, color: TINTA, ancla: izquierda ? 'end' : 'start', alinear: 'medio', palabras: true,
    });
    const m = izquierda ? marca(svg, ok, n, { izquierda: true }) : null;
    // Sin sitio a su lado (pantallas angostas): encima de su punto.
    const b = medida(m || n), bn = medida(n);
    if (b.x < 2 || bn.x + bn.width > ancho - 2) {
      n.setAttribute('text-anchor', 'middle');
      n.setAttribute('x', f1(Math.min(ancho - 2 - bn.width / 2, Math.max(bn.width / 2 + (m ? 20 : 2), R(v)))));
      n.setAttribute('y', f1(centro - 13));
      if (m) {
        const nb = medida(n);
        m.setAttribute('x', f1(nb.x - 5));
        m.setAttribute('y', f1(centro - 13));
      }
    }
    etiq.push(medida(n));
  }
  // Si el rango natural choca con el nombre de lo crudo, baja a la parte de abajo de la banda.
  const bn = medida(natural);
  if (etiq.some((b) => bn.x < b.x + b.width && b.x < bn.x + bn.width && Math.abs((b.y + b.height / 2) - centro) < 8) || bn.x + bn.width > R(g.razonCruda) - 8) {
    natural.setAttribute('y', f1(top + 0.85 * altoR + 3));
    ajustar(natural, derR - R(nmax) - 5);
  }
  const marcas = [...new Set([0, lo, 1, hi, ...Array.from({ length: Math.floor(xmax) - 1 }, (_, i) => i + 2)])].filter((v) => v >= xmin && v <= xmax);
  for (const v of marcas) texto(svg, R(v), baseR + 16, v === 1 ? `1\n${e('SinSalto')}` : String(v), { ancla: 'middle' });
  return baseR + 16 + 13 + 8;
}

/** Prueba 2 · Aqua en años fuera de la calibración: cuadritos-día por año y el error de cada modelo. */
function aqua(svg, g, ancho, pre) {
  const lado = ancho >= 620;
  const izq = 52, hueco = 46, altoPlot = 200;
  const total = ancho - izq - 4;
  const w1 = lado ? ((total - hueco) * 1.7) / 2.45 : total;
  const x2 = lado ? izq + w1 + hueco : izq;
  const w2 = lado ? ((total - hueco) * 0.75) / 2.45 : Math.min(total, 300);
  const conPuntos = puntos(svg, `${pre}-puntos`, ROJO_CLARO);
  // Cuadritos-día por año.
  titulo(svg, izq, 17, e('FocosAnio'), izq + w1);
  const arriba = 30, base = arriba + altoPlot;
  const max1 = Math.max(...g.anios.flatMap((a) => [a.snpp, a.zonaEpoca, a.unico])) * 1.35;
  const Y = ejeY(svg, { izq, der: izq + w1, arriba, base, max: max1, paso: pasoBonito(max1) });
  const u = w1 / (g.anios.length - 1 + 1.2);
  const X = (i) => izq + (i + 0.6) * u;
  const series = [['snpp', GRIS, 'Snpp'], ['zonaEpoca', ROJO, 'AquaZona'], ['unico', conPuntos, 'AquaUnico']];
  g.anios.forEach((a, i) => {
    series.forEach(([campo, color, nombre], k) => {
      barra(svg, X(i) + (k - 1) * 0.27 * u - 0.125 * u, Y(a[campo]), 0.25 * u, base, color, `${a.y} · ${e(nombre)}: ${fmt(a[campo])}`,
        { stroke: BLANCO, 'stroke-width': 0.5 });
    });
    texto(svg, X(i), base + 16, String(a.y), { ancla: 'middle' });
  });
  // La leyenda, arriba a la izquierda dentro de la gráfica.
  series.forEach(([, color, nombre], k) => {
    const y = arriba + 12 + k * 18;
    el('rect', { x: izq + 12, y: y - 5, width: 18, height: 10, fill: color }, svg);
    ajustar(texto(svg, izq + 38, y, e(nombre), { tam: 10.5, color: TINTA, alinear: 'medio', palabras: true }), w1 - 44);
  });
  // Error de Aqua contra S-NPP (%).
  const top2 = lado ? 4 : base + 34;
  titulo(svg, x2, top2 + 13, e('Error'), lado ? ancho - 4 : x2 + w2, lado ? x2 : 0);
  const arriba2 = top2 + 26, base2 = arriba2 + altoPlot;
  const vals = [g.error.zonaEpoca, g.error.unico];
  const max2 = Math.max(...vals, g.limite) * 1.3;
  const Y2 = ejeY(svg, { izq: x2, der: x2 + w2, arriba: arriba2, base: base2, max: max2, paso: pasoBonito(max2), formato: (v) => String(Math.round(v)) });
  const X2 = (v) => x2 + ((v + 0.55) / 2.1) * w2;
  const elegido = g.elegido === 'zonaEpoca' ? 0 : 1;
  const nombres = [e('ZonaEpoca'), e('Unico')];
  nombres[elegido] += `\n(${e('Elegido')})`;
  vals.forEach((v, k) => {
    const wb = (0.6 / 2.1) * w2;
    barra(svg, X2(k) - wb / 2, Y2(v), wb, base2, k === 0 ? ROJO : conPuntos, `${nombres[k].replace('\n', ' ')}: ${pct(v)}`);
    const n = texto(svg, X2(k), Y2(v) - 5, pct(v), { tam: 11, color: TINTA, ancla: 'middle', peso: k === elegido ? 700 : null, palabras: true });
    if (k === elegido) marca(svg, g.pasa, n, { dx: 3 });
    texto(svg, X2(k), base2 + 16, nombres[k], { tam: 10.5, ancla: 'middle', palabras: true });
  });
  el('line', { x1: x2, x2: x2 + w2, y1: f1(Y2(g.limite)), y2: f1(Y2(g.limite)), stroke: TINTA, 'stroke-width': 1, 'stroke-dasharray': '4 3' }, svg);
  texto(svg, X2(1.45), Y2(g.limite) - 4, `${e('Limite')} ${pct(g.limite)}`, { tam: 10, color: TINTA, ancla: 'end', palabras: true });
  return base2 + 16 + 3 * 12.6 + 4;
}

/** Prueba 3 · Incendios de CONAFOR: con un foco de S-NPP cerca contra el azar, y según su tamaño. */
function conafor(svg, g, ancho, pre) {
  const lado = ancho >= 700;
  const hueco = 40, altoPlot = 170, total = ancho - 4;
  const wL = lado ? ((total - hueco) * 1.1) / 2.1 : total;
  // Los nombres de las filas, a la izquierda (se miden primero para saber dónde empieza el eje).
  const filas = [['real', ROJO, 'Real'], ['controlAnio', GRIS, 'ControlAnio'], ['controlLugar', GRIS, 'ControlLugar']];
  const nombres = filas.map(([, , k]) => texto(svg, 0, 0, e(k), { tam: 11, ancla: 'end', palabras: true }));
  const ax0 = Math.min(Math.max(...nombres.map((n) => medida(n).width)) + 10, wL * 0.48);
  nombres.forEach((n) => ajustar(n, ax0 - 10));
  const ax1 = wL - 40;
  titulo(svg, ax0, 17, e('ConFocos'), wL, 0);
  const arriba = 46, base = arriba + altoPlot;
  const Yr = (v) => base - ((v + 0.5) / 3.25) * altoPlot;
  const P = (v) => ax0 + (v / 100) * (ax1 - ax0);
  for (let v = 0; v <= 100; v += 20) {
    el('line', { x1: f1(P(v)), x2: f1(P(v)), y1: arriba, y2: base, stroke: LINEA, 'stroke-width': 1 }, svg);
    texto(svg, P(v), base + 16, String(v), { ancla: 'middle' });
  }
  ejes(svg, ax0, ax1, arriba, base);
  const altoBarra = (0.6 / 3.25) * altoPlot;
  filas.forEach(([campo, color], i) => {
    const yy = filas.length - 1 - i; // lo real arriba
    const v = g[campo];
    el('rect', { x: ax0, y: f1(Yr(yy) - altoBarra / 2), width: f1(P(v) - ax0), height: f1(altoBarra), fill: color }, svg);
    nombres[i].setAttribute('x', f1(ax0 - 8));
    nombres[i].setAttribute('y', f1(Yr(yy) + 11 * 0.35));
    const n = texto(svg, P(v) + 5, Yr(yy), pct(v), { tam: 11, color: TINTA, alinear: 'medio', peso: campo === 'real' ? 700 : null, palabras: true });
    if (campo === 'real') marca(svg, g.superaAzar, n);
  });
  el('line', { x1: f1(P(g.metaAzar)), x2: f1(P(g.metaAzar)), y1: base, y2: f1(base - 0.88 * altoPlot), stroke: TINTA, 'stroke-width': 1, 'stroke-dasharray': '4 3' }, svg);
  ajustar(texto(svg, P(g.metaAzar), Yr(2.45), `${e('VecesAzar')} = ${pct(g.metaAzar)}`, { tam: 10, color: TINTA, alinear: 'medio', palabras: true }), wL - P(g.metaAzar));

  // Incendios que vio S-NPP, según su tamaño (%).
  const x2 = lado ? wL + hueco : 0;
  const topR = lado ? 4 : base + 36;
  const izqR = x2 + 34, derR = total;
  titulo(svg, izqR, topR + 13, e('PorTamano'), derR, x2);
  const arribaR = topR + 42, baseR = arribaR + altoPlot;
  const YR = ejeY(svg, { izq: izqR, der: derR, arriba: arribaR, base: baseR, max: 110, paso: 20, formato: String });
  const n = g.tamanos.length, u = (derR - izqR) / (n - 1 + 1.2);
  const XT = (k) => izqR + (k + 0.6) * u;
  const peque = u < 46;
  g.tamanos.forEach((c, k) => {
    barra(svg, XT(k) - 0.3 * u, YR(c.pct), 0.6 * u, baseR, ROJO, `${c.t} ha: ${pct(c.pct)} (${fmt(c.n)})`);
    const v = texto(svg, XT(k), YR(c.pct) - 5, String(Math.round(c.pct)), { tam: 11, color: TINTA, ancla: 'middle', peso: c.grande ? 700 : null, palabras: true });
    if (c.grande) {
      marca(svg, g.veGrandes, v, { dx: 3 });
      el('line', { x1: f1(XT(k) - 0.45 * u), x2: f1(XT(k) + 0.45 * u), y1: f1(YR(g.minimo)), y2: f1(YR(g.minimo)), stroke: TINTA, 'stroke-width': 1.2, 'stroke-dasharray': '4 3' }, svg);
      texto(svg, XT(k) - 0.5 * u - 2, YR(g.minimo) - 3, `${e('Minimo')} ${pct(g.minimo)}`, { tam: 10, color: TINTA, ancla: 'end', palabras: true });
    }
    texto(svg, XT(k), baseR + 15, `${c.t}\n(${fmt(c.n)})`, { tam: peque ? 9 : 10, ancla: 'middle', palabras: true });
  });
  const nota = e('Tamano') + (g.sinRango ? '\n' + e('SinRango', { n: g.sinRango }) : '');
  const yNota = baseR + 15 + 2 * 12 + 12;
  ajustar(texto(svg, (izqR + derR) / 2, yNota, nota, { tam: 9.5, ancla: 'middle', palabras: true }), derR - x2);
  return yNota + (g.sinRango ? 11.4 : 0) + 8;
}

/** Prueba 4 · NOAA-20 y NOAA-21 contra S-NPP: la razón año por año dentro del umbral. */
function viirs(svg, g, ancho) {
  const izq = 74, der = ancho - 6, arriba = 8, altoPlot = 250, base = arriba + altoPlot;
  const [lo, hi] = g.eje, [b0, b1] = g.banda;
  const Y = (v) => base - ((v - lo) / (hi - lo)) * altoPlot;
  const anios = [...new Set([...g.noaa20, ...g.noaa21].map((a) => a.y))].sort((a, b) => a - b);
  const a0 = anios[0], a1 = anios[anios.length - 1];
  const u = (der - izq) / (a1 - a0 + 1.2);
  const X = (a) => izq + (a - a0 + 0.6) * u;
  el('rect', { x: izq, y: f1(Y(b1)), width: der - izq, height: f1(Y(b0) - Y(b1)), fill: BANDA }, svg);
  texto(svg, izq + 6, Y(b1) + 5, `${e('Umbral')} ${b0.toFixed(2)}–${b1.toFixed(2)}`, { tam: 9.5, alinear: 'arriba', palabras: true });
  el('line', { x1: izq, x2: der, y1: f1(Y(1)), y2: f1(Y(1)), stroke: TINTA, 'stroke-width': 0.8 }, svg);
  for (let k = Math.round(lo * 20); k <= Math.round(hi * 20); k++) texto(svg, izq - 6, Y(k / 20), (k / 20).toFixed(2), { ancla: 'end', alinear: 'medio' });
  ejes(svg, izq, der, arriba, base);
  const ylab = texto(svg, 16, (arriba + base) / 2, `${e('RazonViirs')}\n(${e('Iguales')})`, {
    tam: 11, color: TINTA, ancla: 'middle', alinear: 'medio', palabras: true, transform: `rotate(-90 16 ${f1((arriba + base) / 2)})`,
  });
  ajustar(ylab, altoPlot);
  for (const a of anios) texto(svg, X(a), base + 16, String(a), { ancla: 'middle', tam: u < 34 ? 9.5 : 11 });
  // NOAA-21 (cuadros), NOAA-20 sin factor (rayitas) y NOAA-20 con su factor (círculos).
  const dx = 0.08 * u;
  for (const a of g.noaa21.filter((x) => x.razon !== null)) {
    const s = el('rect', { x: f1(X(a.y) + dx - 4.5), y: f1(Y(a.razon) - 4.5), width: 9, height: 9, fill: a.completo ? TINTA_2 : BLANCO, stroke: TINTA_2, 'stroke-width': 1.8 }, svg);
    el('title', {}, s).textContent = `${a.y} · NOAA-21: ${a.razon.toFixed(2)}`;
  }
  for (const a of g.noaa20.filter((x) => x.cruda !== null)) {
    el('line', { x1: f1(X(a.y) - dx - 6), x2: f1(X(a.y) - dx + 6), y1: f1(Y(a.cruda)), y2: f1(Y(a.cruda)), stroke: GRIS, 'stroke-width': 1.5 }, svg);
  }
  for (const a of g.noaa20.filter((x) => x.razon !== null)) {
    const c = el('circle', { cx: f1(X(a.y) - dx), cy: f1(Y(a.razon)), r: 5, fill: a.completo ? ROJO : BLANCO, stroke: ROJO, 'stroke-width': 1.8 }, svg);
    el('title', {}, c).textContent = `${a.y} · NOAA-20: ${a.razon.toFixed(2)}`;
  }
  // El nombre de cada uno junto a su serie: NOAA-20 sobre su punto más alto; NOAA-21 a la
  // izquierda de su primer punto.
  const c20 = g.noaa20.filter((x) => x.razon !== null), c21 = g.noaa21.filter((x) => x.razon !== null);
  if (c20.length) {
    const p = c20.reduce((m, x) => (x.razon > m.razon ? x : m));
    const n = texto(svg, X(p.y) - dx, Y(p.razon) - 14, e('Noaa20'), { tam: 10.5, peso: 700, color: TINTA, ancla: 'middle', palabras: true });
    const b = medida(n);
    if (b.x + b.width + 20 > der) { n.setAttribute('text-anchor', 'end'); n.setAttribute('x', f1(der - 22)); }
    marca(svg, g.cumple.noaa20, n);
  }
  if (c21.length) {
    const p = c21.reduce((m, x) => (x.y < m.y ? x : m));
    const n = texto(svg, X(p.y) + dx - 12, Y(p.razon), e('Noaa21'), { tam: 10.5, peso: 700, color: TINTA, ancla: 'end', alinear: 'medio', palabras: true });
    ajustar(n, X(p.y) + dx - 12 - izq - 24);
    marca(svg, g.cumple.noaa21, n, { izquierda: true });
  }
  // La leyenda, abajo a la izquierda: año completo, año parcial y NOAA-20 sin factor.
  const claves = [['punto', e('Completo')], ['hueco', e('Parcial')], ['raya', e('Noaa20Crudo')]];
  const anchos = claves.map(([, s]) => {
    const n = texto(svg, 0, 0, s, { tam: 10.5, palabras: true });
    const w = medida(n).width;
    n.remove();
    return w;
  });
  const filas = [[]];
  let x = izq + 12;
  claves.forEach((c, i) => {
    const w = 18 + anchos[i];
    if (x + w > der - 4 && filas[filas.length - 1].length) { filas.push([]); x = izq + 12; }
    filas[filas.length - 1].push([c, x]);
    x += w + 24;
  });
  filas.forEach((fila, r) => {
    const y = base - 14 - (filas.length - 1 - r) * 18;
    for (const [[forma, s], x0] of fila) {
      if (forma === 'punto') el('circle', { cx: x0 + 5, cy: y, r: 5, fill: GRIS }, svg);
      else if (forma === 'hueco') el('circle', { cx: x0 + 5, cy: y, r: 4.2, fill: BLANCO, stroke: GRIS, 'stroke-width': 1.8 }, svg);
      else el('line', { x1: x0 - 1, x2: x0 + 11, y1: y, y2: y, stroke: GRIS, 'stroke-width': 1.5 }, svg);
      texto(svg, x0 + 18, y, s, { tam: 10.5, color: TINTA, alinear: 'medio', palabras: true });
    }
  });
  return base + 24;
}

const DIBUJOS = { salto_2012: salto, aqua_fuera_muestra: aqua, conafor, viirs };
const TITULOS = { salto_2012: 'TituloSalto', aqua_fuera_muestra: 'TituloAqua', conafor: 'TituloConafor', viirs: 'TituloViirs' };

/** Dibuja la gráfica de la prueba `p` en `svg`; devuelve [título, leyenda] (la leyenda va dentro del dibujo). */
export function dibujarPrueba(svg, p, nombre) {
  svg.textContent = '';
  const ancho = Math.max(280, Math.round(svg.parentNode.clientWidth || 440));
  const dibujo = DIBUJOS[p.id];
  const alto = dibujo ? dibujo(svg, p.grafica, ancho, `gv${++serie}`) : 0;
  svg.setAttribute('viewBox', `0 0 ${ancho} ${Math.ceil(alto)}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', t('mGvAria', { n: nombre }));
  return [TITULOS[p.id] ? e(TITULOS[p.id]) : null, []];
}
