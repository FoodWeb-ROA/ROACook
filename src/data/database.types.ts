export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      dish_components: {
        Row: {
          amount: number | null
          created_at: string | null
          deleted: boolean | null
          dish_id: string
          ingredient_id: string
          piece_type: string | null
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          deleted?: boolean | null
          dish_id: string
          ingredient_id: string
          piece_type?: string | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          deleted?: boolean | null
          dish_id?: string
          ingredient_id?: string
          piece_type?: string | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dish_ingredients_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "fk_components_dish"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "fk_components_ing"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "fk_components_unit"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "recipe_ingredients_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["unit_id"]
          },
        ]
      }
      dishes: {
        Row: {
          cooking_notes: string | null
          created_at: string | null
          deleted: boolean | null
          directions: string | null
          dish_id: string
          dish_name: string
          img_url: string | null
          kitchen_id: string
          menu_section_id: string | null
          num_servings: number | null
          serving_item: string | null
          serving_size: number
          serving_unit_id: string
          total_time: unknown
          updated_at: string | null
        }
        Insert: {
          cooking_notes?: string | null
          created_at?: string | null
          deleted?: boolean | null
          directions?: string | null
          dish_id?: string
          dish_name: string
          img_url?: string | null
          kitchen_id: string
          menu_section_id?: string | null
          num_servings?: number | null
          serving_item?: string | null
          serving_size?: number
          serving_unit_id: string
          total_time?: unknown
          updated_at?: string | null
        }
        Update: {
          cooking_notes?: string | null
          created_at?: string | null
          deleted?: boolean | null
          directions?: string | null
          dish_id?: string
          dish_name?: string
          img_url?: string | null
          kitchen_id?: string
          menu_section_id?: string | null
          num_servings?: number | null
          serving_item?: string | null
          serving_size?: number
          serving_unit_id?: string
          total_time?: unknown
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dishes_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchen"
            referencedColumns: ["kitchen_id"]
          },
          {
            foreignKeyName: "dishes_serving_unit_fkey"
            columns: ["serving_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "fk_dishes_unit"
            columns: ["serving_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "recipe_menu_section_id_fkey"
            columns: ["menu_section_id"]
            isOneToOne: false
            referencedRelation: "menu_section"
            referencedColumns: ["menu_section_id"]
          },
        ]
      }
      ingredients: {
        Row: {
          amount: number
          cooking_notes: string | null
          created_at: string
          deleted: boolean | null
          ingredient_id: string
          kitchen_id: string
          name: string
          storage_location: string | null
          synonyms: string[] | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          cooking_notes?: string | null
          created_at?: string
          deleted?: boolean | null
          ingredient_id?: string
          kitchen_id?: string
          name: string
          storage_location?: string | null
          synonyms?: string[] | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cooking_notes?: string | null
          created_at?: string
          deleted?: boolean | null
          ingredient_id?: string
          kitchen_id?: string
          name?: string
          storage_location?: string | null
          synonyms?: string[] | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchen"
            referencedColumns: ["kitchen_id"]
          },
          {
            foreignKeyName: "ingredients_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["unit_id"]
          },
        ]
      }
      kitchen: {
        Row: {
          kitchen_id: string
          name: string
        }
        Insert: {
          kitchen_id?: string
          name?: string
        }
        Update: {
          kitchen_id?: string
          name?: string
        }
        Relationships: []
      }
      kitchen_users: {
        Row: {
          kitchen_id: string
          user_id: string
        }
        Insert: {
          kitchen_id: string
          user_id: string
        }
        Update: {
          kitchen_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_users_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchen"
            referencedColumns: ["kitchen_id"]
          },
        ]
      }
      languages: {
        Row: {
          ISO_Code: string
          name_english: string
          name_in_language: string
        }
        Insert: {
          ISO_Code: string
          name_english?: string
          name_in_language: string
        }
        Update: {
          ISO_Code?: string
          name_english?: string
          name_in_language?: string
        }
        Relationships: []
      }
      menu_section: {
        Row: {
          kitchen_id: string
          menu_section_id: string
          name: string
        }
        Insert: {
          kitchen_id: string
          menu_section_id?: string
          name: string
        }
        Update: {
          kitchen_id?: string
          menu_section_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_section_kitchen_id_fkey"
            columns: ["kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchen"
            referencedColumns: ["kitchen_id"]
          },
        ]
      }
      preparation_ingredients: {
        Row: {
          amount: number | null
          created_at: string | null
          deleted: boolean | null
          ingredient_id: string
          preparation_id: string
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          deleted?: boolean | null
          ingredient_id: string
          preparation_id: string
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          deleted?: boolean | null
          ingredient_id?: string
          preparation_id?: string
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_prep_ingredients_ing"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "fk_prep_ingredients_prep"
            columns: ["preparation_id"]
            isOneToOne: false
            referencedRelation: "preparations"
            referencedColumns: ["preparation_id"]
          },
          {
            foreignKeyName: "fk_prep_ingredients_unit"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "preparation_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "preparation_ingredients_preparation_id_fkey"
            columns: ["preparation_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["ingredient_id"]
          },
          {
            foreignKeyName: "preparation_ingredients_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["unit_id"]
          },
        ]
      }
      preparations: {
        Row: {
          amount_unit_id: string | null
          created_at: string | null
          deleted: boolean | null
          directions: string
          fingerprint: string | null
          preparation_id: string
          total_time: number | null
          updated_at: string | null
        }
        Insert: {
          amount_unit_id?: string | null
          created_at?: string | null
          deleted?: boolean | null
          directions: string
          fingerprint?: string | null
          preparation_id: string
          total_time?: number | null
          updated_at?: string | null
        }
        Update: {
          amount_unit_id?: string | null
          created_at?: string | null
          deleted?: boolean | null
          directions?: string
          fingerprint?: string | null
          preparation_id?: string
          total_time?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preparations_amount_unit_id_fkey"
            columns: ["amount_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "preparations_preparation_id_fkey"
            columns: ["preparation_id"]
            isOneToOne: true
            referencedRelation: "ingredients"
            referencedColumns: ["ingredient_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      units: {
        Row: {
          abbreviation: string | null
          system: Database["public"]["Enums"]["unit_system"] | null
          unit_id: string
          unit_name: string
        }
        Insert: {
          abbreviation?: string | null
          system?: Database["public"]["Enums"]["unit_system"] | null
          unit_id?: string
          unit_name: string
        }
        Update: {
          abbreviation?: string | null
          system?: Database["public"]["Enums"]["unit_system"] | null
          unit_id?: string
          unit_name?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          updated_at: string
          user_email: string | null
          user_fullname: string | null
          user_id: string
          user_language: string | null
        }
        Insert: {
          created_at?: string
          updated_at?: string
          user_email?: string | null
          user_fullname?: string | null
          user_id: string
          user_language?: string | null
        }
        Update: {
          created_at?: string
          updated_at?: string
          user_email?: string | null
          user_fullname?: string | null
          user_id?: string
          user_language?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_user_language_fkey"
            columns: ["user_language"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["ISO_Code"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_dish: {
        Args: { p_dish_id: string }
        Returns: undefined
      }
      delete_preparation: {
        Args: { p_preparation_id: string }
        Returns: undefined
      }
    }
    Enums: {
      IngredientType: "Preparation" | "RawIngredient"
      unit_system: "metric" | "imperial"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      IngredientType: ["Preparation", "RawIngredient"],
      unit_system: ["metric", "imperial"],
    },
  },
} as const