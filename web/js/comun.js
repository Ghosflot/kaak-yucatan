// Piezas que usan varias vistas: formato de cifras y fechas, el veredicto y SVG.
import { t, idioma } from './textos.js';

export const $ = (id) => document.getElementById(id);

export const fmt = (n) => Math.round(n).toLocaleString(idioma() === 'en' ? 'en-US' : 'es-MX');

// Avisa al lector de pantalla lo que cambió sin mover el foco (la zona viva está en index.html).
export function anunciar(texto) {
  const z = document.getElementById('anuncio');
  if (!z) return;
  z.textContent = '';
  // En el cuadro siguiente, para que se anuncie aunque el texto se repita.
  requestAnimationFrame(() => { z.textContent = texto; });
}

// El último municipio que se abrió en esta visita: «Fechas de quema» abre en su zona.
export const visita = { municipio: null };

export const sinAcentos = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Fechas a partir de «2026-05-01» o de un Date.
const aFecha = (f) => (f instanceof Date ? f : new Date(f + 'T12:00:00'));
export const fechaDia = (f) => { const d = aFecha(f); return t('fechaDia', { d: d.getDate(), m: t('meses')[d.getMonth()] }); };
export const fechaDiaAnio = (f) => { const d = aFecha(f); return t('fechaDiaAnio', { d: d.getDate(), m: t('meses')[d.getMonth()], a: d.getFullYear() }); };
export const fechaCorta = (f) => { const d = aFecha(f); return t('fechaCorta', { d: d.getDate(), m: t('mesesCortos')[d.getMonth()] }); };
// «04-20» (mes-día de una ventana) → Date de 2026.
export const deMesDia = (md) => new Date(2026, Number(md.slice(0, 2)) - 1, Number(md.slice(3)), 12);

// «16 al 22 de abril», o «30 de abril al 6 de mayo» si cambia el mes (de dos «MM-DD»).
export function rangoDias(a, b) {
  const da = deMesDia(a), db = deMesDia(b);
  if (da.getMonth() === db.getMonth()) return t('rangoMes', { a: da.getDate(), b: db.getDate(), m: t('meses')[da.getMonth()] });
  return t('rango', { i: fechaDia(da), f: fechaDia(db) });
}

// Colores del mapa (escala semáforo).
export const COLOR = { muyabajo: '#17704F', abajo: '#6DB892', normal: '#E6D394', arriba: '#F29A4A', muyarriba: '#D7412B', poco: '#7F8682' };
export const ESCALA = ['muyabajo', 'abajo', 'normal', 'arriba', 'muyarriba'];

// La frase del veredicto: más fina que la clase del color («la mitad», «el doble»).
function indiceVeredicto(v26, normal, clase) {
  if (clase === 'poco' || !normal) return 7;
  // Se decide con las cifras redondeadas, las que se leen al lado: 19 contra 42 es «menos de la
  // mitad», no «la mitad». «La mitad» y «el doble» solo se dicen si de verdad quedan cerca.
  const r = Math.round(v26) / Math.max(1, Math.round(normal));
  return r < 0.47 ? 0 : r <= 0.53 ? 1 : r < 0.8 ? 2 : r <= 1.25 ? 3 : r < 1.9 ? 4 : r <= 2.1 ? 5 : 6;
}
// «191 focos de calor…» o «1 foco de calor…»: la clave con «Uno» lleva el singular.
export const cifras = (clave, m) => t(Math.round(m.v26) === 1 ? clave + 'Uno' : clave, { a: fmt(m.v26), b: fmt(m.normal) });
// Corta, para la tarjeta del mapa: «La mitad de lo normal».
export const veredicto = (v26, normal, clase) => t('veredicto')[indiceVeredicto(v26, normal, clase)];
// Completa, para la página y la ficha de un municipio: «Hubo la mitad del fuego que en un año normal.»
export const frase = (m) => t('frase')[indiceVeredicto(m.v26, m.normal, m.clase)];

const SVGNS = 'http://www.w3.org/2000/svg';
export function el(tag, attrs, padre) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (padre) padre.appendChild(e);
  return e;
}

export const reducirMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;


// Carga JSON de web/datos/ una sola vez por visita.
const cache = new Map();
export function datos(nombre) {
  if (!cache.has(nombre)) {
    cache.set(nombre, fetch('/datos/' + nombre).then((r) => {
      if (!r.ok) throw new Error(nombre + ': ' + r.status);
      return r.json();
    }).catch((e) => { cache.delete(nombre); throw e; }));
  }
  return cache.get(nombre);
}
