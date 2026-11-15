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

export async function onRequest(contexto) {
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
