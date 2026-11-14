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

export const sinAcentos = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Fechas a partir de «2026-05-01» o de un Date.
const aFecha = (f) => (f instanceof Date ? f : new Date(f + 'T12:00:00'));
export const fechaDia = (f) => { const d = aFecha(f); return t('fechaDia', { d: d.getDate(), m: t('meses')[d.getMonth()] }); };
export const fechaDiaAnio = (f) => { const d = aFecha(f); return t('fechaDiaAnio', { d: d.getDate(), m: t('meses')[d.getMonth()], a: d.getFullYear() }); };
export const fechaCorta = (f) => { const d = aFecha(f); return t('fechaCorta', { d: d.getDate(), m: t('mesesCortos')[d.getMonth()] }); };
// «04-20» (mes-día de una ventana) → Date de 2026.
export const deMesDia = (md) => new Date(2026, Number(md.slice(0, 2)) - 1, Number(md.slice(3)), 12);

// Colores del mapa (escala semáforo).
export const COLOR = { muyabajo: '#17704F', abajo: '#6DB892', normal: '#E6D394', arriba: '#F29A4A', muyarriba: '#D7412B', poco: '#7F8682' };
export const ESCALA = ['muyabajo', 'abajo', 'normal', 'arriba', 'muyarriba'];

// La frase del veredicto: más fina que la clase del color («la mitad», «el doble»).
function indiceVeredicto(v26, normal, clase) {
  if (clase === 'poco' || !normal) return 7;
  const r = v26 / normal;
  return r < 0.45 ? 0 : r < 0.55 ? 1 : r < 0.8 ? 2 : r <= 1.25 ? 3 : r < 1.8 ? 4 : r <= 2.2 ? 5 : 6;
}
// «191 focos de calor…» o «1 foco de calor…»: la clave con «Uno» lleva el singular.
export const cifras = (clave, m) => t(Math.round(m.v26) === 1 ? clave + 'Uno' : clave, { a: fmt(m.v26), b: fmt(m.normal) });
// Corta, para la tarjeta del mapa: «La mitad de lo normal».
export const veredicto = (v26, normal, clase) => t('veredicto')[indiceVeredicto(v26, normal, clase)];
// Completa, para la página y la ficha de un municipio: «Hubo la mitad del fuego de un año normal.»
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
