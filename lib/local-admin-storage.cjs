const fs = require('node:fs/promises');
const path = require('node:path');

function createLocalStorage(root, defaults) {
  const dataDirectory = path.join(root, '.data');
  const imageDirectory = path.join(dataDirectory, 'images');
  const attemptDirectory = path.join(dataDirectory, 'attempts');
  const productsFile = path.join(dataDirectory, 'products.json');

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

function mimeFor(key) {
  if (key.endsWith('.png')) return 'image/png';
  if (key.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

module.exports = { createLocalStorage };