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

// ---- Dirección visual, «Municipio y ficha»: hechos, dónde se quema, cierre y descargas ----
const dato = (id) => JSON.parse(fs.readFileSync(`web/datos/municipio/${id}.json`, 'utf8'));
const deTemporada = (m) => m.focos26.filter((f) => f[2] >= '03-01' && f[2] <= '05-31');

test('los hechos propios salen de los datos y, si no hay, no dejan hueco', async ({ page }) => {
  await abrir(page, '#/municipio/tizimin');
  const hechos = page.locator('#hechos li');
  await expect(hechos).toHaveCount(3);
  await expect(hechos.nth(0)).toHaveText('La temporada con menos fuego desde 2012. Lleva 7 temporadas seguidas por debajo de lo normal.');
  await expect(hechos.nth(1)).toHaveText('En un año normal es el municipio con más fuego de Yucatán.');
  await expect(hechos.nth(2)).toContainText('su semana con más fuego va del 7 al 13 de mayo');
  // Mérida empieza antes que su zona, y se dice.
  await abrir(page, '#/municipio/merida');
  await expect(page.locator('#hechos li').nth(2)).toContainText('Empieza 22 días antes que el resto de su zona.');
  // Telchac Puerto casi no tiene fuego: no hay hechos que decir.
  await abrir(page, '#/municipio/telchac-puerto');
  await expect(page.locator('#hechos')).toBeHidden();
});

test('las barras de los años llevan la franja de lo normal', async ({ page }) => {
  await abrir(page, '#/municipio/muna');
  await expect(page.locator('#barrasMun .rango')).toHaveCount(1);
  await expect(page.locator('.mun-nota').first()).toContainText('La franja gris abarca la mitad de esos años.');
});

test('dónde se quema: la oración, los cuadritos repetidos y los focos de la temporada', async ({ page }) => {
  const m = dato('muna'), focos = deTemporada(m);
  const rep = new Set(m.repetidos.map((r) => r[0].toFixed(2) + ',' + r[1].toFixed(2)));
  const dentro = focos.filter((f) => rep.has(f[0].toFixed(2) + ',' + f[1].toFixed(2))).length;
  await abrir(page, '#/municipio/muna');
  await expect(page.locator('#dondeTitulo')).toHaveText('¿Dónde se quema en Muna?');
  await expect(page.locator('#dondeFrase')).toContainText(`En ${m.repetidos.length} cuadritos de 1 km de Muna hubo fuego en 5 o más temporadas de 2012 a 2025`);
  await expect(page.locator('#dondeFrase')).toContainText(`De los ${focos.length} focos de calor de marzo a mayo de 2026, ${dentro} cayeron en esos cuadritos.`);
  // La cifra de focos es la misma del encabezado.
  await expect(page.locator('#cifras')).toContainText(`${focos.length} focos de calor`);
  await expect(page.locator('#dondeMapa .d-rep rect')).toHaveCount(m.repetidos.length);
  const celdas = new Set(focos.map((f) => f[0] + ',' + f[1])).size;
  await expect(page.locator('#dondeMapa .d-focos circle')).toHaveCount(celdas);
  // Los vecinos llevan su nombre y hay barra de escala.
  await expect(page.locator('#dondeMapa .d-vecinos-t text')).not.toHaveCount(0);
  await expect(page.locator('#dondeMapa .d-vecinos-t')).toContainText('Ticul');
  await expect(page.locator('#dondeMapa .d-escala text')).toHaveText(/^\d+ km$/);
  // Letra de 11 px o más dentro del mapa.
  const chicas = await page.locator('#dondeMapa text').evaluateAll((ts) => ts.map((t) => t.getBoundingClientRect().height).filter((h) => h < 11));
  expect(chicas).toEqual([]);
});

test('tocar un foco dice su fecha y su satélite, y abre el lugar en un mapa', async ({ page }) => {
  await abrir(page, '#/municipio/muna');
  const lectura = page.locator('#dondeLectura');
  await expect(lectura).toHaveText('Toca un punto o un cuadrito para ver su fecha y abrir el lugar en un mapa.');
  const punto = page.locator('#dondeMapa .d-focos circle').first();
  await punto.scrollIntoViewIfNeeded();
  const c = await punto.boundingBox();
  await page.mouse.click(c.x + c.width / 2, c.y + c.height / 2);
  await expect(lectura).toContainText(/de 2026, visto por (S-NPP|NOAA-20)\.|focos de calor en este cuadrito/);
  const enlace = lectura.locator('a');
  await expect(enlace).toHaveText('Abrir en Google Maps');
  await expect(enlace).toHaveAttribute('href', /^https:\/\/www\.google\.com\/maps\?q=20\.\d\d,-89\.\d\d$/);
  await expect(enlace).toHaveAttribute('target', '_blank');
  await expect(page.locator('#dondeMapa .d-sel > *')).toHaveCount(1);
  // Con el teclado: las flechas recorren los focos por fecha y Escape suelta.
  await page.focus('#dondeMapa');
  await page.keyboard.press('Home');
  const m = dato('muna');
  const primero = deTemporada(m)[0];
  await expect(lectura).toContainText(String(Number(primero[2].slice(3))) + ' de ');
  await page.keyboard.press('Escape');
  await expect(page.locator('#dondeMapa .d-sel > *')).toHaveCount(0);
  await expect(lectura).toHaveClass(/pista/);
});

