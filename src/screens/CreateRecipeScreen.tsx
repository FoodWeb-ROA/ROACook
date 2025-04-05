import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';
import { RootStackParamList } from '../navigation/types';
import { supabase } from '../data/supabaseClient';
import { useMenuSections } from '../hooks/useSupabase';
import { Picker } from '@react-native-picker/picker';

type CreateRecipeNavigationProp = StackNavigationProp<RootStackParamList>;

type Ingredient = {
  id: string;
  name: string;
  amount: string;
  unit_id: string;
};

const CreateRecipeScreen = () => {
  const navigation = useNavigation<CreateRecipeNavigationProp>();
  const { menuSections, loading: loadingSections } = useMenuSections();

  // Recipe form state
  const [recipe, setRecipe] = useState({
    recipe_name: '',
    menu_section_id: '',
    directions: '',
    prep_time: '',
    total_time: '',
    rest_time: '',
    servings: '',
    cooking_notes: '',
  });

  // Ingredients
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { id: '1', name: '', amount: '', unit_id: '1' }, // Start with one empty ingredient
  ]);

  // Units for dropdown
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Fetch units from the database
    const fetchUnits = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('units')
          .select('*')
          .order('unit_name');

        if (error) throw error;
        setUnits(data || []);
      } catch (error) {
        console.error('Error fetching units:', error);
        Alert.alert('Error', 'Failed to load units. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchUnits();
  }, []);

  // Handle form input changes
  const handleChange = (name: string, value: string) => {
    setRecipe(prev => ({ ...prev, [name]: value }));
  };

  // Handle ingredient changes
  const handleIngredientChange = (id: string, field: string, value: string) => {
    setIngredients(prevIngredients =>
      prevIngredients.map(ing =>
        ing.id === id ? { ...ing, [field]: value } : ing
      )
    );
  };

  // Add a new ingredient row
  const addIngredient = () => {
    setIngredients(prev => [
      ...prev,
      { id: Date.now().toString(), name: '', amount: '', unit_id: '1' },
    ]);
  };

  // Remove an ingredient
  const removeIngredient = (id: string) => {
    if (ingredients.length > 1) {
      setIngredients(prevIngredients =>
        prevIngredients.filter(ing => ing.id !== id)
      );
    }
  };

  // Submit the form
  const handleSubmit = async () => {
    // Basic validation
    if (!recipe.recipe_name.trim()) {
      Alert.alert('Error', 'Recipe name is required');
      return;
    }

    if (!recipe.menu_section_id) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    setSubmitting(true);

    try {
      // Step 1: Insert the recipe
      const { data: recipeData, error: recipeError } = await supabase
        .from('recipe')
        .insert({
          recipe_name: recipe.recipe_name,
          menu_section_id: recipe.menu_section_id,
          directions: recipe.directions,
          prep_time: recipe.prep_time ? parseInt(recipe.prep_time) : 0,
          total_time: recipe.total_time ? parseInt(recipe.total_time) : 0,
          rest_time: recipe.rest_time ? parseInt(recipe.rest_time) : 0,
          servings: recipe.servings ? parseInt(recipe.servings) : 0,
          cooking_notes: recipe.cooking_notes,
        })
        .select('recipe_id')
        .single();

      if (recipeError) throw recipeError;

      // Step 2: Add ingredients (filter out empty ones)
      const validIngredients = ingredients.filter(ing => ing.name.trim() !== '');
      
      if (validIngredients.length > 0) {
        // Find or create ingredients and then add recipe_ingredients relationships
        for (const ing of validIngredients) {
          // First, see if the ingredient already exists
          let { data: existingIng, error: searchError } = await supabase
            .from('ingredients')
            .select('ingredient_id')
            .eq('name', ing.name.trim())
            .maybeSingle();

          if (searchError) throw searchError;

          let ingredientId;
          
          if (!existingIng) {
            // Create the ingredient if it doesn't exist
            const { data: newIng, error: createError } = await supabase
              .from('ingredients')
              .insert({ name: ing.name.trim() })
              .select('ingredient_id')
              .single();

            if (createError) throw createError;
            ingredientId = newIng.ingredient_id;
          } else {
            ingredientId = existingIng.ingredient_id;
          }

          // Add the relationship
          const { error: relError } = await supabase
            .from('recipe_ingredients')
            .insert({
              recipe_id: recipeData.recipe_id,
              ingredient_id: ingredientId,
              amount: ing.amount ? parseFloat(ing.amount) : 0,
              unit_id: String(ing.unit_id),
            });

          if (relError) throw relError;
        }
      }

      Alert.alert(
        'Success!',
        'Recipe created successfully',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('RecipeDetails', { recipeId: recipeData.recipe_id }),
          },
        ]
      );
    } catch (error) {
      console.error('Error creating recipe:', error);
      Alert.alert('Error', 'Failed to create recipe. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || loadingSections) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <View style={styles.container}>
        <StatusBar style="dark" />

        <ScrollView style={styles.scrollView}>
          <View style={styles.formContainer}>
            <Text style={styles.label}>Recipe Name *</Text>
            <TextInput
              style={styles.input}
              value={recipe.recipe_name}
              onChangeText={value => handleChange('recipe_name', value)}
              placeholder="Enter recipe name"
              placeholderTextColor={COLORS.placeholder}
            />

            <Text style={[styles.label, { marginTop: SIZES.padding * 5 }]}>Category *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={recipe.menu_section_id}
                onValueChange={(value: string) => handleChange('menu_section_id', value)}
                style={styles.picker}
                dropdownIconColor={COLORS.white}
              >
                <Picker.Item label="Select a category" value="" />
                {menuSections.map(section => (
                  <Picker.Item 
                    key={section.menu_section_id} 
                    label={section.name} 
                    value={String(section.menu_section_id)} 
                  />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>Ingredients</Text>
            {ingredients.map((ingredient, index) => (
              <View key={ingredient.id} style={styles.ingredientRow}>
                <TextInput
                  style={[styles.input, styles.ingredientNameInput]}
                  value={ingredient.name}
                  onChangeText={value => handleIngredientChange(ingredient.id, 'name', value)}
                  placeholder="Ingredient name"
                  placeholderTextColor={COLORS.placeholder}
                />
                
                <TextInput
                  style={[styles.input, styles.amountInput]}
                  value={ingredient.amount}
                  onChangeText={value => handleIngredientChange(ingredient.id, 'amount', value)}
                  placeholder="Amount"
                  placeholderTextColor={COLORS.placeholder}
                  keyboardType="numeric"
                />
                
                <View style={styles.unitPickerContainer}>
                  <Picker
                    selectedValue={ingredient.unit_id}
                    onValueChange={(value: string) => handleIngredientChange(ingredient.id, 'unit_id', value)}
                    style={styles.unitPicker}
                    dropdownIconColor={COLORS.white}
                  >
                    {units.map(unit => (
                      <Picker.Item 
                        key={unit.unit_id} 
                        label={unit.unit_name} 
                        value={String(unit.unit_id)}
                      />
                    ))}
                  </Picker>
                </View>
                
                <TouchableOpacity 
                  style={styles.removeButton}
                  onPress={() => removeIngredient(ingredient.id)}
                  disabled={ingredients.length === 1}
                >
                  <MaterialCommunityIcons 
                    name="minus-circle" 
                    size={24} 
                    color={ingredients.length === 1 ? COLORS.disabled : COLORS.error} 
                  />
                </TouchableOpacity>
              </View>
            ))}
            
            <TouchableOpacity style={styles.addButton} onPress={addIngredient}>
              <MaterialCommunityIcons name="plus-circle" size={20} color={COLORS.white} />
              <Text style={styles.addButtonText}>Add Ingredient</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Directions</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={recipe.directions}
              onChangeText={value => handleChange('directions', value)}
              placeholder="Enter step-by-step directions"
              placeholderTextColor={COLORS.placeholder}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            <View style={styles.timeInputsContainer}>
              <View style={styles.timeInput}>
                <Text style={styles.label}>Prep Time (min)</Text>
                <TextInput
                  style={styles.input}
                  value={recipe.prep_time}
                  onChangeText={value => handleChange('prep_time', value)}
                  placeholder="0"
                  placeholderTextColor={COLORS.placeholder}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.timeInput}>
                <Text style={styles.label}>Total Time (min)</Text>
                <TextInput
                  style={styles.input}
                  value={recipe.total_time}
                  onChangeText={value => handleChange('total_time', value)}
                  placeholder="0"
                  placeholderTextColor={COLORS.placeholder}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.timeInput}>
                <Text style={styles.label}>Rest Time (min)</Text>
                <TextInput
                  style={styles.input}
                  value={recipe.rest_time}
                  onChangeText={value => handleChange('rest_time', value)}
                  placeholder="0"
                  placeholderTextColor={COLORS.placeholder}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={styles.label}>Servings</Text>
            <TextInput
              style={styles.input}
              value={recipe.servings}
              onChangeText={value => handleChange('servings', value)}
              placeholder="Number of servings"
              placeholderTextColor={COLORS.placeholder}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Cooking Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={recipe.cooking_notes}
              onChangeText={value => handleChange('cooking_notes', value)}
              placeholder="Additional notes, tips, or variations"
              placeholderTextColor={COLORS.placeholder}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.submitButtonText}>Create Recipe</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  formContainer: {
    padding: SIZES.padding * 2,
  },
  label: {
    ...FONTS.body2,
    color: COLORS.white,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    color: COLORS.white,
    ...FONTS.body3,
    marginBottom: 8,
  },
  textArea: {
    minHeight: 100,
  },
  pickerContainer: {
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius,
    marginBottom: 16,
    overflow: 'hidden',
  },
  picker: {
    color: COLORS.white,
    height: 50,
  },
  timeInputsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeInput: {
    flex: 1,
    marginHorizontal: 4,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ingredientNameInput: {
    flex: 3,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    marginRight: 8,
  },
  unitPickerContainer: {
    flex: 1.5,
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius,
    marginRight: 8,
    overflow: 'hidden',
    height: 50,
    justifyContent: 'center',
  },
  unitPicker: {
    color: COLORS.white,
    height: 50,
  },
  removeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginTop: 8,
    marginBottom: 16,
  },
  addButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
    marginLeft: 8,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    padding: SIZES.padding * 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 40,
    ...SHADOWS.medium,
  },
  submitButtonText: {
    ...FONTS.h3,
    color: COLORS.white,
  },
});

export default CreateRecipeScreen; 