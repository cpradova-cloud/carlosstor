# carlosstor

Tienda de perfumes en español con búsqueda, filtros por categoría, consultas por WhatsApp y panel de administración. El catálogo y las fotos se guardan localmente durante las pruebas y en Netlify Blobs en producción.

## Abrir en VS Code

1. En VS Code usa **Archivo > Abrir carpeta...** y selecciona la carpeta del proyecto en tu Escritorio.
2. Abre `config.js` para cambiar textos, marca, pagos y enlaces.
3. Inicia la vista previa desde una terminal integrada con `node server.js`.
4. Abre `http://localhost:5173` en el navegador integrado de VS Code. Al guardar archivos, la página se actualiza sola.
5. Abre `http://localhost:5173/admin` para administrar el catálogo. En esta máquina las credenciales de prueba son ID `carlos` y contraseña `12345`.
6. Para ver el código y la página juntos, arrastra la pestaña del navegador integrado hacia un lado del editor o usa **Ver > Editor dividido**.

El ID y la contraseña anteriores son solo para pruebas locales. `.env` está ignorado por Git y nunca debe subirse. Para detener el servidor, vuelve a la terminal y presiona `Ctrl+C`.

## Qué editar

- `config.js`: marca, textos, imágenes, productos, precios en soles, pagos, redes y contacto.
- `styles.css`: colores, tipografías, espaciados y diseño adaptable a móvil.
- `index.html`: estructura y secciones de la página.
- `script.js`: búsqueda, filtros y comportamiento de los botones.
- `admin.html`, `admin.css`, `admin.js`: panel privado de administración.
- `modern.css`: refinamiento visual de la tienda.
- `images/`: guarda aquí las fotos propias y usa rutas como `images/perfume.jpg` en `config.js`.

En `config.js` reemplaza los textos de ejemplo de pagos, redes y WhatsApp por datos reales antes de compartir la tienda. WhatsApp se configura como número con código de país, sin signo `+` ni espacios.

## Publicar el administrador en Netlify

El sitio requiere Functions y Netlify Blobs; `netlify.toml` ya define las rutas y dependencias. Antes de desplegar, configura estas variables en **Project configuration > Environment variables**:

- `ADMIN_ID`: el ID que elijas, por ejemplo `carlos`.
- `ADMIN_PASSWORD`: contraseña exclusiva de producción de al menos 14 caracteres.
- `SESSION_SECRET`: valor aleatorio de al menos 32 bytes.

No uses `12345` en Netlify. Si falta una variable o la contraseña es débil, la API administrativa queda deshabilitada. Después de guardar las variables, publica un nuevo deploy. El catálogo guardado y las imágenes se mantienen en Netlify Blobs entre deploys.

Antes de actualizar en GitHub, ejecuta `npm.cmd test` y confirma que `.env` no aparezca en `git status`.

## Dominio

La página se prueba localmente en `http://localhost:5173`. Para publicarla en Internet, registra un dominio completo disponible, por ejemplo `carlosstor.com` o `carlosstor.pe`, y configura el hosting. Este proyecto local no activa un dominio automáticamente.
