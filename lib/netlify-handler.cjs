const { createAdminService } = require('./admin-service.cjs');
const storage = require('./netlify-admin-storage.cjs');
const defaults = require('../config.js');

const service = createAdminService({ storage, defaults });

function createNetlifyHandler(pathname) {
  return async (event) => {
    const headers = event.headers || {};
    const host = headers['x-forwarded-host'] || headers.host || headers.Host || '';
    const protocol = headers['x-forwarded-proto'] || 'https';
    const originUrl = host ? `${protocol}://${host}` : '';
    const query = new URLSearchParams(event.queryStringParameters || {}).toString();
    let body;

    if (event.body) {
      try {
        const rawBody = event.isBase64Encoded
          ? Buffer.from(event.body, 'base64').toString('utf8')
          : event.body;
        body = JSON.parse(rawBody);
      } catch {
        return response(400, { error: 'El formato de la solicitud no es válido.' });
      }
    }

    try {
      const result = await service.handle({
        method: event.httpMethod,
        pathname,
        search: query ? `?${query}` : '',
        headers,
        body,
        ip: headers['x-nf-client-connection-ip'] || headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown',
        originUrl
      });

      const binary = Buffer.isBuffer(result.body);
      return {
        statusCode: result.status,
        headers: { ...result.headers, ...securityHeaders },
        body: binary ? result.body.toString('base64') : result.body,
        isBase64Encoded: binary
      };
    } catch {
      return response(500, { error: 'No se pudo procesar la solicitud.' });
    }
  };
}

function response(statusCode, value) {
  return {
    statusCode,
    headers: { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify(value)
  };
}

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' blob: data: https://images.unsplash.com; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
};

module.exports = { createNetlifyHandler };