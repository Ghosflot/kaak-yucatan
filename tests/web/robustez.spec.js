// Robustez de la navegación y de la carga.
const path = require('path');
const { test, expect } = require('@playwright/test');
const { abrir } = require('./ayudas');

const fs = require('fs');
const PORTADA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'datos', 'portada.json'), 'utf8'));
const INDEX = path.join(__dirname, '..', '..', 'web', 'index.html');
const TITULO = "K'áak': ¿se quema más de lo normal en tu municipio?";

test('el enlace corto con barra al final (/tekax/) carga los estilos y abre Tekax', async ({ page }) => {
  // Cloudflare Pages responde index.html a cualquier ruta; el servidor de pruebas, no.
  await page.route('**/tekax/', (r) => r.fulfill({ path: INDEX, contentType: 'text/html' }));
  await page.goto('/tekax/');
  await expect(page.locator('h1')).toHaveText('Tekax');
  const fuente = await page.locator('h1').evaluate((e) => getComputedStyle(e).fontFamily);
  expect(fuente).toContain('Alfa Slab One');
});

test('un ancla mal escrita dice que el municipio no existe en lugar de dejar la página en blanco', async ({ page }) => {
  await abrir(page, '#/municipio/%E0%A4');
  await expect(page.locator('h1')).toHaveText('No encontramos ese municipio.');
});

test('al salir de un municipio, la pestaña vuelve al título de la página', async ({ page }) => {
  await abrir(page, '#/municipio/tekax');
  await expect(page).toHaveTitle(/^Tekax/);
  await page.evaluate(() => { location.hash = '#/metodo'; });
  await expect(page.locator('#vista')).toHaveClass(/vista-metodo/);
  await expect(page).toHaveTitle("Cómo lo medimos — K'áak'");
  await page.evaluate(() => { location.hash = '#/'; });
  await expect(page.locator('#vista')).toHaveClass(/vista-portada/);
  await expect(page).toHaveTitle(TITULO);
});

test('ir a otra página y volver antes de que cargue no deja montada la otra', async ({ page }) => {
  // «Cómo lo medimos» tarda en llegar; mientras, la persona vuelve a la portada.
  await page.route('**/js/vistas/metodo.js', async (r) => { await new Promise((ok) => setTimeout(ok, 400)); await r.continue(); });
  await abrir(page, '#/');
  await page.evaluate(() => new Promise((listo) => {
    window.addEventListener('hashchange', () => queueMicrotask(() => { location.hash = '#/'; listo(); }), { once: true });
    location.hash = '#/metodo';
  }));
  await page.waitForTimeout(900);
  await expect(page.locator('#vista')).toHaveClass(/vista-portada/);
});

test('salir y volver a la portada mientras cargan los datos no duplica el mapa', async ({ page }) => {
  let soltar;
  const espera = new Promise((r) => { soltar = r; });
  await page.route('**/datos/portada.json', async (r) => { await espera; await r.continue(); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/');
  await expect(page.locator('#vista')).toHaveClass(/vista-portada/);
  await page.evaluate(() => { location.hash = '#/fechas'; });
  await expect(page.locator('#vista')).toHaveClass(/vista-fechas/);
  await page.evaluate(() => { location.hash = '#/'; });
  await expect(page.locator('#vista')).toHaveClass(/vista-portada/);
  soltar();
  await expect(page.locator('#rellenos path')).toHaveCount(127);
  await page.waitForTimeout(300);
  await expect(page.locator('#rellenos path')).toHaveCount(127);
});

test('cambiar de idioma mientras carga un municipio no muestra «no existe»', async ({ page }) => {
  let soltar;
  const espera = new Promise((r) => { soltar = r; });
  await page.route('**/datos/municipio/tekax.json', async (r) => { await espera; await r.continue(); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/municipio/tekax');
  await page.locator('[data-idioma="en"]').click();
  await page.waitForTimeout(200);
  await expect(page.locator('h1')).toHaveCount(0);
  soltar();
  await expect(page.locator('h1')).toHaveText('Tekax');
  await expect(page.locator('#frase')).toHaveText('There was half as much fire as in a normal year.');
});

test('compartir la ficha abre la hoja de compartir en el mismo clic (Safari lo exige)', async ({ page }) => {
  await page.addInitScript(() => {
    // El clic «sigue vivo» hasta la siguiente tarea; Safari pierde el permiso si se espera al PNG.
    document.addEventListener('click', () => { window.enClic = true; setTimeout(() => { window.enClic = false; }, 0); }, true);
    navigator.canShare = () => true;
    navigator.share = () => { window.compartidoEnClic = window.enClic; return Promise.resolve(); };
  });
  await abrir(page, '#/municipio/tekax');
  await expect(page.locator('#ficha')).toHaveAttribute('aria-label', /Tekax/);
  await page.waitForTimeout(500);
  await page.click('#compartir');
  await expect.poll(() => page.evaluate(() => window.compartidoEnClic)).toBe(true);
});

test('al pausar el repaso, la cifra dice lo mismo que el lector de pantalla', async ({ page }) => {
  await page.clock.install();
  await abrir(page, '#/');
  await page.click('#verTemporada');
  // Pausa a medio camino entre dos días de abril, cuando el acumulado sube rápido.
  for (let i = 0; i < 45; i++) await page.clock.runFor(100);
  await page.clock.runFor(50);
  await page.click('#control'); // pausa
  const dia = Number(await page.locator('#tiempo').getAttribute('aria-valuenow'));
  const acum = PORTADA.yuc.acum['2026'];
  expect(acum[dia + 1]).toBeGreaterThan(acum[dia] + 1); // si no, la prueba no distingue nada
  await expect(page.locator('#n26')).toHaveText(Math.round(acum[dia]).toLocaleString('es-MX'));
});
