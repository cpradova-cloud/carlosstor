// EDITA ESTE ARCHIVO para cambiar textos, productos, fotos, pagos, redes y contacto.
// Las fotos pueden ser enlaces de imagen o archivos que guardes en la carpeta images/.
window.siteConfig = {
  brand: 'carlosstor',
  announcement: 'ENVÍOS A TODO EL PERÚ · COMPRA FÁCIL POR WHATSAPP',
  hero: {
    eyebrow: 'TU NUEVA FIRMA OLFATIVA',
    title: 'Un aroma. Una forma de estar.',
    description: 'Encuentra fragancias que hablan de ti. Una selección especial para convertir cada día en una buena primera impresión.',
    button: 'Descubrir perfumes',
    note: 'Fragancias seleccionadas para acompañarte.',
    sideLabel: 'AROMAS PARA RECORDAR',
    image: 'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=1200&q=85',
    featuredKicker: 'Selección de la semana',
    featuredName: 'Tu próximo aroma favorito'
  },
  benefits: ['Precios claros en soles', 'Atención personalizada', 'Envíos coordinados en Perú'],
  catalog: {
    eyebrow: 'LA COLECCIÓN',
    title: 'Encuentra tu esencia',
    allLabel: 'Todos'
  },
  products: [
    {
      name: 'Amber Oud', category: 'Amaderado', label: 'Favorito', price: 189,
      description: 'Ámbar cálido, maderas y un fondo envolvente.',
      image: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=900&q=85'
    },
    {
      name: 'Rose Élégance', category: 'Floral', label: 'Nuevo', price: 169,
      description: 'Rosa fresca, flores blancas y una salida luminosa.',
      image: 'https://images.unsplash.com/photo-1587017539504-67cfbddac569?auto=format&fit=crop&w=900&q=85'
    },
    {
      name: 'Citrus No. 5', category: 'Fresco', label: 'Diario', price: 149,
      description: 'Cítricos brillantes y notas limpias para todos los días.',
      image: 'https://images.unsplash.com/photo-1595425970377-c9703cf48b6d?auto=format&fit=crop&w=900&q=85'
    },
    {
      name: 'Velvet Night', category: 'Oriental', label: 'Edición especial', price: 219,
      description: 'Especias suaves, vainilla y un toque de misterio.',
      image: 'https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=85'
    }
  ],
  editorial: {
    eyebrow: 'MENOS RUIDO, MÁS ESENCIA',
    title: 'El detalle que se queda contigo.',
    description: 'Elegimos cada perfume pensando en cómo te hace sentir. Explora la colección, encuentra el tuyo y haz tu pedido de manera directa y sencilla.',
    linkLabel: 'Ver toda la colección',
    image: 'https://images.unsplash.com/photo-1590736969955-71cc94901144?auto=format&fit=crop&w=1200&q=85'
  },
  payments: {
    eyebrow: 'PAGO SIMPLE Y SEGURO',
    title: 'Paga como prefieras.',
    description: 'Coordinamos contigo por WhatsApp para confirmar el perfume, el método de pago y la entrega.',
    methods: [
      { name: 'Yape', detail: '986570478', number: '01' },
      { name: 'Transferencia BCP', detail: 'Agrega aquí tu cuenta o número de cuenta', number: '02' }
    ],
    footnote: 'Los datos de pago son editables. Verifica que sean correctos antes de publicar la tienda.'
  },
  socials: {
    eyebrow: 'SIGAMOS EN CONTACTO',
    title: 'Nos vemos por aquí.',
    instagram: { handle: '@tu_usuario', url: 'https://instagram.com/' },
    tiktok: { handle: '@tu_usuario', url: 'https://tiktok.com/' }
  },
  contact: {
    whatsappNumber: '986570478', // Escribe tu número con código de país y sin + ni espacios, por ejemplo 51987654321.
    whatsappMessage: 'Hola, quiero más información sobre este perfume.'
  },
  footer: '© {year} carlosstor.'
};
