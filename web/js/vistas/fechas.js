// Fechas de quema (#/fechas[/<zona>]): el calendario de enero a junio de una zona de Yucatán y el almanaque por municipio.
// El calendario cubre de enero a junio, igual que la tira de la portada: las dos dicen la misma cifra.
import { t, traducir } from '../textos.js';
import { fmt, sinAcentos, fechaDia, fechaDiaAnio, fechaCorta, deMesDia, el, datos, reducirMovimiento } from '../comun.js';
import { ruta } from '../app.js';
import { descargar } from '../ficha.js';
import { armarBuscador } from '../buscador.js';

const DIAS_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MESES_CAL = 6; // de enero a junio
const INICIO_MES = DIAS_MES.reduce((a, d) => [...a, a[a.length - 1] + d], [0]); // día del año (base 0) en que empieza cada mes
const YUC = { x: 297, y: 26, width: 416, height: 309 }; // Yucatán sin el arrecife Alacranes
const CORTES = [5, 20, 100, 400]; // clases del almanaque: 0, menos de 5, 5 a 19, 20 a 99, 100 a 399, 400 o más
const ESTADOS = ['Yucatán', 'Campeche', 'Quintana Roo'];

const diaDelAnio = (md) => INICIO_MES[Number(md.slice(0, 2)) - 1] + Number(md.slice(3)) - 1;
const fechaDe = (i) => new Date(2026, 0, 1 + i, 12);
const mayuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const clase = (v) => (v <= 0 ? 0 : 1 + CORTES.filter((c) => v >= c).length);
const csvCampo = (s) => (/[",\r\n]/.test(String(s)) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s));

const PLANTILLA = `
<article class="fechas">
  <section class="fz" aria-labelledby="zTitular">
    <div class="fz-cabeza">
      <div class="fz-elegir"><label for="zona" data-t="zZona"></label><select id="zona"></select></div>
      <div class="buscador claro fz-buscar" id="zBuscar"></div>
      <p class="fz-mizona" id="zMiZona" aria-live="polite"></p>
      <h1 id="zTitular"></h1>
      <p class="fz-nota" data-t="defFoco"></p>
      <p id="zSeder"></p>
      <p id="zInferidos" class="fz-nota"></p>
      <p class="fz-nota" data-t="zNota"></p>
    </div>
    <div class="fz-cal" id="zCal">
      <div class="fz-ley" id="zLey"></div>
      <div class="fz-meses" id="zMeses"></div>
      <p class="fz-lectura" id="zLectura" aria-live="polite"></p>
    </div>
    <div class="fz-lado-mapa">
      <div class="fz-mapa" id="zMapa" role="img"><svg aria-hidden="true"></svg></div>
      <p class="fz-pista" data-t="zMapaPista"></p>
    </div>
  </section>
  <section class="alm" aria-labelledby="almTitulo">
    <h2 id="almTitulo" data-t="fechasPagina"></h2>
    <p class="alm-sub" data-t="almSub"></p>
    <div class="alm-controles">
      <div class="alm-buscar"><label for="almBuscar" data-t="almBuscar"></label><input id="almBuscar" type="search" autocomplete="off" data-t-ph="buscaPh"></div>
      <div class="alm-grupo" role="group" aria-labelledby="almEstadoT"><span id="almEstadoT" data-t="almEstado"></span><div class="alm-botones" id="almEstados"></div></div>
      <div class="alm-grupo" role="group" aria-labelledby="almMostrarT"><span id="almMostrarT" data-t="almMostrar"></span><div class="alm-botones"><button type="button" data-anio="normal" data-t="almNormal"></button><button type="button" data-anio="2026">2026</button></div></div>
    </div>
    <div class="alm-ley" id="almLey"></div>
    <div class="alm-pie"><p id="almConteo"></p><button type="button" class="b-borde" id="almCsv" data-t="almCsv"></button></div>
    <table class="alm-tabla" id="almanaque">
      <colgroup><col class="nombre"></colgroup>
      <thead><tr id="almCab"></tr></thead>
      <tbody id="almCuerpo"></tbody>
    </table>
    <p class="alm-vacio" id="almVacio" data-t="almVacio" hidden></p>
  </section>
  <p class="pie" id="pie"></p>
</article>`;

export function montar(raiz, params) {
  let Z = null, lista = null, F = null, P = null, vivo = true;
  const estado = { zona: params.zona || '2', q: '', e: '', anio: 'normal', fijo: null, mio: null };
  const $ = (s) => raiz.querySelector('#' + s);

  const zonaDe = (n) => Z.zonas.find((z) => z.n === n);
  const deZona = (n) => lista.filter((m) => m.zona === 'Yucatán ' + n);

  // ---------- Calendario de la zona ----------
  function titular(z) {
    const fuera = z.tot - z.dentro;
    const k = z.tot > 0 ? Math.round((fuera / z.tot) * 10) : 0;
    if (k >= 10 && fuera < z.tot) return t('zTitularCasiTodos', { z: z.n });
    if (k <= 0 && fuera > 0) return t('zTitularCasiNinguno', { z: z.n });
    return t('zTitular', { z: z.n, k });
  }

  function notaMes(z, m) {
    const s = INICIO_MES[m], e = s + DIAS_MES[m] - 1;
    const a = Math.max(z.ini, s), b = Math.min(z.fin, e);
    if (a > b) return '';
    if (a === s && b === e) return t('zMesTodo');
    if (a === s) return t('zMesHasta', { d: b - s + 1 });
    if (b === e) return t('zMesDesde', { d: a - s + 1 });
    return t('zMesDelAl', { a: a - s + 1, b: b - s + 1 });
  }

  function leyenda(z, tope) {
    const ley = $('zLey');
    ley.textContent = '';
    const p = document.createElement('span');
    const muestra = document.createElement('span'); muestra.className = 'fz-muestra'; muestra.setAttribute('aria-hidden', 'true');
    muestra.textContent = String(fechaDe(z.ini).getDate());
    p.append(muestra, t('zLeyPermitido'));
    const f = document.createElement('span');
    f.append(t('zLeyFuego'));
    for (const v of tope > 10 ? [1, 10, tope] : [1, tope]) {
      const s = document.createElement('span'); s.className = 'fz-ley-punto';
      const i = document.createElement('i'); i.className = 'fz-punto';
      const d = diametro(v, tope); i.style.width = i.style.height = d + 'px';
      s.append(i, v === tope ? t('zLeyFocos', { n: fmt(v) }) : fmt(v));
      f.appendChild(s);
    }
    ley.append(p, f);
    // Solo mientras la temporada no termina: hay días del calendario que aún no pasan.
    if (Z.ultimo < INICIO_MES[MESES_CAL] - 1) {
      const fu = document.createElement('span');
      const n = document.createElement('span'); n.className = 'fz-muestra futuro'; n.setAttribute('aria-hidden', 'true'); n.textContent = '9';
      fu.append(n, t('zLeyFuturo'));
      ley.appendChild(fu);
    }
  }

  const diametro = (v, tope) => (v > 0 ? Math.max(4, Math.round(15 * Math.sqrt(v / tope))) : 0);

  function calendario() {
    const z = zonaDe(estado.zona);
    const tope = Math.max(...z.dias, 1);
    leyenda(z, tope);
    const meses = $('zMeses');
    meses.textContent = '';
    const nombres = t('meses');
    for (let m = 0; m < MESES_CAL; m++) {
      const caja = document.createElement('div');
      caja.className = 'fz-mes';
      const total = z.dias.slice(INICIO_MES[m], INICIO_MES[m + 1]).reduce((a, v) => a + v, 0);
      const nota = notaMes(z, m);
      // El nombre del mes es un encabezado que se puede recorrer; los días van como una imagen con su resumen.
      const cab = document.createElement('div'); cab.className = 'fz-mes-cab';
      const h = document.createElement('h2'); h.textContent = mayuscula(nombres[m]);
      const n = document.createElement('span'); n.textContent = nota;
      cab.append(h, n);
      const sem = document.createElement('div'); sem.className = 'fz-semana';
      for (const d of t('zSemana')) { const s = document.createElement('span'); s.textContent = d; sem.appendChild(s); }
      const dias = document.createElement('div'); dias.className = 'fz-dias';
      const hueco = (new Date(2026, m, 1).getDay() + 6) % 7;
      for (let k = 0; k < hueco; k++) dias.appendChild(document.createElement('span'));
      for (let d = 1; d <= DIAS_MES[m]; d++) {
        const i = INICIO_MES[m] + d - 1;
        const s = document.createElement('span');
        s.className = 'fz-dia' + (i >= z.ini && i <= z.fin ? ' permitido' : '') + (i > Z.ultimo ? ' futuro' : '') + (estado.fijo === i ? ' activo' : '');
        s.dataset.i = i;
        const b = document.createElement('b'); b.textContent = d;
        s.appendChild(b);
        const v = i > Z.ultimo ? 0 : z.dias[i];
        if (v > 0) { const p = document.createElement('i'); p.style.width = p.style.height = diametro(v, tope) + 'px'; s.appendChild(p); }
        dias.appendChild(s);
      }
      const cuadro = document.createElement('div');
      cuadro.setAttribute('role', 'img');
      cuadro.setAttribute('aria-label', t('zMesAria', { m: mayuscula(nombres[m]), n: fmt(total) }));
      cuadro.append(sem, dias);
      caja.append(cab, cuadro);
      meses.appendChild(caja);
    }
    $('zCal').setAttribute('aria-label', t('zCalAria', { z: z.n }));
    leer(estado.fijo);
  }

  function leer(i) {
    const lectura = $('zLectura');
    if (i === null || i === undefined) { lectura.textContent = t('zPista'); lectura.classList.add('pista'); return; }
    const z = zonaDe(estado.zona);
    const f = fechaDia(fechaDe(i));
    const v = Math.round(z.dias[i]);
    const cuanto = v === 0 ? t('zDiaCero', { f }) : v === 1 ? t('zDiaUno', { f }) : t('zDia', { f, n: fmt(v) });
    lectura.textContent = cuanto + ' ' + (i >= z.ini && i <= z.fin ? t('zDentro') : t('zFuera'));
    lectura.classList.remove('pista');
  }

  function cabeza() {
    const z = zonaDe(estado.zona);
    const sel = $('zona');
    sel.textContent = '';
    t('zNombres').forEach((nombre, k) => {
      const o = document.createElement('option');
      o.value = String(k + 1);
      o.textContent = t('zOpcion', { z: nombre, n: zonaDe(String(k + 1)).municipios });
      sel.appendChild(o);
    });
    sel.value = estado.zona;
    $('zTitular').textContent = titular(z);
    $('zSeder').textContent = t('zSeder', {
      i: fechaDia(deMesDia(z.ventana.inicio)), f: fechaDia(deMesDia(z.ventana.fin)),
      a: fmt(z.antes), d: fmt(z.dentro), p: fmt(z.despues),
    });
    const inferidos = deZona(estado.zona).filter((m) => m.zona_inferida).map((m) => m.nombre);
    const inf = $('zInferidos');
    inf.hidden = !inferidos.length;
    if (inferidos.length) {
      const nombres = inferidos.length > 1 ? inferidos.slice(0, -1).join(', ') + t('y') + inferidos[inferidos.length - 1] : inferidos[0];
      inf.textContent = t(inferidos.length > 1 ? 'zInferidosVarios' : 'zInferidos', { m: nombres });
    }
    miZona();
  }

  function mapa() {
    const caja = $('zMapa'), svg = caja.querySelector('svg');
    svg.textContent = '';
    caja.querySelectorAll('.fz-etq').forEach((s) => s.remove());
    svg.setAttribute('viewBox', [YUC.x, YUC.y, YUC.width, YUC.height].join(' '));
    const zonaPorId = new Map(lista.filter((m) => m.estado === 'Yucatán').map((m) => [m.id, m.zona.replace(/^\D+/, '')]));
    const yuc = P.mun.filter((m) => zonaPorId.has(m.id));
    for (const m of yuc) {
      const z = zonaPorId.get(m.id);
      el('path', { d: m.d, 'data-id': m.id, 'data-zona': z, class: z === estado.zona ? 'en-zona' : '' }, svg);
    }
    // Cada zona lleva su nombre en el municipio más cercano a su centro.
    for (const n of ['1', '2', '3', '4']) {
      const de = yuc.filter((m) => zonaPorId.get(m.id) === n);
      const cx = de.reduce((a, m) => a + m.cx, 0) / de.length, cy = de.reduce((a, m) => a + m.cy, 0) / de.length;
      const c = de.reduce((a, m) => (Math.hypot(m.cx - cx, m.cy - cy) < Math.hypot(a.cx - cx, a.cy - cy) ? m : a));
      const s = document.createElement('span');
      s.className = 'fz-etq' + (n === estado.zona ? ' actual' : '');
      s.style.left = (((c.cx - YUC.x) / YUC.width) * 100).toFixed(1) + '%';
      s.style.top = (((c.cy - YUC.y) / YUC.height) * 100).toFixed(1) + '%';
      s.textContent = t('zMapaZona', { z: n });
      caja.appendChild(s);
    }
    caja.setAttribute('aria-label', t('zMapaAria', { z: estado.zona }));
  }

  // «¿Cuál es mi zona?»: el comisario escribe su municipio y la página elige su zona.
  function buscadorZona() {
    const yuc = lista.filter((m) => m.estado === 'Yucatán');
    armarBuscador($('zBuscar'), 3, {
      etiqueta: 'zBuscaLabel',
      municipios: yuc.map((m) => ({ id: m.id, n: m.nombre, e: t('zMapaZona', { z: m.zona.replace(/^\D+/, '') }) })),
      alElegir: (x) => {
        const m = yuc.find((y) => y.id === x.id);
        const z = m.zona.replace(/^\D+/, '');
        estado.mio = { n: m.nombre, z, probable: m.zona_inferida };
        elegirZona(z);
      },
    });
  }

  function miZona() {
    const p = $('zMiZona'), m = estado.mio;
    p.hidden = !m || m.z !== estado.zona;
    if (!p.hidden) p.textContent = t(m.probable ? 'zMiZonaProbable' : 'zMiZona', { m: m.n, z: m.z });
  }

  function elegirZona(n, { mover = false } = {}) {
    if (!/^[1-4]$/.test(n)) return;
    estado.zona = n;
    estado.fijo = null;
    history.replaceState(null, '', '#/fechas/' + n);
    cabeza();
    calendario();
    mapa();
    if (mover) {
      $('zTitular').scrollIntoView({ behavior: reducirMovimiento() ? 'auto' : 'smooth', block: 'start' });
      $('zona').focus({ preventScroll: true });
    }
  }

  // ---------- Almanaque ----------
  function ventanaEnMes(r, m) {
    if (!r.ventana) return null;
    const ini = diaDelAnio(r.ventana.inicio), fin = diaDelAnio(r.ventana.fin);
    const s = INICIO_MES[m], e = s + DIAS_MES[m] - 1;
    const a = Math.max(ini, s), b = Math.min(fin, e);
    if (a > b) return null;
    // Si la ventana sigue en el mes de al lado, la raya cruza el hueco entre cuadros.
    return { left: a === s && ini < s ? '-2px' : (((a - s) / DIAS_MES[m]) * 100).toFixed(1) + '%',
             right: b === e && fin > e ? '-2px' : (((e - b) / DIAS_MES[m]) * 100).toFixed(1) + '%' };
  }

  function cabeceraAlmanaque() {
    const cab = $('almCab');
    cab.textContent = '';
    const th = document.createElement('th'); th.scope = 'col'; th.textContent = t('almMunicipio');
    cab.appendChild(th);
    const col = raiz.querySelector('colgroup');
    col.querySelectorAll('col.m').forEach((c) => c.remove());
    t('mesesCortos').forEach((m) => {
      const c = document.createElement('col'); c.className = 'm'; col.appendChild(c);
      const h = document.createElement('th'); h.scope = 'col';
      const largo = document.createElement('span'); largo.className = 'largo'; largo.textContent = m;
      const corto = document.createElement('span'); corto.className = 'corto'; corto.setAttribute('aria-hidden', 'true'); corto.textContent = m.charAt(0).toUpperCase();
      h.append(largo, corto);
      cab.appendChild(h);
    });
  }

  function renglones() {
    const cuerpo = $('almCuerpo');
    cuerpo.textContent = '';
    const meses = t('meses');
    for (const r of F) {
      const tr = document.createElement('tr');
      tr.dataset.id = r.id;
      tr.dataset.e = r.e;
      const th = document.createElement('th'); th.scope = 'row';
      const a = document.createElement('a'); a.href = '#/municipio/' + r.id; a.textContent = r.n;
      const linea = document.createElement('span'); linea.className = 'a-linea';
      if (r.ventana) {
        const z = r.zona.replace(/^\D+/, '');
        const b = document.createElement('button'); b.type = 'button'; b.className = 'a-zona';
        b.dataset.zona = z; b.textContent = t('zMapaZona', { z }); b.setAttribute('aria-label', t('almZonaAria', { z }));
        const rango = t('rango', { i: fechaCorta(deMesDia(r.ventana.inicio)), f: fechaCorta(deMesDia(r.ventana.fin)) });
        linea.append(b, (r.inferida ? t('almProbable') : '') + t('almRango', { r: rango }));
      } else linea.textContent = t('almSinZona', { e: r.e });
      th.append(a, linea);
      tr.appendChild(th);
      const valores = estado.anio === '2026' ? r.meses26 : r.meses;
      valores.forEach((v, m) => {
        const td = document.createElement('td');
        td.className = 'mes';
        td.title = t(estado.anio === '2026' ? 'almCelda26' : 'almCelda', { m: r.n, mes: meses[m], n: fmt(v) });
        const f = document.createElement('b'); f.className = 'f c' + clase(v);
        const sr = document.createElement('span'); sr.className = 'sr'; sr.textContent = fmt(v);
        td.append(f, sr);
        const vm = ventanaEnMes(r, m);
        if (vm) { const i = document.createElement('i'); i.className = 'v'; i.style.left = vm.left; i.style.right = vm.right; td.appendChild(i); }
        tr.appendChild(td);
      });
      cuerpo.appendChild(tr);
    }
    filtrar();
  }

  function leyendaAlmanaque() {
    const ley = $('almLey');
    ley.textContent = '';
    ley.append(t('almLeyenda'));
    t('almClases').forEach((nombre, k) => {
      const s = document.createElement('span');
      const i = document.createElement('i'); i.className = 'c' + k; i.setAttribute('aria-hidden', 'true');
      s.append(i, nombre);
      ley.appendChild(s);
    });
    const v = document.createElement('span');
    const i = document.createElement('i'); i.className = 'v-muestra'; i.setAttribute('aria-hidden', 'true');
    v.append(i, t('almLeyVentana'));
    ley.appendChild(v);
  }

  function botonesEstado() {
    const cont = $('almEstados');
    cont.textContent = '';
    for (const e of ['', ...ESTADOS]) {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.estado = e; b.textContent = e || t('almTodos');
      b.setAttribute('aria-pressed', String(estado.e === e));
      cont.appendChild(b);
    }
    raiz.querySelectorAll('[data-anio]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.anio === estado.anio)));
  }

  const visibles = () => F.filter((r) => (!estado.e || r.e === estado.e) && (!estado.q || sinAcentos(r.n).includes(estado.q)));

  function filtrar() {
    const ver = new Set(visibles().map((r) => r.id));
    $('almCuerpo').querySelectorAll('tr').forEach((tr) => { tr.hidden = !ver.has(tr.dataset.id); });
    $('almVacio').hidden = ver.size > 0;
    $('almConteo').textContent = t('almConteo', { n: ver.size, t: F.length });
  }

  function csv() {
    const m = t('almCsvMeses');
    const filas = [[t('almCsvBase'), ...m.map((x) => x + '_normal'), ...m.map((x) => x + '_2026')].join(',')];
    for (const r of visibles()) {
      const v = r.ventana;
      filas.push([csvCampo(r.n), csvCampo(r.e), r.ventana ? r.zona.replace(/^\D+/, '') : '',
        v ? '2026-' + v.inicio : '', v ? '2026-' + v.fin : '', ...r.meses, ...r.meses26].join(','));
    }
    return new Blob(['﻿' + filas.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
  }

  // ---------- Todo junto ----------
  function pintar() {
    traducir(raiz);
    document.title = t('navFechas') + " — K'áak'";
    buscadorZona();
    cabeza();
    calendario();
    mapa();
    botonesEstado();
    leyendaAlmanaque();
    cabeceraAlmanaque();
    renglones();
    $('pie').textContent = t('fechasPie', { f: fechaDiaAnio(Z.actualizado) });
  }

  function escuchar() {
    $('zona').addEventListener('change', (e) => elegirZona(e.target.value));
    const meses = $('zMeses');
    meses.addEventListener('pointerover', (e) => {
      const d = e.target.closest('.fz-dia');
      if (d && e.pointerType === 'mouse') leer(Number(d.dataset.i));
    });
    meses.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') leer(estado.fijo); });
    meses.addEventListener('click', (e) => {
      const d = e.target.closest('.fz-dia');
      if (!d) return;
      const i = Number(d.dataset.i);
      estado.fijo = estado.fijo === i ? null : i;
      meses.querySelectorAll('.fz-dia.activo').forEach((x) => x.classList.remove('activo'));
      if (estado.fijo !== null) d.classList.add('activo');
      leer(estado.fijo ?? i);
    });
    $('zMapa').addEventListener('click', (e) => {
      const p = e.target.closest('path[data-zona]');
      if (p) elegirZona(p.dataset.zona);
    });
    $('almBuscar').addEventListener('input', (e) => { estado.q = sinAcentos(e.target.value.trim()); filtrar(); });
    raiz.querySelector('.alm-controles').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.estado !== undefined) { estado.e = b.dataset.estado; botonesEstado(); filtrar(); }
      if (b.dataset.anio && b.dataset.anio !== estado.anio) { estado.anio = b.dataset.anio; botonesEstado(); renglones(); }
    });
    $('almCuerpo').addEventListener('click', (e) => {
      const b = e.target.closest('.a-zona');
      if (b) elegirZona(b.dataset.zona, { mover: true });
    });
    $('almCsv').addEventListener('click', () => descargar(csv(), 'fechas.csv'));
  }

  async function arrancar() {
    try {
      [Z, lista, F, P] = await Promise.all([datos('zonas.json'), datos('municipios.json'), datos('fechas.json'), datos('portada.json')]);
      // Yucatán primero: es el estado con fechas permitidas.
      F = [...F].sort((a, b) => ESTADOS.indexOf(a.e) - ESTADOS.indexOf(b.e) || a.n.localeCompare(b.n, 'es'));
    } catch {
      if (!vivo) return;
      raiz.innerHTML = '<p class="aviso-error"></p>';
      raiz.firstChild.textContent = t('errorDatos');
      return;
    }
    if (!vivo) return;
    raiz.innerHTML = PLANTILLA;
    pintar();
    escuchar();
  }

  arrancar();
  const alIdioma = () => { if (Z && $('zona')) pintar(); };
  // El botón «atrás» o un enlace a otra zona cambian el ancla sin volver a montar la vista.
  const alAncla = () => { const r = ruta(); if (r.vista === 'fechas' && Z && $('zona') && r.params.zona !== estado.zona) elegirZona(r.params.zona); };
  window.addEventListener('idioma', alIdioma);
  window.addEventListener('hashchange', alAncla);
  return () => { vivo = false; window.removeEventListener('idioma', alIdioma); window.removeEventListener('hashchange', alAncla); };
}
