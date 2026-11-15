// Portada (#/): criterios 1, 2, 3, 4, 7, 8 y 9 de la especificación.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { abrir } = require('./ayudas');

const PORTADA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'datos', 'portada.json'), 'utf8'));

for (const [ancho, alto] of [[1440, 900], [1280, 720]]) {
  test(`a ${ancho}×${alto} se ven la pregunta, la respuesta y el mapa sin desplazarse`, async ({ page }) => {
    await abrir(page, '#/', { ancho, alto });
    for (const sel of ['#titulo', '#respuesta', '#mapa', '#busca1']) {
      const r = await page.locator(sel).boundingBox();
      expect(r, sel).not.toBeNull();
      expect(r.y + r.height, sel).toBeLessThanOrEqual(alto);
    }
  });

  test(`a ${ancho}×${alto} el cierre cabe arriba de la línea de tiempo`, async ({ page }) => {
    await abrir(page, '#/', { ancho, alto, reducir: true });
    const bloque = await page.locator('#bloqueFinal').boundingBox();
    const instrumento = await page.locator('#instrumento').boundingBox();
    expect(bloque.y + bloque.height).toBeLessThanOrEqual(instrumento.y);
  });
}

// Resolución: en una pantalla de escritorio más chica que la de referencia (1470 × 850, una MacBook Air de 13"), la
// página se escala y se ve igual. 1263 × 624 y 1366 × 657 son 1280 × 720 y 1366 × 768 con la barra del navegador.
const quieta = (page) => page.evaluate(() => new Promise((listo) => requestAnimationFrame(() => requestAnimationFrame(listo))));

for (const [ancho, alto] of [[1263, 624], [1366, 657], [983, 624]]) {
  test(`a ${ancho}×${alto} la página se escala: la línea de tiempo se ve completa y no tapa el cierre ni el buscador`, async ({ page }) => {
    await abrir(page, '#/?modo=repaso&t=70', { ancho, alto, reducir: true });
    await quieta(page);
    const enRepaso = await page.locator('#instrumento').boundingBox();
    expect(enRepaso.y + enRepaso.height).toBeLessThanOrEqual(alto);

    await abrir(page, '#/?modo=final', { ancho, alto, reducir: true });
    await quieta(page);
    expect(Number(await page.evaluate(() => document.documentElement.style.zoom))).toBeCloseTo(Math.min(alto / 850, ancho / 1280), 2);
    const bloque = await page.locator('#bloqueFinal').boundingBox();
    const instrumento = await page.locator('#instrumento').boundingBox();
    expect(bloque.y + bloque.height).toBeLessThanOrEqual(instrumento.y);
    expect(instrumento.y + instrumento.height).toBeLessThanOrEqual(alto);
  });
}

test('en pantallas grandes y en el teléfono la página no se escala', async ({ page }) => {
  for (const [ancho, alto] of [[1440, 900], [1920, 1080], [390, 844]]) {
    await abrir(page, '#/', { ancho, alto });
    expect(await page.evaluate(() => document.documentElement.style.zoom), `${ancho}×${alto}`).toBe('');
  }
});

test('con la página escalada, la tarjeta sale junto al puntero', async ({ page }) => {
  await abrir(page, '#/?modo=final', { ancho: 1263, alto: 624, reducir: true });
  await quieta(page);
  const caja = await page.locator('#rellenos path').nth(40).boundingBox();
  const x = caja.x + caja.width / 2, y = caja.y + caja.height / 2;
  await page.mouse.move(x, y);
  const tarjeta = await page.locator('#tarjeta').boundingBox();
  // 18 px de la página, a la escala de 624 / 850. Firefox redondea la posición al píxel de la pantalla: ±2 px. Sin
  // pasar el puntero a píxeles de la página, la tarjeta quedaría decenas de píxeles más lejos.
  const esperado = 18 * 624 / 850;
  expect(Math.abs(tarjeta.x - x - esperado)).toBeLessThan(2);
  expect(Math.abs(tarjeta.y - y - esperado)).toBeLessThan(2);
});

test('en el teléfono, el titular, el buscador y el mapa empiezan en la primera pantalla', async ({ page }) => {
  await abrir(page, '#/', { ancho: 390, alto: 844 });
  for (const sel of ['#titulo', '#busca1', '#mapa']) {
    const r = await page.locator(sel).boundingBox();
    expect(r.y, sel).toBeLessThan(844);
  }
});

