// Buscador de municipios (combobox con lista): lo usan la portada y la página de un municipio.
import { t } from './textos.js';
import { sinAcentos } from './comun.js';
import { ubicar, municipioEn } from './ubicacion.js';

export const EJEMPLO = 'uman';

// Ciudades, y municipios nuevos que los límites del mapa no traen, con el municipio que las contiene:
// quien busque «Cancún» encuentra Benito Juárez.
const CIUDADES = [
  ['Cancún', 'benito-juarez'], ['Playa del Carmen', 'solidaridad'], ['Ciudad del Carmen', 'carmen'],
  ['Chetumal', 'othon-p-blanco'], ['Puerto Morelos', 'benito-juarez'], ['Dzitbalché', 'calkini'],
  ['Seybaplaya', 'champoton'], ['Holbox', 'lazaro-cardenas'], ['Mahahual', 'othon-p-blanco'],
  ['Xpujil', 'calakmul'], ['Chichén Itzá', 'tinum'],
];

/**
 * Arma el buscador dentro de `cont`. `municipios`: [{id, n, e}]; `alElegir(m)` recibe el elegido.
 * `n` distingue los id cuando hay dos buscadores en la misma página; `etiqueta` es la clave del
 * texto de la etiqueta. Si se vuelve a armar (al cambiar de idioma), conserva lo que estaba escrito.
 * `alUbicar(m)`, si se pasa, agrega «Usar mi ubicación» y recibe el municipio donde está la persona.
 */
