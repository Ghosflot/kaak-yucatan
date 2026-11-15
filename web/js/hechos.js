// Los hechos propios de un municipio, ya redactados. Cada uno trae su guarda desde los datos
// (`hechos` de web/datos/municipio/<id>.json): una clave ausente quiere decir «no se dice».
import { t } from './textos.js';
import { fechaDia, deMesDia, rangoDias } from './comun.js';

// A escala de municipio solo se compara desde 2012: los años de MODIS salen exagerados.
export const DESDE_MUNICIPIO = 2012;
// Con menos días de diferencia, empezar «antes que su zona» no es noticia.
const DIAS_DISTINTO = 10;
const diasEntre = (a, b) => Math.round((deMesDia(b) - deMesDia(a)) / 864e5);

/** Hasta tres oraciones: cómo quedó 2026 entre sus temporadas, su lugar en el estado y su calendario. */
export function hechosDe(m) {
  const h = m.hechos || {}, a = DESDE_MUNICIPIO, sale = [];
  if (h.puesto26) {
    const n = h.puesto26, alReves = h.temporadas - n + 1, partes = [];
    if (n === 1) partes.push(t('hechoMinimo', { a }));
    else if (alReves === 1) partes.push(t('hechoMaximo', { a }));
    else if (n <= 3) partes.push(t('hechoPuestoMenos', { o: t('ordinalesF')[n], a }));
    else if (alReves <= 3) partes.push(t('hechoPuestoMas', { o: t('ordinalesF')[alReves], a }));
    if (h.racha) partes.push(h.racha >= h.temporadas ? t('hechoRachaTodas', { a }) : t('hechoRacha', { n: h.racha }));
    if (partes.length) sale.push({ tipo: 'temporada', texto: partes.join(' ') });
  }
  if (h.lugar) {
    const e = m.estado;
    const texto = h.lugar === 1 ? t('hechoLugar1', { e })
      : h.lugar <= 3 ? t('hechoLugarAlto', { o: t('ordinalesM')[h.lugar], e })
        : t('hechoLugar', { n: h.lugar, de: h.de, e });
    sale.push({ tipo: 'lugar', texto });
  }
  if (h.empieza && h.semanaPico) {
    let texto = t('hechoEmpieza', { f: fechaDia(deMesDia(h.empieza)), s: rangoDias(h.semanaPico[0], h.semanaPico[1]) });
    const d = h.empiezaZona ? diasEntre(h.empieza, h.empiezaZona) : 0;
    if (Math.abs(d) >= DIAS_DISTINTO) texto += ' ' + t(d > 0 ? 'hechoAntesQue' : 'hechoDespuesQue', { d: Math.abs(d), q: t(m.ventana ? 'suZona' : 'suEstado') });
    sale.push({ tipo: 'calendario', texto });
  }
  return sale;
}
