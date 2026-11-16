// Fechas de quema (#/fechas[/<zona>]): ¿se quemó cuando se podía? Arriba, la afirmación de la zona con su
// prueba de 26 años y el mapa para elegir otra; después, el calendario día por día y el de cada municipio por mes.
// El calendario cubre de enero a junio, igual que la tira de la portada: las dos dicen la misma cifra.
import { t, traducir, idioma } from '../textos.js';
import { fmt, sinAcentos, fechaDia, fechaDiaAnio, fechaCorta, deMesDia, el, datos, reducirMovimiento, visita, pieDatos } from '../comun.js';
import { ruta } from '../app.js';
import { descargar } from '../ficha.js';
import { armarBuscador } from '../buscador.js';
import { tiraFuera } from '../graficas.js';

const DIAS_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MESES_CAL = 6; // de enero a junio
const INICIO_MES = DIAS_MES.reduce((a, d) => [...a, a[a.length - 1] + d], [0]); // día del año (base 0) en que empieza cada mes
const YUC = { x: 297, y: 26, width: 416, height: 309 }; // Yucatán sin el arrecife Alacranes
const CORTES = [5, 20, 100, 400]; // clases del almanaque: 0, menos de 5, 5 a 19, 20 a 99, 100 a 399, 400 o más
const ESTADOS = ['Yucatán', 'Campeche', 'Quintana Roo'];
const TOPE = 12; // renglones del almanaque antes de «Ver los demás»; al buscar se ven todos
// Dónde va el nombre de cada zona en el mapa (unidades del mapa). El centro de sus municipios dejaría la
// zona 3 encima de la 1 en el teléfono; estos puntos caen dentro de cada zona y lejos de las demás.
const ETIQUETA = { 1: [590, 198], 2: [398, 104], 3: [420, 240], 4: [618, 58] };

// Cuántos de cada 10, dicho del lado prudente: 0.684 es «6 de cada 10», no 7.
function parte(p) {
  if (p >= 0.95) return { caso: 'CasiTodos', k: 10 };
  if (p < 0.05) return { caso: 'CasiNinguno', k: 0 };
  if (p >= 0.45 && p <= 0.55) return { caso: 'Mitad', k: 5 };
  return { caso: '', k: Math.floor(p * 10 + 1e-9) };
}
// Si lo que queda fuera llega antes de que se abran las fechas o después de que cierran.
function cuando(antes, despues) {
  const fuera = antes + despues;
  if (fuera <= 0) return null;
  const d = despues / fuera;
  return d >= 0.9 ? 'CasiDespues' : d <= 0.1 ? 'CasiAntes' : d >= 0.6 ? 'Despues' : d <= 0.4 ? 'Antes' : 'Ambos';
}

