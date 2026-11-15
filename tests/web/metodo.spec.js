// Cómo lo medimos (#/metodo): el salto de 2012 con su interruptor, qué es un foco de calor, la hora
// del paso de Terra y Aqua, qué dejamos fuera, las cuatro preguntas, cada satélite contra la serie
// y la descarga. Spec de la dirección visual, «Cómo lo medimos»; las cifras salen de web/datos/.
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { abrir, revisarAxe } = require('./ayudas');

const M = JSON.parse(fs.readFileSync('web/datos/metodo.json', 'utf8'));
const V = JSON.parse(fs.readFileSync('web/datos/validacion.json', 'utf8'));
const SAT = JSON.parse(fs.readFileSync('web/datos/satelites.json', 'utf8'));
const ES = JSON.parse(fs.readFileSync('web/textos/es.json', 'utf8'));
const EN = JSON.parse(fs.readFileSync('web/textos/en.json', 'utf8'));
const uno = (n) => n.toFixed(1);
const llenar = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m));
// La razón de la gráfica de arriba (Yucatán, de marzo a mayo), como la calcula la página.
const prom = ([a, b], c) => { const xs = M.anios.filter((x) => x.y >= a && x.y <= b); return xs.reduce((s, x) => s + x[c], 0) / xs.length; };
const RAZON_CORR = prom(M.salto.despues, 'armonizado') / prom(M.salto.antes, 'armonizado');
// «13:12» → «1:12».
const hora12 = (h) => { const [a, b] = h.split(':').map(Number); return (a % 12 || 12) + ':' + String(b).padStart(2, '0'); };
const ultima = (sat) => { const x = M.paso[sat]; return x[Math.max(...Object.keys(x).map(Number))]; };

// Abre la gráfica y las limitaciones de las cuatro preguntas.
async function abrirTodo(page) {
  await page.locator('.m-prueba summary').evaluateAll((ss) => ss.forEach((s) => { s.parentNode.open = true; }));
  await expect(page.locator('.m-prueba-graf svg > *').first()).toBeAttached();
}

