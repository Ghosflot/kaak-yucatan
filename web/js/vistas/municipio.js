// Página de un municipio (#/municipio/<id>): veredicto, años, cuándo se quema y la ficha para WhatsApp.
import { t, traducir } from '../textos.js';
import { fmt, frase, cifras, fechaDia, fechaCorta, fechaDiaAnio, deMesDia, el, datos, visita } from '../comun.js';
import { hechosDe } from '../hechos.js';
import { barrasAnios } from '../graficas.js';
import { armarBuscador } from '../buscador.js';
import { dibujarFicha, aBlob, descargar, compartir, SITIO } from '../ficha.js';

const DIAS = 92; // del 1 de marzo al 31 de mayo
// Un color por significado, todos ya en la página: rojo = 2026; rojo claro = año con más fuego que lo normal
// (el de «Cómo lo medimos»); rojo oscuro = el fuego de cada día (el tono más fuerte del calendario de «Fechas», 10:1).
const ROJO = '#D7261E', ROJO_CLARO = '#E9837D', ROJO_OSCURO = '#996B66'; // terracota apagado: el rojo de la página con poca saturación (4.52:1), para que no compita con la gráfica de arriba
const CAPITAL = { 'Yucatán': 'Mérida', 'Campeche': 'Campeche', 'Quintana Roo': 'Chetumal' };
const indice = (md) => Math.round((deMesDia(md) - new Date(2026, 2, 1, 12)) / 864e5);
const suma = (a, i0 = 0, i1 = a.length) => a.slice(i0, i1).reduce((s, v) => s + v, 0);

// El mapa «dónde se quema» usa las unidades del lienzo de la portada (los contornos vienen así).
const UX = 825 / 5.8456, UY = 150; // unidades por grado de longitud y de latitud
const X = (lon) => (lon + 92.55) * UX, Y = (lat) => (22.35 - lat) * UY - 90;
const KM = UY / 111.2; // unidades por kilómetro
const LADO = 0.01; // un cuadrito: 0.01° por lado, cerca de 1 km
const TONOS_GAN = ['#F0E9DA', '#DDC79B', '#BF9A55', '#8C6A2F', '#503A18']; // territorio ganadero: un solo tono, de claro a oscuro
const TEMPORADAS_REP = 14; // los cuadritos repetidos cuentan las temporadas de 2012 a 2025
const clave = (lon, lat) => lon.toFixed(2) + ',' + lat.toFixed(2);
const enTemporada = (md) => md >= '03-01' && md <= '05-31';
const lugarEnMapa = (lon, lat) => 'https://www.google.com/maps?q=' + lat.toFixed(2) + ',' + lon.toFixed(2);