export function armarBuscador(cont, n, { municipios, alElegir, alUbicar = null, etiqueta = 'buscaLabel' }) {
  const previo = cont.querySelector('input')?.value || '';
  cont.innerHTML =
    '<label for="busca' + n + '"></label>' +
    '<input id="busca' + n + '" type="text" autocomplete="off" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="lista' + n + '">' +
    '<ul class="opciones" id="lista' + n + '" role="listbox" hidden></ul>' +
    '<div class="debajo"><span class="ejemplo"><span></span> <button type="button"></button></span></div>';
  const inp = cont.querySelector('input'), lista = cont.querySelector('ul');
  const ejemplo = municipios.find((m) => m.id === EJEMPLO);
  cont.querySelector('label').textContent = t(etiqueta);
  inp.placeholder = t('buscaPh');
  inp.value = previo;
  lista.setAttribute('aria-label', t(etiqueta));
  cont.querySelector('.ejemplo span').textContent = t('ejemplo');
  const boton = cont.querySelector('.ejemplo button');
  boton.textContent = ejemplo?.n || '';
  // Lo que se puede buscar: cada municipio por su nombre y las ciudades por el suyo.
  const porId = new Map(municipios.map((m) => [m.id, m]));
  const buscables = municipios.map((m) => ({ m, nombre: m.n, lugar: m.e }))
    .concat(CIUDADES.filter(([, id]) => porId.has(id))
      .map(([c, id]) => ({ m: porId.get(id), nombre: c, lugar: c + ', ' + porId.get(id).e })));
  let activos = [], idx = -1;
  const cerrar = () => { lista.hidden = true; inp.setAttribute('aria-expanded', 'false'); inp.removeAttribute('aria-activedescendant'); idx = -1; };
  const elegir = (m) => { inp.value = m.n; cerrar(); alElegir(m); };
  const pintar = () => {
    lista.textContent = '';
    if (!activos.length) {
      const li = document.createElement('li');
      li.className = 'vacio'; li.setAttribute('role', 'option'); li.setAttribute('aria-disabled', 'true');
      li.textContent = t('sinCoincidencias');
      lista.appendChild(li);
    }
    activos.forEach(({ m, lugar }, i) => {
      const li = document.createElement('li');
      li.id = 'op' + n + '-' + i; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', i === idx ? 'true' : 'false');
      const e = document.createElement('span'); e.textContent = lugar;
      li.append(document.createTextNode(m.n), e);
      li.addEventListener('pointerdown', (ev) => { ev.preventDefault(); elegir(m); });
      lista.appendChild(li);
    });
    if (idx >= 0) inp.setAttribute('aria-activedescendant', 'op' + n + '-' + idx); else inp.removeAttribute('aria-activedescendant');
    lista.hidden = false; inp.setAttribute('aria-expanded', 'true');
    acomodar();
    if (idx >= 0) lista.children[idx].scrollIntoView({ block: 'nearest' });
  };
  // La lista se abre hacia donde quepa (abajo, o arriba si abajo no hay lugar) y, si no cabe entera,
  // se desplaza por dentro: nunca se sale de la ventana ni queda debajo de la barra de arriba.
  const acomodar = () => {
    lista.style.maxHeight = 'none';
    const r = inp.getBoundingClientRect();
    const techo = Math.max(0, document.querySelector('.barra')?.getBoundingClientRect().bottom || 0);
    const abajo = innerHeight - r.bottom - 10, arriba = r.top - techo - 10;
    const alto = lista.scrollHeight;
    const haciaArriba = alto > abajo && arriba > abajo;
    lista.classList.toggle('arriba', haciaArriba);
    lista.style.top = haciaArriba ? 'auto' : inp.offsetTop + inp.offsetHeight + 4 + 'px';
    lista.style.bottom = haciaArriba ? cont.offsetHeight - inp.offsetTop + 4 + 'px' : 'auto';
    lista.style.maxHeight = Math.max(96, Math.min(alto, haciaArriba ? arriba : abajo)) + 'px';
  };
  inp.addEventListener('input', () => {
    const q = sinAcentos(inp.value.trim());
    if (!q) { cerrar(); return; }
    // Primero los que empiezan con lo escrito; un nombre exacto, antes que todos.
    const vistos = new Set();
    activos = buscables.filter((b) => sinAcentos(b.nombre).includes(q))
      .sort((a, b) => (sinAcentos(b.nombre) === q) - (sinAcentos(a.nombre) === q) || sinAcentos(a.nombre).indexOf(q) - sinAcentos(b.nombre).indexOf(q) || a.nombre.localeCompare(b.nombre, 'es'))
      .filter((b) => !vistos.has(b.m.id) && vistos.add(b.m.id))
      .slice(0, 6);
    idx = activos.length ? 0 : -1;
    pintar();
  });
  inp.addEventListener('keydown', (e) => {
    if (lista.hidden) return;
    if (e.key === 'ArrowDown') { idx = Math.min(activos.length - 1, idx + 1); pintar(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { idx = Math.max(0, idx - 1); pintar(); e.preventDefault(); }
    else if (e.key === 'Enter' && idx >= 0) { elegir(activos[idx].m); e.preventDefault(); }
    else if (e.key === 'Escape') { cerrar(); e.stopPropagation(); }
  });
  inp.addEventListener('blur', () => setTimeout(cerrar, 120));
  boton.addEventListener('click', () => { if (ejemplo) { inp.value = ejemplo.n; alElegir(ejemplo); } });
  if (alUbicar && 'geolocation' in navigator) armarUbicacion(cont, municipios, alUbicar);
}

const PIN = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a7 7 0 0 0-7 7c0 5 7 12 7 12s7-7 7-12a7 7 0 0 0-7-7Z" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="9.5" r="2.6" fill="currentColor"/></svg>';

function armarUbicacion(cont, municipios, alUbicar) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ubicacion';
  b.innerHTML = PIN + '<span></span>';
  b.lastChild.textContent = t('miUbicacion');
  const aviso = document.createElement('p');
  aviso.className = 'aviso-ubicacion';
  aviso.setAttribute('role', 'status');
  cont.querySelector('.debajo').appendChild(b);
  cont.appendChild(aviso);
  b.addEventListener('click', async () => {
    b.disabled = true;
    aviso.textContent = t('ubicando');
    try {
      const { lat, lon } = await ubicar();
      const id = await municipioEn(lat, lon);
      // La ubicación puede tardar: si mientras tanto la persona se fue a otra página, no se la mueve.
      if (!cont.isConnected) return;
      const m = municipios.find((x) => x.id === id);
      aviso.textContent = m ? '' : t('ubicacionFuera');
      if (m) alUbicar(m);
    } catch {
      aviso.textContent = t('ubicacionError');
    } finally {
      b.disabled = false;
    }
  });
}
