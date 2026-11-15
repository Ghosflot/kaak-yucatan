// Teclado, lector de pantalla y dedo.
const { test, expect } = require('@playwright/test');
const { abrir } = require('./ayudas');

const enfocado = (page) => page.evaluate(() => document.activeElement?.id || document.activeElement?.dataset.y || document.activeElement?.tagName);

test('las barras de los años son una sola parada de Tab y se recorren con las flechas', async ({ page }) => {
  await abrir(page, '#/', { reducir: true });
  await expect(page.locator('#barras .toque[tabindex="0"]')).toHaveCount(1);
  await page.locator('#barras .toque[tabindex="0"]').focus();
  expect(await enfocado(page)).toBe('2026');
  await page.keyboard.press('ArrowLeft');
  expect(await enfocado(page)).toBe('2025');
  await page.keyboard.press('Home');
  expect(await enfocado(page)).toBe('2001');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  // Elegir 2003 vuelve a dibujar las barras: el foco se queda en 2003 y se avisa lo que cambió.
  await expect(page.locator('#filaAnio')).toHaveText('2003');
  expect(await enfocado(page)).toBe('2003');
  await expect(page.locator('#anuncio')).toContainText('En 2003');
  await expect(page.locator('#anuncio')).toContainText('El mapa muestra 2003');
});

test('al elegir con el buscador, la tarjeta se lee y queda justo después en el orden del Tab', async ({ page }) => {
  await abrir(page, '#/', { reducir: true });
  const antes = await page.evaluate(() => Boolean(document.getElementById('tarjeta').compareDocumentPosition(document.getElementById('instrumento')) & Node.DOCUMENT_POSITION_FOLLOWING));
  expect(antes).toBe(true);
  await page.fill('#busca2', 'tekax');
  await page.keyboard.press('Enter');
  await expect(page.locator('#anuncio')).toContainText('Tekax');
  await expect(page.locator('#anuncio')).toContainText('Focos de calor en 2026');
});

test('«Tekax» en el mapa del cierre va en claro sobre el verde oscuro', async ({ page }) => {
  await abrir(page, '#/', { reducir: true });
  const color = await page.locator('.nota-mapa.enlace').evaluate((e) => getComputedStyle(e).color);
  expect(color).toBe('rgb(246, 244, 240)');
});

test('#/fechas: cada mes es un encabezado que se puede recorrer', async ({ page }) => {
  await abrir(page, '#/fechas');
  for (const m of ['Enero', 'Marzo', 'Mayo']) await expect(page.getByRole('heading', { level: 2, name: m })).toBeVisible();
});

test('#/fechas en el teléfono: el nombre y la zona de cada renglón se tocan con 44 px', async ({ page }) => {
  await abrir(page, '#/fechas', { ancho: 390, alto: 844 });
  const fila = page.locator('#almCuerpo tr').first();
  await fila.scrollIntoViewIfNeeded();
  const th = await fila.locator('th').boundingBox();
  expect(th.height).toBeGreaterThanOrEqual(44);
  // Las fechas, debajo del nombre, también abren el municipio.
  const destino = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('a, button')?.className || document.elementFromPoint(x, y)?.closest('a')?.getAttribute('href'),
    { x: th.x + th.width - 8, y: th.y + th.height - 8 });
  expect(destino).toMatch(/#\/municipio\//);
  const zona = await fila.locator('.a-zona').boundingBox();
  expect(zona.height).toBeGreaterThanOrEqual(44);
  expect(zona.width).toBeGreaterThanOrEqual(44);
});

// Teclado en el mapa, la tira y el calendario, y «Repetir» sin animación.
test.describe('con el teclado', () => {
  test('en el cierre, las flechas recorren el mapa y Enter abre el municipio', async ({ page }) => {
    await abrir(page, '#/', { reducir: true });
    await page.locator('#capa').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#tarjeta .nombre')).toHaveText('Muna'); // la primera flecha empieza en el ejemplo
    await page.keyboard.press('ArrowUp');
    const otro = await page.locator('#tarjeta .nombre').textContent();
    expect(otro).not.toBe('Muna');
    expect(await enfocado(page)).toBe('capa'); // el foco se queda en el mapa
    await expect(page.locator('#anuncio')).toContainText(otro);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/municipio\//);
    await expect(page.locator('h1')).toContainText(otro);
  });

  test('#/fechas: los días del calendario son una parada de Tab y se recorren con las flechas', async ({ page }) => {
    await abrir(page, '#/fechas');
    await expect(page.locator('#zMeses [tabindex="0"]')).toHaveCount(1);
    await page.locator('#zMeses [tabindex="0"]').focus();
    const antes = await page.locator('#zLectura').textContent();
    await page.keyboard.press('ArrowDown');
    const despues = await page.locator('#zLectura').textContent();
    expect(despues).not.toBe(antes);
    await page.keyboard.press('Enter');
    await expect(page.locator('#zMeses [aria-pressed="true"]')).toHaveCount(1);
    await page.keyboard.press('Tab'); // al salir, la lectura se queda en el día fijado
    await expect(page.locator('#zLectura')).toHaveText(despues);
  });

});

// axe-core no mide el contraste del foco (WCAG 1.4.11): el anillo es ámbar con una banda oscura por fuera,
// para que uno de los dos pase 3:1 tanto sobre el papel blanco como sobre la foto.
test('el foco se ve sobre el papel blanco: anillo ámbar con banda oscura', async ({ page }) => {
  await abrir(page, '#/metodo');
  await page.keyboard.press('Tab');
  const estilo = await page.evaluate(() => {
    const s = getComputedStyle(document.activeElement);
    return { outline: s.outlineColor, ancho: s.outlineWidth, sombra: s.boxShadow };
  });
  expect(estilo.outline).toBe('rgb(245, 160, 76)');
  expect(estilo.ancho).toBe('3px');
  expect(estilo.sombra).toContain('rgb(10, 14, 20)');
});
