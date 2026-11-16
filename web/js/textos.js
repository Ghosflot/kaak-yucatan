// Textos de la página en español e inglés (web/textos/*.json).
// El idioma sale de ?lang=, después de lo que eligió la persona la última vez y, si no, del
// navegador: español si es su primer idioma y, si no, inglés.
// Al cambiarlo se avisa con el evento «idioma» en window; cada vista vuelve a pintar sus textos.

const IDIOMAS = ['es', 'en'];
const TEXTOS = {};
let actual = 'es';

function guardado() {
  try { return localStorage.getItem('kaak-idioma'); } catch { return null; }
}

function delNavegador() {
  const primero = (navigator.languages && navigator.languages[0]) || navigator.language || '';
  return /^es\b/i.test(primero) ? 'es' : 'en';
}

export async function cargarTextos() {
  const [es, en] = await Promise.all(IDIOMAS.map((l) => fetch('/textos/' + l + '.json').then((r) => r.json())));
  TEXTOS.es = es;
  TEXTOS.en = en;
  const pedido = new URLSearchParams(location.search).get('lang') || guardado();
  actual = IDIOMAS.includes(pedido) ? pedido : delNavegador();
  document.documentElement.lang = actual;
}

export function idioma() {
  return actual;
}

// t('resultado', {n: 96, t: 106}) → «96 de 106 municipios…». Las listas (meses) se devuelven tal cual.
export function t(clave, vars) {
  const v = TEXTOS[actual][clave] ?? TEXTOS.es[clave];
  if (v === undefined) {
    console.warn('Falta el texto', clave);
    return clave;
  }
  if (typeof v !== 'string' || !vars) return v;
  return v.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function cambiarIdioma(l) {
  if (!IDIOMAS.includes(l) || l === actual) return;
  actual = l;
  document.documentElement.lang = l;
  try { localStorage.setItem('kaak-idioma', l); } catch { /* sin almacenamiento: solo dura esta visita */ }
  window.dispatchEvent(new Event('idioma'));
}

// Llena los elementos marcados en el HTML: data-t (texto), data-t-aria (aria-label), data-t-ph (placeholder).
export function traducir(raiz = document) {
  raiz.querySelectorAll('[data-t]').forEach((e) => { e.textContent = t(e.dataset.t); });
  raiz.querySelectorAll('[data-t-aria]').forEach((e) => e.setAttribute('aria-label', t(e.dataset.tAria)));
  raiz.querySelectorAll('[data-t-ph]').forEach((e) => e.setAttribute('placeholder', t(e.dataset.tPh)));
}
