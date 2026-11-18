const imagePathPattern = /^\/api\/images\?key=[0-9a-f-]{36}\.(?:png|jpg|webp)$/i;

function validateProducts(products) {
  if (!Array.isArray(products) || products.length > 80) {
    throw new Error('El catálogo debe tener entre 0 y 80 perfumes.');
  }

  return products.map((product) => {
    if (!product || typeof product !== 'object' || Array.isArray(product)) {
      throw new Error('Uno de los perfumes tiene datos inválidos.');
    }

    const name = cleanText(product.name, 80, 'nombre');
    const category = cleanText(product.category, 40, 'categoría');
    const gender = product.gender === undefined ? 'Unisex' : cleanText(product.gender, 12, 'público');
    const label = cleanText(product.label || category, 32, 'etiqueta');
    const description = cleanText(product.description, 280, 'descripción');
    const ml = optionalText(product.ml, 20, 'contenido');
    const concentracion = optionalText(product.concentracion, 12, 'concentración');
    const price = Number(product.price);
    const stock = Number(product.stock ?? 0);
    const hasImages = Array.isArray(product.images);
    const sourceImages = hasImages ? product.images : [product.image];
    if (sourceImages.length < 1 || sourceImages.length > 3) {
      throw new Error(`El perfume ${name} debe tener entre 1 y 3 imágenes.`);
    }
    const images = sourceImages.map((value, imageIndex) => {
      const image = cleanText(value, 2048, `imagen ${imageIndex + 1} de ${name}`);
      let imageUrl;
      try {
        imageUrl = new URL(image);
      } catch {
        imageUrl = null;
      }
      if ((!imageUrl || imageUrl.protocol !== 'https:') && !imagePathPattern.test(image)) {
        throw new Error(`La imagen ${imageIndex + 1} de ${name} debe usar HTTPS o una foto subida al administrador.`);
      }
      return image;
    });

    if (!Number.isFinite(price) || price < 0 || price > 100000) {
      throw new Error(`El precio de ${name} debe estar entre S/ 0 y S/ 100000.`);
    }
    if (!Number.isSafeInteger(stock) || stock < 0) {
      throw new Error(`El stock de ${name} debe ser un número entero mayor o igual a 0.`);
    }
    if (!['Hombre', 'Mujer', 'Unisex'].includes(gender)) {
      throw new Error(`El público de ${name} debe ser Hombre, Mujer o Unisex.`);
    }
    if (concentracion && !['EDT', 'EDP', 'Parfum', 'Elixir'].includes(concentracion)) {
      throw new Error(`La concentración de ${name} no es válida.`);
    }

    const result = { name, category, gender, label, description, price, stock, image: images[0] };
    if (hasImages) result.images = images;
    if (ml) result.ml = ml;
    if (concentracion) result.concentracion = concentracion;
    return result;
  });
}

function cleanText(value, maxLength, field) {
  if (typeof value !== 'string') throw new Error(`El campo ${field} no es válido.`);
  const text = value.trim();
  if (!text || text.length > maxLength) throw new Error(`El campo ${field} es obligatorio y admite hasta ${maxLength} caracteres.`);
  return text;
}

function optionalText(value, maxLength, field) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') throw new Error(`El campo ${field} no es válido.`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`El campo ${field} admite hasta ${maxLength} caracteres.`);
  return text;
}

module.exports = { validateProducts };