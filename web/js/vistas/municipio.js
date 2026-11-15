// Página de un municipio (#/municipio/<id>): veredicto, años, cuándo se quema y la ficha para WhatsApp.
import { t, traducir } from '../textos.js';
import { fmt, frase, cifras, fechaDia, fechaCorta, fechaDiaAnio, deMesDia, el, datos } from '../comun.js';
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
      </div>
      <div class="mun-mapa" id="minimapa" role="img"><svg aria-hidden="true"></svg></div>
    </header>
    <section class="mun-bloque" aria-labelledby="tAnios">
      <div class="mun-bloque-titulo"><h2 id="tAnios" data-t="munBarrasTitulo"></h2><span class="ley-fija cifra"><i aria-hidden="true"></i><span id="leyNormal"></span></span></div>
      <svg id="barrasMun"></svg>
      <p class="mun-nota" data-t="munBarrasNota"></p>
      <p class="mun-pista" data-t="tocaAnio"></p>
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
  let m = null, P = null, anio = null, vivo = true, observador = null, cargando = true;
  // La imagen de la ficha se prepara antes del clic: Safari solo abre la hoja de compartir
  // si se pide en el mismo gesto, sin esperar a generar el PNG.
  let blobFicha = null, turnoFicha = 0;
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
    for (const x of delEstado) el('path', { d: x.d, fill: x.id === m.id ? ROJO : '#E4E1DC', stroke: '#FFFFFF', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }, g);
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
    r.className = 'mm-nombre' + ((yo.cx - b.x) / b.width > 0.6 ? ' izq' : '');
    r.setAttribute('style', pos(yo.cx, yo.cy));
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
      anios: m.anios, normal: m.normal, alto: 110, ancho, seleccionado: anio, alTocar: elegirAnio, sobreNormal: ROJO_CLARO,
      aria: t('munBarrasAria', { m: m.nombre, n: fmt(m.normal), a: fmt(m.v26) }),
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
    $('pie').textContent = t('pie', { f: fechaDiaAnio(P.actualizado) });
    minimapa();
    grafBarras();
    grafDias();
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

  async function arrancar() {
    if (!/^[a-z0-9-]+$/.test(id)) { cargando = false; noExiste(); return; }
    try {
      [m, P] = await Promise.all([datos('municipio/' + id + '.json'), datos('portada.json')]);
    } catch {
      cargando = false;
      if (vivo) noExiste();
      return;
    }
    cargando = false;
    if (!vivo) return;
    raiz.innerHTML = PLANTILLA;
    pintar();
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
      if (w && Math.abs(w - ultimo) > 8) { ultimo = w; grafBarras(); }
    });
    observador.observe($('barrasMun').parentNode);
  }

  arrancar();
  // Mientras carga no hay nada que traducir: al llegar los datos se pinta en el idioma nuevo.
  const alIdioma = () => { if (cargando) return; if (m && $('nombre')) pintar(); else if (!m) noExiste(); };
  window.addEventListener('idioma', alIdioma);
  return () => { vivo = false; observador?.disconnect(); window.removeEventListener('idioma', alIdioma); };
}
