// Cómo lo medimos (#/metodo): qué es un foco de calor, cómo se unieron los satélites (con el salto
// de 2012), ¿se puede confiar? y la descarga de la serie. Spec, «Cómo lo medimos».
// Las cifras salen de web/datos/metodo.json y validacion.json, que escribe pipeline/exportar_web.py.
// «¿Se puede confiar?» muestra cada prueba de la validación (tarea 7) con la frase de su caso y,
// debajo, cada satélite contra la serie (satelites.json, #32).
import { t, traducir, idioma } from '../textos.js';
import { fmt, fechaDiaAnio, el, datos, reducirMovimiento } from '../comun.js';
import { dibujarPrueba } from '../graficas-validacion.js';

const SENSOR = { Terra: 'MODIS', Aqua: 'MODIS', 'S-NPP': 'VIIRS', 'NOAA-20': 'VIIRS' };
const GRIS = '#8F877D'; // el mismo gris de las barras de la portada
const TINTA = '#121212';
const TINTA_2 = '#4A4743';
const CAMBIO = 2012; // el primer año de S-NPP
const ROJO = '#D7261E';
const BANDA_SAT = '#F6F4F0'; // los años con que se calculó el factor (el --sobre de la página)

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
    <p data-t="mConfiarIntro"></p>
    <h3 class="m-sub" data-t="mPruebasTitulo"></h3>
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
  <p class="pie" id="pie"></p>
  <p class="pie"><span data-t="mIA"></span> <a href="https://github.com/Ghosflot/kaak-yucatan/blob/main/entrega/uso-de-ia.md" data-t="mIAEnlace"></a></p>
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

// t() con los números de la prueba, también en las listas (las limitaciones).
function rellenar(clave, valores) {
  const v = t(clave, valores);
  if (!Array.isArray(v)) return v;
  return v.map((s) => s.replace(/\{(\w+)\}/g, (m, k) => (k in valores ? String(valores[k]) : m)));
}

