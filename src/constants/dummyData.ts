import { Dish, MenuSection, Kitchen, Unit, DishComponent } from '../types';

// --- Dummy Units (used for populating data) ---
const dummyUnits: { [key: string]: Unit } = {
  g: { unit_id: 'g', unit_name: 'gram', system: 'metric', abbreviation: 'g' },
  kg: { unit_id: 'kg', unit_name: 'kilogram', system: 'metric', abbreviation: 'kg' },
  tsp: { unit_id: 'tsp', unit_name: 'teaspoon', system: 'imperial', abbreviation: 'tsp' },
  count: { unit_id: 'x', unit_name: 'count', system: null, abbreviation: 'x' },
  ml: { unit_id: 'ml', unit_name: 'milliliter', system: 'metric', abbreviation: 'ml' },
  tbsp: { unit_id: 'tbsp', unit_name: 'tablespoon', system: 'imperial', abbreviation: 'tbsp' },
};

// --- Dummy Menu Sections ---
export const DUMMY_SECTIONS: MenuSection[] = [
  {
    menu_section_id: 'ms1',
    name: 'Mains',
    kitchen_id: 'k1'
  },
  {
    menu_section_id: 'ms2',
    name: 'Starters',
    kitchen_id: 'k1'
  },
  {
    menu_section_id: 'ms3',
    name: 'Pastry',
    kitchen_id: 'k1'
  },
];

// --- Dummy Ingredients/Components (Partial representation) ---
const createComponent = (dishId: string, ingId: string, name: string, amount: number, unitKey: string, isPrep: boolean = false): DishComponent => ({
  dish_id: dishId,
  ingredient_id: ingId,
  name: name,
  amount: amount,
  unit: dummyUnits[unitKey] || dummyUnits.count,
  isPreparation: isPrep,
  preparationDetails: null, // Simplified for dummy data
  rawIngredientDetails: null // Simplified for dummy data
});

// --- Dummy Dishes ---
export const DUMMY_DISHES: Dish[] = [
  {
    dish_id: 'd1',
    dish_name: 'Spaghetti Carbonara',
    menu_section: DUMMY_SECTIONS[0],
    directions: 
      'Boil the spaghetti in salted water according to package instructions.\n' +
      'While pasta cooks, fry the pancetta in a large pan until crispy.\n' +
      'In a bowl, mix eggs, grated parmesan, salt, and pepper.\n' +
      'Drain pasta, reserving a small cup of pasta water.\n' +
      'Add hot pasta to the pancetta, remove from heat.\n' +
      'Quickly stir in the egg mixture, adding pasta water if needed to create a creamy sauce.\n' +
      'Serve immediately with extra parmesan and black pepper.',
    total_time: '00:25:00', // Example interval format
    serving_size: 1,
    serving_unit: dummyUnits.count, // Assuming serving unit is 'count'
    num_servings: 4,
    components: [
      createComponent('d1', 'ing1', 'Spaghetti', 400, 'g'),
      createComponent('d1', 'ing2', 'Pancetta', 200, 'g'),
      createComponent('d1', 'ing3', 'Eggs', 3, 'count'),
      createComponent('d1', 'ing4', 'Parmesan cheese', 50, 'g'),
      createComponent('d1', 'ing5', 'Black pepper', 1, 'tsp'),
      createComponent('d1', 'ing6', 'Salt', 1, 'tsp'),
    ],
    cooking_notes: null,
    imageUrl: 'https://via.placeholder.com/150/771796',
  },
  {
    dish_id: 'd2',
    dish_name: 'Chicken Caesar Salad',
    menu_section: DUMMY_SECTIONS[0],
    directions: 
      'Season chicken breasts with salt and pepper.\n' +
      'Grill chicken until cooked through, about 6-7 minutes per side.\n' +
      'Allow chicken to rest 5 minutes, then slice.\n' +
      'Wash and chop the romaine lettuce.\n' +
      'Assemble the salad by placing lettuce in a large bowl.\n' +
      'Add sliced chicken, grated parmesan, and croutons.\n' +
      'Drizzle with Caesar dressing and toss before serving.',
    total_time: '00:30:00', 
    serving_size: 1, 
    serving_unit: dummyUnits.count,
    num_servings: 2,
    components: [
      createComponent('d2', 'ing7', 'Chicken breast', 400, 'g'),
      createComponent('d2', 'ing8', 'Romaine lettuce', 1, 'count'),
      createComponent('d2', 'ing4', 'Parmesan cheese', 50, 'g'), // Re-use ID
      createComponent('d2', 'ing9', 'Croutons', 100, 'g'),
      createComponent('d2', 'prep1', 'Caesar Dressing', 60, 'ml', true) // Example Prep
    ],
    cooking_notes: 'Great for lunch.',
    imageUrl: 'https://via.placeholder.com/150/24f355',
  },
  {
    dish_id: 'd3',
    dish_name: 'Tomato Soup',
    menu_section: DUMMY_SECTIONS[1], // Starter
    directions: 
      'Heat oil in a large pot over medium heat.\n' +
      'Add chopped onion and cook until softened, about 5 minutes.\n' +
      'Add minced garlic and cook for another minute.\n' +
      'Add chopped tomatoes and cook for 5 minutes.\n' +
      'Pour in vegetable stock and bring to a boil.\n' +
      'Reduce heat and simmer for 15 minutes.\n' +
      'Add basil leaves and blend until smooth.\n' +
      'Season with salt and pepper to taste.\n' +
      'Serve hot with a drizzle of olive oil and fresh basil.',
    total_time: '00:35:00',
    serving_size: 250, 
    serving_unit: dummyUnits.ml, 
    num_servings: 4,
    components: [
      createComponent('d3', 'ing10', 'Tomatoes', 1, 'kg'),
      createComponent('d3', 'ing11', 'Onion', 1, 'count'),
      createComponent('d3', 'ing12', 'Garlic', 2, 'count'),
      createComponent('d3', 'ing13', 'Vegetable stock', 500, 'ml'),
      createComponent('d3', 'ing14', 'Olive oil', 2, 'tbsp'),
      createComponent('d3', 'ing15', 'Basil leaves', 5, 'count'),
    ],
    cooking_notes: 'Best served with grilled cheese.',
    imageUrl: 'https://via.placeholder.com/150/f66b97',
  },
  // Add more dishes as needed, following the new structure
];

// --- Dummy Kitchens ---
export const DUMMY_KITCHENS: Kitchen[] = [
  {
    kitchen_id: 'k1',
    name: 'Main Restaurant',
    location: 'Downtown',
  },
  {
    kitchen_id: 'k2',
    name: 'Catering Center',
    location: 'Industrial District',
  },
];