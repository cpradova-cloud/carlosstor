const imageUrlPattern = /^\/api\/images\?key=[0-9a-f-]{36}\.(?:png|jpg|webp)$/i;

function validateCarousel(carousel) {
  if (!Array.isArray(carousel) || carousel.length > 12) {
    throw new Error('El carrusel debe tener entre 0 y 12 imágenes.');
  }
  return carousel.map((slide) => {
    if (!slide || typeof slide !== 'object' || Array.isArray(slide)) {
      throw new Error('Una imagen del carrusel tiene datos inválidos.');
    }
    const image = cleanText(slide.image, 2048, 'imagen del carrusel');
    let imageUrl;
    try {
      imageUrl = new URL(image);
    } catch {
      imageUrl = null;
    }
    if ((!imageUrl || imageUrl.protocol !== 'https:') && !imageUrlPattern.test(image)) {
      throw new Error('Las imágenes del carrusel deben usar HTTPS o una foto subida al administrador.');
    }
    const alt = cleanText(slide.alt || 'Marca de perfume', 120, 'texto alternativo');
    return { image, alt };
  });
}

function cleanText(value, maxLength, field) {
  if (typeof value !== 'string') throw new Error(`El campo ${field} no es válido.`);
  const text = value.trim();
  if (!text || text.length > maxLength) throw new Error(`El campo ${field} es obligatorio y admite hasta ${maxLength} caracteres.`);
  return text;
}

module.exports = { validateCarousel };
