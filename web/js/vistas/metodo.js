// Cómo lo medimos (#/metodo): qué es un foco de calor, cómo se unieron los satélites (con el salto
// de 2012), ¿se puede confiar? y la descarga de la serie. Spec, «Cómo lo medimos».
// Las cifras salen de web/datos/metodo.json, que escribe pipeline/exportar_web.py.
import { t, traducir, idioma } from '../textos.js';
import { fmt, fechaDiaAnio, el, datos, reducirMovimiento } from '../comun.js';

const SENSOR = { Terra: 'MODIS', Aqua: 'MODIS', 'S-NPP': 'VIIRS', 'NOAA-20': 'VIIRS' };
const GRIS = '#8F877D'; // el mismo gris de las barras de la portada
const TINTA = '#121212';
const TINTA_2 = '#4A4743';
const CAMBIO = 2012; // el primer año de S-NPP

const PLANTILLA = `
<article class="pagina metodo">
  <h1 data-t="metodoPagina"></h1>
  <p class="sub" data-t="mSub"></p>
  <section id="mFoco" aria-labelledby="mFocoT">
    <h2 id="mFocoT" data-t="mFocoTitulo"></h2>
    <p data-t="mFoco1"></p>
    <p data-t="mFoco2"></p>
  </section>
  <section id="mUnir" aria-labelledby="mUnirT">
    <h2 id="mUnirT" data-t="mUnirTitulo"></h2>
    <p data-t="mUnir1"></p>
    <ul class="m-periodos" id="mPeriodos"></ul>
    <p id="mUnir2"></p>
    <h3 class="m-graf-titulo" data-t="mGrafTitulo"></h3>
    <div class="m-salto-caja">
      <div class="alm-botones m-ver" role="group" data-t-aria="mVerAria" aria-label="">
        <button type="button" data-ver="crudo" data-t="mVerCrudo"></button>
        <button type="button" data-ver="armonizado" data-t="mVerArmonizado"></button>
      </div>
      <p class="m-salto" id="mSalto" aria-live="polite"></p>
      <svg id="salto"></svg>
    </div>
    <p class="m-nota" id="mRayas" data-t="mRayas"></p>
  </section>
  <section id="mConfiar" aria-labelledby="mConfiarT">
    <h2 id="mConfiarT" data-t="mConfiarTitulo"></h2>
    <div class="m-cifras">
      <div class="m-cifra"><b class="cifra" id="cVistos"></b><p id="cConafor"></p></div>
      <div class="m-cifra"><b class="cifra" id="cGrandes"></b><p id="cGrandesT"></p></div>
      <div class="m-cifra"><b class="cifra" id="cNoaa"></b><p id="cNoaaT"></p></div>
    </div>
    <p class="m-nota" data-t="mConfiarNota"></p>
  </section>
  <section id="mDescarga" aria-labelledby="mDescargaT">
    <h2 id="mDescargaT" data-t="mDescargaTitulo"></h2>
    <p id="mDescarga1"></p>
    <a class="b-borde m-descargar" id="serie" href="/datos/serie_armonizada.csv" download="kaak-serie-armonizada.csv"></a>
  </section>
  <p class="pie" id="pie"></p>
</article>`;

