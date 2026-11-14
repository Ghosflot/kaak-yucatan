// Fechas de quema (#/fechas): el calendario de cada zona de Yucatán y el almanaque por municipio.
// Spec, «Fechas de quema».
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { abrir } = require('./ayudas');

test('abre en la zona 2: la misma cifra que la portada y sus 42 días permitidos', async ({ page }) => {
  await abrir(page, '#/fechas');
  await expect(page.locator('h1')).toHaveText('En la zona 2, de enero a junio de 2026, 4 de cada 10 focos se vieron fuera de las fechas permitidas.');
  await expect(page.locator('#zona')).toHaveValue('2');
  await expect(page.locator('.fz-dia')).toHaveCount(181);
  await expect(page.locator('.fz-dia.permitido')).toHaveCount(42);
  await expect(page.locator('#zSeder')).toContainText('del 20 de abril al 31 de mayo');
  await expect(page.locator('#zSeder')).toContainText('240 focos antes de esas fechas');
  await expect(page.locator('#zInferidos')).toContainText('Baca');
});

test('cambiar de zona cambia el calendario, el titular y el enlace', async ({ page }) => {
  await abrir(page, '#/fechas');
  await page.selectOption('#zona', '4');
  await expect(page.locator('h1')).toContainText('casi todos los focos');
  await expect(page.locator('.fz-dia.permitido')).toHaveCount(25);
  await expect(page).toHaveURL(/#\/fechas\/4$/);
  await expect(page.locator('#zInferidos')).toBeHidden();
});

test('el enlace #/fechas/1 abre la zona 1', async ({ page }) => {
  await abrir(page, '#/fechas/1');
  await expect(page.locator('#zona')).toHaveValue('1');
  await expect(page.locator('h1')).toContainText('9 de cada 10');
});

test('«¿Cuál es mi zona?»: buscar el municipio elige su zona', async ({ page }) => {
  await abrir(page, '#/fechas');
  await page.fill('#busca3', 'tekax');
  await page.keyboard.press('Enter');
  await expect(page.locator('#zona')).toHaveValue('3');
  await expect(page.locator('#zMiZona')).toHaveText('Tekax está en la zona 3.');
  await page.selectOption('#zona', '1');
  await expect(page.locator('#zMiZona')).toBeHidden();
  await page.fill('#busca3', 'baca');
  await page.keyboard.press('Enter');
  await expect(page.locator('#zMiZona')).toHaveText('Baca está, probablemente, en la zona 2.');
});

test('tocar el mapa elige la zona del municipio tocado', async ({ page }) => {
  await abrir(page, '#/fechas');
  await page.click('#zMapa path[data-id="tekax"]', { force: true });
  await expect(page.locator('#zona')).toHaveValue('3');
});

test('tocar un día dice cuántos focos hubo y si se permitía quemar', async ({ page }) => {
  await abrir(page, '#/fechas');
  await page.click('.fz-dia[data-i="120"]');
  await expect(page.locator('#zLectura')).toContainText('1 de mayo');
  await expect(page.locator('#zLectura')).toContainText('Se permite quemar');
  await page.click('.fz-dia[data-i="0"]');
  await expect(page.locator('#zLectura')).toContainText('1 de enero');
  await expect(page.locator('#zLectura')).toContainText('Fuera de las fechas permitidas');
});

test('almanaque: 127 renglones y la ventana marcada en los meses de cada municipio de Yucatán', async ({ page }) => {
  await abrir(page, '#/fechas');
  await expect(page.locator('#almanaque tbody tr')).toHaveCount(127);
  const tekax = page.locator('#almanaque tr[data-id="tekax"]');
  await expect(tekax.locator('td.mes:nth-of-type(3) .v')).toHaveCount(1); // marzo
  await expect(tekax.locator('td.mes:nth-of-type(4) .v')).toHaveCount(1); // abril
  await expect(tekax.locator('.v')).toHaveCount(2);
  await expect(tekax.locator('th')).toContainText('10 mar al 3 abr');
  await expect(page.locator('#almanaque tr[data-id="calakmul"] .v')).toHaveCount(0);
  const yuc = await page.$$eval('#almanaque tr[data-e="Yucatán"]', (rs) => rs.filter((r) => !r.querySelector('.v')).length);
  expect(yuc).toBe(0);
});

test('buscar y filtrar por estado', async ({ page }) => {
  await abrir(page, '#/fechas');
  await page.fill('#almBuscar', 'tek');
  await expect(page.locator('#almanaque tbody tr:not([hidden])')).toHaveCount(5); // Tekal de Venegas, Tekantó, Tekax, Tekit y Tekom
  await page.fill('#almBuscar', '');
  await page.click('[data-estado="Campeche"]');
  await expect(page.locator('#almanaque tbody tr:not([hidden])')).toHaveCount(11);
  await expect(page.locator('#almConteo')).toContainText('11');
  await page.fill('#almBuscar', 'zzz');
  await expect(page.locator('#almVacio')).toBeVisible();
});

test('la descarga baja fechas.csv con los municipios del filtro, con BOM', async ({ page }) => {
  await abrir(page, '#/fechas');
  await page.click('[data-estado="Quintana Roo"]');
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.click('#almCsv')]);
  expect(descarga.suggestedFilename()).toBe('fechas.csv');
  const texto = fs.readFileSync(await descarga.path(), 'utf8');
  expect(texto.charCodeAt(0)).toBe(0xfeff);
  const renglones = texto.slice(1).trimEnd().split('\r\n');
  expect(renglones.length).toBe(1 + 10);
  expect(renglones[0]).toMatch(/^municipio,estado,zona,se_permite_desde,se_permite_hasta,ene_normal,/);
  expect(renglones[0].split(',').length).toBe(5 + 24);
});

