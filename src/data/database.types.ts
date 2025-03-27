export type Database = {
  public: {
    Tables: {
      base_units: {
        Row: {
          id: number;
          name: string;
        };
        Insert: {
          id?: number;
          name: string;
        };
        Update: {
          id?: number;
          name?: string;
        };
      };
      ingredients: {
        Row: {
          ingredient_id: number;
          user_id: number;
          name: string;
          inventory_amount: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          ingredient_id?: number;
          user_id: number;
          name: string;
          inventory_amount?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          ingredient_id?: number;
          user_id?: number;
          name?: string;
          inventory_amount?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      menu_section: {
        Row: {
          menu_section_id: number;
          name: string;
        };
        Insert: {
          menu_section_id?: number;
          name: string;
        };
        Update: {
          menu_section_id?: number;
          name?: string;
        };
      };
      preparation_ingredients: {
        Row: {
          preparation_id: number;
          ingredient_id: number;
          amount: number;
        };
        Insert: {
          preparation_id: number;
          ingredient_id: number;
          amount: number;
        };
        Update: {
          preparation_id?: number;
          ingredient_id?: number;
          amount?: number;
        };
      };
      preparations: {
        Row: {
          preparation_id: number;
          ingredient_id: number;
          amount: number;
          amount_unit: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          preparation_id?: number;
          ingredient_id: number;
          amount: number;
          amount_unit: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          preparation_id?: number;
          ingredient_id?: number;
          amount?: number;
          amount_unit?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      recipe: {
        Row: {
          recipe_id: number;
          menu_section_id: number;
          recipe_name: string;
          prep_time: number;
          total_time: number;
          cook_time: number;
          rest_time: number;
          servings: number;
          cooking_notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          recipe_id?: number;
          menu_section_id: number;
          recipe_name: string;
          prep_time: number;
          total_time: number;
          cook_time: number;
          rest_time: number;
          servings: number;
          cooking_notes: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          recipe_id?: number;
          menu_section_id?: number;
          recipe_name?: string;
          prep_time?: number;
          total_time?: number;
          cook_time?: number;
          rest_time?: number;
          servings?: number;
          cooking_notes?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      recipe_ingredients: {
        Row: {
          recipe_id: number;
          ingredient_id: number;
          amount: number;
        };
        Insert: {
          recipe_id: number;
          ingredient_id: number;
          amount: number;
        };
        Update: {
          recipe_id?: number;
          ingredient_id?: number;
          amount?: number;
        };
      };
      recipe_preparations: {
        Row: {
          recipe_id: number;
          preparation_id: number;
          amount: number;
        };
        Insert: {
          recipe_id: number;
          preparation_id: number;
          amount: number;
        };
        Update: {
          recipe_id?: number;
          preparation_id?: number;
          amount?: number;
        };
      };
      user_types: {
        Row: {
          id: number;
          name: string;
        };
        Insert: {
          id?: number;
          name: string;
        };
        Update: {
          id?: number;
          name?: string;
        };
      };
      users: {
        Row: {
          id: number;
          uuid: string;
          username: string;
          email: string;
          user_type_id: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          uuid: string;
          username: string;
          email: string;
          user_type_id: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          uuid?: string;
          username?: string;
          email?: string;
          user_type_id?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}; 