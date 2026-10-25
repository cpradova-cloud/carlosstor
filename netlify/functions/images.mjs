import adapter from '../../lib/netlify-handler.cjs';

export const handler = adapter.createNetlifyHandler('/api/images');