test('abre con el salto de 2012 sin corregir, y el interruptor lo corrige', async ({ page }) => {
  await abrir(page, '#/metodo');
  // Lo primero bajo el título es la oración y el interruptor, apagado.
  const sw = page.locator('#mSwitch');
  await expect(sw).toHaveAttribute('role', 'switch');
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await expect(sw).toHaveAccessibleName(ES.mInterruptor);
  const activo = page.locator('.m-salto > .activo');
  await expect(activo.locator('.m-salto-t')).toHaveText(ES.mSaltoCrudoTriple);
  await expect(activo.locator('.m-salto-s')).toContainText('2009–2011');
  const caja = await page.locator('.m-abre').boundingBox();
  expect(caja.y).toBeLessThan(260);
  const barras = page.locator('#salto rect.m-barra');
  await expect(barras).toHaveCount(26);
  const escala = (y) => page.locator(`#salto rect.m-barra[data-y="${y}"]`).evaluate((r) => Number(r.style.transform.match(/scaleY\(([\d.]+)\)/)[1]));
  const crudo2011 = await escala(2011), crudo2013 = await escala(2013);
  await expect(page.locator('#mRayas')).not.toHaveClass(/visible/);
  // No se corrige solo: el gesto es de quien llega.
  await page.waitForTimeout(1600);
  await expect(sw).toHaveAttribute('aria-checked', 'false');

  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await expect(activo.locator('.m-salto-t')).toHaveText(ES.mSaltoCorrTriple);
  await expect(activo.locator('.m-salto-s')).toContainText(Math.round(prom(M.salto.antes, 'armonizado')).toLocaleString('es-MX'));
  await expect(activo.locator('.m-salto-s')).not.toContainText('{');
  await expect(page.locator('#mRayas')).toHaveClass(/visible/);
  // El lector de pantalla oye la oración nueva.
  await expect(page.locator('#anuncio')).toContainText(ES.mSaltoCorrTriple);
  // Desde 2012 las dos series son la misma; antes, sin corregir queda abajo.
  expect(await escala(2013)).toBe(crudo2013);
  expect(await escala(2011)).toBeGreaterThan(crudo2011);
  await expect(page.locator('#salto rect.m-barra[data-y="2011"]')).toHaveAttribute('fill', 'url(#salto-rayas)');
  // El estado queda en la dirección y sobrevive a recargar la página.
  await expect(page).toHaveURL(/#\/metodo\/corregido$/);
  await page.reload();
  await page.waitForSelector('#mSwitch');
  await expect(page.locator('#mSwitch')).toHaveAttribute('aria-checked', 'true');
  await page.locator('#mSwitch').click();
  await expect(page).toHaveURL(/#\/metodo$/);
  await expect(page.locator('.m-salto > .activo .m-salto-t')).toHaveText(ES.mSaltoCrudoTriple);
});

test('las dos oraciones del salto ocupan el mismo alto: nada brinca al accionar el interruptor', async ({ page }) => {
  for (const ancho of [1366, 390]) {
    await abrir(page, '#/metodo', { ancho, alto: 844 });
    const antes = await page.locator('#salto').boundingBox();
    await page.locator('#mSwitch').click();
    const despues = await page.locator('#salto').boundingBox();
    expect(despues.y).toBe(antes.y);
  }
});

test('con «reducir movimiento» también abre sin corregir, pero las barras no se animan', async ({ page }) => {
  await abrir(page, '#/metodo', { reducir: true });
  await expect(page.locator('#mSwitch')).toHaveAttribute('aria-checked', 'false');
  const duracion = await page.locator('#salto rect.m-barra').first().evaluate((r) => getComputedStyle(r).transitionDuration);
  // Con «reducir movimiento», la regla general de la hoja de estilo deja 0.01 ms: es como nada.
  expect(parseFloat(duracion) * (duracion.endsWith('ms') ? 1 : 1000)).toBeLessThan(1);
  await page.locator('#mSwitch').click();
  await expect(page.locator('.m-salto > .activo .m-salto-t')).toHaveText(ES.mSaltoCorrTriple);
});

test('explica qué es un foco de calor, por qué en 1 km y a qué hora pasa el satélite', async ({ page }) => {
  await abrir(page, '#/metodo');
  await expect(page.locator('h1')).toHaveText('Cómo lo medimos');
  const f = page.locator('#mFoco');
  await expect(f.locator('h2')).toHaveText('Qué es un foco de calor');
  await expect(f).toContainText('cuadrito de 1 km con fuego en un día');
  await expect(f).toContainText('375 m');
  await expect(f).toContainText('no distingue una quema de milpa de un incendio');
  await expect(f).toContainText('no quiere decir que no hubo fuego');
  // La hora es la mediana de los años de S-NPP; la parte de la tarde sale de `nocturnos`.
  const snpp = Object.values(M.paso['S-NPP']).sort();
  await expect(f).toContainText(`hacia la ${hora12(snpp[snpp.length >> 1])} de la tarde`);
  await expect(f).toContainText(`${Math.round((1 - M.nocturnos) * 100)} de cada 100 focos son del paso de la tarde`);
});

test('un satélite por periodo, con sus fechas, y por qué no seguir con Terra y Aqua', async ({ page }) => {
  await abrir(page, '#/metodo');
  const periodos = page.locator('#mPeriodos li');
  await expect(periodos).toHaveCount(4);
  await expect(periodos.nth(0)).toContainText('Terra');
  await expect(periodos.nth(2)).toContainText('del 20 de enero de 2012 al 2 de noviembre de 2026');
  await expect(periodos.nth(3)).toContainText('desde el 3 de noviembre de 2026');
  await expect(page.locator('#mUnir')).toContainText(`entre ${uno(M.factores.aqua[0])} y ${uno(M.factores.aqua[1])}`);
  // La gráfica chica de la hora de paso: tres líneas con su nombre y su última hora.
  const paso = page.locator('#pasoSvg');
  await expect(paso).toHaveAttribute('role', 'img');
  await expect(paso.locator('polyline')).toHaveCount(3);
  for (const s of ['Terra', 'Aqua', 'S-NPP']) await expect(paso).toContainText(s);
  await expect(paso).toContainText(hora12(ultima('Terra')));
  await expect(paso).toContainText(hora12(ultima('Aqua')));
  const p1 = page.locator('#mPaso1');
  await expect(p1).toContainText('Hasta 2022');
  await expect(p1).toContainText(`a las ${hora12(ultima('Terra'))} de la mañana`);
  await expect(p1).toContainText(`a las ${hora12(ultima('Aqua'))} de la tarde`);
  await expect(page.locator('#mPaso')).toContainText('no usamos a Terra ni a Aqua para los años recientes');
});

test('qué dejamos fuera: la fuente fija de Mérida y los días sin datos', async ({ page }) => {
  await abrir(page, '#/metodo');
  const f = page.locator('#mFuera');
  const F = M.fuenteFija;
  await expect(f).toContainText('casi 6 de cada 10');
  await expect(f).toContainText(`${F.fijas.toLocaleString('es-MX')} de ${F.detecciones.toLocaleString('es-MX')}`);
  await expect(f).toContainText(`${M.sinDatos.dias} días sin datos`);
  await expect(f).toContainText(`${M.sinDatos.rellenados} de ellos se rellenaron`);
});

test('¿Se puede confiar?: cuatro preguntas, cada una con su respuesta a la vista', async ({ page }) => {
  await abrir(page, '#/metodo');
  const c = page.locator('#mConfiar');
  await expect(c.locator('h2')).toHaveText('¿Se puede confiar?');
  // «La meta se fijó antes de ver el resultado» se dice una vez, arriba.
  await expect(c.locator('> p').first()).toContainText('antes de ver el resultado');
  const preguntas = c.locator('.m-prueba');
  await expect(preguntas).toHaveCount(V.pruebas.length);
  for (const p of V.pruebas) {
    const base = 'val' + p.id.split('_').map((x) => x[0].toUpperCase() + x.slice(1)).join('');
    const q = c.locator(`.m-prueba[data-prueba="${p.id}"]`);
    await expect(q.locator('h3')).toHaveText(ES[base + 'Nombre']);
    expect(ES[base + 'Nombre']).toMatch(/^¿.+\?$/);
    // La frase del caso que salió, con sus números (como t() en web/js/textos.js); empieza con la respuesta.
    const frase = llenar(ES[p.clave], p.valores);
    await expect(q.locator('.m-respuesta')).toHaveText(frase);
    expect(frase).toMatch(/^(Sí|No|En parte)[.,]/);
    await expect(q.locator('.m-respuesta b')).toHaveText(/^(Sí|No|En parte)/);
    await expect(q.locator('.m-pendiente')).toHaveCount(0);
    // La gráfica y las limitaciones están plegadas; la gráfica se dibuja al abrirse.
    await expect(q.locator('.m-prueba-graf')).toBeHidden();
    await q.locator('.m-det-graf summary').click();
    await expect(q.locator('.m-det-graf')).toHaveAttribute('open', '');
    await expect(q.locator('.m-prueba-graf svg')).toHaveAttribute('role', 'img');
    expect(await q.locator('.m-prueba-graf svg > *').count()).toBeGreaterThan(5);
    await expect(q.locator('img')).toHaveCount(0);
    await q.locator('.m-det-lim summary').click();
    await expect(q.locator('.m-det-lim li').first()).toBeVisible();
  }
  // Un solo criterio para el veredicto: ya no hay «Pasa:» ni «Cumple:», ni cifras gigantes con etiqueta.
  await expect(c).not.toContainText('Pasa:');
  await expect(c).not.toContainText('Cumple:');
  await expect(c.locator('.cifra')).toHaveCount(0);
  const mayusculas = await c.locator('h3, .m-grupo-t').evaluateAll((es) => es.filter((e) => getComputedStyle(e).textTransform === 'uppercase').length);
  expect(mayusculas).toBe(0);
  // La CONAFOR: primero los incendios grandes, después todos contra el azar, y el dato por duración.
  const cf = V.pruebas.find((p) => p.id === 'conafor').valores;
  const conafor = c.locator('.m-prueba[data-prueba="conafor"]');
  await expect(conafor.locator('.m-respuesta')).toContainText(`${cf.grandesSnpp} de cada 100 incendios grandes`);
  await expect(conafor.locator('.m-respuesta')).toContainText(`por azar coincidirían ${cf.azarSnpp}`);
  const d = M.conafor.porDuracion;
  await expect(conafor.locator('.m-det')).toContainText(`${d[0].vistos} de cada 100 incendios que duraron un día`);
  await expect(conafor.locator('.m-det')).toContainText(`${d[d.length - 1].vistos} de cada 100 de los que duraron más de una semana`);
  await expect(conafor.locator('.m-det')).toContainText('no solo S-NPP');
  await expect(conafor).toContainText('no quemas agrícolas');
  // El salto: las cifras exactas dicen su territorio y su periodo, y las de Yucatán van aparte.
  const s = V.pruebas.find((p) => p.id === 'salto_2012').valores;
  const salto = c.locator('.m-prueba[data-prueba="salto_2012"]');
  await expect(salto.locator('.m-respuesta')).toContainText('En la península entera y con el año completo');
  await expect(salto.locator('.m-det')).toContainText(`Solo en el estado de Yucatán, el mismo cálculo da ${s.razonCrudaYucatan} sin corregir y ${s.razonArmonizadaYucatan}`);
});

test('las gráficas: letra de 11 px o más, sin rojo y sin salirse, en computadora y en teléfono', async ({ page }) => {
  for (const [ancho, alto] of [[1440, 900], [390, 844]]) {
    await abrir(page, '#/metodo', { ancho, alto });
    await abrirTodo(page);
    await page.locator('#mSwitch').click();
    await page.waitForTimeout(300);
    const chicas = await page.$$eval('.metodo svg text', (ts) => ts.filter((n) => n.textContent.trim()).map((n) => {
      const svg = n.ownerSVGElement;
      const k = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      return [n.textContent, parseFloat(getComputedStyle(n).fontSize) * k];
    }).filter(([, px]) => px < 10.95));
    expect(chicas).toEqual([]);
    // El rojo es 2026 y nada más: no aparece en esta página.
    const rojos = await page.$$eval('.metodo svg *, .metodo i', (es) => es.filter((e) => {
      const cs = getComputedStyle(e);
      return [cs.fill, cs.stroke, cs.backgroundColor, cs.borderTopColor].some((c) => c === 'rgb(215, 38, 30)');
    }).length);
    expect(rojos).toBe(0);
    const { scroll, ventana } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, ventana: window.innerWidth }));
    expect(scroll).toBeLessThanOrEqual(ventana);
    // Ningún texto de una gráfica se sale de su dibujo.
    const fuera = await page.$$eval('.metodo svg text', (ts) => ts.filter((n) => {
      const r = n.getBoundingClientRect(), s = n.ownerSVGElement.getBoundingClientRect();
      return n.textContent.trim() && (r.left < s.left - 1 || r.right > s.right + 1);
    }).map((n) => n.textContent));
    expect(fuera).toEqual([]);
  }
});

