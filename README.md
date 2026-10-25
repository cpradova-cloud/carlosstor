# carlos.store

Tienda estática de perfumes en español, con búsqueda, filtros por categoría y consultas de compra por WhatsApp. No requiere dependencias externas para funcionar localmente; se usa Node.js para la vista previa con recarga automática.

## Abrir en VS Code

1. En VS Code usa **Archivo > Abrir carpeta...** y selecciona `C:\Users\Rog\Desktop\carlos.store`.
2. Abre `config.js` para cambiar el contenido de la tienda.
3. Inicia la vista previa desde una terminal integrada con `node server.js`.
4. Abre `http://localhost:5173` en el navegador integrado de VS Code. Al guardar archivos, la página se actualiza sola.
5. Para ver el código y la página juntos, arrastra la pestaña del navegador integrado hacia un lado del editor o usa **Ver > Editor dividido**.

Requiere Node.js instalado. Para detener el servidor, vuelve a la terminal y presiona `Ctrl+C`.

## Qué editar

- `config.js`: marca, textos, imágenes, productos, precios en soles, pagos, redes y contacto.
- `styles.css`: colores, tipografías, espaciados y diseño adaptable a móvil.
- `index.html`: estructura y secciones de la página.
- `script.js`: búsqueda, filtros y comportamiento de los botones.
- `images/`: guarda aquí las fotos propias y usa rutas como `images/perfume.jpg` en `config.js`.

En `config.js` reemplaza los textos de ejemplo de pagos, redes y WhatsApp por datos reales antes de compartir la tienda. WhatsApp se configura como número con código de país, sin signo `+` ni espacios.

## Dominio

La página se prueba localmente en `http://localhost:5173`. Para que `carlos.store` abra desde Internet hace falta registrar o configurar el dominio y publicar el proyecto en un servicio de hosting; este proyecto local no activa el dominio automáticamente.
