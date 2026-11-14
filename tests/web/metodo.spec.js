// Cómo lo medimos (#/metodo): qué es un foco de calor, el salto de 2012, ¿se puede confiar? y la descarga.
// Spec, «Cómo lo medimos»; las cifras salen de web/datos/metodo.json.
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { abrir } = require('./ayudas');

const M = JSON.parse(fs.readFileSync('web/datos/metodo.json', 'utf8'));
const V = JSON.parse(fs.readFileSync('web/datos/validacion.json', 'utf8'));
const SAT = JSON.parse(fs.readFileSync('web/datos/satelites.json', 'utf8'));
const ES = JSON.parse(fs.readFileSync('web/textos/es.json', 'utf8'));
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

test('¿Se puede confiar?: una tarjeta por prueba, con la frase de su caso', async ({ page }) => {
  await abrir(page, '#/metodo');
  const c = page.locator('#mConfiar');
  await expect(c.locator('h2')).toHaveText('¿Se puede confiar?');
  const tarjetas = c.locator('.m-prueba');
  await expect(tarjetas).toHaveCount(V.pruebas.length);
  for (const p of V.pruebas) {
    const tj = c.locator(`.m-prueba[data-prueba="${p.id}"]`);
    // La frase del caso que salió, con sus números (como t() en web/js/textos.js).
    const frase = ES[p.clave].replace(/\{(\w+)\}/g, (m, k) => String(p.valores[k]));
    await expect(tj.locator('p').first()).toHaveText(frase);
    // La gráfica se dibuja en la página (ya no es una imagen).
    await expect(tj.locator('img')).toHaveCount(0);
    await expect(tj.locator('.m-prueba-graf svg')).toHaveAttribute('role', 'img');
    expect(await tj.locator('.m-prueba-graf svg > *').count()).toBeGreaterThan(5);
    await expect(tj.locator('.m-pendiente')).toHaveCount(0);
  }
  // Ya no dice que los satélites coinciden sin la prueba, ni una cifra de azar fija.
  await expect(c).not.toContainText('Los satélites de ahora coinciden');
  const conafor = c.locator('.m-prueba[data-prueba="conafor"]');
  await expect(conafor).toContainText(V.pruebas.find((p) => p.id === 'conafor').valores.azarSnpp + ' %');
  await conafor.locator('summary').click();
  await expect(conafor.locator('details li').first()).toBeVisible();
  await expect(conafor).toContainText('no quemas agrícolas');
});

test('cada satélite contra la serie: se elige el satélite y la escala', async ({ page }) => {
  await abrir(page, '#/metodo');
  const caja = page.locator('#mSat');
  await expect(caja).toBeVisible();
  await expect(caja.locator('[data-sat]')).toHaveCount(SAT.satelites.length);
  // Abre con Aqua calibrado: la línea es continua.
  await expect(caja.locator('[data-sat="Aqua"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(caja.locator('[data-esc="cal"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(caja.locator('polyline')).toHaveAttribute('stroke-dasharray', 'none');
  await expect(caja.locator('circle')).toHaveCount(SAT.satelites.find((x) => x.sat === 'Aqua').anios.length);
  await caja.locator('[data-esc="crudo"]').click();
  await expect(caja.locator('polyline')).toHaveAttribute('stroke-dasharray', '6 4');
  await expect(caja.locator('#mSatLey')).toContainText('Aqua sin calibrar');
  // S-NPP es la escala: no lleva factor ni banda.
  await caja.locator('[data-sat="S-NPP"]').click();
  await expect(caja.locator('#mSatLectura')).toContainText('×1');
  await expect(caja.locator('#mSatLey')).not.toContainText('factor');
  // NOAA-20: su factor sale de los mismos años, y la página lo dice.
  await caja.locator('[data-sat="NOAA-20"]').click();
  await expect(caja.locator('#mSatLectura')).toContainText('no es una comprobación independiente');
  await expect(caja.locator('#mSatLectura')).toContainText('En 2018 le falta el principio');
});

test('¿Se puede confiar? en inglés: las gráficas también', async ({ page }) => {
  await abrir(page, '#/metodo', { query: '?lang=en' });
  await expect(page.locator('#mConfiar h2')).toHaveText('Can it be trusted?');
  await expect(page.locator('.m-prueba[data-prueba="viirs"] .m-sat-ley')).toContainText('NOAA-20 with its factor');
  await expect(page.locator('.m-prueba[data-prueba="salto_2012"] svg')).toContainText('calibrated ×0.90');
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
