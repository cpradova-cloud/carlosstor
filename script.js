document.addEventListener('DOMContentLoaded', async () => {
  let config = window.siteConfig;
  try {
    const response = await fetch('/api/content', { cache: 'no-store' });
    if (response.ok) config = await response.json();
  } catch {
    // The bundled config remains available if the content API is unavailable.
  }
  if (!config) return;

  applyTheme(config.theme);
  renderText(config);
  renderCategories(config.products, config.catalog.allLabel);
  renderProducts(config.products);
  renderPayments(config.payments);
  renderSocials(config.socials);
  renderFooter(config);
  setupSearch(config.products);
  setupKeyboardSearch();
  setupAdminRoute();
});

function applyTheme(theme = {}) {
  const root = document.documentElement;
  const allowed = { paper: '--paper', ink: '--ink', muted: '--muted', green: '--green', lime: '--lime', coral: '--coral' };
  Object.entries(allowed).forEach(([key, variable]) => {
    if (theme[key]) root.style.setProperty(variable, theme[key]);
  });
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value ?? '';
}

function setImage(id, src, alt) {
  const node = document.getElementById(id);
  if (node) {
    node.src = src || '';
    node.alt = alt || '';
  }
}

function setVideo(id, src, poster, alt) {
  const video = document.getElementById(id);
  if (!video) return;
  if (src) {
    video.src = src;
    video.poster = poster || '';
    video.alt = alt || '';
    video.hidden = false;
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    video.autoplay = true;
    video.play().catch(() => {});
    const image = document.getElementById('editorial-image');
    if (image) image.hidden = true;
  } else {
    video.pause();
    video.removeAttribute('src');
    video.hidden = true;
    const image = document.getElementById('editorial-image');
    if (image) {
      image.hidden = false;
      image.src = poster || '';
      image.alt = alt || '';
    }
  }
}

function renderText(config) {
  document.title = `${config.brand} | Perfumería`;
  setText('announcement', config.announcement);
  setText('brand-name', config.brand);
  setText('footer-brand', config.brand);
  setText('hero-eyebrow', config.hero.eyebrow);
  setText('hero-title', config.hero.title);
  setText('hero-description', config.hero.description);
  setText('hero-button', config.hero.button);
  setText('hero-note', config.hero.note);
  setText('hero-side-label', config.hero.sideLabel);
  setText('featured-kicker', config.hero.featuredKicker);
  setText('featured-name', config.hero.featuredName);
  setImage('hero-image', config.hero.image, config.hero.featuredName);
  setText('benefit-one', config.benefits[0]);
  setText('benefit-two', config.benefits[1]);
  setText('benefit-three', config.benefits[2]);
  setText('catalog-eyebrow', config.catalog.eyebrow);
  setText('catalog-title', config.catalog.title);
  setText('editorial-eyebrow', config.editorial.eyebrow);
  setText('editorial-title', config.editorial.title);
  setText('editorial-description', config.editorial.description);
  setText('editorial-link-label', config.editorial.linkLabel);
  setImage('editorial-image', config.editorial.image, config.editorial.title);
  setVideo('editorial-video', config.editorial.video, config.editorial.image, config.editorial.title);
  setText('payment-eyebrow', config.payments.eyebrow);
  setText('payment-title', config.payments.title);
  setText('payment-description', config.payments.description);
  setText('payment-footnote', config.payments.footnote);
  setText('social-eyebrow', config.socials.eyebrow);
  setText('social-title', config.socials.title);
}

function renderCategories(products, allLabel) {
  const container = document.getElementById('category-list');
  const categories = [...new Set(products.map((product) => product.category))];
  [allLabel, ...categories].forEach((category, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `category-button${index === 0 ? ' active' : ''}`;
    button.textContent = category;
    button.dataset.category = category;
    button.addEventListener('click', () => {
      container.querySelector('.active')?.classList.remove('active');
      button.classList.add('active');
      filterProducts(products, document.getElementById('product-search').value, category, allLabel);
    });
    container.append(button);
  });
}

