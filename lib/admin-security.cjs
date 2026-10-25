const crypto = require('node:crypto');

const COOKIE_NAME = 'carlos_admin';
const SESSION_SECONDS = 8 * 60 * 60;

function safeEqual(left, right) {
  const leftHash = crypto.createHash('sha256').update(String(left)).digest();
  const rightHash = crypto.createHash('sha256').update(String(right)).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function getAuthConfig() {
  const production = process.env.CONTEXT === 'production';
  const username = process.env.ADMIN_ID || '';
  const password = process.env.ADMIN_PASSWORD || '';
  const sessionSecret = process.env.SESSION_SECRET || '';

  if (!username || !password || !sessionSecret) {
    throw new Error('Configura ADMIN_ID, ADMIN_PASSWORD y SESSION_SECRET.');
  }

  if (production && (password.length < 14 || Buffer.byteLength(sessionSecret) < 32)) {
    throw new Error('La contraseña de producción debe tener 14 caracteres y SESSION_SECRET al menos 32 bytes.');
  }

  return { username, password, sessionSecret, production };
}

function verifyCredentials(username, password, auth) {
  const pepper = Buffer.from(auth.sessionSecret);
  const expectedPassword = crypto.scryptSync(auth.password, pepper, 32);
  const receivedPassword = crypto.scryptSync(String(password || ''), pepper, 32);
  return safeEqual(username || '', auth.username) && crypto.timingSafeEqual(expectedPassword, receivedPassword);
}

function createSession(username, sessionSecret) {
  const csrf = crypto.randomBytes(32).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: username,
    csrf,
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  return { token: `${payload}.${signature}`, csrf };
}

function readCookie(headers) {
  const cookieHeader = getHeader(headers, 'cookie') || '';
  const cookie = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  return cookie ? decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1)) : '';
}

function verifySession(token, sessionSecret) {
  if (!token || !sessionSecret) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;

  const expected = crypto.createHmac('sha256', sessionSecret).update(payload).digest();
  let received;
  try {
    received = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (received.length !== expected.length || !crypto.timingSafeEqual(expected, received)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof session.sub !== 'string' || typeof session.csrf !== 'string' || session.exp <= Date.now() / 1000) return null;
    return session;
  } catch {
    return null;
  }
}

function getHeader(headers, name) {
  if (typeof headers?.get === 'function') return headers.get(name);
  const value = headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function originIsAllowed(headers, requestUrl) {
  const origin = getHeader(headers, 'origin');
  const fetchSite = getHeader(headers, 'sec-fetch-site');
  if (!origin || fetchSite === 'cross-site') return false;
  try {
    return new URL(origin).origin === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}

function csrfIsValid(headers, session) {
  return Boolean(session && safeEqual(getHeader(headers, 'x-csrf-token') || '', session.csrf));
}

function cookieHeader(token, { secure = false, clear = false } = {}) {
  const value = clear ? `${COOKIE_NAME}=` : `${COOKIE_NAME}=${encodeURIComponent(token)}`;
  return `${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : SESSION_SECONDS}${secure ? '; Secure' : ''}`;
}

function imageType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { extension: 'png', mime: 'image/png' };
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { extension: 'jpg', mime: 'image/jpeg' };
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return { extension: 'webp', mime: 'image/webp' };
  return null;
}

module.exports = {
  COOKIE_NAME,
  SESSION_SECONDS,
  cookieHeader,
  createSession,
  csrfIsValid,
  getAuthConfig,
  getHeader,
  imageType,
  originIsAllowed,
  readCookie,
  safeEqual,
  verifyCredentials,
  verifySession
};