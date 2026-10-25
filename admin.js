const loginView = document.getElementById('login-view');
const editorView = document.getElementById('editor-view');
const loginForm = document.getElementById('login-form');
const loginStatus = document.getElementById('login-status');
const editorStatus = document.getElementById('editor-status');
const productsList = document.getElementById('products-list');
const productCount = document.getElementById('product-count');
const state = { csrf: '', products: [], original: [], pendingImages: new Map() };

document.addEventListener('DOMContentLoaded', initialize);
loginForm.addEventListener('submit', submitLogin);
document.getElementById('add-product').addEventListener('click', addProduct);
document.getElementById('save-changes').addEventListener('click', saveChanges);
document.getElementById('discard-changes').addEventListener('click', discardChanges);
document.getElementById('logout-button').addEventListener('click', logout);

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
  state.products = structuredClone(content.products || []);
  state.original = structuredClone(state.products);
  state.pendingImages.clear();
  renderProducts();
  loginView.hidden = true;
  editorView.hidden = false;
  setStatus(editorStatus, 'Catálogo cargado.', 'success');
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

function createProductEditor(product, index) {
  const row = document.createElement('article');
  row.className = 'product-editor';

  const photo = document.createElement('div');
  photo.className = 'photo-control';
  const preview = document.createElement('img');
  preview.className = 'photo-preview';
  preview.alt = `Foto de ${product.name || 'nuevo perfume'}`;
  preview.src = state.pendingImages.get(index)?.previewUrl || product.image || '';
  const fileInput = document.createElement('input');
  fileInput.className = 'photo-input';
  fileInput.type = 'file';
  fileInput.accept = 'image/png,image/jpeg,image/webp';
  fileInput.id = `image-${index}`;
  fileInput.setAttribute('aria-label', `Elegir foto para ${product.name || 'nuevo perfume'}`);
  fileInput.addEventListener('change', () => selectImage(fileInput.files?.[0], index, preview));
  const fileLabel = document.createElement('label');
  fileLabel.className = 'photo-label';
  fileLabel.htmlFor = fileInput.id;
  fileLabel.textContent = 'Cambiar foto';
  photo.append(preview, fileInput, fileLabel);

  const fields = document.createElement('div');
  fields.className = 'product-fields';
  fields.append(
    createField('Nombre', 'name', product.name, index),
    createField('Categoría', 'category', product.category, index),
    createField('Precio (S/)', 'price', product.price, index, 'number'),
    createField('Etiqueta', 'label', product.label, index),
    createField('Descripción', 'description', product.description, index, 'textarea', true)
  );

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove-product';
  remove.textContent = 'Quitar';
  remove.setAttribute('aria-label', `Quitar ${product.name || 'nuevo perfume'}`);
  remove.addEventListener('click', () => removeProduct(index));
  row.append(photo, fields, remove);
  return row;
}

function createField(label, key, value, index, type = 'text', wide = false) {
  const wrapper = document.createElement('label');
  wrapper.className = `field${wide ? ' field-wide' : ''}`;
  const caption = document.createElement('span');
  caption.className = 'field-label';
  caption.textContent = label;
  let input;
  if (type === 'textarea') {
    input = document.createElement('textarea');
  } else {
    input = document.createElement('input');
    input.type = type;
    if (type === 'number') {
      input.min = '0';
      input.max = '100000';
      input.step = '0.01';
    }
  }
  input.value = value ?? '';
  input.required = true;
  input.maxLength = key === 'description' ? 280 : key === 'name' ? 80 : key === 'category' ? 40 : 32;
  input.addEventListener('input', () => {
    state.products[index][key] = type === 'number' ? Number(input.value) : input.value;
    setStatus(editorStatus, 'Tienes cambios sin guardar.');
  });
  wrapper.append(caption, input);
  return wrapper;
}

function selectImage(file, index, preview) {
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
    setStatus(editorStatus, 'Usa una imagen PNG, JPG o WebP de hasta 4 MB.', 'error');
    return;
  }
  const oldImage = state.pendingImages.get(index);
  if (oldImage?.previewUrl) URL.revokeObjectURL(oldImage.previewUrl);
  const previewUrl = URL.createObjectURL(file);
  state.pendingImages.set(index, { file, previewUrl });
  preview.src = previewUrl;
  setStatus(editorStatus, 'Foto seleccionada. Guarda los cambios para publicarla.', 'success');
}

function addProduct() {
  state.products.push({ name: '', category: 'Amaderado', label: 'Nuevo', price: 0, description: '', image: '' });
  renderProducts();
  setStatus(editorStatus, 'Completa los campos y selecciona una foto.');
  productsList.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function removeProduct(index) {
  const removed = state.pendingImages.get(index);
  if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
  const nextImages = new Map();
  state.pendingImages.forEach((image, imageIndex) => {
    if (imageIndex < index) nextImages.set(imageIndex, image);
    if (imageIndex > index) nextImages.set(imageIndex - 1, image);
  });
  state.pendingImages = nextImages;
  state.products.splice(index, 1);
  renderProducts();
  setStatus(editorStatus, 'Tienes cambios sin guardar.');
}

async function saveChanges() {
  const saveButton = document.getElementById('save-changes');
  saveButton.disabled = true;
  setStatus(editorStatus, 'Guardando catálogo…');
  try {
    for (const [index, pending] of state.pendingImages) {
      if (index >= state.products.length) continue;
      const data = await fileAsBase64(pending.file);
      const uploaded = await request('/api/admin?op=image', { method: 'POST', body: { data } });
      state.products[index].image = uploaded.image;
    }
    const result = await request('/api/admin?op=products', { method: 'PUT', body: { products: state.products } });
    state.products = result.products;
    state.original = structuredClone(result.products);
    state.pendingImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    state.pendingImages.clear();
    renderProducts();
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
  renderProducts();
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