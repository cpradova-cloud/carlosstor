const loginView = document.getElementById('login-view');
const editorView = document.getElementById('editor-view');
const loginForm = document.getElementById('login-form');
const loginStatus = document.getElementById('login-status');
const editorStatus = document.getElementById('editor-status');
const productsList = document.getElementById('products-list');
const carouselList = document.getElementById('carousel-list');
const heroEditorContent = document.getElementById('hero-editor-content');
const productCount = document.getElementById('product-count');
const state = { csrf: '', products: [], original: [], carousel: [], originalCarousel: [], hero: null, originalHero: null, pendingHeroImage: null, pendingImages: new Map(), pendingCarouselImages: new Map() };

document.addEventListener('DOMContentLoaded', initialize);
loginForm.addEventListener('submit', submitLogin);
document.getElementById('add-product').addEventListener('click', addProduct);
document.getElementById('save-changes').addEventListener('click', saveChanges);
document.getElementById('discard-changes').addEventListener('click', discardChanges);
document.getElementById('logout-button').addEventListener('click', logout);
document.getElementById('add-carousel-slide').addEventListener('click', addCarouselSlide);

async function initialize() {
  try {
    const session = await request('/api/admin?op=session');
    if (session.authenticated) {
      state.csrf = session.csrf;
      await showEditor();
    }
  } catch (error) {
    setStatus(loginStatus, error.message, 'error');
  }
}

