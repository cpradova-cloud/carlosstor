const test = require('node:test');
const assert = require('node:assert/strict');
const { createAdminService } = require('../lib/admin-service.cjs');
const { validateProducts } = require('../lib/products.cjs');
const { cookieHeader, getAuthConfig } = require('../lib/admin-security.cjs');

process.env.ADMIN_ID = 'carlos';
process.env.ADMIN_PASSWORD = '12345';
process.env.SESSION_SECRET = 'test-only-random-session-secret';

const defaults = {
  brand: 'carlosstor',
  hero: {
    image: 'https://images.example.com/hero.jpg',
    featuredKicker: 'Selección de la semana',
    featuredName: 'Tu próximo aroma favorito'
  },
  products: [{
    name: 'Perfume original',
    category: 'Floral',
    gender: 'Unisex',
    label: 'Nuevo',
    price: 120,
    stock: 5,
    description: 'Descripción original.',
    image: 'https://images.example.com/perfume.jpg'
  }]
};

function createFixture() {
  const state = { products: null, carousel: null, hero: null, ratings: [], attempts: new Map(), images: new Map() };
  const storage = {
    async getProducts() { return state.products; },
    async saveProducts(products) { state.products = products; },
    async getCarousel() { return state.carousel; },
    async saveCarousel(carousel) { state.carousel = carousel; },
    async getHero() { return state.hero; },
    async saveHero(hero) { state.hero = hero; },
    async getRatings() { return state.ratings; },
    async saveRatings(ratings) { state.ratings = ratings; },
    async getLoginAttempt(key) { return state.attempts.get(key) || null; },
    async saveLoginAttempt(key, attempt) { state.attempts.set(key, attempt); },
    async clearLoginAttempt(key) { state.attempts.delete(key); },
    async saveImage(key, buffer, mime) { state.images.set(key, { buffer, mime }); },
    async getImage(key) { return state.images.get(key) || null; }
  };
  const service = createAdminService({ storage, defaults });
  const request = (method, path, { body, headers = {}, ip = '127.0.0.1' } = {}) => {
    const url = new URL(path, 'http://localhost');
    return service.handle({
      method,
      pathname: url.pathname,
      search: url.search,
      headers,
      body,
      ip,
      originUrl: 'http://localhost'
    });
  };
  return { request, state };
}

test('public content uses defaults until an administrator saves edits', async () => {
  const { request } = createFixture();
  const response = await request('GET', '/api/content');
  const data = JSON.parse(response.body);
  assert.equal(response.status, 200);
  assert.deepEqual(data.products, defaults.products);
  assert.equal(data.brand, 'carlosstor');
});

test('legacy saved products receive a compatible default gender', async () => {
  const { request, state } = createFixture();
  state.products = [{ ...defaults.products[0], gender: undefined }];
  const response = await request('GET', '/api/content');
  assert.equal(JSON.parse(response.body).products[0].gender, 'Unisex');
  assert.equal(state.products[0].gender, undefined);
});

test('product specifications accept optional content and ordered concentration', () => {
  const products = validateProducts([{
    ...defaults.products[0],
    ml: '100 ml',
    concentracion: 'EDP'
  }]);
  assert.equal(products[0].ml, '100 ml');
  assert.equal(products[0].concentracion, 'EDP');
  assert.equal(validateProducts([{ ...defaults.products[0] }])[0].ml, undefined);
  assert.throws(
    () => validateProducts([{ ...defaults.products[0], concentracion: 'Cologne' }]),
    /concentración/
  );
});

test('public ratings validate scores and return rounded summaries', async () => {
  const { request } = createFixture();
  const empty = await request('GET', '/api/rating');
  assert.deepEqual(JSON.parse(empty.body), { average: null, total: 0 });
  assert.equal((await request('POST', '/api/rating', { body: { score: 6 } })).status, 400);
  await request('POST', '/api/rating', { body: { score: 5 } });
  const result = await request('POST', '/api/rating', { body: { score: 4 } });
  assert.deepEqual(JSON.parse(result.body), { average: 4.5, total: 2 });
  assert.equal(JSON.parse((await request('GET', '/api/rating')).body).total, 2);
});

test('invalid credentials are rejected and rate-limited', async () => {
  const { request } = createFixture();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await request('POST', '/api/admin?op=login', {
      body: { id: 'carlos', password: 'incorrecta' },
      headers: { origin: 'http://localhost' }
    });
    assert.equal(response.status, 401);
  }
  const blocked = await request('POST', '/api/admin?op=login', {
    body: { id: 'carlos', password: '12345' },
    headers: { origin: 'http://localhost' }
  });
  assert.equal(blocked.status, 429);
});