function renderProducts(products) {
  const grid = document.getElementById('product-grid');
  grid.replaceChildren();
  products.forEach((product) => {
    const article = document.createElement('article');
    article.className = 'product-card';
    article.dataset.name = `${product.name} ${product.category} ${product.description}`.toLocaleLowerCase('es');
    article.dataset.category = product.category;

    const photo = document.createElement('div');
    photo.className = 'product-photo';
    const image = document.createElement('img');
    image.src = product.image;
    image.alt = product.name;
    image.loading = 'lazy';
    photo.append(image);

    const badge = document.createElement('span');
    badge.className = 'product-label';
    badge.textContent = product.label || product.category;
    photo.append(badge);

    const info = document.createElement('div');
    info.className = 'product-info';
    const topline = document.createElement('div');
    topline.className = 'product-topline';
    const name = document.createElement('h3');
    name.className = 'product-name';
    name.textContent = product.name;
    const price = document.createElement('span');
    price.className = 'product-price';
    price.textContent = formatPrice(product.price);
    topline.append(name, price);

    const description = document.createElement('p');
    description.className = 'product-description';
    description.textContent = product.description;

    const buy = document.createElement('a');
    buy.className = 'product-buy';
    buy.href = '#';
    buy.setAttribute('aria-label', `Consultar ${product.name} por WhatsApp`);
    buy.innerHTML = '<span class="product-buy-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M20.2 11.8a8.2 8.2 0 0 1-12.2 7.1L4 20l1.1-3.9a8.2 8.2 0 1 1 15.1-4.3Z"/><path d="M8.9 8.3c.2-.5.5-.6.8-.6h.5c.2 0 .4.1.5.4l.7 1.6c.1.2.1.4-.1.6l-.5.6c-.2.2-.2.4 0 .6.5.9 1.3 1.6 2.2 2 .2.1.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.5.7c.2.1.4.3.4.5 0 .4-.2 1-.6 1.3-.4.4-1 .6-1.6.5-1-.1-2.4-.7-3.8-2-1.2-1.1-2-2.5-2.2-3.5-.1-.7.1-1.3.4-1.7Z"/></svg></span><span class="product-buy-divider" aria-hidden="true"></span><span class="product-buy-label">Consultar por WhatsApp</span><span class="product-buy-arrow" aria-hidden="true">→</span>';
    buy.addEventListener('click', (event) => {
      event.preventDefault();
      openWhatsApp(product);
    });
    info.append(topline, description, buy);
    article.append(photo, info);
    grid.append(article);
  });
}

function formatPrice(price) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(price);
}

function filterProducts(products, query, category, allLabel) {
  const normalizedQuery = query.trim().toLocaleLowerCase('es');
  let visible = 0;
  document.querySelectorAll('.product-card').forEach((card, index) => {
    const matchesCategory = category === allLabel || card.dataset.category === category;
    const matchesQuery = card.dataset.name.includes(normalizedQuery);
    card.hidden = !(matchesCategory && matchesQuery);
    if (!card.hidden) visible += 1;
  });
  document.getElementById('empty-state').hidden = visible > 0;
}

function setupSearch(products) {
  const input = document.getElementById('product-search');
  input.addEventListener('input', () => {
    const activeCategory = document.querySelector('.category-button.active')?.dataset.category;
    filterProducts(products, input.value, activeCategory, window.siteConfig.catalog.allLabel);
  });
}

function setupKeyboardSearch() {
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      event.preventDefault();
      document.getElementById('product-search').focus();
    }
  });
}

function setupAdminRoute() {
  const overlay = document.getElementById('admin-overlay');
  const frame = document.getElementById('admin-frame');

  const updateRoute = () => {
    const isAdmin = window.location.hash === '#admin';
    overlay.hidden = !isAdmin;
    document.body.classList.toggle('admin-open', isAdmin);
    if (isAdmin && frame.dataset.loaded !== 'true') {
      frame.src = '/admin.html';
      frame.dataset.loaded = 'true';
    }
    document.title = isAdmin
      ? `${window.siteConfig.brand} | Administración`
      : `${window.siteConfig.brand} | Perfumería`;
  };

  window.addEventListener('hashchange', updateRoute);
  updateRoute();
}

function renderPayments(payments) {
  const list = document.getElementById('payment-list');
  payments.methods.forEach((method) => {
    const row = document.createElement('div');
    row.className = 'payment-method';
    const number = document.createElement('span');
    number.className = 'payment-number';
    number.textContent = method.number;
    const name = document.createElement('span');
    name.className = 'payment-name';
    name.textContent = method.name;
    const detail = document.createElement('span');
    detail.className = 'payment-detail';
    detail.textContent = method.detail;
    row.append(number, name, detail);
    list.append(row);
  });
}

function renderSocials(socials) {
  const links = document.getElementById('social-links');
  [['Instagram', socials.instagram], ['TikTok', socials.tiktok]].forEach(([platform, item]) => {
    const link = document.createElement('a');
    link.className = 'social-link';
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = `${platform} ${item.handle} ↗`;
    links.append(link);
  });
}

function renderFooter(config) {
  setText('footer-copy', config.footer.replace('{year}', new Date().getFullYear()));
}

function openWhatsApp(product) {
  const number = window.siteConfig.contact.whatsappNumber.replace(/\D/g, '');
  if (!number) {
    showToast('Agrega tu número de WhatsApp en config.js para activar las consultas.');
    return;
  }
  const message = `${window.siteConfig.contact.whatsappMessage} ${product.name} (${formatPrice(product.price)})`;
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove('visible'), 3500);
}
