const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const port = Number(process.env.PORT || 5173);
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};
const clients = new Set();
let reloadTimer;

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

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

  const relativePath = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  const filePath = path.resolve(root, `.${relativePath}`);
  if (!filePath.startsWith(`${root}${path.sep}`) && filePath !== path.join(root, 'index.html')) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500);
      response.end(error.code === 'ENOENT' ? 'Not found' : 'Server error');
      return;
    }
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
    response.end(content);
  });
});

fs.watch(root, { recursive: true }, (_event, filename) => {
  if (!filename || filename.endsWith('server.js')) return;
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    for (const client of clients) client.write('data: reload\n\n');
  }, 150);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`carlos.store disponible en http://localhost:${port}`);
  console.log('Guarda un archivo para actualizar la vista previa automáticamente.');
});
