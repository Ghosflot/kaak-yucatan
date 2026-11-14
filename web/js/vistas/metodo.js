// Cómo lo medimos (#/metodo): qué es un foco de calor, cómo se unieron los satélites (con el salto
// de 2012), ¿se puede confiar? y la descarga de la serie. Spec, «Cómo lo medimos».
// Las cifras salen de web/datos/metodo.json, que escribe pipeline/exportar_web.py.
import { t, traducir, idioma } from '../textos.js';
import { fmt, fechaDiaAnio, el, datos } from '../comun.js';

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
    <div class="m-graficas">
      <figure><figcaption data-t="mCrudo"></figcaption><svg id="saltoCrudo"></svg></figure>
      <figure><figcaption data-t="mArmonizado"></figcaption><svg id="saltoArmonizado"></svg></figure>
    </div>
    <p class="m-nota" data-t="mRayas"></p>
    <p class="m-salto" id="mSalto"></p>
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

/** Barras de cada año en temporada; las dos gráficas usan la misma escala (`max`). */
function barrasSalto(svg, { anios, campo, max, rayar, aria }) {
  svg.textContent = '';
  const ancho = 340, alto = 110, base = alto + 18;
  svg.setAttribute('viewBox', '0 0 ' + ancho + ' ' + (base + 22));
  const paso = ancho / anios.length, bw = paso - 2.5;
  const Y = (v) => base - (v / max) * alto;
  const id = svg.id + '-rayas';
  const pat = el('pattern', { id, width: 4, height: 4, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, el('defs', {}, svg));
  el('rect', { width: 4, height: 4, fill: GRIS }, pat);
  el('rect', { width: 1.6, height: 4, fill: '#FFFFFF', 'fill-opacity': 0.55 }, pat);
  anios.forEach((a, i) => {
    const v = a[campo];
    const r = el('rect', {
      class: 'm-barra', 'data-y': a.y, x: (i * paso).toFixed(1), y: Y(v).toFixed(1), width: bw.toFixed(1),
      height: (base - Y(v)).toFixed(1), fill: rayar && a.y < CAMBIO ? 'url(#' + id + ')' : GRIS,
    }, svg);
    el('title', {}, r).textContent = a.y + ': ' + fmt(v);
  });
  el('line', { x1: 0, x2: ancho, y1: base + 0.5, y2: base + 0.5, stroke: TINTA, 'stroke-width': 1 }, svg);
  // El cambio de satélite: una línea punteada antes de 2012, con su rótulo arriba.
  const iCambio = anios.findIndex((a) => a.y === CAMBIO);
  if (iCambio > 0) {
    const x = iCambio * paso - 1.25;
    el('line', { x1: x, x2: x, y1: 12, y2: base, stroke: TINTA, 'stroke-width': 1.2, 'stroke-dasharray': '3 3' }, svg);
    el('text', { x: x + 4, y: 10, 'font-size': 11, 'font-weight': 700, fill: TINTA }, svg).textContent = t('mCambio');
  }
  const marcas = [[0, 'start'], [iCambio, 'middle'], [anios.length - 1, 'end']];
  for (const [i, an] of marcas) {
    if (i < 0) continue;
    const x = an === 'start' ? i * paso : an === 'end' ? i * paso + bw : i * paso + bw / 2;
    el('text', { x: x.toFixed(1), y: base + 16, 'font-size': 11, fill: TINTA_2, 'text-anchor': an }, svg).textContent = String(anios[i].y);
  }
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', aria);
}

export function montar(raiz) {
  let M = null, P = null, nMun = 0, vivo = true;
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
    const max = Math.max(...M.anios.map((a) => Math.max(a.crudo, a.armonizado)));
    barrasSalto($('saltoCrudo'), { anios: M.anios, campo: 'crudo', max, rayar: false, aria: t('mCrudoAria') });
    barrasSalto($('saltoArmonizado'), { anios: M.anios, campo: 'armonizado', max, rayar: true, aria: t('mArmonizadoAria') });
    const s = M.salto;
    texto($('mSalto'), t('mSalto', { a1: s.antes[0], a2: s.antes[1], d1: s.despues[0], d2: s.despues[1], c: dec(s.crudo, 1), r: dec(s.armonizado, 2) }));

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
  }

  arrancar();
  const alIdioma = () => { if (M && $('serie')) pintar(); };
  window.addEventListener('idioma', alIdioma);
  return () => { vivo = false; window.removeEventListener('idioma', alIdioma); };
}
