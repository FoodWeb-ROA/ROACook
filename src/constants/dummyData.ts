import { Recipe, Category, Kitchen } from '../types';

export const CATEGORIES: Category[] = [
  {
    id: '1',
    name: 'Mains',
    icon: 'food-variant',
  },
  {
    id: '2',
    name: 'Starters',
    icon: 'silverware-fork-knife',
  },
  {
    id: '3',
    name: 'Pastry',
    icon: 'cake-variant',
  },
  {
    id: '4',
    name: 'Desserts',
    icon: 'ice-cream',
  },
  {
    id: '5',
    name: 'Soups',
    icon: 'bowl-mix',
  },
  {
    id: '6',
    name: 'Salads',
    icon: 'food-apple',
  },
];

export const RECIPES: Recipe[] = [
  {
    id: '1',
    name: 'Spaghetti Carbonara',
    category: '1',
    ingredients: [
      { id: '1', name: 'Spaghetti', quantity: 400, unit: 'g' },
      { id: '2', name: 'Pancetta', quantity: 200, unit: 'g' },
      { id: '3', name: 'Eggs', quantity: 3, unit: 'count' },
      { id: '4', name: 'Parmesan cheese', quantity: 50, unit: 'g' },
      { id: '5', name: 'Black pepper', quantity: 1, unit: 'tsp' },
      { id: '6', name: 'Salt', quantity: 1, unit: 'tsp' },
    ],
    instructions: [
      'Boil the spaghetti in salted water according to package instructions.',
      'While pasta cooks, fry the pancetta in a large pan until crispy.',
      'In a bowl, mix eggs, grated parmesan, salt, and pepper.',
      'Drain pasta, reserving a small cup of pasta water.',
      'Add hot pasta to the pancetta, remove from heat.',
      'Quickly stir in the egg mixture, adding pasta water if needed to create a creamy sauce.',
      'Serve immediately with extra parmesan and black pepper.'
    ],
    prepTime: 10,
    cookTime: 15,
    servings: 4,
    imageUrl: 'https://example.com/carbonara.jpg',
  },
  {
    id: '2',
    name: 'Chocolate Soufflé',
    category: '3',
    ingredients: [
      { id: '1', name: 'Dark chocolate', quantity: 150, unit: 'g' },
      { id: '2', name: 'Butter', quantity: 50, unit: 'g' },
      { id: '3', name: 'Eggs', quantity: 4, unit: 'count' },
      { id: '4', name: 'Sugar', quantity: 100, unit: 'g' },
      { id: '5', name: 'Flour', quantity: 2, unit: 'tbsp' },
    ],
    instructions: [
      'Preheat oven to 190°C/375°F.',
      'Butter and sugar 4 ramekins.',
      'Melt chocolate and butter together in a heatproof bowl over simmering water.',
      'Separate eggs. Whisk yolks with half the sugar, then mix into chocolate.',
      'Beat egg whites until foamy, gradually add remaining sugar and beat until stiff peaks form.',
      'Fold egg whites into chocolate mixture, one-third at a time.',
      'Divide mixture between ramekins and bake for 12-14 minutes.',
      'Serve immediately with powdered sugar on top.'
    ],
    prepTime: 20,
    cookTime: 12,
    servings: 4,
    imageUrl: 'https://example.com/chocolate-souffle.jpg',
  },
  {
    id: '3',
    name: 'Chicken Caesar Salad',
    category: '6',
    ingredients: [
      { id: '1', name: 'Chicken breast', quantity: 400, unit: 'g' },
      { id: '2', name: 'Romaine lettuce', quantity: 1, unit: 'count' },
      { id: '3', name: 'Parmesan cheese', quantity: 50, unit: 'g' },
      { id: '4', name: 'Croutons', quantity: 100, unit: 'g' },
      { id: '5', name: 'Caesar dressing', quantity: 60, unit: 'ml' },
    ],
    instructions: [
      'Season chicken breasts with salt and pepper.',
      'Grill chicken until cooked through, about 6-7 minutes per side.',
      'Allow chicken to rest 5 minutes, then slice.',
      'Wash and chop the romaine lettuce.',
      'Assemble the salad by placing lettuce in a large bowl.',
      'Add sliced chicken, grated parmesan, and croutons.',
      'Drizzle with Caesar dressing and toss before serving.'
    ],
    prepTime: 15,
    cookTime: 15,
    servings: 2,
    imageUrl: 'https://example.com/caesar-salad.jpg',
  },
  {
    id: '4',
    name: 'Tomato Soup',
    category: '5',
    ingredients: [
      { id: '1', name: 'Tomatoes', quantity: 1, unit: 'kg' },
      { id: '2', name: 'Onion', quantity: 1, unit: 'count' },
      { id: '3', name: 'Garlic', quantity: 2, unit: 'count' },
      { id: '4', name: 'Vegetable stock', quantity: 500, unit: 'ml' },
      { id: '5', name: 'Olive oil', quantity: 2, unit: 'tbsp' },
      { id: '6', name: 'Basil leaves', quantity: 5, unit: 'count' },
    ],
    instructions: [
      'Heat oil in a large pot over medium heat.',
      'Add chopped onion and cook until softened, about 5 minutes.',
      'Add minced garlic and cook for another minute.',
      'Add chopped tomatoes and cook for 5 minutes.',
      'Pour in vegetable stock and bring to a boil.',
      'Reduce heat and simmer for 15 minutes.',
      'Add basil leaves and blend until smooth.',
      'Season with salt and pepper to taste.',
      'Serve hot with a drizzle of olive oil and fresh basil.'
    ],
    prepTime: 10,
    cookTime: 25,
    servings: 4,
    imageUrl: 'https://example.com/tomato-soup.jpg',
  },
  {
    id: '5',
    name: 'Beef Wellington',
    category: '1',
    ingredients: [
      { id: '1', name: 'Beef tenderloin', quantity: 900, unit: 'g' },
      { id: '2', name: 'Puff pastry', quantity: 500, unit: 'g' },
      { id: '3', name: 'Mushrooms', quantity: 400, unit: 'g' },
      { id: '4', name: 'Prosciutto', quantity: 100, unit: 'g' },
      { id: '5', name: 'Dijon mustard', quantity: 2, unit: 'tbsp' },
      { id: '6', name: 'Egg', quantity: 1, unit: 'count' },
    ],
    instructions: [
      'Season beef with salt and pepper, then sear on all sides in a hot pan.',
      'Let the beef cool, then brush with Dijon mustard.',
      'Finely chop mushrooms and cook until all moisture evaporates.',
      'Lay out prosciutto slices, spread mushroom mixture on top, place beef in center.',
      'Wrap the beef tightly in the prosciutto and mushroom mixture.',
      'Roll out puff pastry, place beef in center, and wrap completely.',
      'Brush with beaten egg and chill for 30 minutes.',
      'Bake at 200°C/400°F for 25-30 minutes for medium-rare.',
      'Rest for 10 minutes before slicing and serving.'
    ],
    prepTime: 45,
    cookTime: 30,
    servings: 6,
    imageUrl: 'https://example.com/beef-wellington.jpg',
  }
];

export const KITCHENS: Kitchen[] = [
  {
    id: '1',
    name: 'Main Restaurant',
    location: 'Downtown',
  },
  {
    id: '2',
    name: 'Catering Center',
    location: 'Industrial District',
  },
  {
    id: '3',
    name: 'Beach Location',
    location: 'Seaside Boulevard',
  },
];