// «3.0» o «1.01»: decimales fijos con el formato del idioma.
const dec = (n, d) => n.toLocaleString(idioma() === 'en' ? 'en-US' : 'es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });

// Pone el texto en `nodo` sin partir al final del renglón los nombres con guion («S-NPP», «NOAA-20») ni los rangos de años («2009–2011»).
function texto(nodo, s) {
  nodo.replaceChildren(...s.split(/(S-NPP|NOAA-20|\d{4}–\d{4})/).map((parte, i) => {
    if (i % 2 === 0) return document.createTextNode(parte);
    const span = document.createElement('span');
    span.className = 'sin-corte';
    span.textContent = parte;
    return span;
  }));
}

/**
 * El salto de 2012 en una sola gráfica: las barras de MODIS (antes de 2012) se ven tal cual o
 * calibradas, y pasan de una a otra con una animación. Las dos líneas punteadas son el promedio de
 * los años que compara la frase (`salto.antes` y `salto.despues`).
 */
function armarSalto(svg, M) {
  svg.textContent = '';
  const anios = M.anios;
  // El dibujo mide lo mismo que en pantalla: los textos salen a su tamaño en el teléfono y en la computadora.
  const ancho = Math.max(300, Math.round(svg.parentNode.clientWidth || 680));
  const alto = Math.round(Math.min(190, ancho * 0.45)), arriba = 26, base = arriba + alto;
  svg.setAttribute('viewBox', '0 0 ' + ancho + ' ' + (base + 24));
  const max = Math.max(...anios.map((a) => Math.max(a.crudo, a.armonizado)));
  const paso = ancho / anios.length, bw = paso - 4;
  const id = 'salto-rayas';
  const pat = el('pattern', { id, width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, el('defs', {}, svg));
  el('rect', { width: 5, height: 5, fill: GRIS }, pat);
  el('rect', { width: 2, height: 5, fill: '#FFFFFF', 'fill-opacity': 0.55 }, pat);
  // Cada barra mide lo más alto posible y se encoge con transform: así la animación es fluida.
  const barras = anios.map((a, i) => {
    const r = el('rect', {
      class: 'm-barra', 'data-y': a.y, x: (i * paso).toFixed(1), y: arriba, width: bw.toFixed(1), height: alto, fill: GRIS,
    }, svg);
    if (a.y < CAMBIO) r.style.transitionDelay = (i * 0.025).toFixed(3) + 's';
    el('title', {}, r);
    return r;
  });
  el('line', { x1: 0, x2: ancho, y1: base + 0.5, y2: base + 0.5, stroke: TINTA, 'stroke-width': 1 }, svg);
  const iCambio = anios.findIndex((a) => a.y === CAMBIO);
  if (iCambio > 0) {
    const x = iCambio * paso - 2;
    el('line', { x1: x, x2: x, y1: 14, y2: base, stroke: TINTA, 'stroke-width': 1.2, 'stroke-dasharray': '3 3' }, svg);
    el('text', { x: x + 5, y: 11, 'font-size': 12, 'font-weight': 700, fill: TINTA }, svg).textContent = t('mCambio');
  }
  for (const [i, an] of [[0, 'start'], [iCambio, 'middle'], [anios.length - 1, 'end']]) {
    if (i < 0) continue;
    const x = an === 'start' ? i * paso : an === 'end' ? i * paso + bw : i * paso + bw / 2;
    el('text', { x: x.toFixed(1), y: base + 17, 'font-size': 12, fill: TINTA_2, 'text-anchor': an }, svg).textContent = String(anios[i].y);
  }
  // Promedios de los años que compara la frase.
  const tramo = ([a, b]) => anios.map((x, i) => ({ ...x, i })).filter((x) => x.y >= a && x.y <= b);
  const promedio = (xs, campo) => xs.reduce((s, x) => s + x[campo], 0) / xs.length;
  const lineas = [M.salto.antes, M.salto.despues].map((r) => {
    const xs = tramo(r);
    const g = el('g', { class: 'm-promedio' }, svg);
    const x0 = xs[0].i * paso - 3, x1 = xs[xs.length - 1].i * paso + bw + 3;
    el('line', { x1: x0, x2: x1, y1: base, y2: base }, g);
    // El rótulo del primer tramo termina en su línea y el del segundo empieza en la suya: no se enciman.
    const primero = r === M.salto.antes;
    el('text', { x: primero ? x1 : x0, y: base - 6, 'text-anchor': primero ? 'end' : 'start' }, g).textContent = r[0] + '–' + r[1];
    return { g, xs };
  });
  const Y = (v) => (v / max) * alto;
  return function ver(campo) {
    anios.forEach((a, i) => {
      const r = barras[i];
      r.style.transform = 'scaleY(' + (a[campo] / max).toFixed(4) + ')';
      if (a.y < CAMBIO) r.setAttribute('fill', campo === 'armonizado' ? 'url(#' + id + ')' : GRIS);
      r.firstChild.textContent = a.y + ': ' + fmt(a[campo]);
    });
    for (const { g, xs } of lineas) g.style.transform = 'translateY(' + (-Y(promedio(xs, campo))).toFixed(1) + 'px)';
    svg.setAttribute('aria-label', t(campo === 'crudo' ? 'mCrudoAria' : 'mArmonizadoAria'));
  };
}

export function montar(raiz) {
  let M = null, P = null, nMun = 0, vivo = true;
  // Se abre sin calibrar; al llegar a la gráfica, se calibra sola una vez (si nadie la tocó antes).
  let vista = reducirMovimiento() ? 'armonizado' : 'crudo', tocado = false, verSalto = null, espera = 0, observador = null, medida = null, anchoCaja = 0;
  const $ = (s) => raiz.querySelector('#' + s);

  function pintar() {
    traducir(raiz);
    $('mPeriodos').replaceChildren(...M.periodos.map((p) => {
      const li = document.createElement('li');
      texto(li, p.hasta
        ? t('mPeriodo', { s: p.sat, i: SENSOR[p.sat], d: fechaDiaAnio(p.desde), h: fechaDiaAnio(p.hasta) })
        : t('mPeriodoDesde', { s: p.sat, i: SENSOR[p.sat], d: fechaDiaAnio(p.desde) }));
      return li;
    }));
    $('mUnir2').textContent = t('mUnir2', { a: dec(M.factores.aqua[0], 1), b: dec(M.factores.aqua[1], 1) });
    dibujarSalto();

    const c = M.conafor;
    $('cVistos').textContent = t('mPct', { n: c.vistos });
    $('cConafor').textContent = t('mConfiarConafor', { i: fmt(c.incendios), d: c.desde, h: c.hasta, z: c.azar });
    $('cGrandes').textContent = t('mPct', { n: c.grandes });
    $('cGrandesT').textContent = t('mConfiarGrandes', { n: fmt(c.nGrandes), ha: c.ha });
    $('cNoaa').textContent = dec(M.factores.noaa20, 2);
    const snpp = M.periodos.find((p) => p.sat === 'S-NPP');
    texto($('cNoaaT'), t('mConfiarNoaa', { f: fechaDiaAnio(snpp.hasta) }));

    $('mDescarga1').textContent = t('mDescarga1', { n: nMun });
    $('serie').textContent = t('mDescargar', { mb: M.serieMB });
    $('pie').textContent = t('mPie', { a: M.anios[0].y, b: M.anios[M.anios.length - 1].y, d: c.desde, h: c.hasta, f: fechaDiaAnio(P.actualizado) });
  }

  // Al pintar, al cambiar de idioma o de ancho, la gráfica se rehace sin animarse.
  function dibujarSalto() {
    const svg = $('salto');
    svg.setAttribute('role', 'img');
    anchoCaja = svg.parentNode.clientWidth;
    verSalto = armarSalto(svg, M);
    svg.classList.add('quieto');
    ver(vista);
    svg.getBoundingClientRect();
    svg.classList.remove('quieto');
  }

  function ver(campo) {
    vista = campo;
    verSalto(campo);
    raiz.querySelectorAll('[data-ver]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ver === campo)));
    $('mRayas').hidden = campo !== 'armonizado';
    const s = M.salto;
    texto($('mSalto'), t(campo === 'crudo' ? 'mSaltoCrudo' : 'mSaltoArmonizado',
      { a1: s.antes[0], a2: s.antes[1], d1: s.despues[0], d2: s.despues[1], c: dec(s.crudo, 1), r: dec(s.armonizado, 2) }));
  }

  function escuchar() {
    raiz.querySelector('.m-ver').addEventListener('click', (e) => {
      const b = e.target.closest('[data-ver]');
      if (!b) return;
      tocado = true;
      ver(b.dataset.ver);
    });
    medida = new ResizeObserver(() => { if ($('salto') && $('salto').parentNode.clientWidth !== anchoCaja) dibujarSalto(); });
    medida.observe(raiz.querySelector('.m-salto-caja'));
    if (vista !== 'crudo' || !('IntersectionObserver' in window)) return;
    observador = new IntersectionObserver((entradas) => {
      if (!entradas.some((x) => x.isIntersecting)) { clearTimeout(espera); return; }
      espera = setTimeout(() => {
        observador.disconnect();
        if (!tocado && vivo) ver('armonizado');
      }, 1400);
    }, { threshold: 0.75 });
    observador.observe($('salto'));
  }

  async function arrancar() {
    let lista;
    try {
      [M, P, lista] = await Promise.all([datos('metodo.json'), datos('portada.json'), datos('municipios.json')]);
    } catch {
      if (vivo) raiz.innerHTML = '<article class="pagina"><h1 data-t="metodoPagina"></h1><p class="sub" data-t="errorDatos"></p></article>';
      traducir(raiz);
      return;
    }
    if (!vivo) return;
    nMun = lista.length;
    raiz.innerHTML = PLANTILLA;
    pintar();
    escuchar();
  }

  arrancar();
  const alIdioma = () => { if (M && $('serie')) pintar(); };
  window.addEventListener('idioma', alIdioma);
  return () => { vivo = false; clearTimeout(espera); if (observador) observador.disconnect(); if (medida) medida.disconnect(); window.removeEventListener('idioma', alIdioma); };
}
