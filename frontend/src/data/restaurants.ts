import { foodImage, logoImage } from '../assets.ts';

export const initialRestaurants = [
  {
    id: 'cargo-food',
    name: 'Cargo Food',
    category: 'Comida rapida - Combos',
    image: foodImage,
    logo: logoImage,
    tags: ['Cerca de aulas', 'Combos'],
    menu: [
      { id: 1, name: 'Papas', description: 'Porcion de papas listas para llevar entre clases.', price: 1, available: true },
      { id: 2, name: 'Hamburguesa', description: 'Hamburguesa sencilla con pan, carne y salsas.', price: 3.5, available: true },
      { id: 3, name: 'Hamburguesa en combo', description: 'Hamburguesa con papas y bebida.', price: 4.5, available: true }
    ]
  },
  {
    id: 'piazza',
    name: 'Piazza',
    category: 'Snacks - Almuerzos',
    image: foodImage,
    logo: logoImage,
    tags: ['Rapido', 'Economico'],
    menu: [
      { id: 4, name: 'Nuggets con papa', description: 'Nuggets acompanados con papas.', price: 2.5, available: true },
      { id: 5, name: 'Sanduche Romano', description: 'Sanduche preparado para comer en campus.', price: 2.5, available: true },
      { id: 6, name: 'Desgranado', description: 'Desgranado sencillo servido al momento.', price: 1.5, available: true }
    ]
  },
  {
    id: 'piedra-negra',
    name: 'Piedra Negra',
    category: 'Cafe - Reposteria',
    image: foodImage,
    logo: logoImage,
    tags: ['Cafe', 'Dulces'],
    menu: [
      { id: 7, name: 'Ice latte', description: 'Cafe frio con leche y hielo.', price: 2.5, available: true },
      { id: 8, name: 'Dona', description: 'Dona dulce para acompanar cafe.', price: 1, available: true },
      { id: 9, name: 'Americano', description: 'Cafe americano caliente.', price: 1.5, available: true }
    ]
  }
];

