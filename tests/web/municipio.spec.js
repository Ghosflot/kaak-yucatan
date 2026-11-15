// Página de un municipio (#/municipio/<id>) y su ficha: spec, «Municipio» y «La ficha para WhatsApp».
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { abrir } = require('./ayudas');

test('Tekax: veredicto, barras por año y llave', async ({ page }) => {
  await abrir(page, '#/municipio/tekax');
  await expect(page.locator('h1')).toHaveText('Tekax');
  await expect(page.locator('#frase')).toHaveText('Hubo menos fuego que en un año normal.');
  await expect(page.locator('#cifras')).toContainText('213');
  await expect(page.locator('#barrasMun .toque')).toHaveCount(26);
  await expect(page.locator('#ventana')).toBeVisible();
  await expect(page.locator('#llave')).toContainText('8 de cada 10 focos');
  await expect(page.locator('#llave')).toContainText('después del 3 de abril');
});

test('zona 2: la ventana llega al 31 de mayo y la llave cuenta lo de antes', async ({ page }) => {
  await abrir(page, '#/municipio/merida');
  await expect(page.locator('#llave')).toContainText('antes del 20 de abril');
});

test('Calakmul: sin sombra ni llave, y la nota remite a su estado', async ({ page }) => {
  await abrir(page, '#/municipio/calakmul');
  await expect(page.locator('#ventana')).toBeHidden();
  await expect(page.locator('#llave')).toBeHidden();
  await expect(page.locator('#notaFechas')).toContainText('Campeche');
});

test('un id que no existe dice que no está y ofrece el buscador', async ({ page }) => {
  await abrir(page, '#/municipio/no-existe');
  await expect(page.locator('h1')).toHaveText('No encontramos ese municipio.');
  await page.fill('#buscam', 'tekax');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/municipio\/tekax$/);
  await expect(page.locator('h1')).toHaveText('Tekax');
});

test('tocar un año cambia la gráfica de días; tocarlo otra vez vuelve a lo normal', async ({ page }) => {
  await abrir(page, '#/municipio/tekax');
  await page.click('#barrasMun .toque[aria-label^="2003"]');
  await expect(page.locator('#cuandoSub')).toContainText('2003');
  await expect(page.locator('#llave')).toContainText('En 2003');
  await expect(page.locator('#diasBarras')).toHaveClass(/con-anio/);
  await page.click('#barrasMun .toque[aria-label^="2003"]');
  await expect(page.locator('#cuandoSub')).toHaveText('Focos de calor de un año normal, día por día.');
  await expect(page.locator('#diasBarras')).not.toHaveClass(/con-anio/);
  await expect(page.locator('#diasBarras .a')).toHaveCount(0);
});

test('los años también se eligen con el teclado', async ({ page }) => {
  await abrir(page, '#/municipio/tekax');
  await page.focus('#barrasMun .toque[aria-label^="2020"]');
  await page.keyboard.press('Enter');
  await expect(page.locator('#cuandoSub')).toContainText('2020');
  await page.click('#verNormal');
  await expect(page.locator('#verNormal')).toBeHidden();
});

test('con un solo foco la frase va en singular', async ({ page }) => {
  await abrir(page, '#/municipio/baca');
  await expect(page.locator('#cifras')).toContainText('1 foco de calor de marzo');
});

test('la ficha mide 1080 × 1350 y «Descargar imagen» baja un PNG', async ({ page }) => {
  await abrir(page, '#/municipio/tekax');
  const tam = await page.$eval('#ficha', (c) => [c.width, c.height]);
  expect(tam).toEqual([1080, 1350]);
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.click('#descargar')]);
  expect(descarga.suggestedFilename()).toBe('kaak-tekax.png');
  const datos = fs.readFileSync(await descarga.path());
  expect(datos.subarray(1, 4).toString()).toBe('PNG');
  expect(datos.length).toBeGreaterThan(20000);
});

test('la tabla CSV lleva BOM y un renglón por día de cada año', async ({ page }) => {
  await abrir(page, '#/municipio/tekax');
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.click('#csv')]);
  expect(descarga.suggestedFilename()).toBe('kaak-tekax.csv');
  const texto = fs.readFileSync(await descarga.path(), 'utf8');
  expect(texto.charCodeAt(0)).toBe(0xfeff);
  const renglones = texto.slice(1).trimEnd().split('\r\n');
  expect(renglones[0]).toBe('fecha,año,focos_de_calor,un_año_normal');
  expect(renglones.length).toBe(1 + 26 * 92);
  expect(renglones[1]).toMatch(/^2001-03-01,2001,/);
});

test('el enlace corto de la ficha (kaak.pages.dev/tekax) abre el municipio', async ({ page }) => {
  await abrir(page, '#/');
  const r = await page.evaluate(async () => (await import('/js/app.js')).ruta('', '/tekax'));
  expect(r).toEqual({ vista: 'municipio', params: { id: 'tekax' } });
  const inicio = await page.evaluate(async () => (await import('/js/app.js')).ruta('#/', '/tekax'));
  expect(inicio.vista).toBe('portada');
});

test('en inglés, la página y la ficha cambian de idioma', async ({ page }) => {
  await abrir(page, '#/municipio/tekax', { query: '?lang=en' });
  await expect(page.locator('#frase')).toHaveText('There was less fire than in a normal year.');
  await expect(page.locator('#llave')).toContainText('8 in 10 hot spots');
  await expect(page.locator('#ficha')).toHaveAttribute('aria-label', /Tekax’s card/);
});

test('«la mitad» se decide con las cifras que se leen: 19 contra 42 es menos de la mitad', async ({ page }) => {
  // Umán: 19 focos de calor contra 42 en un año normal.
  await abrir(page, '#/municipio/uman');
  await expect(page.locator('#cifras')).toContainText('19 focos de calor');
  await expect(page.locator('#frase')).toHaveText('Hubo menos de la mitad del fuego que en un año normal.');
});
