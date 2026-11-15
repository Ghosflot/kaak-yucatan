// Fechas de quema (#/fechas): el calendario de cada zona de Yucatán y el almanaque por municipio.
// Spec, «Fechas de quema».
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { abrir } = require('./ayudas');

// La zona elegida ya no es un <select>: es la opción marcada del mapa (un grupo de opciones).
const zonaElegida = (page) => page.locator('#zZonas [aria-checked="true"]');

// La afirmación ahora nombra el lugar y no «la zona 2» (spec, «Fechas»); la cifra sigue siendo la de la portada.
test('abre en la zona 2: la misma cifra que la portada y sus 42 días permitidos', async ({ page }) => {
  await abrir(page, '#/fechas/2');
  await expect(page.locator('h1')).toHaveText('En el centro y norte de Yucatán, 4 de cada 10 focos de calor de 2026 aparecieron fuera de las fechas en que se permite quemar.');
  await expect(zonaElegida(page)).toHaveAttribute('data-zona', '2');
  await expect(page.locator('.fz-dia')).toHaveCount(181);
  await expect(page.locator('.fz-dia.permitido')).toHaveCount(42);
  await expect(page.locator('#zSeder')).toContainText('del 20 de abril al 31 de mayo');
  await expect(page.locator('#zSeder')).toContainText('240 focos antes de esas fechas');
  await expect(page.locator('#zInferidos')).toContainText('Baca');
});

