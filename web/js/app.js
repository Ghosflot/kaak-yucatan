// Enrutador de la página: #/ (temporada), #/municipio/<id>, #/fechas[/<zona>], #/metodo y #/proteccion[/<id>].
// Cada vista exporta montar(raiz, params) y devuelve su limpieza.
import { cargarTextos, cambiarIdioma, idioma, t, traducir } from './textos.js';

const VISTAS = {
  portada: () => import('./vistas/portada.js'),
  municipio: () => import('./vistas/municipio.js'),
  fechas: () => import('./vistas/fechas.js'),
  metodo: () => import('./vistas/metodo.js'),
  proteccion: () => import('./vistas/proteccion.js'),
};

// Un ancla mal escrita (%E0%A4) no debe tumbar la página: se usa tal cual y la vista dirá que no existe.
const decodificar = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

export function ruta(hash = location.hash, camino = location.pathname) {
  // El enlace corto de la ficha, kaak.pages.dev/uman: Cloudflare Pages responde con index.html.
  const corto = !hash && camino.match(/^\/([a-z0-9-]+)\/?$/);
  if (corto && corto[1] !== 'index') return { vista: 'municipio', params: { id: corto[1] } };
  const [nombre, id] = hash.replace(/^#\/?/, '').split('/');
  if (nombre === 'municipio' && id) return { vista: 'municipio', params: { id: decodificar(id) } };
  // La zona de #/fechas/<zona> no vuelve a montar la vista: la vista la sigue sola.
  if (nombre === 'fechas') return { vista: nombre, params: { zona: /^[1-4]$/.test(id || '') ? id : '2' } };
  if (nombre === 'metodo') return { vista: nombre, params: {} };
  if (nombre === 'proteccion') return { vista: nombre, params: id ? { id: decodificar(id) } : {} };
  return { vista: 'portada', params: {} };
}

const raiz = document.getElementById('vista');
let limpiar = () => {};
let montada = null;
let turno = 0;

async function mostrar() {
  const { vista, params } = ruta();
  const clave = vista + ':' + (params.id || '');
  // El turno sube antes de comparar: si se va a otra vista y se vuelve antes de que cargue,
  // la que estaba en camino ya no se monta.
  const mio = ++turno;
  if (clave === montada) return;
  const modulo = await VISTAS[vista]();
  if (mio !== turno) return; // otra navegación llegó antes
  const primera = montada === null;
  limpiar();
  raiz.textContent = '';
  raiz.className = 'vista vista-' + vista;
  document.body.dataset.vista = vista;
  montada = clave;
  document.querySelectorAll('.nav a').forEach((a) => {
    // El municipio cuelga de la temporada.
    const actual = a.dataset.vista === (vista === 'municipio' ? 'portada' : vista);
    if (actual) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  // Cada vista pone su título; la que no lo pone deja el de la página, no el de la anterior.
  document.title = t('tituloPagina');
  limpiar = modulo.montar(raiz, params) || (() => {});
  if (!primera) {
    window.scrollTo(0, 0);
    raiz.focus({ preventScroll: true });
  }
}

function pintarIdioma() {
  traducir(document);
  document.title = t('tituloPagina');
  document.querySelector('meta[name="description"]').setAttribute('content', t('descripcionPagina'));
  document.querySelectorAll('[data-idioma]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.idioma === idioma())));
}

// Con ?subtitulos=1 la página muestra una franja de subtítulos para grabar el recorrido de cada PR
// (tests/web/recorrido.mjs la llena con window.subtitulo(texto)).
function prepararSubtitulos() {
  if (new URLSearchParams(location.search).get('subtitulos') !== '1') return;
  const franja = document.createElement('div');
  franja.className = 'subtitulo';
  franja.setAttribute('aria-hidden', 'true');
  document.body.classList.add('con-subtitulos');
  document.body.appendChild(franja);
  window.subtitulo = (texto) => { franja.textContent = texto || ''; };
}

async function arrancar() {
  prepararSubtitulos();
  await cargarTextos();
  pintarIdioma();
  window.addEventListener('idioma', pintarIdioma);
  document.querySelectorAll('[data-idioma]').forEach((b) => b.addEventListener('click', () => cambiarIdioma(b.dataset.idioma)));
  // El enlace para saltar la barra no cambia el ancla: el ancla es la ruta.
  document.querySelector('.saltar').addEventListener('click', (e) => { e.preventDefault(); raiz.focus(); });
  window.addEventListener('hashchange', mostrar);
  await mostrar();
  insinuarMarca();
}

// Función escondida: K'ÁAK' dice qué significa al pasar por la marca. En la primera visita lo insinúa una vez.
function insinuarMarca() {
  try {
    if (localStorage.getItem('kaak-marca') === '1') return;
    localStorage.setItem('kaak-marca', '1');
  } catch { return; }
  const marca = document.querySelector('.marca');
  setTimeout(() => {
    marca.classList.add('insinua');
    setTimeout(() => marca.classList.remove('insinua'), 2600);
  }, 1500);
}

arrancar();
