// Cómo lo medimos (#/metodo): abre con el salto de 2012 y su interruptor; después, qué es un foco
// de calor, cómo se unieron los satélites (con la hora de paso de Terra y Aqua), qué dejamos fuera,
// las cuatro preguntas de la validación, cada satélite contra la serie y la descarga.
// Spec de la dirección visual, «Cómo lo medimos». Las cifras salen de web/datos/metodo.json,
// validacion.json y satelites.json, que escribe pipeline/exportar_web.py.
// El estado del interruptor va en la dirección: #/metodo (sin corregir) o #/metodo/corregido.
import { t, traducir, idioma } from '../textos.js';
import { fmt, fechaDiaAnio, el, datos, anunciar, pieDatos } from '../comun.js';
import { dibujarPrueba } from '../graficas-validacion.js';

const SENSOR = { Terra: 'MODIS', Aqua: 'MODIS', 'S-NPP': 'VIIRS', 'NOAA-20': 'VIIRS' };
const GRIS = '#8F877D'; // el mismo gris de las barras de la portada
const ROJO = '#D7261E', ROJO_CLARO = '#E9837D'; // 2026, y lo que la corrección añade (rayado)
const CLARO = '#D3CDC4';
const TINTA = '#121212';
const TINTA_2 = '#4A4743';
const LINEA = '#E4E1DC';
const CAMBIO = 2012; // el primer año de S-NPP
const BANDA_SAT = '#F6F4F0'; // los años con que se calculó el factor (el --sobre de la página)
const CORREGIDO = '/corregido';

const PLANTILLA = `
<article class="pagina metodo">
  <h1 data-t="metodoPagina"></h1>
  <section class="m-abre" aria-label="">
    <div class="m-salto">
      <div data-estado="crudo"><p class="m-salto-t"></p><p class="m-salto-s"></p></div>
      <div data-estado="armonizado"><p class="m-salto-t"></p><p class="m-salto-s"></p></div>
    </div>
    <button type="button" class="m-switch" id="mSwitch" role="switch" aria-checked="false">
      <span class="m-switch-pista" aria-hidden="true"><span></span></span>
      <span data-t="mInterruptor"></span>
    </button>
    <figure class="m-salto-caja">
      <svg id="salto"></svg>
      <figcaption>
        <span id="mGrafTitulo"></span>
        <span class="m-rayas" id="mRayas"><i aria-hidden="true"></i><span></span></span>
      </figcaption>
    </figure>
  </section>
  <section id="mFoco" aria-labelledby="mFocoT">
    <h2 id="mFocoT" data-t="mFocoTitulo"></h2>
    <p data-t="mFoco1"></p>
    <p data-t="mFocoKm"></p>
    <p id="mFocoHora"></p>
    <p data-t="mFoco2"></p>
  </section>
  <section id="mUnir" aria-labelledby="mUnirT">
    <h2 id="mUnirT" data-t="mUnirTitulo"></h2>
    <div class="m-unir">
      <div class="m-unir-texto">
        <p data-t="mUnir1"></p>
        <ul class="m-periodos" id="mPeriodos"></ul>
        <p id="mUnir2"></p>
      </div>
      <div class="m-paso" id="mPaso">
        <h3 id="mPasoT" data-t="mPasoTitulo"></h3>
        <figure class="m-paso-graf">
          <svg id="pasoSvg"></svg>
          <figcaption data-t="mPasoLeyenda"></figcaption>
        </figure>
        <p id="mPaso1"></p>
        <p data-t="mPaso2"></p>
      </div>
    </div>
  </section>
  <section id="mFuera" aria-labelledby="mFueraT">
    <h2 id="mFueraT" data-t="mFueraTitulo"></h2>
    <p id="mFuera1"></p>
    <p id="mFuera2"></p>
  </section>
  <section id="mConfiar" aria-labelledby="mConfiarT">
    <h2 id="mConfiarT" data-t="mConfiarTitulo"></h2>
    <p data-t="mConfiarIntro"></p>
    <div class="m-pruebas" id="mPruebas"></div>
    <div class="m-sat" id="mSat" hidden>
      <h3 class="m-sub" data-t="mSatTitulo"></h3>
      <p data-t="mSatIntro"></p>
      <div class="m-sat-controles">
        <div class="m-grupo">
          <span class="m-grupo-t" id="mSatGrupoT" data-t="mSatGrupo"></span>
          <div class="m-sat-chips" role="group" aria-labelledby="mSatGrupoT" id="mSatChips"></div>
        </div>
        <div class="m-grupo">
          <span class="m-grupo-t" id="mSatEscalaT" data-t="mSatEscala"></span>
          <div class="alm-botones" role="group" aria-labelledby="mSatEscalaT" id="mSatEscala">
            <button type="button" data-esc="crudo" data-t="mVerCrudo"></button>
            <button type="button" data-esc="cal" data-t="mVerArmonizado"></button>
          </div>
        </div>
      </div>
      <ul class="m-sat-ley" id="mSatLey" aria-hidden="true"></ul>
      <div class="m-sat-caja"><svg id="mSatSvg" role="group"></svg><div class="m-sat-punta" id="mSatPunta" hidden></div></div>
      <div class="m-sat-lectura" id="mSatLectura" aria-live="polite"></div>
      <p class="m-nota" data-t="mSatNota"></p>
    </div>
  </section>
  <section id="mDescarga" aria-labelledby="mDescargaT">
    <h2 id="mDescargaT" data-t="mDescargaTitulo"></h2>
    <p id="mDescarga1"></p>
    <a class="b-borde m-descargar" id="serie" href="/datos/serie_armonizada.csv" download="kaak-serie-armonizada.csv"></a>
  </section>
  <p class="m-fin"><span data-t="mFinAntes"></span><a href="#/" data-t="mFinEnlace"></a><span data-t="mFinDespues"></span></p>
  <p class="pie" id="pie"></p>
  <p class="pie"><span data-t="mIA"></span> <a href="https://github.com/Ghosflot/kaak-yucatan/blob/main/entrega/uso-de-ia.md" data-t="mIAEnlace"></a></p>
  <p class="pie" id="mEquipo" data-t="mEquipo"></p>
</article>`;