test('cambiar de zona cambia el calendario, el titular y el enlace', async ({ page }) => {
  await abrir(page, '#/fechas/2');
  await page.click('#zZonas [data-zona="4"]');
  await expect(page.locator('h1')).toContainText('casi todos los focos');
  await expect(page.locator('.fz-dia.permitido')).toHaveCount(25);
  await expect(page).toHaveURL(/#\/fechas\/4$/);
  await expect(page.locator('#zInferidos')).toBeHidden();
});

test('el enlace #/fechas/1 abre la zona 1', async ({ page }) => {
  await abrir(page, '#/fechas/1');
  await expect(zonaElegida(page)).toHaveAttribute('data-zona', '1');
  await expect(page.locator('h1')).toContainText('9 de cada 10');
});

test('«¿Cuál es mi zona?»: buscar el municipio elige su zona', async ({ page }) => {
  await abrir(page, '#/fechas/2');
  await page.fill('#busca3', 'tekax');
  await page.keyboard.press('Enter');
  await expect(zonaElegida(page)).toHaveAttribute('data-zona', '3');
  await expect(page.locator('#zMiZona')).toHaveText('Tekax está en la zona 3.');
  await page.click('#zZonas [data-zona="1"]');
  await expect(page.locator('#zMiZona')).toBeHidden();
  await page.fill('#busca3', 'baca');
  await page.keyboard.press('Enter');
  await expect(page.locator('#zMiZona')).toHaveText('Baca está, probablemente, en la zona 2.');
});

test('tocar el mapa elige la zona del municipio tocado', async ({ page }) => {
  await abrir(page, '#/fechas/2');
  await page.click('#zMapa path[data-id="tekax"]', { force: true });
  await expect(zonaElegida(page)).toHaveAttribute('data-zona', '3');
});

test('tocar un día dice cuántos focos hubo y si se permitía quemar', async ({ page }) => {
  await abrir(page, '#/fechas/2');
  await page.click('.fz-dia[data-i="120"]');
  await expect(page.locator('#zLectura')).toContainText('1 de mayo');
  await expect(page.locator('#zLectura')).toContainText('Se permite quemar');
  await page.click('.fz-dia[data-i="0"]');
  await expect(page.locator('#zLectura')).toContainText('1 de enero');
  await expect(page.locator('#zLectura')).toContainText('Fuera de las fechas permitidas');
});

test('almanaque: 127 renglones y la ventana marcada en los meses de cada municipio de Yucatán', async ({ page }) => {
  await abrir(page, '#/fechas/2');
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
  await abrir(page, '#/fechas/2');
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
  await abrir(page, '#/fechas/2');
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
  await abrir(page, '#/fechas/2');
  const antes = await page.getAttribute('#almanaque tr[data-id="tekax"] td.mes:nth-of-type(4)', 'title');
  await page.click('[data-anio="2026"]');
  const despues = await page.getAttribute('#almanaque tr[data-id="tekax"] td.mes:nth-of-type(4)', 'title');
  expect(antes).toContain('un año normal');
  expect(despues).toContain('2026');
});

test('de entrada se ven 12 renglones; «Ver los restantes» abre y cierra la tabla', async ({ page }) => {
  await abrir(page, '#/fechas/2');
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
  await abrir(page, '#/fechas/2');
  await page.fill('#almBuscar', 'tekax');
  await page.click('#almanaque tr[data-id="tekax"] .a-zona');
  await expect(zonaElegida(page)).toHaveAttribute('data-zona', '3');
  await expect(zonaElegida(page)).toBeFocused();
});

test('en inglés', async ({ page }) => {
  await abrir(page, '#/fechas/2', { query: '?lang=en' });
  await expect(page.locator('h1')).toHaveText('In the center and north of Yucatán, 4 in 10 hot spots in 2026 fell outside the permitted burn window.');
  await expect(page.locator('.fz-mes-cab span').first()).toBeVisible();
  await page.click('#zZonas [data-zona="3"]');
  await expect(page.locator('.fz-mes').nth(2).locator('.fz-mes-cab span')).toHaveText('allowed from the 10th');
  await expect(page.locator('.fz-mes').nth(3).locator('.fz-mes-cab span')).toHaveText('allowed until the 3rd');
});

// ---------- Lo nuevo: la afirmación, su patrón, la tira de 26 años, el mapa y el teléfono ----------

// Lo que dice cada zona con los datos de zonas.json: el 2026, el año normal y el mínimo desde 2001.
const ZONAS = {
  1: ['En el sur y oriente de Yucatán, 9 de cada 10 focos de calor de 2026 aparecieron fuera de las fechas en que se permite quemar.',
    'Si se miden con las fechas de 2026, en un año normal quedan fuera 6 de cada 10, casi todos después de que cierran las fechas.'],
  2: ['En el centro y norte de Yucatán, 4 de cada 10 focos de calor de 2026 aparecieron fuera de las fechas en que se permite quemar.',
    'Si se miden con las fechas de 2026, en un año normal queda fuera la mitad de los focos, casi todos antes de que se abran las fechas.'],
  3: ['En el sur de Yucatán, 9 de cada 10 focos de calor de 2026 aparecieron fuera de las fechas en que se permite quemar.',
    'Si se miden con las fechas de 2026, en un año normal quedan fuera 8 de cada 10, casi todos después de que cierran las fechas, y desde 2001 nunca han sido menos de 6 de cada 10.'],
  4: ['En el norte y oriente de Yucatán, casi todos los focos de calor de 2026 aparecieron fuera de las fechas en que se permite quemar.',
    'Si se miden con las fechas de 2026, en un año normal quedan fuera 9 de cada 10, casi todos después de que cierran las fechas, y desde 2001 nunca han sido menos de 6 de cada 10.'],
};
for (const [z, [afirma, patron]] of Object.entries(ZONAS)) {
  test(`zona ${z}: la afirmación con el nombre del lugar y su patrón, sin «ilegal»`, async ({ page }) => {
    await abrir(page, '#/fechas/' + z);
    await expect(page.locator('h1')).toHaveText(afirma);
    await expect(page.locator('#zPatron')).toHaveText(patron);
    // La afirmación va antes que cualquier otra cosa de la página.
    const primero = await page.evaluate(() => document.querySelector('.fechas').querySelector('h1, p, svg, table, input, button') === document.querySelector('#zTitular'));
    expect(primero).toBe(true);
    // El aviso de que un foco fuera de fechas no siempre es una quema de milpa queda a la vista, cerca de la afirmación.
    await expect(page.locator('.fz-prueba [data-t="zNota"]')).toBeVisible();
    expect(await page.evaluate(() => document.body.innerText)).not.toMatch(/ilegal/i);
  });
}

test('la tira de 26 años: 2026 en rojo, 2001–2011 rayados y cada año se lee con las flechas', async ({ page }) => {
  await abrir(page, '#/fechas/4');
  const tira = page.locator('#zTira');
  await expect(tira.locator('rect.b-anio')).toHaveCount(26);
  await expect(tira.locator('rect.b-anio.destacada')).toHaveAttribute('fill', '#D7261E');
  const rayados = await tira.locator('rect.b-anio').evaluateAll((rs) => rs.filter((r) => r.getAttribute('fill').startsWith('url(')).length);
  expect(rayados).toBe(11);
  // Ninguna letra de la tira mide menos de 11 px en la pantalla.
  const chica = await tira.locator('text').evaluateAll((ts) => Math.min(...ts.map((x) => x.getBoundingClientRect().height)));
  expect(chica).toBeGreaterThanOrEqual(11);
  await expect(page.locator('#zTiraLee')).toHaveText('En 2026 quedaron fuera casi todos, sobre todo después de las fechas.');
  await tira.focus();
  await page.keyboard.press('Home');
  await expect(tira).toHaveAttribute('aria-valuenow', '2001');
  await expect(page.locator('#zTiraLee')).toContainText('En 2001');
  await page.keyboard.press('ArrowRight');
  await expect(tira).toHaveAttribute('aria-valuetext', /^En 2002/);
});

test('el mapa: cuatro zonas con nombre, que se eligen con las flechas', async ({ page }) => {
  await abrir(page, '#/fechas/2');
  const opciones = page.locator('#zZonas [role="radio"]');
  await expect(opciones).toHaveCount(4);
  await expect(page.locator('#zZonas')).toHaveAttribute('role', 'radiogroup');
  await expect(opciones.nth(0)).toContainText('Sur y oriente');
  await zonaElegida(page).focus();
  await page.keyboard.press('ArrowRight');
  await expect(zonaElegida(page)).toHaveAttribute('data-zona', '3');
  await expect(zonaElegida(page)).toBeFocused();
  await expect(page).toHaveURL(/#\/fechas\/3$/);
  // Una sola parada de Tab para el grupo.
  await expect(page.locator('#zZonas [tabindex="0"]')).toHaveCount(1);
});

test('al final, una oración lleva a «Cómo lo medimos»', async ({ page }) => {
  await abrir(page, '#/fechas/2');
  const sigue = page.locator('.fz-sigue a');
  await expect(sigue).toHaveText('¿Y por qué creerle a estas cifras?');
  await expect(sigue).toHaveAttribute('href', '#/metodo');
});

test('la tabla: el «Ninguno» es un cuadro vacío y los pasos de color van de claro a oscuro', async ({ page }) => {
  await abrir(page, '#/fechas/2');
  // Claridad relativa de cada paso: tiene que bajar siempre y con saltos que se noten.
  const claridad = await page.evaluate(() => [1, 2, 3, 4, 5].map((k) => {
    const i = document.createElement('i'); i.className = 'a-c' + k; document.body.appendChild(i);
    const [r, g, b] = getComputedStyle(i).backgroundColor.match(/\d+/g).map(Number); i.remove();
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return Math.cbrt(0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b));
  }));
  for (let k = 1; k < claridad.length; k++) expect(claridad[k - 1] - claridad[k]).toBeGreaterThan(0.08);
  const vacio = await page.$eval('#almanaque .a-c0', (e) => getComputedStyle(e).boxShadow);
  expect(vacio).toContain('inset');
});

test('en el teléfono: días de 44 px de alto, nada de desplazamiento horizontal y fechas que no se parten', async ({ page }) => {
  await abrir(page, '#/fechas/2', { ancho: 390, alto: 844 });
  const altos = await page.$$eval('.fz-dia', (ds) => ds.map((d) => d.getBoundingClientRect().height));
  expect(Math.min(...altos)).toBeGreaterThanOrEqual(44);
  for (const z of ['1', '2', '3', '4']) {
    await page.click(`#zZonas [data-zona="${z}"]`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  }
  // Cada nombre de zona sobre el mapa se toca con 44 px de alto.
  const etq = await page.$$eval('.fz-etq', (bs) => bs.map((b) => { const r = b.getBoundingClientRect(); const a = getComputedStyle(b, '::after'); return r.height + parseFloat(a.top) * -1 + parseFloat(a.bottom) * -1; }));
  expect(Math.min(...etq)).toBeGreaterThanOrEqual(44);
  // «del 20 abr al 31 may» va entero en su renglón.
  const fechas = page.locator('#almanaque tr[data-id="abala"] .a-fechas');
  const caja = await fechas.evaluate((e) => { const rs = e.getClientRects(); return rs[rs.length - 1].width; });
  const texto = await fechas.textContent();
  expect(texto).toContain('20\u00A0abr\u00A0al\u00A031\u00A0may');
  expect(caja).toBeGreaterThan(60);
});

test('sin zona en la dirección abre la de más fuego del año, o la del municipio que se venía viendo', async ({ page }) => {
  const Z = JSON.parse(fs.readFileSync('web/datos/zonas.json', 'utf8')).zonas;
  const mayor = Z.reduce((a, b) => (b.tot > a.tot ? b : a)).n;
  await abrir(page, '#/fechas');
  await expect(zonaElegida(page)).toHaveAttribute('data-zona', mayor);
  // Quien venía de ver Muna (zona 3) llega a su zona, y la página se lo dice.
  await page.evaluate(() => { location.hash = '#/municipio/muna'; });
  await expect(page.locator('#nombre')).toHaveText('Muna');
  await page.evaluate(() => { location.hash = '#/fechas'; });
  await expect(zonaElegida(page)).toHaveAttribute('data-zona', '3');
  await expect(page.locator('#zMiZona')).toHaveText('Muna está en la zona 3.');
});
