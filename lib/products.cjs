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
    const label = cleanText(product.label || category, 32, 'etiqueta');
    const description = cleanText(product.description, 280, 'descripción');
    const price = Number(product.price);
    const image = cleanText(product.image, 2048, 'imagen');

    if (!Number.isFinite(price) || price < 0 || price > 100000) {
      throw new Error(`El precio de ${name} debe estar entre S/ 0 y S/ 100000.`);
    }

    let imageUrl;
    try {
      imageUrl = new URL(image);
    } catch {
      imageUrl = null;
    }
    if ((!imageUrl || imageUrl.protocol !== 'https:') && !imagePathPattern.test(image)) {
      throw new Error(`La imagen de ${name} debe usar HTTPS o una foto subida al administrador.`);
    }

    return { name, category, label, description, price, image };
  });
}

function cleanText(value, maxLength, field) {
  if (typeof value !== 'string') throw new Error(`El campo ${field} no es válido.`);
  const text = value.trim();
  if (!text || text.length > maxLength) throw new Error(`El campo ${field} es obligatorio y admite hasta ${maxLength} caracteres.`);
  return text;
}

module.exports = { validateProducts };