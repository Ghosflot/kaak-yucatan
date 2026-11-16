// Portada (#/): criterios 1, 2, 3, 4, 7, 8 y 9 de la especificación.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { abrir } = require('./ayudas');

const PORTADA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'datos', 'portada.json'), 'utf8'));

for (const [ancho, alto] of [[1440, 900], [1280, 720]]) {
  test(`a ${ancho}×${alto} se ven la respuesta, el buscador, el mapa y las barras de los años sin desplazarse`, async ({ page }) => {
    await abrir(page, '#/', { ancho, alto, query: '?modo=final' });
    for (const sel of ['#resultado', '#busca2', '#visor', '#barras']) {
      const r = await page.locator(sel).boundingBox();
      expect(r, sel).not.toBeNull();
      expect(r.y + r.height, sel).toBeLessThanOrEqual(alto);
    }
  });

  test(`a ${ancho}×${alto} abre con los focos pasando sobre la foto, sin línea de tiempo, y al terminar entran los colores`, async ({ page }) => {
    await abrir(page, '#/', { ancho, alto });
    await expect(page.locator('#escenario')).toHaveAttribute('data-modo', 'repaso');
    await expect(page.locator('#instrumento')).toBeHidden();
    await expect(page.locator('#bloqueFoto')).toBeHidden();
    // La fecha del repaso va bajo el título.
    await expect(page.locator('#repasoDia')).toBeVisible();
    await expect(page.locator('#ambFecha')).toHaveText(/\d+ de (marzo|abril|mayo)/);
    // Al terminar la temporada (unos 10 s) entran los colores, con la explicación de qué significan.
    await expect(page.locator('#escenario')).toHaveAttribute('data-modo', 'final', { timeout: 20000 });
    await expect(page.locator('#repasoDia')).toBeHidden();
    await expect(page.locator('#explicaColor')).toHaveText(/2026/);
  });
}

const hayPuntos = (page) => page.evaluate(() => {
  const c = document.getElementById('ambiente'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < d.length; i += 4) if (d[i]) return true;
  return false;
});

test('sobre el mapa a color no pasan focos, en 2026 ni en otro año', async ({ page }) => {
  await abrir(page, '#/', { query: '?modo=final' });
  await page.waitForTimeout(600);
  expect(await hayPuntos(page)).toBe(false);
  await page.locator('#barras .toque[data-y="2003"]').click();
  await expect(page.locator('#explicaColor')).toHaveText(/2003/);
  expect(await hayPuntos(page)).toBe(false);
});

test('durante el repaso el mapa se acerca y se mueve sin detener los focos, y al entrar los colores se queda donde quedó', async ({ page }) => {
  await abrir(page, '#/');
  await expect(page.locator('#escenario')).toHaveAttribute('data-modo', 'repaso');
  await expect(page.locator('#zoom')).toBeVisible();
  const ancho = () => page.evaluate(() => parseFloat(document.getElementById('mapa').style.width));
  const antes = await ancho();
  const v = await page.locator('#visor').boundingBox();
  await page.mouse.move(v.x + v.width * 0.6, v.y + v.height * 0.5);
  await page.mouse.wheel(0, -500);
  await expect.poll(ancho).toBeGreaterThan(antes * 1.2);
  await expect(page.locator('#escenario')).toHaveAttribute('data-modo', 'repaso');
  const fecha = await page.locator('#ambFecha').textContent();
  await expect.poll(() => page.locator('#ambFecha').textContent()).not.toBe(fecha);
  const acercado = await ancho();
  await expect(page.locator('#escenario')).toHaveAttribute('data-modo', 'final', { timeout: 20000 });
  await page.waitForTimeout(900);
  expect(Math.abs((await ancho()) - acercado)).toBeLessThan(1);
});

test('«Saltar al mapa a color» salta el repaso y lleva al mapa a color', async ({ page }) => {
  await abrir(page, '#/');
  await page.locator('#saltarRepaso').click();
  await expect(page.locator('#escenario')).toHaveAttribute('data-modo', 'final');
  await expect(page.locator('#resultado')).toBeFocused();
});

