// Resolución (index.html): en una pantalla de escritorio con menos resolución, la página se escala y conserva la
// estructura que tiene en una pantalla grande. Las media queries miden la ventana sin la escala; los cortes de diseño
// que dependen del ancho o del alto van como clases medidas con la escala («angosta», «baja»).
const { test, expect } = require('@playwright/test');
const { abrir } = require('./ayudas');

// Cada bloque, en proporción a la ventana: dónde empieza y cuánto mide de ancho (las alturas dependen de los renglones).
const proporcion = (page, sel) => page.locator(sel).evaluate((e) => {
  const r = e.getBoundingClientRect(), w = document.documentElement.clientWidth;
  return { x: r.left / w, ancho: r.width / w };
});

const PAGINAS = [
  ['#/fechas', ['.fz-cal', '.fz-cabeza', '.fz-lado-mapa']],
  ['#/municipio/tekax', ['.mun-principal', '.mun-lado']],
];

// 1024 × 768 se escala a 0.8 (como 1280 × 960); en Chrome con zoom al 125 % en 1366 × 768 la página mide 1080 × 612.
for (const [ancho, alto] of [[1024, 768], [1080, 612], [983, 624]]) {
  for (const [ruta, bloques] of PAGINAS) {
    test(`a ${ancho}×${alto}, ${ruta} tiene la misma estructura que sin escalar en el tamaño al que equivale`, async ({ page }) => {
      await abrir(page, ruta, { ancho, alto });
      const z = Number(await page.evaluate(() => document.documentElement.style.getPropertyValue('--zoom')));
      expect(z).toBeLessThan(1);
      const escalada = {};
      for (const b of bloques) escalada[b] = await proporcion(page, b);

      await abrir(page, ruta, { ancho: Math.round(ancho / z), alto: Math.round(alto / z) });
      expect(await page.evaluate(() => document.documentElement.style.zoom)).toBe('');
      for (const b of bloques) {
        const grande = await proporcion(page, b);
        expect(Math.abs(escalada[b].x - grande.x), b).toBeLessThan(0.01);
        expect(Math.abs(escalada[b].ancho - grande.ancho), b).toBeLessThan(0.01);
      }
    });
  }
}

test('en «Fechas de quema» el calendario y el panel van lado a lado en 1024 × 768, y en el teléfono uno debajo del otro', async ({ page }) => {
  await abrir(page, '#/fechas', { ancho: 1024, alto: 768 });
  const cal = await page.locator('.fz-cal').boundingBox(), cabeza = await page.locator('.fz-cabeza').boundingBox();
  expect(cabeza.x).toBeGreaterThan(cal.x + cal.width - 1);

  await abrir(page, '#/fechas', { ancho: 390, alto: 844 });
  const calT = await page.locator('.fz-cal').boundingBox(), cabezaT = await page.locator('.fz-cabeza').boundingBox();
  expect(calT.y).toBeGreaterThan(cabezaT.y + cabezaT.height - 1);
});
