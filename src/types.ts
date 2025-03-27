export type Recipe = {
  id: string;
  name: string;
  category: string;
  ingredients: Ingredient[];
  instructions: string[];
  imageUrl?: string;
  prepTime: number;
  cookTime: number;
  servings: number;
  preparations?: Preparation[];
  isDeleted?: boolean;
};

export type Preparation = {
  id: string;
  name: string;
  ingredients: Ingredient[];
  instructions: string[];
  prepTime: number;
  cookTime: number;
  servings: number;
  imageUrl?: string;
};

export type Ingredient = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
};

export type Category = {
  id: string;
  name: string;
  icon: string;
};

export type Kitchen = {
  id: string;
  name: string;
  location: string;
};

export type MeasurementUnit = 'g' | 'kg' | 'ml' | 'l' | 'tbsp' | 'tsp' | 'cup' | 'oz' | 'lb' | 'count';