test('en el teléfono, lo que se toca mide al menos 44 px', async ({ page }) => {
  await abrir(page, '#/', { ancho: 390, alto: 844, reducir: true });
  const chicos = await page.$$eval('a, button, input, [role="slider"]', (es) => es
    .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.classList.contains('saltar'))
    .map((e) => ({ e: e.id || e.className || e.tagName, r: e.getBoundingClientRect() }))
    .filter(({ r }) => r.height < 44 || r.width < 44)
    .map(({ e, r }) => `${e} ${Math.round(r.width)}×${Math.round(r.height)}`));
  expect(chicos).toEqual([]);
});

test('con «reducir movimiento» abre directo en el cierre', async ({ page }) => {
  await abrir(page, '#/', { reducir: true });
  await expect(page.locator('#escenario')).toHaveAttribute('data-modo', 'final');
  await expect(page.locator('#resultado')).toBeVisible();
});

test('el cierre pinta solo Yucatán', async ({ page }) => {
  await abrir(page, '#/', { reducir: true });
  const opacidad = (sel) => page.$eval(sel, (e) => Number(getComputedStyle(e).fillOpacity));
  expect(await opacidad('.rellenos path.fuera')).toBe(0);
  expect(await opacidad('.rellenos path:not(.fuera)')).toBeGreaterThan(0.9);
});

