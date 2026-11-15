// Gráficas en SVG que comparten la portada y la página de cada municipio.
import { t } from './textos.js';
import { el, fmt, fechaCorta } from './comun.js';

const GRIS = '#8F877D'; // barras de los años: 3.6:1 contra el blanco (WCAG 1.4.11)
const ROJO = '#D7261E';
const TINTA = '#121212';
const TINTA_2 = '#4A4743';

const mayuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Barras de marzo a mayo de cada año, con lo normal punteado y el año destacado en rojo.
 * anios: [{y, total}] en orden; los años hasta `convertidoHasta` son MODIS convertido (rayados).
 * alTocar(y), si se pasa, vuelve tocable cada año (clic, Enter o espacio).
 */
export function barrasAnios(svg, { anios, normal, destacado = 2026, alto = 96, ancho = 316, convertidoHasta = 2011, alTocar = null, alBarrer = null, seleccionado = null, aria = '' }) {
  // Si el foco estaba en un año, vuelve a ese año después de redibujar.
  const enfocado = svg.contains(document.activeElement) ? Number(document.activeElement.dataset.y) : null;
  svg.textContent = '';
  const base = alto + 16;
  svg.setAttribute('viewBox', '0 0 ' + (ancho + 44) + ' ' + (base + 44));
  const max = Math.max(...anios.map((a) => a.total), normal, 1);
  const paso = ancho / anios.length, bw = paso - 3;
  const Y = (v) => base - (v / max) * alto;
  const id = (svg.id || 'barras') + '-conv';
  const defs = el('defs', {}, svg);
  const pat = el('pattern', { id, width: 4, height: 4, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  el('rect', { width: 4, height: 4, fill: GRIS }, pat);
  el('rect', { width: 1.6, height: 4, fill: '#FFFFFF', 'fill-opacity': 0.55 }, pat);
  const barras = anios.map((a, i) => {
    const x = i * paso;
    const relleno = a.y === destacado ? ROJO : a.y <= convertidoHasta ? 'url(#' + id + ')' : GRIS;
    const b = el('rect', { x: x.toFixed(1), y: Y(a.total).toFixed(1), width: bw.toFixed(1), height: (base - Y(a.total)).toFixed(1), fill: relleno, class: 'b-anio' + (a.y === destacado ? ' destacada' : '') }, svg);
    if (a.y === seleccionado) { b.setAttribute('stroke', TINTA); b.setAttribute('stroke-width', 1.5); }
    if (!alTocar) el('title', {}, b).textContent = a.y + ': ' + fmt(a.total);
    return b;
  });
  el('line', { x1: 0, x2: ancho, y1: base + 0.5, y2: base + 0.5, stroke: TINTA, 'stroke-width': 1 }, svg);
  const yn = Y(normal);
  el('line', { x1: 0, x2: ancho, y1: yn, y2: yn, stroke: TINTA, 'stroke-width': 1.6, 'stroke-dasharray': '5 3' }, svg);
  // El año con más fuego y el destacado, rotulados.
  const iMax = anios.reduce((m, a, i) => (a.total > anios[m].total ? i : m), 0);
  const iDest = anios.findIndex((a) => a.y === destacado);
  if (iMax !== iDest) {
    el('text', { x: (iMax * paso + bw / 2).toFixed(1), y: Y(anios[iMax].total) - 5, 'font-size': 11, fill: TINTA_2, 'text-anchor': 'middle' }, svg).textContent = fmt(anios[iMax].total);
  }
  if (iDest >= 0) {
    el('text', { x: (iDest * paso + bw + 5).toFixed(1), y: Y(anios[iDest].total) + 4, 'font-size': 12, 'font-weight': 700, fill: ROJO }, svg).textContent = fmt(anios[iDest].total);
  }
  const ty = base + 16;
  const iCambio = anios.findIndex((a) => a.y > convertidoHasta);
  const marcas = [[0, 'start'], [iCambio, 'middle'], [anios.length - 1, 'middle']];
  for (const [i, an] of marcas) {
    if (i < 0) continue;
    const dest = anios[i].y === destacado;
    el('text', { x: (i * paso + (an === 'start' ? 0 : bw / 2)).toFixed(1), y: ty, 'font-size': 11, fill: dest ? ROJO : TINTA_2, 'font-weight': dest ? 700 : 400, 'text-anchor': an, class: 'eje-anio' }, svg).textContent = String(anios[i].y);
  }
  // Leyenda de las barras rayadas: esos años los midió otro satélite y se ajustaron para poder compararlos.
  if (iCambio > 0) {
    const yl = base + 36;
    el('rect', { x: 0, y: yl - 9, width: 10, height: 10, fill: 'url(#' + id + ')' }, svg);
    el('text', { x: 16, y: yl, 'font-size': 12, fill: TINTA_2, class: 'ley-conv' }, svg).textContent = t('convertido', { a: anios[0].y, b: anios[iCambio - 1].y });
  }
  if (alTocar) {
    // Lo que se puede tocar lo parece: al pasar o al enfocar, la barra se oscurece y dice su año y su cifra.
    // La lectura va en el renglón de los años, que se esconde mientras tanto: arriba chocaría con lo normal.
    const lectura = el('text', { class: 'lectura-anio', y: ty, visibility: 'hidden' }, svg);
    const fijos = [...svg.querySelectorAll('text.eje-anio')];
    const marcar = (i) => {
      barras.forEach((b, k) => b.classList.toggle('activa', k === i));
      fijos.forEach((f) => f.setAttribute('visibility', i === null ? 'visible' : 'hidden'));
      if (i === null) { lectura.setAttribute('visibility', 'hidden'); return; }
      const cx = i * paso + bw / 2;
      lectura.textContent = anios[i].y + ': ' + fmt(anios[i].total);
      lectura.setAttribute('x', cx.toFixed(1));
      lectura.setAttribute('text-anchor', cx < 40 ? 'start' : cx > ancho - 40 ? 'end' : 'middle');
      lectura.setAttribute('visibility', 'visible');
    };
    // Una sola parada de Tab (el año elegido, o el destacado) y las flechas recorren los años.
    const enTab = anios.some((a) => a.y === seleccionado) ? seleccionado : destacado;
    const toques = anios.map((a) => {
      const i = anios.indexOf(a);
      const r = el('rect', { x: (i * paso).toFixed(1), y: 0, width: paso.toFixed(1), height: base, fill: 'transparent', class: 'toque', tabindex: a.y === enTab ? 0 : -1, role: 'button', 'data-y': a.y, 'aria-label': a.y + ': ' + fmt(a.total), 'aria-pressed': String(a.y === seleccionado) }, svg);
      r.addEventListener('click', () => alTocar(a.y));
      r.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') marcar(i); });
      r.addEventListener('pointerleave', () => marcar(null));
      r.addEventListener('focus', () => { if (r.matches(':focus-visible')) marcar(i); });
      r.addEventListener('blur', () => marcar(null));
      return r;
    });
    const mover = (de, a) => { toques[de].setAttribute('tabindex', '-1'); toques[a].setAttribute('tabindex', '0'); toques[a].focus(); };
    toques.forEach((r, i) => r.addEventListener('keydown', (e) => {
      const ir = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: toques.length - 1 }[e.key];
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alTocar(anios[i].y); }
      else if (ir !== undefined) { e.preventDefault(); mover(i, Math.max(0, Math.min(toques.length - 1, ir))); }
    }));
    if (alBarrer) barrer(svg, anios, alBarrer);
    const vuelve = toques.find((r) => Number(r.dataset.y) === enfocado);
    if (vuelve) { toques.forEach((r) => r.setAttribute('tabindex', r === vuelve ? '0' : '-1')); vuelve.focus({ preventScroll: true }); }
  }
  svg.setAttribute('role', alTocar ? 'toolbar' : 'img');
  svg.setAttribute('aria-label', aria);
}