const PLANTILLA = `
<article class="municipio">
  <div class="mun-principal">
    <nav class="ruta" data-t-aria="rutaAria"><a href="#/" data-t="peninsula"></a><span aria-hidden="true">›</span><span id="rEstado"></span><span aria-hidden="true">›</span><span id="rNombre" aria-current="page"></span></nav>
    <header class="mun-cabeza">
      <div class="mun-titulo">
        <h1 id="nombre"></h1>
        <p class="mun-frase" id="frase"></p>
        <p class="mun-cifras cifra" id="cifras"></p>
        <p class="mun-def" data-t="defFoco"></p>
        <ul class="mun-hechos" id="hechos" hidden></ul>
      </div>
      <div class="mun-mapa" id="minimapa" role="img"><svg aria-hidden="true"></svg></div>
    </header>
    <section class="mun-bloque" aria-labelledby="tAnios">
      <div class="mun-bloque-titulo"><h2 id="tAnios" data-t="munBarrasTitulo"></h2><span class="ley-fija cifra"><i aria-hidden="true"></i><span id="leyNormal"></span></span></div>
      <svg id="barrasMun"></svg>
      <p class="mun-nota" data-t="munBarrasNota"></p>
      <p class="mun-pista" data-t="tocaAnio"></p>
    </section>
    <section class="mun-bloque donde" aria-labelledby="dondeTitulo">
      <h2 id="dondeTitulo"></h2>
      <p class="donde-frase" id="dondeFrase"></p>
      <div class="donde-cuerpo">
        <div class="donde-mapa" id="dondeCaja"><svg id="dondeMapa" tabindex="0" role="group"></svg></div>
        <div class="donde-lado">
          <ul class="donde-leyenda">
            <li id="leyFoco"><i class="l-foco" aria-hidden="true"></i><span data-t="dondeLeyFoco"></span></li>
            <li id="leyRep"><i class="l-rep" aria-hidden="true"><b></b><b></b><b></b></i><span data-t="dondeLeyRep"></span></li>
          </ul>
          <p class="donde-lectura" id="dondeLectura" aria-live="polite"></p>
          <p class="mun-nota donde-nota" data-t="dondeNota"></p>
        </div>
      </div>
      <details class="donde-lista" id="dondeLista" hidden><summary data-t="dondeLista"></summary><div class="donde-tabla" id="dondeTabla"></div></details>
    </section>
    <section class="mun-bloque" aria-labelledby="cuandoTitulo">
      <h2 id="cuandoTitulo"></h2>
      <div class="mun-sub-fila"><p class="mun-sub" id="cuandoSub"></p><button type="button" class="enlace" id="verNormal" data-t="verNormal" hidden></button></div>
      <div class="dias" id="dias" role="img">
        <div class="dias-ventana" id="ventana"><span id="ventanaTexto"></span></div>
        <div class="dias-llave" id="llave"><span class="corchete" aria-hidden="true"></span><span class="llave-texto" id="llaveTexto"></span></div>
        <div class="dias-barras" id="diasBarras"></div>
      </div>
      <div class="dias-fechas" id="diasFechas" aria-hidden="true"></div>
      <p class="mun-nota" id="notaFechas"></p>
    </section>
    <section class="mun-bloque" id="ganaderia" aria-labelledby="ganTitulo" hidden>
      <h2 id="ganTitulo" data-t="ganTitulo"></h2>
      <p class="mun-sub" id="ganCifras"></p>
      <p class="mun-sub" id="ganFocos"></p>
      <div class="gan-mapa">
        <h3 id="ganMapaTitulo" data-t="ganMapaTitulo"></h3>
        <div class="gan-opciones" role="group" aria-labelledby="ganMapaTitulo">
          <button type="button" data-gan="pastizal" data-t="ganMapaPastizal"></button>
          <button type="button" data-gan="bovinos" data-t="ganMapaBovinos"></button>
          <button type="button" data-gan="focos"></button>
        </div>
        <div class="gan-cuerpo">
          <svg id="ganMapa" role="group" viewBox="297 26 416 309"></svg>
          <div class="gan-lado">
            <ul class="gan-leyenda" id="ganLeyenda"></ul>
            <p class="gan-lectura" id="ganLectura" aria-live="polite"></p>
          </div>
        </div>
      </div>
      <p class="mun-nota" data-t="ganLimite"></p>
      <p class="pie" data-t="ganFuente"></p>
    </section>
    <section class="mun-cierre">
      <a class="ir siguiente" id="irFechas" data-t="sigueFechas" hidden></a>
      <div class="buscador claro" id="buscadorOtro"></div>
    </section>
  </div>
  <aside class="mun-lado" aria-labelledby="fichaTitulo">
    <h2 id="fichaTitulo"></h2>
    <p class="mun-sub" data-t="fichaSub"></p>
    <canvas class="ficha" id="ficha" width="1080" height="1350" role="img"></canvas>
    <div class="mun-botones">
      <button type="button" class="b-whatsapp" id="compartir"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4.5h16a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H10l-4.6 3.6a.6.6 0 0 1-1-.5V17.5H4A1.5 1.5 0 0 1 2.5 16V6A1.5 1.5 0 0 1 4 4.5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M7 9.5h10M7 13h6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span data-t="compartir"></span></button>
      <button type="button" class="b-borde" id="descargar" data-t="descargarImagen"></button>
    </div>
    <button type="button" class="enlace fuerte" id="csv"></button>
    <button type="button" class="enlace fuerte" id="csvFocos" hidden></button>
    <p class="pie" id="pie"></p>
  </aside>
</article>`;

const NO_EXISTE = `
<article class="pagina">
  <h1 data-t="municipioNoExiste"></h1>
  <div class="buscador claro" id="buscadorMun"></div>
  <a class="ir" href="#/" data-t="volverPortada"></a>
</article>`;

