const crypto = require('node:crypto');
const {
  cookieHeader,
  createSession,
  csrfIsValid,
  getAuthConfig,
  imageType,
  originIsAllowed,
  readCookie,
  verifyCredentials,
  verifySession
} = require('./admin-security.cjs');
const { validateProducts } = require('./products.cjs');

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

function createAdminService({ storage, defaults }) {
  return { handle: (request) => handleRequest(request, storage, defaults) };
}

async function handleRequest(request, storage, defaults) {
  const { method, pathname, search = '', headers = {}, body, ip = 'unknown', originUrl = '' } = request;
  const url = new URL(`${pathname}${search}`, originUrl || 'http://localhost');

  if (method === 'GET' && pathname === '/api/content') {
    const savedProducts = await storage.getProducts();
    return json(200, { ...defaults, products: savedProducts ?? defaults.products });
  }

  if (method === 'GET' && pathname === '/api/images') {
    const key = url.searchParams.get('key') || '';
    if (!/^[0-9a-f-]{36}\.(?:png|jpg|webp)$/i.test(key)) return json(404, { error: 'Imagen no encontrada.' });
    const image = await storage.getImage(key);
    if (!image) return json(404, { error: 'Imagen no encontrada.' });
    return {
      status: 200,
      headers: {
        'Content-Type': image.mime,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff'
      },
      body: image.buffer
    };
  }

  if (pathname !== '/api/admin') return json(404, { error: 'No encontrado.' });

  const operation = url.searchParams.get('op');
  if (operation === 'session' && method === 'GET') {
    let auth;
    try {
      auth = getAuthConfig();
    } catch {
      return json(503, { error: 'El administrador no está configurado en este entorno.' });
    }
    const session = verifySession(readCookie(headers), auth.sessionSecret);
    return json(200, session ? { authenticated: true, csrf: session.csrf } : { authenticated: false });
  }

  if (operation === 'login' && method === 'POST') {
    if (!originIsAllowed(headers, originUrl)) return json(403, { error: 'Solicitud no permitida.' });
    let auth;
    try {
      auth = getAuthConfig();
    } catch {
      return json(503, { error: 'Configura credenciales seguras en el servidor.' });
    }

    const key = crypto.createHash('sha256').update(String(ip)).digest('hex');
    const now = Date.now();
    const attempts = await storage.getLoginAttempt(key);
    if (attempts?.blockedUntil > now) {
      return json(429, { error: 'Demasiados intentos. Espera 15 minutos antes de volver a probar.' });
    }

    const valid = verifyCredentials(body?.id, body?.password, auth);
    if (!valid) {
      const recentCount = attempts?.startedAt > now - ATTEMPT_WINDOW_MS ? attempts.count : 0;
      const count = recentCount + 1;
      await storage.saveLoginAttempt(key, {
        count,
        startedAt: recentCount ? attempts.startedAt : now,
        blockedUntil: count >= MAX_LOGIN_ATTEMPTS ? now + ATTEMPT_WINDOW_MS : 0
      });
      return json(401, { error: 'ID o contraseña incorrectos.' });
    }

    await storage.clearLoginAttempt(key);
    const session = createSession(auth.username, auth.sessionSecret);
    return json(200, { authenticated: true, csrf: session.csrf }, {
      'Set-Cookie': cookieHeader(session.token, { secure: auth.production }),
      'Cache-Control': 'no-store'
    });
  }

  let auth;
  try {
    auth = getAuthConfig();
  } catch {
    return json(503, { error: 'El administrador no está configurado en este entorno.' });
  }

  const session = verifySession(readCookie(headers), auth.sessionSecret);
  if (!session) return json(401, { error: 'Inicia sesión para continuar.' });
  if (!originIsAllowed(headers, originUrl) || !csrfIsValid(headers, session)) {
    return json(403, { error: 'La sesión expiró o la solicitud no es válida. Recarga el panel.' });
  }

  if (operation === 'logout' && method === 'POST') {
    return json(200, { authenticated: false }, {
      'Set-Cookie': cookieHeader('', { secure: auth.production, clear: true }),
      'Cache-Control': 'no-store'
    });
  }

  if (operation === 'products' && method === 'PUT') {
    try {
      const products = validateProducts(body?.products);
      await storage.saveProducts(products);
      return json(200, { products });
    } catch (error) {
      return json(400, { error: error.message });
    }
  }

  if (operation === 'image' && method === 'POST') {
    const encoded = body?.data;
    if (typeof encoded !== 'string' || encoded.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 128) {
      return json(413, { error: 'La imagen supera el máximo de 4 MB.' });
    }

    const buffer = Buffer.from(encoded, 'base64');
    const detected = imageType(buffer);
    if (!detected || buffer.length > MAX_IMAGE_BYTES) {
      return json(415, { error: 'Sube una imagen PNG, JPG o WebP válida de hasta 4 MB.' });
    }

    const key = `${crypto.randomUUID()}.${detected.extension}`;
    await storage.saveImage(key, buffer, detected.mime);
    return json(201, { image: `/api/images?key=${encodeURIComponent(key)}` });
  }

  return json(405, { error: 'Método no permitido.' }, { Allow: 'GET, POST, PUT' });
}

function json(status, value, headers = {}) {
  return {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
    body: JSON.stringify(value)
  };
}

module.exports = { createAdminService };