/**
 * Función escondida: arrastrar de lado sobre las barras recorre los años en el mapa.
 * alBarrer(y) recibe cada año que se cruza y alBarrer(null) al soltar. Un toque sin arrastrar sigue siendo un clic.
 * Las barras se vuelven a dibujar al cambiar de año; los eventos van en el svg, que no cambia.
 */
function barrer(svg, anios, alBarrer) {
  svg._barrer = { anios, alBarrer };
  if (svg._barrerListo) return;
  svg._barrerListo = true;
  let inicio = null, barriendo = false, ultimo = null, tragarClic = false;
  const anioEn = (x) => {
    const { anios: a } = svg._barrer;
    const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    const ux = ((x - r.left) / r.width) * vb.width;
    const ancho = vb.width - 44; // el viewBox deja 44 de aire a la derecha para la cifra del año destacado
    return a[Math.max(0, Math.min(a.length - 1, Math.floor((ux / ancho) * a.length)))].y;
  };
  svg.addEventListener('pointerdown', (e) => { inicio = { x: e.clientX, y: e.clientY, id: e.pointerId }; barriendo = false; ultimo = null; });
  svg.addEventListener('pointermove', (e) => {
    if (!inicio || e.pointerId !== inicio.id) return;
    const dx = Math.abs(e.clientX - inicio.x), dy = Math.abs(e.clientY - inicio.y);
    if (!barriendo) {
      if (dx < 8 || dx < dy) { if (dy > 8) inicio = null; return; }
      barriendo = true;
      svg.setPointerCapture(e.pointerId);
      svg.classList.add('barriendo');
    }
    const y = anioEn(e.clientX);
    if (y !== ultimo) { ultimo = y; svg._barrer.alBarrer(y); }
  });
  const soltar = () => {
    if (barriendo) { tragarClic = true; svg.classList.remove('barriendo'); svg._barrer.alBarrer(null); setTimeout(() => { tragarClic = false; }, 0); }
    inicio = null; barriendo = false;
  };
  svg.addEventListener('pointerup', soltar);
  svg.addEventListener('pointercancel', soltar);
  // El clic que llega al soltar un barrido no debe volver a tocar el año (lo regresaría a 2026).
  svg.addEventListener('click', (e) => { if (tragarClic) { e.stopPropagation(); tragarClic = false; } }, true);
}

