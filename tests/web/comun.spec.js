// Criterios que valen para todas las páginas (spec, «Criterios de aceptación» 2, 5 y 10).
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { abrir, revisarAxe, RUTAS, TAMANOS } = require('./ayudas');

const leer = (l) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'textos', l + '.json'), 'utf8'));
const ES = leer('es');
const EN = leer('en');

// Pedazos de texto que solo existen en español: lo que queda de cada texto al quitar sus {variables}.
function soloEspanol() {
  const pedazos = new Set();
  for (const [clave, valor] of Object.entries(ES)) {
    const lista = (Array.isArray(valor) ? valor : [valor]).flat(); // los atajos son pares [teclas, qué hacen]
    const ingles = JSON.stringify(EN[clave] ?? '');
    for (const v of lista) {
      for (const p of v.split(/\{\w+\}/)) {
        const s = p.trim();
        if (s.length >= 5 && /[a-záéíóúñ]/i.test(s) && !ingles.includes(s)) pedazos.add(s);
      }
    }
  }
  return [...pedazos];
}

test('los dos idiomas tienen las mismas claves', () => {
  expect(Object.keys(EN).sort()).toEqual(Object.keys(ES).sort());
});

for (const ruta of RUTAS) {
  for (const { ancho, alto } of TAMANOS) {
    test(`${ruta} a ${ancho}×${alto}: nada se sale por los lados y axe no encuentra violaciones serias`, async ({ page }) => {
      await abrir(page, ruta, { ancho, alto });
      const { scroll, ventana } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, ventana: window.innerWidth }));
      expect(scroll).toBeLessThanOrEqual(ventana);
      expect(await revisarAxe(page)).toEqual([]);
    });
  }

  test(`${ruta}: ningún texto queda sin llenar`, async ({ page }) => {
    await abrir(page, ruta);
    const texto = await page.evaluate(() => document.body.innerText);
    expect(texto).not.toMatch(/\{\w+\}/);
    const vacios = await page.$$eval('[data-t]', (es) => es.filter((e) => !e.hidden && !e.closest('[hidden]') && !e.textContent.trim()).map((e) => e.dataset.t));
    expect(vacios).toEqual([]);
  });

  test(`${ruta} en inglés: no queda texto en español`, async ({ page }) => {
    await abrir(page, ruta, { query: '?lang=en' });
    const texto = await page.evaluate(() => {
      const atributos = [...document.querySelectorAll('[aria-label], [placeholder]')].map((e) => (e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('placeholder') || ''));
      return document.body.innerText + ' ' + atributos.join(' ') + ' ' + document.title;
    });
    const quedan = soloEspanol().filter((s) => texto.includes(s));
    expect(quedan).toEqual([]);
    expect(await page.getAttribute('html', 'lang')).toBe('en');
  });
}

test('el idioma elegido se queda al cambiar de página', async ({ page }) => {
  await abrir(page, '#/');
  await page.click('[data-idioma="en"]');
  // La pregunta cambia de tiempo verbal cuando la temporada ya cerró.
  expect([EN.titulo, EN.tituloPasado]).toContain(await page.locator('#titulo').textContent());
  await page.click('.nav a[href="#/fechas"]');
  await expect(page.locator('h2#almTitulo')).toHaveText(EN.fechasPagina);
  await page.reload();
  await expect(page.locator('h2#almTitulo')).toHaveText(EN.fechasPagina);
});
