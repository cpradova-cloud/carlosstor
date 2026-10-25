import { getStore } from '@netlify/blobs';

export function createNetlifyAdminStorage() {
  const contentStore = getStore('carlosstor-admin-content');
  const imageStore = getStore('carlosstor-admin-images');
  const securityStore = getStore({ name: 'carlosstor-admin-security', consistency: 'strong' });

  return {
    async getProducts() {
      return (await contentStore.get('products', { type: 'json' })) ?? null;
    },
    async saveProducts(products) {
      await contentStore.setJSON('products', products);
    },
    async getImage(key) {
      const result = await imageStore.getWithMetadata(key, { type: 'arrayBuffer' });
      if (!result) return null;
      const mime = result.metadata?.contentType || mimeFor(key);
      return { buffer: Buffer.from(result.data), mime };
    },
    async saveImage(key, buffer, mime) {
      const exactBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      await imageStore.set(key, exactBuffer, { metadata: { contentType: mime } });
    },
    async getLoginAttempt(key) {
      return (await securityStore.get(`login:${key}`, { type: 'json' })) ?? null;
    },
    async saveLoginAttempt(key, attempt) {
      const blobKey = `login:${key}`;
      for (let retry = 0; retry < 5; retry += 1) {
        const current = await securityStore.getWithMetadata(blobKey, { type: 'json' });
        const result = current
          ? await securityStore.setJSON(blobKey, attempt, { onlyIfMatch: current.etag })
          : await securityStore.setJSON(blobKey, attempt, { onlyIfNew: true });
        if (result.modified) return;
      }
      throw new Error('No se pudo actualizar el control de intentos.');
    },
    async clearLoginAttempt(key) {
      await securityStore.delete(`login:${key}`);
    }
  };
}

function mimeFor(key) {
  if (key.endsWith('.png')) return 'image/png';
  if (key.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}