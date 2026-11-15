// Portada: la temporada en tres momentos (foto, repaso y cierre) y el panel con la respuesta.
import { t, traducir } from '../textos.js';
import { $, fmt, fechaDia, fechaDiaAnio, fechaCorta, COLOR, ESCALA, veredicto, el, reducirMovimiento, datos, anunciar, visita } from '../comun.js';
import { barrasAnios, subirBarras } from '../graficas.js';
import { armarBuscador, EJEMPLO } from '../buscador.js';
import { ruta } from '../app.js';

const W0 = 825, H0 = 681, Y0 = -90;
// Lo que cubre la foto (web/img/mosaico.jpg, ver FOTO en pipeline/mosaico.py), en unidades del lienzo:
// más que el lienzo, con mar y tierra vecina, para que nunca se vea su borde.
const FOTO = { x0: -400, x1: 976, y0: -150, y1: 650 };
const PENINSULA = { x0: 0, x1: 825, y0: 10, y1: 591 }; // la tierra de los tres estados, sin el arrecife Alacranes
const YUC = { x0: 302, x1: 708, y0: 31, y1: 330 }; // Yucatán en el lienzo, sin el arrecife Alacranes
const ACERCAR_MAX = 4; // veces el encuadre de Yucatán
const PASO_ZOOM = 1.6; // lo que acerca un toque de «+»
const INSTR = 64; // alto del instrumento en escritorio; el CSS lo lee de --instr
const VEL = 10; // días de temporada por segundo: unos 9 s en total
const ULTIMO = 91; // 31 de mayo
const DIAS = ULTIMO + 1;
// Un foco se ve los días que dura su brasa: recién visto, amarillo; después se enfría a rojo y se apaga.
const VIDA = 5;
const EDAD = [[0, '#FFF1B8'], [0.6, '#FFC94D'], [1.6, '#F5862E'], [3, '#D0472A'], [VIDA, '#8E2C22']];
const TONOS = 20; // dibujos de punto precalculados a lo largo de la vida de un foco
const ANIO = 2026;
const CLASES = ['muyabajo', 'abajo', 'normal', 'arriba', 'muyarriba', 'poco']; // orden de los dígitos de porAnio
const DESDE_MUNICIPIO = 2012; // a escala de municipio, los años de MODIS salen exagerados: los hechos empiezan aquí

const ICONO_MAS = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" fill="none"/></svg>';
const ICONO_MENOS = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" stroke-width="2.4" fill="none"/></svg>';
const ICONO_TODO = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" stroke-width="2.2" fill="none"/></svg>';

const PLANTILLA = `
<section class="escenario" id="escenario" data-modo="foto">
  <div class="visor" id="visor">
    <div class="mapa" id="mapa">
      <img class="foto" id="foto" src="/img/mosaico.jpg" alt="" width="3440" height="2000" decoding="async">
      <canvas id="fuego" aria-hidden="true"></canvas>
      <svg id="capa" viewBox="0 -90 825 681" preserveAspectRatio="none" role="img" aria-labelledby="capaDesc">
        <desc id="capaDesc"></desc>
        <rect class="velo" x="-400" y="-150" width="1376" height="800"></rect>
        <g class="rellenos" id="rellenos"></g>
        <g class="limites" id="limites"></g>
        <g class="estados" id="estados"></g>
        <g class="encima" id="encima"></g>
        <g class="seleccion" id="seleccion"></g>
      </svg>
      <div class="rotulos" id="rotulos"></div>
    </div>
    <canvas id="ambiente" aria-hidden="true"></canvas>
  </div>

  <div class="cartel" id="cartel">
    <h1 id="titulo"></h1>
    <div class="bloque" id="bloqueFoto" hidden>
      <p class="fuera-temporada" id="fueraTemporada" hidden></p>
      <p class="bajada" data-t="bajada"></p>
      <div class="buscador" id="buscador1"></div>
      <p class="leyenda-punto"><i aria-hidden="true"></i><span id="leyendaPunto"></span></p>
      <button type="button" class="boton" id="verTemporada">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5 L19.5 12 L7 19.5 Z" fill="#121212"></path></svg>
        <span data-t="verTemporada"></span>
      </button>
    </div>
    <div class="bloque" id="bloqueFinal" hidden>
      <p class="resultado" id="resultado" tabindex="-1"></p>
      <button type="button" class="volver" id="volver" hidden><span aria-hidden="true">←</span> <span data-t="volver2026"></span></button>
      <div class="escala-color" id="escalaColor"></div>
      <p class="leyenda-punto pasan" id="leyendaDia"><i aria-hidden="true"></i><span><span data-t="puntosPasan"></span> <b id="ambFecha" aria-hidden="true"></b></span></p>
      <div class="buscador" id="buscador2"></div>
      <p class="pie" id="pie"></p>
    </div>
  </div>

  <!-- La tarjeta va antes del instrumento: con Tab, del buscador se llega a ella. -->
  <div class="tarjeta" id="tarjeta" hidden></div>

  <div class="zoom" id="zoom" role="group" hidden>
    <button type="button" id="acercar">${ICONO_MAS}</button>
    <button type="button" id="alejar">${ICONO_MENOS}</button>
    <button type="button" id="verTodo">${ICONO_TODO}</button>
  </div>

  <div class="instrumento" id="instrumento" hidden>
    <button type="button" class="control" id="control">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path id="controlIcono" fill="#121212"></path></svg>
    </button>
    <div class="lectura">
      <p class="dia"><span class="fecha" id="fecha"></span><span class="satelite" id="satelite"></span></p>
      <p class="medidor cifra">
        <span><i class="a" id="b26" aria-hidden="true"></i><span id="filaAnio">2026</span> <b class="c26" id="n26">0</b></span>
        <span><i class="n" id="bNormal" aria-hidden="true"></i><span data-t="filaNormal"></span> <b class="cn" id="nNormal">0</b></span>
      </p>
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
    <p class="explica" id="explicaNormal" hidden></p>
    <svg id="barras"></svg>
  </div>
  <p class="tira-pista" id="pistaAnio"></p>
  <p class="escala-hoy"><span data-t="escalaHoy"></span> <a class="ir" href="#/metodo" data-t="verComprobamos"></a></p>
  <a class="ir siguiente" href="#/fechas" data-t="sigueFechas"></a>
  <button type="button" class="atajos-boton" id="verAtajos" aria-haspopup="dialog"></button>
</aside>
<dialog class="atajos" id="atajos" aria-labelledby="atajosTitulo">
  <h2 id="atajosTitulo" data-t="atajosTitulo"></h2>
  <dl id="atajosLista"></dl>
  <button type="button" class="cerrar" id="atajosCerrar" data-t-aria="cerrar">×</button>
</dialog>`;

const limitarA = (v, a, b) => Math.max(a, Math.min(b, v));

