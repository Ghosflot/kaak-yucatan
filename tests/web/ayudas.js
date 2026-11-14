// Ayudas de las pruebas de la página.
const AxeBuilder = require('@axe-core/playwright').default;

const RUTAS = ['#/', '#/municipio/tekax', '#/fechas', '#/metodo'];
const TAMANOS = [
  { ancho: 1440, alto: 900 },
  { ancho: 1280, alto: 720 },
  { ancho: 390, alto: 844 },
];

/** Abre una ruta (`#/…`) con el tamaño y la preferencia de movimiento dados; `query` va antes del ancla. */
async function abrir(page, ruta, { ancho = 1440, alto = 900, reducir = false, query = '' } = {}) {
  await page.setViewportSize({ width: ancho, height: alto });
  await page.emulateMedia({ reducedMotion: reducir ? 'reduce' : 'no-preference' });
  await page.goto('/' + query + ruta);
  await page.waitForSelector('#vista > *');
  await page.waitForLoadState('networkidle');
  if (ruta === '#/' || ruta === '') await page.waitForSelector('#rellenos path', { state: 'attached' });
}

/** Violaciones serias o críticas de WCAG 2.2 A y AA. */
async function revisarAxe(page) {
  const r = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return r.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => v.id + ': ' + v.nodes.map((n) => n.target.join(' ')).join(', '));
}

module.exports = { abrir, revisarAxe, RUTAS, TAMANOS };