const diaDelAnio = (md) => INICIO_MES[Number(md.slice(0, 2)) - 1] + Number(md.slice(3)) - 1;
const fechaDe = (i) => new Date(2026, 0, 1 + i, 12);
const mayuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const pegado = (s) => s.replace(/ /g, '\u00A0'); // «20 abr» no se parte en dos renglones
const clase = (v) => (v <= 0 ? 0 : 1 + CORTES.filter((c) => v >= c).length);
const csvCampo = (s) => (/[",\r\n]/.test(String(s)) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s));

const PLANTILLA = `
<article class="fechas">
  <section class="fz" aria-labelledby="zTitular">
    <div class="fz-afirma">
      <h1 id="zTitular"></h1>
      <p class="fz-patron" id="zPatron"></p>
    </div>
    <div class="fz-prueba">
      <p class="fz-tira-t" id="zTiraT" data-t="zTiraT"></p>
      <div class="fz-tira" id="zTiraCaja"><svg id="zTira"></svg></div>
      <p class="fz-tira-lee" id="zTiraLee" aria-hidden="true"></p>
      <p class="fz-nota" data-t="zTiraNota"></p>
      <p class="fz-aviso" data-t="zNota"></p>
    </div>
    <div class="fz-lado-mapa">
      <p class="fz-mapa-t" id="zMapaT" data-t="zMapaPista"></p>
      <div class="fz-mapa" id="zMapa">
        <svg aria-hidden="true"></svg>
        <div class="fz-zonas" id="zZonas" role="radiogroup" aria-labelledby="zMapaT"></div>
      </div>
      <div class="buscador claro fz-buscar" id="zBuscar"></div>
      <p class="fz-mizona" id="zMiZona" aria-live="polite"></p>
    </div>
  </section>
  <section class="fz-dia-a-dia" aria-labelledby="zCalT">
    <div class="fz-intro">
      <p class="fz-sec-t" id="zCalT" data-t="zCalT"></p>
      <p id="zSeder"></p>
      <p id="zInferidos" class="fz-nota"></p>
      <p class="fz-nota" data-t="defFoco"></p>
    </div>
    <div class="fz-cal" id="zCal" role="group">
      <div class="fz-ley" id="zLey"></div>
      <div class="fz-meses" id="zMeses"></div>
      <p class="fz-lectura" id="zLectura" aria-live="polite"></p>
    </div>
  </section>
  <section class="alm" aria-labelledby="almTitulo">
    <h2 id="almTitulo" data-t="fechasPagina"></h2>
    <p class="alm-sub" data-t="almSub"></p>
    <div class="alm-controles">
      <div class="alm-buscar"><label for="almBuscar" data-t="almBuscar"></label><input id="almBuscar" type="search" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" data-t-ph="buscaPh"></div>
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
    <button type="button" class="b-borde alm-mas" id="almMas" aria-controls="almanaque" hidden></button>
  </section>
  <p class="fz-sigue"><a href="#/metodo" data-t="fechasSigue"></a></p>
  <p class="pie" id="pie"></p>
</article>`;

export function montar(raiz, params) {
  let Z = null, lista = null, F = null, P = null, vivo = true;
  const observadores = [];
  const estado = { zona: params.zona || null, q: '', e: '', anio: 'normal', fijo: null, mio: null, todos: false };
  const $ = (s) => raiz.querySelector('#' + s);

  const zonaDe = (n) => Z.zonas.find((z) => z.n === n);
  const deZona = (n) => lista.filter((m) => m.zona === 'Yucatán ' + n);

  // ---------- Calendario de la zona ----------
  // Tras «casi todos» no se repite «casi todos»: se dice «sobre todo después».
  const cuandoClave = (pre, p, c) => (p.caso === 'CasiTodos' ? pre + 'SobreTodo' + c.replace('Casi', '') : pre + 'Cuando' + c);
  // La afirmación: cuántos focos de 2026 quedaron fuera de las fechas, dicho con el nombre del lugar.
  const lugar = (z) => (idioma() === 'en' ? z.lugarEn : z.lugar);
  const fueraDe = (v) => v[0] + v[2];
  function afirmacion(z) {
    const p = parte(fueraDe(z.porAnio['2026']));
    return t('zAfirma' + p.caso, { l: lugar(z), k: p.k });
  }
  // El patrón de siempre: cuántos quedan fuera en un año normal, cuándo llegan y el mínimo desde 2001.
  function patron(z) {
    const p = parte(fueraDe(z.tipico));
    const c = cuando(z.tipico[0], z.tipico[2]);
    const minimo = z.minFuera >= 0.5 ? t('zMinimo', { m: parte(z.minFuera).k }) : '';
    return t('zPatron' + p.caso, { k: p.k, cuando: c ? t(cuandoClave('z', p, c)) : '', min: minimo });
  }
  // Lectura de un año de la tira.
  function leerAnio(z, y) {
    const v = z.porAnio[String(y)];
    const p = parte(fueraDe(v));
    const c = cuando(v[0], v[2]);
    return t('zLee' + p.caso, { a: y, k: p.k, cuando: c ? t(cuandoClave('zLee', p, c)) : '' });
  }
  function tira() {
    const z = zonaDe(estado.zona);
    const anios = Object.keys(z.porAnio).map(Number).sort((a, b) => a - b).map((y) => ({ y, fuera: fueraDe(z.porAnio[y]) }));
    tiraFuera($('zTira'), {
      anios, normal: fueraDe(z.tipico), ancho: $('zTiraCaja').clientWidth,
      leer: (y) => leerAnio(z, y), lectura: $('zTiraLee'), aria: t('zTiraT'),
    });
  }

  function notaMes(z, m) {
    const s = INICIO_MES[m], e = s + DIAS_MES[m] - 1;
    const a = Math.max(z.ini, s), b = Math.min(z.fin, e);
    if (a > b) return '';
    const mes = t('mesesCortos')[m];
    // Terminación del número («the 20th», «the 3rd»): [otro, 1, 2, 3]; en español van vacías.
    const o = (d) => t('zOrdinal')[d % 10 <= 3 && (d < 11 || d > 13) ? d % 10 : 0];
    if (a === s && b === e) return t('zMesTodo');
    if (a === s) return t('zMesHasta', { d: b - s + 1, o: o(b - s + 1), m: mes });
    if (b === e) return t('zMesDesde', { d: a - s + 1, o: o(a - s + 1), m: mes });
    return t('zMesDelAl', { a: a - s + 1, b: b - s + 1, m: mes });
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
    const enTab = estado.fijo ?? (z.ini <= Z.ultimo ? z.ini : 0);
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
        // Cada día que ya pasó se alcanza con el teclado; una sola parada de Tab para todo el calendario.
        if (i <= Z.ultimo) {
          s.setAttribute('role', 'button');
          s.setAttribute('tabindex', i === enTab ? '0' : '-1');
          s.setAttribute('aria-pressed', String(estado.fijo === i));
          s.setAttribute('aria-label', lectura(z, i));
        }
        const b = document.createElement('b'); b.textContent = d; b.setAttribute('aria-hidden', 'true');
        s.appendChild(b);
        const v = i > Z.ultimo ? 0 : z.dias[i];
        if (v > 0) { const p = document.createElement('i'); p.style.width = p.style.height = diametro(v, tope) + 'px'; s.appendChild(p); }
        dias.appendChild(s);
      }
      const cuadro = document.createElement('div');
      cuadro.setAttribute('role', 'group');
      cuadro.setAttribute('aria-label', t('zMesAria', { m: mayuscula(nombres[m]), n: fmt(total) }));
      cuadro.append(sem, dias);
      caja.append(cab, cuadro);
      meses.appendChild(caja);
    }
    $('zCal').setAttribute('aria-label', t('zCalAria', { z: z.n }));
    leer(estado.fijo);
  }

  function lectura(z, i) {
    const f = fechaDia(fechaDe(i));
    const v = Math.round(z.dias[i]);
    const cuanto = v === 0 ? t('zDiaCero', { f }) : v === 1 ? t('zDiaUno', { f }) : t('zDia', { f, n: fmt(v) });
    return cuanto + ' ' + (i >= z.ini && i <= z.fin ? t('zDentro') : t('zFuera'));
  }
  function leer(i) {
    const caja = $('zLectura');
    if (i === null || i === undefined) { caja.textContent = t('zPista'); caja.classList.add('pista'); return; }
    caja.textContent = lectura(zonaDe(estado.zona), i);
    caja.classList.remove('pista');
  }

  function cabeza() {
    const z = zonaDe(estado.zona);
    $('zTitular').textContent = afirmacion(z);
    $('zPatron').textContent = patron(z);
    $('zSeder').textContent = t('zSeder', {
      z: z.n, i: fechaDia(deMesDia(z.ventana.inicio)), f: fechaDia(deMesDia(z.ventana.fin)),
      a: fmt(z.antes), d: fmt(z.dentro), p: fmt(z.despues),
    });
    const inferidos = deZona(estado.zona).filter((m) => m.zona_inferida).map((m) => m.nombre);
    const inf = $('zInferidos');
    inf.hidden = !inferidos.length;
    if (inferidos.length) {
      const nombres = inferidos.length > 1 ? inferidos.slice(0, -1).join(', ') + t('y') + inferidos[inferidos.length - 1] : inferidos[0];
      inf.textContent = t(inferidos.length > 1 ? 'zInferidosVarios' : 'zInferidos', { m: nombres });
    }
    tira();
    miZona();
  }

  // El mapa es el gesto de la página: cuatro zonas con su borde y su nombre, que se tocan o se recorren
  // con las flechas (un grupo de opciones). Cada zona se dibuja con sus municipios y se encoge un poco con
  // un filtro: así entre zona y zona queda una línea blanca, sin calcular la unión de los contornos.
  function mapa() {
    const caja = $('zMapa'), svg = caja.querySelector('svg');
    svg.textContent = '';
    svg.setAttribute('viewBox', [YUC.x, YUC.y, YUC.width, YUC.height].join(' '));
    const filtro = el('filter', { id: 'fzBorde', x: '-2%', y: '-2%', width: '104%', height: '104%' }, el('defs', {}, svg));
    el('feMorphology', { operator: 'erode', radius: 1.6 }, filtro);
    const zonaPorId = new Map(lista.filter((m) => m.estado === 'Yucatán').map((m) => [m.id, m.zona.replace(/^\D+/, '')]));
    const yuc = P.mun.filter((m) => zonaPorId.has(m.id));
    for (const n of ['1', '2', '3', '4']) {
      const g = el('g', { class: 'fz-zona' + (n === estado.zona ? ' en-zona' : ''), 'data-zona': n, filter: 'url(#fzBorde)' }, svg);
      for (const m of yuc) if (zonaPorId.get(m.id) === n) el('path', { d: m.d }, g);
    }
    // Encima, los municipios: una línea tenue para ubicarse sin partir la zona, y lo que recibe el puntero
    // (Chrome no siempre acierta al tocar un grupo con filtro mientras cambia de color).
    const lineas = el('g', { class: 'fz-municipios' }, svg);
    for (const m of yuc) el('path', { d: m.d, 'data-id': m.id, 'data-zona': zonaPorId.get(m.id), class: zonaPorId.get(m.id) === estado.zona ? 'en-zona' : '' }, lineas);
    const grupo = $('zZonas');
    grupo.textContent = '';
    t('zNombres').forEach((nombre, k) => {
      const n = String(k + 1), z = zonaDe(n);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'fz-etq';
      b.dataset.zona = n;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(n === estado.zona));
      b.setAttribute('tabindex', n === estado.zona ? '0' : '-1');
      b.setAttribute('aria-label', t('zZonaAria', { z: n, l: lugar(z), n: z.municipios }));
      const [x, y] = ETIQUETA[n];
      b.style.left = (((x - YUC.x) / YUC.width) * 100).toFixed(1) + '%';
      b.style.top = (((y - YUC.y) / YUC.height) * 100).toFixed(1) + '%';
      const num = document.createElement('b'); num.textContent = n;
      b.append(num, nombre);
      grupo.appendChild(b);
    });
  }

  // El puntero sobre una zona la resalta entera, en el mapa y en su nombre.
  function resaltar(n) {
    $('zMapa').querySelectorAll('.fz-zona').forEach((g) => g.classList.toggle('encima', g.dataset.zona === n && n !== estado.zona));
    $('zZonas').querySelectorAll('.fz-etq').forEach((b) => b.classList.toggle('encima', b.dataset.zona === n));
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

  function elegirZona(n, { mover = false, enfocar = false } = {}) {
    if (!/^[1-4]$/.test(n)) return;
    estado.zona = n;
    estado.fijo = null;
    history.replaceState(null, '', '#/fechas/' + n);
    cabeza();
    calendario();
    mapa();
    const opcion = $('zZonas').querySelector('[data-zona="' + n + '"]');
    if (enfocar) opcion.focus();
    if (mover) {
      $('zTitular').scrollIntoView({ behavior: reducirMovimiento() ? 'auto' : 'smooth', block: 'start' });
      opcion.focus({ preventScroll: true });
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

  // El corte de 2026 es el día del último foco (el mismo del pie). Los meses que siguen todavía no
  // llegan y van en blanco; el mes del corte va marcado «en curso» si no ha terminado.
  function corte26() {
    const fecha = new Date(Z.actualizado + 'T12:00:00');
    const mes = fecha.getMonth();
    const fin = new Date(fecha.getFullYear(), mes + 1, 0).getDate();
    return { fecha, mes, enCurso: fecha.getDate() < fin ? mes : -1 };
  }

  function renglones() {
    const cuerpo = $('almCuerpo');
    cuerpo.textContent = '';
    const meses = t('meses');
    const C = corte26(), es26 = estado.anio === '2026';
    $('almLeyParcial').hidden = !(es26 && C.enCurso >= 0);
    for (const r of F) {
      const tr = document.createElement('tr');
      tr.dataset.id = r.id;
      tr.dataset.e = r.e;
      const th = document.createElement('th'); th.scope = 'row';
      // El nombre lleva a la página del municipio (con su flecha) y la zona sube a su calendario.
      const a = document.createElement('a'); a.href = '#/municipio/' + r.id;
      const flecha = document.createElement('span'); flecha.className = 'a-flecha'; flecha.setAttribute('aria-hidden', 'true'); flecha.textContent = '→';
      a.append(r.n, flecha);
      const linea = document.createElement('span'); linea.className = 'a-linea';
      if (r.ventana) {
        const z = r.zona.replace(/^\D+/, '');
        const b = document.createElement('button'); b.type = 'button'; b.className = 'a-zona';
        b.dataset.zona = z; b.setAttribute('aria-label', t('almZonaAria', { z }));
        const sube = document.createElement('span'); sube.setAttribute('aria-hidden', 'true'); sube.textContent = '↑';
        b.append(t('zMapaZona', { z }), sube);
        const fechas = document.createElement('span'); fechas.className = 'a-fechas';
        // Las fechas no se parten: «del 20 abr al 31 may» va entero en su renglón.
        fechas.textContent = t('almRango', { r: pegado(t('almRangoFechas', { i: fechaCorta(deMesDia(r.ventana.inicio)), f: fechaCorta(deMesDia(r.ventana.fin)) })) });
        linea.append(b, r.inferida ? t('almProbable') : '', fechas);
      } else linea.textContent = t('almSinZona', { e: r.e });
      th.append(a, linea);
      tr.appendChild(th);
      const valores = estado.anio === '2026' ? r.meses26 : r.meses;
      valores.forEach((v, m) => {
        const td = document.createElement('td');
        td.className = 'mes';
        const sr = document.createElement('span'); sr.className = 'sr';
        if (es26 && m > C.mes) {
          td.classList.add('futuro');
          td.title = t('almCelda26Futuro', { m: r.n, mes: meses[m] });
          sr.textContent = t('almFuturo');
          td.append(sr);
        } else {
          const parcial = es26 && m === C.enCurso;
          td.title = parcial ? t('almCelda26Parcial', { m: r.n, mes: meses[m], n: fmt(v), d: fechaDia(C.fecha) })
            : t(es26 ? 'almCelda26' : 'almCelda', { m: r.n, mes: meses[m], n: fmt(v) });
          const f = document.createElement('b'); f.className = 'f a-c' + clase(v) + (parcial ? ' parcial' : '');
          sr.textContent = fmt(v);
          td.append(f, sr);
        }
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
    const pasos = document.createElement('span'); pasos.className = 'alm-pasos';
    t('almClases').forEach((nombre, k) => {
      const s = document.createElement('span');
      const i = document.createElement('i'); i.className = 'a-c' + k; i.setAttribute('aria-hidden', 'true');
      s.append(i, nombre);
      pasos.appendChild(s);
    });
    // La muestra de la raya es un cuadro con su raya debajo, igual que en la tabla.
    const v = document.createElement('span'); v.className = 'alm-ley-v';
    const i = document.createElement('i'); i.className = 'v-muestra'; i.setAttribute('aria-hidden', 'true');
    v.append(i, t('almLeyVentana'));
    // El mes en curso de 2026 (solo con «2026» y si el mes no ha terminado).
    const C = corte26();
    const p = document.createElement('span'); p.id = 'almLeyParcial'; p.className = 'alm-ley-v';
    const ip = document.createElement('i'); ip.className = 'a-c2 parcial'; ip.setAttribute('aria-hidden', 'true');
    p.append(ip, t('almLeyParcial', { d: fechaDia(C.fecha) }));
    p.hidden = !(estado.anio === '2026' && C.enCurso >= 0);
    ley.append(pasos, v, p);
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

  // De entrada se ven los primeros renglones; al buscar, todos los que coinciden.
  function filtrar() {
    const coinciden = visibles();
    const corta = !estado.q && !estado.todos;
    const ver = new Set((corta ? coinciden.slice(0, TOPE) : coinciden).map((r) => r.id));
    $('almCuerpo').querySelectorAll('tr').forEach((tr) => { tr.hidden = !ver.has(tr.dataset.id); });
    $('almVacio').hidden = ver.size > 0;
    $('almConteo').textContent = t('almConteo', { n: ver.size, t: F.length });
    const mas = $('almMas');
    mas.hidden = !!estado.q || coinciden.length <= TOPE;
    mas.textContent = estado.todos ? t('almMenos') : t('almMas', { n: coinciden.length - TOPE });
    mas.setAttribute('aria-expanded', String(estado.todos));
  }

  function csv() {
    const m = t('almCsvMeses'), C = corte26();
    const filas = [[t('almCsvBase'), ...m.map((x) => x + '_normal'), ...m.map((x) => x + '_2026')].join(',')];
    for (const r of visibles()) {
      const v = r.ventana;
      filas.push([csvCampo(r.n), csvCampo(r.e), r.ventana ? r.zona.replace(/^\D+/, '') : '',
        v ? '2026-' + v.inicio : '', v ? '2026-' + v.fin : '', ...r.meses, ...r.meses26.map((x, m) => (m > C.mes ? '' : x))].join(','));
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
    $('pie').textContent = pieDatos('fechasPie', { f: fechaDiaAnio(Z.actualizado) });
  }

  function escuchar() {
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
      meses.querySelectorAll('.fz-dia.activo').forEach((x) => { x.classList.remove('activo'); x.setAttribute('aria-pressed', 'false'); });
      if (estado.fijo !== null) { d.classList.add('activo'); d.setAttribute('aria-pressed', 'true'); }
      leer(estado.fijo ?? i);
    });
    // Teclado: las flechas recorren los días (arriba y abajo, por semana) y Enter fija uno.
    meses.addEventListener('focusin', (e) => { const d = e.target.closest('.fz-dia'); if (d) leer(Number(d.dataset.i)); });
    meses.addEventListener('focusout', (e) => { if (!meses.contains(e.relatedTarget)) leer(estado.fijo); });
    meses.addEventListener('keydown', (e) => {
      const d = e.target.closest('.fz-dia[tabindex]');
      if (!d) return;
      const i = Number(d.dataset.i);
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); d.click(); return; }
      const a = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + 7, ArrowUp: i - 7, Home: 0, End: Z.ultimo }[e.key];
      if (a === undefined) return;
      e.preventDefault();
      const destino = meses.querySelector('.fz-dia[data-i="' + Math.max(0, Math.min(Z.ultimo, a)) + '"]');
      if (!destino) return;
      d.setAttribute('tabindex', '-1');
      destino.setAttribute('tabindex', '0');
      destino.focus();
    });
    const mapaCaja = $('zMapa');
    mapaCaja.addEventListener('click', (e) => {
      const p = e.target.closest('path[data-zona], .fz-etq');
      if (p && p.dataset.zona !== estado.zona) elegirZona(p.dataset.zona, { enfocar: p.matches('.fz-etq') });
    });
    mapaCaja.addEventListener('pointerover', (e) => { const p = e.target.closest('[data-zona]'); resaltar(p ? p.dataset.zona : null); });
    mapaCaja.addEventListener('pointerleave', () => resaltar(null));
    // Flechas: como cualquier grupo de opciones, eligen la zona de al lado y se quedan en ella.
    $('zZonas').addEventListener('keydown', (e) => {
      const paso = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!paso) return;
      e.preventDefault();
      elegirZona(String(((Number(estado.zona) - 1 + paso + 4) % 4) + 1), { enfocar: true });
    });
    // La tira se dibuja al ancho de su caja: se vuelve a dibujar si la caja cambia de ancho.
    let anchoTira = $('zTiraCaja').clientWidth;
    const obs = new ResizeObserver(() => { const w = $('zTiraCaja')?.clientWidth; if (w && w !== anchoTira) { anchoTira = w; tira(); } });
    obs.observe($('zTiraCaja'));
    observadores.push(obs);
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
    $('almMas').addEventListener('click', () => {
      estado.todos = !estado.todos;
      filtrar();
      // Al cerrar, la tabla se encoge: el botón se trae de vuelta a la vista.
      if (!estado.todos) $('almMas').scrollIntoView({ block: 'nearest', behavior: reducirMovimiento() ? 'auto' : 'smooth' });
    });
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
    // Sin zona en la dirección: la del municipio que se venía viendo y, si no, la de más fuego este año.
    if (!estado.zona) {
      const m = lista.find((x) => x.id === visita.municipio && x.estado === 'Yucatán');
      if (m) {
        estado.zona = m.zona.replace(/^\D+/, '');
        estado.mio = { n: m.nombre, z: estado.zona, probable: m.zona_inferida };
      } else estado.zona = Z.zonas.reduce((a, b) => (b.tot > a.tot ? b : a)).n;
    }
    raiz.innerHTML = PLANTILLA;
    pintar();
    escuchar();
  }

  arrancar();
  const alIdioma = () => { if (Z && $('zZonas')) pintar(); };
  // El botón «atrás» o un enlace a otra zona cambian el ancla sin volver a montar la vista.
  const alAncla = () => { const r = ruta(); if (r.vista === 'fechas' && Z && $('zZonas') && r.params.zona !== estado.zona) elegirZona(r.params.zona); };
  window.addEventListener('idioma', alIdioma);
  window.addEventListener('hashchange', alAncla);
  return () => { vivo = false; observadores.forEach((o) => o.disconnect()); window.removeEventListener('idioma', alIdioma); window.removeEventListener('hashchange', alAncla); };
}
