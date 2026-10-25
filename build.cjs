const fs = require('node:fs/promises');
const path = require('node:path');

const root = __dirname;
const output = path.join(root, 'dist');
const publicFiles = [
  'index.html',
  'admin.html',
  'config.js',
  'script.js',
  'live-reload.js',
  'styles.css',
  'modern.css',
  'admin.css',
  'admin.js'
];

async function build() {
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(output, { recursive: true });
  await Promise.all(publicFiles.map((file) => fs.copyFile(path.join(root, file), path.join(output, file))));

  try {
    await fs.cp(path.join(root, 'images'), path.join(output, 'images'), { recursive: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

build().catch((error) => {
  console.error('No se pudo preparar la carpeta pública.', error);
  process.exitCode = 1;
});