test('en el teléfono, los puntos de NOAA-20 y NOAA-21 no se enciman', async ({ page }) => {
  await abrir(page, '#/metodo', { ancho: 390, alto: 844 });
  await abrirTodo(page);
  const choques = await page.locator('.m-prueba[data-prueba="viirs"] svg').evaluate((svg) => {
    const cajas = (sel) => [...svg.querySelectorAll(sel)].map((e) => e.getBoundingClientRect());
    const a = cajas('circle'), b = cajas('rect[width="9"]');
    return a.filter((p) => b.some((q) => p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom)).length;
  });
  expect(choques).toBe(0);
});

test('con todo abierto y corregido, axe no encuentra violaciones serias', async ({ page }) => {
  await abrir(page, '#/metodo');
  await abrirTodo(page);
  await page.locator('#mSwitch').click();
  expect(await revisarAxe(page)).toEqual([]);
});

test('cada satélite contra la serie: se elige el satélite y la escala', async ({ page }) => {
  await abrir(page, '#/metodo');
  const caja = page.locator('#mSat');
  await expect(caja).toBeVisible();
  await expect(caja.locator('h3')).toHaveText(ES.mSatTitulo);
  await expect(caja.locator('[data-sat]')).toHaveCount(SAT.satelites.length);
  await expect(caja.locator('[data-sat="Aqua"] small')).toHaveText('MODIS');
  // Abre con Aqua corregido: la línea es continua.
  await expect(caja.locator('[data-sat="Aqua"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(caja.locator('[data-esc="cal"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(caja.locator('polyline')).toHaveAttribute('stroke-dasharray', 'none');
  await expect(caja.locator('circle')).toHaveCount(SAT.satelites.find((x) => x.sat === 'Aqua').anios.length);
  // Las cifras van en oraciones, no en números gigantes con etiqueta.
  await expect(caja.locator('#mSatLectura')).toContainText('Aqua tiene datos de temporada de 2003 a 2026');
  await expect(caja.locator('#mSatLectura .cifra')).toHaveCount(0);
  await caja.locator('[data-esc="crudo"]').click();
  await expect(caja.locator('polyline')).toHaveAttribute('stroke-dasharray', '7 5');
  await expect(caja.locator('#mSatLey')).toContainText('Aqua, sin corregir');
  // Al pasar por un año, la ventanita dice la serie y el satélite de ese año.
  const serie2007 = M.anios.find((a) => a.y === 2007).armonizado;
  await caja.locator('.m-sat-zona').nth(6).hover();
  await expect(caja.locator('#mSatPunta')).toBeVisible();
  await expect(caja.locator('#mSatPunta')).toContainText('2007');
  await expect(caja.locator('#mSatPunta')).toContainText(Math.round(serie2007).toLocaleString('es-MX'));
  await expect(caja.locator('#mSatPunta')).toContainText('Aqua sin corregir');
  await expect(caja.locator('svg')).toContainText('2012: cambia el satélite (MODIS → VIIRS)');
  // S-NPP es la escala: no lleva factor ni banda.
  await caja.locator('[data-sat="S-NPP"]').click();
  await expect(caja.locator('#mSatLectura')).toContainText('S-NPP es la escala');
  await expect(caja.locator('#mSatLey')).not.toContainText('factor');
  // NOAA-20: su factor sale de los mismos años, y la página lo dice.
  await caja.locator('[data-sat="NOAA-20"]').click();
  await expect(caja.locator('#mSatLectura')).toContainText('no es una comprobación independiente');
  await expect(caja.locator('#mSatLectura')).toContainText('En 2018 le falta el principio');
  await expect(caja.locator('.m-sat-nota')).toContainText('1 de abril de 2018');
  // El teclado también abre la ventanita.
  await caja.locator('.m-sat-zona').first().focus();
  await expect(caja.locator('#mSatPunta')).toContainText('2001');
});

test('las gráficas de las pruebas dicen lo mismo que sus PNG, en el mismo orden', async ({ page }) => {
  await abrir(page, '#/metodo');
  await abrirTodo(page);
  const c = page.locator('#mConfiar');
  const tj = (id) => c.locator(`.m-prueba[data-prueba="${id}"]`);
  // El título de cada gráfica es el de su PNG y la leyenda va dentro del dibujo.
  await expect(tj('salto_2012').locator('figcaption')).toHaveText('Prueba 1 · Salto de 2012 · Península de Yucatán');
  await expect(tj('viirs').locator('figcaption')).toHaveText('Prueba 4 · NOAA-20 y NOAA-21 contra S-NPP');
  await expect(c.locator('.m-prueba-graf .m-sat-ley')).toHaveCount(0);
  const textos = async (id) => (await tj(id).locator('svg').evaluate((s) => s.textContent)).replace(/\s+/g, ' ');
  const enOrden = (todo, partes) => {
    let i = -1;
    for (const p of partes) { const j = todo.indexOf(p, i + 1); expect(j, p).toBeGreaterThan(i); i = j; }
  };
  enOrden(await textos('salto_2012'), ['Cuadritos-día por año, sin calibrar', 'promedio 8,680', 'promedio 28,281',
    'Cuadritos-día por año, calibrada', 'promedio 31,295', 'Promedio 2013–15 ÷ promedio 2009–11', 'umbral',
    'rango natural 0.87–1.16', 'Sin calibrar: 3.26', 'Calibrada: 0.90', '✓', '(sin salto)']);
  enOrden(await textos('aqua_fuera_muestra'), ['Cuadritos-día por año', 'S-NPP (observado)', 'Aqua × factor por zona y época',
    'Aqua × factor único', 'Error de Aqua contra S-NPP (%)', '11 %', '✓', 'Por zona', '(elegido)', '13 %', 'Único', 'límite 25 %']);
  enOrden(await textos('conafor'), ['Incendios de CONAFOR', 'Azar: mismo lugar, otro año', 'Azar: mismas fechas, a 20 km',
    'Incendios con un foco de S-NPP cerca (%)', 'a menos de 2 km, ±1 día', '53 %', '✓', '9 %', '9 %', '3 × el azar mayor = 26 %',
    'Incendios que vio S-NPP,', 'según su tamaño (%)', '0–5', '(275)', '84', '✓', 'mínimo 75 %', '> 100', '(395)',
    'Tamaño del incendio en hectáreas (cuántos hay)', 'Incendios sin rango de tamaño, no se muestran: 1']);
  enOrden(await textos('viirs'), ['umbral 0.90–1.10', 'Focos de NOAA ÷ focos de S-NPP', '(1 = cuentan lo mismo)',
    'NOAA-20 con su factor', '✓', 'NOAA-21 sin factor (informativa)', '✓', 'año completo', 'año parcial (no decide)', 'NOAA-20 sin factor']);
  // Ningún texto de las gráficas se sale de su dibujo, tampoco en el teléfono.
  for (const ancho of [1280, 390]) {
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.waitForTimeout(300);
    const fuera = await c.locator('.m-prueba-graf svg').evaluateAll((svgs) => svgs.flatMap((s) => {
      const caja = s.getBoundingClientRect(); // en pantalla: cuenta el rótulo girado del eje
      return [...s.querySelectorAll('text')].filter((t) => {
        const r = t.getBoundingClientRect();
        return r.left < caja.left - 1 || r.right > caja.right + 1 || r.top < caja.top - 1 || r.bottom > caja.bottom + 1;
      }).map((t) => t.textContent);
    }));
    expect(fuera, `${ancho}px`).toEqual([]);
  }
});

test('en inglés: el interruptor, las preguntas y las gráficas', async ({ page }) => {
  await abrir(page, '#/metodo', { query: '?lang=en' });
  await expect(page.locator('h1')).toHaveText('How we measure it');
  await expect(page.locator('.m-salto > .activo .m-salto-t')).toHaveText(EN.mSaltoCrudoTriple);
  await page.locator('#mSwitch').click();
  await expect(page.locator('.m-salto > .activo .m-salto-t')).toHaveText(EN.mSaltoCorrTriple);
  await expect(page.locator('#mFoco h2')).toHaveText('What a hot spot is');
  await expect(page.locator('#mPeriodos li').nth(3)).toContainText('since November 3, 2026');
  await expect(page.locator('#mConfiar h2')).toHaveText('Can it be trusted?');
  await expect(page.locator('.m-prueba[data-prueba="aqua_fuera_muestra"] h3')).toHaveText('Does it hold up in held-out years?');
  await abrirTodo(page);
  await expect(page.locator('.m-prueba[data-prueba="viirs"] figcaption')).toHaveText('Test 4 · NOAA-20 and NOAA-21 against S-NPP');
  await expect(page.locator('.m-prueba[data-prueba="viirs"] svg')).toContainText('NOAA-20 with its factor');
  await expect(page.locator('.m-prueba[data-prueba="salto_2012"] svg')).toContainText('Calibrated: 0.90');
  // Al cambiar de idioma, lo abierto sigue abierto.
  await page.click('[data-idioma="es"]');
  await expect(page.locator('.m-prueba[data-prueba="viirs"] svg')).toContainText('NOAA-20 con su factor');
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

test('al final, una oración lleva a buscar tu municipio', async ({ page }) => {
  await abrir(page, '#/metodo');
  const fin = page.locator('.m-fin');
  await expect(fin).toHaveText(ES.mFinAntes + ES.mFinEnlace + ES.mFinDespues);
  await fin.locator('a').click();
  await expect(page.locator('#vista')).toHaveClass(/vista-portada/);
});
