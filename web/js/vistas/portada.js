// Portada: la temporada en tres momentos (foto, repaso y cierre) y el panel con la respuesta.
import { t, traducir } from '../textos.js';
import { $, fmt, fechaDia, fechaDiaAnio, fechaCorta, deMesDia, COLOR, ESCALA, veredicto, el, reducirMovimiento, datos, anunciar, escalaPagina } from '../comun.js';
import { barrasAnios, tiraDias } from '../graficas.js';
import { armarBuscador, EJEMPLO } from '../buscador.js';
import { ruta } from '../app.js';

const W0 = 825, H0 = 681, Y0 = -90;
const YUC = { x0: 302, x1: 708, y0: 31, y1: 330 }; // Yucatán en el lienzo, sin el arrecife Alacranes
const VEL = 10; // días de temporada por segundo: unos 9 s en total
const ULTIMO = 91; // 31 de mayo
const DIAS = ULTIMO + 1;
const MARZO_1 = 59; // 1 de marzo, contado desde el 1 de enero de 2026
// Un foco se ve los días que dura su brasa: recién visto, amarillo; después se enfría a rojo y se apaga.
const VIDA = 5;
const EDAD = [[0, '#FFF1B8'], [0.6, '#FFC94D'], [1.6, '#F5862E'], [3, '#D0472A'], [VIDA, '#8E2C22']];
const TONOS = 20; // dibujos de punto precalculados a lo largo de la vida de un foco
const ANIO = 2026;
const CLASES = ['muyabajo', 'abajo', 'normal', 'arriba', 'muyarriba', 'poco']; // orden de los dígitos de porAnio

const PLANTILLA = `
<section class="escenario" id="escenario" data-modo="foto">
  <div class="mapa" id="mapa">
    <img class="foto" id="foto" src="/img/mosaico.jpg" alt="" width="2044" height="1688" decoding="async">
    <canvas id="fuego" aria-hidden="true"></canvas>
    <svg id="capa" viewBox="0 -90 825 681" preserveAspectRatio="none" role="img" aria-labelledby="capaDesc">
      <desc id="capaDesc"></desc>
      <rect class="velo" x="0" y="-90" width="825" height="681"></rect>
      <g class="rellenos" id="rellenos"></g>
      <g class="limites" id="limites"></g>
      <g class="estados" id="estados"></g>
      <g class="encima" id="encima"></g>
      <g class="seleccion" id="seleccion"></g>
    </svg>
    <div class="rotulos" id="rotulos"></div>
  </div>

  <div class="cartel" id="cartel">
    <h1 id="titulo" data-t="titulo"></h1>
    <div class="bloque" id="bloqueFoto">
      <p class="bajada" data-t="bajada"></p>
      <div class="buscador" id="buscador1"></div>
      <p class="leyenda-punto"><i aria-hidden="true"></i><span id="leyendaPunto"></span></p>
      <button type="button" class="boton" id="verTemporada">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5 L19.5 12 L7 19.5 Z" fill="#D7261E"></path></svg>
        <span data-t="verTemporada"></span>
      </button>
    </div>
    <div class="bloque" id="bloqueFinal" hidden>
      <p class="resultado" id="resultado" tabindex="-1"></p>
      <p class="cierre cifra" id="cierre"></p>
      <button type="button" class="volver" id="volver" hidden><span aria-hidden="true">←</span> <span data-t="volver2026"></span></button>
      <div class="escala-color" id="escalaColor"></div>
      <div class="buscador" id="buscador2"></div>
    </div>
  </div>

  <!-- La tarjeta va antes del instrumento: con Tab, del buscador se llega a ella. -->
  <div class="tarjeta" id="tarjeta" hidden></div>

  <div class="instrumento" id="instrumento" hidden>
    <button type="button" class="control" id="control">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path id="controlIcono" fill="#121212"></path></svg>
    </button>
    <div class="lectura">
      <span class="fecha" id="fecha"></span>
      <span class="hasta" data-t="hastaHoy"></span>
      <div class="medidor cifra">
        <span id="filaAnio">2026</span><span class="pista" aria-hidden="true"><i class="a" id="b26"></i></span><b class="c26" id="n26">0</b>
        <span data-t="filaNormal"></span><span class="pista" aria-hidden="true"><i class="n" id="bNormal"></i></span><b class="cn" id="nNormal">0</b>
      </div>
    </div>
    <div class="tiempo" id="tiempo" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="91" aria-valuenow="0">
      <svg viewBox="0 0 920 60" preserveAspectRatio="none" aria-hidden="true">
        <defs><clipPath id="hasta"><rect id="hastaRect" x="0" y="-4" width="0" height="70"></rect></clipPath></defs>
        <path class="normal" id="siluetaNormal"></path>
        <path class="futuro" id="barrasFuturo"></path>
        <path class="pasado" id="barrasPasado" clip-path="url(#hasta)"></path>
        <rect class="hoy" id="barraHoy" x="0" y="60" width="7" height="0"></rect>
        <line class="eje" x1="0" y1="60" x2="920" y2="60"></line>
      </svg>
      <div class="ley-dias" aria-hidden="true"><span><i class="a"></i><span id="leyAnio"></span></span><span><i class="n"></i><span data-t="filaNormal"></span></span></div>
      <span class="fantasma" id="fantasma" hidden><span id="fantasmaTexto"></span></span>
      <span class="cabezal" id="cabezal"></span>
      <span class="mes" id="m0"></span>
      <span class="mes" id="m1"></span>
      <span class="mes" id="m2"></span>
      <span class="mes" id="m3"></span>
    </div>
  </div>

</section>

<aside class="panel" aria-labelledby="respuesta">
  <h2 id="respuesta"></h2>
  <div class="grafica">
    <span class="titulo" data-t="barrasTitulo"></span>
    <button type="button" class="ley-normal cifra" id="leyNormal" aria-expanded="false" aria-controls="explicaNormal"><i aria-hidden="true"></i><span id="leyNormalTexto"></span></button>
    <p class="explica" id="explicaNormal" data-t="explicaNormal" hidden></p>
    <svg id="barras"></svg>
  </div>
  <p class="tira-pista" id="pistaAnio"></p>
  <p id="barrasNota"></p>
  <hr class="separa">
  <h3 data-t="fechasTitulo"></h3>
  <p class="respuesta-corta" id="fechasRespuesta"></p>
  <div class="grafica">
    <span class="titulo" data-t="tiraTitulo"></span>
    <svg id="tira"></svg>
  </div>
  <p class="tira-pista" data-t="tiraVer"></p>
  <p id="fechasNota"></p>
  <a class="ir" href="#/fechas" data-t="verCalendario"></a>
  <p class="pie" id="pie"></p>
  <button type="button" class="atajos-boton" id="verAtajos" aria-haspopup="dialog"></button>
</aside>
<dialog class="atajos" id="atajos" aria-labelledby="atajosTitulo">
  <h2 id="atajosTitulo" data-t="atajosTitulo"></h2>
  <dl id="atajosLista"></dl>
  <button type="button" class="cerrar" id="atajosCerrar" data-t-aria="cerrar">×</button>
</dialog>`;