test('la lista de los focos se arma al abrirla, con fecha, satélite y enlace', async ({ page }) => {
  const n = deTemporada(dato('muna')).length;
  await abrir(page, '#/municipio/muna');
  await expect(page.locator('#dondeTabla tr')).toHaveCount(0);
  await page.click('#dondeLista summary');
  await expect(page.locator('#dondeTabla tbody tr')).toHaveCount(n);
  await expect(page.locator('#dondeTabla thead')).toHaveText('FechaSatéliteLugar');
  await expect(page.locator('#dondeTabla tbody a').first()).toHaveAttribute('href', /google\.com\/maps\?q=/);
});

test('sin focos y sin cuadritos repetidos queda la oración, sin mapa vacío', async ({ page }) => {
  await abrir(page, '#/municipio/bokoba');
  await expect(page.locator('#dondeFrase')).toHaveText('En Bokobá, ningún cuadrito de 1 km tuvo fuego en 5 o más temporadas de 2012 a 2025. De marzo a mayo de 2026 el satélite no vio focos de calor en Bokobá.');
  await expect(page.locator('.donde-cuerpo')).toBeHidden();
  await expect(page.locator('#dondeLista')).toBeHidden();
  // Con un solo foco y sin repetidos, singular.
  await abrir(page, '#/municipio/baca');
  await expect(page.locator('#dondeFrase')).toContainText('De marzo a mayo de 2026 hubo 1 foco de calor.');
  await expect(page.locator('#leyRep')).toBeHidden();
});

test('un municipio enorme dibuja miles de focos sin errores', async ({ page }) => {
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e)));
  const m = dato('candelaria');
  await abrir(page, '#/municipio/candelaria');
  await expect(page.locator('#dondeMapa .d-rep rect')).toHaveCount(m.repetidos.length);
  expect(errores).toEqual([]);
});

test('fuera de Yucatán la página y la ficha dicen cuándo se quema ahí', async ({ page }) => {
  await abrir(page, '#/municipio/calakmul');
  await expect(page.locator('#notaFechas')).toHaveText('La SEDER publica fechas para quemar solo en Yucatán. Campeche tiene su propio calendario de quemas.');
  await expect(page.locator('#irFechas')).toBeHidden();
  await expect(page.locator('#ficha')).toBeVisible();
  const f = await page.evaluate(async () => {
    const { fechasDeLaFicha } = await import('/js/ficha.js');
    const m = await (await fetch('/datos/municipio/calakmul.json')).json();
    return fechasDeLaFicha(m);
  });
  expect(f).toEqual({ titulo: 'La semana con más fuego de un año normal en Calakmul', valor: '23 al 29 de abril' });
});

test('el cierre lleva a las fechas de su zona y a otro municipio', async ({ page }) => {
  await abrir(page, '#/municipio/muna');
  await expect(page.locator('#irFechas')).toHaveAttribute('href', '#/fechas/3');
  // El ejemplo de la página es Muna; estando en Muna, se propone Tekax.
  await expect(page.locator('#buscadorOtro .ejemplo button')).toHaveText('Tekax');
  await page.fill('#buscao', 'tekax');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/municipio\/tekax$/);
  await expect(page.locator('h1')).toHaveText('Tekax');
});

test('la tabla de focos de 2026 se descarga con fecha, coordenadas y satélite', async ({ page }) => {
  const m = dato('muna');
  await abrir(page, '#/municipio/muna');
  const [descarga] = await Promise.all([page.waitForEvent('download'), page.click('#csvFocos')]);
  expect(descarga.suggestedFilename()).toBe('kaak-muna-focos-2026.csv');
  const texto = fs.readFileSync(await descarga.path(), 'utf8');
  const filas = texto.replace(/^﻿/, '').trim().split('\r\n');
  expect(filas[0]).toBe('fecha,latitud,longitud,satelite');
  expect(filas.length).toBe(m.focos26.length + 1);
  expect(filas[1]).toMatch(/^2026-\d\d-\d\d,20\.\d\d,-89\.\d\d,(S-NPP|NOAA-20)$/);
});

