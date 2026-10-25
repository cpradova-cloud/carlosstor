const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const siteConfig = require('./config.js');
const { createAdminService } = require('./lib/admin-service.cjs');
const { createLocalStorage } = require('./lib/local-admin-storage.cjs');

const root = __dirname;
const port = Number(process.env.PORT || 5173);
const publicFiles = new Set([
  'index.html',
  'admin.html',
  'config.js',
  'script.js',
  'live-reload.js',
  'styles.css',
  'modern.css',
  'admin.css',
  'admin.js'
]);
loadLocalEnvironment();
if (process.env.CONTEXT !== 'production' && !process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = crypto.randomBytes(48).toString('base64url');
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};
const storage = createLocalStorage(root, siteConfig);
const adminService = createAdminService({ storage, defaults: siteConfig });
const clients = new Set();
let reloadTimer;

const server = http.createServer((request, response) => {
  const host = request.headers.host || `127.0.0.1:${port}`;
  const requestUrl = new URL(request.url, `http://${host}`);
  const pathname = requestUrl.pathname;

  if (pathname.startsWith('/api/')) {
    handleApiRequest(request, response, requestUrl).catch(() => {
      sendJson(response, 500, { error: 'No se pudo procesar la solicitud.' });
    });
    return;
  }

  if (pathname === '/__live') {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    response.write('data: connected\n\n');
    clients.add(response);
    request.on('close', () => clients.delete(response));
    return;
  }

  let relativePath;
  try {
    relativePath = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  } catch {
    sendText(response, 400, 'Invalid request.');
    return;
  }
  if (relativePath === '/admin') relativePath = '/admin.html';
  const filePath = path.resolve(root, `.${relativePath}`);
  const publicFile = publicFiles.has(path.relative(root, filePath));
  const imageDirectory = path.join(root, 'images');
  const publicImage = filePath.startsWith(`${imageDirectory}${path.sep}`);
  if (!publicFile && !publicImage) {
    sendText(response, 404, 'Not found');
    return;
  }

  fsp.readFile(filePath).then((content) => {
    response.writeHead(200, {
      ...securityHeaders,
      'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    response.end(content);
  }).catch((error) => {
    if (error) {
      sendText(response, error.code === 'ENOENT' ? 404 : 500, error.code === 'ENOENT' ? 'Not found' : 'Server error');
    }
  });
});

fs.watch(root, { recursive: true }, (_event, filename) => {
  if (!filename || filename.endsWith('server.js') || filename.startsWith('.data')) return;
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    for (const client of clients) client.write('data: reload\n\n');
  }, 150);
});

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' blob: data: https://images.unsplash.com; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
};

async function handleApiRequest(request, response, requestUrl) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 6 * 1024 * 1024) {
      sendJson(response, 413, { error: 'Solicitud demasiado grande.' });
      return;
    }
    chunks.push(chunk);
  }

  let body;
  if (size > 0) {
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      sendJson(response, 400, { error: 'El formato de la solicitud no es válido.' });
      return;
    }
  }

  const result = await adminService.handle({
    method: request.method,
    pathname: requestUrl.pathname,
    search: requestUrl.search,
    headers: request.headers,
    body,
    ip: request.socket.remoteAddress,
    originUrl: requestUrl.origin
  });
  response.writeHead(result.status, { ...securityHeaders, ...result.headers });
  response.end(result.body);
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    ...securityHeaders,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(value));
}

function sendText(response, status, value) {
  response.writeHead(status, { ...securityHeaders, 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(value);
}

function loadLocalEnvironment() {
  if (process.env.CONTEXT === 'production') return;
  try {
    const envFile = fs.readFileSync(path.join(root, '.env'), 'utf8');
    for (const line of envFile.split(/\r?\n/)) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

server.listen(port, '127.0.0.1', () => {
  console.log(`carlosstor disponible en http://localhost:${port}`);
  console.log(`Panel de administración: http://localhost:${port}/admin.html`);
  console.log('Guarda un archivo para actualizar la vista previa automáticamente.');
});
