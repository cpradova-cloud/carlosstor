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
  renderFilters(config.products, config.catalog.allLabel);
  renderProducts(config.products);
  setupImageLightbox();
  renderPayments(config.payments);
  renderSocials(config.socials);
  renderFooter(config);
  setupEditorialCarousel(config.editorial?.carousel || []);
  setupSearch(config.products, config.catalog.allLabel);
  setupKeyboardSearch();
  setupAdminRoute();
  setupTermsModal();
  setupRating();
});

async function setupRating() {
  const widget = document.getElementById('rating-widget');
  const close = document.getElementById('rating-widget-close');
  const stars = document.getElementById('rating-stars');
  const status = document.getElementById('rating-widget-status');
  if (!widget || !close || !stars || !status) return;
  const storageKey = 'carlosstor-rating-state';
  const getState = () => {
    try { return localStorage.getItem(storageKey); } catch { return null; }
  };
  const setState = (value) => {
    try { localStorage.setItem(storageKey, value); } catch {}
  };
  const hide = () => { widget.hidden = true; };
  const show = () => { widget.hidden = false; };
  if (!getState()) window.setTimeout(show, 150000);
  close.addEventListener('click', () => {
    setState('dismissed');
    hide();
  });
  for (let score = 1; score <= 5; score += 1) {
    const star = document.createElement('button');
    star.type = 'button';
    star.className = 'rating-star';
    star.textContent = '★';
    star.dataset.score = String(score);
    star.setAttribute('aria-label', `${score} de 5 estrellas`);
    star.addEventListener('mouseenter', () => {
      stars.querySelectorAll('.rating-star').forEach((item) => item.classList.toggle('is-hovered', Number(item.dataset.score) <= score));
    });
    star.addEventListener('mouseleave', () => {
      stars.querySelectorAll('.rating-star').forEach((item) => item.classList.remove('is-hovered'));
    });
    star.addEventListener('click', async () => {
      stars.querySelectorAll('.rating-star').forEach((item) => { item.disabled = true; });
      try {
        const response = await fetch('/api/rating', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ score })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'No se pudo guardar la calificación.');
        setState('voted');
        status.textContent = '¡Gracias por tu calificación!';
        renderPublicRating(result);
        window.setTimeout(hide, 2500);
      } catch (error) {
        stars.querySelectorAll('.rating-star').forEach((item) => { item.disabled = false; });
        status.textContent = error.message;
      }
    });
    stars.append(star);
  }
  try {
    const response = await fetch('/api/rating', { cache: 'no-store' });
    if (response.ok) renderPublicRating(await response.json());
  } catch {
    // The rating widget remains available if the summary endpoint is unavailable.
  }
}

function renderPublicRating(rating) {
  const target = document.getElementById('public-rating');
  if (!target || !rating?.total) return;
  target.replaceChildren(
    createRatingStars(rating.average),
    ` ${rating.average.toFixed(1)}`
  );
  target.hidden = false;
}

function createRatingStars(average) {
  const stars = document.createElement('span');
  stars.className = 'rating-badge-stars';
  stars.setAttribute('aria-label', `${average.toFixed(1)} de 5`);
  const starPath = 'M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.47L12 17.32l-5.8 3.05 1.11-6.47-4.7-4.58 6.49-.94L12 2.5z';
  for (let index = 0; index < 5; index += 1) {
    const fillPercent = Math.max(0, Math.min(100, (average - index) * 100));
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const clipId = `public-rating-star-${index}-${Math.random().toString(36).slice(2)}`;
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'rating-star-svg');
    svg.setAttribute('aria-hidden', 'true');
    const outline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    outline.setAttribute('d', starPath);
    outline.setAttribute('class', 'rating-star-outline');
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    clip.setAttribute('id', clipId);
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', String(24 * fillPercent / 100));
    rect.setAttribute('height', '24');
    clip.append(rect);
    defs.append(clip);
    const fill = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    fill.setAttribute('d', starPath);
    fill.setAttribute('class', 'rating-star-fill');
    fill.setAttribute('clip-path', `url(#${clipId})`);
    svg.append(defs, outline, fill);
    stars.append(svg);
  }
  return stars;
}