test('buscar Tekax abre su tarjeta y «Ver detalle» lleva a su página (dos acciones)', async ({ page }) => {
  await abrir(page, '#/');
  await page.fill('#busca1', 'tekax');
  await page.keyboard.press('Enter');
  const tarjeta = page.locator('.tarjeta.fija');
  await expect(tarjeta).toBeVisible();
  await expect(tarjeta).toContainText('Tekax');
  const enlace = tarjeta.locator('a');
  await expect(enlace).toHaveAttribute('href', '#/municipio/tekax');
  await enlace.click();
  await expect(page).toHaveURL(/#\/municipio\/tekax$/);
  await expect(page.locator('h1')).toHaveText('Tekax');
});

test('buscar una ciudad encuentra su municipio («Cancún» lleva a Benito Juárez)', async ({ page }) => {
  await abrir(page, '#/');
  await page.fill('#busca1', 'cancun');
  await expect(page.locator('#lista1 [role=option]').first()).toHaveText(/^Benito JuárezCancún, Quintana Roo$/);
  await page.keyboard.press('Enter');
  await expect(page.locator('.tarjeta.fija')).toContainText('Benito Juárez');
  // «carmen» da el municipio de Carmen y Solidaridad (Playa del Carmen), sin repetir Carmen.
  // Lo prueba en el buscador del cierre, que es el que se ve después de elegir.
  await page.keyboard.press('Escape');
  await page.fill('#busca2', 'carmen');
  await expect(page.locator('#lista2 [role=option]')).toHaveText([/^CarmenCampeche$/, /^SolidaridadPlaya del Carmen/]);
});

test('la tarjeta de un municipio fuera del encuadre de Yucatán se ve completa', async ({ page }) => {
  await abrir(page, '#/', { query: '?modo=final' });
  await page.fill('#busca2', 'cancun');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const tj = await page.locator('.tarjeta.fija').boundingBox(), esc = await page.locator('#escenario').boundingBox();
  expect(tj.x + tj.width).toBeLessThanOrEqual(esc.x + esc.width);
});

test('tocar un municipio del mapa abre su tarjeta', async ({ page }) => {
  await abrir(page, '#/', { reducir: true });
  await page.locator('.rellenos path[data-id="tekax"]').click({ force: true });
  await expect(page.locator('.tarjeta.fija')).toContainText('Tekax');
  await page.keyboard.press('Escape');
  await expect(page.locator('.tarjeta')).toBeHidden();
});

test('la línea de tiempo se mueve con el teclado', async ({ page }) => {
  await abrir(page, '#/', { query: '?modo=repaso&t=10' });
  const tiempo = page.locator('#tiempo');
  await expect(tiempo).toHaveAttribute('aria-valuenow', '10');
  await tiempo.focus();
  await page.keyboard.press('ArrowRight');
  await expect(tiempo).toHaveAttribute('aria-valuenow', '11');
  await expect(page.locator('#fecha')).toHaveText('12 de marzo');
  await page.keyboard.press('End');
  await expect(page.locator('#escenario')).toHaveAttribute('data-modo', 'final');
});

test('tocar un día de la tira lleva el repaso a ese día', async ({ page }) => {
  await abrir(page, '#/');
  const caja = await page.locator('#tira').boundingBox();
  const dia = 90; // 1 de abril, contado desde el 1 de enero
  await page.mouse.click(caja.x + ((dia + 0.5) / PORTADA.z2.dias.length) * caja.width, caja.y + caja.height * 0.5);
  await expect(page.locator('#escenario')).toHaveAttribute('data-modo', 'repaso');
  await expect(page.locator('#fecha')).toHaveText('1 de abril');
});

test('tocar «Lo normal» explica qué es', async ({ page }) => {
  await abrir(page, '#/');
  await expect(page.locator('#explicaNormal')).toBeHidden();
  await page.click('#leyNormal');
  await expect(page.locator('#explicaNormal')).toBeVisible();
  await expect(page.locator('#leyNormal')).toHaveAttribute('aria-expanded', 'true');
});

test('las cifras salen de web/datos y no están escritas en el código', async ({ page }) => {
  await abrir(page, '#/', { reducir: true });
  const texto = await page.evaluate(() => document.body.textContent);
  // «30 de abril» era el día pico de la maqueta; desde H1 también es el día pico real
  // (NOAA-20 cubre los días sin datos de S-NPP), así que ya no sirve para detectar la maqueta.
  for (const viejo of ['3,789', '8,905', 'Ucú', 'Prototipo', '×3.05']) expect(texto).not.toContain(viejo);
  const fmt = (n) => Math.round(n).toLocaleString('es-MX');
  expect(texto).toContain(`${PORTADA.cuenta.menos} de ${PORTADA.cuenta.total} municipios`);
  expect(texto).toContain(fmt(PORTADA.acum26[91]));
  expect(texto).toContain(fmt(PORTADA.acumNormal[91]));
  expect(texto).toContain(fmt(PORTADA.diaMax.n));
});

test('la primera carga pesa menos de 1.5 MB', async ({ page }) => {
  await abrir(page, '#/');
  const { bytes, archivos } = await page.evaluate(() => {
    const todos = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')];
    return { bytes: todos.reduce((s, e) => s + e.encodedBodySize, 0), archivos: todos.length };
  });
  console.log('primera carga:', Math.round(bytes / 1024), 'KB en', archivos, 'archivos');
  expect(bytes).toBeGreaterThan(500 * 1024); // la foto y los datos tienen que estar contados
  expect(bytes).toBeLessThan(1.5 * 1024 * 1024);
});

test('en el teléfono la barra se queda arriba al bajar', async ({ page }) => {
  await abrir(page, '#/', { ancho: 390, alto: 844, reducir: true });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(100);
  const r = await page.locator('.barra').boundingBox();
  expect(Math.round(r.y)).toBe(0);
});

// Pulido del repaso (tarea 7): ritmo, interrupción y la línea de tiempo por día.
test('el repaso dura menos de 10 segundos y termina en el cierre con las cifras del año', async ({ page }) => {
  await page.clock.install();
  await abrir(page, '#/');
  await page.click('#verTemporada');
  await expect(page.locator('#escenario')).toHaveAttribute('data-modo', 'repaso');
  for (let i = 0; i < 100; i++) await page.clock.runFor(100); // 10 s, cuadro por cuadro
  await expect(page.locator('#escenario')).toHaveAttribute('data-modo', 'final');
  const fmt = (n) => Math.round(n).toLocaleString('es-MX');
  await expect(page.locator('#n26')).toHaveText(fmt(PORTADA.acum26[91]));
  await expect(page.locator('#nNormal')).toHaveText(fmt(PORTADA.acumNormal[91]));
});

test('tocar un municipio a media animación la interrumpe y abre su tarjeta', async ({ page }) => {
  await abrir(page, '#/');
  await page.click('#verTemporada');
  await expect(page.locator('#escenario')).toHaveAttribute('data-modo', 'repaso');
  await page.locator('.rellenos path[data-id="tekax"]').click({ force: true });
  await expect(page.locator('.tarjeta.fija')).toContainText('Tekax');
  await expect(page.locator('#escenario')).toHaveAttribute('data-modo', 'final');
});

test('la línea de tiempo tiene una barra por cada día con fuego y lee el día al pasar el mouse', async ({ page }) => {
  await abrir(page, '#/', { query: '?modo=repaso&t=61' });
  const conFuego = PORTADA.acum26.filter((v, i) => v - (i ? PORTADA.acum26[i - 1] : 0) > 0).length;
  const barras = await page.$eval('#barrasFuturo', (e) => (e.getAttribute('d').match(/M/g) || []).length);
  expect(barras).toBe(conFuego);
  await expect(page.locator('#fecha')).toHaveText('1 de mayo');
  const caja = await page.locator('#tiempo').boundingBox();
  await page.mouse.move(caja.x + ((61 + 0.5) / 92) * caja.width, caja.y + 30);
  const n = Math.round(PORTADA.acum26[61] - PORTADA.acum26[60]);
  await expect(page.locator('#fantasmaTexto')).toHaveText(`1 may: ${n} focos`);
  await expect(page.locator('#fecha')).toHaveText('1 de mayo'); // leer no mueve el repaso
});

test('en el teléfono, el menú lleva a las tres secciones', async ({ page }) => {
  await abrir(page, '#/', { ancho: 360, alto: 740 });
  for (const nombre of ['Temporada', 'Fechas', 'Método']) await expect(page.locator('.nav').getByRole('link', { name: nombre, exact: true })).toBeVisible();
  const { scroll, ancho } = await page.$eval('.nav', (e) => ({ scroll: e.scrollWidth, ancho: e.clientWidth }));
  expect(scroll).toBeLessThanOrEqual(ancho);
  await page.locator('.nav').getByRole('link', { name: 'Método', exact: true }).click();
  await expect(page).toHaveURL(/#\/metodo$/);
});

test('tocar un año del panel pinta ese año en el mapa; «Volver a 2026» regresa', async ({ page }) => {
  await abrir(page, '#/');
  await page.locator('#barras .toque').nth(2).click(); // 2003, el año con más fuego
  const c = PORTADA.porAnio.cuenta['2003'];
  await expect(page.locator('#escenario')).toHaveAttribute('data-modo', 'final');
  await expect(page.locator('#resultado')).toHaveText(`En 2003, ${c.mas} de ${PORTADA.cuenta.total} municipios de Yucatán tuvieron más fuego que lo normal.`);
  await expect(page.locator('#filaAnio')).toHaveText('2003');
  // El panel sigue hablando de 2026; la pista dice qué año se ve en el mapa.
  await expect(page.locator('#pistaAnio')).toHaveText('El mapa muestra 2003. Toca su barra otra vez para volver a 2026.');
  const i = PORTADA.porAnio.ids.indexOf('tekax');
  const v = PORTADA.porAnio.v[i][PORTADA.porAnio.anios.indexOf(2003)];
  await page.locator('.rellenos path[data-id="tekax"]').click({ force: true });
  await expect(page.locator('.tarjeta.fija')).toContainText('Focos de calor en 2003');
  await expect(page.locator('.tarjeta.fija')).toContainText(Math.round(v).toLocaleString('es-MX'));
  await page.keyboard.press('Escape');
  await page.click('#volver');
  await expect(page.locator('#resultado')).toHaveText(`${PORTADA.cuenta.menos} de ${PORTADA.cuenta.total} municipios de Yucatán tuvieron menos fuego que lo normal.`);
  await expect(page.locator('#volver')).toBeHidden();
  await expect(page.locator('#pistaAnio')).toHaveText('Toca un año para verlo en el mapa.');
  // La línea de tiempo también vuelve: el acumulado es el de 2026, no el del año que se vio.
  await expect(page.locator('#filaAnio')).toHaveText('2026');
  await expect(page.locator('#n26')).toHaveText(Math.round(PORTADA.yuc.acum['2026'][91]).toLocaleString('es-MX'));
});

test('con otro año en el mapa, mover la línea de tiempo vuelve al repaso de 2026', async ({ page }) => {
  await abrir(page, '#/', { query: '?anio=2009' });
  await expect(page.locator('#filaAnio')).toHaveText('2009');
  await page.locator('#tiempo').focus();
  await page.keyboard.press('Home');
  await expect(page.locator('#escenario')).toHaveAttribute('data-modo', 'repaso');
  await expect(page.locator('#filaAnio')).toHaveText('2026');
});

test.describe('usar mi ubicación', () => {
  test.use({ permissions: ['geolocation'] });

  test('dentro de Tekax lleva a la página de Tekax', async ({ page, context }) => {
    await context.setGeolocation({ latitude: 19.9829, longitude: -89.339 });
    await abrir(page, '#/');
    await page.locator('#buscador1 .ubicacion').click();
    await expect(page).toHaveURL(/#\/municipio\/tekax$/);
    await expect(page.locator('h1')).toHaveText('Tekax');
  });

  test('fuera de la península lo dice y deja el buscador', async ({ page, context }) => {
    await context.setGeolocation({ latitude: 19.4326, longitude: -99.1332 });
    await abrir(page, '#/');
    await page.locator('#buscador1 .ubicacion').click();
    await expect(page.locator('#buscador1 .aviso-ubicacion')).toHaveText(/fuera de la península/);
    await expect(page).toHaveURL(/#\/$/);
  });
});

test('arrastrar la línea de tiempo no selecciona texto', async ({ page }) => {
  await abrir(page, '#/', { query: '?modo=repaso&t=10' });
  const linea = await page.locator('#tiempo').boundingBox();
  const y = linea.y + 8;
  await page.mouse.move(linea.x + 4, y);
  await page.mouse.down();
  await page.mouse.move(linea.x + linea.width * 0.6, y, { steps: 20 });
  await page.mouse.up();
  expect(await page.evaluate(() => String(getSelection()))).toBe('');
});

// Dudas de la prueba de cinco segundos.
test('las barras rayadas dicen qué son, y la respuesta de las fechas permitidas va arriba de su gráfica', async ({ page }) => {
  await abrir(page, '#/');
  await expect(page.locator('#barras text.ley-conv')).toHaveText('2001–2011: otro satélite, ajustado para comparar');
  const z = PORTADA.z2, k = Math.round(((z.tot - z.dentro) / z.tot) * 10);
  await expect(page.locator('#fechasRespuesta')).toHaveText(`En la zona 2, el centro y norte de Yucatán, de enero a junio de 2026, ${k} de cada 10 focos se vieron fuera de las fechas permitidas.`);
  const respuesta = await page.locator('#fechasRespuesta').boundingBox();
  const tira = await page.locator('#tira').boundingBox();
  expect(respuesta.y + respuesta.height).toBeLessThan(tira.y);
});

test('el año normal de la línea de tiempo no es gris sólido como «casi nunca hay quemas»', async ({ page }) => {
  await abrir(page, '#/', { reducir: true });
  const normal = await page.$eval('#bNormal', (e) => getComputedStyle(e).backgroundColor);
  const poco = await page.$eval('.escala-color .poco i', (e) => getComputedStyle(e).backgroundColor);
  expect(normal).not.toBe(poco);
  expect(normal).toBe('rgba(246, 244, 240, 0.85)'); // una línea blanca, como la silueta
});

// La dirección sigue el estado: se puede compartir lo que se ve y «Atrás» deshace cada paso.
test.describe('la dirección', () => {
  test('guarda el municipio y el año, y «Atrás» los deshace uno por uno', async ({ page }) => {
    await abrir(page, '#/', { reducir: true });
    await page.locator('#barras .toque[data-y="2003"]').click();
    await expect(page).toHaveURL(/#\/\?modo=final&anio=2003$/);
    await page.locator('#buscador2 input').fill('Tekax');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/\?modo=final&anio=2003&sel=tekax$/);
    await page.goBack();
    await expect(page.locator('#tarjeta')).toBeHidden();
    await expect(page.locator('#filaAnio')).toHaveText('2003');
    await page.goBack();
    await expect(page.locator('#filaAnio')).toHaveText('2026');
    await page.goForward();
    await page.goForward();
    await expect(page.locator('#tarjeta .nombre')).toHaveText('Tekax');
    await expect(page.locator('#filaAnio')).toHaveText('2003');
  });

  test('al recargar, abre lo mismo que se veía', async ({ page }) => {
    await abrir(page, '#/', { query: '' });
    await page.goto('/#/?modo=final&anio=2009&sel=tekax');
    await page.reload();
    await page.waitForSelector('#tarjeta:not([hidden])');
    await expect(page.locator('#tarjeta .nombre')).toHaveText('Tekax');
    await expect(page.locator('#filaAnio')).toHaveText('2009');
  });

  test('el día del repaso se reescribe sin llenar el historial', async ({ page }) => {
    await abrir(page, '#/');
    await page.locator('#verTemporada').click();
    await expect(page).toHaveURL(/#\/\?modo=repaso$/);
    const largo = await page.evaluate(() => history.length);
    await page.locator('#control').click(); // pausa
    await page.locator('#tiempo').focus();
    await page.keyboard.press('Home');
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/#\/\?modo=repaso&t=5$/);
    expect(await page.evaluate(() => history.length)).toBe(largo);
    // «Atrás» regresa a la foto.
    await page.goBack();
    await expect(page.locator('#escenario')).toHaveAttribute('data-modo', 'foto');
  });

  test('las direcciones viejas, con ?modo antes del ancla, se siguen abriendo', async ({ page }) => {
    await abrir(page, '#/', { query: '?modo=final&sel=tekax' });
    await expect(page.locator('#tarjeta .nombre')).toHaveText('Tekax');
  });
});

// Funciones escondidas: nunca hacen falta, pero están al alcance (y también con el teclado).
test.describe('funciones escondidas', () => {
  test('arrastrar sobre las barras recorre los años y deja una sola entrada en el historial', async ({ page }) => {
    await abrir(page, '#/', { reducir: true });
    const largo = await page.evaluate(() => history.length);
    const b = await page.locator('#barras .toque[data-y="2001"]').boundingBox();
    const fin = await page.locator('#barras .toque[data-y="2010"]').boundingBox();
    const y = b.y + b.height - 6;
    await page.mouse.move(b.x + 2, y);
    await page.mouse.down();
    await page.mouse.move(b.x + 40, y, { steps: 4 });
    const pasando = await page.locator('#filaAnio').textContent();
    expect(['2001', '2002', '2003', '2004']).toContain(pasando);
    await page.mouse.move(fin.x + fin.width / 2, y, { steps: 10 });
    await page.mouse.up();
    // El clic de soltar no vuelve a 2026.
    await expect(page.locator('#filaAnio')).toHaveText('2010');
    await expect(page).toHaveURL(/anio=2010/);
    expect(await page.evaluate(() => history.length)).toBe(largo + 1);
  });

  test('mantener presionado un municipio abre sus 26 años; con el teclado, Espacio en el mapa', async ({ page }) => {
    await abrir(page, '#/', { reducir: true });
    const v = await page.locator('.rellenos path[data-id="valladolid"]').boundingBox();
    await page.mouse.move(v.x + v.width / 2, v.y + v.height / 2);
    await expect(page.locator('#tarjeta .pista-historia')).toHaveText('Mantén presionado para ver sus 26 años.');
    await page.mouse.down();
    await page.waitForTimeout(650);
    await page.mouse.up();
    await expect(page.locator('#tarjeta .historia rect')).toHaveCount(26);
    await expect(page.locator('#tarjeta .historia')).toHaveAttribute('aria-label', /Valladolid.*Lo normal es 251; en 2026 hubo 96/);
    // Una vez usada, la pista ya no sale.
    await page.locator('#tarjeta .cerrar').click();
    await page.mouse.move(v.x + v.width / 2 + 2, v.y + v.height / 2);
    await expect(page.locator('#tarjeta .pista-historia')).toHaveCount(0);
    await page.locator('#capa').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press(' ');
    await expect(page.locator('#tarjeta .historia')).toBeVisible();
    await page.keyboard.press(' ');
    await expect(page.locator('#tarjeta .historia')).toHaveCount(0);
  });

  test('«?» muestra los atajos, «/» lleva al buscador y Espacio empieza la temporada', async ({ page }) => {
    await abrir(page, '#/');
    await page.locator('body').click({ position: { x: 1300, y: 880 } });
    await page.keyboard.press('?');
    await expect(page.locator('#atajos')).toBeVisible();
    await expect(page.locator('#atajos dd').first()).toHaveText('Empezar o pausar la temporada');
    await page.keyboard.press('Escape');
    await expect(page.locator('#atajos')).toBeHidden();
    await page.keyboard.press('/');
    expect(await page.evaluate(() => document.activeElement.closest('#buscador1') !== null)).toBe(true);
    await page.keyboard.type('?'); // en el buscador, «?» se escribe
    await expect(page.locator('#atajos')).toBeHidden();
    await page.keyboard.press('Escape');
    await page.locator('#respuesta').click();
    await page.keyboard.press(' ');
    await expect(page.locator('#escenario')).toHaveAttribute('data-modo', 'repaso');
  });

  test('K\'ÁAK\' dice «fuego, en maya» al pasar el mouse', async ({ page }) => {
    await abrir(page, '#/');
    await page.locator('.marca').hover();
    await expect(page.locator('.marca-dice')).toHaveText('fuego, en maya');
    await expect(page.locator('.marca-dice')).toHaveCSS('opacity', '1');
    await expect(page.locator('.marca')).toHaveAttribute('aria-label', "K'áak', fuego en maya. Inicio");
  });
});
