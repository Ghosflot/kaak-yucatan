// «Usar mi ubicación»: en qué municipio de la península está quien abre la página.
// Los límites (municipios.geojson) se bajan solo cuando alguien toca el botón.
import { datos } from './comun.js';

/** Pide la ubicación al navegador; rechaza si no hay permiso o tarda demasiado. */
export function ubicar() {
  return new Promise((resolver, rechazar) => {
    if (!('geolocation' in navigator)) { rechazar(new Error('sin geolocalización')); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolver({ lat: p.coords.latitude, lon: p.coords.longitude }),
      rechazar,
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

/** El id del municipio que contiene el punto, o null si queda fuera de la península. */
export async function municipioEn(lat, lon) {
  const g = await datos('municipios.geojson');
  const f = g.features.find((x) => contiene(x.geometry, lon, lat));
  return f ? f.properties.id : null;
}

function contiene(geom, x, y) {
  const poligonos = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
  return poligonos.some((anillos) => dentro(anillos[0], x, y) && !anillos.slice(1).some((hueco) => dentro(hueco, x, y)));
}

// Cuenta cuántas veces una línea horizontal desde el punto cruza el borde: si es impar, está dentro.
function dentro(anillo, x, y) {
  let adentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) adentro = !adentro;
  }
  return adentro;
}