function applyTheme(theme = {}) {
  const root = document.documentElement;
  const allowed = { paper: '--paper', ink: '--ink', muted: '--muted', green: '--green', lime: '--lime', coral: '--coral' };
  Object.entries(allowed).forEach(([key, variable]) => {
    if (theme[key]) root.style.setProperty(variable, theme[key]);
  });
}

function setupTermsModal() {
  setupLegalModal('faq-modal', 'faq-open', 'faq-close', '[data-faq-close]');
  setupLegalModal('terms-modal', 'terms-open', 'terms-close', '[data-terms-close]');
  setupLegalModal('privacy-modal', 'privacy-open', 'privacy-close', '[data-privacy-close]');
}

function setupLegalModal(modalId, openId, closeId, backdropSelector) {
  const modal = document.getElementById(modalId);
  const open = document.getElementById(openId);
  const close = document.getElementById(closeId);
  const backdrop = modal?.querySelector(backdropSelector);
  if (!modal || !open || !close || !backdrop) return;
  const setOpen = (isOpen) => {
    modal.hidden = !isOpen;
    document.body.classList.toggle('modal-open', isOpen);
    if (isOpen) close.focus();
    else open.focus();
  };
  open.addEventListener('click', () => setOpen(true));
  close.addEventListener('click', () => setOpen(false));
  backdrop.addEventListener('click', () => setOpen(false));
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });
}

function setZoomOrigin(target, origin) {
  target._zoomOriginAnimation?.cancel();
  target._zoomOriginAnimation = target.animate([{ transformOrigin: origin }], { duration: 0, fill: 'forwards' });
}