test('login, CSRF protection, and product updates work together', async () => {
  process.env.ADMIN_ID = 'carlos';
  process.env.ADMIN_PASSWORD = '12345';
  process.env.SESSION_SECRET = 'test-only-random-session-secret';
  const { request } = createFixture();

  const unauthorized = await request('PUT', '/api/admin?op=products', {
    body: { products: [] },
    headers: { origin: 'http://localhost' }
  });
  assert.equal(unauthorized.status, 401);

  const badOrigin = await request('POST', '/api/admin?op=login', {
    body: { id: 'carlos', password: '12345' },
    headers: { origin: 'https://attacker.example' }
  });
  assert.equal(badOrigin.status, 403);

  const login = await request('POST', '/api/admin?op=login', {
    body: { id: 'carlos', password: '12345' },
    headers: { origin: 'http://localhost' }
  });
  assert.equal(login.status, 200);
  const loginData = JSON.parse(login.body);
  const cookie = login.headers['Set-Cookie'].split(';')[0];

  const noCsrf = await request('PUT', '/api/admin?op=products', {
    body: { products: defaults.products },
    headers: { origin: 'http://localhost', cookie }
  });
  assert.equal(noCsrf.status, 403);

  const updatedProducts = [{ ...defaults.products[0], name: 'Perfume actualizado', price: 145, stock: 2, gender: 'Mujer' }];
  const update = await request('PUT', '/api/admin?op=products', {
    body: { products: updatedProducts },
    headers: { origin: 'http://localhost', cookie, 'x-csrf-token': loginData.csrf }
  });
  assert.equal(update.status, 200);
  assert.deepEqual(JSON.parse(update.body).products, updatedProducts);

  const invalidStock = await request('PUT', '/api/admin?op=products', {
    body: { products: [{ ...updatedProducts[0], stock: 1.5 }] },
    headers: { origin: 'http://localhost', cookie, 'x-csrf-token': loginData.csrf }
  });
  assert.equal(invalidStock.status, 400);

  const invalidGender = await request('PUT', '/api/admin?op=products', {
    body: { products: [{ ...updatedProducts[0], gender: 'Otro' }] },
    headers: { origin: 'http://localhost', cookie, 'x-csrf-token': loginData.csrf }
  });
  assert.equal(invalidGender.status, 400);

  const publicContent = await request('GET', '/api/content');
  assert.equal(JSON.parse(publicContent.body).products[0].name, 'Perfume actualizado');
});

test('image uploads require a recognized image signature', async () => {
  process.env.ADMIN_ID = 'carlos';
  process.env.ADMIN_PASSWORD = '12345';
  process.env.SESSION_SECRET = 'test-only-random-session-secret';
  const { request, state } = createFixture();
  const login = await request('POST', '/api/admin?op=login', {
    body: { id: 'carlos', password: '12345' },
    headers: { origin: 'http://localhost' }
  });

  const cookie = login.headers['Set-Cookie'].split(';')[0];
  const csrf = JSON.parse(login.body).csrf;

  const rejected = await request('POST', '/api/admin?op=image', {
    body: { data: Buffer.from('not an image').toString('base64') },
    headers: { origin: 'http://localhost', cookie, 'x-csrf-token': csrf }
  });
  assert.equal(rejected.status, 415);

  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const uploaded = await request('POST', '/api/admin?op=image', {
    body: { data: png.toString('base64') },
    headers: { origin: 'http://localhost', cookie, 'x-csrf-token': csrf }
  });
  assert.equal(uploaded.status, 201);
  assert.match(JSON.parse(uploaded.body).image, /^\/api\/images\?key=.*\.png$/);
  assert.equal(state.images.size, 1);
});

test('carousel updates persist uploaded image references', async () => {
  const { request } = createFixture();
  const login = await request('POST', '/api/admin?op=login', {
    body: { id: 'carlos', password: '12345' },
    headers: { origin: 'http://localhost' }
  });
  const cookie = login.headers['Set-Cookie'].split(';')[0];
  const csrf = JSON.parse(login.body).csrf;
  const carousel = [{
    image: '/api/images?key=123e4567-e89b-12d3-a456-426614174000.png',
    alt: 'Logo Hugo Boss'
  }];
  const update = await request('PUT', '/api/admin?op=carousel', {
    body: { carousel },
    headers: { origin: 'http://localhost', cookie, 'x-csrf-token': csrf }
  });
  assert.equal(update.status, 200);
  const content = await request('GET', '/api/content');
  assert.deepEqual(JSON.parse(content.body).editorial.carousel, carousel);
});

test('hero image and seasonal text updates persist', async () => {
  const { request } = createFixture();
  const login = await request('POST', '/api/admin?op=login', {
    body: { id: 'carlos', password: '12345' },
    headers: { origin: 'http://localhost' }
  });
  const cookie = login.headers['Set-Cookie'].split(';')[0];
  const csrf = JSON.parse(login.body).csrf;
  const hero = {
    image: '/api/images?key=123e4567-e89b-12d3-a456-426614174000.png',
    featuredKicker: 'Especial Navidad',
    featuredName: 'Regala una fragancia inolvidable'
  };
  const update = await request('PUT', '/api/admin?op=hero', {
    body: { hero },
    headers: { origin: 'http://localhost', cookie, 'x-csrf-token': csrf }
  });
  assert.equal(update.status, 200);
  const content = await request('GET', '/api/content');
  assert.deepEqual(JSON.parse(content.body).hero, { ...defaults.hero, ...hero });
});

test('production rejects the temporary weak password', () => {
  const previousContext = process.env.CONTEXT;
  process.env.CONTEXT = 'production';
  try {
    assert.throws(() => getAuthConfig(), /14 caracteres/);
  } finally {
    if (previousContext === undefined) delete process.env.CONTEXT;
    else process.env.CONTEXT = previousContext;
  }
});

test('logout cookie expires the actual admin session cookie', () => {
  const cookie = cookieHeader('', { secure: true, clear: true });
  assert.match(cookie, /^carlos_admin=;/);
  assert.match(cookie, /Max-Age=0/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
});