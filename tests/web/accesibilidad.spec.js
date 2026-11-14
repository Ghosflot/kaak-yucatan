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

test('el foco no se pierde cuando desaparece el botón que se tocó', async ({ page }) => {
  await abrir(page, '#/');
  await page.locator('#verTemporada').focus();
  await page.keyboard.press('Enter');
  expect(await enfocado(page)).toBe('control');
  await page.keyboard.press('End');
  await page.locator('#barras .toque[data-y="2003"]').click();
  await page.click('#volver');
  expect(await enfocado(page)).toBe('resultado');
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

test('la línea de tiempo dice de qué año es', async ({ page }) => {
  await abrir(page, '#/', { reducir: true });
  await expect(page.locator('#tiempo')).toHaveAttribute('aria-label', 'Día de la temporada 2026');
  await page.locator('#barras .toque[data-y="2003"]').click();
  await expect(page.locator('#tiempo')).toHaveAttribute('aria-label', 'Día de la temporada 2003');
});

test('en la foto, tocar el mapa empieza la temporada y no salta al cierre', async ({ page }) => {
  await abrir(page, '#/');
  await page.locator('.rellenos path[data-id="tekax"]').click({ force: true });
  await expect(page.locator('#escenario')).toHaveAttribute('data-modo', 'repaso');
  await expect(page.locator('#tarjeta')).toBeHidden();
  // El botón que se tocó desaparece: el foco pasa al control del repaso.
  expect(await enfocado(page)).toBe('control');
});

test('«Tekax» en el mapa del cierre va en claro sobre el verde oscuro', async ({ page }) => {
  await abrir(page, '#/', { reducir: true });
  const color = await page.locator('.nota-mapa.enlace').evaluate((e) => getComputedStyle(e).color);
  expect(color).toBe('rgb(246, 244, 240)');
});

test.describe('con el dedo', () => {
  test.use({ hasTouch: true, isMobile: true });

  // Gestos de verdad (CDP), para que el navegador aplique touch-action como en un teléfono.
  async function deslizar(page, desde, hasta, pasos = 8) {
    const cdp = await page.context().newCDPSession(page);
    const punto = (x, y) => [{ x: Math.round(x), y: Math.round(y) }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punto(...desde) });
    for (let i = 1; i <= pasos; i++) {
      const x = desde[0] + ((hasta[0] - desde[0]) * i) / pasos, y = desde[1] + ((hasta[1] - desde[1]) * i) / pasos;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: punto(x, y) });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  test('deslizar hacia arriba sobre la línea de tiempo desplaza la página y no mueve el repaso', async ({ page }) => {
    await abrir(page, '#/', { ancho: 390, alto: 844 });
    await page.click('#verTemporada');
    await page.click('#control'); // pausa
    await page.locator('#tiempo').scrollIntoViewIfNeeded();
    const dia = await page.locator('#tiempo').getAttribute('aria-valuenow');
    const r = await page.locator('#tiempo').boundingBox();
    const y0 = await page.evaluate(() => scrollY);
    await deslizar(page, [r.x + r.width * 0.8, r.y + r.height / 2], [r.x + r.width * 0.8, r.y + r.height / 2 - 200]);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y0 + 50);
    expect(await page.locator('#tiempo').getAttribute('aria-valuenow')).toBe(dia);
  });

  test('deslizar de lado mueve el repaso, y un toque lleva al día tocado', async ({ page }) => {
    await abrir(page, '#/', { ancho: 390, alto: 844 });
    await page.click('#verTemporada');
    await page.click('#control');
    await page.locator('#tiempo').scrollIntoViewIfNeeded();
    const r = await page.locator('#tiempo').boundingBox();
    const y = r.y + r.height / 2;
    await deslizar(page, [r.x + r.width * 0.1, y], [r.x + r.width * 0.6, y]);
    expect(Number(await page.locator('#tiempo').getAttribute('aria-valuenow'))).toBe(Math.floor(0.6 * 92));
    await page.touchscreen.tap(r.x + r.width * 0.3, y);
    await expect(page.locator('#tiempo')).toHaveAttribute('aria-valuenow', String(Math.floor(0.3 * 92)));
  });
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
    await expect(page.locator('#tarjeta .nombre')).toHaveText('Umán'); // la primera flecha empieza en el ejemplo
    await page.keyboard.press('ArrowUp');
    const otro = await page.locator('#tarjeta .nombre').textContent();
    expect(otro).not.toBe('Umán');
    expect(await enfocado(page)).toBe('capa'); // el foco se queda en el mapa
    await expect(page.locator('#anuncio')).toContainText(otro);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/municipio\//);
    await expect(page.locator('h1')).toContainText(otro);
  });

  test('la tira de días se recorre con las flechas y lleva el repaso a cada día', async ({ page }) => {
    await abrir(page, '#/', { reducir: true });
    await expect(page.locator('#tira')).toHaveAttribute('role', 'slider');
    await page.locator('#tira').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#escenario')).toHaveAttribute('data-modo', 'repaso');
    await expect(page.locator('#fecha')).toHaveText('1 de marzo');
    await page.keyboard.press('PageUp');
    await expect(page.locator('#fecha')).toHaveText('8 de marzo');
    await expect(page.locator('#tira')).toHaveAttribute('aria-valuetext', /8 mar/);
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

  test('con «reducir movimiento», «Repetir» lleva al primer día sin animar', async ({ page }) => {
    await abrir(page, '#/', { reducir: true });
    await page.locator('#control').click();
    await expect(page.locator('#escenario')).toHaveAttribute('data-modo', 'repaso');
    await page.waitForTimeout(400);
    await expect(page.locator('#tiempo')).toHaveAttribute('aria-valuenow', '0');
    await expect(page.locator('#control')).toHaveAttribute('aria-label', 'Seguir');
  });
});