/**
 * Focos por día de enero a junio, con las fechas permitidas sombreadas (días ini a fin, base 0).
 * Al pasar el puntero se ve el día; alTocar(i), si se pasa, recibe el día tocado.
 * tocables: [desde, hasta], los días que se pueden tocar.
 */
export function tiraDias(svg, { dias, ini, fin, anio = 2026, alTocar = null, tocables = null, aria = '' }) {
  svg.textContent = '';
  const N = dias.length, w = 2, base = 58, h = 40, ancho = N * w;
  svg.setAttribute('viewBox', '0 0 ' + ancho + ' 84');
  const mx = Math.max(...dias, 1);
  const x0 = ini * w, x1 = (fin + 1) * w;
  const fecha = (i) => new Date(anio, 0, 1 + i, 12);
  el('rect', { x: x0, y: 12, width: x1 - x0, height: base - 12, fill: '#EDEAE5' }, svg);
  const permitido = el('text', { x: Math.min(ancho, x1 + 2), y: 6, 'font-size': 11, 'font-weight': 700, fill: TINTA, 'text-anchor': 'end' }, svg);
  permitido.textContent = t('permitido', { i: fechaCorta(fecha(ini)), f: fechaCorta(fecha(fin)) });
  dias.forEach((n, i) => {
    if (!n) return;
    const hh = Math.max(1.5, (n / mx) * h);
    el('rect', { x: i * w, y: base - hh, width: w - 0.4, height: hh, fill: ROJO }, svg);
  });
  el('line', { x1: 0, x2: ancho, y1: base + 0.5, y2: base + 0.5, stroke: TINTA, 'stroke-width': 1 }, svg);
  el('line', { x1: x0, x2: x1, y1: base + 2, y2: base + 2, stroke: TINTA, 'stroke-width': 3 }, svg);
  for (let m = 0; m < 12; m++) {
    const i = Math.round((new Date(anio, m, 1, 12) - new Date(anio, 0, 1, 12)) / 864e5);
    if (i >= N) break;
    el('line', { x1: i * w, x2: i * w, y1: base, y2: base + 5, stroke: '#8A857E', 'stroke-width': 1 }, svg);
    el('text', { x: i * w + 2, y: base + 18, 'font-size': 11, fill: TINTA_2 }, svg).textContent = mayuscula(t('mesesCortos')[m]);
  }
  // Al pasar: una línea y el día; al tocar, el día.
  const guia = el('line', { class: 'guia-dia', x1: 0, x2: 0, y1: 10, y2: base, visibility: 'hidden' }, svg);
  const rotulo = el('text', { class: 'rotulo-dia', x: 0, y: 6, visibility: 'hidden' }, svg);
  const zona = el('rect', { x: 0, y: 0, width: ancho, height: base + 4, fill: 'transparent' }, svg);
  const dia = (ev) => {
    const r = svg.getBoundingClientRect();
    return Math.max(0, Math.min(N - 1, Math.floor(((ev.clientX - r.left) / r.width) * N)));
  };
  const tocable = (i) => alTocar && (!tocables || (i >= tocables[0] && i <= tocables[1]));
  zona.addEventListener('pointermove', (ev) => {
    const i = dia(ev), x = i * w + w / 2;
    guia.setAttribute('x1', x); guia.setAttribute('x2', x); guia.setAttribute('visibility', 'visible');
    rotulo.textContent = t('tiraDia', { f: fechaCorta(fecha(i)), n: fmt(dias[i]) });
    const izq = x > ancho / 2;
    rotulo.setAttribute('x', izq ? x - 4 : x + 4);
    rotulo.setAttribute('text-anchor', izq ? 'end' : 'start');
    rotulo.setAttribute('visibility', 'visible');
    permitido.setAttribute('visibility', 'hidden');
    zona.style.cursor = tocable(i) ? 'pointer' : 'default';
  });
  zona.addEventListener('pointerleave', () => {
    guia.setAttribute('visibility', 'hidden');
    rotulo.setAttribute('visibility', 'hidden');
    permitido.setAttribute('visibility', 'visible');
  });
  if (alTocar) zona.addEventListener('click', (ev) => { const i = dia(ev); if (tocable(i)) alTocar(i); });
  svg.setAttribute('aria-label', aria);
  if (!alTocar) { svg.setAttribute('role', 'img'); return; }
  // Con el teclado, la tira es un deslizador: las flechas recorren los días que se pueden tocar.
  const [desde, hasta] = tocables || [0, N - 1];
  let cursor = null;
  const leer = (i) => t('tiraDia', { f: fechaCorta(fecha(i)), n: fmt(dias[i]) });
  const mostrar = (i) => {
    const x = i * w + w / 2;
    guia.setAttribute('x1', x); guia.setAttribute('x2', x); guia.setAttribute('visibility', 'visible');
    rotulo.textContent = leer(i);
    const izq = x > ancho / 2;
    rotulo.setAttribute('x', izq ? x - 4 : x + 4);
    rotulo.setAttribute('text-anchor', izq ? 'end' : 'start');
    rotulo.setAttribute('visibility', 'visible');
    permitido.setAttribute('visibility', 'hidden');
  };
  Object.entries({ role: 'slider', tabindex: 0, 'aria-valuemin': desde, 'aria-valuemax': hasta, 'aria-valuenow': desde, 'aria-valuetext': leer(desde) })
    .forEach(([k, v]) => svg.setAttribute(k, v));
  svg.onfocus = () => { if (svg.matches(':focus-visible')) mostrar(cursor ?? desde); };
  svg.onblur = () => { guia.setAttribute('visibility', 'hidden'); rotulo.setAttribute('visibility', 'hidden'); permitido.setAttribute('visibility', 'visible'); };
  svg.onkeydown = (e) => {
    const de = cursor ?? desde - 1;
    const a = { ArrowRight: de + 1, ArrowUp: de + 1, ArrowLeft: de - 1, ArrowDown: de - 1, PageUp: de + 7, PageDown: de - 7, Home: desde, End: hasta }[e.key];
    if (a === undefined) return;
    e.preventDefault();
    cursor = Math.max(desde, Math.min(hasta, a));
    svg.setAttribute('aria-valuenow', cursor);
    svg.setAttribute('aria-valuetext', leer(cursor));
    mostrar(cursor);
    alTocar(cursor);
  };
}

