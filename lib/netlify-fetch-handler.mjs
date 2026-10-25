import adminServiceModule from './admin-service.cjs';
import { createNetlifyAdminStorage } from './netlify-admin-storage.mjs';
import siteConfig from '../config.js';

const { createAdminService } = adminServiceModule;
const defaults = siteConfig;
const MAX_REQUEST_BYTES = 6 * 1024 * 1024;

let service;

function getService() {
  if (!service) {
    service = createAdminService({ storage: createNetlifyAdminStorage(), defaults });
  }
  return service;
}

export default async function handleNetlifyRequest(request, context) {
  const url = new URL(request.url);
  let body;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_REQUEST_BYTES) return jsonResponse(413, { error: 'Solicitud demasiado grande.' });

    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody) > MAX_REQUEST_BYTES) return jsonResponse(413, { error: 'Solicitud demasiado grande.' });
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        return jsonResponse(400, { error: 'El formato de la solicitud no es válido.' });
      }
    }
  }

  try {
    const result = await getService().handle({
      method: request.method,
      pathname: url.pathname,
      search: url.search,
      headers: request.headers,
      body,
      ip: context.ip || request.headers.get('x-nf-client-connection-ip') || 'unknown',
      originUrl: url.origin
    });
    const responseBody = Buffer.isBuffer(result.body) ? new Uint8Array(result.body) : result.body;
    return new Response(responseBody, {
      status: result.status,
      headers: { ...securityHeaders, ...result.headers }
    });
  } catch {
    return jsonResponse(500, { error: 'No se pudo procesar la solicitud.' });
  }
}

function jsonResponse(status, value) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...securityHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' blob: data: https://images.unsplash.com; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'"
};