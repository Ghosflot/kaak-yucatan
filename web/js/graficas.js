// Gráficas en SVG que comparten la portada y la página de cada municipio.
import { t } from './textos.js';
import { el, fmt } from './comun.js';

const GRIS = '#8F877D'; // barras de los años: 3.6:1 contra el blanco (WCAG 1.4.11)
const ROJO = '#D7261E';
const TINTA = '#121212';
const TINTA_2 = '#4A4743';

/**
 * Barras de marzo a mayo de cada año, con lo normal punteado y el año destacado en rojo.
 * anios: [{y, total}] en orden; los años hasta `convertidoHasta` son MODIS convertido (rayados).
 * alTocar(y), si se pasa, vuelve tocable cada año (clic, Enter o espacio).
 * rango: [p25, p75], la franja de lo normal detrás de las barras.
 * periodos: [[desde, hasta, satélite], …] dibuja bajo los años quién vio cada periodo, y `sigue`
 * nombra al satélite que viene después. `leyenda` cambia el texto de la leyenda del rayado.
 */
export function barrasAnios(svg, { anios, normal, destacado = 2026, alto = 96, ancho = 316, convertidoHasta = 2011, alTocar = null, alBarrer = null, seleccionado = null, aria = '', rango = null, periodos = null, sigue = '', leyenda = null }) {
  // Si el foco estaba en un año, vuelve a ese año después de redibujar.
  const enfocado = svg.contains(document.activeElement) ? Number(document.activeElement.dataset.y) : null;
  svg.textContent = '';
  const base = alto + 16;
  // A la derecha va la cifra del año destacado y, con los periodos, el satélite que sigue.
  const der = periodos ? 58 : 44;
  svg.setAttribute('viewBox', '0 0 ' + (ancho + der) + ' ' + (base + (periodos ? 60 : 44)));
  const max = Math.max(...anios.map((a) => a.total), normal, rango ? rango[1] : 0, 1);
  const paso = ancho / anios.length, bw = paso - 3;
  const Y = (v) => base - (v / max) * alto;
  const id = (svg.id || 'barras') + '-conv';
  const defs = el('defs', {}, svg);
  const pat = el('pattern', { id, width: 4, height: 4, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  el('rect', { width: 4, height: 4, fill: GRIS }, pat);
  el('rect', { width: 1.6, height: 4, fill: '#FFFFFF', 'fill-opacity': 0.55 }, pat);
  if (rango) el('rect', { x: 0, y: Y(rango[1]).toFixed(1), width: ancho - 3, height: (Y(rango[0]) - Y(rango[1])).toFixed(1), class: 'rango' }, svg);
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
    el('text', { x: (iMax * paso + bw / 2).toFixed(1), y: Y(anios[iMax].total) - 5, 'font-size': 11, fill: TINTA_2, 'text-anchor': iMax ? 'middle' : 'start', class: 'cifra-max' }, svg).textContent = fmt(anios[iMax].total);
  }
  if (iDest >= 0) {
    el('text', { x: (iDest * paso + bw + 5).toFixed(1), y: Y(anios[iDest].total) + 4, 'font-size': 12, 'font-weight': 700, fill: ROJO, class: 'cifra-dest' }, svg).textContent = fmt(anios[iDest].total);
  }
  const ty = base + 16;
  const iCambio = anios.findIndex((a) => a.y > convertidoHasta);
  const marcas = [[0, 'start'], [iCambio, 'middle'], [anios.length - 1, 'middle']];
  for (const [i, an] of marcas) {
    if (i < 0) continue;
    const dest = anios[i].y === destacado;
    el('text', { x: (i * paso + (an === 'start' ? 0 : bw / 2)).toFixed(1), y: ty, 'font-size': 11, fill: dest ? ROJO : TINTA_2, 'font-weight': dest ? 700 : 400, 'text-anchor': an, class: 'eje-anio' }, svg).textContent = String(anios[i].y);
  }
  // Quién vio cada periodo: una llave bajo los años con el nombre del satélite.
  if (periodos) {
    const yb = base + 22;
    for (const [desde, hasta, nombre] of periodos) {
      const i0 = anios.findIndex((a) => a.y === Number(desde)), i1 = anios.findIndex((a) => a.y === Number(hasta));
      if (i0 < 0 || i1 < 0) continue;
      const xa = i0 * paso, xb = i1 * paso + bw;
      el('path', { d: `M${xa.toFixed(1)},${yb - 4}V${yb}H${xb.toFixed(1)}V${yb - 4}`, class: 'periodo' }, svg);
      // Si el nombre no cabe bajo su llave (Terra, con dos años), empieza en la orilla.
      const cabe = xb - xa > nombre.length * 7.5;
      el('text', { x: (cabe ? (xa + xb) / 2 : xa).toFixed(1), y: yb + 13, 'text-anchor': cabe ? 'middle' : 'start', class: 'periodo-t' }, svg).textContent = nombre;
    }
    if (sigue) {
      el('path', { d: `M${ancho + 2},${yb}H${ancho + der - 4}`, class: 'periodo sigue' }, svg);
      el('text', { x: ancho + der - 2, y: yb + 13, 'text-anchor': 'end', class: 'periodo-t sigue' }, svg).textContent = sigue;
    }
  }
  // Leyenda de las barras rayadas: esos años los midió otro satélite y se ajustaron para poder compararlos.
  if (iCambio > 0) {
    const yl = base + (periodos ? 55 : 36);
    el('rect', { x: 0, y: yl - 9, width: 10, height: 10, fill: 'url(#' + id + ')' }, svg);
    el('text', { x: 16, y: yl, 'font-size': 12, fill: TINTA_2, class: 'ley-conv' }, svg).textContent = leyenda || t('convertido', { a: anios[0].y, b: anios[iCambio - 1].y });
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
    if (alBarrer) barrer(svg, anios, alBarrer, ancho);
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
function barrer(svg, anios, alBarrer, ancho) {
  svg._barrer = { anios, alBarrer, ancho };
  if (svg._barrerListo) return;
  svg._barrerListo = true;
  let inicio = null, barriendo = false, ultimo = null, tragarClic = false;
  const anioEn = (x) => {
    const { anios: a, ancho: w } = svg._barrer;
    const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    const ux = ((x - r.left) / r.width) * vb.width; // el viewBox deja aire a la derecha para la cifra del año destacado
    return a[Math.max(0, Math.min(a.length - 1, Math.floor((ux / w) * a.length)))].y;
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
 * Las barras suben una por una, de la primera a la última; la destacada llega al final y después su cifra.
 * Solo anima lo que ya está dibujado: si las barras se vuelven a dibujar, quedan quietas.
 */
export function subirBarras(svg) {
  const barras = [...svg.querySelectorAll('.b-anio')];
  const ir = { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' };
  barras.forEach((b, i) => {
    const extra = b.classList.contains('destacada') ? 260 : 0;
    b.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { ...ir, delay: i * 55 + extra });
  });
  const fin = barras.length * 55 + 420;
  svg.querySelectorAll('.cifra-max, .cifra-dest').forEach((c) => c.animate([{ opacity: 0 }, { opacity: 1 }], { ...ir, duration: 260, delay: fin }));
}