// «3.0» o «1.01»: decimales fijos con el formato del idioma.
const dec = (n, d) => n.toLocaleString(idioma() === 'en' ? 'en-US' : 'es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });

// Pone el texto en `nodo` sin partir al final del renglón los nombres con guion («S-NPP», «NOAA-20»),
// los rangos de años («2009–2011»), un año de la palabra que lo antecede («de 2026») ni una cifra de
// su unidad («25 %», «0.90 a 1.10»).
function texto(nodo, s) {
  nodo.replaceChildren(...s.split(/(S-NPP|NOAA-2\d|\d{4}–\d{4}|\d[\d.,]* %|×\d[\d.]*|\d+\.\d+ (?:a|to) \d+\.\d+|[a-zá-ú]+ \d{4}\b(?!–)|\d+, \d{4}\b|\d+ k?m\b)/).map((parte, i) => {
    if (i % 2 === 0) return document.createTextNode(parte);
    const span = document.createElement('span');
    span.className = 'sin-corte';
    span.textContent = parte;
    return span;
  }));
}

// t() con los números de la prueba, también en las listas (las limitaciones).
function rellenar(clave, valores) {
  const v = t(clave, valores);
  if (!Array.isArray(v)) return v;
  return v.map((s) => s.replace(/\{(\w+)\}/g, (m, k) => (k in valores ? String(valores[k]) : m)));
}

// «13:12» → minutos desde la medianoche, y de vuelta a la hora de 12 («1:12»).
const minutos = (h) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
const hora12 = (m) => { const h = Math.floor(m / 60) % 12 || 12; return h + ':' + String(Math.round(m % 60)).padStart(2, '0'); };
// Con su artículo en español: «la 1:12», «las 10:45».
const hora = (m) => t(Math.floor(m / 60) % 12 === 1 ? 'mHoraLa' : 'mHoraLas', { h: hora12(m) });
const mediana = (xs) => { const a = [...xs].sort((p, q) => p - q), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

/**
 * La hora del paso de Terra y Aqua: estable al principio y después se corre. Devuelve el último
 * año estable (el anterior al primero que se aleja 12 minutos o más de sus primeros diez años y ya
 * no vuelve), la hora de referencia de cada uno y la del último año.
 */
function deriva(paso) {
  const de = (sat) => {
    const anios = Object.keys(paso[sat]).map(Number).sort((a, b) => a - b);
    const m = anios.map((y) => minutos(paso[sat][y]));
    const ref = mediana(m.slice(0, 10));
    let desde = null;
    for (let i = m.length - 1; i >= 0 && Math.abs(m[i] - ref) >= 12; i--) desde = anios[i];
    return { anios, ref: mediana(m.filter((_, i) => desde === null || anios[i] < desde)), ultimo: m[m.length - 1], fin: anios[anios.length - 1], desde };
  };
  const T = de('Terra'), A = de('Aqua');
  const fin = Math.max(T.fin, A.fin);
  const desde = Math.min(fin + 1, ...[T.desde, A.desde].filter((x) => x !== null));
  return { T, A, estable: desde - 1, fin };
}

/** La gráfica chica de la hora de paso: Terra y Aqua en tinta, S-NPP en gris como contraste. */
function armarPaso(svg, paso) {
  svg.textContent = '';
  const ancho = Math.max(280, Math.round(svg.parentNode.clientWidth || 440));
  const izq = 72, der = ancho - 92, arriba = 10, base = 190;
  const anios = [...new Set(Object.values(paso).flatMap((x) => Object.keys(x).map(Number)))].sort((a, b) => a - b);
  const todos = Object.values(paso).flatMap((x) => Object.values(x).map(minutos));
  const lo = Math.floor(Math.min(...todos) / 60) * 60, hi = lo + Math.ceil((Math.max(...todos) - lo) / 120) * 120;
  const X = (y) => izq + ((y - anios[0]) / (anios[anios.length - 1] - anios[0])) * (der - izq);
  const Y = (m) => base - ((m - lo) / (hi - lo)) * (base - arriba);
  for (let m = lo; m <= hi; m += 120) {
    el('line', { x1: izq, x2: der, y1: Y(m), y2: Y(m), stroke: LINEA, 'stroke-width': 1 }, svg);
    const h = Math.floor(m / 60);
    el('text', { x: izq - 8, y: Y(m) + 4, 'font-size': 11, fill: TINTA_2, 'text-anchor': 'end' }, svg).textContent = t(h < 12 ? 'mEjeAm' : 'mEjePm', { h: h % 12 || 12 });
  }
  el('line', { x1: izq, x2: der, y1: base + 0.5, y2: base + 0.5, stroke: TINTA, 'stroke-width': 1 }, svg);
  for (const [y, an] of [[anios[0], 'start'], [CAMBIO, 'middle'], [anios[anios.length - 1], 'end']]) {
    el('text', { x: X(y), y: base + 17, 'font-size': 11, fill: TINTA_2, 'text-anchor': an }, svg).textContent = String(y);
  }
  // S-NPP debajo, ancho y gris; Terra y Aqua encima, en tinta. Cada uno con su nombre y su última hora.
  const finales = [];
  for (const [sat, estilo] of [['S-NPP', { stroke: CLARO, 'stroke-width': 6 }], ['Terra', { stroke: TINTA, 'stroke-width': 2.2 }], ['Aqua', { stroke: TINTA, 'stroke-width': 2.2 }]]) {
    const ys = Object.keys(paso[sat]).map(Number).sort((a, b) => a - b);
    const pts = ys.map((y) => [X(y), Y(minutos(paso[sat][y]))]);
    el('polyline', { points: pts.map(([x, y]) => x.toFixed(1) + ',' + y.toFixed(1)).join(' '), fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round', ...estilo }, svg);
    const [x, y] = pts[pts.length - 1];
    finales.push({ sat, x, y, h: hora12(minutos(paso[sat][ys[ys.length - 1]])) });
  }
  // Los nombres no se enciman: si dos quedan a menos de 26 px, se separan.
  finales.sort((a, b) => a.y - b.y);
  for (let i = 1; i < finales.length; i++) if (finales[i].y - finales[i - 1].y < 26) finales[i].y = finales[i - 1].y + 26;
  for (const f of finales) {
    const g = el('text', { x: f.x + 8, y: f.y - 1, 'font-size': 12, 'font-weight': 700, fill: f.sat === 'S-NPP' ? TINTA_2 : TINTA, class: 'm-paso-nombre' }, svg);
    g.textContent = f.sat;
    el('text', { x: f.x + 8, y: f.y + 12, 'font-size': 11, fill: TINTA_2 }, svg).textContent = f.h;
  }
  svg.setAttribute('viewBox', `0 0 ${ancho} ${base + 24}`);
}

/**
 * Un satélite (línea en tinta, punteada sin corregir) sobre la serie (barras grises), como el
 * prototipo del #32. La banda marca los años con que se calculó su factor; la raya negra, el
 * cambio a VIIRS en 2012. Cada año se puede tocar, pasar el mouse o enfocar con el teclado: la
 * ventanita `punta` dice la serie y el satélite de ese año.
 */
function armarSat(svg, punta, M, S, campo) {
  svg.textContent = '';
  punta.hidden = true;
  const anios = M.anios;
  const ancho = Math.max(300, Math.round(svg.parentNode.clientWidth || 900));
  const izq = 54, der = 8, arriba = 48, abajo = 34;
  const alto = Math.round(Math.min(340, Math.max(260, ancho * 0.38)));
  const base = alto - abajo;
  svg.setAttribute('viewBox', '0 0 ' + ancho + ' ' + alto);
  const dS = Object.fromEntries(S.anios.map((a) => [a.y, a]));
  const max = Math.max(...anios.map((a) => a.armonizado), ...S.anios.map((a) => a.cal)) * 1.05;
  const paso = (ancho - izq - der) / anios.length, bw = Math.max(2, paso - 4);
  const X = (y) => izq + anios.findIndex((a) => a.y === y) * paso;
  const Y = (v) => base - (v / max) * (base - arriba);
  const etiqueta = (campo === 'cal' ? 'mSatPuntaCal' : 'mSatPuntaCrudo');
  // Años de calibración.
  if (S.calibracion) {
    const [a, b] = S.calibracion;
    el('rect', { x: X(a), y: arriba - 6, width: X(b) - X(a) + paso, height: base - arriba + 6, fill: BANDA_SAT }, svg);
    const rb = el('text', { x: X(a) + 8, y: arriba + 12, 'font-size': 12, fill: TINTA_2, class: 'm-sat-txt' }, svg);
    rb.textContent = t('mSatBanda', { a, b });
    // En el teléfono la banda es angosta: queda solo el rango de años.
    if (rb.getComputedTextLength && rb.getComputedTextLength() > X(b) - X(a) + paso - 12) rb.textContent = a + '–' + b;
  }
  // Rejilla y eje.
  const marca = max > 12000 ? 5000 : 2500;
  for (let v = 0; v <= max; v += marca) {
    el('line', { x1: izq, x2: ancho - der, y1: Y(v), y2: Y(v), stroke: LINEA, 'stroke-width': 1 }, svg);
    el('text', { x: izq - 8, y: Y(v) + 4, 'font-size': 11, fill: TINTA_2, 'text-anchor': 'end' }, svg).textContent = fmt(v);
  }
  // Barras de la serie.
  for (const a of anios) {
    el('rect', { x: (X(a.y) + 2).toFixed(1), y: Y(a.armonizado).toFixed(1), width: bw.toFixed(1), height: (base - Y(a.armonizado)).toFixed(1), fill: CLARO }, svg);
  }
  el('line', { x1: izq, x2: ancho - der, y1: base + 0.5, y2: base + 0.5, stroke: TINTA, 'stroke-width': 1 }, svg);
  // 2012: la raya va en el hueco entre 2011 y 2012, donde empieza S-NPP, con su etiqueta negra.
  const x12 = X(CAMBIO) + 1;
  el('line', { x1: x12, x2: x12, y1: 34, y2: base, stroke: TINTA, 'stroke-width': 2 }, svg);
  const tag = el('g', {}, svg);
  const fondo = el('rect', { x: x12, y: 8, height: 26, fill: TINTA }, tag);
  const tagTxt = el('text', { x: x12 + 10, y: 26, 'font-size': 14, 'font-weight': 700, fill: '#FFFFFF', class: 'm-sat-txt' }, tag);
  tagTxt.textContent = t('mSatCambio');
  const largo = (tagTxt.getComputedTextLength ? tagTxt.getComputedTextLength() : 290) + 20;
  fondo.setAttribute('width', largo.toFixed(1));
  // Si no cabe a la derecha de la raya (teléfono), la etiqueta se recorre hacia la izquierda.
  if (x12 + largo > ancho) {
    const x0 = Math.max(0, ancho - largo);
    fondo.setAttribute('x', x0.toFixed(1));
    tagTxt.setAttribute('x', (x0 + 10).toFixed(1));
  }
  const ultimo = anios[anios.length - 1].y;
  const marcas = ancho < 560 ? [anios[0].y, ultimo] : [2001, 2006, 2016, 2021, 2026].filter((y) => dS[y] || anios.some((a) => a.y === y));
  for (const y of marcas) {
    el('text', { x: X(y) + paso / 2, y: base + 18, 'font-size': 11, fill: TINTA_2, 'text-anchor': 'middle' }, svg).textContent = y;
  }
  el('text', { x: x12 + 4, y: base + 19, 'font-size': 13, 'font-weight': 700, fill: TINTA, class: 'm-sat-txt' }, svg).textContent = String(CAMBIO);
  // Línea del satélite.
  // Corregido, en rojo, como en las gráficas de las pruebas; sin corregir, en tinta y punteado.
  const pts = S.anios.map((a) => [X(a.y) + paso / 2, Y(a[campo])]), trazo = campo === 'cal' ? ROJO : TINTA;
  el('polyline', {
    class: 'm-sat-linea', points: pts.map(([x, y]) => x.toFixed(1) + ',' + y.toFixed(1)).join(' '), fill: 'none', stroke: trazo,
    'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-dasharray': campo === 'cal' ? 'none' : '7 5',
  }, svg);
  for (const [x, y] of pts) el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 3.6, fill: campo === 'cal' ? ROJO : '#FFFFFF', stroke: trazo, 'stroke-width': 2 }, svg);
  // Zonas para tocar cada año.
  for (const a of anios) {
    const v = dS[a.y];
    const z = el('rect', {
      class: 'm-sat-zona', x: X(a.y), y: arriba - 6, width: paso, height: base - arriba + 6, fill: 'transparent', tabindex: 0, role: 'img',
      'aria-label': t('mSatAnio', { y: a.y, v: fmt(a.armonizado), s: t(etiqueta, { s: S.sat }), w: v ? fmt(v[campo]) : t('mSatSinDatos') }),
    }, svg);
    const mostrar = () => {
      const rw = svg.getBoundingClientRect().width, k = rw / ancho;
      punta.replaceChildren();
      const b = (txt) => { const n = document.createElement('b'); n.textContent = txt; return n; };
      punta.append(b(String(a.y)), document.createElement('br'), t('mSatPuntaSerie') + ': ', b(fmt(a.armonizado)), document.createElement('br'),
        t(etiqueta, { s: S.sat }) + ': ', v ? b(fmt(v[campo])) : t('mSatSinDatos'));
      punta.hidden = false;
      const w = punta.offsetWidth;
      punta.style.left = Math.min(Math.max((X(a.y) + paso / 2) * k, w / 2), rw - w / 2) + 'px';
      punta.style.top = (Y(Math.max(a.armonizado, v ? v[campo] : 0)) * k - 10) + 'px';
    };
    const ocultar = () => { punta.hidden = true; };
    z.addEventListener('pointerenter', mostrar);
    z.addEventListener('focus', mostrar);
    z.addEventListener('pointerleave', ocultar);
    z.addEventListener('blur', ocultar);
  }
  svg.setAttribute('aria-label', t('mSatAria', { a: anios[0].y, b: ultimo, s: t(campo === 'cal' ? 'mSatLeyCal' : 'mSatLeyCrudo', { s: S.sat }) }));
}

// Qué tanto se aleja el satélite de la serie (la mediana de |satélite / serie − 1|, en %), dicho en oraciones.
function lecturaSat(M, S) {
  const serie = Object.fromEntries(M.anios.map((a) => [a.y, a.armonizado]));
  const desde = S.anios[0].y, hasta = S.anios[S.anios.length - 1].y;
  const sale = [];
  if (!S.calibracion) {
    sale.push(t('mSatReferenciaT', { a: desde, b: hasta, s: S.sat }));
  } else {
    const [c0, c1] = S.calibracion;
    const libres = S.anios.filter((a) => serie[a.y] && !S.serie.includes(a.y) && !(a.y >= c0 && a.y <= c1) && !S.incompletos.includes(a.y));
    const usados = libres.length ? libres : S.anios.filter((a) => serie[a.y] && !S.incompletos.includes(a.y));
    const dif = (c) => Math.round(mediana(usados.map((a) => Math.abs(a[c] / serie[a.y] - 1) * 100)));
    sale.push(t('mSatLectura', { s: S.sat, a: desde, b: hasta, crudo: dif('crudo'), cal: dif('cal') }));
    sale.push(libres.length ? t('mSatLecturaIndep', { n: libres.length }) : t('mSatLecturaMismos', { a: usados[0].y, b: usados[usados.length - 1].y }));
  }
  if (S.incompletos.length) sale.push(t('mSatIncompleto', { a: S.incompletos.join(', ') }));
  return sale.join(' ');
}

// Los promedios y la razón «después ÷ antes» de la gráfica de arriba (Yucatán, de marzo a mayo).
function razones(M) {
  const prom = ([a, b], campo) => { const xs = M.anios.filter((x) => x.y >= a && x.y <= b); return xs.reduce((s, x) => s + x[campo], 0) / xs.length; };
  const antes = prom(M.salto.antes, 'crudo'), despues = prom(M.salto.despues, 'crudo');
  const antesCorr = prom(M.salto.antes, 'armonizado'), despuesCorr = prom(M.salto.despues, 'armonizado');
  return { antes, despues, antesCorr, despuesCorr, crudo: despues / antes, corr: despuesCorr / antesCorr };
}

/**
 * El salto de 2012 en una sola gráfica: las barras de MODIS (antes de 2012) se ven tal cual o
 * corregidas, y pasan de una a otra con una animación corta. Las dos líneas punteadas son el
 * promedio de los años que compara la oración (`salto.antes` y `salto.despues`).
 */
function armarSalto(svg, M) {
  svg.textContent = '';
  const anios = M.anios;
  // El dibujo mide lo mismo que en pantalla: los textos salen a su tamaño en el teléfono y en la computadora.
  const ancho = Math.max(300, Math.round(svg.parentNode.clientWidth || 680));
  const alto = Math.round(Math.min(230, ancho * 0.42)), arriba = 26, base = arriba + alto;
  svg.setAttribute('viewBox', '0 0 ' + ancho + ' ' + (base + 24));
  const max = Math.max(...anios.map((a) => Math.max(a.crudo, a.armonizado)));
  const paso = ancho / anios.length, bw = paso - Math.max(2, Math.min(5, paso * 0.18));
  const id = 'salto-rayas';
  const pat = el('pattern', { id, width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, el('defs', {}, svg));
  el('rect', { width: 5, height: 5, fill: ROJO_CLARO }, pat);
  el('rect', { width: 2, height: 5, fill: '#FFFFFF', 'fill-opacity': 0.55 }, pat);
  // Cada barra mide lo más alto posible y se encoge con transform: así la animación es fluida.
  // Antes de 2012 cada año lleva dos: atrás, en rojo claro rayado, la corregida (la que se anima); encima, en gris
  // y quieta, lo que contó el satélite. Lo que asoma al corregir es lo que la corrección añade.
  const barras = anios.map((a, i) => {
    const r = el('rect', {
      class: 'm-barra', 'data-y': a.y, x: (i * paso).toFixed(1), y: arriba, width: bw.toFixed(1), height: alto,
      fill: a.y < CAMBIO ? 'url(#' + id + ')' : a.y === anios[anios.length - 1].y ? ROJO : GRIS,
    }, svg);
    if (a.y < CAMBIO) r.style.transitionDelay = (i * 0.02).toFixed(3) + 's';
    el('title', {}, r);
    if (a.y < CAMBIO) {
      el('rect', { class: 'm-cruda', x: (i * paso).toFixed(1), y: arriba, width: bw.toFixed(1), height: alto, fill: GRIS }, svg)
        .style.transform = 'scaleY(' + (a.crudo / max).toFixed(4) + ')';
    }
    return r;
  });
  el('line', { x1: 0, x2: ancho, y1: base + 0.5, y2: base + 0.5, stroke: TINTA, 'stroke-width': 1 }, svg);
  const iCambio = anios.findIndex((a) => a.y === CAMBIO);
  if (iCambio > 0) {
    const x = iCambio * paso - 2;
    el('line', { x1: x, x2: x, y1: 14, y2: base, stroke: TINTA, 'stroke-width': 1.2, 'stroke-dasharray': '3 3' }, svg);
    const r = el('text', { x: x + 5, y: 11, 'font-size': 12, 'font-weight': 700, fill: TINTA }, svg);
    r.textContent = t('mCambio');
    // En el teléfono, si no cabe a la derecha de la raya, termina en el borde.
    if (r.getComputedTextLength && x + 5 + r.getComputedTextLength() > ancho) { r.setAttribute('x', ancho); r.setAttribute('text-anchor', 'end'); }
  }
  for (const [i, an] of [[0, 'start'], [iCambio, 'middle'], [anios.length - 1, 'end']]) {
    if (i < 0) continue;
    const x = an === 'start' ? i * paso : an === 'end' ? i * paso + bw : i * paso + bw / 2;
    el('text', { x: x.toFixed(1), y: base + 17, 'font-size': 12, fill: TINTA_2, 'text-anchor': an }, svg).textContent = String(anios[i].y);
  }
  // Promedios de los años que compara la oración.
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
  const antes = { a: anios[0].y, b: CAMBIO - 1 };
  return function ver(campo) {
    anios.forEach((a, i) => {
      const r = barras[i];
      r.style.transform = 'scaleY(' + (a[campo] / max).toFixed(4) + ')';
      r.firstChild.textContent = a.y + ': ' + fmt(a[campo]);
    });
    for (const { g, xs } of lineas) g.style.transform = 'translateY(' + (-Y(promedio(xs, campo))).toFixed(1) + 'px)';
    svg.setAttribute('aria-label', t(campo === 'crudo' ? 'mCrudoAria' : 'mArmonizadoAria', antes));
  };
}

// Una pregunta por prueba: la pregunta, su respuesta a la vista y, plegados, la gráfica y las limitaciones.
// Si el caso todavía no tiene frase, lo dice en lugar de usar la de otro caso.
function pregunta(p, M) {
  // La misma regla que pipeline/validar.py (clave): «salto_2012» → valSalto2012Nombre, …
  const base = 'val' + p.id.split('_').map((x) => x[0].toUpperCase() + x.slice(1)).join('');
  const art = document.createElement('article');
  art.className = 'm-prueba';
  art.dataset.prueba = p.id;
  art.dataset.estado = p.estado;
  const h3 = document.createElement('h3');
  h3.textContent = rellenar(base + 'Nombre', p.valores);
  const resp = document.createElement('p');
  resp.className = 'm-respuesta';
  const f = rellenar(p.clave, p.valores);
  if (f === p.clave) { resp.classList.add('m-pendiente'); resp.textContent = t('mValPendiente'); } else {
    // La respuesta corta («Sí.», «No.», «En parte.») va en negritas.
    const m = f.match(/^([^.:]{1,28}[.:])\s(.*)$/s);
    if (m) {
      const b = document.createElement('b');
      b.textContent = m[1];
      const resto = document.createElement('span');
      texto(resto, ' ' + m[2]);
      resp.append(b, resto);
    } else texto(resp, f);
  }
  art.append(h3, resp);
  // La gráfica se dibuja al abrirse, ya con su ancho (dibujarGrafica).
  const det = document.createElement('details');
  det.className = 'm-det-graf';
  const sum = document.createElement('summary');
  sum.textContent = t('mValGrafica');
  const graf = document.createElement('figure');
  graf.className = 'm-prueba-graf';
  graf.dataset.nombre = rellenar(base + 'Numero', p.valores);
  graf.append(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
  det.append(sum, graf);
  const extra = detalle(p, M);
  if (extra) {
    const d = document.createElement('p');
    d.className = 'm-det';
    texto(d, extra);
    det.append(d);
  }
  art.append(det);
  const lim = rellenar(base + 'Limitaciones', p.valores);
  if (Array.isArray(lim) && lim.length) {
    const dl = document.createElement('details');
    dl.className = 'm-det-lim';
    const s2 = document.createElement('summary');
    s2.textContent = t('mValVer');
    const ul = document.createElement('ul');
    ul.append(...lim.map((s) => { const li = document.createElement('li'); texto(li, s); return li; }));
    dl.append(s2, ul);
    art.append(dl);
  }
  return art;
}

// Lo que acompaña a la gráfica de cada prueba: la meta y el contexto, sin juicio (vale para cualquier caso).
function detalle(p, M) {
  const g = p.grafica || {}, v = p.valores;
  if (p.id === 'salto_2012' && g.umbral) return t('mDetSalto2012', { ...v, m0: dec(g.umbral[0], 2), m1: dec(g.umbral[1], 2) });
  if (p.id === 'aqua_fuera_muestra') return t('mDetAqua', v);
  if (p.id === 'conafor') {
    const d = M.conafor.porDuracion || [];
    const base = t('mDetConafor', { ...v, meta: Math.round(g.minimo), desde: M.conafor.desde, hasta: M.conafor.hasta });
    return d.length ? base + ' ' + t('mDetConaforDuracion', { d1: d[0].vistos, d4: d[d.length - 1].vistos }) : base;
  }
  return '';
}

export function montar(raiz) {
  let M = null, P = null, V = null, SAT = null, nMun = 0, vivo = true;
  let sat = 'Aqua', escala = 'cal', anchoSat = 0, anchoPruebas = 0, anchoPaso = 0;
  // El estado del interruptor vive en la dirección: así un enlace o volver a la página lo conserva.
  let vista = location.hash.endsWith(CORREGIDO) ? 'armonizado' : 'crudo', verSalto = null, medida = null, anchoCaja = 0;
  const $ = (s) => raiz.querySelector('#' + s);

  function pintar() {
    traducir(raiz);
    // Los párrafos fijos tampoco parten «375 m» ni «de 2026» al final del renglón.
    raiz.querySelectorAll('p[data-t]').forEach((p) => texto(p, p.textContent));
    document.title = t('metodoPagina') + " — K'áak'";
    raiz.querySelector('.m-abre').setAttribute('aria-label', t('mAbreAria'));
    $('mGrafTitulo').textContent = t('mGrafTitulo', { a1: M.salto.antes[0], a2: M.salto.antes[1], d1: M.salto.despues[0], d2: M.salto.despues[1] });
    $('mRayas').lastChild.textContent = t('mRayas', { a: M.anios[0].y, b: CAMBIO - 1 });
    dibujarSalto();

    // Qué es un foco: la hora del paso de la tarde de S-NPP (la mediana de sus años) y cuántos focos son de ese paso.
    const snpp = Object.values(M.paso['S-NPP']).map(minutos);
    texto($('mFocoHora'), t('mFocoHora', { h: hora(mediana(snpp)), n: Math.round((1 - M.nocturnos) * 100) }));

    $('mPeriodos').replaceChildren(...M.periodos.map((p) => {
      const li = document.createElement('li');
      texto(li, p.hasta
        ? t('mPeriodo', { s: p.sat, i: SENSOR[p.sat], d: fechaDiaAnio(p.desde), h: fechaDiaAnio(p.hasta) })
        : t('mPeriodoDesde', { s: p.sat, i: SENSOR[p.sat], d: fechaDiaAnio(p.desde) }));
      return li;
    }));
    // En números redondos, los mismos del pitch: «entre tres y cinco». Si los dos redondean igual, con un decimal.
    const fa = M.factores.aquaTodas || M.factores.aqua, redondos = Math.round(fa[0]) !== Math.round(fa[1]);
    $('mUnir2').textContent = t('mUnir2', { a: redondos ? String(Math.round(fa[0])) : dec(fa[0], 1), b: redondos ? String(Math.round(fa[1])) : dec(fa[1], 1) });
    const D = deriva(M.paso);
    texto($('mPaso1'), t('mPaso1', { u: D.estable, y: D.fin, t0: hora(D.T.ref), a0: hora(D.A.ref), t1: hora(D.T.ultimo), a1: hora(D.A.ultimo) }));
    dibujarPaso();

    // Qué dejamos fuera: la fuente fija de Mérida y los días sin datos.
    const F = M.fuenteFija, r = (F.fijas / F.detecciones) * 10, n = Math.round(r);
    const prop = t(r < n - 0.05 ? 'mFijaCasi' : r > n + 0.05 ? 'mFijaMas' : 'mFija', { n });
    texto($('mFuera1'), t('mFuera1', { m: F.municipio, p: prop, f: fmt(F.fijas), d: fmt(F.detecciones) }));
    texto($('mFuera2'), t('mFuera2', { n: M.anios.length, d: M.sinDatos.dias, r: M.sinDatos.rellenados }));

    // Si la validación no carga, la sección se queda con su título y su introducción. Al cambiar de
    // idioma, lo que estaba abierto sigue abierto.
    const abiertos = new Set([...raiz.querySelectorAll('.m-prueba details[open]')].map((d) => d.closest('.m-prueba').dataset.prueba + d.className));
    $('mPruebas').replaceChildren(...(V ? V.pruebas.map((p) => pregunta(p, M)) : []));
    raiz.querySelectorAll('.m-prueba details').forEach((d) => { if (abiertos.has(d.closest('.m-prueba').dataset.prueba + d.className)) d.open = true; });
    raiz.querySelectorAll('.m-det-graf').forEach((d) => d.addEventListener('toggle', () => { if (d.open) dibujarGrafica(d); }));
    dibujarGraficas();
    // Las gráficas acomodan sus textos midiéndolos: se vuelven a dibujar con la letra ya cargada.
    if (document.fonts) document.fonts.ready.then(() => { if (vivo) dibujarGraficas(); });
    $('mSat').hidden = !SAT;
    if (SAT) {
      $('mSatChips').replaceChildren(...SAT.satelites.map((x) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.sat = x.sat;
        b.className = 'm-chip';
        const sensor = document.createElement('small');
        sensor.textContent = x.sensor;
        b.append(x.sat + ' ', sensor);
        return b;
      }));
      pintarSat();
    }

    const c = M.conafor;
    $('mDescarga1').textContent = t('mDescarga1', { n: nMun });
    $('serie').textContent = t('mDescargar', { mb: M.serieMB });
    $('pie').textContent = pieDatos('mPie', { a: M.anios[0].y, b: M.anios[M.anios.length - 1].y, d: c.desde, h: c.hasta, f: fechaDiaAnio(P.actualizado) });
  }

  function dibujarPaso() {
    anchoPaso = $('pasoSvg').parentNode.clientWidth;
    armarPaso($('pasoSvg'), M.paso);
    const D = deriva(M.paso);
    $('pasoSvg').setAttribute('role', 'img');
    $('pasoSvg').setAttribute('aria-label', t('mPasoAria', { t0: hora12(D.T.ref), t1: hora12(D.T.ultimo), a0: hora12(D.A.ref), a1: hora12(D.A.ultimo), u: D.estable, y: D.fin }));
  }

  // Título, leyenda y dibujo de la gráfica de una prueba abierta, al ancho de su caja.
  function dibujarGrafica(det) {
    const art = det.closest('.m-prueba');
    const p = V.pruebas.find((x) => x.id === art.dataset.prueba);
    const fig = det.querySelector('.m-prueba-graf');
    const svg = fig.querySelector('svg');
    const [titulo, ley] = dibujarPrueba(svg, p, fig.dataset.nombre);
    fig.querySelectorAll('.m-graf-t, .m-sat-ley').forEach((n) => n.remove());
    if (titulo) {
      const c = document.createElement('figcaption');
      c.className = 'm-graf-t';
      c.textContent = titulo;
      fig.prepend(c);
    }
    if (ley.length) {
      const ul = document.createElement('ul');
      ul.className = 'm-sat-ley';
      ul.setAttribute('aria-hidden', 'true');
      ul.append(...ley.map(([forma, color, txt]) => {
        const li = document.createElement('li');
        const i2 = document.createElement('i');
        i2.className = 'm-ley-' + forma;
        i2.style.setProperty('--c', color);
        li.append(i2, document.createTextNode(txt));
        return li;
      }));
      svg.before(ul);
    }
  }

  function dibujarGraficas() {
    if (!V) return;
    anchoPruebas = $('mPruebas').clientWidth;
    raiz.querySelectorAll('.m-det-graf').forEach((d) => { if (d.open) dibujarGrafica(d); });
  }

  function pintarSat() {
    const S = SAT.satelites.find((x) => x.sat === sat) || SAT.satelites[0];
    sat = S.sat;
    raiz.querySelectorAll('[data-sat]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sat === sat)));
    raiz.querySelectorAll('[data-esc]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.esc === escala)));
    const ley = [['m-ley-barra', t('mSatLeySerie')], [escala === 'cal' ? 'm-ley-cal' : 'm-ley-crudo', t(escala === 'cal' ? 'mSatLeyCal' : 'mSatLeyCrudo', { s: sat })]];
    if (S.calibracion) ley.push(['m-ley-banda', t('mSatLeyFactor')]);
    $('mSatLey').replaceChildren(...ley.map(([c, txt]) => {
      const li = document.createElement('li');
      const i = document.createElement('i');
      i.className = c;
      li.append(i, document.createTextNode(txt));
      return li;
    }));
    anchoSat = $('mSatSvg').parentNode.clientWidth;
    armarSat($('mSatSvg'), $('mSatPunta'), M, S, escala);
    const p = document.createElement('p');
    texto(p, lecturaSat(M, S));
    // La nota de cada satélite, debajo de la lectura.
    const n = document.createElement('p');
    n.className = 'm-sat-nota';
    texto(n, t('mSatNota' + sat.replace('-', '')));
    $('mSatLectura').replaceChildren(p, n);
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
    const corr = campo === 'armonizado';
    $('mSwitch').setAttribute('aria-checked', String(corr));
    $('mRayas').classList.toggle('visible', corr);
    // La oración usa cifras redondas: la gráfica es de marzo a mayo; las exactas, del año completo, van en la primera pregunta.
    const r = razones(M), triple = Math.round(r.crudo) === 3, s = M.salto;
    const v = { c: dec(r.crudo, 1), r: dec(r.corr, 1), a: fmt(r.antes), d: fmt(r.despues), ac: fmt(r.antesCorr), dc: fmt(r.despuesCorr), a1: s.antes[0], a2: s.antes[1], d1: s.despues[0], d2: s.despues[1] };
    const frases = {
      crudo: [t(triple ? 'mSaltoCrudoTriple' : 'mSaltoCrudo', v), t('mSaltoCrudoSub', v)],
      armonizado: [t(triple ? 'mSaltoCorrTriple' : 'mSaltoCorr', v), t('mSaltoCorrSub', v)],
    };
    // Las dos oraciones ocupan la misma celda y solo se ve la del estado: el alto es el de la más
    // larga, así que el interruptor y la gráfica no brincan al cambiar.
    raiz.querySelectorAll('.m-salto > [data-estado]').forEach((d) => {
      const [a, b] = frases[d.dataset.estado];
      texto(d.firstChild, a);
      texto(d.lastChild, b);
      d.classList.toggle('activo', d.dataset.estado === campo);
    });
    return frases[campo].join(' ');
  }

  function escuchar() {
    $('mSwitch').addEventListener('click', () => {
      // El lector de pantalla oye la oración nueva (la zona viva de index.html).
      anunciar(ver(vista === 'crudo' ? 'armonizado' : 'crudo'));
      const destino = '#/metodo' + (vista === 'armonizado' ? CORREGIDO : '');
      if (location.hash !== destino) history.replaceState(history.state, '', destino);
    });
    raiz.querySelector('#mSat').addEventListener('click', (e) => {
      const b = e.target.closest('[data-sat], [data-esc]');
      if (!b) return;
      if (b.dataset.sat) sat = b.dataset.sat; else escala = b.dataset.esc;
      pintarSat();
    });
    medida = new ResizeObserver(() => {
      if ($('salto') && $('salto').parentNode.clientWidth !== anchoCaja) dibujarSalto();
      if ($('pasoSvg') && $('pasoSvg').parentNode.clientWidth !== anchoPaso) dibujarPaso();
      if (SAT && $('mSatSvg') && $('mSatSvg').parentNode.clientWidth !== anchoSat) pintarSat();
      if (V && $('mPruebas') && $('mPruebas').clientWidth !== anchoPruebas) dibujarGraficas();
    });
    medida.observe(raiz.querySelector('#mPruebas'));
    medida.observe(raiz.querySelector('.m-salto-caja'));
    medida.observe(raiz.querySelector('.m-paso-graf'));
    medida.observe(raiz.querySelector('.m-sat-caja'));
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
    [V, SAT] = await Promise.all([datos('validacion.json').catch(() => null), datos('satelites.json').catch(() => null)]);
    if (!vivo) return;
    nMun = lista.length;
    raiz.innerHTML = PLANTILLA;
    pintar();
    escuchar();
  }

  arrancar();
  const alIdioma = () => { if (M && $('serie')) pintar(); };
  window.addEventListener('idioma', alIdioma);
  return () => { vivo = false; if (medida) medida.disconnect(); window.removeEventListener('idioma', alIdioma); };
}