/**
 * Tira de los años de una zona: qué parte de sus focos de enero a junio cayó fuera de las fechas
 * permitidas (0 a 1). anios: [{y, fuera}] en orden; `normal` es la parte de un año normal (línea punteada).
 * Se dibuja al ancho real de la caja, así la letra mide lo que dice (11 px o más) en cualquier pantalla.
 * leer(y) devuelve la frase de un año; se escribe en `lectura` (un elemento de la página) para el año
 * bajo el puntero o el foco, y para el destacado cuando no hay ninguno.
 * Con el teclado es un deslizador: las flechas recorren los años.
 */
export function tiraFuera(svg, { anios, normal = null, ancho = 520, destacado = 2026, convertidoHasta = 2011, leer, lectura, aria = '' }) {
  svg.textContent = '';
  const izq = 26, der = 4, arriba = 8, alto = 84, base = arriba + alto;
  const W = Math.max(260, Math.round(ancho));
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + (base + 22));
  svg.setAttribute('width', W);
  svg.setAttribute('height', base + 22);
  const paso = (W - izq - der) / anios.length, bw = Math.max(3, paso - Math.min(4, paso * 0.22));
  const Y = (v) => base - v * alto;
  const id = (svg.id || 'tira') + '-conv';
  const pat = el('pattern', { id, width: 4, height: 4, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, el('defs', {}, svg));
  el('rect', { width: 4, height: 4, fill: GRIS }, pat);
  el('rect', { width: 1.6, height: 4, fill: '#FFFFFF', 'fill-opacity': 0.55 }, pat);
  // Rejilla: ninguno, la mitad y todos; la escala va en «de cada 10», como las frases de la página.
  for (const v of [0, 0.5, 1]) {
    el('line', { x1: izq, x2: W - der, y1: Y(v) + 0.5, y2: Y(v) + 0.5, stroke: v === 0 ? TINTA : '#D6D2CB', 'stroke-width': 1 }, svg);
    el('text', { x: izq - 6, y: Y(v) + 4, 'font-size': 11, fill: TINTA_2, 'text-anchor': 'end' }, svg).textContent = String(v * 10);
  }
  const barras = anios.map((a, i) => {
    const x = izq + i * paso + (paso - bw) / 2;
    const relleno = a.y === destacado ? ROJO : a.y <= convertidoHasta ? 'url(#' + id + ')' : GRIS;
    return el('rect', { x: x.toFixed(1), y: Y(a.fuera).toFixed(1), width: bw.toFixed(1), height: (a.fuera * alto).toFixed(1), fill: relleno, class: 'b-anio' + (a.y === destacado ? ' destacada' : '') }, svg);
  });
  if (normal !== null) {
    el('line', { x1: izq, x2: W - der, y1: Y(normal), y2: Y(normal), stroke: TINTA, 'stroke-width': 1.6, 'stroke-dasharray': '5 3', 'pointer-events': 'none' }, svg);
  }
  // Años del eje: el primero, el primero de S-NPP y el destacado.
  const iCambio = anios.findIndex((a) => a.y > convertidoHasta);
  for (const i of [0, iCambio, anios.length - 1]) {
    if (i < 0) continue;
    const dest = anios[i].y === destacado;
    const cx = izq + i * paso + paso / 2;
    el('text', { x: cx.toFixed(1), y: base + 16, 'font-size': 11, fill: dest ? ROJO : TINTA_2, 'font-weight': dest ? 700 : 400, 'text-anchor': i === anios.length - 1 ? 'end' : 'middle', dx: i === anios.length - 1 ? (paso / 2 - der + 2).toFixed(1) : 0 }, svg).textContent = String(anios[i].y);
  }
  // Una sola zona de toque para todo: el año es la columna bajo el puntero.
  const zona = el('rect', { x: izq, y: 0, width: W - izq - der, height: base + 22, fill: 'transparent' }, svg);
  let cursor = null;
  const marcar = (i) => {
    barras.forEach((b, k) => b.classList.toggle('activa', k === i));
    const y = i === null ? destacado : anios[i].y;
    lectura.textContent = leer(y);
    svg.setAttribute('aria-valuetext', leer(i === null ? anios[cursor ?? anios.length - 1].y : y));
  };
  const columna = (ev) => {
    const r = svg.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * W - izq;
    return Math.max(0, Math.min(anios.length - 1, Math.floor(x / paso)));
  };
  zona.addEventListener('pointermove', (ev) => marcar(columna(ev)));
  zona.addEventListener('pointerleave', () => marcar(svg.matches(':focus') ? cursor : null));
  zona.addEventListener('click', (ev) => { cursor = columna(ev); marcar(cursor); });
  const ultimo = anios.length - 1;
  Object.entries({ role: 'slider', tabindex: 0, 'aria-valuemin': anios[0].y, 'aria-valuemax': anios[ultimo].y, 'aria-valuenow': anios[ultimo].y, 'aria-label': aria })
    .forEach(([k, v]) => svg.setAttribute(k, v));
  marcar(null);
  svg.onfocus = () => { if (svg.matches(':focus-visible')) marcar(cursor ?? ultimo); };
  svg.onblur = () => marcar(null);
  svg.onkeydown = (e) => {
    const de = cursor ?? ultimo;
    const a = { ArrowRight: de + 1, ArrowUp: de + 1, ArrowLeft: de - 1, ArrowDown: de - 1, Home: 0, End: ultimo }[e.key];
    if (a === undefined) return;
    e.preventDefault();
    cursor = Math.max(0, Math.min(ultimo, a));
    svg.setAttribute('aria-valuenow', anios[cursor].y);
    marcar(cursor);
  };
}
