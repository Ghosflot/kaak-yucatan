// Cómo lo medimos (#/metodo): qué es un foco de calor, el salto de 2012, ¿se puede confiar? y la descarga.
// Spec, «Cómo lo medimos»; las cifras salen de web/datos/metodo.json.
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { abrir } = require('./ayudas');

const M = JSON.parse(fs.readFileSync('web/datos/metodo.json', 'utf8'));
const uno = (n) => n.toFixed(1);

test('explica qué es un foco de calor y qué no es', async ({ page }) => {
  await abrir(page, '#/metodo');
  await expect(page.locator('h1')).toHaveText('Cómo lo medimos');
  await expect(page.locator('#mFoco h2')).toHaveText('Qué es un foco de calor');
  await expect(page.locator('#mFoco')).toContainText('cuadrito de 1 km con fuego en un día');
  await expect(page.locator('#mFoco')).toContainText('no distingue una quema de milpa de un incendio');
  await expect(page.locator('#mFoco')).toContainText('no quiere decir que no hubo fuego');
});

test('un satélite por periodo, con sus fechas', async ({ page }) => {
  await abrir(page, '#/metodo');
  const periodos = page.locator('#mPeriodos li');
  await expect(periodos).toHaveCount(4);
  await expect(periodos.nth(0)).toContainText('Terra');
  await expect(periodos.nth(2)).toContainText('del 20 de enero de 2012 al 2 de noviembre de 2026');
  await expect(periodos.nth(3)).toContainText('desde el 3 de noviembre de 2026');
  await expect(page.locator('#mUnir')).toContainText(`entre ${uno(M.factores.aqua[0])} y ${uno(M.factores.aqua[1])}`);
});

test('el salto de 2012: el interruptor pasa de sin calibrar a calibrado', async ({ page }) => {
  await abrir(page, '#/metodo');
  const barras = page.locator('#salto rect.m-barra');
  await expect(barras).toHaveCount(26);
  const escala = (y) => page.locator(`#salto rect.m-barra[data-y="${y}"]`).evaluate((r) => Number(r.style.transform.match(/scaleY\(([\d.]+)\)/)[1]));
  await page.click('[data-ver="crudo"]');
  await expect(page.locator('[data-ver="crudo"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#mSalto')).toContainText(`por ${uno(M.salto.crudo)}`);
  await expect(page.locator('#mRayas')).toBeHidden();
  const crudo2011 = await escala(2011), crudo2013 = await escala(2013);
  await page.click('[data-ver="armonizado"]');
  await expect(page.locator('#mSalto')).toContainText(`por ${M.salto.armonizado.toFixed(2)}`);
  await expect(page.locator('#mRayas')).toBeVisible();
  // Desde 2012 las dos series son la misma; antes, sin calibrar queda abajo.
  expect(await escala(2013)).toBe(crudo2013);
  expect(await escala(2011)).toBeGreaterThan(crudo2011);
  await expect(page.locator('#salto rect.m-barra[data-y="2011"]')).toHaveAttribute('fill', 'url(#salto-rayas)');
});

test('el salto se calibra solo al llegar a la gráfica, una vez', async ({ page }) => {
  await abrir(page, '#/metodo');
  await expect(page.locator('[data-ver="crudo"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#salto').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-ver="armonizado"]')).toHaveAttribute('aria-pressed', 'true', { timeout: 4000 });
});

test('con «reducir movimiento» abre ya calibrado', async ({ page }) => {
  await abrir(page, '#/metodo', { reducir: true });
  await expect(page.locator('[data-ver="armonizado"]')).toHaveAttribute('aria-pressed', 'true');
});

test('¿Se puede confiar?: el cruce con CONAFOR y los dos satélites de ahora', async ({ page }) => {
  await abrir(page, '#/metodo');
  const c = page.locator('#mConfiar');
  await expect(c.locator('h2')).toHaveText('¿Se puede confiar?');
  await expect(c).toContainText(M.conafor.vistos + ' %');
  await expect(c).toContainText('1,222');
  await expect(c).toContainText(M.conafor.azar + ' %');
  await expect(c).toContainText(M.conafor.grandes + ' %');
  await expect(c).toContainText(M.factores.noaa20.toFixed(2));
  await expect(c).toContainText('no quemas agrícolas');
});

test('el pie dice el periodo de cada fuente', async ({ page }) => {
  await abrir(page, '#/metodo');
  const primero = M.anios[0].y, ultimo = M.anios[M.anios.length - 1].y;
  await expect(page.locator('#pie')).toContainText(`FIRMS (NASA), de ${primero} a ${ultimo}`);
  await expect(page.locator('#pie')).toContainText(`CONAFOR, de ${M.conafor.desde} a ${M.conafor.hasta}`);
});

test('la descarga baja la serie completa', async ({ page }) => {
  await abrir(page, '#/metodo');
  const enlace = page.locator('#serie');
  await expect(enlace).toHaveAttribute('href', '/datos/serie_armonizada.csv');
  await expect(enlace).toContainText(M.serieMB + ' MB');
  const [descarga] = await Promise.all([page.waitForEvent('download'), enlace.click()]);
  expect(descarga.suggestedFilename()).toBe('kaak-serie-armonizada.csv');
});

test('en inglés', async ({ page }) => {
  await abrir(page, '#/metodo', { query: '?lang=en' });
  await expect(page.locator('h1')).toHaveText('How we measure it');
  await expect(page.locator('#mFoco h2')).toHaveText('What a hot spot is');
  await expect(page.locator('#mPeriodos li').nth(3)).toContainText('since November 3, 2026');
});
