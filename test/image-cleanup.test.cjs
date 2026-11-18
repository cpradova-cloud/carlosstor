const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createLocalStorage } = require('../lib/local-admin-storage.cjs');

const keyOne = '123e4567-e89b-12d3-a456-426614174000.png';
const keyTwo = '123e4567-e89b-12d3-a456-426614174001.jpg';
const keyThree = '123e4567-e89b-12d3-a456-426614174002.webp';
const imageUrl = (key) => `/api/images?key=${key}`;

test('cleanup removes orphaned local images but preserves shared references', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'carlosstor-cleanup-'));
  const defaults = {
    products: [{
      name: 'Perfume original',
      category: 'Floral',
      gender: 'Unisex',
      label: 'Nuevo',
      price: 120,
      stock: 5,
      description: 'Descripción original.',
      image: 'https://images.example.com/default.jpg'
    }],
    editorial: { carousel: [] },
    hero: { image: 'https://images.example.com/hero.jpg' }
  };
  const storage = createLocalStorage(root, defaults);

  try {
    await Promise.all([
      storage.saveImage(keyOne, Buffer.from('one')),
      storage.saveImage(keyTwo, Buffer.from('two')),
      storage.saveImage(keyThree, Buffer.from('three'))
    ]);
    await storage.saveProducts([{
      ...defaults.products[0],
      image: imageUrl(keyOne),
      images: [imageUrl(keyOne), imageUrl(keyTwo)]
    }]);

    await storage.cleanupImages();
    assert.deepEqual(await existingImageKeys(root), [keyOne, keyTwo]);

    await storage.saveProducts([{
      ...defaults.products[0],
      image: imageUrl(keyTwo),
      images: [imageUrl(keyTwo)]
    }]);
    await storage.cleanupImages();
    assert.deepEqual(await existingImageKeys(root), [keyTwo]);

    await storage.saveProducts([]);
    await storage.cleanupImages();
    assert.deepEqual(await existingImageKeys(root), []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

async function existingImageKeys(root) {
  try {
    return (await fs.readdir(path.join(root, '.data', 'images'))).sort();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}
