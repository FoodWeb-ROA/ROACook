export type Database = {
  public: {
    Tables: {
      units: {
        Row: {
          unit_id: string;
          unit_name: string;
          system: string;
        };
        Insert: {
          unit_id?: string;
          unit_name: string;
          system: string;
        };
        Update: {
          unit_id?: string;
          unit_name?: string;
          system?: string;
        };
      };
      ingredients: {
        Row: {
          ingredient_id: string;
          name: string;
        };
        Insert: {
          ingredient_id?: string;
          name: string;
        };
        Update: {
          ingredient_id?: string;
          name?: string;
        };
      };
      menu_section: {
        Row: {
          menu_section_id: string;
          name: string;
        };
        Insert: {
          menu_section_id?: string;
          name: string;
        };
        Update: {
          menu_section_id?: string;
          name?: string;
        };
      };
      recipe: {
        Row: {
          recipe_id: string;
          menu_section_id: string;
          recipe_name: string;
          directions: string;
          prep_time: string;
          total_time: string;
          rest_time: string;
          servings: string;
          cooking_notes: string;
        };
        Insert: {
          recipe_id?: string;
          menu_section_id: string;
          recipe_name: string;
          directions: string;
          prep_time: string;
          total_time: string;
          rest_time: string;
          servings: string;
          cooking_notes: string;
        };
        Update: {
          recipe_id?: string;
          menu_section_id?: string;
          recipe_name?: string;
          directions?: string;
          prep_time?: string;
          total_time?: string;
          rest_time?: string;
          servings?: string;
          cooking_notes?: string;
        };
      };
      recipe_ingredients: {
        Row: {
          recipe_id: string;
          ingredient_id: string;
          amount: number;
          unit_id: string;
        };
        Insert: {
          recipe_id: string;
          ingredient_id: string;
          amount: number;
          unit_id: string;
        };
        Update: {
          recipe_id?: string;
          ingredient_id?: string;
          amount?: number;
          unit_id?: string;
        };
      };
      recipe_preparations: {
        Row: {
          recipe_id: string;
          preparation_id: string;
          amount: number;
          unit_id: string;
        };
        Insert: {
          recipe_id: string;
          preparation_id: string;
          amount: number;
          unit_id: string;
        };
        Update: {
          recipe_id?: string;
          preparation_id?: string;
          amount?: number;
          unit_id?: string;
        };
      };
      preparations: {
        Row: {
          preparation_id: string;
          preparation_name: string;
          directions: string;
          prep_time: string;
          total_time: string;
          rest_time: string;
          servings: string;
          cooking_notes: string;
        };
        Insert: {
          preparation_id?: string;
          preparation_name: string;
          directions: string;
          prep_time: string;
          total_time: string;
          rest_time: string;
          servings: string;
          cooking_notes: string;
        };
        Update: {
          preparation_id?: string;
          preparation_name?: string;
          directions?: string;
          prep_time?: string;
          total_time?: string;
          rest_time?: string;
          servings?: string;
          cooking_notes?: string;
        };
      };
      preparation_ingredients: {
        Row: {
          preparation_id: string;
          ingredient_id: string;
          amount: number;
          unit_id: string;
        };
        Insert: {
          preparation_id: string;
          ingredient_id: string;
          amount: number;
          unit_id: string;
        };
        Update: {
          preparation_id?: string;
          ingredient_id?: string;
          amount?: number;
          unit_id?: string;
        };
      };
      kitchens: {
        Row: {
          kitchen_id: string;
          name: string;
          location: string;
        };
        Insert: {
          kitchen_id?: string;
          name: string;
          location: string;
        };
        Update: {
          kitchen_id?: string;
          name?: string;
          location?: string;
        };
      };
      kitchen_members: {
        Row: {
          kitchen_id: string;
          user_id: string;
          role: string;
        };
        Insert: {
          kitchen_id: string;
          user_id: string;
          role: string;
        };
        Update: {
          kitchen_id?: string;
          user_id?: string;
          role?: string;
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