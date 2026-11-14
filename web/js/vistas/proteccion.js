// Protección Civil (#/proteccion[/<id>]): dónde y cuándo se quema cada municipio, cuadrito de 1 km
// por cuadrito, con herramientas para decisiones concretas (rama explorar-usos).
// Datos: web/datos/pc/indice.json y web/datos/pc/<id>.json, que escribe pipeline/herramientas_pc.py.
// El mapa usa la misma foto satelital y el mismo lienzo que la portada (portada.json, 825 × 681).
import { t, traducir } from '../textos.js';
import { $, fmt, el, datos, fechaCorta, deMesDia } from '../comun.js';
import { armarBuscador, EJEMPLO } from '../buscador.js';

const HERRAMIENTAS = ['anios', 'recorrido', 'fijas', 'cierre', 'conafor', 'vecinos', 'casas', 'semaforo', 'plan', 'ficha'];
const NOMBRE = { anios: 'herrAnios', recorrido: 'herrRecorrido', fijas: 'herrFijas', cierre: 'herrCierre', conafor: 'herrConafor', vecinos: 'herrVecinos', casas: 'herrCasas', semaforo: 'herrSemaforo', plan: 'herrPlan', ficha: 'herrFicha' };
const SIN_MAPA = new Set(['semaforo', 'plan', 'ficha']);
const FUEGO = ['#FCE38A', '#F29A4A', '#D7412B', '#8E1B12'];
const TENUE = 'rgba(246, 244, 240, 0.32)';
const BLANCO = '#FFFFFF', NOCHE = '#05080D', GRIS = '#8F877D', ACENTO = '#F5A04C';
// La foto de la portada en el lienzo: lon −92.55 a −86.7044 (x de 0 a 825) y lat 22.35 a 17.81 (y de −90 a 591).
const FOTO = { x: 0, y: -90, width: 825, height: 681 };
const CUADRO = { w: 0.01 * Math.cos((19.8 * Math.PI) / 180) * 150, h: 1.5 }; // 0.01° en el lienzo

const PLANTILLA = `
<article class="pagina pc">
  <p class="pc-explora" data-t="pcExplora"></p>
  <h1 data-t="pcTitulo"></h1>
  <p class="sub" data-t="pcSub"></p>
  <div class="pc-busca"><div class="buscador" id="pcBuscador"></div><p class="pc-fecha" id="pcFecha"></p></div>
  <div class="pc-tabs" role="tablist" data-t-aria="pcHerramientas" id="pcTabs"></div>
  <section class="pc-tablero" id="pcTablero" role="tabpanel" aria-labelledby="pcTab-anios">
    <figure class="pc-mapa" id="pcMapa">
      <svg id="pcSvg" role="img"></svg>
      <figcaption class="pc-mun" id="pcMun"></figcaption>
      <div class="pc-punta" id="pcPunta" hidden></div>
      <div class="pc-ley" id="pcLey"></div>
    </figure>
    <div class="pc-panel" id="pcPanel" aria-live="polite"></div>
  </section>
</article>`;

const enMapa = (p) => 'https://www.google.com/maps?q=' + p.la.toFixed(4) + ',' + p.lo.toFixed(4);
const tono = (n) => FUEGO[n >= 9 ? 3 : n >= 6 ? 2 : n >= 3 ? 1 : 0];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const md = (s) => fechaCorta(deMesDia(s));
const diaTemporada = (i) => fechaCorta(new Date(2026, 2, 1 + i, 12));

function semanaPico(dias) {
  let mejor = -1, desde = 0;
  for (let i = 0; i + 14 <= dias.length; i++) {
    const s = dias.slice(i, i + 14).reduce((a, b) => a + b, 0);
    if (s > mejor) { mejor = s; desde = i; }
  }
  return [desde, desde + 13];
}

