// Vista previa de los enlaces (WhatsApp, Facebook, X): los robots que arman la vista previa no
// ejecutan JavaScript, así que el título, la descripción y la imagen de cada dirección se ponen
// aquí, en el HTML que entrega Cloudflare Pages. kaak.pages.dev/tekax lleva la tarjeta de Tekax;
// las demás direcciones, la de la página. Las tarjetas y sus textos los escribe pipeline/tarjetas.mjs
// en web/og/. Si algo falla, la página sale tal cual, con la tarjeta general de index.html.
//
// También pone el contador de visitas de Cloudflare Web Analytics (sin cookies; da páginas, país,
// de dónde llega la visita y tipo de dispositivo). Solo en la dirección pública, para que las
// vistas previas de las ramas no cuenten como visitas. Para apagarlo, deja ANALITICA_TOKEN vacío.
const ANALITICA_TOKEN = '762264fd80424b94a8c651fbbf592dbc';
const ANALITICA_HOST = 'kaak.pages.dev';

// Aviso de visitas desde Space Apps: el enlace de la entrega es kaak.pages.dev/?de=spaceapps.
// Cada vez que alguien abre esa dirección se anota la hora, la ciudad, la red y el navegador en el
// almacén KAAK_VISITAS (se borra solo a los 30 días). /__visitas devuelve esas anotaciones solo a
// quien manda la clave en el encabezado X-Clave; aquí solo está su huella SHA-256.
const VISITAS_ETIQUETA = 'spaceapps';
const VISITAS_HUELLA = '4533717e87c2cfaa68e5b46b8d42e11737f204a922e1ab9b290cebacf2da5b17';
const VISITAS_DIAS = 30;
let textos = null;

async function leerTextos(env, url) {
  if (!textos) {
    const r = await env.ASSETS.fetch(new URL('/og/textos.json', url));
    if (!r.ok) throw new Error('og/textos.json: ' + r.status);
    textos = await r.json();
  }
  return textos;
}

class Contenido {
  constructor(valor) { this.valor = valor; }
  element(e) { e.setAttribute('content', this.valor); }
}

class Titulo {
  constructor(valor) { this.valor = valor; }
  element(e) { e.setInnerContent(this.valor); }
}

class Analitica {
  constructor(token) { this.token = token; }
  element(e) {
    e.append(`<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${this.token}"}'></script>`, { html: true });
  }
}

async function huella(texto) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function anotarVisita(env, request) {
  const cf = request.cf || {};
  const datos = {
    hora: new Date().toISOString(),
    ciudad: cf.city || '', region: cf.region || '', pais: cf.country || '',
    red: cf.asOrganization || '',
    navegador: (request.headers.get('user-agent') || '').slice(0, 300),
    idioma: (request.headers.get('accept-language') || '').slice(0, 60),
  };
  const llave = 'v:' + datos.hora + ':' + crypto.randomUUID().slice(0, 8);
  await env.KAAK_VISITAS.put(llave, '1', { metadata: datos, expirationTtl: VISITAS_DIAS * 86400 });
}

async function leerVisitas(env, request) {
  const clave = request.headers.get('x-clave') || '';
  if (!clave || !env.KAAK_VISITAS || (await huella(clave)) !== VISITAS_HUELLA) {
    return new Response('No encontrado', { status: 404 });
  }
  const visitas = [];
  let cursor;
  do {
    const r = await env.KAAK_VISITAS.list({ prefix: 'v:', cursor });
    for (const k of r.keys) visitas.push({ id: k.name, ...k.metadata });
    cursor = r.list_complete ? null : r.cursor;
  } while (cursor);
  return Response.json(visitas, { headers: { 'cache-control': 'no-store' } });
}

export async function onRequest(contexto) {
  const { request: pedido, env: entorno } = contexto;
  const dir = new URL(pedido.url);
  if (dir.pathname === '/__visitas') return leerVisitas(entorno, pedido);
  if (pedido.method === 'GET' && dir.hostname === ANALITICA_HOST && entorno.KAAK_VISITAS &&
      dir.searchParams.get('de') === VISITAS_ETIQUETA) {
    contexto.waitUntil(anotarVisita(entorno, pedido).catch(() => {}));
  }
  const respuesta = await contexto.next();
  try {
    const { request, env } = contexto;
    if (request.method !== 'GET' || respuesta.status !== 200) return respuesta;
    if (!(respuesta.headers.get('content-type') || '').includes('text/html')) return respuesta;
    const url = new URL(request.url);
    const T = await leerTextos(env, url);
    const corto = url.pathname.match(/^\/([a-z0-9-]+)\/?$/);
    const id = corto && T.municipios[corto[1]] ? corto[1] : null;
    const tarjeta = id ? T.municipios[id] : T.inicio;
    const imagen = url.origin + (id ? '/og/' + id + '.png' : '/og/inicio.jpg');
    const direccion = url.origin + (id ? '/' + id : '/');
    let reescribir = new HTMLRewriter()
      .on('meta[property="og:image"]', new Contenido(imagen))
      .on('meta[name="twitter:image"]', new Contenido(imagen))
      .on('meta[property="og:url"]', new Contenido(direccion));
    if (ANALITICA_TOKEN && url.hostname === ANALITICA_HOST) {
      reescribir = reescribir.on('head', new Analitica(ANALITICA_TOKEN));
    }
    if (id) {
      reescribir = reescribir
        .on('title', new Titulo(tarjeta.titulo + " · K'áak'"))
        .on('meta[name="description"]', new Contenido(tarjeta.descripcion))
        .on('meta[property="og:title"]', new Contenido(tarjeta.titulo))
        .on('meta[property="og:description"]', new Contenido(tarjeta.descripcion))
        .on('meta[property="og:image:alt"]', new Contenido(tarjeta.titulo));
    }
    return reescribir.transform(respuesta);
  } catch {
    return respuesta;
  }
}
