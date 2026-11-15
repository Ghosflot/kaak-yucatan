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

// Disposición sin choques (diseño de la dirección visual, «Cómo se comprueba»): en cada tamaño de
// escritorio y en cada momento, el texto no toca la línea de tiempo, nada se sale de la ventana,
// la página no se desplaza y la foto cubre todo el escenario.
const ESCRITORIOS = [[1024, 600], [1280, 720], [1366, 629], [1366, 768], [1536, 864], [1920, 1080], [2560, 1440]];
const MOMENTOS = { foto: { query: '' }, repaso: { query: '?modo=repaso&t=45' }, cierre: { query: '?modo=final', reducir: true } };

async function medirPortada(page) {
  return page.evaluate(() => {
    const caja = (e) => { const r = e.getBoundingClientRect(); return { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }; };
    const visible = (e) => e && !e.hidden && !e.closest('[hidden]') && e.getClientRects().length > 0;
    // El cartel es lo que se ve de él: el titular y el bloque del momento (su sombra no cuenta).
    const partes = [...document.querySelectorAll('#titulo, #bloqueFoto, #bloqueFinal')].filter(visible).filter((e) => caja(e).x1 - caja(e).x0 > 2);
    const cartel = partes.map(caja).reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }));
    const instr = document.getElementById('instrumento');
    const zoom = document.getElementById('zoom');
    return {
      ventana: { x0: 0, y0: 0, x1: innerWidth, y1: innerHeight },
      desplaza: document.documentElement.scrollHeight - innerHeight,
      cartel,
      instrumento: visible(instr) ? caja(instr) : null,
      zoom: visible(zoom) ? caja(zoom) : null,
      respuesta: caja(document.getElementById('respuesta')),
      panelSobra: (() => { const p = document.querySelector('.panel'); return p.scrollHeight - p.clientHeight; })(),
      barras: caja(document.getElementById('barras')),
      foto: caja(document.getElementById('foto')),
      visor: caja(document.getElementById('visor')),
    };
  });
}
const dentro = (a, b) => a.x0 >= b.x0 - 0.5 && a.y0 >= b.y0 - 0.5 && a.x1 <= b.x1 + 0.5 && a.y1 <= b.y1 + 0.5;
const tocan = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