test('el botón para saltar es el de la página y va justo bajo el título, antes de la fecha', async ({ page }) => {
  await abrir(page, '#/', { ancho: 1366, alto: 629 });
  const b = page.locator('#saltarRepaso');
  await expect(b).toHaveClass(/\bboton\b/);
  const t = await page.locator('#titulo').boundingBox(), r = await b.boundingBox(), l = await page.locator('#leyendaDia').boundingBox();
  expect(r.y).toBeGreaterThan(t.y + t.height);
  expect(r.y - (t.y + t.height)).toBeLessThan(30);
  expect(l.y).toBeGreaterThan(r.y + r.height);
});

// Al abrir se ve la península entera con mar y tierra alrededor, no pegada a las orillas del mapa.
for (const [ancho, alto] of [[1366, 629], [1920, 1080], [1024, 768], [390, 844]]) {
  test(`a ${ancho}×${alto} la península abre entera y con aire alrededor`, async ({ page }) => {
    await abrir(page, '#/', { ancho, alto });
    const m = await page.evaluate(() => {
      const e = document.getElementById('mapa'), v = document.getElementById('visor');
      return { k: parseFloat(e.style.width) / 825, x: parseFloat(e.style.left), y: parseFloat(e.style.top), W: v.clientWidth, H: v.clientHeight };
    });
    // El mapa empieza en y = −90 del lienzo; la tierra va de 0 a 825 y de 10 a 591.
    const izq = m.x, der = m.x + 825 * m.k, arriba = m.y + 100 * m.k, abajo = m.y + 681 * m.k;
    const aire = ancho > 860 ? 0.08 : 0.02;
    expect(arriba).toBeGreaterThan(m.H * aire);
    expect(abajo).toBeLessThan(m.H * (1 - aire));
    expect(izq).toBeGreaterThan(0);
    expect(der).toBeLessThan(m.W);
  });
}

test('al volver a «Temporada» desde otra sección se ve el mapa a color, sin repetir el repaso', async ({ page }) => {
  await abrir(page, '#/');
  await page.locator('#saltarRepaso').click();
  await page.evaluate(() => { location.hash = '#/metodo'; });
  await page.waitForSelector('#mSwitch');
  await page.evaluate(() => { location.hash = '#/'; });
  await expect(page.locator('#escenario')).toHaveAttribute('data-modo', 'final');
});

test('con «reducir movimiento» abre en el mapa a color, sin repaso ni focos', async ({ page }) => {
  await abrir(page, '#/', { reducir: true });
  await expect(page.locator('#escenario')).toHaveAttribute('data-modo', 'final');
  await expect(page.locator('#repasoDia')).toBeHidden();
  expect(await hayPuntos(page)).toBe(false);
});

// Lo que solo se ve en uso: con los focos pasando, nada cambia de tamaño ni de lugar entre un cuadro y el
// siguiente, en computadora y en teléfono. (La barra de tiempo anterior cambiaba de ancho 33 veces en 9 s.)
for (const [ancho, alto] of [[1366, 629], [1667, 898], [390, 844]]) {
  test(`a ${ancho}×${alto}, con los focos pasando nada se mueve ni cambia de tamaño`, async ({ page }) => {
    await abrir(page, '#/', { ancho, alto });
    await page.waitForTimeout(900); // la entrada del texto ya terminó
    const cambios = await page.evaluate(() => new Promise((ok) => {
      const sel = ['.barra', '#visor', '#cartel', '#resultado', '#escalaColor', '#leyendaDia', '#buscador2', '#pie', '#zoom', '.panel', '#barras'];
      const caja = (q) => { const r = document.querySelector(q).getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((v) => v.toFixed(1)).join(' '); };
      let antes = sel.map(caja);
      const lista = [], fin = performance.now() + 3000, fechas = new Set();
      const paso = () => {
        const ahora = sel.map(caja);
        ahora.forEach((c, i) => { if (c !== antes[i]) lista.push(`${sel[i]}: ${antes[i]} → ${c}`); });
        antes = ahora;
        fechas.add(document.getElementById('ambFecha').textContent);
        if (scrollY) lista.push('la página se desplazó a ' + scrollY);
        if (performance.now() < fin) requestAnimationFrame(paso); else ok({ lista, dias: fechas.size });
      };
      requestAnimationFrame(paso);
    }));
    expect(cambios.dias, 'la fecha de los focos avanza').toBeGreaterThan(5);
    expect(cambios.lista).toEqual([]);
  });
}