test('en teléfono el mapa cabe, no hay desplazamiento de lado y la ficha va antes del cierre', async ({ page }) => {
  await abrir(page, '#/municipio/tizimin', { ancho: 390, alto: 844 });
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(desborde).toBeLessThanOrEqual(0);
  const mapa = await page.locator('#dondeCaja').boundingBox();
  expect(mapa.width).toBeLessThanOrEqual(390 - 32);
  const ficha = await page.locator('#ficha').boundingBox(), cierre = await page.locator('.mun-cierre').boundingBox();
  expect(ficha.y).toBeLessThan(cierre.y);
});

// Más rojo, sin salir de la paleta: los años con más fuego que lo normal en rojo claro y 2026 en rojo.
test('los años sobre lo normal van en rojo claro, los demás en gris y 2026 en rojo', async ({ page }) => {
  await abrir(page, '#/municipio/tekax');
  const barra = (y) => page.locator('#barrasMun rect.b-anio').nth(y - 2001);
  await expect(barra(2024)).toHaveAttribute('fill', '#E9837D');
  expect(await barra(2024).getAttribute('stroke')).toBeNull();
  await expect(barra(2014)).toHaveAttribute('fill', '#8F877D');
  await expect(barra(2026)).toHaveAttribute('fill', '#D7261E');
  await expect(page.locator('#cifras .c2026')).toHaveText('213');
  await expect(page.locator('#cifras .c2026')).toHaveCSS('color', 'rgb(215, 38, 30)');
  // Los días, en un solo rojo oscuro: la altura dice la cantidad.
  const fondos = await page.locator('#diasBarras span').evaluateAll((es) => [...new Set(es.map((e) => getComputedStyle(e).backgroundColor))]);
  expect(fondos).toEqual(['rgb(153, 107, 102)']);
});

test('compartir por WhatsApp va en verde con letra de tinta y un globo de mensaje', async ({ page }) => {
  await abrir(page, '#/municipio/tekax');
  const b = page.locator('#compartir');
  await expect(b).toHaveText('Compartir por WhatsApp');
  await expect(b).toHaveCSS('background-color', 'rgb(37, 211, 102)');
  await expect(b).toHaveCSS('color', 'rgb(18, 18, 18)');
  await expect(b.locator('svg')).toHaveCount(1);
});

test('territorio ganadero (#60): sale en los municipios de Yucatán, con su fuente, y no en Campeche', async ({ page }) => {
  await abrir(page, '#/municipio/tizimin');
  const g = page.locator('#ganaderia');
  await expect(g).toBeVisible();
  await expect(g.locator('h2')).toHaveText('Territorio ganadero');
  await expect(page.locator('#ganCifras')).toHaveText('El 44 % de Tizimín es pastizal, y tiene 139,472 cabezas de ganado bovino (36 por km²).');
  await expect(page.locator('#ganFocos')).toContainText('de 2013 a 2025, el 58 % cayó sobre pastizal');
  await expect(page.locator('#ganFocos')).toContainText('el pastizal es el 17 % de la tierra y recibe el 29 % de los focos');
  await expect(g).toContainText('Un foco sobre pastizal no dice quién quemó ni por qué.');
  await expect(g).toContainText('INEGI');
  await abrir(page, '#/municipio/calakmul');
  await expect(page.locator('h1')).toHaveText('Calakmul');
  await expect(page.locator('#ganaderia')).toBeHidden();
});