test.describe('disposición sin choques', () => {
  for (const [ancho, alto] of ESCRITORIOS) {
    for (const [momento, { query, reducir }] of Object.entries(MOMENTOS)) {
      test(`${ancho}×${alto}, ${momento}`, async ({ page }) => {
        await abrir(page, '#/', { ancho, alto, query, reducir });
        await expect(page.locator('#escenario')).toHaveAttribute('data-modo', momento === 'cierre' ? 'final' : momento);
        await page.waitForTimeout(150);
        const m = await medirPortada(page);
        expect(m.desplaza, 'la página no se desplaza').toBeLessThanOrEqual(0);
        expect(dentro(m.cartel, m.ventana), 'el texto cabe en la ventana').toBe(true);
        expect(dentro(m.respuesta, m.ventana) && dentro(m.barras, m.ventana), 'la respuesta y sus barras se ven').toBe(true);
        expect(dentro(m.visor, m.foto), 'la foto cubre todo el escenario').toBe(true);
        expect(m.panelSobra, 'el panel cabe sin desplazarse').toBeLessThanOrEqual(1);
        if (momento !== 'foto') {
          expect(dentro(m.instrumento, m.ventana), 'la línea de tiempo cabe').toBe(true);
          expect(tocan(m.cartel, m.instrumento), 'el texto no toca la línea de tiempo').toBe(false);
        }
        if (momento === 'cierre') {
          expect(dentro(m.zoom, m.ventana), 'los botones del mapa caben').toBe(true);
          expect(tocan(m.zoom, m.cartel) || tocan(m.zoom, m.instrumento), 'los botones del mapa no tocan nada').toBe(false);
        }
      });
    }
    test(`${ancho}×${alto}, buscador abierto: sus opciones se pueden pulsar`, async ({ page }) => {
      await abrir(page, '#/', { ancho, alto, query: '?modo=final', reducir: true });
      await page.locator('#busca2').fill('ma');
      const opciones = page.locator('#lista2 [role=option]');
      await expect(opciones.first()).toBeVisible();
      const n = await opciones.count();
      expect(n).toBeGreaterThan(3);
      for (let i = 0; i < n; i++) {
        const o = opciones.nth(i);
        await o.scrollIntoViewIfNeeded();
        const r = await o.boundingBox();
        expect(r.y >= 0 && r.y + r.height <= alto, `opción ${i} dentro de la ventana`).toBe(true);
        const arriba = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[role=option]')?.id, { x: r.x + r.width / 2, y: r.y + r.height / 2 });
        expect(arriba, `opción ${i} sin nada encima`).toBe(await o.getAttribute('id'));
      }
      await opciones.last().click();
      await expect(page.locator('.tarjeta.fija')).toBeVisible();
    });
  }
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

// El diseño de la dirección visual pinta los tres estados con la misma escala (antes, solo Yucatán).
test('el cierre pinta los tres estados, con Yucatán de contorno blanco', async ({ page }) => {
  await abrir(page, '#/', { reducir: true });
  const opacidad = (id) => page.$eval(`.rellenos path[data-id="${id}"]`, (e) => Number(getComputedStyle(e).fillOpacity));
  for (const id of ['tekax', 'calakmul', 'benito-juarez']) expect(await opacidad(id)).toBeGreaterThan(0.9);
  expect(await page.$eval('.estados path.yucatan', (e) => getComputedStyle(e).stroke)).toBe('rgb(255, 255, 255)');
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
  await expect(page.locator('#pistaAnio')).toHaveText('El mapa muestra 2003, visto por el satélite Aqua. Toca su barra otra vez para volver a 2026.');
  const i = PORTADA.porAnio.ids.indexOf('tekax');
  const v = PORTADA.porAnio.v[i][PORTADA.porAnio.anios.indexOf(2003)];
  await page.locator('.rellenos path[data-id="tekax"]').click({ force: true });
  await expect(page.locator('.tarjeta.fija')).toContainText('Focos de calor en 2003');
  await expect(page.locator('.tarjeta.fija')).toContainText(Math.round(v).toLocaleString('es-MX'));
  await page.keyboard.press('Escape');
  await page.click('#volver');
  await expect(page.locator('#resultado')).toHaveText(`${PORTADA.cuenta.menos} de ${PORTADA.cuenta.total} municipios de Yucatán tuvieron menos fuego que lo normal.`);
  await expect(page.locator('#volver')).toBeHidden();
  await expect(page.locator('#pistaAnio')).toHaveText('Toca un año para verlo en el mapa, o arrastra sobre las barras para recorrerlos.');
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

// Dudas de la prueba de cinco segundos. Desde la dirección visual, la historia de las fechas
// permitidas ya no está en el panel: queda el enlace a su página, escrito como pregunta.
test('las barras dicen quién vio cada periodo, y el panel lleva al método y a las fechas', async ({ page }) => {
  await abrir(page, '#/');
  await expect(page.locator('#barras text.ley-conv')).toHaveText('Terra y Aqua, pasados a la escala de hoy');
  await expect(page.locator('#barras text.periodo-t')).toHaveText(['Terra', 'Aqua', 'S-NPP', 'NOAA-20']);
  await expect(page.locator('#leyNormalTexto')).toHaveText(/^Lo normal: [\d,]+(, como \d{4})?$/);
  await expect(page.locator('.panel a[href="#/metodo"]')).toHaveText('Ver cómo lo comprobamos');
  await page.locator('.panel a[href="#/fechas"]').click();
  await expect(page).toHaveURL(/#\/fechas$/);
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

  // Los años de cada municipio ya no se esconden tras mantener presionado: la tarjeta los muestra siempre.
  test('la tarjeta muestra los años del municipio y su hecho propio', async ({ page }) => {
    await abrir(page, '#/', { reducir: true });
    const v = await page.locator('.rellenos path[data-id="valladolid"]').boundingBox();
    await page.mouse.move(v.x + v.width / 2, v.y + v.height / 2);
    await expect(page.locator('#tarjeta .historia > rect')).toHaveCount(26);
    await expect(page.locator('#tarjeta .historia')).toHaveAttribute('aria-label', /Valladolid.*Lo normal es 251; en 2026 hubo 96/);
    await page.fill('#busca2', 'Tizimín');
    await page.keyboard.press('Enter');
    await expect(page.locator('.tarjeta.fija .historia > rect')).toHaveCount(26);
    await expect(page.locator('.tarjeta.fija .hecho')).toHaveText('La temporada con menos fuego desde 2012.');
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

// Campos que la tanda de datos suma a portada.json (diseño, «Contrato de datos»). La página tiene que
// usarlos cuando lleguen y quedar bien sin ellos: aquí se inyectan.
test.describe('datos nuevos de portada.json', () => {
  const conCampos = (extra) => async ({ page }) => {
    await page.route('**/datos/portada.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(extra(structuredClone(PORTADA))) }));
  };

  test('fuera de temporada, la pregunta va en pasado y dice los focos de los últimos 7 días', async ({ page }) => {
    await conCampos((d) => ({ ...d, datoHasta: { 'S-NPP': '2026-11-14', 'NOAA-20': '2026-11-13' }, reciente: { dias: 7, desde: '2026-11-08', hasta: '2026-11-14', yuc: 9, peninsula: 41 } }))({ page });
    await abrir(page, '#/');
    await expect(page.locator('#titulo')).toHaveText('¿Se quemó este año más de lo normal en tu municipio?');
    await expect(page.locator('#fueraTemporada')).toHaveText('La temporada de quemas cerró el 31 de mayo. Los datos se actualizan cuatro veces al día: en los últimos 7 días hubo 41 focos de calor en la península.');
  });

  test('sin «reciente», la línea solo dice cuándo cerró; en temporada, no sale', async ({ page }) => {
    await abrir(page, '#/');
    await expect(page.locator('#fueraTemporada')).toHaveText('La temporada de quemas cerró el 31 de mayo. Los datos se actualizan cuatro veces al día.');
    await conCampos((d) => ({ ...d, datoHasta: { 'S-NPP': '2026-04-20' } }))({ page });
    await page.reload();
    await page.waitForSelector('#rellenos path', { state: 'attached' });
    await expect(page.locator('#titulo')).toHaveText('¿Este año se quema más de lo normal en tu municipio?');
    await expect(page.locator('#fueraTemporada')).toBeHidden();
  });

  test('el repaso dice qué satélite contó cada día', async ({ page }) => {
    await conCampos((d) => ({ ...d, satDia: { base: 'S-NPP', otros: { 60: 'NOAA-20' } } }))({ page });
    await abrir(page, '#/', { query: '?modo=repaso&t=60' });
    await expect(page.locator('#fecha')).toHaveText('30 de abril');
    await expect(page.locator('#satelite')).toHaveText('visto por NOAA-20');
    await page.locator('#tiempo').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#satelite')).toHaveText('visto por S-NPP');
    await expect(page.locator('#tiempo')).toHaveAttribute('aria-valuetext', /visto por S-NPP/);
  });

  test('sin «satDia», 2026 no inventa satélite; otro año dice el suyo', async ({ page }) => {
    await abrir(page, '#/', { query: '?modo=repaso&t=60' });
    await expect(page.locator('#satelite')).toHaveText('');
    await page.goto('/#/?modo=final&anio=2005');
    await expect(page.locator('#satelite')).toHaveText('visto por Aqua');
  });

  test('la franja de lo normal sale detrás de las barras solo si llega «yuc.rango»', async ({ page }) => {
    await abrir(page, '#/');
    await expect(page.locator('#barras .rango')).toHaveCount(0);
    await conCampos((d) => { d.yuc.rango = [5500, 9600]; return d; })({ page });
    await page.reload();
    await page.waitForSelector('#rellenos path', { state: 'attached' });
    await expect(page.locator('#barras .rango')).toHaveCount(1);
    await page.click('#leyNormal');
    await expect(page.locator('#explicaNormal')).toContainText('La franja gris va de 5,500 a 9,600');
  });
});

// Acercar y arrastrar el mapa del cierre, sin salirse de la foto.
test.describe('el mapa del cierre se acerca y se arrastra', () => {
  const ancho = () => (page) => page.$eval('#mapa', (e) => e.getBoundingClientRect().width);
  const cubre = (page) => page.evaluate(() => {
    const f = document.getElementById('foto').getBoundingClientRect(), v = document.getElementById('visor').getBoundingClientRect();
    return f.left <= v.left + 0.5 && f.top <= v.top + 0.5 && f.right >= v.right - 0.5 && f.bottom >= v.bottom - 0.5;
  });

  test('con los botones y con el teclado (+, − y 0)', async ({ page }) => {
    await abrir(page, '#/', { reducir: true, ancho: 1366, alto: 629 });
    const w = ancho();
    const inicio = await w(page);
    await page.click('#acercar');
    await expect.poll(() => w(page)).toBeGreaterThan(inicio * 1.4);
    await page.keyboard.press('+');
    await expect.poll(() => w(page)).toBeGreaterThan(inicio * 2);
    // Nunca más de 4 veces el encuadre de Yucatán.
    for (let i = 0; i < 6; i++) await page.click('#acercar');
    await page.waitForTimeout(400);
    expect(await w(page)).toBeLessThanOrEqual(inicio * 4 + 1);
    await page.keyboard.press('0');
    await expect.poll(() => w(page)).toBeLessThan(inicio);
    // Alejar no deja ver el borde de la foto.
    for (let i = 0; i < 6; i++) await page.keyboard.press('-');
    await page.waitForTimeout(400);
    expect(await cubre(page)).toBe(true);
    await expect(page.locator('#acercar')).toHaveAttribute('aria-label', 'Acercar');
    await expect(page.locator('#verTodo')).toHaveAttribute('aria-label', 'Ver los tres estados');
  });

  test('con la rueda y arrastrando, la tarjeta sigue al municipio y la foto siempre cubre', async ({ page }) => {
    await abrir(page, '#/', { reducir: true, ancho: 1366, alto: 768 });
    await page.fill('#busca2', 'Tekax');
    await page.keyboard.press('Enter');
    const v = await page.locator('#visor').boundingBox();
    const antes = await page.locator('#tarjeta').boundingBox();
    await page.mouse.move(v.x + v.width * 0.6, v.y + v.height * 0.4);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(100);
    await page.mouse.down();
    await page.mouse.move(v.x + v.width * 0.6 + 2000, v.y + v.height * 0.4 + 2000, { steps: 10 });
    await page.mouse.up();
    expect(await cubre(page)).toBe(true);
    const despues = await page.locator('#tarjeta').boundingBox();
    expect(despues.x !== antes.x || despues.y !== antes.y).toBe(true);
    // Soltar el arrastre sobre otro municipio no lo elige.
    await expect(page.locator('#tarjeta .nombre')).toHaveText('Tekax');
  });

  test('buscar lleva la cámara al municipio y la tarjeta no lo tapa', async ({ page }) => {
    for (const [ancho, alto] of [[1366, 629], [1920, 1080]]) {
      await abrir(page, '#/', { reducir: true, ancho, alto });
      await page.fill('#busca2', 'Tizimín');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
      const m = await page.locator('.seleccion .borde').boundingBox();
      const tj = await page.locator('#tarjeta').boundingBox();
      const v = await page.locator('#visor').boundingBox();
      const cx = m.x + m.width / 2, cy = m.y + m.height / 2;
      expect(cx > v.x && cx < v.x + v.width && cy > v.y && cy < v.y + v.height, `${ancho}: el municipio queda en el mapa`).toBe(true);
      expect(cx < tj.x || cx > tj.x + tj.width || cy < tj.y || cy > tj.y + tj.height, `${ancho}: la tarjeta no lo tapa`).toBe(true);
    }
  });

  test('en el teléfono, deslizar con un dedo desplaza la página y no el mapa', async ({ browser }) => {
    const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/#/?modo=final');
    await page.waitForSelector('#rellenos path', { state: 'attached' });
    expect(await page.$eval('#visor', (e) => getComputedStyle(e).touchAction)).toBe('pan-y');
    await page.click('#acercar');
    expect(await page.$eval('#visor', (e) => getComputedStyle(e).touchAction)).toBe('none');
    await ctx.close();
  });
});