export function montar(raiz) {
  raiz.innerHTML = PLANTILLA;
  traducir(raiz);
  const escenario = $('escenario'), visor = $('visor'), mapa = $('mapa'), cartel = $('cartel');
  const lienzo = $('fuego'), ctx = lienzo.getContext('2d');
  escenario.style.setProperty('--instr', INSTR + 'px');
  let D = null;
  let modo = 'foto', t0 = 0, jugando = false, ultimoCuadro = 0, seleccion = null;
  // El año que pintan el mapa del cierre, la tarjeta y la línea de tiempo; el repaso es siempre de 2026.
  let anio = ANIO;
  const posicion = new Map(); // id → lugar del municipio en porAnio
  let dpr = 1, sprites = [], spriteFoto = null, porDia = [];
  let cuadroId = 0, esperaFinal = 0, esperaMedir = 0;
  const munPorId = new Map();
  const telefono = () => matchMedia('(max-width: 860px)').matches;

  /* ---------- La cámara ---------- */
  // cam.k son píxeles por unidad del lienzo; (cam.cx, cam.cy) es el punto del lienzo que queda en el centro
  // del visor. Mientras la persona no mueva el mapa, la cámara sigue el encuadre de cada momento.
  let W = 0, H = 0, cam = null, camAuto = true, caja = null;
  const mg = () => cartel.offsetLeft; // margen del escenario (--mg en el CSS)
  // En el cierre no hay instrumento: el mapa usa todo el alto.
  const arribaInstr = () => H - Math.round(mg() * 0.6) - (modo === 'final' ? 0 : INSTR);
  // Lo que queda libre de texto en el visor. El instrumento ocupa su lugar aunque esté escondido:
  // así la foto y el repaso tienen el mismo encuadre y empezar no mueve el mapa.
  function libre(tipo) {
    if (telefono()) return { x0: 6, x1: W - 6, y0: 6, y1: H - 6 };
    const abajo = arribaInstr() - 14;
    if (tipo === 'final') return { x0: cartel.offsetLeft + cartel.offsetWidth + 32, x1: W - 72, y0: 18, y1: abajo };
    return { x0: 0, x1: W - mg(), y0: Math.round(mg() * 0.6), y1: abajo };
  }
  // En escritorio angosto (1024 de ancho) no caben el texto, el municipio y su tarjeta lado a lado: con una
  // tarjeta abierta, la leyenda y el buscador se pliegan y la tarjeta va debajo del titular.
  const TARJETA = 250;
  function estrecho() {
    if (telefono()) return false;
    const L = libre('final');
    return L.x1 - L.x0 < TARJETA + 150;
  }
  function libreConTarjeta() {
    const L = libre('final');
    if (escenario.classList.contains('estrecho')) return { ...L, x0: mg() + TARJETA + 28, tarjeta: 0 };
    return { ...L, tarjeta: telefono() ? 0 : TARJETA + 24 };
  }
  const conAire = (r, f) => ({ x0: r.x0 - (r.x1 - r.x0) * f, x1: r.x1 + (r.x1 - r.x0) * f, y0: r.y0 - (r.y1 - r.y0) * f, y1: r.y1 + (r.y1 - r.y0) * f });
  // Un recuadro del lienzo dentro de un recuadro del visor. En escritorio, la península se pega a la
  // derecha: el texto queda sobre el mar.
  function encajar(R, L, derecha) {
    const k = Math.min((L.x1 - L.x0) / (R.x1 - R.x0), (L.y1 - L.y0) / (R.y1 - R.y0));
    const sx = derecha ? L.x1 - (R.x1 - R.x0) * k : (L.x0 + L.x1 - (R.x1 - R.x0) * k) / 2;
    const sy = (L.y0 + L.y1 - (R.y1 - R.y0) * k) / 2;
    return { k, cx: R.x0 + (W / 2 - sx) / k, cy: R.y0 + (H / 2 - sy) / k };
  }
  // La escala del encuadre del cierre: se calcula una vez por tamaño de ventana (medir la pone en cero).
  let kFin = 0;
  const kFinal = () => kFin || (kFin = encajeFinal().k);
  const kMin = () => Math.max(W / (FOTO.x1 - FOTO.x0), H / (FOTO.y1 - FOTO.y0));
  const kMax = () => Math.max(kMin(), ACERCAR_MAX * kFinal());
  // La foto llena siempre el visor: la cámara no se sale de ella.
  function limitar(c) {
    const k = limitarA(c.k, kMin(), kMax());
    const mx = W / 2 / k, my = H / 2 / k;
    return { k, cx: limitarA(c.cx, FOTO.x0 + mx, FOTO.x1 - mx), cy: limitarA(c.cy, FOTO.y0 + my, FOTO.y1 - my) };
  }
  // La tarjeta de los años va en la esquina de abajo a la derecha, la que Yucatán deja libre. Si con el
  // encuadre completo taparía parte del estado, Yucatán se encuadra a su izquierda o arriba de ella,
  // donde quede más grande.
  function cajaAnios() {
    const p = raiz.querySelector('.panel');
    if (telefono() || !p || !p.offsetWidth) return null;
    const r = p.getBoundingClientRect(), e = visor.getBoundingClientRect();
    return { x0: r.left - e.left, y0: r.top - e.top, x1: r.right - e.left, y1: r.bottom - e.top };
  }
  function tapaYucatan(c, a) {
    const yuc = $('estados').querySelector('.yucatan');
    if (!yuc || !yuc.isPointInFill) return false;
    const pt = $('capa').createSVGPoint();
    for (let i = 0; i <= 10; i++) {
      // Puntos a lo largo del borde de arriba y del borde izquierdo de la tarjeta, con 10 px de aire.
      for (const [sx, sy] of [[a.x0 - 10 + ((a.x1 - a.x0) * i) / 10, a.y0 - 10], [a.x0 - 10, a.y0 - 10 + ((a.y1 - a.y0) * i) / 10]]) {
        pt.x = c.cx + (sx - W / 2) / c.k;
        pt.y = c.cy + (sy - H / 2) / c.k;
        if (yuc.isPointInFill(pt)) return true;
      }
    }
    return false;
  }
  function encajeFinal() {
    const R = conAire(YUC, 0.04), L = libre('final'), a = cajaAnios();
    const completo = encajar(R, L, false);
    if (!a || !tapaYucatan(completo, a)) return completo;
    const izq = encajar(R, { ...L, x1: a.x0 - 16 }, false), arriba = encajar(R, { ...L, y1: a.y0 - 16 }, false);
    return izq.k > arriba.k ? izq : arriba;
  }
  function encuadre(tipo) {
    if (tipo === 'final') return limitar(encajeFinal());
    return limitar(encajar(PENINSULA, libre('vista'), !telefono()));
  }
  // El mapa se acomoda con su posición y su tamaño, no con transform: así los bordes, los nombres y la
  // tarjeta se redibujan nítidos en cada cuadro.
  function pintarCamara() {
    const w = W0 * cam.k, h = H0 * cam.k;
    const x = W / 2 - cam.cx * cam.k, y = H / 2 - (cam.cy - Y0) * cam.k;
    Object.assign(mapa.style, { left: x.toFixed(1) + 'px', top: y.toFixed(1) + 'px', width: w.toFixed(1) + 'px', height: h.toFixed(1) + 'px' });
    caja = { x, y, w, h };
    // Con el mapa acercado, un dedo lo mueve; si no, desplaza la página.
    visor.classList.toggle('acercado', modo === 'final' && cam.k > kFinal() * 1.02);
  }
  const enVisor = (ux, uy) => ({ x: caja.x + (ux / W0) * caja.w, y: caja.y + ((uy - Y0) / H0) * caja.h });
  let vuelo = 0;
  function volar(destino, dur = 650) {
    cancelAnimationFrame(vuelo);
    if (!cam || reducirMovimiento() || !dur) { cam = destino; pintarCamara(); seguirMapa(true); return; }
    const a = cam, inicio = performance.now();
    const paso = (ahora) => {
      const f = Math.min(1, (ahora - inicio) / dur), e = 1 - Math.pow(1 - f, 3);
      cam = { k: a.k * Math.pow(destino.k / a.k, e), cx: a.cx + (destino.cx - a.cx) * e, cy: a.cy + (destino.cy - a.cy) * e };
      pintarCamara();
      seguirMapa(f === 1);
      if (f < 1) vuelo = requestAnimationFrame(paso);
    };
    vuelo = requestAnimationFrame(paso);
  }
  // La tarjeta sigue al mapa en cada cuadro; los rótulos tapados se recalculan al terminar.
  let esperaQuieto = 0;
  function seguirMapa(fin) {
    if (seleccion) ubicarTarjeta(seleccion);
    clearTimeout(esperaQuieto);
    if (fin) despejarRotulos(); else esperaQuieto = setTimeout(() => despejarRotulos(), 160);
  }
  function zoomEn(f, sx, sy, animar) {
    if (!cam) return;
    camAuto = false;
    const k = limitarA(cam.k * f, kMin(), kMax());
    const ux = cam.cx + (sx - W / 2) / cam.k, uy = cam.cy + (sy - H / 2) / cam.k;
    const nuevo = limitar({ k, cx: ux - (sx - W / 2) / k, cy: uy - (sy - H / 2) / k });
    if (animar) volar(nuevo, 280);
    else { cancelAnimationFrame(vuelo); cam = nuevo; pintarCamara(); seguirMapa(false); }
  }
  function zoomBoton(f) {
    const L = libre('final');
    zoomEn(f, (L.x0 + L.x1) / 2, (L.y0 + L.y1) / 2, true);
  }
  function verTodo() { camAuto = false; volar(encuadre('vista')); }
  // Buscar un municipio lleva la cámara hasta él; en escritorio queda a la izquierda de su tarjeta.
  const cajas = new Map();
  function cajaMun(id) {
    if (!cajas.has(id)) {
      const b = $('rellenos').querySelector(`[data-id="${CSS.escape(id)}"]`).getBBox();
      cajas.set(id, { x0: b.x, x1: b.x + b.width, y0: b.y, y1: b.y + b.height });
    }
    return cajas.get(id);
  }
  function volarA(id) {
    if (!cam) return;
    const b = cajaMun(id), L = libreConTarjeta(), kf = kFinal();
    // En escritorio el municipio y su tarjeta comparten lo libre: el municipio a la izquierda.
    const ancho = Math.max(60, L.x1 - L.x0 - L.tarjeta);
    const k = limitarA(Math.min((ancho * 0.75) / (b.x1 - b.x0 || 1), ((L.y1 - L.y0) * 0.5) / (b.y1 - b.y0 || 1)), kMin(), kf * 2);
    const sx = L.x0 + ancho / 2, sy = (L.y0 + L.y1) / 2;
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    camAuto = false;
    volar(limitar({ k, cx: cx - (sx - W / 2) / k, cy: cy - (sy - H / 2) / k }));
  }
  // Con las flechas, el municipio elegido entra al encuadre si se había quedado fuera.
  function asegurarVisible(id) {
    if (!cam) return;
    const m = munPorId.get(id), L = libre('final'), p = enVisor(m.cx, m.cy);
    if (p.x >= L.x0 + 20 && p.x <= L.x1 - 20 && p.y >= L.y0 + 20 && p.y <= L.y1 - 20) return;
    camAuto = false;
    const sx = (L.x0 + L.x1) / 2, sy = (L.y0 + L.y1) / 2;
    volar(limitar({ k: cam.k, cx: m.cx - (sx - W / 2) / cam.k, cy: m.cy - (sy - H / 2) / cam.k }), 400);
  }

  /* ---------- Tamaño ---------- */
  function medir() {
    W = visor.clientWidth; H = visor.clientHeight;
    if (!W || !H) return;
    kFin = 0;
    cancelAnimationFrame(vuelo);
    cam = camAuto || !cam ? encuadre(modo === 'final' ? 'final' : 'vista') : limitar(cam);
    pintarCamara();
    ajustarLienzo(cam.k);
    ambMedir();
    despejarRotulos();
    if (seleccion) { escenario.classList.toggle('estrecho', estrecho()); ubicarTarjeta(seleccion); }
  }
  // El fuego se dibuja al tamaño en que se va a ver. En el cierre no se ve: no se agranda con el mapa.
  function ajustarLienzo(k) {
    if (modo === 'final') return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(W0 * k * dpr), h = Math.round(H0 * k * dpr);
    if (w === lienzo.width && h === lienzo.height) return;
    lienzo.width = w; lienzo.height = h;
    hacerSprites();
    if (D) prepararDias();
    dibujar();
  }
  // Un rótulo del mapa que quedaría debajo del texto o de la línea de tiempo se esconde.
  // Se calcula con la posición final del mapa, no con la de la transición.
  function despejarRotulos() {
    const rotulos = raiz.querySelectorAll('.rotulos .ciudad, .rotulos .estado, .rotulos .agua, .rotulos .nota-mapa');
    if (telefono() || !caja) { rotulos.forEach((r) => r.classList.remove('tapado')); return; }
    const er = visor.getBoundingClientRect();
    const tapan = [...raiz.querySelectorAll('#titulo, .bloque:not([hidden]), .instrumento:not([hidden]), .zoom:not([hidden]), .tarjeta.fija:not([hidden]), .panel')].map((e) => {
      const r = e.getBoundingClientRect();
      return { x0: r.left - er.left - 8, x1: r.right - er.left + 8, y0: r.top - er.top - 6, y1: r.bottom - er.top + 6 };
    });
    for (const r of rotulos) {
      const cx = caja.x + (parseFloat(r.style.left) / 100) * caja.w, cy = caja.y + (parseFloat(r.style.top) / 100) * caja.h;
      const w = r.offsetWidth, h = r.offsetHeight;
      const x0 = r.classList.contains('ciudad') ? (r.classList.contains('izq') ? cx + 7 - w : cx - 7) : cx - w / 2;
      const y0 = r.classList.contains('arriba') ? cy - h : cy - h / 2;
      const choca = tapan.some((b) => x0 < b.x1 && x0 + w > b.x0 && y0 < b.y1 && y0 + h > b.y0);
      r.classList.toggle('tapado', choca);
    }
  }
  const px = (x) => (x / W0) * lienzo.width;
  const py = (y) => ((y - Y0) / H0) * lienzo.height;

  /* ---------- El fuego: puntos nítidos que se enfrían y se apagan ---------- */
  function mezcla(a, b, f) {
    const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
    const c = (s) => Math.round(((x >> s) & 255) * (1 - f) + ((y >> s) & 255) * f);
    return 'rgb(' + c(16) + ',' + c(8) + ',' + c(0) + ')';
  }
  function colorEdad(e, tabla = EDAD) {
    let j = 0;
    while (j < tabla.length - 2 && e > tabla[j + 1][0]) j++;
    const [e0, c0] = tabla[j], [e1, c1] = tabla[j + 1];
    return mezcla(c0, c1, Math.max(0, Math.min(1, (e - e0) / (e1 - e0))));
  }
  // Un punto se dibuja una vez en un lienzo chico y después solo se copia: es lo más rápido.
  // Con «aro», el punto lleva un borde oscuro: se distingue sobre cualquier color del mapa.
  function punto(color, r, aro = 0) {
    const c = document.createElement('canvas');
    const s = Math.ceil((r + aro) * 2) + 2;
    c.width = c.height = s;
    const g = c.getContext('2d');
    g.beginPath();
    g.arc(s / 2, s / 2, r, 0, Math.PI * 2);
    if (aro) { g.lineWidth = aro * 2; g.strokeStyle = 'rgba(5, 8, 13, 0.62)'; g.stroke(); }
    g.fillStyle = color;
    g.fill();
    return c;
  }
  function hacerSprites() {
    const r = Math.max(1.6, 3.1 * (lienzo.width / dpr / 1022)) * dpr;
    sprites = [];
    for (let i = 0; i < TONOS; i++) {
      const e = (i / (TONOS - 1)) * VIDA;
      sprites.push(punto(colorEdad(e), r * (1 - 0.45 * (e / VIDA))));
    }
    spriteFoto = punto(colorEdad(0.5), r * 1.1);
  }

  function dibujar() {
    if (!D || !lienzo.width || !spriteFoto) return;
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

  /* ---------- Los focos de la temporada, pasando sobre el mapa a color ---------- */
  // Un lienzo fijo al visor: en cada cuadro los puntos se dibujan donde la cámara los deja, nítidos y del
  // mismo tamaño aunque el mapa se acerque. Solo corre con 2026 en el mapa y sin «reducir movimiento».
  const AMB_VEL = 9; // días de temporada por segundo: una vuelta dura unos 10 s
  const AMB_PAUSA = 9; // días en blanco entre una vuelta y la siguiente
  const AMB_VIDA = VIDA; // cada foco se ve los días que dura su brasa: nace claro, se enfría a rojo y se apaga
  // Sobre los colores del mapa la brasa va más roja que sobre la foto, para que contraste.
  const AMB_EDAD = [[0, '#FFF3B0'], [0.5, '#FFC233'], [1.3, '#FF7A1A'], [2.4, '#E3241A'], [AMB_VIDA, '#A01410']];
  const amb = $('ambiente'), actx = amb.getContext('2d');
  let ambT = 0, ambId = 0, ambAntes = 0, ambDia = -1, ambDpr = 1, ambSprites = [], ambActivo = null, repDia = [];
  function ambMedir() {
    ambDpr = Math.min(2, window.devicePixelRatio || 1);
    amb.width = Math.round(W * ambDpr);
    amb.height = Math.round(H * ambDpr);
    const r = (telefono() ? 2 : 2.6) * ambDpr;
    ambSprites = [];
    for (let i = 0; i < TONOS; i++) {
      const e = (i / (TONOS - 1)) * VIDA;
      ambSprites.push(punto(colorEdad(e, AMB_EDAD), r * (1 - 0.35 * (e / VIDA)), 0.5 * ambDpr));
    }
  }
  function ambCuadro(ahora) {
    ambId = requestAnimationFrame(ambCuadro);
    const activo = modo === 'final' && anio === ANIO && !!D && !!caja && amb.width > 0 && !reducirMovimiento();
    if (activo !== ambActivo) {
      ambActivo = activo;
      $('leyendaDia').style.visibility = activo ? '' : 'hidden';
      if (!activo) actx.clearRect(0, 0, amb.width, amb.height);
      ambAntes = ahora;
    }
    if (!activo) return;
    ambT += Math.min(0.1, (ahora - ambAntes) / 1000) * AMB_VEL;
    ambAntes = ahora;
    if (ambT >= ULTIMO + AMB_VIDA + AMB_PAUSA) ambT = 0;
    actx.clearRect(0, 0, amb.width, amb.height);
    const hoy = Math.floor(ambT);
    const kx = (caja.w / W0) * ambDpr, ky = (caja.h / H0) * ambDpr, ox = caja.x * ambDpr, oy = caja.y * ambDpr;
    for (let d = Math.max(0, hoy - AMB_VIDA + 1); d <= Math.min(ULTIMO, hoy); d++) {
      const edad = ambT - d;
      if (edad >= AMB_VIDA) continue;
      const s = ambSprites[Math.min(TONOS - 1, Math.round((edad / AMB_VIDA) * (TONOS - 1)))], m = s.width / 2;
      actx.globalAlpha = edad < AMB_VIDA - 1.5 ? 1 : Math.max(0, (AMB_VIDA - edad) / 1.5);
      for (const c of repDia[d]) {
        const x = ox + c[0] * kx, y = oy + (c[1] - Y0) * ky;
        if (x < -m || y < -m || x > amb.width + m || y > amb.height + m) continue;
        actx.drawImage(s, x - m, y - m);
      }
    }
    actx.globalAlpha = 1;
    const dia = Math.min(ULTIMO, hoy);
    if (dia !== ambDia) { ambDia = dia; poner('ambFecha', fechaDia(diaDeTemporada(dia))); }
  }

  /* ---------- Línea de tiempo: una barra por día y lo normal detrás ---------- */
  // Cada día ocupa 10 unidades del dibujo; la barra mide 7 y deja 3 de aire.
  let dia26 = [], acum = [], tope = 1, diaPintado = -1;
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
    let silueta = '';
    suave.forEach((v, i) => { const y = (60 - alturaBarra(v)).toFixed(1); silueta += `${i ? 'L' : 'M'}${i * 10},${y}L${i * 10 + 10},${y}`; });
    $('siluetaNormal').setAttribute('d', silueta);
    const barras = dia26.map((v, i) => (v > 0 ? `M${i * 10 + 1.5},60V${(60 - Math.max(1, alturaBarra(v))).toFixed(1)}h7V60Z` : '')).join('');
    $('barrasFuturo').setAttribute('d', barras);
    $('barrasPasado').setAttribute('d', barras);
    $('filaAnio').textContent = String(anio);
    $('tiempo').setAttribute('aria-label', t('diaTemporada', { a: anio }));
    diaPintado = -1;
  }
  const lerp = (s, tt) => {
    const i = Math.floor(tt), f = tt - i;
    return i >= ULTIMO ? s[ULTIMO] : s[i] * (1 - f) + s[i + 1] * f;
  };
  const diaDeTemporada = (i) => new Date(2026, 2, 1 + i, 12);
  // Quién vio cada periodo: [desde, hasta, satélite] en los textos.
  const sateliteDe = (a) => (t('periodos').find(([d, h]) => a >= Number(d) && a <= Number(h)) || [])[2] || '';
  // El repaso de 2026 dice qué satélite contó cada día: S-NPP, o NOAA-20 los días que rellenó.
  function sateliteDelDia(dia) {
    if (anio !== ANIO) return sateliteDe(anio);
    const s = D && D.satDia;
    if (!s) return '';
    return (s.otros && s.otros[String(dia)]) || s.base || '';
  }
  // Solo se escribe en la página lo que cambió: el cuadro se mantiene liviano.
  const poner = (id, texto) => { const e = $(id); if (e.textContent !== texto) e.textContent = texto; };
  function actualizarTiempo() {
    if (!D) return;
    const a = lerp(acum, t0), n = lerp(D.acumNormal, t0);
    const dia = Math.min(ULTIMO, Math.floor(t0 + 1e-6));
    poner('n26', fmt(a));
    poner('nNormal', fmt(n));
    $('cabezal').style.transform = `translateX(${(((t0 + 0.5) / DIAS) * 100).toFixed(3)}%)`;
    if (dia === diaPintado) return;
    diaPintado = dia;
    poner('fecha', fechaDia(diaDeTemporada(dia)));
    const sat = sateliteDelDia(dia);
    poner('satelite', sat ? t('vistoPor', { s: sat }) : '');
    $('hastaRect').setAttribute('width', String((dia + 1) * 10));
    const hoy = $('barraHoy'), h = dia26[dia] > 0 ? Math.max(1, alturaBarra(dia26[dia])) : 0;
    hoy.setAttribute('x', String(dia * 10 + 1.5));
    hoy.setAttribute('y', (60 - h).toFixed(1));
    hoy.setAttribute('height', h.toFixed(1));
    const tiempo = $('tiempo');
    tiempo.setAttribute('aria-valuenow', String(dia));
    tiempo.setAttribute('aria-valuetext', t('valorTiempo', { f: fechaDia(diaDeTemporada(dia)), a: fmt(acum[dia]), y: anio, n: fmt(D.acumNormal[dia]) }) + (sat ? '. ' + t('vistoPor', { s: sat }) : ''));
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
    if (modo !== 'final') q.set('modo', modo);
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
      // La página abre siempre en el mapa a color; las direcciones viejas del repaso también.
      if (modo !== 'final') { pausar(); irFinal(); }
      if (a !== anio) ponerAnio(a);
      if (e.sel && munPorId.has(e.sel)) { if (e.sel !== seleccion) seleccionar(e.sel, { quedar: true, camara: 'volar' }); }
      else if (seleccion) quitarSeleccion();
    } finally { aplicando = false; abierto = true; }
  }

  /* ---------- Momentos: foto, repaso y cierre ---------- */
  function descripcion() {
    $('capaDesc').textContent = modo === 'foto' ? t('descFoto', { f: D ? fechaDiaAnio(D.diaMax.fecha) : '' }) : (modo === 'repaso' ? t('descRepaso') : t('descFinal', { a: anio }) + ' ' + t('mapaTeclado'));
  }
  let barrasSubieron = false, abierto = false;
  function ponerModo(m) {
    const cambiaEncuadre = (m === 'final') !== (modo === 'final');
    modo = m;
    escenario.dataset.modo = m;
    $('bloqueFoto').hidden = m !== 'foto';
    $('bloqueFinal').hidden = m !== 'final';
    $('instrumento').hidden = m !== 'repaso';
    $('zoom').hidden = m !== 'final';
    // En el cierre, el mapa se recorre con las flechas: es una parada de Tab.
    if (m === 'final') $('capa').setAttribute('tabindex', '0'); else $('capa').removeAttribute('tabindex');
    descripcion();
    iconoControl();
    if (m !== 'final') quitarSeleccion(false, true); // la entrada la escribe quien cambió el momento
    if (!seleccion) { $('tarjeta').hidden = true; $('encima').textContent = ''; }
    if (m === 'final' && !barrasSubieron && D) { barrasSubieron = true; subirCuandoSeVea(); }
    if (cambiaEncuadre && W) {
      camAuto = true;
      const destino = encuadre(m === 'final' ? 'final' : 'vista');
      ajustarLienzo(destino.k);
      volar(destino, abierto ? 650 : 0); // la página abre ya encuadrada, sin vuelo
    } else { despejarRotulos(); dibujar(); }
  }
  // Las barras del panel suben una por una la primera vez que se llega al cierre, cuando se ven.
  function subirCuandoSeVea() {
    if (reducirMovimiento()) return;
    const svg = $('barras');
    const r = svg.getBoundingClientRect();
    if (r.top < innerHeight && r.bottom > 0) { subirBarras(svg); return; }
    const o = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { o.disconnect(); subirBarras(svg); } });
    o.observe(svg);
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
  const verMapa = () => { if (telefono()) visor.scrollIntoView({ block: 'start', behavior: reducirMovimiento() ? 'auto' : 'smooth' }); };
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
  // El titular del cierre es la respuesta del año que se ve en el mapa. «93 de 106» no se parte en dos
  // renglones, y al cambiar de año la cifra rueda hasta la nueva.
  let cifraVista = null;
  function textosAnio() {
    const resultado = $('resultado');
    resultado.textContent = '';
    let clave = 'resultado', n = D.cuenta.menos;
    if (anio !== ANIO) {
      const c = D.porAnio.cuenta[anio];
      clave = c.mas > c.menos ? 'resultadoMasAnio' : 'resultadoMenosAnio';
      n = c.mas > c.menos ? c.mas : c.menos;
    }
    const [antes, resto] = t(clave, { n: '\u0000', t: '\u0001', a: anio }).split('\u0000');
    const [entre, despues] = resto.split('\u0001');
    const junto = document.createElement('span');
    junto.className = 'junto';
    const cifra = document.createElement('span');
    cifra.className = 'cifra rueda';
    junto.append(cifra, entre + D.cuenta.total);
    resultado.append(antes, junto, despues);
    rodar(cifra, n, cifraVista);
    cifraVista = n;
    $('pistaAnio').textContent = anio === ANIO ? t('tocaAnioMapa') : t('anioEnMapa', { a: anio, s: sateliteDe(anio).replace('-', '\u2011') });
  }
  function rodar(caja, n, antes) {
    const nuevo = document.createElement('span');
    nuevo.textContent = String(n);
    caja.appendChild(nuevo);
    if (antes === null || antes === n || reducirMovimiento() || !caja.animate) return;
    const viejo = document.createElement('span');
    viejo.className = 'sale';
    viejo.setAttribute('aria-hidden', 'true');
    viejo.textContent = String(antes);
    caja.appendChild(viejo);
    const sube = n > antes, ir = { duration: 360, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };
    nuevo.animate([{ transform: `translateY(${sube ? 100 : -100}%)` }, { transform: 'none' }], ir);
    viejo.animate([{ transform: 'none' }, { transform: `translateY(${sube ? -100 : 100}%)` }], { ...ir, fill: 'forwards' }).onfinish = () => viejo.remove();
  }

  /* ---------- Capas del mapa ---------- */
  function armarMapa() {
    const rel = $('rellenos'), lim = $('limites'), est = $('estados');
    const xs = D.mun.map((m) => m.cx);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    for (const m of D.mun) {
      munPorId.set(m.id, m);
      const p = el('path', { d: m.d, fill: COLOR[claseDe(m.id)], 'pointer-events': 'all', 'data-id': m.id }, rel);
      p.style.transitionDelay = (((m.cx - x0) / (x1 - x0)) * 0.3).toFixed(2) + 's';
      el('path', { d: m.d }, lim);
    }
    for (const e of D.estados) el('path', { d: e.d, class: e.n === 'Yucatán' ? 'yucatan' : '' }, est);
    rel.addEventListener('pointermove', (ev) => {
      // En la foto los municipios todavía no se ven: no hay tarjeta al pasar.
      if (seleccion || jugando || modo === 'foto' || ev.pointerType === 'touch' || visor.classList.contains('moviendo')) return;
      const id = ev.target.getAttribute('data-id');
      if (id) mostrarTarjeta(id, ev);
    });
    rel.addEventListener('pointerleave', () => {
      $('encima').textContent = '';
      if (!seleccion) $('tarjeta').hidden = true;
    });
    rel.addEventListener('click', (ev) => {
      // Tocar un municipio a media animación la interrumpe y abre su tarjeta. En la foto el mapa
      // de municipios no se ve: un toque ahí no debe saltar al cierre.
      if (modo === 'foto') return;
      const id = ev.target.getAttribute('data-id');
      if (id) seleccionar(id);
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
    // Notas del cierre: el municipio de ejemplo (Muna) siempre; un municipio con más fuego, solo si lo hay.
    const tk = munPorId.get(EJEMPLO);
    if (tk) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rotulo nota-mapa enlace solo-final';
      b.setAttribute('style', pos(tk.cx, tk.cy + 4));
      b.textContent = tk.n;
      b.addEventListener('click', () => seleccionar(tk.id));
      r.appendChild(b);
    }
    const mas = D.mun.filter((m) => m.e === 'Yucatán' && (D.clases[m.id] === 'arriba' || D.clases[m.id] === 'muyarriba')).slice(0, 3);
    for (const m of mas) add(t('notaMas', { m: m.n }), 'nota-mapa arriba solo-final', m.cx, m.cy - 20);
    const esc = document.createElement('div');
    esc.className = 'escala contexto';
    // 50 km a esta latitud: 50 / 111.32 grados de latitud por 150 unidades del lienzo.
    const u50 = (50 / 111.32) * 150;
    esc.setAttribute('style', 'right:3.2%;top:3%;width:' + ((u50 / W0) * 100).toFixed(2) + '%');
    esc.innerHTML = '<span></span><span></span>';
    esc.lastChild.textContent = t('escalaKm');
    r.appendChild(esc);
  }

  // Los cinco colores con sus tres rótulos y, al lado, el gris.
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
    cont.append(tiras, rot, poco);
  }

  /* ---------- Tarjeta de un municipio ---------- */
  // Sus años en barras: los de 2001 a 2011, rayados como en el panel.
  function graficaHistoria(id) {
    const i = posicion.get(id);
    const [, normal] = D.valores[id] || [0, 0];
    const anios = D.porAnio.anios.map((a, k) => ({ y: a, v: i === undefined ? 0 : D.porAnio.v[i][k] }));
    const W = 218, H = 60, base = H - 15;
    const max = Math.max(...anios.map((a) => a.v), normal, 1);
    const paso = W / anios.length;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'historia', role: 'img' });
    svg.setAttribute('aria-label', t('historiaAria', { m: munPorId.get(id).n, n: fmt(normal), a: anio, v: fmt(valoresDe(id)[0]) }));
    const pat = el('pattern', { id: 'tj-conv', width: 4, height: 4, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, el('defs', {}, svg));
    el('rect', { width: 4, height: 4, class: 'fondo-raya' }, pat);
    el('rect', { width: 1.6, height: 4, fill: '#FFFFFF', 'fill-opacity': 0.55 }, pat);
    const hasta = Number(t('periodos')[1][1]);
    anios.forEach((a, k) => {
      const h = Math.max(a.v > 0 ? 1 : 0, (a.v / max) * (base - 4));
      const rect = el('rect', { x: (k * paso + 0.5).toFixed(1), y: (base - h).toFixed(1), width: (paso - 1.5).toFixed(1), height: h.toFixed(1), class: a.y === anio ? 'este' : '' }, svg);
      if (a.y <= hasta && a.y !== anio) rect.setAttribute('fill', 'url(#tj-conv)');
    });
    const yn = (base - (normal / max) * (base - 4)).toFixed(1);
    el('line', { x1: 0, x2: W, y1: yn, y2: yn, class: 'normal' }, svg);
    el('line', { x1: 0, x2: W, y1: base + 0.5, y2: base + 0.5, class: 'eje' }, svg);
    el('text', { x: 0, y: H - 1 }, svg).textContent = String(anios[0].y);
    el('text', { x: W, y: H - 1, 'text-anchor': 'end', class: anio === ANIO ? 'este' : '' }, svg).textContent = String(anios[anios.length - 1].y);
    return svg;
  }
  // Un hecho propio de 2026, con guarda: lo normal de 5 o más focos y solo los años desde 2012.
  function hecho(id) {
    const i = posicion.get(id);
    const [, normal] = D.valores[id] || [0, 0];
    if (anio !== ANIO || i === undefined || normal < 5 || claseDe(id) === 'poco') return '';
    const v = D.porAnio.v[i], anios = D.porAnio.anios;
    const desde = anios.indexOf(DESDE_MUNICIPIO), hoy = anios.indexOf(ANIO);
    if (desde < 0 || hoy < 0) return '';
    if (v[hoy] < Math.min(...v.slice(desde, hoy))) return t('hechoMinimo', { a: DESDE_MUNICIPIO });
    let n = 0;
    for (let k = hoy; k >= desde && v[k] < normal; k--) n++;
    if (n === hoy - desde + 1) return t('hechoRachaTodas', { a: DESDE_MUNICIPIO });
    return n >= 3 ? t('hechoRacha', { n }) : '';
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
    const h = span('historia-titulo');
    const ley = document.createElement('span');
    const raya = document.createElement('i'); raya.setAttribute('aria-hidden', 'true');
    ley.append(raya, t('loNormalCorto'));
    h.append(t('historiaTitulo'), ley);
    tj.appendChild(graficaHistoria(id));
    const dato = hecho(id);
    if (dato) span('hecho', dato);
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
  // La tarjeta no tapa el texto, la línea de tiempo ni los botones del mapa: se queda en lo libre del escenario.
  function lugarTarjeta(x, y, w, h) {
    const L = libre('final');
    const x0 = Math.min(L.x0 - 18, W - w - 12);
    y = limitarA(y, 12, Math.max(12, arribaInstr() - 12 - h));
    const z = $('zoom');
    let tope = W - 12;
    if (!z.hidden && y < z.offsetTop + z.offsetHeight + 10) tope = z.offsetLeft - 10;
    // Tampoco tapa la gráfica de los años cuando va a la derecha (ventanas bajas).
    const pa = raiz.querySelector('.panel').getBoundingClientRect(), er = escenario.getBoundingClientRect();
    if (pa.left - er.left > W / 2 && y + h > pa.top - er.top - 10) tope = Math.min(tope, pa.left - er.left - 10);
    return { x: limitarA(x, Math.max(12, x0), Math.max(x0, tope - w)), y };
  }
  function mostrarTarjeta(id, ev) {
    const tj = $('tarjeta');
    tj.className = 'tarjeta';
    contenidoTarjeta(id, false);
    tj.hidden = false;
    marcarEncima(id);
    if (telefono()) return;
    const r = escenario.getBoundingClientRect();
    const w = tj.offsetWidth, h = tj.offsetHeight;
    let x = ev.clientX - r.left + 18, y = ev.clientY - r.top + 18;
    if (x + w > r.width - 12) x = ev.clientX - r.left - w - 18;
    if (y + h > arribaInstr() - 12) y = ev.clientY - r.top - h - 18;
    const p = lugarTarjeta(x, y, w, h);
    tj.style.left = p.x + 'px'; tj.style.top = p.y + 'px';
  }
  // Junto al municipio, a su derecha (o a su izquierda si no cabe), sin taparlo.
  function ubicarTarjeta(id) {
    if (telefono() || !caja) return;
    const tj = $('tarjeta');
    if (escenario.classList.contains('estrecho')) {
      const r = $('resultado');
      tj.style.left = mg() + 'px';
      tj.style.top = Math.round(Math.min(r.offsetTop + r.offsetHeight + cartel.offsetTop + 20, arribaInstr() - 12 - tj.offsetHeight)) + 'px';
      return;
    }
    const b = cajaMun(id), a = enVisor(b.x0, b.y0), z = enVisor(b.x1, b.y1);
    const w = tj.offsetWidth || 250, h = tj.offsetHeight || 300;
    let x = z.x + 16;
    if (x + w > W - 12) x = a.x - w - 16;
    // Un municipio fuera del encuadre (Cancún, con el mapa en Yucatán) no saca la tarjeta del escenario.
    const p = lugarTarjeta(x, (a.y + z.y) / 2 - h / 2, w, h);
    tj.style.left = Math.round(p.x) + 'px'; tj.style.top = Math.round(p.y) + 'px';
  }
  // quedar: el foco se queda donde estaba (buscador, mapa) y la tarjeta se lee en voz alta.
  // camara: 'volar' la lleva al municipio; 'ver' solo lo trae al encuadre si se había salido.
  function seleccionar(id, { quedar = false, nueva = true, camara = null } = {}) {
    if (!munPorId.has(id)) return;
    if (modo !== 'final') { pausar(); t0 = ULTIMO; actualizarTiempo(); ponerModo('final'); }
    seleccion = id;
    visita.municipio = id;
    const m = munPorId.get(id);
    const s = $('seleccion');
    s.textContent = '';
    $('encima').textContent = '';
    el('path', { d: m.d, class: 'halo' }, s);
    el('path', { d: m.d, class: 'borde' }, s);
    const tj = $('tarjeta');
    escenario.classList.add('con-tarjeta');
    escenario.classList.toggle('estrecho', estrecho());
    tj.className = 'tarjeta fija';
    contenidoTarjeta(id, true);
    tj.hidden = false;
    // Si el buscador se plegó, el foco no se queda en un campo escondido: pasa a la tarjeta.
    if (quedar && escenario.classList.contains('estrecho') && cartel.contains(document.activeElement)) quedar = false;
    if (camara === 'volar') volarA(id); else if (camara === 'ver') asegurarVisible(id);
    ubicarTarjeta(id);
    despejarRotulos();
    verMapa();
    guardar(nueva);
    if (!quedar) tj.querySelector('.cerrar').focus({ preventScroll: true });
    else anunciar([...tj.querySelectorAll('.nombre, .edo, .fila, .veredicto, .hecho')].map((e) => [...e.childNodes].map((n) => n.textContent).join(' ')).join('. '));
  }
  function quitarSeleccion(enfocar, callado) {
    if (!seleccion) return;
    seleccion = null;
    if (!callado) guardar(true);
    escenario.classList.remove('con-tarjeta', 'estrecho');
    $('seleccion').textContent = '';
    $('tarjeta').hidden = true;
    despejarRotulos();
    if (enfocar) {
      const i = raiz.querySelector('.bloque:not([hidden]) .buscador input');
      if (i) i.focus();
    }
  }

  /* ---------- El mapa con el teclado: las flechas pasan al municipio de al lado ---------- */
  function vecino(dx, dy) {
    const de = seleccion && munPorId.get(seleccion);
    if (!de) return munPorId.get(EJEMPLO) || D.mun[0];
    let mejor = null, puntos = Infinity;
    for (const m of D.mun) {
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
      if (m) seleccionar(m.id, { quedar: true, nueva: !seleccion, camara: 'ver' });
    } else if (e.key === 'Enter' && seleccion) {
      e.preventDefault();
      location.hash = '#/municipio/' + encodeURIComponent(seleccion);
    }
  });

  /* ---------- Acercar y arrastrar el mapa del cierre ---------- */
  // Rueda y pellizco del panel táctil acercan donde está el puntero. En el teléfono la rueda desplaza la página.
  visor.addEventListener('wheel', (e) => {
    if (modo !== 'final' || !cam || (telefono() && !e.ctrlKey)) return;
    e.preventDefault();
    const r = visor.getBoundingClientRect();
    const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? H : 1);
    zoomEn(Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  // Arrastrar con el mouse mueve el mapa; con el dedo, dos dedos lo mueven y lo acercan, y uno solo lo
  // mueve si ya está acercado (si no, desplaza la página: touch-action en el CSS).
  const dedos = new Map();
  let gesto = null, arrastro = false, tragarClic = false;
  visor.addEventListener('pointerdown', (e) => {
    if (modo !== 'final' || !cam || (e.pointerType === 'mouse' && e.button !== 0)) return;
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY, tipo: e.pointerType });
    gesto = null;
    if (dedos.size === 1) arrastro = false;
  });
  visor.addEventListener('pointermove', (e) => {
    if (!dedos.has(e.pointerId)) return;
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY, tipo: e.pointerType });
    const ps = [...dedos.values()];
    if (e.pointerType === 'touch' && ps.length === 1 && !visor.classList.contains('acercado')) return;
    const r = visor.getBoundingClientRect();
    const c = { x: ps.reduce((s, p) => s + p.x, 0) / ps.length - r.left, y: ps.reduce((s, p) => s + p.y, 0) / ps.length - r.top };
    const d = ps.length > 1 ? Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) : 0;
    if (!gesto || gesto.n !== ps.length) { gesto = { n: ps.length, c, d, cam: { ...cam } }; return; }
    if (!arrastro && Math.hypot(c.x - gesto.c.x, c.y - gesto.c.y) < 5 && Math.abs(d - gesto.d) < 5) return;
    if (!arrastro) {
      arrastro = true;
      camAuto = false;
      cancelAnimationFrame(vuelo);
      visor.classList.add('moviendo');
      $('encima').textContent = '';
      if (!seleccion) $('tarjeta').hidden = true;
      try { visor.setPointerCapture(e.pointerId); } catch { /* el puntero ya se fue */ }
    }
    const g = gesto.cam, k = limitarA(g.k * (d && gesto.d ? d / gesto.d : 1), kMin(), kMax());
    const ux = g.cx + (gesto.c.x - W / 2) / g.k, uy = g.cy + (gesto.c.y - H / 2) / g.k;
    cam = limitar({ k, cx: ux - (c.x - W / 2) / k, cy: uy - (c.y - H / 2) / k });
    pintarCamara();
    seguirMapa(false);
  });
  const soltar = (e) => {
    if (!dedos.delete(e.pointerId)) return;
    gesto = null;
    if (dedos.size) return;
    if (arrastro) { tragarClic = true; setTimeout(() => { tragarClic = false; }, 0); seguirMapa(true); }
    visor.classList.remove('moviendo');
  };
  visor.addEventListener('pointerup', soltar);
  visor.addEventListener('pointercancel', soltar);
  // El clic que llega al soltar un arrastre no elige el municipio de abajo.
  visor.addEventListener('click', (e) => { if (tragarClic) { e.stopPropagation(); tragarClic = false; } }, true);
  $('acercar').addEventListener('click', () => zoomBoton(PASO_ZOOM));
  $('alejar').addEventListener('click', () => zoomBoton(1 / PASO_ZOOM));
  $('verTodo').addEventListener('click', verTodo);

  /* ---------- Panel ---------- */
  // Las barras de cada año, dibujadas al ancho real del panel: así las letras miden lo mismo en cualquier pantalla.
  // En escritorio la gráfica crece o se encoge con el alto del panel, para que todo quepa sin desplazarlo.
  let anchoBarras = 0, altoPanel = 0, altoBarras = 88;
  function barrasPanel() {
    const y = D.yuc, svg = $('barras'), panel = svg.closest('.panel');
    anchoBarras = svg.parentNode.clientWidth;
    // En computadora la gráfica va en una tarjeta sobre el mapa: su alto depende del alto de la ventana.
    altoBarras = telefono() ? 88 : W <= 1100 ? 46 : H >= 700 ? 92 : H >= 520 ? 62 : 46;
    const anios = Object.keys(y.anios).map(Number).sort((a, b) => a - b).map((a) => ({ y: a, total: y.anios[a] }));
    const dibujar = () => barrasAnios(svg, {
      anios, normal: y.normal, alTocar: elegirAnio, alBarrer: barrerAnio, seleccionado: anio === ANIO ? null : anio,
      ancho: Math.max(220, anchoBarras - 58), alto: altoBarras, rango: y.rango || null,
      periodos: t('periodos'), sigue: t('satSigue'), leyenda: t('leyendaConv'),
      aria: t('barrasAria', { n: fmt(y.normal), a: fmt(y.anios[ANIO]) }),
    });
    dibujar();
    altoPanel = panel.clientHeight;
  }
  function armarPanel() {
    const y = D.yuc;
    const anios = Object.keys(y.anios).map(Number).sort((a, b) => a - b).map((a) => ({ y: a, total: y.anios[a] }));
    const v26 = y.anios[ANIO];
    const antes = anios.filter((a) => a.y < ANIO).map((a) => a.total);
    const r = v26 / y.normal;
    const respuesta = v26 < Math.min(...antes) ? 'respuestaMinimo' : r < 0.8 ? 'respuestaMenos' : r <= 1.25 ? 'respuestaNormal' : 'respuestaMas';
    $('respuesta').textContent = t(respuesta);
    // Lo normal es la mediana de 25 años: suele ser la cifra de uno de ellos, y se dice cuál.
    const como = anios.find((a) => a.y < ANIO && Math.round(a.total) === Math.round(y.normal));
    $('leyNormalTexto').textContent = como ? t('loNormalComo', { n: fmt(y.normal), a: como.y }) : t('loNormal', { n: fmt(y.normal) });
    $('explicaNormal').textContent = t('explicaNormal') + (y.rango ? ' ' + t('explicaRango', { a: fmt(y.rango[0]), b: fmt(y.rango[1]) }) : '');
    $('pie').textContent = t('pie', { f: fechaDiaAnio(D.actualizado) });
    barrasPanel();
  }

  /* ---------- Textos que dependen de los datos o del idioma ---------- */
  // La fecha de los datos: el último día que trajo algún satélite, o la de la actualización.
  function fechaDatos() {
    const f = D && D.datoHasta ? Object.values(D.datoHasta).filter(Boolean).sort().pop() : null;
    return f || (D && D.actualizado) || null;
  }
  // La pregunta cambia de tiempo verbal cuando la temporada ya cerró (del 1 de marzo al 31 de mayo).
  function textosTemporada() {
    const f = fechaDatos();
    const d = f ? new Date(f + 'T12:00:00') : new Date();
    const md = (d.getMonth() + 1) * 100 + d.getDate();
    const enTemporada = d.getFullYear() === ANIO && md >= 301 && md <= 531;
    $('titulo').textContent = t(enTemporada ? 'titulo' : 'tituloPasado');
    const linea = $('fueraTemporada');
    linea.hidden = enTemporada || !D;
    if (linea.hidden) return;
    const cierre = fechaDia(diaDeTemporada(ULTIMO)), rec = D.reciente;
    if (!rec || !Number.isFinite(rec.peninsula)) { linea.textContent = t('fueraTemporada', { f: cierre }); return; }
    const clave = rec.peninsula === 0 ? 'fueraTemporadaCero' : rec.peninsula === 1 ? 'fueraTemporadaUno' : 'fueraTemporadaRecientes';
    linea.textContent = t(clave, { f: cierre, d: rec.dias || 7, n: fmt(rec.peninsula) });
  }
  function textos() {
    // Los meses van bajo su día; el primero y el último se alinean con los bordes.
    [0, 31, 61, 91].forEach((d, i) => {
      const m = $('m' + i);
      m.textContent = fechaCorta(diaDeTemporada(d));
      m.className = 'mes' + (i === 0 ? ' primero' : i === 3 ? ' ultimo' : '');
      m.style.left = i === 0 ? '0' : i === 3 ? '100%' : (((d + 0.5) / DIAS) * 100).toFixed(2) + '%';
    });
    diaPintado = -1;
    ambDia = -1;
    $('tiempo').setAttribute('aria-label', t('diaTemporada', { a: anio }));
    $('zoom').setAttribute('aria-label', t('zoomGrupo'));
    for (const [id, k] of [['acercar', 'acercar'], ['alejar', 'alejar'], ['verTodo', 'verTodo']]) $(id).setAttribute('aria-label', t(k));
    iconoControl();
    textosTemporada();
    if (!D) return;
    $('leyendaPunto').textContent = t('leyendaPunto', { f: fechaDiaAnio(D.diaMax.fecha), n: fmt(D.diaMax.n) });
    textosAnio();
    const alElegir = (m) => seleccionar(m.id, { quedar: true, camara: 'volar' });
    // Con la ubicación se va directo a la página del municipio, donde está su ficha.
    const alUbicar = (m) => { location.hash = '#/municipio/' + encodeURIComponent(m.id); };
    armarBuscador($('buscador1'), 1, { municipios: D.mun, alElegir, alUbicar });
    armarBuscador($('buscador2'), 2, { municipios: D.mun, alElegir, alUbicar });
    armarRotulos();
    armarEscala();
    armarPanel();
    armarAtajos();
    actualizarTiempo();
    descripcion();
    despejarRotulos();
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
    // +, − y 0 acercan, alejan y muestran los tres estados en el mapa del cierre.
    if (modo === 'final' && ['+', '=', '-', '_', '0'].includes(e.key)) {
      e.preventDefault();
      if (e.key === '0') verTodo(); else zoomBoton(e.key === '+' || e.key === '=' ? PASO_ZOOM : 1 / PASO_ZOOM);
      return;
    }
    // Lo que ya usa esas teclas (botones, deslizadores, el mapa, las barras) se queda con ellas.
    if (e.target.closest('button, a, [role="slider"], [role="button"], [role="toolbar"], #capa, dialog')) return;
    if (modo === 'final') return; // en el mapa a color, el espacio y las flechas son del navegador
    if (e.key === ' ') {
      e.preventDefault();
      if (modo === 'foto') { jugar(0); $('control').focus({ preventScroll: true }); } else $('control').click();
    } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && modo === 'repaso') {
      e.preventDefault();
      irADia(Math.round(t0) + (e.key === 'ArrowRight' ? 1 : -1));
    }
  }
  document.addEventListener('keydown', atajo);

  /* ---------- Eventos ---------- */
  // El botón que se tocó desaparece: el foco pasa a lo que lo reemplaza.
  $('verTemporada').addEventListener('click', () => { jugar(0); $('control').focus({ preventScroll: true }); });
  // En la foto, tocar el mapa también empieza la temporada: es lo primero que se toca.
  visor.addEventListener('click', () => { if (modo === 'foto' && D) { jugar(0); $('control').focus({ preventScroll: true }); } });
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
    const fin = () => {
      arrastrando = false;
      tiempo.classList.remove('arrastrando');
      tiempo.removeEventListener('pointermove', mover);
      tiempo.removeEventListener('pointerup', fin);
      tiempo.removeEventListener('pointercancel', fin);
      if (t0 >= ULTIMO - 0.01) irFinal(); else guardar(false);
    };
    tiempo.addEventListener('pointermove', mover);
    tiempo.addEventListener('pointerup', fin);
    tiempo.addEventListener('pointercancel', fin);
  }
  // Con el dedo, la página se sigue desplazando hacia arriba y abajo (touch-action: pan-y):
  // el repaso solo se arrastra si el gesto va de lado, y un toque sin mover lleva al día tocado.
  function tocar(ev) {
    const x0 = ev.clientX, y0 = ev.clientY, id = ev.pointerId;
    const fin = () => {
      tiempo.removeEventListener('pointermove', mover);
      tiempo.removeEventListener('pointerup', alSoltar);
      tiempo.removeEventListener('pointercancel', alSoltar);
    };
    const mover = (e) => {
      if (e.pointerId !== id) return;
      const dx = Math.abs(e.clientX - x0), dy = Math.abs(e.clientY - y0);
      if (dx < 8 && dy < 8) return;
      fin();
      if (dx > dy) arrastrar(e);
    };
    const alSoltar = (e) => {
      if (e.pointerId !== id) return;
      fin();
      if (e.type !== 'pointerup') return; // el navegador se quedó con el gesto para desplazar la página
      pausar();
      irA(e);
      if (t0 >= ULTIMO - 0.01) irFinal(); else guardar(false);
    };
    tiempo.addEventListener('pointermove', mover);
    tiempo.addEventListener('pointerup', alSoltar);
    tiempo.addEventListener('pointercancel', alSoltar);
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
  const observador = new ResizeObserver(() => {
    cancelAnimationFrame(esperaMedir);
    esperaMedir = requestAnimationFrame(() => {
      medir();
      const panel = $('barras').closest('.panel');
      // La tarjeta de los años cambia de alto con la ventana: el mapa se vuelve a encuadrar con su tamaño nuevo.
      if (D && ($('barras').parentNode.clientWidth !== anchoBarras || panel.clientHeight !== altoPanel)) { barrasPanel(); medir(); }
    });
  });
  observador.observe(escenario);
  observador.observe($('barras').closest('.panel'));

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
    dibujar();
    repDia = Array.from({ length: DIAS }, () => []);
    for (const c of D.rep) for (const d of c[2]) if (d >= 0 && d < DIAS) repDia[d].push(c);
    aplicar(leerEstado());
    ambId = requestAnimationFrame(ambCuadro);
  }).catch((e) => {
    if (!vivo) return;
    console.error(e);
    const aviso = document.createElement('p');
    aviso.className = 'aviso-error';
    aviso.setAttribute('role', 'alert');
    aviso.textContent = t('errorDatos');
    cartel.appendChild(aviso);
  });

  return () => {
    vivo = false;
    jugando = false;
    cancelAnimationFrame(cuadroId);
    cancelAnimationFrame(esperaMedir);
    cancelAnimationFrame(vuelo);
    cancelAnimationFrame(ambId);
    clearTimeout(esperaFinal);
    clearTimeout(esperaQuieto);
    observador.disconnect();
    document.removeEventListener('keydown', alEscape);
    document.removeEventListener('keydown', atajo);
    window.removeEventListener('hashchange', alAncla);
    window.removeEventListener('idioma', textos);
    clearTimeout(esperaURL);
  };
}