// El mapa del territorio ganadero (#60, fase 3): Yucatán por municipio, tres opciones y un solo tono.
test('mapa ganadero: los 106 municipios con la clase de sus datos, la leyenda con los cortes y las tres opciones', async ({ page }) => {
  const TONOS = ['#F0E9DA', '#DDC79B', '#BF9A55', '#8C6A2F', '#503A18'];
  const G = JSON.parse(fs.readFileSync('web/datos/ganaderia.json', 'utf8'));
  await abrir(page, '#/municipio/tizimin');
  const relleno = (id) => page.locator(`#ganMapa a[data-id="${id}"] path`);
  await expect(page.locator('#ganMapa a')).toHaveCount(106);
  await expect(page.locator('#ganMapaTitulo')).toHaveText('Territorio ganadero de Yucatán');
  await expect(page.locator('[data-gan="pastizal"]')).toHaveAttribute('aria-pressed', 'true');
  // Tizimín: pastizal 3, bovinos 4 y focos 4; Mérida: 0, 1 y 0 (los valores que comprueba test_exportar_web.py).
  await expect(relleno('tizimin')).toHaveAttribute('fill', TONOS[3]);
  await expect(relleno('merida')).toHaveAttribute('fill', TONOS[0]);
  await expect(page.locator('#ganLeyenda li')).toHaveText(['menos de 5 %', '5 a 15 %', '15 a 30 %', '30 a 50 %', '50 % o más']);
  // El municipio de la página va con su contorno, y el mapa dice qué muestra.
  await expect(page.locator('#ganMapa a.propio')).toHaveAttribute('data-id', 'tizimin');
  await expect(page.locator('#ganMapa')).toHaveAttribute('aria-label', 'Mapa de Yucatán por municipio: Pastizal (% del municipio).');
  await page.click('[data-gan="bovinos"]');
  await expect(relleno('tizimin')).toHaveAttribute('fill', TONOS[4]);
  await expect(relleno('merida')).toHaveAttribute('fill', TONOS[1]);
  await expect(page.locator('#ganLeyenda li')).toHaveText(['menos de 2', '2 a 5', '5 a 10', '10 a 25', '25 o más']);
  await page.click('[data-gan="focos"]');
  await expect(page.locator('[data-gan="focos"]')).toHaveText('Focos de calor sobre pastizal (% de los del municipio, 2013–2025)');
  await expect(relleno('tizimin')).toHaveAttribute('fill', TONOS[4]);
  await expect(relleno('merida')).toHaveAttribute('fill', TONOS[0]);
  // Cada municipio lleva el tono de la clase que traen los datos.
  const mal = await page.locator('#ganMapa a').evaluateAll((as, { G, TONOS }) => as.filter((a) => {
    const g = G.municipios.find((x) => x.id === a.dataset.id);
    return a.querySelector('path').getAttribute('fill') !== TONOS[g.clases.focos];
  }).map((a) => a.dataset.id), { G, TONOS });
  expect(mal).toEqual([]);
  // La fuente y el límite se ven junto al mapa.
  await expect(page.locator('#ganaderia')).toContainText('Un foco sobre pastizal no dice quién quemó ni por qué.');
  await expect(page.locator('#ganaderia')).toContainText('Fuente: INEGI');
});

test('mapa ganadero: pasar por un municipio dice sus cifras y tocarlo abre su página', async ({ page }) => {
  await abrir(page, '#/municipio/tizimin');
  const lectura = page.locator('#ganLectura');
  await expect(lectura).toHaveText('Pasa por un municipio para ver sus cifras o tócalo para abrir su página.');
  const panaba = page.locator('#ganMapa a[data-id="panaba"]');
  await panaba.scrollIntoViewIfNeeded();
  await panaba.hover();
  await expect(lectura).toHaveText('El 79 % de Panabá es pastizal, y tiene 32,543 cabezas de ganado bovino (49 por km²).');
  await page.click('[data-gan="focos"]');
  await page.locator('#ganMapa a[data-id="panaba"]').hover();
  await expect(lectura).toContainText(/^De los focos de calor de Panabá de 2013 a 2025, el \d+ % cayó sobre pastizal\.$/);
  await page.locator('#ganMapa a[data-id="panaba"]').click();
  await expect(page).toHaveURL(/#\/municipio\/panaba$/);
  await expect(page.locator('h1')).toHaveText('Panabá');
  await expect(page.locator('#ganMapa a.propio')).toHaveAttribute('data-id', 'panaba');
});

test('mapa ganadero en el teléfono: cabe sin desplazarse de lado y las opciones miden 44 px', async ({ page }) => {
  await abrir(page, '#/municipio/tizimin', { ancho: 390, alto: 844 });
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(desborde).toBeLessThanOrEqual(0);
  const altos = await page.locator('[data-gan]').evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect().height));
  expect(Math.min(...altos)).toBeGreaterThanOrEqual(44);
  const mapa = await page.locator('#ganMapa').boundingBox();
  expect(mapa.width).toBeLessThanOrEqual(390 - 32);
});

test('mapa ganadero con pantalla táctil: la pista solo dice que se toca', async ({ browser, baseURL }) => {
  // Sin puntero no se «pasa por» un municipio.
  const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 }, baseURL });
  const p = await ctx.newPage();
  await p.goto('/#/municipio/tizimin');
  await expect(p.locator('#ganLectura')).toHaveText('Toca un municipio para abrir su página.');
  await ctx.close();
});

test('territorio ganadero en inglés', async ({ page }) => {
  await abrir(page, '#/municipio/buctzotz', { query: '?lang=en' });
  await expect(page.locator('#ganaderia h2')).toHaveText('Cattle land');
  await expect(page.locator('#ganCifras')).toContainText('81 % of Buctzotz is pasture');
  await expect(page.locator('#ganMapaTitulo')).toHaveText("Yucatán's cattle land");
  await expect(page.locator('#ganLeyenda li').first()).toHaveText('under 5 %');
  await expect(page.locator('#ganLectura')).toHaveText('Hover over a municipality to see its figures, or tap it to open its page.');
});