function setupImageLightbox() {
  const modal = document.getElementById('image-lightbox');
  const image = document.getElementById('lightbox-image');
  const specs = document.getElementById('lightbox-specs');
  const close = document.getElementById('lightbox-close');
  const dots = document.getElementById('lightbox-dots');
  if (!modal || !image || !close || !dots) return;
  let pointerInsideImage = false;
  let lastPointerPosition = null;

  const closeModal = () => {
    modal.hidden = true;
    image.removeAttribute('src');
    specs.textContent = '';
    dots.replaceChildren();
    delete modal.dataset.zoomReady;
    pointerInsideImage = false;
    lastPointerPosition = null;
    document.body.classList.remove('modal-open');
  };
  const showImage = (sources, index, product) => {
    image.src = sources[index];
    image.alt = product.name;
    specs.textContent = formatProductSpecs(product);
    image.classList.remove('is-zoomed');
    pointerInsideImage = false;
    lastPointerPosition = null;
    setZoomOrigin(image, 'center center');
    dots.querySelector('.active')?.classList.remove('active');
    dots.children[index]?.classList.add('active');
  };
  const openModal = (sources, index, product) => {
    dots.replaceChildren();
    sources.forEach((source, sourceIndex) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'lightbox-dot';
      dot.setAttribute('aria-label', `Mostrar foto ${sourceIndex + 1}`);
      dot.addEventListener('click', () => showImage(sources, sourceIndex, product));
      dots.append(dot);
    });
    showImage(sources, index, product);
    modal.hidden = false;
    delete modal.dataset.zoomReady;
    document.body.classList.add('modal-open');
    close.focus();
  };

  close.addEventListener('click', closeModal);
  modal.querySelector('[data-lightbox-close]')?.addEventListener('click', closeModal);
  image.addEventListener('pointerenter', (event) => {
    pointerInsideImage = true;
    lastPointerPosition = { x: event.clientX, y: event.clientY };
  });
  image.addEventListener('pointermove', (event) => {
    if (!pointerInsideImage || !lastPointerPosition) return;
    const moved = Math.hypot(
      event.clientX - lastPointerPosition.x,
      event.clientY - lastPointerPosition.y
    );
    if (moved < 8) return;
    lastPointerPosition = { x: event.clientX, y: event.clientY };
    const bounds = image.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    setZoomOrigin(image, `${x}% ${y}%`);
    image.classList.add('is-zoomed');
  });
  image.addEventListener('pointerleave', () => {
    pointerInsideImage = false;
    lastPointerPosition = null;
    setZoomOrigin(image, 'center center');
    image.classList.remove('is-zoomed');
  });
  image.addEventListener('click', (event) => {
    const bounds = image.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    image.classList.add('is-zoomed');
    setZoomOrigin(image, `${x}% ${y}%`);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) closeModal();
  });
  document.querySelectorAll('.product-photo').forEach((photo) => {
    const productImage = photo.querySelector('img');
    if (!productImage) return;
    photo.classList.add('product-photo-zoomable');
    photo.setAttribute('role', 'button');
    photo.setAttribute('tabindex', '0');
    photo.setAttribute('aria-label', `Ampliar imagen de ${productImage.alt}`);
    const sources = JSON.parse(photo.dataset.lightboxImages || '[]');
    const activeIndex = Number(photo.dataset.activeImage || 0);
    const open = () => openModal(sources.length ? sources : [productImage.src], activeIndex, photo._product);
    photo.addEventListener('click', (event) => {
      if (event.target.closest('.product-photo-dots')) return;
      open();
    });
    photo.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value ?? '';
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
  setText('payment-eyebrow', config.payments.eyebrow);
  setText('payment-title', config.payments.title);
  setText('payment-description', config.payments.description);
  setText('payment-footnote', config.payments.footnote);
  setText('social-eyebrow', config.socials.eyebrow);
  setText('social-title', config.socials.title);
}

function setImage(id, src, alt) {
  const node = document.getElementById(id);
  if (node) {
    node.src = src || '';
    node.alt = alt || '';
    if (id === 'hero-image') {
      node.parentElement?.style.setProperty('--hero-image', src ? `url("${src.replace(/"/g, '\\"')}")` : 'none');
    }
  }
}

function setupEditorialCarousel(slides) {
  const slideContainer = document.getElementById('editorial-slides');
  const dots = document.getElementById('carousel-dots');
  if (!slideContainer || !dots) return;
  slideContainer.replaceChildren();
  dots.replaceChildren();
  const validSlides = slides.filter((slide) => slide?.image);
  if (!validSlides.length) {
    slideContainer.textContent = 'Agrega imágenes desde Administrar.';
    return;
  }

  let activeIndex = 0;
  let timer;
  const render = () => {
    slideContainer.querySelector('.active')?.classList.remove('active');
    dots.querySelector('.active')?.classList.remove('active');
    const slide = slideContainer.children[activeIndex];
    const dot = dots.children[activeIndex];
    slide?.classList.add('active');
    dot?.classList.add('active');
    dot?.setAttribute('aria-current', 'true');
    dots.querySelectorAll('button:not(.active)').forEach((button) => button.removeAttribute('aria-current'));
  };
  const goTo = (index) => {
    activeIndex = (index + validSlides.length) % validSlides.length;
    render();
  };
  validSlides.forEach((item, index) => {
    const image = document.createElement('img');
    image.className = 'editorial-slide';
    image.src = item.image;
    image.alt = item.alt || `Marca de perfume ${index + 1}`;
    image.loading = index === 0 ? 'eager' : 'lazy';
    slideContainer.append(image);
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'carousel-dot';
    dot.setAttribute('aria-label', `Mostrar imagen ${index + 1}`);
    dot.addEventListener('click', () => {
      goTo(index);
      restart();
    });
    dots.append(dot);
  });
  const restart = () => {
    window.clearInterval(timer);
    if (validSlides.length > 1) timer = window.setInterval(() => goTo(activeIndex + 1), 5000);
  };
  render();
  restart();
}

function renderFilters(products, allLabel) {
  const genderContainer = document.getElementById('gender-list');
  const container = document.getElementById('category-list');
  const categoryRow = container.closest('.catalog-filter-row');
  const filters = { gender: allLabel, category: '' };
  const categories = ['Amaderado', 'Floral', 'Fresco', 'Oriental', 'Cítrico', 'Dulce', 'Ambarado', 'Almizclado'];
  categoryRow.hidden = true;
  const applyFilters = () => filterProducts(
    products,
    document.getElementById('product-search').value,
    filters.gender,
    filters.category,
    allLabel
  );

  renderFilterButtons(genderContainer, ['Todos', 'Hombre', 'Mujer', 'Unisex'], 'gender', filters, applyFilters, () => {
    const showAromas = filters.gender !== allLabel;
    categoryRow.hidden = !showAromas;
    genderContainer.querySelectorAll('.category-button').forEach((button) => button.setAttribute('aria-expanded', String(showAromas)));
    filters.category = '';
    container.querySelector('.active')?.classList.remove('active');
  });
  renderFilterButtons(container, categories, 'category', filters, applyFilters);
}

function renderFilterButtons(container, values, key, filters, applyFilters, onSelect) {
  values.forEach((value) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `category-button${filters[key] === value ? ' active' : ''}`;
    button.textContent = value;
    button.dataset[key] = value;
    if (key === 'gender') {
      button.setAttribute('aria-controls', 'aroma-filter-row');
      button.setAttribute('aria-expanded', 'false');
    }
    button.addEventListener('click', () => {
      container.querySelector('.active')?.classList.remove('active');
      button.classList.add('active');
      filters[key] = value;
      onSelect?.(value);
      applyFilters();
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
    article.dataset.gender = product.gender || 'Unisex';

    const photo = document.createElement('div');
    photo.className = 'product-photo';
    photo._product = product;
    const images = (product.images || [product.image]).filter(Boolean).slice(0, 3);
    photo.dataset.lightboxImages = JSON.stringify(images);
    photo.dataset.activeImage = '0';
    let activeImage = 0;
    const image = document.createElement('img');
    image.src = images[0] || '';
    image.alt = product.name;
    image.loading = 'lazy';
    photo.append(image);
    photo.addEventListener('mousemove', (event) => {
      const bounds = photo.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width) * 100;
      const y = ((event.clientY - bounds.top) / bounds.height) * 100;
      setZoomOrigin(image, `${x}% ${y}%`);
    });
    photo.addEventListener('mouseleave', () => {
      setZoomOrigin(image, 'center center');
    });
    if (images.length > 1) {
      const dots = document.createElement('div');
      dots.className = 'product-photo-dots';
      const showImage = (index) => {
        activeImage = index;
        photo.dataset.activeImage = String(index);
        image.src = images[activeImage];
        dots.querySelector('.active')?.classList.remove('active');
        dots.children[activeImage]?.classList.add('active');
      };
      images.forEach((_, index) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = `product-photo-dot${index === 0 ? ' active' : ''}`;
        dot.setAttribute('aria-label', `Mostrar foto ${index + 1} de ${product.name}`);
        dot.addEventListener('click', (event) => {
          event.stopPropagation();
          showImage(index);
        });
        dots.append(dot);
      });
      photo.append(dots);
      window.setInterval(() => showImage((activeImage + 1) % images.length), 4500);
    }

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

    const specs = document.createElement('p');
    specs.className = 'product-specs';
    specs.textContent = formatProductSpecs(product);
    specs.hidden = !specs.textContent;

    const description = document.createElement('p');
    description.className = 'product-description';
    description.textContent = product.description;

    const stock = Number.isInteger(product.stock) && product.stock >= 0 ? product.stock : 0;
    const stockStatus = document.createElement('p');
    stockStatus.className = `product-stock${stock === 0 ? ' product-stock-empty' : stock <= 3 ? ' product-stock-low' : ''}`;
    if (stock === 0) {
      stockStatus.textContent = 'Agotado temporalmente';
    } else if (stock <= 3) {
      stockStatus.textContent = `⚡ ¡Últimas ${stock} ${stock === 1 ? 'unidad' : 'unidades'} disponibles!`;
    } else {
      const marker = document.createElement('span');
      marker.className = 'product-stock-marker';
      marker.textContent = '✳';
      marker.setAttribute('aria-hidden', 'true');
      stockStatus.append(marker, ` ${stock} unidades disponibles`);
    }

    const buy = document.createElement(stock > 0 ? 'a' : 'button');
    buy.className = `product-buy${stock > 0 ? '' : ' product-buy-disabled'}`;
    if (stock > 0) {
      buy.href = '#';
      buy.setAttribute('aria-label', `Consultar ${product.name} por WhatsApp`);
      buy.innerHTML = '<span class="product-buy-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M20.2 11.8a8.2 8.2 0 0 1-12.2 7.1L4 20l1.1-3.9a8.2 8.2 0 1 1 15.1-4.3Z"/><path d="M8.9 8.3c.2-.5.5-.6.8-.6h.5c.2 0 .4.1.5.4l.7 1.6c.1.2.1.4-.1.6l-.5.6c-.2.2-.2.4 0 .6.5.9 1.3 1.6 2.2 2 .2.1.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.5.7c.2.1.4.3.4.5 0 .4-.2 1-.6 1.3-.4.4-1 .6-1.6.5-1-.1-2.4-.7-3.8-2-1.2-1.1-2-2.5-2.2-3.5-.1-.7.1-1.3.4-1.7Z"/></svg></span><span class="product-buy-divider" aria-hidden="true"></span><span class="product-buy-label">Consultar por WhatsApp</span><span class="product-buy-arrow" aria-hidden="true">→</span>';
      buy.addEventListener('click', (event) => {
        event.preventDefault();
        openWhatsApp(product);
      });
    } else {
      buy.type = 'button';
      buy.disabled = true;
      buy.setAttribute('aria-label', `${product.name}: sin stock disponible`);
      buy.textContent = 'Sin stock disponible';
    }
    info.append(topline, specs, description, stockStatus, buy);
    article.append(photo, info);
    grid.append(article);
  });
}