// Disposición sin choques: en cada tamaño de escritorio, nada se sale de la ventana, la página no se
// desplaza, la foto cubre todo el escenario y la tarjeta de los años no toca el texto, los botones
// del mapa ni Yucatán.
const ESCRITORIOS = [[1024, 600], [1280, 720], [1366, 629], [1366, 768], [1536, 864], [1920, 1080], [2560, 1440]];
const MOMENTOS = { cierre: { query: '?modo=final' }, 'cierre con la dirección vieja del repaso': { query: '?modo=repaso&t=45' } };

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
      panel: caja(document.querySelector('.panel')),
      // ¿Algún punto del borde de la tarjeta de los años cae dentro de Yucatán?
      tapaYucatan: (() => {
        const p = document.querySelector('.panel').getBoundingClientRect(), yuc = document.querySelector('#estados .yucatan');
        const svg = document.getElementById('capa'), m = svg.getScreenCTM().inverse();
        for (let i = 0; i <= 20; i++) for (const [x, y] of [[p.left + (p.width * i) / 20, p.top], [p.left, p.top + (p.height * i) / 20]]) {
          const pt = svg.createSVGPoint(); pt.x = x; pt.y = y;
          if (yuc.isPointInFill(pt.matrixTransform(m))) return true;
        }
        return false;
      })(),
      foto: caja(document.querySelector('.mapa > .fondo')),
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
        await expect(page.locator('#escenario')).toHaveAttribute('data-modo', 'final');
        await page.waitForTimeout(150);
        const m = await medirPortada(page);
        expect(m.desplaza, 'la página no se desplaza').toBeLessThanOrEqual(0);
        expect(dentro(m.cartel, m.ventana), 'el texto cabe en la ventana').toBe(true);
        expect(dentro(m.respuesta, m.ventana) && dentro(m.barras, m.ventana), 'la respuesta y sus barras se ven').toBe(true);
        expect(dentro(m.visor, m.foto), 'la foto amplia cubre todo el escenario').toBe(true);
        expect(m.panelSobra, 'el panel cabe sin desplazarse').toBeLessThanOrEqual(1);
        expect(m.instrumento, 'no hay línea de tiempo').toBeNull();
        expect(dentro(m.zoom, m.ventana), 'los botones del mapa caben').toBe(true);
        expect(tocan(m.zoom, m.cartel), 'los botones del mapa no tocan el texto').toBe(false);
        expect(dentro(m.panel, m.ventana), 'la tarjeta de los años cabe').toBe(true);
        expect(tocan(m.panel, m.cartel) || tocan(m.panel, m.zoom), 'la tarjeta de los años no toca el texto ni los botones').toBe(false);
        expect(m.tapaYucatan, 'la tarjeta de los años no tapa Yucatán').toBe(false);
      });
    }
    test(`${ancho}×${alto}, buscador abierto: sus opciones se pueden pulsar`, async ({ page }) => {
      await abrir(page, '#/', { ancho, alto });
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
  await abrir(page, '#/', { ancho: 390, alto: 844, query: '?modo=final' });
  for (const sel of ['#resultado', '#busca2', '#mapa']) {
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
  await page.fill('#busca2', 'tekax');
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
  await page.fill('#busca2', 'cancun');
  await expect(page.locator('#lista2 [role=option]').first()).toHaveText(/^Benito JuárezCancún, Quintana Roo$/);
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

// 1.7 MB desde la foto amplia de detrás (fondo.jpg), que deja abrir con la península entera y lo que la rodea.
test('la primera carga pesa menos de 1.7 MB', async ({ page }) => {
  await abrir(page, '#/');
  const { bytes, archivos } = await page.evaluate(() => {
    const todos = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')];
    return { bytes: todos.reduce((s, e) => s + e.encodedBodySize, 0), archivos: todos.length };
  });
  console.log('primera carga:', Math.round(bytes / 1024), 'KB en', archivos, 'archivos');
  expect(bytes).toBeGreaterThan(500 * 1024); // la foto y los datos tienen que estar contados
  expect(bytes).toBeLessThan(1.7 * 1024 * 1024);
});

test('en el teléfono la barra se queda arriba al bajar', async ({ page }) => {
  await abrir(page, '#/', { ancho: 390, alto: 844, reducir: true });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(100);
  const r = await page.locator('.barra').boundingBox();
  expect(Math.round(r.y)).toBe(0);
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

test.describe('usar mi ubicación', () => {
  test.use({ permissions: ['geolocation'] });

  test('dentro de Tekax lleva a la página de Tekax', async ({ page, context }) => {
    await context.setGeolocation({ latitude: 19.9829, longitude: -89.339 });
    await abrir(page, '#/');
    await page.locator('#buscador2 .ubicacion').click();
    await expect(page).toHaveURL(/#\/municipio\/tekax$/);
    await expect(page.locator('h1')).toHaveText('Tekax');
  });

  test('fuera de la península lo dice y deja el buscador', async ({ page, context }) => {
    await context.setGeolocation({ latitude: 19.4326, longitude: -99.1332 });
    await abrir(page, '#/');
    await page.locator('#buscador2 .ubicacion').click();
    await expect(page.locator('#buscador2 .aviso-ubicacion')).toHaveText(/fuera de la península/);
    await expect(page).toHaveURL(/#\/$/);
  });
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

// Como en las demás gráficas de barras con lo normal: 2026 en rojo, lo que pasa lo normal en rojo claro
// (rayado si es de 2001 a 2011) y lo demás en gris.
test('las barras del estado y las de la tarjeta usan el rojo claro para lo que pasa lo normal', async ({ page }) => {
  await abrir(page, '#/', { query: '?modo=final&sel=merida' });
  const estado = await page.locator('#barras rect.b-anio').evaluateAll((rs) => rs.map((r) => r.getAttribute('fill')));
  expect(estado.at(-1)).toBe('#D7261E');
  expect(estado).toContain('#E9837D');
  expect(estado).toContain('url(#barras-conv-sobre)');
  expect(estado.every((f) => ['#D7261E', '#E9837D', '#8F877D', 'url(#barras-conv)', 'url(#barras-conv-sobre)'].includes(f))).toBe(true);
  const tarjeta = await page.locator('.tarjeta.fija .historia > rect').evaluateAll((rs) => rs.map((r) => getComputedStyle(r).fill));
  expect(tarjeta.at(-1)).toBe('rgb(215, 38, 30)');
  expect(tarjeta).toContain('rgb(233, 131, 125)');
  expect(tarjeta).toContain('url("#tj-conv")'); // el rayado se ve: el CSS ya no lo tapa con gris liso
  expect(tarjeta).toContain('url("#tj-conv-sobre")');
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
    await expect(page).toHaveURL(/#\/\?anio=2003$/);
    await page.locator('#buscador2 input').fill('Tekax');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/\?anio=2003&sel=tekax$/);
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
    await page.mouse.move(b.x + b.width * 2.5, y, { steps: 4 });
    const pasando = await page.locator('#filaAnio').textContent();
    expect(['2001', '2002', '2003', '2004']).toContain(pasando);
    await page.mouse.move(fin.x + fin.width / 2, y, { steps: 10 });
    await page.mouse.up();
    // El clic de soltar no vuelve a 2026.
    await expect(page.locator('#filaAnio')).toHaveText('2010');
    await expect(page).toHaveURL(/anio=2010/);
    expect(await page.evaluate(() => history.length)).toBe(largo + 1);
  });

  // Al pasar el mouse la tarjeta es breve, para no tapar el mapa; al elegir el municipio muestra sus años.
  test('la tarjeta breve no tapa el mapa; la del municipio elegido muestra sus años y su hecho propio', async ({ page }) => {
    await abrir(page, '#/', { reducir: true });
    const v = await page.locator('.rellenos path[data-id="valladolid"]').boundingBox();
    await page.mouse.move(v.x + v.width / 2, v.y + v.height / 2);
    const breve = page.locator('.tarjeta.breve');
    await expect(breve).toContainText('Valladolid');
    await expect(breve).toContainText('2026: 96 focos · un año normal: 251');
    await expect(breve.locator('.historia')).toHaveCount(0);
    const caja = await breve.boundingBox();
    expect(caja.width * caja.height).toBeLessThan(260 * 100);
    await page.mouse.click(v.x + v.width / 2, v.y + v.height / 2);
    await expect(page.locator('.tarjeta.fija .historia > rect')).toHaveCount(26);
    await expect(page.locator('.tarjeta.fija .historia')).toHaveAttribute('aria-label', /Valladolid.*Lo normal es 251; en 2026 hubo 96/);
    await page.keyboard.press('Escape');
    await page.fill('#busca2', 'Tizimín');
    await page.keyboard.press('Enter');
    await expect(page.locator('.tarjeta.fija .historia > rect')).toHaveCount(26);
    await expect(page.locator('.tarjeta.fija .hecho')).toHaveText('La temporada con menos fuego desde 2012.');
  });

  test('«?» muestra los atajos y «/» lleva al buscador; el espacio y las flechas no sacan del mapa', async ({ page }) => {
    await abrir(page, '#/', { query: '?modo=final' });
    await page.locator('.barra').click({ position: { x: 700, y: 28 } });
    await page.keyboard.press('?');
    await expect(page.locator('#atajos')).toBeVisible();
    await expect(page.locator('#atajos dd').first()).toHaveText('Buscar un municipio');
    await page.keyboard.press('Escape');
    await expect(page.locator('#atajos')).toBeHidden();
    await page.keyboard.press('/');
    expect(await page.evaluate(() => document.activeElement.closest('#buscador2') !== null)).toBe(true);
    await page.keyboard.type('?'); // en el buscador, «?» se escribe
    await expect(page.locator('#atajos')).toBeHidden();
    await page.keyboard.press('Escape');
    await page.locator('.barra').click({ position: { x: 700, y: 28 } });
    await page.keyboard.press(' ');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#escenario')).toHaveAttribute('data-modo', 'final');
    await expect(page).toHaveURL(/#\/$/);
  });

  test('K\'ÁAK\' dice «fuego, en maya» al pasar el mouse', async ({ page }) => {
    await abrir(page, '#/');
    await page.locator('.marca').hover();
    await expect(page.locator('.marca-dice')).toHaveText('fuego, en maya');
    await expect(page.locator('.marca-dice')).toHaveCSS('opacity', '1');
    await expect(page.locator('.marca')).toHaveAttribute('aria-label', "K'áak', fuego en maya. Inicio");
  });
});

// Campos que portada.json suma (diseño, «Contrato de datos»). La página los usa cuando vienen y
// queda bien si faltan: aquí se inyectan o se quitan.
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
    await conCampos((d) => { delete d.reciente; return d; })({ page });
    await abrir(page, '#/');
    await expect(page.locator('#fueraTemporada')).toHaveText('La temporada de quemas cerró el 31 de mayo. Los datos se actualizan cuatro veces al día.');
    await conCampos((d) => ({ ...d, datoHasta: { 'S-NPP': '2026-04-20' } }))({ page });
    await page.reload();
    await page.waitForSelector('#rellenos path', { state: 'attached' });
    await expect(page.locator('#titulo')).toHaveText('¿Este año se quema más de lo normal en tu municipio?');
    await expect(page.locator('#fueraTemporada')).toBeHidden();
  });

  test('la franja de lo normal sale detrás de las barras solo si llega «yuc.rango»', async ({ page }) => {
    await conCampos((d) => { delete d.yuc.rango; return d; })({ page });
    await abrir(page, '#/');
    await expect(page.locator('#barras .rango')).toHaveCount(0);
    await page.unroute('**/datos/portada.json');
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
    const f = document.querySelector('.mapa > .fondo').getBoundingClientRect(), v = document.getElementById('visor').getBoundingClientRect();
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
    // Alejar no deja ver el borde de la foto amplia.
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
    // El gesto empieza en el mapa libre, debajo del municipio: ni sobre su tarjeta ni sobre la de los años.
    const px = v.x + v.width * 0.5, py = v.y + v.height * 0.75;
    await page.mouse.move(px, py);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(100);
    await page.mouse.down();
    await page.mouse.move(px + 2000, py + 2000, { steps: 10 });
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