async function submitLogin(event) {
  event.preventDefault();
  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  setStatus(loginStatus, 'Verificando acceso…');
  try {
    const values = new FormData(loginForm);
    const result = await request('/api/admin?op=login', {
      method: 'POST',
      body: { id: values.get('id'), password: values.get('password') }
    });
    state.csrf = result.csrf;
    loginForm.reset();
    await showEditor();
  } catch (error) {
    setStatus(loginStatus, error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

async function showEditor() {
  const content = await request('/api/content');
  state.products = structuredClone(content.products || []).map((product) => ({
    ...product,
    images: product.images || [product.image]
  }));
  state.original = structuredClone(state.products);
  state.carousel = structuredClone(content.editorial?.carousel || []);
  state.originalCarousel = structuredClone(state.carousel);
  state.hero = structuredClone(content.hero);
  state.originalHero = structuredClone(content.hero);
  state.pendingImages.clear();
  state.pendingCarouselImages.clear();
  renderProducts();
  renderCarousel();
  renderHero();
  renderRatingSummary(await request('/api/rating'));
  loginView.hidden = true;
  editorView.hidden = false;
  setStatus(editorStatus, 'Catálogo cargado.', 'success');
}

function renderRatingSummary(rating) {
  const summary = document.getElementById('admin-rating-summary');
  if (!summary) return;
  summary.replaceChildren();
  const title = document.createElement('strong');
  title.textContent = 'Satisfacción de visitantes';
  if (!rating.total) {
    const empty = document.createElement('span');
    empty.textContent = 'Aún no hay calificaciones.';
    summary.append(title, empty);
    return;
  }
  const stars = createAdminRatingStars(rating.average);
  const value = document.createElement('span');
  value.className = 'admin-rating-text';
  value.textContent = `${rating.average.toFixed(1)} · Basado en ${rating.total} ${rating.total === 1 ? 'calificación' : 'calificaciones'}`;
  summary.append(title, stars, value);
}

function createAdminRatingStars(average) {
  const stars = document.createElement('span');
  stars.className = 'rating-badge-stars';
  stars.setAttribute('aria-label', `${average.toFixed(1)} de 5`);
  const starPath = 'M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.47L12 17.32l-5.8 3.05 1.11-6.47-4.7-4.58 6.49-.94L12 2.5z';
  for (let index = 0; index < 5; index += 1) {
    const fillPercent = Math.max(0, Math.min(100, (average - index) * 100));
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const clipId = `admin-rating-star-${index}-${Math.random().toString(36).slice(2)}`;
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

function renderHero() {
  heroEditorContent.replaceChildren();
  const preview = document.createElement('img');
  preview.className = 'hero-preview';
  preview.alt = 'Vista previa de la imagen principal';
  const imageSource = state.pendingHeroImage?.previewUrl || state.hero?.image || '';
  const placeholder = createImagePlaceholder('+ Subir foto');
  setImagePreview(preview, placeholder, imageSource);
  const previewFrame = createImagePreviewFrame(preview, placeholder);
  const fields = document.createElement('div');
  fields.className = 'hero-image-fields';
  fields.append(
    createHeroField('Texto pequeño del evento', 'featuredKicker', state.hero?.featuredKicker || ''),
    createHeroField('Título de la campaña', 'featuredName', state.hero?.featuredName || '')
  );
  const input = document.createElement('input');
  input.className = 'photo-input';
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp';
  input.id = 'hero-image-input';
  input.addEventListener('change', () => selectHeroImage(input.files?.[0], preview, placeholder));
  const label = document.createElement('label');
  label.className = 'photo-label';
  label.htmlFor = input.id;
  label.textContent = 'Elegir imagen principal';
  fields.append(input, label);
  heroEditorContent.append(previewFrame, fields);
}

function createImagePlaceholder(text) {
  const placeholder = document.createElement('div');
  placeholder.className = 'image-preview-placeholder';
  placeholder.textContent = text;
  return placeholder;
}

function createImagePreviewFrame(preview, placeholder) {
  const frame = document.createElement('div');
  frame.className = 'image-preview-frame';
  frame.append(placeholder, preview);
  return frame;
}

function setImagePreview(preview, placeholder, source) {
  preview.src = source;
  preview.hidden = !source;
  placeholder.hidden = Boolean(source);
}

function createHeroField(label, key, value) {
  const wrapper = document.createElement('label');
  wrapper.className = 'field';
  const caption = document.createElement('span');
  caption.className = 'field-label';
  caption.textContent = label;
  const input = document.createElement('input');
  input.value = value;
  input.maxLength = key === 'featuredName' ? 100 : 60;
  input.required = true;
  input.addEventListener('input', () => {
    state.hero[key] = input.value;
    setStatus(editorStatus, 'Tienes cambios sin guardar.');
  });
  wrapper.append(caption, input);
  return wrapper;
}

function selectHeroImage(file, preview, placeholder) {
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
    setStatus(editorStatus, 'Usa una imagen PNG, JPG o WebP de hasta 4 MB.', 'error');
    return;
  }
  if (state.pendingHeroImage?.previewUrl) URL.revokeObjectURL(state.pendingHeroImage.previewUrl);
  const previewUrl = URL.createObjectURL(file);
  state.pendingHeroImage = { file, previewUrl };
  setImagePreview(preview, placeholder, previewUrl);
  setStatus(editorStatus, 'Imagen principal seleccionada. Guarda los cambios para publicarla.', 'success');
}

function renderCarousel() {
  carouselList.replaceChildren();
  if (!state.carousel.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-list';
    empty.textContent = 'Aún no hay imágenes. Agrega la primera para mostrar el carrusel.';
    carouselList.append(empty);
  }
  state.carousel.forEach((slide, index) => carouselList.append(createCarouselEditor(slide, index)));
}

function createCarouselEditor(slide, index) {
  const row = document.createElement('article');
  row.className = 'carousel-editor-row';
  const preview = document.createElement('img');
  preview.className = 'carousel-preview';
  preview.alt = slide.alt || `Imagen ${index + 1}`;
  const imageSource = state.pendingCarouselImages.get(index)?.previewUrl || slide.image || '';
  const placeholder = createImagePlaceholder('+ Subir foto');
  setImagePreview(preview, placeholder, imageSource);
  const previewFrame = createImagePreviewFrame(preview, placeholder);
  const controls = document.createElement('div');
  controls.className = 'carousel-fields';
  const fileInput = document.createElement('input');
  fileInput.className = 'photo-input';
  fileInput.type = 'file';
  fileInput.accept = 'image/png,image/jpeg,image/webp';
  fileInput.id = `carousel-image-${index}`;
  fileInput.addEventListener('change', () => selectCarouselImage(fileInput.files?.[0], index, preview, placeholder));
  const fileLabel = document.createElement('label');
  fileLabel.className = 'photo-label';
  fileLabel.htmlFor = fileInput.id;
  fileLabel.textContent = 'Elegir imagen';
  const actions = document.createElement('div');
  actions.className = 'carousel-actions';
  const moveUp = createCarouselButton('↑', `Subir imagen ${index + 1}`, () => moveCarouselSlide(index, -1), index === 0);
  const moveDown = createCarouselButton('↓', `Bajar imagen ${index + 1}`, () => moveCarouselSlide(index, 1), index === state.carousel.length - 1);
  const remove = createCarouselButton('Quitar', `Quitar imagen ${index + 1}`, () => removeCarouselSlide(index));
  actions.append(moveUp, moveDown, remove);
  controls.append(fileInput, fileLabel, actions);
  row.append(previewFrame, controls);
  return row;
}

function createCarouselButton(text, label, onClick, disabled = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'remove-product';
  button.textContent = text;
  button.setAttribute('aria-label', label);
  button.disabled = disabled;
  button.addEventListener('click', onClick);
  return button;
}

function selectCarouselImage(file, index, preview, placeholder) {
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
    setStatus(editorStatus, 'Usa una imagen PNG, JPG o WebP de hasta 4 MB.', 'error');
    return;
  }
  const oldImage = state.pendingCarouselImages.get(index);
  if (oldImage?.previewUrl) URL.revokeObjectURL(oldImage.previewUrl);
  const previewUrl = URL.createObjectURL(file);
  state.pendingCarouselImages.set(index, { file, previewUrl });
  setImagePreview(preview, placeholder, previewUrl);
  setStatus(editorStatus, 'Imagen seleccionada. Guarda los cambios para publicarla.', 'success');
}

function addCarouselSlide() {
  state.carousel.push({ image: '', alt: '' });
  renderCarousel();
  setStatus(editorStatus, 'Selecciona una imagen para agregarla al carrusel.');
  carouselList.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function moveCarouselSlide(index, direction) {
  const target = index + direction;
  if (target < 0 || target >= state.carousel.length) return;
  [state.carousel[index], state.carousel[target]] = [state.carousel[target], state.carousel[index]];
  const pending = new Map();
  state.pendingCarouselImages.forEach((image, imageIndex) => {
    if (imageIndex === index) pending.set(target, image);
    else if (imageIndex === target) pending.set(index, image);
    else pending.set(imageIndex, image);
  });
  state.pendingCarouselImages = pending;
  renderCarousel();
  setStatus(editorStatus, 'Tienes cambios sin guardar.');
}

function removeCarouselSlide(index) {
  const removed = state.pendingCarouselImages.get(index);
  if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
  const pending = new Map();
  state.pendingCarouselImages.forEach((image, imageIndex) => {
    if (imageIndex < index) pending.set(imageIndex, image);
    if (imageIndex > index) pending.set(imageIndex - 1, image);
  });
  state.pendingCarouselImages = pending;
  state.carousel.splice(index, 1);
  renderCarousel();
  setStatus(editorStatus, 'Tienes cambios sin guardar.');
}

function renderProducts() {
  productsList.replaceChildren();
  productCount.textContent = `${state.products.length} ${state.products.length === 1 ? 'perfume' : 'perfumes'}`;
  if (state.products.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-list';
    empty.textContent = 'El catálogo está vacío. Agrega un perfume para empezar.';
    productsList.append(empty);
  }

  state.products.forEach((product, index) => productsList.append(createProductEditor(product, index)));
}

function imageKey(index, slot) {
  return `${index}-${slot}`;
}

function createProductEditor(product, index) {
  const row = document.createElement('article');
  row.className = 'product-editor';
  row.dataset.productIndex = String(index);
  const heading = document.createElement('div');
  heading.className = 'product-editor-heading';
  const title = document.createElement('h3');
  title.textContent = `Perfume ${index + 1}`;
  const summary = document.createElement('span');
  summary.className = 'product-editor-summary';
  summary.textContent = 'Fotos + información';
  heading.append(title, summary);
  const validationAlert = document.createElement('p');
  validationAlert.className = 'product-validation-alert';
  validationAlert.hidden = true;
  validationAlert.setAttribute('role', 'alert');

  const photo = document.createElement('div');
  photo.className = 'photo-section';
  const photoTitle = document.createElement('h4');
  photoTitle.textContent = 'Fotos del perfume';
  const photoControls = document.createElement('div');
  photoControls.className = 'photo-controls';
  const images = product.images || [product.image];
  for (let slot = 0; slot < 3; slot += 1) {
    const control = document.createElement('div');
    control.className = 'photo-control';
    control.dataset.validationField = slot === 0 ? 'image' : '';
    const preview = document.createElement('img');
    preview.className = 'photo-preview';
    preview.alt = `Foto ${slot + 1} de ${product.name || 'nuevo perfume'}`;
    const imageSource = state.pendingImages.get(imageKey(index, slot))?.previewUrl || images[slot] || '';
    const placeholder = createImagePlaceholder('+ Subir foto');
    setImagePreview(preview, placeholder, imageSource);
    const previewFrame = createImagePreviewFrame(preview, placeholder);
    const fileInput = document.createElement('input');
    fileInput.className = 'photo-input';
    fileInput.type = 'file';
    fileInput.accept = 'image/png,image/jpeg,image/webp';
    fileInput.id = `image-${index}-${slot}`;
    fileInput.setAttribute('aria-label', `Elegir foto ${slot + 1} para ${product.name || 'nuevo perfume'}`);
    fileInput.addEventListener('change', () => {
      selectImage(fileInput.files?.[0], index, slot, preview, placeholder, fileLabel);
      clearValidationField(row, slot === 0 ? 'image' : '');
    });
    const fileLabel = document.createElement('label');
    fileLabel.className = 'photo-label';
    fileLabel.htmlFor = fileInput.id;
    fileLabel.textContent = imageSource ? `Foto ${slot + 1}` : '＋ Subir foto';
    if (!imageSource) fileLabel.classList.add('photo-label-empty');
    const removeImage = document.createElement('button');
    removeImage.type = 'button';
    removeImage.className = 'remove-photo';
    removeImage.textContent = '🗑';
    removeImage.setAttribute('aria-label', `Eliminar foto ${slot + 1} de ${product.name || 'nuevo perfume'}`);
    removeImage.disabled = images.filter(Boolean).length <= 1;
    removeImage.addEventListener('click', () => removeProductImage(index, slot));
    control.append(previewFrame, fileInput, fileLabel, removeImage);
    photoControls.append(control);
  }
  photo.append(photoTitle, photoControls);

  const fields = document.createElement('div');
  fields.className = 'product-data';
  const fieldsTitle = document.createElement('h4');
  fieldsTitle.textContent = 'Datos del perfume';
  const productFields = document.createElement('div');
  productFields.className = 'product-fields';
  productFields.append(
    createField('Nombre', 'name', product.name, index),
    createField('Público', 'gender', product.gender || 'Unisex', index, 'select'),
    createField('Categoría', 'category', product.category, index, 'select'),
    createField('Precio (S/)', 'price', product.price, index, 'number'),
    createField('Stock disponible', 'stock', product.stock ?? 0, index, 'number', false, 1),
    createField('Etiqueta', 'label', product.label, index, 'select'),
    createField('Contenido (ml)', 'ml', product.ml || '', index, 'select'),
    createField('Concentración', 'concentracion', product.concentracion || '', index, 'select'),
    createField('Descripción', 'description', product.description, index, 'textarea', true)
  );

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove-product';
  remove.textContent = 'Quitar';
  remove.setAttribute('aria-label', `Quitar ${product.name || 'nuevo perfume'}`);
  remove.addEventListener('click', () => removeProduct(index));
  fields.append(fieldsTitle, productFields);
  const content = document.createElement('div');
  content.className = 'product-editor-content';
  content.append(photo, fields);
  const actions = document.createElement('div');
  actions.className = 'product-editor-actions';
  actions.append(remove);
  row.append(heading, validationAlert, content, actions);
  return row;
}

function createField(label, key, value, index, type = 'text', wide = false, step = null, suggestions = []) {
  const wrapper = document.createElement('label');
  wrapper.className = `field${wide ? ' field-wide' : ''}`;
  const caption = document.createElement('span');
  caption.className = 'field-label';
  caption.textContent = label;
  let input;
  if (type === 'textarea') {
    input = document.createElement('textarea');
  } else if (type === 'select') {
    input = document.createElement('select');
    const options = key === 'concentracion'
      ? ['Seleccionar...', 'EDT', 'EDP', 'Parfum', 'Elixir']
      : key === 'ml'
        ? ['Seleccionar...', '30 ml', '50 ml', '75 ml', '90 ml', '100 ml', '125 ml', '200 ml']
        : key === 'gender'
          ? ['Hombre', 'Mujer', 'Unisex']
          : key === 'category'
            ? ['Amaderado', 'Floral', 'Fresco', 'Oriental', 'Cítrico', 'Dulce', 'Ambarado', 'Almizclado']
            : ['Diario', 'Favorito', 'Nuevo', 'Edición especial'];
    options.forEach((optionValue) => {
      const option = document.createElement('option');
      option.value = optionValue === 'Seleccionar...' ? '' : optionValue;
      option.textContent = optionValue;
      input.append(option);
    });
  } else {
    input = document.createElement('input');
    input.type = type;
    if (suggestions.length) {
      const listId = `suggestions-${key}-${index}`;
      const list = document.createElement('datalist');
      list.id = listId;
      suggestions.forEach((suggestion) => {
        const option = document.createElement('option');
        option.value = suggestion;
        list.append(option);
      });
      input.setAttribute('list', listId);
      wrapper.append(list);
    }
    if (type === 'number') {
      input.min = '0';
      if (key !== 'stock') input.max = '100000';
      input.step = step || '0.01';
    }
  }
  input.value = value ?? '';
  input.dataset.fieldKey = key;
  input.required = !['ml', 'concentracion'].includes(key);
  if (type !== 'select') input.maxLength = key === 'description' ? 280 : key === 'name' ? 80 : key === 'category' ? 40 : 32;
  input.addEventListener('input', () => {
    state.products[index][key] = type === 'number' ? Number(input.value) : input.value;
    clearValidationField(input.closest('.product-editor'), key);
    setStatus(editorStatus, 'Tienes cambios sin guardar.');
  });
  input.addEventListener('change', () => clearValidationField(input.closest('.product-editor'), key));
  wrapper.append(caption, input);
  return wrapper;
}

function selectImage(file, index, slot, preview, placeholder, fileLabel) {
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
    setStatus(editorStatus, 'Usa una imagen PNG, JPG o WebP de hasta 4 MB.', 'error');
    return;
  }
  const oldImage = state.pendingImages.get(imageKey(index, slot));
  if (oldImage?.previewUrl) URL.revokeObjectURL(oldImage.previewUrl);
  const previewUrl = URL.createObjectURL(file);
  state.pendingImages.set(imageKey(index, slot), { file, previewUrl });
  setImagePreview(preview, placeholder, previewUrl);
  fileLabel.textContent = `Foto ${slot + 1}`;
  fileLabel.classList.remove('photo-label-empty');
  setStatus(editorStatus, 'Foto seleccionada. Guarda los cambios para publicarla.', 'success');
}

function removeProductImage(index, slot) {
  const product = state.products[index];
  const images = (product.images || [product.image]).filter(Boolean);
  if (images.length <= 1 || slot >= images.length) {
    setStatus(editorStatus, 'Cada perfume debe conservar al menos una foto.', 'error');
    return;
  }
  const pendingForProduct = new Map();
  state.pendingImages.forEach((pending, key) => {
    const [imageIndex, imageSlot] = key.split('-').map(Number);
    if (imageIndex === index) {
      if (imageSlot === slot) {
        URL.revokeObjectURL(pending.previewUrl);
        return;
      }
      if (imageSlot > slot) {
        pendingForProduct.set(imageKey(index, imageSlot - 1), pending);
        return;
      }
    }
    pendingForProduct.set(key, pending);
  });
  state.pendingImages = pendingForProduct;
  images.splice(slot, 1);
  product.images = images;
  product.image = images[0];
  renderProducts();
  setStatus(editorStatus, 'Foto eliminada. Guarda los cambios para publicarlo.', 'success');
}

function addProduct() {
  state.products.push({ name: '', category: 'Amaderado', gender: 'Unisex', label: 'Nuevo', price: 0, stock: 0, ml: '', concentracion: '', description: '', image: '', images: ['', '', ''] });
  renderProducts();
  setStatus(editorStatus, 'Completa los campos y selecciona una foto.');
  productsList.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function removeProduct(index) {
  [...state.pendingImages.keys()].filter((key) => key.startsWith(`${index}-`)).forEach((key) => {
    URL.revokeObjectURL(state.pendingImages.get(key).previewUrl);
  });
  const nextImages = new Map();
  state.pendingImages.forEach((image, key) => {
    const [imageIndex, slot] = key.split('-').map(Number);
    if (imageIndex < index) nextImages.set(key, image);
    if (imageIndex > index) nextImages.set(imageKey(imageIndex - 1, slot), image);
  });
  state.pendingImages = nextImages;
  state.products.splice(index, 1);
  renderProducts();
  setStatus(editorStatus, 'Tienes cambios sin guardar.');
}

function clearValidationField(row, key) {
  if (!row || !key) return;
  const index = Number(row.dataset.productIndex);
  const input = row.querySelector(`[data-field-key="${key}"]`);
  const product = state.products[index];
  const value = input?.value.trim() || '';
  const valid = key === 'image'
    ? Boolean(product?.images?.[0] || product?.image || state.pendingImages.has(imageKey(index, 0)))
    : key === 'price'
      ? Number(value) > 0
      : key === 'concentracion'
        ? ['EDT', 'EDP', 'Parfum', 'Elixir'].includes(value)
        : Boolean(value);
  if (!valid) return;
  row.querySelector(`[data-field-key="${key}"]`)?.classList.remove('validation-missing');
  row.querySelector(`[data-validation-field="${key}"]`)?.classList.remove('validation-missing');
  const alert = row.querySelector('.product-validation-alert');
  if (alert && !row.querySelector('.validation-missing')) alert.hidden = true;
}

function validateProductsBeforeSave() {
  const missingByProduct = [];
  let firstMissing = null;
  productsList.querySelectorAll('.product-editor').forEach((row, index) => {
    const product = state.products[index];
    const missing = [];
    const field = (key) => row.querySelector(`[data-field-key="${key}"]`);
    const requireText = (key, label) => {
      const input = field(key);
      if (!input?.value.trim()) {
        missing.push(label);
        input?.classList.add('validation-missing');
        if (!firstMissing) firstMissing = input;
      }
    };
    const images = product?.images || [product?.image];
    const hasFirstImage = Boolean(images?.[0] || state.pendingImages.has(imageKey(index, 0)));
    if (!hasFirstImage) {
      missing.push('Foto 1');
      const imageField = row.querySelector('[data-validation-field="image"]');
      imageField?.classList.add('validation-missing');
      if (!firstMissing) firstMissing = imageField?.querySelector('input') || imageField;
    }
    requireText('name', 'Nombre');
    requireText('gender', 'Público');
    requireText('category', 'Categoría');
    const price = field('price');
    if (!price || Number(price.value) <= 0) {
      missing.push('Precio (S/)');
      price?.classList.add('validation-missing');
      if (!firstMissing) firstMissing = price;
    }
    requireText('stock', 'Stock disponible');
    requireText('ml', 'Contenido (ml)');
    const concentration = field('concentracion');
    if (!['EDT', 'EDP', 'Parfum', 'Elixir'].includes(concentration?.value)) {
      missing.push('Concentración');
      concentration?.classList.add('validation-missing');
      if (!firstMissing) firstMissing = concentration;
    }
    requireText('description', 'Descripción');
    const alert = row.querySelector('.product-validation-alert');
    if (missing.length) {
      const name = field('name')?.value.trim() || 'sin nombre';
      const message = `⚠️ Falta completar en Perfume ${index + 1} (${name}): ${missing.join(', ')}.`;
      alert.textContent = message;
      alert.hidden = false;
      missingByProduct.push(message);
    } else {
      alert.hidden = true;
    }
  });
  if (!missingByProduct.length) return true;
  setStatus(editorStatus, missingByProduct.join(' '), 'error');
  firstMissing?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  firstMissing?.focus();
  return false;
}

async function saveChanges() {
  const saveButton = document.getElementById('save-changes');
  if (!validateProductsBeforeSave()) return;
  saveButton.disabled = true;
  setStatus(editorStatus, 'Guardando catálogo, imagen principal y carrusel…');
  try {
    for (const [key, pending] of state.pendingImages) {
      const [index, slot] = key.split('-').map(Number);
      if (index >= state.products.length) continue;
      const data = await fileAsBase64(pending.file);
      const uploaded = await request('/api/admin?op=image', { method: 'POST', body: { data } });
      state.products[index].images[slot] = uploaded.image;
      if (slot === 0) state.products[index].image = uploaded.image;
    }
    for (const [index, pending] of state.pendingCarouselImages) {
      if (index >= state.carousel.length) continue;
      const data = await fileAsBase64(pending.file);
      const uploaded = await request('/api/admin?op=image', { method: 'POST', body: { data } });
      state.carousel[index].image = uploaded.image;
    }
    if (state.pendingHeroImage) {
      const data = await fileAsBase64(state.pendingHeroImage.file);
      const uploaded = await request('/api/admin?op=image', { method: 'POST', body: { data } });
      state.hero.image = uploaded.image;
    }
    const result = await request('/api/admin?op=products', { method: 'POST', body: { products: state.products } });
    const carouselResult = await request('/api/admin?op=carousel', { method: 'POST', body: { carousel: state.carousel } });
    const heroResult = await request('/api/admin?op=hero', { method: 'POST', body: { hero: state.hero } });
    state.products = result.products;
    state.original = structuredClone(result.products);
    state.carousel = carouselResult.carousel;
    state.originalCarousel = structuredClone(carouselResult.carousel);
    state.hero = heroResult.hero;
    state.originalHero = structuredClone(heroResult.hero);
    state.pendingImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    state.pendingImages.clear();
    state.pendingCarouselImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    state.pendingCarouselImages.clear();
    if (state.pendingHeroImage?.previewUrl) URL.revokeObjectURL(state.pendingHeroImage.previewUrl);
    state.pendingHeroImage = null;
    renderProducts();
    renderCarousel();
    renderHero();
    setStatus(editorStatus, 'Cambios guardados. La tienda usará el catálogo actualizado.', 'success');
  } catch (error) {
    setStatus(editorStatus, error.message, 'error');
  } finally {
    saveButton.disabled = false;
  }
}

function discardChanges() {
  state.pendingImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  state.pendingImages.clear();
  state.products = structuredClone(state.original);
  state.pendingCarouselImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  state.pendingCarouselImages.clear();
  state.carousel = structuredClone(state.originalCarousel);
  if (state.pendingHeroImage?.previewUrl) URL.revokeObjectURL(state.pendingHeroImage.previewUrl);
  state.pendingHeroImage = null;
  state.hero = structuredClone(state.originalHero);
  renderProducts();
  renderCarousel();
  renderHero();
  setStatus(editorStatus, 'Cambios descartados.', 'success');
}

async function logout() {
  try {
    await request('/api/admin?op=logout', { method: 'POST' });
  } catch {
    // The client still leaves the protected view when the session has expired.
  }
  state.csrf = '';
  editorView.hidden = true;
  loginView.hidden = false;
  setStatus(loginStatus, 'Sesión cerrada.', 'success');
}

async function request(url, options = {}) {
  const method = options.method || 'GET';
  const headers = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && state.csrf) headers['X-CSRF-Token'] = state.csrf;
  const response = await fetch(url, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'No se pudo completar la operación.');
  return result;
}

function fileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('No se pudo leer la foto seleccionada.'));
    reader.readAsDataURL(file);
  });
}

function setStatus(node, message, type = '') {
  node.textContent = message;
  node.className = `status${type ? ` ${type}` : ''}`;
}