// Una tarjeta por prueba: nombre, cifra, la frase de su caso, la gráfica y las limitaciones.
// Si el caso todavía no tiene frase, lo dice en lugar de usar la de otro caso.
function tarjeta(p) {
  // La misma regla que pipeline/validar.py (clave): «salto_2012» → valSalto2012Nombre, …
  const base = 'val' + p.id.split('_').map((x) => x[0].toUpperCase() + x.slice(1)).join('');
  const art = document.createElement('article');
  art.className = 'm-prueba';
  art.dataset.prueba = p.id;
  art.dataset.estado = p.estado;
  const nombre = rellenar(base + 'Nombre', p.valores);
  const h3 = document.createElement('h3');
  h3.textContent = nombre;
  const cifra = document.createElement('b');
  cifra.className = 'cifra';
  texto(cifra, rellenar(base + 'Numero', p.valores));
  const frase = document.createElement('p');
  const f = rellenar(p.clave, p.valores);
  if (f === p.clave) { frase.className = 'm-pendiente'; frase.textContent = t('mValPendiente'); } else texto(frase, f);
  art.append(h3, cifra, frase);
  // La gráfica se dibuja aquí con los datos de la prueba (dibujarGraficas, ya con el ancho real).
  const graf = document.createElement('figure');
  graf.className = 'm-prueba-graf';
  graf.dataset.nombre = nombre;
  graf.append(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
  art.append(graf);
  // Las limitaciones van plegadas: las cuatro tarjetas miden casi lo mismo.
  const lim = rellenar(base + 'Limitaciones', p.valores);
  if (Array.isArray(lim) && lim.length) {
    const det = document.createElement('details');
    const sum = document.createElement('summary');
    sum.textContent = t('mValVer');
    const ul = document.createElement('ul');
    ul.append(...lim.map((s) => { const li = document.createElement('li'); texto(li, s); return li; }));
    det.append(sum, ul);
    art.append(det);
  }
  return art;
}

const mediana = (xs) => { const a = [...xs].sort((p, q) => p - q), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

/**
 * Un satélite (línea roja, punteada sin calibrar) sobre la serie unida (barras grises), como el
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
    el('line', { x1: izq, x2: ancho - der, y1: Y(v), y2: Y(v), stroke: '#E4E1DC', 'stroke-width': 1 }, svg);
    el('text', { x: izq - 8, y: Y(v) + 4, 'font-size': 11, fill: TINTA_2, 'text-anchor': 'end' }, svg).textContent = fmt(v);
  }
  // Barras de la serie unida.
  for (const a of anios) {
    el('rect', { x: (X(a.y) + 2).toFixed(1), y: Y(a.armonizado).toFixed(1), width: bw.toFixed(1), height: (base - Y(a.armonizado)).toFixed(1), fill: GRIS }, svg);
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
  const pts = S.anios.map((a) => [X(a.y) + paso / 2, Y(a[campo])]);
  el('polyline', {
    class: 'm-sat-linea', points: pts.map(([x, y]) => x.toFixed(1) + ',' + y.toFixed(1)).join(' '), fill: 'none', stroke: ROJO,
    'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-dasharray': campo === 'cal' ? 'none' : '7 5',
  }, svg);
  for (const [x, y] of pts) el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 3.6, fill: campo === 'cal' ? ROJO : '#FFFFFF', stroke: ROJO, 'stroke-width': 2 }, svg);
  // Zonas para tocar cada año.
  for (const a of anios) {
    const v = dS[a.y];
    const z = el('rect', {
      class: 'm-sat-zona', x: X(a.y), y: arriba - 6, width: paso, height: base - arriba + 6, fill: 'transparent', tabindex: 0, role: 'img',
      'aria-label': t('mSatAnio', { y: a.y, v: fmt(a.armonizado), s: t(etiqueta, { s: S.sat }), w: v ? fmt(v[campo]) : t('mSatSinDatos') }),
    }, svg);
    const mostrar = () => {
      const r = svg.getBoundingClientRect(), k = r.width / ancho;
      punta.replaceChildren();
      const b = (txt) => { const n = document.createElement('b'); n.textContent = txt; return n; };
      punta.append(b(String(a.y)), document.createElement('br'), t('mSatPuntaSerie') + ': ', b(fmt(a.armonizado)), document.createElement('br'),
        t(etiqueta, { s: S.sat }) + ': ', v ? b(fmt(v[campo])) : t('mSatSinDatos'));
      punta.hidden = false;
      const w = punta.offsetWidth;
      punta.style.left = Math.min(Math.max((X(a.y) + paso / 2) * k, w / 2), r.width - w / 2) + 'px';
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

// Qué tanto se aleja el satélite de la serie: la mediana de |satélite / serie − 1|, en %.
function lecturaSat(M, S) {
  const serie = Object.fromEntries(M.anios.map((a) => [a.y, a.armonizado]));
  const desde = S.anios[0].y, hasta = S.anios[S.anios.length - 1].y;
  const bloque = (marca, etiqueta, cifra, frase) => ({ marca, etiqueta, cifra, frase });
  const anios = S.incompletos.length
    ? t('mSatIncompleto', { s: S.sat, a: S.incompletos.join(', ') })
    : t('mSatAniosT', { s: S.sat });
  const sale = [bloque('m-anios', t('mSatAnios'), desde + '–' + hasta, anios)];
  if (!S.calibracion) {
    sale.push(bloque('m-cal', t('mSatReferencia'), '×1', t('mSatReferenciaT', { a: desde, b: hasta, s: S.sat })));
    return sale;
  }
  const [c0, c1] = S.calibracion;
  const libres = S.anios.filter((a) => serie[a.y] && !S.serie.includes(a.y) && !(a.y >= c0 && a.y <= c1) && !S.incompletos.includes(a.y));
  const usados = libres.length ? libres : S.anios.filter((a) => serie[a.y] && !S.incompletos.includes(a.y));
  const dif = (c) => Math.round(mediana(usados.map((a) => Math.abs(a[c] / serie[a.y] - 1) * 100)));
  const frase = libres.length ? t('mSatDifIndep', { n: libres.length }) : t('mSatDifMismos', { a: usados[0].y, b: usados[usados.length - 1].y });
  sale.push(bloque('m-crudo', t('mVerCrudo'), t('mPct', { n: dif('crudo') }), frase));
  sale.push(bloque('m-cal', t('mVerArmonizado'), t('mPct', { n: dif('cal') }), frase));
  return sale;
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
  let M = null, P = null, V = null, SAT = null, nMun = 0, vivo = true;
  let sat = 'Aqua', escala = 'cal', anchoSat = 0, anchoPruebas = 0;
  // Se abre sin calibrar; al llegar a la gráfica, se calibra sola una vez (si nadie la tocó antes).
  let vista = reducirMovimiento() ? 'armonizado' : 'crudo', tocado = false, verSalto = null, espera = 0, observador = null, medida = null, anchoCaja = 0;
  const $ = (s) => raiz.querySelector('#' + s);

  function pintar() {
    traducir(raiz);
    document.title = t('metodoPagina') + " — K'áak'";
    $('mPeriodos').replaceChildren(...M.periodos.map((p) => {
      const li = document.createElement('li');
      texto(li, p.hasta
        ? t('mPeriodo', { s: p.sat, i: SENSOR[p.sat], d: fechaDiaAnio(p.desde), h: fechaDiaAnio(p.hasta) })
        : t('mPeriodoDesde', { s: p.sat, i: SENSOR[p.sat], d: fechaDiaAnio(p.desde) }));
      return li;
    }));
    $('mUnir2').textContent = t('mUnir2', { a: dec(M.factores.aqua[0], 1), b: dec(M.factores.aqua[1], 1) });
    dibujarSalto();

    // Si la validación no carga, la sección se queda con su título y su introducción.
    $('mPruebas').replaceChildren(...(V ? V.pruebas.map(tarjeta) : []));
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
    $('pie').textContent = t('mPie', { a: M.anios[0].y, b: M.anios[M.anios.length - 1].y, d: c.desde, h: c.hasta, f: fechaDiaAnio(P.actualizado) });
  }

  // Título, leyenda y dibujo de la gráfica de cada prueba, al ancho de su tarjeta.
  function dibujarGraficas() {
    if (!V) return;
    anchoPruebas = $('mPruebas').clientWidth;
    raiz.querySelectorAll('.m-prueba').forEach((art, i) => {
      const fig = art.querySelector('.m-prueba-graf');
      const svg = fig.querySelector('svg');
      const [titulo, ley] = dibujarPrueba(svg, V.pruebas[i], fig.dataset.nombre);
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
    });
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
    $('mSatLectura').replaceChildren(...lecturaSat(M, S).map((b) => {
      const d = document.createElement('div');
      d.className = 'm-sat-bloque';
      const e = document.createElement('span');
      e.className = 'm-sat-que';
      const i = document.createElement('i');
      i.className = b.marca;
      e.append(i, document.createTextNode(b.etiqueta));
      const c = document.createElement('b');
      c.className = 'cifra';
      c.textContent = b.cifra;
      const p = document.createElement('p');
      texto(p, b.frase);
      d.append(e, c, p);
      return d;
    }), (() => {
      // La nota de cada satélite, debajo de las tres cifras.
      const n = document.createElement('p');
      n.className = 'm-sat-nota';
      texto(n, t('mSatNota' + sat.replace('-', '')));
      return n;
    })());
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
    raiz.querySelector('#mSat').addEventListener('click', (e) => {
      const b = e.target.closest('[data-sat], [data-esc]');
      if (!b) return;
      if (b.dataset.sat) sat = b.dataset.sat; else escala = b.dataset.esc;
      pintarSat();
    });
    medida = new ResizeObserver(() => {
      if ($('salto') && $('salto').parentNode.clientWidth !== anchoCaja) dibujarSalto();
      if (SAT && $('mSatSvg') && $('mSatSvg').parentNode.clientWidth !== anchoSat) pintarSat();
      if (V && $('mPruebas') && $('mPruebas').clientWidth !== anchoPruebas) dibujarGraficas();
    });
    medida.observe(raiz.querySelector('#mPruebas'));
    medida.observe(raiz.querySelector('.m-salto-caja'));
    medida.observe(raiz.querySelector('.m-sat-caja'));
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
  return () => { vivo = false; clearTimeout(espera); if (observador) observador.disconnect(); if (medida) medida.disconnect(); window.removeEventListener('idioma', alIdioma); };
}