export function montar(raiz, { id }) {
  let m = null, P = null, G = null, ganOp = 'pastizal', anio = null, vivo = true, observador = null, cargando = true;
  // La imagen de la ficha se prepara antes del clic: Safari solo abre la hoja de compartir
  // si se pide en el mismo gesto, sin esperar a generar el PNG.
  let blobFicha = null, turnoFicha = 0;
  // Dónde se quema: los focos de marzo a mayo de 2026 agrupados por cuadrito, y los cuadritos repetidos.
  let grupos = [], porCelda = new Map(), rep = new Map(), cuenta = null, fijo = null, verDonde = () => {};
  const $ = (s) => raiz.querySelector('#' + s);

  async function noExiste() {
    raiz.innerHTML = NO_EXISTE;
    traducir(raiz);
    const lista = await datos('municipios.json').catch(() => []);
    if (!vivo) return;
    armarBuscador($('buscadorMun'), 'm', {
      municipios: lista.map((x) => ({ id: x.id, n: x.nombre, e: x.estado })),
      alElegir: (x) => { location.hash = '#/municipio/' + x.id; },
    });
  }

  function minimapa() {
    const caja = $('minimapa'), svg = caja.querySelector('svg');
    svg.textContent = '';
    caja.querySelectorAll('span').forEach((s) => s.remove());
    const delEstado = P.mun.filter((x) => x.e === m.estado);
    const g = el('g', {}, svg);
    let mio = null;
    for (const x of delEstado) { const p = el('path', { d: x.d, fill: x.id === m.id ? ROJO : '#E4E1DC', stroke: '#FFFFFF', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }, g); if (x.id === m.id) mio = p; }
    // Yucatán sin el arrecife Alacranes, que haría el mapa diminuto (el mismo recuadro del cierre).
    const b = m.estado === 'Yucatán' ? { x: 297, y: 26, width: 416, height: 309 } : g.getBBox();
    svg.setAttribute('viewBox', [b.x, b.y, b.width, b.height].map((v) => v.toFixed(1)).join(' '));
    // El recuadro toma la forma del estado: a lo más 232 de ancho y 200 de alto.
    const k = Math.min(232 / b.width, 200 / b.height);
    caja.style.width = Math.round(b.width * k) + 'px';
    caja.style.height = Math.round(b.height * k) + 'px';
    const pos = (x, y) => 'left:' + (((x - b.x) / b.width) * 100).toFixed(1) + '%;top:' + (((y - b.y) / b.height) * 100).toFixed(1) + '%';
    const capital = P.ciudades.find((c) => c.t === CAPITAL[m.estado]);
    if (capital && capital.t !== m.nombre) {
      const p = document.createElement('span'); p.className = 'mm-punto'; p.setAttribute('style', pos(capital.x, capital.y)); caja.appendChild(p);
      const r = document.createElement('span'); r.className = 'mm-ciudad'; r.setAttribute('style', pos(capital.x, capital.y)); r.textContent = capital.t; caja.appendChild(r);
    }
    const yo = P.mun.find((x) => x.id === m.id);
    const r = document.createElement('span');
    // El nombre va junto a la orilla del municipio (a la izquierda si está al oriente): encima no se leería.
    const izq = (yo.cx - b.x) / b.width > 0.6, c = mio.getBBox();
    r.className = 'mm-nombre' + (izq ? ' izq' : '');
    r.setAttribute('style', pos(izq ? Math.max(c.x, b.x) : Math.min(c.x + c.width, b.x + b.width), Math.min(Math.max(yo.cy, b.y), b.y + b.height)));
    r.textContent = m.nombre;
    caja.appendChild(r);
    caja.setAttribute('aria-label', t('mapaAria', { e: m.estado, m: m.nombre }));
  }

  // La llave: qué parte del fuego cae fuera de la ventana (después o, si la ventana llega al 31 de mayo, antes).
  function llave(dias, deAnio) {
    if (!m.ventana) return null;
    const i0 = indice(m.ventana.inicio), i1 = indice(m.ventana.fin);
    const total = suma(dias);
    if (total <= 0) return { vacia: true };
    const despues = i1 < DIAS - 1;
    const parte = despues ? suma(dias, i1 + 1) : suma(dias, 0, Math.max(0, i0));
    const k = Math.round((parte / total) * 10);
    const clave = (despues ? 'llaveDespues' : 'llaveAntes') + (deAnio ? 'Anio' : '');
    const f = fechaDia(deMesDia(despues ? m.ventana.fin : m.ventana.inicio));
    const [negrita, resto] = t(clave, { k, f, a: anio }).split('|');
    return { desde: despues ? i1 + 1 : 0, hasta: despues ? DIAS : Math.max(0, i0), negrita, resto };
  }

  function grafDias() {
    const deAnio = anio !== null;
    const dias = deAnio ? m.porAnio[String(anio)] : m.diaNormal;
    const tope = Math.max(...dias, ...(deAnio ? m.diaNormal : []), 1e-9);
    const barras = $('diasBarras');
    barras.textContent = '';
    barras.classList.toggle('con-anio', deAnio);
    // Con un año elegido, cada día lleva dos barras: un año normal en gris, detrás, y el año delante: 2026 en rojo, los demás en tinta.
    // La cantidad la dice la altura (Cleveland y McGill); el color solo dice qué serie es.
    const color = () => (anio === 2026 ? ROJO : ROJO_OSCURO);
    const alto = (v) => (v > 0 ? Math.max(1.5, (v / tope) * 97) + '%' : '0');
    dias.forEach((v, i) => {
      const s = document.createElement('span');
      if (deAnio) {
        const n = document.createElement('i'); n.className = 'n'; n.style.height = alto(m.diaNormal[i]);
        const a = document.createElement('i'); a.className = 'a'; a.style.height = alto(v); a.style.background = color(v);
        s.append(n, a);
      } else { s.style.height = alto(v); s.style.background = color(v); }
      barras.appendChild(s);
    });
    const pct = (i) => ((i / DIAS) * 100).toFixed(2) + '%';
    const v = $('ventana'), l = $('llave');
    v.hidden = l.hidden = !m.ventana;
    $('dias').classList.toggle('sin-ventana', !m.ventana);
    if (m.ventana) {
      const i0 = Math.max(0, indice(m.ventana.inicio)), i1 = Math.min(DIAS - 1, indice(m.ventana.fin));
      Object.assign(v.style, { left: pct(i0), width: pct(i1 - i0 + 1) });
      $('ventanaTexto').innerHTML = '';
      const a = document.createElement('b'); a.textContent = t(m.zona_inferida ? 'seProbable' : 'sePermite');
      const b = document.createElement('span'); b.textContent = t('rango', { i: fechaCorta(deMesDia(m.ventana.inicio)), f: fechaCorta(deMesDia(m.ventana.fin)) });
      $('ventanaTexto').append(a, b);
      const ll = llave(dias, deAnio);
      const texto = $('llaveTexto');
      texto.textContent = '';
      if (ll && !ll.vacia) {
        Object.assign(l.style, { left: pct(ll.desde), width: pct(ll.hasta - ll.desde) });
        const n = document.createElement('b'); n.textContent = ll.negrita;
        texto.append(n, ' ' + ll.resto);
        l.hidden = false;
      } else l.hidden = true;
    }
    const sub = $('cuandoSub');
    if (deAnio && suma(dias) <= 0) sub.textContent = t('sinFocosAnio', { a: anio });
    else sub.textContent = deAnio ? (anio === 2026 ? t('cuandoAnio2026') : t('cuandoAnio', { a: anio })) : t('cuandoNormal');
    $('verNormal').hidden = !deAnio;
    const nombreSerie = deAnio ? String(anio) : t('unAnioNormal');
    const llaveTxt = $('llave').hidden ? '' : ' ' + $('llaveTexto').textContent + '.';
    $('dias').setAttribute('aria-label', t('diasAria', { m: m.nombre, q: nombreSerie }) + llaveTxt);
    const fechas = $('diasFechas');
    fechas.textContent = '';
    for (const [i, cls] of [[0, 'primero'], [31, ''], [61, ''], [91, 'ultimo']]) {
      const s = document.createElement('span');
      s.className = cls;
      s.style.left = cls === 'ultimo' ? '100%' : pct(i);
      s.textContent = fechaCorta(new Date(2026, 2, 1 + i, 12));
      fechas.appendChild(s);
    }
  }

  function elegirAnio(a) {
    anio = a === anio ? null : a;
    grafBarras();
    grafDias();
  }

  // Las barras se dibujan al ancho real: así las letras miden lo mismo en cualquier pantalla.
  function grafBarras() {
    const svg = $('barrasMun');
    const ancho = Math.max(240, Math.round(svg.parentNode.clientWidth) - 44);
    barrasAnios(svg, {
      anios: m.anios, normal: m.normal, alto: 110, ancho, seleccionado: anio, alTocar: elegirAnio, rango: m.rango || null, sobreNormal: ROJO_CLARO,
      aria: t('munBarrasAria', { m: m.nombre, n: fmt(m.normal), a: fmt(m.v26) }),
    });
  }

  function hechos() {
    const ul = $('hechos'), lista = hechosDe(m);
    ul.textContent = '';
    ul.hidden = !lista.length;
    ul.setAttribute('aria-label', t('hechosAria', { m: m.nombre }));
    for (const h of lista) { const li = document.createElement('li'); li.textContent = h.texto; ul.appendChild(li); }
  }

  function prepararDonde() {
    rep = new Map(m.repetidos.map(([lon, lat, a]) => [clave(lon, lat), { k: clave(lon, lat), lon, lat, a }]));
    porCelda = new Map();
    const focos = m.focos26.filter((f) => enTemporada(f[2]));
    for (const [lon, lat, md, sat] of focos) {
      const k = clave(lon, lat);
      if (!porCelda.has(k)) porCelda.set(k, { k, lon, lat, x: X(lon), y: Y(lat), dias: [] });
      porCelda.get(k).dias.push({ md, sat });
    }
    // En orden de fecha: así se recorren con las flechas.
    grupos = [...porCelda.values()].sort((a, b) => a.dias[0].md.localeCompare(b.dias[0].md) || a.lon - b.lon || a.lat - b.lat);
    const maxA = Math.max(0, ...m.repetidos.map((r) => r[2]));
    cuenta = {
      F: focos.length, R: rep.size, maxA,
      nMax: m.repetidos.filter((r) => r[2] === maxA).length,
      C: focos.filter((f) => rep.has(clave(f[0], f[1]))).length,
    };
  }

  // La afirmación del mapa, con una oración correcta para cada caso (nunca «0 de 0»).
  function fraseDonde() {
    const { F, R, C, maxA, nMax } = cuenta, T = TEMPORADAS_REP, n = m.nombre;
    const a = R === 0 ? t('dondeRep0', { m: n })
      : R === 1 ? t('dondeRep1', { m: n, a: maxA, T })
        : nMax === R ? t('dondeRepSolo', { n: fmt(R), m: n, a: maxA, T })
          : t('dondeRep', { n: fmt(R), m: n, k: nMax === 1 ? t('uno') : fmt(nMax), a: maxA, T });
    const b = F === 0 ? t('dondeSinFocos', { m: n })
      : R === 0 ? (F === 1 ? t('dondeSoloFocosUno') : t('dondeSoloFocos', { F: fmt(F) }))
        : F === 1 ? t(C ? 'dondeUnicoSi' : 'dondeUnicoNo')
          : C === 0 ? t('dondeFocosCero', { F: fmt(F) })
            : C === F ? t('dondeFocosTodos', { F: fmt(F) })
              : C === 1 ? t('dondeFocosUno', { F: fmt(F) })
                : t('dondeFocos', { F: fmt(F), c: fmt(C) });
    return a + ' ' + b;
  }

  // El renglón fijo junto al mapa: qué es lo que se tocó y el enlace para ver el lugar.
  function leer(it) {
    const p = $('dondeLectura');
    p.textContent = '';
    p.classList.toggle('pista', !it);
    if (!it) { p.textContent = cuenta.F || cuenta.R ? t('dondePista') : ''; return; }
    const T = TEMPORADAS_REP;
    let texto, mas = '';
    if (it.dias) {
      const d = it.dias;
      texto = d.length === 1 ? t('dondeLeeFoco', { f: fechaDiaAnio(deMesDia(d[0].md)), s: d[0].sat })
        : t('dondeLeeFocos', { n: d.length, a: fechaDia(deMesDia(d[0].md)), b: fechaDia(deMesDia(d[d.length - 1].md)) });
      const r = rep.get(it.k);
      if (r) mas = t('dondeLeeTambien', { a: r.a, T });
    } else texto = t('dondeLeeRep', { a: it.a, T });
    const b = document.createElement('b'); b.textContent = texto;
    p.appendChild(b);
    if (mas) p.append(' ' + mas);
    const a = document.createElement('a');
    a.className = 'ir fuera'; a.href = lugarEnMapa(it.lon, it.lat); a.target = '_blank'; a.rel = 'noopener';
    a.textContent = t('dondeAbrir');
    p.append(' ', a);
  }

  // Dónde poner el nombre de cada vecino: en la parte suya que se ve, lejos de la orilla.
  function rotulosVecinos(svg, vecinos, propio, v, u) {
    const N = 22, pasoX = v.w / N, pasoY = v.h / N, punto = svg.createSVGPoint();
    const dentro = (path, x, y) => { punto.x = x; punto.y = y; return path.isPointInFill(punto); };
    const cand = [];
    for (const { path, nombre } of vecinos) {
      const c = path.getBBox();
      if (c.x > v.x + v.w || c.x + c.width < v.x || c.y > v.y + v.h || c.y + c.height < v.y) continue;
      const mios = new Set();
      for (let i = 1; i < N; i++) for (let j = 1; j < N; j++) if (dentro(path, v.x + i * pasoX, v.y + j * pasoY)) mios.add(i * 100 + j);
      // Solo cuentan los puntos rodeados de puntos suyos: ahí cabe un nombre sin pisar una orilla.
      const hondos = [...mios].filter((q) => mios.has(q - 100) && mios.has(q + 100) && mios.has(q - 1) && mios.has(q + 1));
      if (!hondos.length) continue;
      const cx = hondos.reduce((s, q) => s + Math.floor(q / 100), 0) / hondos.length, cy = hondos.reduce((s, q) => s + (q % 100), 0) / hondos.length;
      const q = hondos.reduce((a, b) => (Math.hypot(Math.floor(b / 100) - cx, (b % 100) - cy) < Math.hypot(Math.floor(a / 100) - cx, (a % 100) - cy) ? b : a));
      cand.push({ nombre, n: hondos.length, x: v.x + Math.floor(q / 100) * pasoX, y: v.y + (q % 100) * pasoY });
    }
    const puestos = [], g = el('g', { class: 'd-vecinos-t', 'font-size': (11.5 * u).toFixed(3) }, svg);
    for (const c of cand.sort((a, b) => b.n - a.n)) {
      const ancho = (c.nombre.length * 6.4 + 8) * u, alto = 16 * u;
      const x = Math.min(v.x + v.w - ancho / 2 - 4 * u, Math.max(v.x + ancho / 2 + 4 * u, c.x));
      const caja = { x0: x - ancho / 2, x1: x + ancho / 2, y0: c.y - alto / 2, y1: c.y + alto / 2 };
      // Ni encima de otro nombre, ni de la barra de escala (abajo a la izquierda), ni del propio municipio.
      if (puestos.some((p) => caja.x0 < p.x1 && caja.x1 > p.x0 && caja.y0 < p.y1 && caja.y1 > p.y0)) continue;
      if (caja.y1 > v.y + v.h - 26 * u && caja.x0 < v.x + 150 * u) continue;
      if ([caja.x0, x, caja.x1].some((px) => dentro(propio, px, c.y))) continue;
      puestos.push(caja);
      el('text', { x: x.toFixed(2), y: (c.y + 4 * u).toFixed(2), 'text-anchor': 'middle', 'stroke-width': (3 * u).toFixed(3) }, g).textContent = c.nombre;
    }
  }

  // El mapa del municipio: sus vecinos, los cuadritos donde el fuego se repite y los focos de 2026.
  function mapaDonde() {
    const svg = $('dondeMapa'), caja = $('dondeCaja');
    svg.textContent = '';
    const [lon0, lat0, lon1, lat1] = m.caja;
    let x0 = X(lon0), x1 = X(lon1), y0 = Y(lat1), y1 = Y(lat0);
    const margen = Math.max(x1 - x0, y1 - y0) * 0.13 + 2;
    x0 -= margen; x1 += margen; y0 -= margen; y1 += margen;
    let w = x1 - x0, h = y1 - y0;
    // El recuadro sigue la forma del municipio, sin llegar a ser una tira.
    const razon = Math.min(1.45, Math.max(0.95, w / h));
    if (w / h < razon) { x0 -= (h * razon - w) / 2; w = h * razon; } else { y0 -= (w / razon - h) / 2; h = w / razon; }
    svg.setAttribute('viewBox', [x0, y0, w, h].map((n) => n.toFixed(2)).join(' '));
    caja.style.aspectRatio = razon.toFixed(3);
    const u = w / (caja.clientWidth || 440); // unidades del lienzo por pixel
    const v = { x: x0, y: y0, w, h };

    const gV = el('g', { class: 'd-vecinos' }, svg), vecinos = [];
    for (const x of P.mun) if (x.id !== m.id) vecinos.push({ path: el('path', { d: x.d }, gV), nombre: x.n });
    const propio = el('path', { d: P.mun.find((x) => x.id === m.id).d, class: 'd-propio' }, svg);

    const gR = el('g', { class: 'd-rep' }, svg), cw = LADO * UX, ch = LADO * UY;
    for (const r of rep.values()) {
      el('rect', { x: (X(r.lon) - cw / 2).toFixed(2), y: (Y(r.lat) - ch / 2).toFixed(2), width: cw.toFixed(2), height: ch.toFixed(2), 'fill-opacity': (0.16 + ((Math.min(r.a, TEMPORADAS_REP) - 5) / (TEMPORADAS_REP - 5)) * 0.62).toFixed(2) }, gR);
    }
    // El punto crece con el mapa: chico en un municipio enorme, para que no se amontonen.
    const r0 = Math.min(3.6, Math.max(1.25, (KM / u) * 0.36));
    const radio = (g) => (r0 + Math.min(4, 1.3 * Math.sqrt(g.dias.length - 1)) * (r0 / 3.6)) * u;
    const gF = el('g', { class: 'd-focos' + (r0 < 2.4 ? ' chicos' : '') }, svg);
    for (const g of grupos) el('circle', { cx: g.x.toFixed(2), cy: g.y.toFixed(2), r: radio(g).toFixed(3) }, gF);
    try { rotulosVecinos(svg, vecinos, propio, v, u); } catch { /* sin isPointInFill no hay nombres de vecinos */ }

    // Barra de escala: la medida redonda que quede cerca de 80 px.
    const km = [1, 2, 5, 10, 20, 50, 100].find((k) => (k * KM) / u >= 56) || 100;
    const ge = el('g', { class: 'd-escala', 'font-size': (11.5 * u).toFixed(3) }, svg);
    const ex = x0 + 12 * u, ey = y0 + h - 12 * u, largo = km * KM;
    el('path', { d: `M${ex.toFixed(2)},${(ey - 5 * u).toFixed(2)}V${ey.toFixed(2)}h${largo.toFixed(2)}v${(-5 * u).toFixed(2)}` }, ge);
    el('text', { x: (ex + largo + 6 * u).toFixed(2), y: (ey + 1 * u).toFixed(2), 'stroke-width': (3 * u).toFixed(3) }, ge).textContent = t('km', { n: km });

    const gS = el('g', { class: 'd-sel' }, svg);
    const marcar = (it) => {
      gS.textContent = '';
      if (!it) return;
      if (it.dias) el('circle', { cx: it.x.toFixed(2), cy: it.y.toFixed(2), r: (radio(it) + 3.5 * u).toFixed(3) }, gS);
      else el('rect', { x: (X(it.lon) - cw / 2).toFixed(2), y: (Y(it.lat) - ch / 2).toFixed(2), width: cw.toFixed(2), height: ch.toFixed(2) }, gS);
    };
    verDonde = (it) => { marcar(it); leer(it); };
    verDonde(fijo);

    // Con el dedo o el ratón se elige por cercanía: el foco más próximo o, si no, el cuadrito de abajo.
    const cerca = (ev) => {
      const c = svg.getBoundingClientRect();
      const ux = x0 + ((ev.clientX - c.left) / c.width) * w, uy = y0 + ((ev.clientY - c.top) / c.height) * h;
      let mejor = null, d2 = ((ev.pointerType === 'mouse' ? 9 : 22) * u) ** 2;
      for (const g of grupos) { const d = (g.x - ux) ** 2 + (g.y - uy) ** 2; if (d < d2) { d2 = d; mejor = g; } }
      if (mejor) return mejor;
      const k = clave(ux / UX - 92.55, 22.35 - (uy + 90) / UY);
      return porCelda.get(k) || rep.get(k) || null;
    };
    svg.onpointermove = (ev) => { if (ev.pointerType === 'mouse') { const it = cerca(ev); svg.classList.toggle('sobre', !!it); verDonde(it || fijo); } };
    svg.onpointerleave = () => { svg.classList.remove('sobre'); verDonde(fijo); };
    svg.onclick = (ev) => { fijo = cerca(ev); verDonde(fijo); };
    svg.onkeydown = (ev) => {
      if (ev.key === 'Escape') { fijo = null; verDonde(null); return; }
      const i = grupos.indexOf(fijo);
      const ir = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i < 0 ? grupos.length - 1 : i - 1, ArrowUp: i < 0 ? grupos.length - 1 : i - 1, Home: 0, End: grupos.length - 1 }[ev.key];
      if (ir === undefined || !grupos.length) return;
      ev.preventDefault();
      fijo = grupos[Math.max(0, Math.min(grupos.length - 1, ir))];
      verDonde(fijo);
    };
    svg.setAttribute('aria-label', t('dondeAria', { m: m.nombre, F: fmt(cuenta.F), R: fmt(cuenta.R) }));
  }

  // La lista de los focos, para quien no usa el mapa: se arma al abrirla (pueden ser miles).
  function listaDonde() {
    const caja = $('dondeTabla');
    if (!$('dondeLista').open) { caja.textContent = ''; return; }
    const tabla = document.createElement('table');
    const cab = tabla.createTHead().insertRow();
    for (const k of ['dondeColFecha', 'dondeColSat', 'dondeColLugar']) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = t(k); cab.appendChild(th); }
    const cuerpo = tabla.createTBody();
    for (const [lon, lat, md, sat] of m.focos26) {
      if (!enTemporada(md)) continue;
      const f = cuerpo.insertRow();
      f.insertCell().textContent = fechaDia(deMesDia(md));
      f.insertCell().textContent = sat;
      const a = document.createElement('a');
      a.href = lugarEnMapa(lon, lat); a.target = '_blank'; a.rel = 'noopener'; a.className = 'fuera';
      a.textContent = lat.toFixed(2) + ', ' + lon.toFixed(2);
      a.setAttribute('aria-label', t('dondeAbrir') + ': ' + a.textContent);
      // Al enfocar o pasar por un renglón, su punto se marca en el mapa.
      const ver = () => verDonde(porCelda.get(clave(lon, lat)));
      f.addEventListener('pointerenter', ver);
      a.addEventListener('focus', ver);
      f.insertCell().appendChild(a);
    }
    caja.replaceChildren(tabla);
  }

  function donde() {
    $('dondeTitulo').textContent = t('dondeTitulo', { m: m.nombre });
    $('dondeFrase').textContent = fraseDonde();
    $('leyFoco').hidden = !cuenta.F;
    $('leyRep').hidden = !cuenta.R;
    $('dondeLista').hidden = !cuenta.F;
    // Sin focos ni cuadritos repetidos no hay nada que poner en el mapa: queda la oración.
    raiz.querySelector('.donde-cuerpo').hidden = !cuenta.F && !cuenta.R;
    mapaDonde();
    listaDonde();
  }

  function cierre() {
    const zona = m.ventana ? (m.zona || '').replace(/^\D+/, '') : '';
    const a = $('irFechas');
    a.hidden = !zona;
    if (zona) a.href = '#/fechas/' + zona;
    armarBuscador($('buscadorOtro'), 'o', {
      etiqueta: 'verOtro',
      municipios: P.mun.filter((x) => x.id !== m.id).map((x) => ({ id: x.id, n: x.n, e: x.e })),
      alElegir: (x) => { location.hash = '#/municipio/' + x.id; },
    });
  }

  async function pintarFicha() {
    const c = $('ficha'), mio = ++turnoFicha;
    blobFicha = null;
    await dibujarFicha(c, m);
    if (mio !== turnoFicha || !vivo) return;
    c.setAttribute('aria-label', t('fichaAria', { m: m.nombre, v: frase(m) + ' ' + cifras('fCifras', m) }));
    const b = await aBlob(c);
    if (mio === turnoFicha) blobFicha = b;
  }

  // Territorio ganadero (#60): solo los municipios de Yucatán vienen en ganaderia.json; si no carga, el bloque no sale.
  function ganaderia() {
    const g = G && G.municipios.find((x) => x.id === m.id);
    $('ganaderia').hidden = !g;
    if (!g) return;
    $('ganCifras').textContent = t('ganCifras', { m: m.nombre, p: fmt(g.pctPastizal), b: fmt(g.bovinos), k: fmt(g.bovinosKm2) });
    const [d, h] = G.periodo, y = G.yucatan;
    $('ganFocos').hidden = !g.focos;
    if (g.focos) {
      $('ganFocos').textContent = t('ganFocos', {
        d, h, f: fmt((100 * g.focosPastizal) / g.focos), pe: fmt(y.pctPastizal), fe: fmt(y.pctFocosPastizal),
      });
    }
    mapaGanadero();
  }

  // El mapa del territorio ganadero (#60): Yucatán por municipio, en la opción elegida. Un solo tono, de claro a
  // oscuro, porque más pastizal no es «peor». Tocar un municipio abre su página.
  function mapaGanadero() {
    const svg = $('ganMapa'), [d, h] = G.periodo;
    const titulo = (op) => t('ganMapa' + { pastizal: 'Pastizal', bovinos: 'Bovinos', focos: 'Focos' }[op], { d, h });
    raiz.querySelectorAll('[data-gan]').forEach((b) => {
      b.textContent = titulo(b.dataset.gan);
      b.setAttribute('aria-pressed', String(b.dataset.gan === ganOp));
    });
    svg.setAttribute('aria-label', t('ganMapaAria', { t: titulo(ganOp) }));
    // La leyenda, con los cortes de los datos: «menos de 5 %», «5 a 15 %»… «50 % o más».
    const c = G.cortes[ganOp], u = ganOp === 'bovinos' ? '' : ' %';
    const rotulos = [t('ganMapaMenos', { a: c[0] + u }), ...c.slice(1).map((x, i) => t('ganMapaEntre', { a: c[i], b: x + u })), t('ganMapaMas', { a: c[c.length - 1] + u })];
    $('ganLeyenda').replaceChildren(...rotulos.map((r, i) => {
      const li = document.createElement('li'), cuadro = document.createElement('i');
      cuadro.style.background = TONOS_GAN[i];
      li.append(cuadro, r);
      return li;
    }));
    const lectura = $('ganLectura');
    const pista = () => { lectura.textContent = t(matchMedia('(hover: none)').matches ? 'ganMapaPistaTactil' : 'ganMapaPista'); lectura.classList.add('pista'); };
    const decir = (x, g) => {
      lectura.classList.remove('pista');
      lectura.textContent = ganOp === 'focos'
        ? (g.focos ? t('ganMapaFocosDe', { m: x.n, f: fmt((100 * g.focosPastizal) / g.focos), d, h }) : t('ganMapaSinFocos', { m: x.n, d, h }))
        : t('ganCifras', { m: x.n, p: fmt(g.pctPastizal), b: fmt(g.bovinos), k: fmt(g.bovinosKm2) });
    };
    svg.textContent = '';
    const porId = new Map(G.municipios.map((x) => [x.id, x]));
    let propio = null;
    for (const x of P.mun) {
      const g = porId.get(x.id);
      if (!g) continue;
      const a = el('a', { href: '#/municipio/' + x.id, tabindex: -1, 'aria-label': x.n, 'data-id': x.id }, svg);
      el('path', { d: x.d, fill: TONOS_GAN[g.clases[ganOp]] }, a);
      a.addEventListener('pointerenter', () => decir(x, g));
      a.addEventListener('pointerleave', pista);
      if (x.id === m.id) propio = a;
    }
    // El municipio de la página va encima, con su contorno en tinta.
    if (propio) { propio.classList.add('propio'); svg.appendChild(propio); }
    pista();
  }

  function pintar() {
    if (!m) return;
    traducir(raiz);
    document.title = m.nombre + ': ' + frase(m) + " K'áak'";
    $('rEstado').textContent = m.estado;
    $('rNombre').textContent = m.nombre;
    $('nombre').textContent = m.nombre;
    $('frase').textContent = frase(m);
    // La cifra de 2026 en rojo, como su barra.
    const txt = cifras('munCifras2', m), a26 = fmt(m.v26), k = txt.indexOf(a26), p = $('cifras');
    p.textContent = '';
    if (k < 0) p.textContent = txt;
    else { const b = document.createElement('b'); b.className = 'c2026'; b.textContent = a26; p.append(txt.slice(0, k), b, txt.slice(k + a26.length)); }
    $('leyNormal').textContent = t('loNormal', { n: fmt(m.normal) });
    $('cuandoTitulo').textContent = t('cuandoTitulo', { m: m.nombre });
    const zona = (m.zona || '').replace(/^\D+/, '');
    const nota = $('notaFechas');
    if (!m.ventana) nota.textContent = t('notaSinVentana', { e: m.estado });
    else nota.textContent = t(m.zona_inferida ? 'notaInferida' : 'notaSeder', { z: zona, m: m.nombre, i: fechaDia(deMesDia(m.ventana.inicio)), f: fechaDia(deMesDia(m.ventana.fin)) });
    $('fichaTitulo').textContent = t('fichaTitulo', { m: m.nombre });
    $('csv').textContent = t('descargarCsv', { m: m.nombre });
    $('csvFocos').textContent = t('descargarCsvFocos', { m: m.nombre });
    $('csvFocos').hidden = !m.focos26.length;
    $('pie').textContent = t('pie', { f: fechaDiaAnio(P.actualizado) });
    minimapa();
    hechos();
    grafBarras();
    donde();
    grafDias();
    ganaderia();
    cierre();
    pintarFicha();
  }

  function csv() {
    const filas = [t('csvColumnas')];
    for (const a of Object.keys(m.porAnio).sort()) {
      m.porAnio[a].forEach((v, i) => {
        const f = new Date(Date.UTC(Number(a), 2, 1 + i)).toISOString().slice(0, 10);
        filas.push([f, a, v, m.diaNormal[i]].join(','));
      });
    }
    return new Blob(['﻿' + filas.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
  }

  // Los focos de calor de todo 2026, uno por renglón: fecha, coordenadas del centro del cuadrito y satélite.
  function csvFocos() {
    const filas = [t('csvFocosColumnas')];
    for (const [lon, lat, md, sat] of m.focos26) filas.push(['2026-' + md, lat.toFixed(2), lon.toFixed(2), sat].join(','));
    return new Blob(['\uFEFF' + filas.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
  }

  async function arrancar() {
    if (!/^[a-z0-9-]+$/.test(id)) { cargando = false; noExiste(); return; }
    try {
      [m, P, G] = await Promise.all([datos('municipio/' + id + '.json'), datos('portada.json'),
        datos('ganaderia.json').catch(() => null)]);
    } catch {
      cargando = false;
      if (vivo) noExiste();
      return;
    }
    cargando = false;
    if (!vivo) return;
    visita.municipio = m.id;
    raiz.innerHTML = PLANTILLA;
    prepararDonde();
    pintar();
    $('dondeLista').addEventListener('toggle', listaDonde);
    $('csvFocos').addEventListener('click', () => descargar(csvFocos(), 'kaak-' + m.id + '-focos-2026.csv'));
    raiz.querySelectorAll('[data-gan]').forEach((b) => b.addEventListener('click', () => { ganOp = b.dataset.gan; mapaGanadero(); }));
    $('compartir').addEventListener('click', async () => {
      const blob = blobFicha || await aBlob($('ficha'));
      const url = 'https://' + SITIO + '/' + m.id;
      compartir(blob, 'kaak-' + m.id + '.png', t('compartirTexto', { m: m.nombre, v: frase(m), u: url }));
    });
    $('descargar').addEventListener('click', async () => descargar(blobFicha || await aBlob($('ficha')), 'kaak-' + m.id + '.png'));
    $('csv').addEventListener('click', () => descargar(csv(), 'kaak-' + m.id + '.csv'));
    $('verNormal').addEventListener('click', () => elegirAnio(anio));
    let ultimo = 0;
    observador = new ResizeObserver(() => {
      const w = $('barrasMun')?.parentNode.clientWidth;
      if (w && Math.abs(w - ultimo) > 8) { ultimo = w; grafBarras(); mapaDonde(); }
    });
    observador.observe($('barrasMun').parentNode);
  }

  arrancar();
  // Mientras carga no hay nada que traducir: al llegar los datos se pinta en el idioma nuevo.
  const alIdioma = () => { if (cargando) return; if (m && $('nombre')) pintar(); else if (!m) noExiste(); };
  window.addEventListener('idioma', alIdioma);
  return () => { vivo = false; observador?.disconnect(); window.removeEventListener('idioma', alIdioma); };
}