test('«2026» pinta los meses de este año', async ({ page }) => {
  await abrir(page, '#/fechas');
  const antes = await page.getAttribute('#almanaque tr[data-id="tekax"] td.mes:nth-of-type(4)', 'title');
  await page.click('[data-anio="2026"]');
  const despues = await page.getAttribute('#almanaque tr[data-id="tekax"] td.mes:nth-of-type(4)', 'title');
  expect(antes).toContain('un año normal');
  expect(despues).toContain('2026');
});

test('de entrada se ven 12 renglones; «Ver los restantes» abre y cierra la tabla', async ({ page }) => {
  await abrir(page, '#/fechas');
  const vistos = page.locator('#almanaque tbody tr:not([hidden])');
  await expect(vistos).toHaveCount(12);
  const mas = page.locator('#almMas');
  await expect(mas).toHaveText('Ver los 115 municipios restantes');
  await expect(mas).toHaveAttribute('aria-expanded', 'false');
  await mas.click();
  await expect(vistos).toHaveCount(127);
  await expect(mas).toHaveText('Ver menos municipios');
  await mas.click();
  await expect(vistos).toHaveCount(12);
  // Con Yucatán se acorta igual; al buscar se ve todo lo que coincide y el botón se va.
  await page.click('[data-estado="Yucatán"]');
  await expect(mas).toHaveText('Ver los 94 municipios restantes');
  await page.fill('#almBuscar', 'a');
  await expect(mas).toBeHidden();
  expect(await vistos.count()).toBeGreaterThan(12);
});

test('la zona de un renglón lleva a su calendario', async ({ page }) => {
  await abrir(page, '#/fechas');
  await page.fill('#almBuscar', 'tekax');
  await page.click('#almanaque tr[data-id="tekax"] .a-zona');
  await expect(page.locator('#zona')).toHaveValue('3');
});

test('en inglés', async ({ page }) => {
  await abrir(page, '#/fechas', { query: '?lang=en' });
  await expect(page.locator('h1')).toHaveText('In zone 2, from January to June 2026, 4 in 10 hot spots were seen outside the allowed dates.');
});