export function montar(raiz, params) {
  let I = null, P = null, M = null, vivo = true;
  let herr = 'anios', semAnio = null, semSemana = 13;
  const id = params.id || EJEMPLO;

  function cifras(lista) {
    return '<div class="pc-cifras">' + lista.map(([b, s]) => `<div><b class="cifra">${b}</b><span>${s}</span></div>`).join('') + '</div>';
  }
  const decide = (clave) => `<div class="pc-decide"><span>${t('pcDecide')}</span><p>${t(clave)}</p></div>`;
  const conQue = (clave) => `<p class="pc-datos"><b>${t('pcConQue')}:</b> ${t(clave)}</p>`;
  const nT = () => M.temporadas[1] - M.temporadas[0] + 1;
  const deT = (n) => t('pcTemporadasDe', { n, t: nT() });
  const puntaAnios = (p) => `<b>${deT(p.a.length)}</b><br>${p.a.join(', ')}<br><span class="pc-coord">${p.la.toFixed(2)}, ${p.lo.toFixed(2)}</span>`;
  const leyAnios = () => t('aniosLey').map((s, i) => [FUEGO[i], s]);
  // La lista de recorrido deja fuera los cuadritos que caen en una fuente fija conocida.
  const fijos = () => new Set(M.fijos.map((f) => f.p.join(',')));
  const recorrido = (n) => { const f = fijos(); return M.puntos.filter((p) => !f.has(p.p.join(','))).slice(0, n); };

  /* ---------- Cada herramienta: la capa del mapa y el panel ---------- */
  const H = {
    anios() {
      const n = M.puntos.map((p) => p.a.length);
      return {
        capa: { estilo: (p) => ({ fill: tono(p.a.length) }), punta: puntaAnios, ley: leyAnios() },
        html: `<h2>${t('aniosTitulo')}</h2>${decide('aniosDecide')}` + cifras([
          [fmt(M.puntos.length), t('aniosC1')],
          [(n.length ? Math.max(...n) : 0) + ' / ' + nT(), t('aniosC2')],
          [fmt(n.filter((x) => x >= 7).length), t('aniosC3')],
          [fmt(M.normal), t('aniosC4')],
        ]) + conQue('aniosDatos'),
      };
    },
    recorrido() {
      const top = recorrido(10), en = new Set(top);
      return {
        capa: {
          estilo: (p) => en.has(p) ? { fill: FUEGO[3], stroke: BLANCO, sw: 0.5 } : { fill: TENUE },
          punta: puntaAnios, ley: [[FUEGO[3], t('recLey')], [TENUE, t('otrosCuadritos')]],
          // Un aro blanco alrededor de cada punto de la lista, para que se vea en municipios grandes.
          extra: (svg, k) => top.forEach((p, i) => {
            el('circle', { cx: p.p[0], cy: p.p[1], r: 7 * k, class: 'pc-aro' }, svg);
            el('text', { x: p.p[0] + 8 * k, y: p.p[1] - 5 * k, class: 'pc-num' }, svg).textContent = String(i + 1);
          }),
        },
        html: `<h2>${t('recTitulo')}</h2>${decide('recDecide')}<ol class="pc-lista">` + top.map((p, i) => `<li><b class="cifra">${i + 1}</b>
          <div><b>${deT(p.a.length)}</b> · ${t('pcDias', { n: p.d })}<div class="pc-coord">${p.la.toFixed(2)}, ${p.lo.toFixed(2)}</div></div>
          <div class="pc-acc"><a class="pc-b" href="${enMapa(p)}" target="_blank" rel="noopener">${t('pcAbrirMapa')}</a>
          <button type="button" class="pc-b" data-copiar="${p.la.toFixed(4)}, ${p.lo.toFixed(4)}">${t('pcCopiar')}</button></div></li>`).join('') + '</ol>' + conQue('recDatos'),
      };
    },
    fijas() {
      const r = I.recientes, rec = M.recientes, sobre = rec.filter((x) => x.fijo).length;
      return {
        capa: {
          items: [...M.fijos.map((f) => ({ ...f, tipo: 'fijo' })), ...rec.map((x) => ({ ...x, tipo: 'rec' }))],
          estilo: (p) => p.tipo === 'fijo' ? { fill: GRIS, stroke: BLANCO, sw: 0.4 } : { fill: p.fijo ? BLANCO : ACENTO, stroke: p.fijo ? GRIS : BLANCO, sw: 0.6, r: 1.6 },
          punta: (p) => p.tipo === 'fijo' ? `<b>${t('fijasLey')[0]}</b><br>${fmt(p.n)} FIRMS type 2` : `<b>${md(p.f.slice(5))} · ${esc(p.s)}</b><br>${t('fijasLey')[p.fijo ? 2 : 1]}`,
          ley: t('fijasLey').map((s, i) => [[GRIS, ACENTO, BLANCO][i], s]),
        },
        html: `<h2>${t('fijasTitulo')}</h2>${decide('fijasDecide')}` + cifras([
          [fmt(rec.length), t('fijasC1')],
          [fmt(sobre), t('fijasC2')],
          [fmt(r.fijos) + ' / ' + fmt(r.total), t('fijasC3', { m: Object.keys(r.porMunicipio).join(', ') })],
          [fmt(M.fijos.length), t('fijasC4')],
        ]) + (rec.length ? '' : `<p class="pc-nota">${t('fijasVacio')}</p>`) + conQue('fijasDatos'),
      };
    },
    cierre() {
      const n3 = M.puntos.filter((p) => p.ds.length >= 3).length, n1 = M.puntos.filter((p) => p.ds.length).length;
      const c = (k) => (k >= 6 ? FUEGO[3] : k >= 3 ? FUEGO[2] : k >= 1 ? FUEGO[1] : null);
      return {
        capa: {
          estilo: (p) => ({ fill: c(p.ds.length) || TENUE }),
          punta: (p) => `<b>${t('cierrePunta', { n: p.ds.length, f: md(M.ventana.fin) })}</b><br>${p.ds.join(', ')}`,
          ley: t('cierreLey').map((s, i) => [[FUEGO[1], FUEGO[2], FUEGO[3], TENUE][i], s]),
        },
        html: `<h2>${t('cierreTitulo')}</h2>${decide('cierreDecide')}` + cifras([
          [md(M.ventana.inicio) + '–' + md(M.ventana.fin), t('cierreC1', { z: M.zona })],
          [Math.round(M.despuesNormal * 100) + ' %', t('cierreC2')],
          [fmt(n3), t('cierreC3')],
          [fmt(n1), t('cierreC4')],
        ]) + (M.despuesNormal === 0 ? `<p class="pc-nota">${t('cierreZona2')}</p>` : '') + `<p class="pc-nota">${t('cierreNota')}</p>` + conQue('cierreDatos'),
      };
    },
    conafor() {
      const cerca = M.puntos.filter((p) => p.c.length);
      const inc = Object.values(M.incendios);
      const ha = inc.reduce((a, x) => a + x.ha, 0);
      return {
        capa: {
          estilo: (p) => p.c.length ? { fill: FUEGO[3], stroke: BLANCO, sw: 0.5 } : { fill: TENUE },
          punta: (p) => p.c.length ? `<b>${t('conPunta')}</b><br>` + p.c.map((k) => { const x = M.incendios[k]; return `${esc(x.f)} · ${fmt(x.ha)} ha · ${esc(x.v)}`; }).join('<br>') + '<br>' + deT(p.a.length) : puntaAnios(p),
          ley: [[FUEGO[3], t('conLey')], [TENUE, t('otrosCuadritos')]],
        },
        html: `<h2>${t('conTitulo')}</h2>${decide('conDecide')}` + cifras([
          [fmt(inc.length), t('conC1')],
          [fmt(ha) + ' ha', t('conC2')],
          [fmt(cerca.filter((p) => p.a.length >= 5).length), t('conC3')],
          [fmt(cerca.length), t('conC4')],
        ]) + conQue('conDatos'),
      };
    },
    vecinos() {
      const comp = M.puntos.filter((p) => p.v), cuenta = {};
      for (const p of comp) cuenta[p.v] = (cuenta[p.v] || 0) + 1;
      const orden = Object.entries(cuenta).sort((a, b) => b[1] - a[1]);
      return {
        capa: {
          estilo: (p) => p.v ? { fill: FUEGO[2], stroke: BLANCO, sw: 0.5 } : { fill: TENUE },
          punta: (p) => p.v ? `<b>${t('vecPunta', { v: esc(p.v) })}</b><br>${deT(p.a.length)}` : puntaAnios(p),
          ley: [[FUEGO[2], t('vecLey')], [TENUE, t('soloEste')]],
        },
        html: `<h2>${t('vecTitulo')}</h2>${decide('vecDecide')}` + cifras([[fmt(comp.length), t('vecC1')], [fmt(orden.length), t('vecC2')]]) +
          '<ol class="pc-lista">' + orden.slice(0, 6).map(([v, n], i) => `<li><b class="cifra">${i + 1}</b><div><b>${esc(v)}</b></div><div class="pc-coord">${t('vecCuadritos', { n })}</div></li>`).join('') + '</ol>' + conQue('vecDatos'),
      };
    },
    casas() {
      return {
        capa: { estilo: (p) => ({ fill: p.a.length >= 6 ? tono(p.a.length) : TENUE }), punta: puntaAnios, ley: [[FUEGO[2], t('casasLey')], [TENUE, t('otrosCuadritos')]] },
        html: `<h2>${t('casasTitulo')}</h2>${decide('casasDecide')}<p class="pc-falta">${t('casasFalta')}</p>`,
      };
    },
    semaforo() {
      const anios = Object.keys(I.semaforo);
      if (!semAnio || !anios.includes(semAnio)) semAnio = anios.includes('2024') ? '2024' : anios[anios.length - 1];
      const semanas = Object.keys(I.semaforo[semAnio]).map(Number);
      semSemana = Math.min(Math.max(semSemana, Math.min(...semanas)), Math.max(...semanas));
      const lista = I.semaforo[semAnio][semSemana] || [];
      const arriba = lista.filter((x) => x[1] === 'arriba').sort((a, b) => b[2] / Math.max(b[3], 1) - a[2] / Math.max(a[3], 1));
      const fecha = fechaCorta(new Date(Number(semAnio), 0, 1 + 7 * (semSemana - 1), 12));
      return {
        html: `<h2>${t('semTitulo')}</h2>${decide('semDecide')}
          <div class="pc-sem-ctl"><div class="pc-grupo"><span>${t('semTemporada')}</span><div class="pc-chips">` +
          anios.map((a) => `<button type="button" class="pc-chip" data-anio="${a}" aria-pressed="${a === semAnio}">${a}</button>`).join('') + `</div></div>
          <label class="pc-grupo pc-rango"><span>${t('semSemana', { f: fecha })}</span><input type="range" id="pcSemana" min="${Math.min(...semanas)}" max="${Math.max(...semanas)}" value="${semSemana}"></label></div>` +
          cifras([[fmt(arriba.length), t('semC1')], [fmt(lista.filter((x) => x[1] === 'abajo').length), t('semC2')]]) +
          '<ul class="pc-sem">' + (arriba.slice(0, 12).map((x) => `<li><i aria-hidden="true"></i><b>${esc(x[0])}</b><span class="pc-coord">${t('semFila', { a: fmt(x[2]), b: fmt(x[3]) })}</span></li>`).join('') || `<li><span>${t('semNinguno')}</span></li>`) + '</ul>' + conQue('semDatos'),
      };
    },
    plan() {
      const [i0, i1] = semanaPico(M.diaNormal);
      const ini = Math.round((deMesDia(M.ventana.inicio) - new Date(2026, 2, 1, 12)) / 864e5);
      const fin = Math.round((deMesDia(M.ventana.fin) - new Date(2026, 2, 1, 12)) / 864e5);
      const sem = Array.from({ length: 13 }, (_, w) => w);
      return {
        html: `<h2>${t('planTitulo')}</h2>${decide('planDecide')}<div class="pc-hoja">
          <h3>${t('planHoja', { m: esc(M.nombre) })}</h3>
          <p class="pc-fila"><span>${t('planNormal', { n: fmt(M.normal) })}</span><span>${t('planVentana', { a: md(M.ventana.inicio), b: md(M.ventana.fin) })}</span><span>${t('planPico', { a: diaTemporada(i0), b: diaTemporada(i1) })}</span></p>
          <div><span class="pc-etq">${t('planSemanas')}</span><div class="pc-cal">` +
          sem.map((w) => `<i class="${w * 7 + 3 >= i0 && w * 7 + 3 <= i1 ? 'pico' : ''}${w * 7 + 6 >= ini && w * 7 <= fin ? ' ven' : ''}"></i>`).join('') +
          `</div><div class="pc-cal-meses">${t('planMeses').map((m) => `<span>${m}</span>`).join('')}</div><p class="pc-nota">${t('planNota')}</p></div>
          <div><span class="pc-etq">${t('planTop')}</span><ol class="pc-lista">` + recorrido(5).map((p, i) => `<li><b class="cifra">${i + 1}</b><div><b>${deT(p.a.length)}</b><div class="pc-coord">${p.la.toFixed(2)}, ${p.lo.toFixed(2)}</div></div><a class="pc-b" href="${enMapa(p)}" target="_blank" rel="noopener">${t('pcAbrirMapa')}</a></li>`).join('') +
          '</ol></div></div>' + conQue('planDatos'),
      };
    },
    ficha() {
      const [i0, i1] = semanaPico(M.diaNormal);
      const top = recorrido(3);
      return {
        html: `<h2>${t('pcFichaTitulo')}</h2>${decide('fichaDecide')}<div class="pc-tel"><div class="pc-burbuja">
          <b class="pc-ficha-t">K'áak' · ${esc(M.nombre)}</b><svg id="pcMini" viewBox="0 0 280 180" aria-hidden="true"></svg>
          <b>${t('fichaPuntos')}</b>` + top.map((p, i) => `<span>${i + 1}. ${deT(p.a.length)} · ${p.la.toFixed(3)}, ${p.lo.toFixed(3)}</span>`).join('') +
          `<span>${t('fichaPico', { a: diaTemporada(i0), b: diaTemporada(i1) })}</span><span class="pc-coord">kaak.pages.dev/${M.id}</span></div></div><p class="pc-nota">${t('fichaNota')}</p>`,
        despues: () => miniFicha(top),
      };
    },
  };

  /* ---------- El mapa: foto satelital, el municipio en blanco y sus cuadritos ---------- */
  function mapa(capa) {
    const svg = $('pcSvg');
    svg.textContent = '';
    const yo = P.mun.find((x) => x.id === M.id);
    const defs = el('defs', {}, svg);
    el('image', { href: '/img/mosaico.jpg', ...FOTO, preserveAspectRatio: 'none' }, svg);
    const vecinos = el('g', { class: 'pc-vecinos' }, svg);
    for (const x of P.mun) if (x.id !== M.id) el('path', { d: x.d }, vecinos);
    const contorno = el('path', { d: yo.d, class: 'pc-contorno-halo' }, svg);
    // El recuadro: el municipio con aire alrededor, en la proporción del mapa.
    const b = contorno.getBBox(), aire = Math.max(b.width, b.height) * 0.08;
    let vb = { x: b.x - aire, y: b.y - aire, w: b.width + 2 * aire, h: b.height + 2 * aire };
    const prop = 4 / 3;
    if (vb.w / vb.h < prop) { const w = vb.h * prop; vb.x -= (w - vb.w) / 2; vb.w = w; } else { const h = vb.w / prop; vb.y -= (h - vb.h) / 2; vb.h = h; }
    svg.setAttribute('viewBox', [vb.x, vb.y, vb.w, vb.h].map((v) => v.toFixed(2)).join(' '));
    const k = vb.w / 640; // unidades del lienzo por píxel de un mapa de 640 de ancho
    const velo = el('mask', { id: 'pcFuera' }, defs);
    el('rect', { x: vb.x, y: vb.y, width: vb.w, height: vb.h, fill: BLANCO }, velo);
    el('path', { d: yo.d, fill: '#000' }, velo);
    el('rect', { x: vb.x, y: vb.y, width: vb.w, height: vb.h, fill: NOCHE, 'fill-opacity': 0.6, mask: 'url(#pcFuera)' }, svg);
    svg.appendChild(contorno);
    el('path', { d: yo.d, class: 'pc-contorno' }, svg);
    const g = el('g', {}, svg), punta = $('pcPunta');
    const items = capa.items || M.puntos;
    for (const p of items) {
      const st = capa.estilo(p);
      const forma = st.r
        ? el('circle', { cx: p.p[0], cy: p.p[1], r: st.r, fill: st.fill, stroke: st.stroke, 'stroke-width': st.sw }, g)
        : el('rect', { x: (p.p[0] - CUADRO.w / 2).toFixed(2), y: (p.p[1] - CUADRO.h / 2).toFixed(2), width: CUADRO.w.toFixed(2), height: CUADRO.h.toFixed(2), fill: st.fill, stroke: st.stroke || 'none', 'stroke-width': st.sw || 0 }, g);
      if (capa.punta) {
        forma.addEventListener('pointerenter', () => {
          const r = svg.getBoundingClientRect(), f = r.width / vb.w;
          punta.innerHTML = capa.punta(p);
          punta.style.left = ((p.p[0] - vb.x) * f) + 'px';
          punta.style.top = ((p.p[1] - vb.y) * f) + 'px';
          punta.hidden = false;
        });
        forma.addEventListener('pointerleave', () => { punta.hidden = true; });
      }
    }
    if (capa.extra) capa.extra(svg, k);
    // Escala de 5 km en la esquina.
    const km5 = (5 / 111.32) * 150, x1 = vb.x + vb.w - 14 * k, y = vb.y + vb.h - 14 * k;
    el('line', { x1: x1 - km5, x2: x1, y1: y, y2: y, class: 'pc-escala' }, svg);
    el('text', { x: x1, y: y - 5 * k, class: 'pc-escala-t', 'font-size': 11 * k }, svg).textContent = t('pcEscala');
    svg.style.setProperty('--k', k);
    $('pcMun').textContent = M.nombre;
    $('pcLey').innerHTML = capa.ley.map(([c, s]) => `<span><i style="background:${c}"></i>${esc(s)}</span>`).join('');
    svg.setAttribute('aria-label', t('pcMapaAria', { m: M.nombre, n: fmt(M.puntos.length), capa: capa.ley.map((x) => x[1]).join(', ') }));
  }

  function miniFicha(top) {
    const svg = $('pcMini');
    if (!svg) return;
    const yo = P.mun.find((x) => x.id === M.id);
    el('image', { href: '/img/mosaico.jpg', ...FOTO, preserveAspectRatio: 'none' }, svg);
    const c = el('path', { d: yo.d, class: 'pc-contorno' }, svg);
    const b = c.getBBox(), a = Math.max(b.width, b.height) * 0.1;
    let vb = { x: b.x - a, y: b.y - a, w: b.width + 2 * a, h: b.height + 2 * a };
    if (vb.w / vb.h < 280 / 180) { const w = vb.h * 280 / 180; vb.x -= (w - vb.w) / 2; vb.w = w; } else { const h = vb.w * 180 / 280; vb.y -= (h - vb.h) / 2; vb.h = h; }
    svg.setAttribute('viewBox', [vb.x, vb.y, vb.w, vb.h].map((v) => v.toFixed(2)).join(' '));
    const k = vb.w / 280;
    for (const p of M.puntos) if (p.a.length >= 6) el('rect', { x: p.p[0] - CUADRO.w / 2, y: p.p[1] - CUADRO.h / 2, width: CUADRO.w, height: CUADRO.h, fill: tono(p.a.length) }, svg);
    top.forEach((p, i) => {
      el('circle', { cx: p.p[0], cy: p.p[1], r: 6 * k, fill: '#121212', stroke: BLANCO, 'stroke-width': 1.2 * k }, svg);
      el('text', { x: p.p[0], y: p.p[1] + 3.5 * k, 'text-anchor': 'middle', 'font-size': 9 * k, 'font-weight': 700, fill: BLANCO, class: 'pc-mini-num' }, svg).textContent = String(i + 1);
    });
  }

  /* ---------- Pintar ---------- */
  function pestañas() {
    const cont = $('pcTabs');
    cont.innerHTML = HERRAMIENTAS.map((h) => `<button type="button" role="tab" id="pcTab-${h}" class="pc-tab" data-h="${h}" aria-selected="${h === herr}" aria-controls="pcTablero" tabindex="${h === herr ? 0 : -1}">${t(NOMBRE[h])}</button>`).join('');
    cont.querySelectorAll('.pc-tab').forEach((b) => {
      b.addEventListener('click', () => { herr = b.dataset.h; pintar(); });
      b.addEventListener('keydown', (e) => {
        const i = HERRAMIENTAS.indexOf(herr);
        const j = e.key === 'ArrowRight' ? (i + 1) % HERRAMIENTAS.length : e.key === 'ArrowLeft' ? (i - 1 + HERRAMIENTAS.length) % HERRAMIENTAS.length : -1;
        if (j < 0) return;
        e.preventDefault();
        herr = HERRAMIENTAS[j];
        pintar();
        $('pcTab-' + herr).focus();
      });
    });
  }

  function pintar() {
    if (!M) return;
    traducir(raiz);
    pestañas();
    $('pcTablero').setAttribute('aria-labelledby', 'pcTab-' + herr);
    $('pcFecha').textContent = t('pcDatosHasta', { f: md(I.datosHasta.slice(5)) + ' ' + I.datosHasta.slice(0, 4), a: I.temporadas[0], b: I.temporadas[1] });
    const r = H[herr]();
    const conMapa = !SIN_MAPA.has(herr);
    $('pcMapa').hidden = !conMapa;
    $('pcTablero').classList.toggle('solo', !conMapa);
    $('pcPunta').hidden = true;
    if (conMapa) mapa(r.capa);
    $('pcPanel').innerHTML = r.html;
    if (r.despues) r.despues();
    $('pcPanel').querySelectorAll('[data-copiar]').forEach((b) => b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(b.dataset.copiar); b.textContent = t('pcCopiado'); } catch { b.textContent = b.dataset.copiar; }
      setTimeout(() => { b.textContent = t('pcCopiar'); }, 1600);
    }));
    $('pcPanel').querySelectorAll('[data-anio]').forEach((b) => b.addEventListener('click', () => { semAnio = b.dataset.anio; pintar(); }));
    const rango = $('pcSemana');
    if (rango) rango.addEventListener('input', () => { semSemana = Number(rango.value); pintar(); $('pcSemana').focus(); });
    document.title = M.nombre + ' · ' + t('navPc') + " · K'áak'";
  }

  async function cargarMunicipio(nuevo) {
    try {
      M = await datos('pc/' + nuevo + '.json');
    } catch {
      M = await datos('pc/' + EJEMPLO + '.json');
    }
    if (vivo) pintar();
  }

  async function arrancar() {
    raiz.innerHTML = PLANTILLA;
    traducir(raiz);
    $('pcFecha').textContent = t('pcCargando');
    try {
      [I, P] = await Promise.all([datos('pc/indice.json'), datos('portada.json')]);
    } catch {
      if (vivo) $('pcFecha').textContent = t('pcError');
      return;
    }
    if (!vivo) return;
    armarBuscador($('pcBuscador'), 'pc', {
      municipios: I.municipios, etiqueta: 'pcBusca',
      alElegir: (x) => { history.replaceState(null, '', '#/proteccion/' + x.id); cargarMunicipio(x.id); },
    });
    await cargarMunicipio(id);
  }

  arrancar();
  const alIdioma = () => {
    if (!M) return;
    armarBuscador($('pcBuscador'), 'pc', { municipios: I.municipios, etiqueta: 'pcBusca', alElegir: (x) => { history.replaceState(null, '', '#/proteccion/' + x.id); cargarMunicipio(x.id); } });
    pintar();
  };
  window.addEventListener('idioma', alIdioma);
  return () => { vivo = false; window.removeEventListener('idioma', alIdioma); };
}