export function montar(raiz) {
  raiz.innerHTML = PLANTILLA;
  traducir(raiz);
  const escenario = $('escenario'), mapa = $('mapa'), lienzo = $('fuego'), ctx = lienzo.getContext('2d');
  let D = null;
  let modo = 'foto', t0 = 0, jugando = false, ultimoCuadro = 0, seleccion = null;
  // El año que pintan el mapa del cierre, la tarjeta y la línea de tiempo; el repaso es siempre de 2026.
  let anio = ANIO;
  const posicion = new Map(); // id → lugar del municipio en porAnio
  let ancho = 0, alto = 0, dpr = 1, sprites = [], spriteFoto = null, porDia = [];
  let cuadroId = 0, esperaFinal = 0, esperaMedir = 0;
  const munPorId = new Map();

  /* ---------- Tamaño: el mapa se ajusta al escenario sin deformarse ---------- */
  function medir() {
    const telefono = matchMedia('(max-width: 860px)').matches;
    if (telefono) {
      mapa.style.left = mapa.style.top = mapa.style.width = mapa.style.height = '';
      if (modo === 'final') {
        // Al cierre, el recuadro del mapa se recorta a Yucatán con un poco de aire.
        const aire = 0.05, bw = (YUC.x1 - YUC.x0) * (1 + 2 * aire), bh = (YUC.y1 - YUC.y0) * (1 + 2 * aire);
        mapa.style.aspectRatio = bw.toFixed(1) + ' / ' + bh.toFixed(1);
        const kk = mapa.clientWidth / bw;
        ancho = Math.round(W0 * kk); alto = Math.round(H0 * kk);
        capas(-(YUC.x0 - (YUC.x1 - YUC.x0) * aire) * kk, -(YUC.y0 - (YUC.y1 - YUC.y0) * aire - Y0) * kk, ancho, alto);
      } else {
        mapa.style.aspectRatio = '';
        capas();
        ancho = mapa.clientWidth; alto = mapa.clientHeight;
      }
      $('cartel').style.left = $('cartel').style.top = '';
      $('instrumento').style.left = $('instrumento').style.right = $('instrumento').style.bottom = '';
    } else {
      mapa.style.aspectRatio = '';
      capas();
      const W = escenario.clientWidth, H = escenario.clientHeight;
      const k = Math.min(W / W0, H / H0);
      ancho = Math.round(W0 * k); alto = Math.round(H0 * k);
      const x = Math.round((W - ancho) / 2), y = Math.round((H - alto) / 2);
      let mx = x, my = y;
      const m = Math.max(24, Math.round(ancho * 0.032));
      Object.assign($('cartel').style, { left: x + m + 'px', top: y + Math.round(m * 0.85) + 'px' });
      const abajoInstr = (H - y - alto) + Math.round(m * 0.7);
      Object.assign($('instrumento').style, { left: x + m + 'px', right: (W - x - ancho) + m + 'px', bottom: abajoInstr + 'px' });
      if (modo === 'final') {
        // Al cierre, la cámara se acerca a Yucatán, en el hueco que dejan el texto y la línea de tiempo.
        const izq = x + m + ($('bloqueFinal').offsetWidth || 300) + 40;
        const der = W - Math.max(40, Math.round(W * 0.045));
        const arriba = Math.max(36, Math.round(H * 0.05));
        const abajo = H - abajoInstr - ($('instrumento').offsetHeight || 120) - 20;
        const kz = Math.max(1, Math.min((der - izq) / ((YUC.x1 - YUC.x0) * k), (abajo - arriba) / ((YUC.y1 - YUC.y0) * k)));
        ancho = Math.round(W0 * k * kz); alto = Math.round(H0 * k * kz);
        mx = Math.round((izq + der) / 2 - ((YUC.x0 + YUC.x1) / 2 / W0) * ancho);
        my = Math.round((arriba + abajo) / 2 - ((YUC.y0 + YUC.y1) / 2 - Y0) / H0 * alto);
      }
      Object.assign(mapa.style, { left: mx + 'px', top: my + 'px', width: ancho + 'px', height: alto + 'px' });
      caja = { x: mx, y: my, w: ancho, h: alto };
    }
    despejarRotulos(telefono);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    lienzo.width = Math.round(ancho * dpr); lienzo.height = Math.round(alto * dpr);
    hacerSprites();
    if (D) prepararDias();
    dibujar();
    if (seleccion) ubicarTarjeta(seleccion);
  }
  // Un rótulo del mapa que quedaría debajo del texto o de la línea de tiempo se esconde.
  // Se calcula con la posición final del mapa, no con la de la transición.
  let caja = null;
  function despejarRotulos(telefono) {
    const rotulos = raiz.querySelectorAll('.rotulos .ciudad, .rotulos .estado, .rotulos .agua');
    if (telefono || !caja) { rotulos.forEach((r) => r.classList.remove('tapado')); return; }
    const er = escenario.getBoundingClientRect(), z = escalaPagina();
    const tapan = [...raiz.querySelectorAll('#titulo, .bloque:not([hidden]), .instrumento:not([hidden])')].map((e) => {
      const r = e.getBoundingClientRect();
      return { x0: (r.left - er.left) / z - 8, x1: (r.right - er.left) / z + 8, y0: (r.top - er.top) / z - 6, y1: (r.bottom - er.top) / z + 6 };
    });
    for (const r of rotulos) {
      const cx = caja.x + (parseFloat(r.style.left) / 100) * caja.w, cy = caja.y + (parseFloat(r.style.top) / 100) * caja.h;
      const w = r.offsetWidth, h = r.offsetHeight;
      const x0 = r.classList.contains('ciudad') ? (r.classList.contains('izq') ? cx + 7 - w : cx - 7) : cx - w / 2;
      const y0 = cy - h / 2;
      const choca = tapan.some((b) => x0 < b.x1 && x0 + w > b.x0 && y0 < b.y1 && y0 + h > b.y0);
      r.classList.toggle('tapado', choca);
    }
  }
  // En el teléfono, las capas del mapa se desplazan dentro de su recuadro; sin argumentos lo llenan.
  function capas(x, y, w, h) {
    for (const c of mapa.children) {
      if (x === undefined) { c.style.left = c.style.top = c.style.width = c.style.height = c.style.right = c.style.bottom = ''; continue; }
      Object.assign(c.style, { right: 'auto', bottom: 'auto', left: Math.round(x) + 'px', top: Math.round(y) + 'px', width: w + 'px', height: h + 'px' });
    }
  }
  const px = (x) => (x / W0) * ancho * dpr;
  const py = (y) => ((y - Y0) / H0) * alto * dpr;

  /* ---------- El fuego: puntos nítidos que se enfrían y se apagan ---------- */
  function mezcla(a, b, f) {
    const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
    const c = (s) => Math.round(((x >> s) & 255) * (1 - f) + ((y >> s) & 255) * f);
    return 'rgb(' + c(16) + ',' + c(8) + ',' + c(0) + ')';
  }
  function colorEdad(e) {
    let j = 0;
    while (j < EDAD.length - 2 && e > EDAD[j + 1][0]) j++;
    const [e0, c0] = EDAD[j], [e1, c1] = EDAD[j + 1];
    return mezcla(c0, c1, Math.max(0, Math.min(1, (e - e0) / (e1 - e0))));
  }
  // Un punto se dibuja una vez en un lienzo chico y después solo se copia: es lo más rápido.
  function punto(color, r) {
    const c = document.createElement('canvas');
    const s = Math.ceil(r * 2) + 2;
    c.width = c.height = s;
    const g = c.getContext('2d');
    g.fillStyle = color;
    g.beginPath();
    g.arc(s / 2, s / 2, r, 0, Math.PI * 2);
    g.fill();
    return c;
  }
  function hacerSprites() {
    const r = Math.max(1.6, 3.1 * (ancho / 1022)) * dpr;
    sprites = [];
    for (let i = 0; i < TONOS; i++) {
      const e = (i / (TONOS - 1)) * VIDA;
      sprites.push(punto(colorEdad(e), r * (1 - 0.45 * (e / VIDA))));
    }
    spriteFoto = punto(colorEdad(0.5), r * 1.1);
  }

  function dibujar() {
    if (!D || !ancho) return;
    ctx.clearRect(0, 0, lienzo.width, lienzo.height);
    if (modo === 'foto') {
      ctx.globalAlpha = 0.9;
      const h = spriteFoto.width / 2;
      for (const p of D.pts) ctx.drawImage(spriteFoto, px(p[0]) - h, py(p[1]) - h);
      ctx.globalAlpha = 1;
      return;
    }
    // Solo se recorren los días cuya brasa sigue viva; los más viejos van abajo.
    const hoy = Math.floor(t0 + 1e-6);
    for (let d = Math.max(0, hoy - VIDA + 1); d <= hoy; d++) {
      const edad = Math.max(0, t0 - d);
      const s = sprites[Math.min(TONOS - 1, Math.round((edad / VIDA) * (TONOS - 1)))];
      const h = s.width / 2;
      ctx.globalAlpha = edad < VIDA - 1.5 ? 0.92 : 0.92 * Math.max(0, (VIDA - edad) / 1.5);
      for (const p of porDia[d]) ctx.drawImage(s, p[0] - h, p[1] - h);
    }
    ctx.globalAlpha = 1;
  }
  function prepararDias() {
    porDia = Array.from({ length: DIAS }, () => []);
    for (const c of D.rep) {
      const x = Math.round(px(c[0])), y = Math.round(py(c[1]));
      for (const d of c[2]) if (d >= 0 && d < DIAS) porDia[d].push([x, y]);
    }
  }

  /* ---------- Línea de tiempo: una barra por día y lo normal detrás ---------- */
  // Cada día ocupa 10 unidades del dibujo; la barra mide 7 y deja 3 de aire.
  let dia26 = [], acum = [], tope = 1, total = 1, diaPintado = -1;
  const alturaBarra = (v) => (v / tope) * 54;
  function armarTiempo() {
    acum = anio === ANIO ? D.acum26 : D.yuc.acum[anio];
    const n = D.acumNormal;
    dia26 = acum.map((v, i) => Math.max(0, v - (i ? acum[i - 1] : 0)));
    const normalDia = n.map((v, i) => Math.max(0, v - (i ? n[i - 1] : 0)));
    // Lo normal de cada día varía mucho de un día al siguiente: se dibuja el promedio de la semana alrededor.
    const suave = normalDia.map((_, i) => {
      const ventana = normalDia.slice(Math.max(0, i - 3), Math.min(DIAS, i + 4));
      return ventana.reduce((s, v) => s + v, 0) / ventana.length;
    });
    tope = Math.max(...dia26, ...suave);
    total = Math.max(n[ULTIMO], acum[ULTIMO]);
    let silueta = '';
    suave.forEach((v, i) => { const y = (60 - alturaBarra(v)).toFixed(1); silueta += `${i ? 'L' : 'M'}${i * 10},${y}L${i * 10 + 10},${y}`; });
    $('siluetaNormal').setAttribute('d', silueta);
    const barras = dia26.map((v, i) => (v > 0 ? `M${i * 10 + 1.5},60V${(60 - Math.max(1, alturaBarra(v))).toFixed(1)}h7V60Z` : '')).join('');
    $('barrasFuturo').setAttribute('d', barras);
    $('barrasPasado').setAttribute('d', barras);
    $('filaAnio').textContent = String(anio);
    $('leyAnio').textContent = t('anioPorDia', { a: anio });
    $('tiempo').setAttribute('aria-label', t('diaTemporada', { a: anio }));
    diaPintado = -1;
  }
  const lerp = (s, tt) => {
    const i = Math.floor(tt), f = tt - i;
    return i >= ULTIMO ? s[ULTIMO] : s[i] * (1 - f) + s[i + 1] * f;
  };
  const diaDeTemporada = (i) => new Date(2026, 2, 1 + i, 12);
  // Solo se escribe en la página lo que cambió: el cuadro se mantiene liviano.
  const poner = (id, texto) => { const e = $(id); if (e.textContent !== texto) e.textContent = texto; };
  function actualizarTiempo() {
    if (!D) return;
    const a = lerp(acum, t0), n = lerp(D.acumNormal, t0);
    const dia = Math.min(ULTIMO, Math.floor(t0 + 1e-6));
    poner('n26', fmt(a));
    poner('nNormal', fmt(n));
    $('b26').style.transform = `scaleX(${(a / total).toFixed(4)})`;
    $('bNormal').style.transform = `scaleX(${(n / total).toFixed(4)})`;
    $('cabezal').style.transform = `translateX(${(((t0 + 0.5) / DIAS) * 100).toFixed(3)}%)`;
    if (dia === diaPintado) return;
    diaPintado = dia;
    poner('fecha', fechaDia(diaDeTemporada(dia)));
    $('hastaRect').setAttribute('width', String((dia + 1) * 10));
    const hoy = $('barraHoy'), h = dia26[dia] > 0 ? Math.max(1, alturaBarra(dia26[dia])) : 0;
    hoy.setAttribute('x', String(dia * 10 + 1.5));
    hoy.setAttribute('y', (60 - h).toFixed(1));
    hoy.setAttribute('height', h.toFixed(1));
    const tiempo = $('tiempo');
    tiempo.setAttribute('aria-valuenow', String(dia));
    tiempo.setAttribute('aria-valuetext', t('valorTiempo', { f: fechaDia(diaDeTemporada(dia)), a: fmt(acum[dia]), y: anio, n: fmt(D.acumNormal[dia]) }));
  }
  // Al pasar el mouse por la línea de tiempo se lee cada día sin mover el repaso.
  function mostrarFantasma(ev) {
    const r = $('tiempo').getBoundingClientRect();
    const i = Math.max(0, Math.min(ULTIMO, Math.floor(((ev.clientX - r.left) / r.width) * DIAS)));
    const f = $('fantasma');
    f.hidden = false;
    f.style.transform = `translateX(${(((i + 0.5) / DIAS) * 100).toFixed(3)}%)`;
    f.dataset.borde = i < 8 ? 'izq' : i > ULTIMO - 8 ? 'der' : '';
    poner('fantasmaTexto', t(dia26[i] === 1 ? 'diaFocosUno' : 'diaFocos', { f: fechaCorta(diaDeTemporada(i)), n: fmt(dia26[i]) }));
  }

  /* ---------- La dirección sigue el estado: #/?modo=final&anio=2003&sel=<id> ---------- */
  // Cada acción de la persona (empezar, elegir un municipio o un año) deja una entrada que «Atrás»
  // deshace; el día del repaso solo se reescribe, para no llenar el historial al arrastrar.
  let aplicando = false, esperaURL = 0;
  const CLAVES = ['modo', 't', 'sel', 'anio'];
  function leerEstado() {
    const i = location.hash.indexOf('?');
    // Las direcciones viejas (?modo=final, antes del ancla) se siguen leyendo.
    const q = new URLSearchParams(i >= 0 ? location.hash.slice(i + 1) : location.search);
    return { modo: q.get('modo'), t: q.has('t') ? Number(q.get('t')) : null, sel: q.get('sel'), anio: Number(q.get('anio')) || ANIO };
  }
  function direccion() {
    const q = new URLSearchParams();
    if (modo !== 'foto') q.set('modo', modo);
    if (modo === 'repaso' && !jugando) q.set('t', String(Math.round(t0)));
    if (anio !== ANIO) q.set('anio', String(anio));
    if (seleccion) q.set('sel', seleccion);
    const busqueda = new URLSearchParams(location.search);
    CLAVES.forEach((k) => busqueda.delete(k));
    const b = busqueda.toString(), e = q.toString();
    return location.pathname + (b ? '?' + b : '') + '#/' + (e ? '?' + e : '');
  }
  function guardar(nueva) {
    if (aplicando || !D) return;
    clearTimeout(esperaURL);
    const escribir = () => {
      const url = direccion();
      if (url === location.pathname + location.search + location.hash) return;
      if (nueva) history.pushState(null, '', url); else history.replaceState(null, '', url);
    };
    // Safari limita cuántas veces por segundo se puede reescribir la dirección.
    if (nueva) escribir(); else esperaURL = setTimeout(escribir, 250);
  }
  function aplicar(e) {
    aplicando = true;
    try {
      const a = D.porAnio.anios.includes(e.anio) ? e.anio : ANIO;
      if (e.modo === 'repaso') irADia(Number.isFinite(e.t) ? e.t : 45);
      else if (e.modo === 'final' || e.sel || a !== ANIO || reducirMovimiento()) {
        if (modo !== 'final') { pausar(); irFinal(); }
        if (a !== anio) ponerAnio(a);
        if (e.sel && munPorId.has(e.sel)) { if (e.sel !== seleccion) seleccionar(e.sel, true); }
        else if (seleccion) quitarSeleccion();
      } else {
        pausar();
        volverA2026();
        t0 = 0;
        ponerModo('foto');
      }
    } finally { aplicando = false; }
  }

  /* ---------- Momentos: foto, repaso y cierre ---------- */
  function descripcion() {
    $('capaDesc').textContent = modo === 'foto' ? t('descFoto', { f: D ? fechaDiaAnio(D.diaMax.fecha) : '' }) : (modo === 'repaso' ? t('descRepaso') : t('descFinal', { a: anio }) + ' ' + t('mapaTeclado'));
  }
  function ponerModo(m) {
    const cambiaEncuadre = (m === 'final') !== (modo === 'final');
    modo = m;
    escenario.dataset.modo = m;
    $('bloqueFoto').hidden = m !== 'foto';
    $('bloqueFinal').hidden = m !== 'final';
    $('instrumento').hidden = m === 'foto';
    // En el cierre, el mapa se recorre con las flechas: es una parada de Tab.
    if (m === 'final') $('capa').setAttribute('tabindex', '0'); else $('capa').removeAttribute('tabindex');
    descripcion();
    iconoControl();
    if (m !== 'final') quitarSeleccion(false, true); // la entrada la escribe quien cambió el momento
    if (!seleccion) { $('tarjeta').hidden = true; $('encima').textContent = ''; }
    despejarRotulos(telefono());
    if (cambiaEncuadre) {
      const antes = caja && !telefono() ? { ...caja } : null;
      medir();
      if (antes && caja && !reducirMovimiento()) volar(antes, caja);
    } else dibujar();
  }
  // La cámara: el mapa ya está en su lugar final y se anima desde donde estaba solo con transform,
  // que no obliga al navegador a volver a acomodar la página en cada cuadro.
  function volar(a, b) {
    if (a.w === b.w && a.x === b.x && a.y === b.y) return;
    mapa.style.transition = 'none';
    mapa.style.transformOrigin = '0 0';
    mapa.style.transform = `translate(${a.x - b.x}px, ${a.y - b.y}px) scale(${a.w / b.w})`;
    mapa.getBoundingClientRect();
    mapa.style.transition = 'transform 0.65s cubic-bezier(0.22, 1, 0.36, 1)';
    mapa.style.transform = '';
  }
  function iconoControl() {
    const b = $('control'), i = $('controlIcono');
    if (modo === 'final') {
      i.setAttribute('d', 'M5 12 A7 7 0 1 0 8 6.3 M8 2.5 L8 6.8 L3.8 6.8');
      i.setAttribute('fill', 'none'); i.setAttribute('stroke', '#121212'); i.setAttribute('stroke-width', '2.4');
      b.setAttribute('aria-label', t('repetir'));
    } else {
      i.removeAttribute('stroke'); i.setAttribute('fill', '#121212');
      i.setAttribute('d', jugando ? 'M6 4 H10 V20 H6 Z M14 4 H18 V20 H14 Z' : 'M7 4.5 L19.5 12 L7 19.5 Z');
      b.setAttribute('aria-label', t(jugando ? 'pausar' : 'seguir'));
    }
  }
  const telefono = () => matchMedia('(max-width: 860px)').matches;
  const verMapa = () => { if (telefono()) mapa.scrollIntoView({ block: 'start', behavior: reducirMovimiento() ? 'auto' : 'smooth' }); };
  function jugar(desde) {
    const empieza = modo !== 'repaso';
    volverA2026();
    if (desde !== undefined) t0 = desde;
    if (t0 >= ULTIMO) t0 = 0;
    ponerModo('repaso');
    verMapa();
    jugando = true;
    iconoControl();
    guardar(empieza);
    ultimoCuadro = performance.now();
    cancelAnimationFrame(cuadroId);
    cuadroId = requestAnimationFrame(cuadro);
  }
  function pausar() {
    const estaba = jugando;
    jugando = false;
    cancelAnimationFrame(cuadroId);
    iconoControl();
    // En pausa el repaso queda en un día entero: la cifra dice lo mismo que la fecha y el lector de pantalla.
    if (estaba && D && t0 % 1) { t0 = Math.floor(t0); dibujar(); actualizarTiempo(); }
    if (estaba && modo === 'repaso') guardar(false);
  }
  function cuadro(ahora) {
    if (!jugando) return;
    const dt = Math.min(0.1, (ahora - ultimoCuadro) / 1000);
    ultimoCuadro = ahora;
    t0 = Math.min(ULTIMO, t0 + dt * VEL);
    dibujar();
    actualizarTiempo();
    if (t0 >= ULTIMO) {
      jugando = false;
      clearTimeout(esperaFinal);
      esperaFinal = setTimeout(() => { if (!jugando && t0 >= ULTIMO) { irFinal(); anunciar($('resultado').textContent); } }, 250);
      return;
    }
    cuadroId = requestAnimationFrame(cuadro);
  }
  function irFinal() {
    jugando = false;
    t0 = ULTIMO;
    actualizarTiempo();
    ponerModo('final');
    guardar(false);
  }
  function irADia(i) {
    pausar();
    volverA2026();
    t0 = Math.max(0, Math.min(ULTIMO, i));
    if (modo !== 'repaso') ponerModo('repaso');
    dibujar();
    actualizarTiempo();
    guardar(false);
  }

  /* ---------- Otro año en el mapa: tocar una barra del panel ---------- */
  function claseDe(id, a = anio) {
    if (a === ANIO) return D.clases[id] || 'poco';
    const i = posicion.get(id);
    return i === undefined ? 'poco' : CLASES[Number(D.porAnio.clases[a][i])];
  }
  function valoresDe(id, a = anio) {
    const [v26, normal] = D.valores[id] || [0, 0];
    if (a === ANIO) return [v26, normal];
    const i = posicion.get(id);
    return [i === undefined ? 0 : D.porAnio.v[i][D.porAnio.anios.indexOf(a)], normal];
  }
  function ponerAnio(a) {
    anio = a;
    if (modo !== 'final') { pausar(); t0 = ULTIMO; }
    armarTiempo();
    actualizarTiempo();
    if (modo !== 'final') ponerModo('final'); else descripcion();
    pintarAnio();
  }
  function elegirAnio(a) {
    // Tocar otra vez el año elegido vuelve a 2026.
    ponerAnio(a === anio ? ANIO : a);
    guardar(true);
    verMapa();
    // El foco se queda en la barra: se avisa lo que cambió en el mapa.
    anunciar($('resultado').textContent + ' ' + $('pistaAnio').textContent);
  }
  // Arrastrar sobre las barras pasa por los años; al soltar queda una sola entrada en el historial.
  function barrerAnio(a) {
    if (a === null) { guardar(true); anunciar($('resultado').textContent + ' ' + $('pistaAnio').textContent); return; }
    if (a !== anio) ponerAnio(a);
  }
  function volverA2026() {
    if (anio === ANIO) return;
    anio = ANIO;
    armarTiempo();
    actualizarTiempo(); // si no, el medidor se queda con el acumulado del año que se veía
    pintarAnio();
  }
  function pintarAnio() {
    for (const p of $('rellenos').children) p.setAttribute('fill', COLOR[claseDe(p.getAttribute('data-id'))]);
    escenario.classList.toggle('otro-anio', anio !== ANIO);
    $('volver').hidden = anio === ANIO;
    textosAnio();
    barrasPanel();
    if (seleccion) { contenidoTarjeta(seleccion, true); ubicarTarjeta(seleccion); }
  }
  // La frase grande del cierre y la de abajo dicen el año que se ve en el mapa.
  function textosAnio() {
    const resultado = $('resultado');
    resultado.textContent = '';
    let clave = 'resultado', n = D.cuenta.menos;
    if (anio !== ANIO) {
      const c = D.porAnio.cuenta[anio];
      clave = c.mas > c.menos ? 'resultadoMasAnio' : 'resultadoMenosAnio';
      n = c.mas > c.menos ? c.mas : c.menos;
    }
    const cifra = document.createElement('span');
    cifra.className = 'cifra';
    cifra.textContent = String(n);
    const [antes, despues] = t(clave, { n: '\u0000', t: D.cuenta.total, a: anio }).split('\u0000');
    resultado.append(antes, cifra, despues);
    // Con otro año en el mapa, el panel sigue hablando de 2026: la pista lo aclara.
    $('pistaAnio').textContent = anio === ANIO ? t('tocaAnioMapa') : t('anioEnMapa', { a: anio });
    $('cierre').textContent = anio === ANIO
      ? t('cierre', { a: fmt(D.acum26[ULTIMO]), b: fmt(D.acumNormal[ULTIMO]) })
      : t('cierreAnio', { y: anio, a: fmt(D.yuc.acum[anio][ULTIMO]), b: fmt(D.acumNormal[ULTIMO]) });
  }

  /* ---------- Capas del mapa ---------- */
  function armarMapa() {
    const rel = $('rellenos'), lim = $('limites'), est = $('estados');
    const xs = D.mun.map((m) => m.cx);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    for (const m of D.mun) {
      munPorId.set(m.id, m);
      const c = claseDe(m.id);
      const fuera = m.e !== 'Yucatán' ? 'fuera' : '';
      const p = el('path', { d: m.d, fill: COLOR[c], 'pointer-events': 'all', 'data-id': m.id, class: fuera }, rel);
      p.style.transitionDelay = (((m.cx - x0) / (x1 - x0)) * 0.3).toFixed(2) + 's';
      el('path', { d: m.d, class: fuera }, lim);
    }
    for (const e of D.estados) el('path', { d: e.d, class: e.n === 'Yucatán' ? 'yucatan' : '' }, est);
    rel.addEventListener('pointermove', (ev) => {
      // En la foto los municipios todavía no se ven: no hay tarjeta al pasar.
      if (seleccion || jugando || modo === 'foto' || ev.pointerType === 'touch') return;
      const id = ev.target.getAttribute('data-id');
      if (id) mostrarTarjeta(id, ev);
    });
    rel.addEventListener('pointerleave', () => {
      $('encima').textContent = '';
      if (!seleccion) $('tarjeta').hidden = true;
    });
    let presion = 0, tragarClic = false;
    rel.addEventListener('pointerdown', (ev) => {
      const id = ev.target.getAttribute('data-id');
      if (modo !== 'final' || !id) return;
      const x0 = ev.clientX, y0 = ev.clientY;
      const fin = () => { clearTimeout(presion); rel.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', fin); window.removeEventListener('pointercancel', fin); };
      const mover = (e) => { if (Math.hypot(e.clientX - x0, e.clientY - y0) > 8) fin(); };
      clearTimeout(presion);
      presion = setTimeout(() => { fin(); tragarClic = true; abrirHistoria(id); }, 450);
      rel.addEventListener('pointermove', mover);
      window.addEventListener('pointerup', fin);
      window.addEventListener('pointercancel', fin);
    });
    // Mantener presionado con el dedo no debe abrir el menú del navegador.
    rel.addEventListener('contextmenu', (ev) => { if (modo === 'final') ev.preventDefault(); });
    rel.addEventListener('click', (ev) => {
      if (tragarClic) { tragarClic = false; return; }
      // Tocar un municipio a media animación la interrumpe y abre su tarjeta. En la foto el mapa
      // de municipios no se ve: un toque ahí no debe saltar al cierre.
      if (modo === 'foto') return;
      const id = ev.target.getAttribute('data-id');
      if (id) seleccionar(id, false);
    });
  }

  function armarRotulos() {
    const r = $('rotulos');
    r.textContent = '';
    const pos = (x, y) => 'left:' + ((x / W0) * 100).toFixed(2) + '%;top:' + (((y - Y0) / H0) * 100).toFixed(2) + '%';
    const add = (texto, cls, x, y) => {
      const d = document.createElement('div');
      d.className = 'rotulo ' + cls;
      d.setAttribute('style', pos(x, y));
      d.textContent = texto;
      r.appendChild(d);
      return d;
    };
    // Al acercarse a Yucatán, los rótulos de los mares y de los otros estados quedarían cortados en el borde.
    add(t('golfo'), 'agua contexto', 52, 412);
    add(t('caribe'), 'agua contexto', 778, 322);
    add('Yucatán', 'estado contexto', 490, 168);
    add('Campeche', 'estado contexto', 268, 432);
    add('Quintana Roo', 'estado contexto', 690, 300);
    const CAPITAL = new Set(['Mérida', 'Campeche', 'Chetumal']);
    for (const c of D.ciudades) {
      const izq = c.t === 'Cancún';
      const d = add('', 'ciudad' + (izq ? ' izq' : '') + (c.t === 'Mérida' ? ' grande' : '') + (c.t === 'Chetumal' ? ' sur' : '') + (c.t !== 'Mérida' ? ' contexto' : ''), c.x, c.y);
      const punto = document.createElement('span');
      punto.className = 'punto' + (CAPITAL.has(c.t) ? ' capital' : '');
      const nombre = document.createElement('span');
      nombre.textContent = c.t;
      d.append(punto, nombre);
    }
    // Notas del cierre: el municipio de ejemplo (Umán) siempre; un municipio con más fuego, solo si lo hay.
    const tk = munPorId.get(EJEMPLO);
    if (tk) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rotulo nota-mapa enlace solo-final';
      b.setAttribute('style', pos(tk.cx, tk.cy + 4));
      b.textContent = tk.n;
      b.addEventListener('click', () => seleccionar(tk.id, false));
      r.appendChild(b);
    }
    const mas = D.mun.filter((m) => m.e === 'Yucatán' && (D.clases[m.id] === 'arriba' || D.clases[m.id] === 'muyarriba')).slice(0, 3);
    for (const m of mas) {
      const n = add(t('notaMas', { m: m.n }), 'nota-mapa solo-final', m.cx, m.cy - 20);
      n.style.transform = 'translate(-50%, -100%)';
    }
    const esc = document.createElement('div');
    esc.className = 'escala contexto';
    // 50 km a esta latitud: 50 / 111.32 grados de latitud por 150 unidades del lienzo.
    const u50 = (50 / 111.32) * 150;
    esc.setAttribute('style', 'right:3.2%;top:3%;width:' + ((u50 / W0) * 100).toFixed(2) + '%');
    esc.innerHTML = '<span></span><span></span>';
    esc.lastChild.textContent = t('escalaKm');
    r.appendChild(esc);
  }

  function armarEscala() {
    const cont = $('escalaColor');
    cont.textContent = '';
    const tiras = document.createElement('div');
    tiras.className = 'tiras';
    tiras.setAttribute('aria-hidden', 'true');
    for (const c of ESCALA) { const i = document.createElement('i'); i.style.background = COLOR[c]; tiras.appendChild(i); }
    const rot = document.createElement('div');
    rot.className = 'rotulos-escala';
    for (const k of ['muchoMenos', 'normal', 'muchoMas']) { const s = document.createElement('span'); s.textContent = t(k); rot.appendChild(s); }
    const poco = document.createElement('div');
    poco.className = 'poco';
    poco.innerHTML = '<i aria-hidden="true"></i><span></span>';
    poco.firstChild.style.background = COLOR.poco;
    poco.lastChild.textContent = t('poco');
    const nota = document.createElement('p');
    nota.className = 'nota';
    nota.textContent = t('vecinos');
    cont.append(tiras, rot, poco, nota);
  }

  /* ---------- Tarjeta de un municipio ---------- */
  // Función escondida: mantener presionado un municipio (o Espacio en el mapa) abre sus 26 años en la tarjeta.
  let historia = false;
  const yaVioHistoria = () => { try { return localStorage.getItem('kaak-historia') === '1'; } catch { return false; } };
  function graficaHistoria(id) {
    const i = posicion.get(id);
    const [, normal] = D.valores[id] || [0, 0];
    const anios = D.porAnio.anios.map((a, k) => ({ y: a, v: i === undefined ? 0 : D.porAnio.v[i][k] }));
    const W = 218, H = 58, base = H - 14;
    const max = Math.max(...anios.map((a) => a.v), normal, 1);
    const paso = W / anios.length;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'historia', role: 'img' });
    svg.setAttribute('aria-label', t('historiaAria', { m: munPorId.get(id).n, n: fmt(normal), a: anio, v: fmt(valoresDe(id)[0]) }));
    anios.forEach((a, k) => {
      const h = Math.max(a.v > 0 ? 1 : 0, (a.v / max) * (base - 4));
      el('rect', { x: (k * paso + 0.5).toFixed(1), y: (base - h).toFixed(1), width: (paso - 1.5).toFixed(1), height: h.toFixed(1), class: a.y === anio ? 'este' : '' }, svg);
    });
    const yn = (base - (normal / max) * (base - 4)).toFixed(1);
    el('line', { x1: 0, x2: W, y1: yn, y2: yn, class: 'normal' }, svg);
    el('line', { x1: 0, x2: W, y1: base + 0.5, y2: base + 0.5, class: 'eje' }, svg);
    el('text', { x: 0, y: H - 1 }, svg).textContent = String(anios[0].y);
    el('text', { x: W, y: H - 1, 'text-anchor': 'end' }, svg).textContent = String(anios[anios.length - 1].y);
    return svg;
  }
  function abrirHistoria(id) {
    if (seleccion !== id) seleccionar(id, false);
    historia = !historia || seleccion !== id;
    try { localStorage.setItem('kaak-historia', '1'); } catch { /* sin almacenamiento: la pista vuelve a salir */ }
    contenidoTarjeta(id, true);
    ubicarTarjeta(id);
    if (historia) anunciar($('tarjeta').querySelector('.historia').getAttribute('aria-label'));
  }
  function contenidoTarjeta(id, fija) {
    const m = munPorId.get(id);
    const [v26, normal] = valoresDe(id);
    const c = claseDe(id);
    const tj = $('tarjeta');
    tj.textContent = '';
    const span = (cls, texto) => { const s = document.createElement('span'); s.className = cls; if (texto !== undefined) s.textContent = texto; tj.appendChild(s); return s; };
    span('nombre', m.n);
    span('edo', t('periodo', { e: m.e }));
    for (const [k, v] of [['tAnio', v26], ['tNormal', normal]]) {
      const f = span('fila');
      const a = document.createElement('span'); a.textContent = t(k, { a: anio });
      const b = document.createElement('b'); b.className = 'cifra'; b.textContent = fmt(v);
      f.append(a, b);
    }
    const ver = span('veredicto');
    const i = document.createElement('i'); i.style.background = COLOR[c];
    ver.append(i, document.createTextNode(veredicto(v26, normal, c)));
    if (fija && historia) {
      const h = span('historia-titulo');
      const ley = document.createElement('span');
      const raya = document.createElement('i'); raya.setAttribute('aria-hidden', 'true');
      ley.append(raya, t('loNormalCorto'));
      h.append(t('historiaTitulo'), ley);
      tj.appendChild(graficaHistoria(id));
    } else if (!yaVioHistoria() && matchMedia('(hover: hover)').matches === !fija) {
      // La pista sale hasta que se usa una vez: en la tarjeta al pasar con el mouse, o en la fija con el dedo.
      span('pista-historia', t(fija ? 'pistaHistoriaDedo' : 'pistaHistoria'));
    }
    if (fija) {
      const a = document.createElement('a');
      a.href = '#/municipio/' + encodeURIComponent(id);
      a.textContent = t('verDetalle', { m: m.n });
      tj.appendChild(a);
      const x = document.createElement('button');
      x.type = 'button'; x.className = 'cerrar'; x.setAttribute('aria-label', t('cerrar')); x.textContent = '×';
      x.addEventListener('click', () => quitarSeleccion(true));
      tj.appendChild(x);
    }
  }
  function marcarEncima(id) {
    const g = $('encima');
    g.textContent = '';
    if (id && id !== seleccion) el('path', { d: munPorId.get(id).d }, g);
  }
  function mostrarTarjeta(id, ev) {
    const tj = $('tarjeta');
    tj.className = 'tarjeta';
    contenidoTarjeta(id, false);
    tj.hidden = false;
    marcarEncima(id);
    const r = escenario.getBoundingClientRect(), z = escalaPagina();
    const px = (ev.clientX - r.left) / z, py = (ev.clientY - r.top) / z;
    let x = px + 18, y = py + 18;
    if (x + 260 > r.width / z) x = px - 268;
    if (y + 170 > r.height / z) y = py - 178;
    tj.style.left = x + 'px'; tj.style.top = y + 'px';
  }
  function ubicarTarjeta(id) {
    const m = munPorId.get(id);
    const tj = $('tarjeta');
    const mr = mapa.getBoundingClientRect(), er = escenario.getBoundingClientRect(), z = escalaPagina();
    const cx = (mr.left - er.left + (m.cx / W0) * mr.width) / z, cy = (mr.top - er.top + ((m.cy - Y0) / H0) * mr.height) / z;
    const ew = er.width / z, eh = er.height / z;
    const w = tj.offsetWidth || 250, h = tj.offsetHeight || 180;
    let x = cx + 28, y = cy - h / 2;
    if (x + w > ew - 12) x = cx - w - 28;
    // Un municipio fuera del encuadre (Cancún, con el mapa en Yucatán) no debe sacar la tarjeta.
    x = Math.max(12, Math.min(ew - w - 12, x));
    y = Math.max(12, Math.min(eh - h - 12, y));
    tj.style.left = x + 'px'; tj.style.top = y + 'px';
  }
  function seleccionar(id, desdeBuscador, nueva = true) {
    if (!munPorId.has(id)) return;
    if (id !== seleccion) historia = false;
    if (modo !== 'final') { pausar(); t0 = ULTIMO; actualizarTiempo(); ponerModo('final'); }
    seleccion = id;
    const m = munPorId.get(id);
    const s = $('seleccion');
    s.textContent = '';
    $('encima').textContent = '';
    el('path', { d: m.d, class: 'halo' }, s);
    el('path', { d: m.d, class: 'borde' }, s);
    const tj = $('tarjeta');
    escenario.classList.add('con-tarjeta');
    tj.className = 'tarjeta fija';
    contenidoTarjeta(id, true);
    tj.hidden = false;
    ubicarTarjeta(id);
    verMapa();
    guardar(nueva);
    if (!desdeBuscador) tj.querySelector('.cerrar').focus({ preventScroll: true });
    // Desde el buscador el foco se queda en el campo: la tarjeta se lee en voz alta.
    else anunciar([...tj.querySelectorAll('.nombre, .edo, .fila, .veredicto')].map((e) => [...e.childNodes].map((n) => n.textContent).join(' ')).join('. '));
  }
  function quitarSeleccion(enfocar, callado) {
    if (!seleccion) return;
    seleccion = null;
    if (!callado) guardar(true);
    escenario.classList.remove('con-tarjeta');
    $('seleccion').textContent = '';
    $('tarjeta').hidden = true;
    if (enfocar) {
      const i = raiz.querySelector('.bloque:not([hidden]) .buscador input');
      if (i) i.focus();
    }
  }

  /* ---------- El mapa con el teclado: las flechas pasan al municipio de al lado ---------- */
  function vecino(dx, dy) {
    const yuc = D.mun.filter((m) => m.e === 'Yucatán');
    const de = seleccion && munPorId.get(seleccion);
    if (!de) return munPorId.get(EJEMPLO) || yuc[0];
    let mejor = null, puntos = Infinity;
    for (const m of yuc) {
      if (m.id === de.id) continue;
      const vx = m.cx - de.cx, vy = m.cy - de.cy;
      const adelante = vx * dx + vy * dy;
      if (adelante <= 0) continue;
      // Gana el más cercano en esa dirección; desviarse de lado cuenta más que avanzar.
      const p = adelante + 2.5 * Math.abs(vx * dy - vy * dx);
      if (p < puntos) { puntos = p; mejor = m; }
    }
    return mejor;
  }
  $('capa').addEventListener('keydown', (e) => {
    if (modo !== 'final' || !D) return;
    const dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (dir) {
      e.preventDefault();
      const m = vecino(...dir);
      // Recorrer el mapa no llena el historial: solo la primera elección deja una entrada.
      if (m) seleccionar(m.id, true, !seleccion);
    } else if (e.key === 'Enter' && seleccion) {
      e.preventDefault();
      location.hash = '#/municipio/' + encodeURIComponent(seleccion);
    } else if (e.key === ' ' && seleccion) {
      e.preventDefault();
      abrirHistoria(seleccion);
    }
  });

  /* ---------- Panel ---------- */
  // Las barras de cada año: tocar una pinta ese año en el mapa.
  function barrasPanel() {
    const y = D.yuc;
    const anios = Object.keys(y.anios).map(Number).sort((a, b) => a - b).map((a) => ({ y: a, total: y.anios[a] }));
    barrasAnios($('barras'), {
      anios, normal: y.normal, alTocar: elegirAnio, alBarrer: barrerAnio, seleccionado: anio === ANIO ? null : anio,
      aria: t('barrasAria', { n: fmt(y.normal), a: fmt(y.anios[ANIO]) }),
    });
  }
  function armarPanel() {
    const y = D.yuc;
    const anios = Object.keys(y.anios).map(Number).sort((a, b) => a - b).map((a) => ({ y: a, total: y.anios[a] }));
    const v26 = y.anios[2026];
    const antes = anios.filter((a) => a.y < 2026).map((a) => a.total);
    const r = v26 / y.normal;
    const respuesta = v26 < Math.min(...antes) ? 'respuestaMinimo' : r < 0.8 ? 'respuestaMenos' : r <= 1.25 ? 'respuestaNormal' : 'respuestaMas';
    $('respuesta').textContent = t(respuesta);
    $('leyNormalTexto').textContent = t('loNormal', { n: fmt(y.normal) });
    barrasPanel();
    const f = fechaDia(D.diaMax.fecha);
    $('barrasNota').textContent = t(r < 0.5 ? 'barrasNotaMitad' : r < 1 ? 'barrasNotaMenos' : 'barrasNotaMas', { f });
    const z = D.z2;
    const ini = fechaDia(deMesDia(z.ventana.inicio)), fin = fechaDia(deMesDia(z.ventana.fin));
    tiraDias($('tira'), {
      dias: z.dias, ini: z.ini, fin: z.fin, tocables: [MARZO_1, MARZO_1 + ULTIMO],
      alTocar: (i) => { irADia(i - MARZO_1); verMapa(); },
      aria: t('tiraAria', { i: ini, f: fin }),
    });
    const k = z.tot ? Math.round(((z.tot - z.dentro) / z.tot) * 10) : 0;
    // La respuesta va arriba, como la del estado; la gráfica y la nota la explican.
    $('fechasRespuesta').textContent = t('fechasRespuesta', { k });
    $('fechasNota').textContent = t('fechasNota', { i: ini, f: fin });
    $('pie').textContent = t('pie', { f: fechaDiaAnio(D.actualizado) });
  }

  /* ---------- Textos que dependen de los datos o del idioma ---------- */
  function textos() {
    // Los meses van bajo su día; el primero y el último se alinean con los bordes.
    [0, 31, 61, 91].forEach((d, i) => {
      const m = $('m' + i);
      m.textContent = fechaCorta(diaDeTemporada(d));
      m.className = 'mes' + (i === 0 ? ' primero' : i === 3 ? ' ultimo' : '');
      m.style.left = i === 0 ? '0' : i === 3 ? '100%' : (((d + 0.5) / DIAS) * 100).toFixed(2) + '%';
    });
    diaPintado = -1;
    $('leyAnio').textContent = t('anioPorDia', { a: anio });
    $('tiempo').setAttribute('aria-label', t('diaTemporada', { a: anio }));
    iconoControl();
    if (!D) return;
    $('leyendaPunto').textContent = t('leyendaPunto', { f: fechaDiaAnio(D.diaMax.fecha), n: fmt(D.diaMax.n) });
    textosAnio();
    const alElegir = (m) => seleccionar(m.id, true);
    // Con la ubicación se va directo a la página del municipio, donde está su ficha.
    const alUbicar = (m) => { location.hash = '#/municipio/' + encodeURIComponent(m.id); };
    armarBuscador($('buscador1'), 1, { municipios: D.mun, alElegir, alUbicar });
    // En el cierre no cabe: ahí el buscador va sin el botón de ubicación.
    armarBuscador($('buscador2'), 2, { municipios: D.mun, alElegir });
    armarRotulos();
    despejarRotulos(telefono());
    armarEscala();
    armarPanel();
    armarAtajos();
    actualizarTiempo();
    descripcion();
    if (seleccion) { contenidoTarjeta(seleccion, true); ubicarTarjeta(seleccion); }
  }

  /* ---------- Atajos de teclado (función escondida): «?» muestra la lista ---------- */
  function armarAtajos() {
    const b = $('verAtajos');
    b.textContent = '';
    const k = document.createElement('kbd'); k.textContent = '?';
    b.append(t('atajosBoton') + ' ', k);
    const dl = $('atajosLista');
    dl.textContent = '';
    for (const [teclas, que] of t('atajos')) {
      const dt = document.createElement('dt');
      teclas.split(' ').forEach((tecla, i) => {
        if (i) dt.append(' ');
        if (/^\[.*\]$/.test(tecla)) { const kb = document.createElement('kbd'); kb.textContent = tecla.slice(1, -1); dt.appendChild(kb); } else dt.append(tecla);
      });
      const dd = document.createElement('dd'); dd.textContent = que;
      dl.append(dt, dd);
    }
  }
  const verAtajos = () => { if (!$('atajos').open) $('atajos').showModal(); };
  $('verAtajos').addEventListener('click', verAtajos);
  $('atajosCerrar').addEventListener('click', () => $('atajos').close());
  $('atajos').addEventListener('click', (e) => { if (e.target === $('atajos')) $('atajos').close(); }); // tocar fuera la cierra
  function atajo(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || !D || $('atajos').open) return;
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (e.key === '?') { e.preventDefault(); verAtajos(); return; }
    if (e.key === '/') {
      e.preventDefault();
      const i = raiz.querySelector('.bloque:not([hidden]) .buscador input');
      if (i) i.focus();
      return;
    }
    // Lo que ya usa esas teclas (botones, deslizadores, el mapa, las barras) se queda con ellas.
    if (e.target.closest('button, a, [role="slider"], [role="button"], [role="toolbar"], #capa, dialog')) return;
    if (e.key === ' ') {
      e.preventDefault();
      if (modo === 'foto') { jugar(0); $('control').focus({ preventScroll: true }); } else $('control').click();
    } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && modo !== 'foto') {
      e.preventDefault();
      irADia(Math.round(t0) + (e.key === 'ArrowRight' ? 1 : -1));
    }
  }
  document.addEventListener('keydown', atajo);

  /* ---------- Eventos ---------- */
  // El botón que se tocó desaparece: el foco pasa a lo que lo reemplaza.
  $('verTemporada').addEventListener('click', () => { jugar(0); $('control').focus({ preventScroll: true }); });
  // En la foto, tocar el mapa también empieza la temporada: es lo primero que se toca.
  mapa.addEventListener('click', () => { if (modo === 'foto' && D) { jugar(0); $('control').focus({ preventScroll: true }); } });
  $('volver').addEventListener('click', () => { volverA2026(); descripcion(); guardar(true); $('resultado').focus({ preventScroll: true }); });
  $('control').addEventListener('click', () => {
    // Con «reducir movimiento», «Repetir» lleva al primer día sin animar: se avanza con la línea de tiempo.
    if (modo === 'final' && reducirMovimiento()) { irADia(0); guardar(true); return; }
    if (modo === 'final') { jugar(0); return; }
    if (jugando) pausar(); else jugar();
  });
  $('leyNormal').addEventListener('click', () => {
    const b = $('leyNormal'), abierto = b.getAttribute('aria-expanded') === 'true';
    b.setAttribute('aria-expanded', String(!abierto));
    $('explicaNormal').hidden = abierto;
  });
  const tiempo = $('tiempo');
  const irA = (ev) => {
    const r = tiempo.getBoundingClientRect();
    // Se arrastra de día en día, igual que se lee con el mouse.
    t0 = Math.max(0, Math.min(ULTIMO, Math.floor(((ev.clientX - r.left) / r.width) * DIAS)));
    volverA2026();
    if (modo !== 'repaso') ponerModo('repaso');
    dibujar();
    actualizarTiempo();
  };
  let arrastrando = false;
  function arrastrar(ev) {
    pausar();
    arrastrando = true;
    tiempo.classList.add('arrastrando');
    $('fantasma').hidden = true;
    tiempo.setPointerCapture(ev.pointerId);
    irA(ev);
    const mover = (e) => irA(e);
    const soltar = () => {
      arrastrando = false;
      tiempo.classList.remove('arrastrando');
      tiempo.removeEventListener('pointermove', mover);
      tiempo.removeEventListener('pointerup', soltar);
      tiempo.removeEventListener('pointercancel', soltar);
      if (t0 >= ULTIMO - 0.01) irFinal(); else guardar(false);
    };
    tiempo.addEventListener('pointermove', mover);
    tiempo.addEventListener('pointerup', soltar);
    tiempo.addEventListener('pointercancel', soltar);
  }
  // Con el dedo, la página se sigue desplazando hacia arriba y abajo (touch-action: pan-y):
  // el repaso solo se arrastra si el gesto va de lado, y un toque sin mover lleva al día tocado.
  function tocar(ev) {
    const x0 = ev.clientX, y0 = ev.clientY, id = ev.pointerId;
    const fin = () => {
      tiempo.removeEventListener('pointermove', mover);
      tiempo.removeEventListener('pointerup', soltar);
      tiempo.removeEventListener('pointercancel', soltar);
    };
    const mover = (e) => {
      if (e.pointerId !== id) return;
      const dx = Math.abs(e.clientX - x0), dy = Math.abs(e.clientY - y0);
      if (dx < 8 && dy < 8) return;
      fin();
      if (dx > dy) arrastrar(e);
    };
    const soltar = (e) => {
      if (e.pointerId !== id) return;
      fin();
      if (e.type !== 'pointerup') return; // el navegador se quedó con el gesto para desplazar la página
      pausar();
      irA(e);
      if (t0 >= ULTIMO - 0.01) irFinal(); else guardar(false);
    };
    tiempo.addEventListener('pointermove', mover);
    tiempo.addEventListener('pointerup', soltar);
    tiempo.addEventListener('pointercancel', soltar);
  }
  tiempo.addEventListener('pointerdown', (ev) => { if (ev.pointerType === 'touch') tocar(ev); else arrastrar(ev); });
  tiempo.addEventListener('pointermove', (ev) => { if (!arrastrando && ev.pointerType === 'mouse' && D) mostrarFantasma(ev); });
  tiempo.addEventListener('pointerleave', () => { $('fantasma').hidden = true; });
  tiempo.addEventListener('keydown', (e) => {
    const paso = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 7, PageDown: -7 }[e.key];
    if (paso !== undefined) {
      irADia(Math.round(t0) + paso);
      e.preventDefault();
    } else if (e.key === 'Home' || e.key === 'End') {
      pausar();
      if (e.key === 'End') irFinal(); else irADia(0);
      e.preventDefault();
    } else if (e.key === ' ') {
      if (jugando) pausar(); else jugar();
      e.preventDefault();
    }
  });
  const alEscape = (e) => { if (e.key === 'Escape' && seleccion && !$('atajos').open) quitarSeleccion(true); };
  document.addEventListener('keydown', alEscape);
  // «Atrás» y «Adelante» dentro de la portada: el enrutador no la vuelve a montar.
  const alAncla = () => { if (D && ruta().vista === 'portada') aplicar(leerEstado()); };
  window.addEventListener('hashchange', alAncla);
  window.addEventListener('idioma', textos);
  const observador = new ResizeObserver(() => { cancelAnimationFrame(esperaMedir); esperaMedir = requestAnimationFrame(medir); });
  observador.observe(escenario);
  // La tarjeta se vuelve a ubicar cuando la cámara termina de moverse.
  mapa.addEventListener('transitionend', (e) => { if (e.target === mapa && e.propertyName === 'transform' && seleccion) ubicarTarjeta(seleccion); });

  /* ---------- Arranque ---------- */
  textos();
  medir();
  // Si se sale y se vuelve antes de que lleguen los datos, la vista nueva ya los pidió: esta no hace nada.
  let vivo = true;
  datos('portada.json').then((d) => {
    if (!vivo) return;
    D = d;
    D.porAnio.ids.forEach((id, i) => posicion.set(id, i));
    armarMapa();
    armarTiempo();
    textos();
    medir();
    prepararDias();
    aplicar(leerEstado());
  }).catch(() => {
    if (!vivo) return;
    const aviso = document.createElement('p');
    aviso.className = 'aviso-error';
    aviso.setAttribute('role', 'alert');
    aviso.textContent = t('errorDatos');
    $('cartel').appendChild(aviso);
  });

  return () => {
    vivo = false;
    jugando = false;
    cancelAnimationFrame(cuadroId);
    cancelAnimationFrame(esperaMedir);
    clearTimeout(esperaFinal);
    observador.disconnect();
    document.removeEventListener('keydown', alEscape);
    document.removeEventListener('keydown', atajo);
    window.removeEventListener('hashchange', alAncla);
    window.removeEventListener('idioma', textos);
    clearTimeout(esperaURL);
  };
}
