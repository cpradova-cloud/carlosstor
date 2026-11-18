const fs = require('node:fs/promises');
const path = require('node:path');

const imageKeyPattern = /^[0-9a-f-]{36}\.(?:png|jpg|webp)$/i;

function createLocalStorage(root, defaults) {
  const dataDirectory = path.join(root, '.data');
  const imageDirectory = path.join(dataDirectory, 'images');
  const attemptDirectory = path.join(dataDirectory, 'attempts');
  const productsFile = path.join(dataDirectory, 'products.json');
  const carouselFile = path.join(dataDirectory, 'carousel.json');
  const heroFile = path.join(dataDirectory, 'hero.json');
  const ratingsFile = path.join(dataDirectory, 'ratings.json');

  return {
    async getProducts() {
      try {
        return JSON.parse(await fs.readFile(productsFile, 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') return defaults.products;
        throw error;
      }
    },
    async saveProducts(products) {
      await fs.mkdir(dataDirectory, { recursive: true });
      const temporaryFile = `${productsFile}.tmp`;
      await fs.writeFile(temporaryFile, JSON.stringify(products, null, 2), { mode: 0o600 });
      await fs.rename(temporaryFile, productsFile);
    },
    async getCarousel() {
      try {
        return JSON.parse(await fs.readFile(carouselFile, 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') return defaults.editorial.carousel;
        throw error;
      }
    },
    async saveCarousel(carousel) {
      await fs.mkdir(dataDirectory, { recursive: true });
      const temporaryFile = `${carouselFile}.tmp`;
      await fs.writeFile(temporaryFile, JSON.stringify(carousel, null, 2), { mode: 0o600 });
      await fs.rename(temporaryFile, carouselFile);
    },
    async getHero() {
      try {
        return JSON.parse(await fs.readFile(heroFile, 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') return defaults.hero;
        throw error;
      }
    },
    async saveHero(hero) {
      await fs.mkdir(dataDirectory, { recursive: true });
      const temporaryFile = `${heroFile}.tmp`;
      await fs.writeFile(temporaryFile, JSON.stringify(hero, null, 2), { mode: 0o600 });
      await fs.rename(temporaryFile, heroFile);
    },
    async getRatings() {
      try {
        const saved = JSON.parse(await fs.readFile(ratingsFile, 'utf8'));
        return Array.isArray(saved) ? saved : saved?.ratings || [];
      } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
      }
    },
    async saveRatings(ratings) {
      await fs.mkdir(dataDirectory, { recursive: true });
      const temporaryFile = `${ratingsFile}.tmp`;
      await fs.writeFile(temporaryFile, JSON.stringify(ratings, null, 2), { mode: 0o600 });
      await fs.rename(temporaryFile, ratingsFile);
    },
    async getImage(key) {
      const filePath = path.join(imageDirectory, key);
      try {
        return { buffer: await fs.readFile(filePath), mime: mimeFor(key) };
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    },
    async saveImage(key, buffer) {
      await fs.mkdir(imageDirectory, { recursive: true });
      await fs.writeFile(path.join(imageDirectory, key), buffer, { flag: 'wx', mode: 0o600 });
    },
    async cleanupImages() {
      const referencedKeys = new Set();
      const sources = [
        await readJsonOrDefault(productsFile, defaults.products),
        await readJsonOrDefault(carouselFile, defaults.editorial?.carousel || []),
        await readJsonOrDefault(heroFile, defaults.hero)
      ];
      collectImageKeys(sources[0], referencedKeys);
      collectImageKeys(sources[1], referencedKeys);
      collectImageKeys(sources[2], referencedKeys);

      let entries;
      try {
        entries = await fs.readdir(imageDirectory, { withFileTypes: true });
      } catch (error) {
        if (error.code === 'ENOENT') return;
        throw error;
      }

      await Promise.all(entries
        .filter((entry) => entry.isFile() && imageKeyPattern.test(entry.name) && !referencedKeys.has(entry.name))
        .map(async (entry) => {
          const filePath = path.join(imageDirectory, entry.name);
          try {
            await fs.access(filePath);
            await fs.unlink(filePath);
          } catch (error) {
            if (error.code !== 'ENOENT') throw error;
          }
        }));
    },
    async getLoginAttempt(key) {
      try {
        return JSON.parse(await fs.readFile(path.join(attemptDirectory, key), 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    },
    async saveLoginAttempt(key, attempt) {
      await fs.mkdir(attemptDirectory, { recursive: true });
      const filePath = path.join(attemptDirectory, key);
      const temporaryFile = `${filePath}.tmp`;
      await fs.writeFile(temporaryFile, JSON.stringify(attempt), { mode: 0o600 });
      await fs.rename(temporaryFile, filePath);
    },
    async clearLoginAttempt(key) {
      await fs.rm(path.join(attemptDirectory, key), { force: true });
    }
  };
}

async function readJsonOrDefault(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

function collectImageKeys(value, keys) {
  if (typeof value === 'string') {
    try {
      const key = new URL(value, 'http://localhost').searchParams.get('key');
      if (key && imageKeyPattern.test(key)) keys.add(key);
    } catch {
      // Invalid references are rejected by the normal content validators.
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectImageKeys(item, keys));
    return;
  }
  if (!value || typeof value !== 'object') return;
  Object.values(value).forEach((item) => collectImageKeys(item, keys));
}

function mimeFor(key) {
  if (key.endsWith('.png')) return 'image/png';
  if (key.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

module.exports = { createLocalStorage };