function formatPrice(price) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(price);
}

function formatProductSpecs(product) {
  return [product.ml, product.concentracion].filter(Boolean).join(' · ');
}

function filterProducts(products, query, gender, category, allLabel) {
  const normalizedQuery = query.trim().toLocaleLowerCase('es');
  let visible = 0;
  document.querySelectorAll('.product-card').forEach((card, index) => {
    const matchesCategory = !category || card.dataset.category === category;
    const matchesGender = gender === allLabel || card.dataset.gender === gender;
    const matchesQuery = card.dataset.name.includes(normalizedQuery);
    card.hidden = !(matchesGender && matchesCategory && matchesQuery);
    if (!card.hidden) visible += 1;
  });
  document.getElementById('empty-state').hidden = visible > 0;
}

function setupSearch(products, allLabel) {
  const input = document.getElementById('product-search');
  const searchBox = input.closest('.header-search');
  const mobileInput = document.getElementById('mobile-product-search');
  const mobileSearch = document.getElementById('mobile-catalog-search');
  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
  const headerSuggestions = document.getElementById('header-search-suggestions');
  const mobileSuggestions = document.getElementById('mobile-search-suggestions');
  let activeSuggestionIndex = -1;
  const applySearch = () => {
    const activeCategory = document.querySelector('#category-list .category-button.active')?.dataset.category || '';
    const activeGender = document.querySelector('#gender-list .category-button.active')?.dataset.gender || allLabel;
    filterProducts(products, input.value, activeGender, activeCategory, allLabel);
    document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const getMatches = (query) => {
    const normalized = query.trim().toLocaleLowerCase('es');
    if (!normalized) return [];
    return products.filter((product) => {
      const searchable = [product.name, product.brand, product.category, product.description]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('es');
      return searchable.includes(normalized);
    }).slice(0, 6);
  };
  const renderSuggestions = (sourceInput, dropdown) => {
    const matches = getMatches(sourceInput.value);
    dropdown.replaceChildren();
    activeSuggestionIndex = -1;
    if (!matches.length) {
      dropdown.hidden = true;
      return;
    }
    matches.forEach((product) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'search-suggestion';
      option.setAttribute('role', 'option');
      option.textContent = product.name;
      option.addEventListener('mousedown', (event) => event.preventDefault());
      option.addEventListener('click', () => {
        sourceInput.value = product.name;
        if (sourceInput === mobileInput) input.value = product.name;
        if (sourceInput === input && mobileInput) mobileInput.value = product.name;
        dropdown.hidden = true;
        const activeCategory = document.querySelector('#category-list .category-button.active')?.dataset.category || '';
        const activeGender = document.querySelector('#gender-list .category-button.active')?.dataset.gender || allLabel;
        filterProducts(products, product.name, activeGender, activeCategory, allLabel);
        document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth', block: 'start' });
        sourceInput.focus();
      });
      dropdown.append(option);
    });
    dropdown.hidden = false;
  };
  const handleSuggestionKeyboard = (event, sourceInput, dropdown) => {
    const options = [...dropdown.querySelectorAll('.search-suggestion')];
    if (event.key === 'ArrowDown' && options.length) {
      event.preventDefault();
      activeSuggestionIndex = (activeSuggestionIndex + 1) % options.length;
      options.forEach((option, index) => option.classList.toggle('active', index === activeSuggestionIndex));
    } else if (event.key === 'ArrowUp' && options.length) {
      event.preventDefault();
      activeSuggestionIndex = (activeSuggestionIndex - 1 + options.length) % options.length;
      options.forEach((option, index) => option.classList.toggle('active', index === activeSuggestionIndex));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activeSuggestionIndex >= 0 && options[activeSuggestionIndex]) {
        options[activeSuggestionIndex].click();
        return;
      }
      sourceInput.value = sourceInput.value.trim();
      if (sourceInput === mobileInput) input.value = sourceInput.value;
      if (sourceInput === input && mobileInput) mobileInput.value = sourceInput.value;
      dropdown.hidden = true;
      const activeCategory = document.querySelector('#category-list .category-button.active')?.dataset.category || '';
      const activeGender = document.querySelector('#gender-list .category-button.active')?.dataset.gender || allLabel;
      filterProducts(products, sourceInput.value, activeGender, activeCategory, allLabel);
      document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (event.key === 'Escape') {
      dropdown.hidden = true;
    }
  };
  input.addEventListener('input', () => {
    if (mobileInput) mobileInput.value = input.value;
    renderSuggestions(input, headerSuggestions);
    const activeCategory = document.querySelector('#category-list .category-button.active')?.dataset.category || '';
    const activeGender = document.querySelector('#gender-list .category-button.active')?.dataset.gender || allLabel;
    filterProducts(products, input.value, activeGender, activeCategory, allLabel);
  });
  input.addEventListener('blur', () => window.setTimeout(() => { headerSuggestions.hidden = true; }, 150));
  mobileInput?.addEventListener('input', () => {
    input.value = mobileInput.value;
    renderSuggestions(mobileInput, mobileSuggestions);
    const activeCategory = document.querySelector('#category-list .category-button.active')?.dataset.category || '';
    const activeGender = document.querySelector('#gender-list .category-button.active')?.dataset.gender || allLabel;
    filterProducts(products, mobileInput.value, activeGender, activeCategory, allLabel);
  });
  mobileInput?.addEventListener('blur', () => window.setTimeout(() => { mobileSuggestions.hidden = true; }, 150));
  input.addEventListener('keydown', (event) => {
    handleSuggestionKeyboard(event, input, headerSuggestions);
  });
  mobileInput?.addEventListener('keydown', (event) => handleSuggestionKeyboard(event, mobileInput, mobileSuggestions));
  searchBox?.querySelector('.search-icon')?.addEventListener('click', (event) => {
    event.preventDefault();
    if (isMobile()) {
      document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => mobileInput?.focus(), 450);
    } else {
      applySearch();
    }
  });
  const syncMobileSearchVisibility = () => {
    if (mobileSearch) mobileSearch.hidden = !isMobile();
  };
  syncMobileSearchVisibility();
  window.addEventListener('resize', syncMobileSearchVisibility);
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
    const detail = method.action ? document.createElement('a') : document.createElement('span');
    detail.className = `payment-detail${method.action ? ' payment-action' : ''}`;
    detail.textContent = method.detail;
    if (method.action) {
      detail.href = method.url;
      detail.target = '_blank';
      detail.rel = 'noopener noreferrer';
      if (method.action === 'qr') detail.setAttribute('aria-label', 'Abrir código QR de Yape');
    }
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
    link.textContent = `${platform} ${item.handle} `;
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
  const specifications = formatProductSpecs(product);
  const message = `${window.siteConfig.contact.whatsappMessage} ${product.name}${specifications ? ` (${specifications})` : ''} (${formatPrice(product.price)})`;
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove('visible'), 3500);
}
