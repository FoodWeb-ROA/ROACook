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
  Modal,
  FlatList,
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

// Define a type for the database ingredients
type DBIngredient = {
  ingredient_id: string;
  name: string;
};

const CreateRecipeScreen = () => {
  const navigation = useNavigation<CreateRecipeNavigationProp>();
  const { menuSections, loading: loadingSections } = useMenuSections();

  // Recipe form state
  const [recipe, setRecipe] = useState({
    recipe_name: 'Test Pasta Recipe',
    menu_section_id: '',
    directions: '1. Boil water\n2. Cook pasta for 8-10 minutes\n3. Drain and serve with sauce',
    prep_time: '5',
    total_time: '15',
    rest_time: '0',
    servings: '4',
    cooking_notes: 'You can add any sauce you prefer',
  });

  // Ingredients
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { id: '1', name: '', amount: '', unit_id: '1' },
  ]);

  // Units for dropdown
  const [units, setUnits] = useState<any[]>([]);
  // Available ingredients from the database
  const [availableIngredients, setAvailableIngredients] = useState<DBIngredient[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Add state for category modal
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  // Add state for ingredient modal
  const [ingredientModalVisible, setIngredientModalVisible] = useState(false);
  const [currentIngredientIndex, setCurrentIngredientIndex] = useState(-1);
  const [ingredientSearchQuery, setIngredientSearchQuery] = useState('');
  const [filteredIngredients, setFilteredIngredients] = useState<DBIngredient[]>([]);
  // Add state for unit modal
  const [unitModalVisible, setUnitModalVisible] = useState(false);
  const [currentUnitIndex, setCurrentUnitIndex] = useState(-1);
  // New ingredient modal
  const [newIngredientModalVisible, setNewIngredientModalVisible] = useState(false);
  const [newIngredientName, setNewIngredientName] = useState('');

  // Add state to track the selected category name for display
  const [selectedCategoryName, setSelectedCategoryName] = useState('Select a category');

  useEffect(() => {
    // Fetch units and ingredients from the database
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch units
        const { data: unitsData, error: unitsError } = await supabase
          .from('units')
          .select('*')
          .order('unit_name');

        if (unitsError) throw unitsError;
        setUnits(unitsData || []);
        
        // Fetch available ingredients
        const { data: ingredientsData, error: ingredientsError } = await supabase
          .from('ingredients')
          .select('ingredient_id, name')
          .order('name');
        
        if (ingredientsError) throw ingredientsError;
        setAvailableIngredients(ingredientsData || []);
        
        // If menu sections are loaded, set a default category
        if (menuSections && menuSections.length > 0) {
          const firstSection = menuSections[0];
          setRecipe(prev => ({ 
            ...prev, 
            menu_section_id: String(firstSection.menu_section_id)
          }));
          setSelectedCategoryName(firstSection.name);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        Alert.alert('Error', 'Failed to load necessary data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [menuSections]);

  // Filter ingredients when search query changes
  useEffect(() => {
    if (ingredientSearchQuery.trim() === '') {
      setFilteredIngredients(availableIngredients);
    } else {
      const query = ingredientSearchQuery.toLowerCase().trim();
      const filtered = availableIngredients.filter(
        ingredient => ingredient.name.toLowerCase().includes(query)
      );
      setFilteredIngredients(filtered);
    }
  }, [ingredientSearchQuery, availableIngredients]);

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

  // Function to handle category selection
  const handleCategorySelect = (id: string, name: string) => {
    handleChange('menu_section_id', id);
    setSelectedCategoryName(name);
    setCategoryModalVisible(false);
  };

  // Function to open ingredient selection modal
  const openIngredientSelector = (index: number) => {
    setCurrentIngredientIndex(index);
    setIngredientSearchQuery(''); // Reset search when opening modal
    setFilteredIngredients(availableIngredients); // Reset filtered results
    setIngredientModalVisible(true);
  };

  // Function to handle ingredient selection
  const handleIngredientSelect = (ingredient: DBIngredient) => {
    if (currentIngredientIndex >= 0 && currentIngredientIndex < ingredients.length) {
      const updatedIngredients = [...ingredients];
      updatedIngredients[currentIngredientIndex] = {
        ...updatedIngredients[currentIngredientIndex],
        name: ingredient.name
      };
      setIngredients(updatedIngredients);
    }
    setIngredientModalVisible(false);
  };

  // Function to add a new ingredient to the database
  const handleAddNewIngredient = async () => {
    if (!newIngredientName.trim()) {
      Alert.alert('Error', 'Ingredient name is required');
      return;
    }

    try {
      // Insert the new ingredient with ONLY the name field
      // Let PostgreSQL handle ID assignment automatically through its sequence
      const { data: newIngredient, error } = await supabase
        .from('ingredients')
        .insert({ name: newIngredientName.trim() })
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error from Supabase:', error);
        throw error;
      }
      
      console.log('✅ Successfully added ingredient:', newIngredient);
      
      // Add to available ingredients
      setAvailableIngredients(prev => [...prev, newIngredient]);
      setFilteredIngredients(prev => [...prev, newIngredient]); // Update filtered results too
      
      // Select this ingredient if we have an active selection
      if (currentIngredientIndex >= 0) {
        console.log(`📝 Selecting new ingredient for index ${currentIngredientIndex}`);
        handleIngredientSelect(newIngredient);
      }
      
      // Clear and close modal
      setNewIngredientName('');
      setNewIngredientModalVisible(false);
      
      Alert.alert('Success', 'New ingredient added successfully');
    } catch (error: any) {
      console.error('❌ Error adding new ingredient:', error);
      Alert.alert('Error', `Failed to add ingredient: ${error.message || String(error)}`);
    }
  };

  // Function to open unit selection modal
  const openUnitSelector = (index: number) => {
    setCurrentUnitIndex(index);
    setUnitModalVisible(true);
  };

  // Function to handle unit selection
  const handleUnitSelect = (unitId: string, unitName: string) => {
    if (currentUnitIndex >= 0 && currentUnitIndex < ingredients.length) {
      handleIngredientChange(ingredients[currentUnitIndex].id, 'unit_id', unitId);
    }
    setUnitModalVisible(false);
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

    // Check if at least one ingredient is properly added
    const validIngredients = ingredients.filter(ing => ing.name.trim() !== '' && ing.amount.trim() !== '');
    if (validIngredients.length === 0) {
      Alert.alert('Error', 'Please add at least one ingredient with amount');
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
        .select()
        .single();
      
      if (recipeError) throw recipeError;

      // Step 2: Add recipe_ingredients relations for valid ingredients
      for (const ing of validIngredients) {
        // Find the ingredient_id from available ingredients
        const matchedIngredient = availableIngredients.find(
          availIng => availIng.name.toLowerCase() === ing.name.toLowerCase()
        );

        if (!matchedIngredient) {
          console.warn(`Ingredient "${ing.name}" not found in the database. Skipping.`);
          continue;
        }

        // Add the relationship
        const { error: relError } = await supabase
          .from('recipe_ingredients')
          .insert({
            recipe_id: recipeData.recipe_id,
            ingredient_id: matchedIngredient.ingredient_id,
            amount: ing.amount ? parseFloat(ing.amount) : 0,
            unit_id: ing.unit_id,
          });

        if (relError) throw relError;
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
    } catch (error: any) {
      console.error('Error creating recipe:', error);
      Alert.alert('Error', `Failed to create recipe. Please try again. Error: ${error.message || String(error)}`);
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
            <TouchableOpacity 
              style={styles.categorySelector}
              onPress={() => setCategoryModalVisible(true)}
            >
              <Text style={[styles.input, styles.categoryText]}>
                {selectedCategoryName}
              </Text>
              <MaterialCommunityIcons 
                name="chevron-down" 
                size={24} 
                color={COLORS.white} 
                style={styles.categoryIcon}
              />
            </TouchableOpacity>

            {/* Category Selection Modal */}
            <Modal
              animationType="slide"
              transparent={true}
              visible={categoryModalVisible}
              onRequestClose={() => setCategoryModalVisible(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Select a Category</Text>
                  
                  <FlatList
                    data={menuSections}
                    keyExtractor={(item) => String(item.menu_section_id)}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.categoryItem}
                        onPress={() => handleCategorySelect(String(item.menu_section_id), item.name)}
                      >
                        <Text style={styles.categoryItemText}>{item.name}</Text>
                      </TouchableOpacity>
                    )}
                  />
                  
                  <TouchableOpacity 
                    style={styles.closeButton}
                    onPress={() => setCategoryModalVisible(false)}
                  >
                    <Text style={styles.closeButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            <Text style={styles.label}>Ingredients</Text>
            {ingredients.map((ingredient, index) => (
              <View key={ingredient.id} style={styles.ingredientRow}>
                <TouchableOpacity
                  style={[styles.input, styles.ingredientNameInput]}
                  onPress={() => openIngredientSelector(index)}
                >
                  <Text style={ingredient.name ? styles.selectedText : styles.placeholderText}>
                    {ingredient.name || "Select ingredient"}
                  </Text>
                </TouchableOpacity>
                
                <TextInput
                  style={[styles.input, styles.amountInput]}
                  value={ingredient.amount}
                  onChangeText={value => handleIngredientChange(ingredient.id, 'amount', value)}
                  placeholder="Amount"
                  placeholderTextColor={COLORS.placeholder}
                  keyboardType="numeric"
                />
                
                <TouchableOpacity 
                  style={[styles.input, styles.unitInput]}
                  onPress={() => openUnitSelector(index)}
                >
                  <Text style={[styles.selectedText, { textAlign: 'center' }]}>
                    {units.find(u => u.unit_id.toString() === ingredient.unit_id)?.unit_name || 'Unit'}
                  </Text>
                </TouchableOpacity>
                
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
            
            {/* Unit Selection Modal */}
            <Modal
              animationType="slide"
              transparent={true}
              visible={unitModalVisible}
              onRequestClose={() => setUnitModalVisible(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Select a Unit</Text>
                  
                  <FlatList
                    data={units}
                    keyExtractor={(item) => String(item.unit_id)}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.categoryItem}
                        onPress={() => handleUnitSelect(String(item.unit_id), item.unit_name)}
                      >
                        <Text style={styles.categoryItemText}>
                          {item.unit_name} {item.abbreviation ? `(${item.abbreviation})` : ''}
                        </Text>
                        <Text style={styles.unitSystemText}>{item.system}</Text>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      <View style={styles.emptyListContainer}>
                        <Text style={styles.emptyListText}>No units available</Text>
                      </View>
                    }
                  />
                  
                  <TouchableOpacity 
                    style={styles.closeButton}
                    onPress={() => setUnitModalVisible(false)}
                  >
                    <Text style={styles.closeButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            {/* Ingredient Selection Modal */}
            <Modal
              animationType="slide"
              transparent={true}
              visible={ingredientModalVisible}
              onRequestClose={() => setIngredientModalVisible(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Select an Ingredient</Text>
                  
                  <TouchableOpacity
                    style={[styles.addIngredientButton, { marginBottom: 10 }]}
                    onPress={() => {
                      setIngredientModalVisible(false);
                      setNewIngredientModalVisible(true);
                    }}
                  >
                    <MaterialCommunityIcons name="plus-circle" size={20} color={COLORS.white} />
                    <Text style={styles.addButtonText}>Add New Ingredient</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.searchContainer}>
                    <MaterialCommunityIcons name="magnify" size={20} color={COLORS.white} style={styles.searchIcon} />
                    <TextInput
                      style={styles.searchInput}
                      value={ingredientSearchQuery}
                      onChangeText={setIngredientSearchQuery}
                      placeholder="Search ingredients..."
                      placeholderTextColor={COLORS.placeholder}
                      autoCapitalize="none"
                    />
                    {ingredientSearchQuery.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setIngredientSearchQuery('')}
                        style={styles.clearSearchButton}
                      >
                        <MaterialCommunityIcons name="close-circle" size={18} color={COLORS.white} />
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  <FlatList
                    data={filteredIngredients}
                    keyExtractor={(item) => String(item.ingredient_id)}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.categoryItem}
                        onPress={() => handleIngredientSelect(item)}
                      >
                        <Text style={styles.categoryItemText}>{item.name}</Text>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      <View style={styles.emptyListContainer}>
                        <Text style={styles.emptyListText}>
                          {ingredientSearchQuery.trim() !== '' 
                            ? `No ingredients matching "${ingredientSearchQuery}"`
                            : 'No ingredients available'}
                        </Text>
                      </View>
                    }
                  />
                  
                  <TouchableOpacity 
                    style={styles.closeButton}
                    onPress={() => setIngredientModalVisible(false)}
                  >
                    <Text style={styles.closeButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            {/* New Ingredient Modal */}
            <Modal
              animationType="slide"
              transparent={true}
              visible={newIngredientModalVisible}
              onRequestClose={() => setNewIngredientModalVisible(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Add New Ingredient</Text>
                  
                  <TextInput
                    style={[styles.input, { marginBottom: 20 }]}
                    value={newIngredientName}
                    onChangeText={setNewIngredientName}
                    placeholder="Ingredient name"
                    placeholderTextColor={COLORS.placeholder}
                    autoFocus
                  />
                  
                  <View style={styles.buttonRow}>
                    <TouchableOpacity 
                      style={[styles.actionButton, { backgroundColor: COLORS.secondary, marginRight: 10 }]}
                      onPress={() => setNewIngredientModalVisible(false)}
                    >
                      <Text style={styles.closeButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.actionButton, { backgroundColor: COLORS.primary, marginLeft: 10 }]}
                      onPress={handleAddNewIngredient}
                    >
                      <Text style={styles.addButtonText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
            
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
                <Text style={styles.label}>Prep Time</Text>
                <View style={styles.timeInputWrapper}>
                  <TextInput
                    style={styles.timeInputField}
                    value={recipe.prep_time}
                    onChangeText={value => handleChange('prep_time', value)}
                    placeholder="0"
                    placeholderTextColor={COLORS.placeholder}
                    keyboardType="numeric"
                  />
                  <Text style={styles.timeUnit}>min</Text>
                </View>
              </View>

              <View style={styles.timeInput}>
                <Text style={styles.label}>Total Time</Text>
                <View style={styles.timeInputWrapper}>
                  <TextInput
                    style={styles.timeInputField}
                    value={recipe.total_time}
                    onChangeText={value => handleChange('total_time', value)}
                    placeholder="0"
                    placeholderTextColor={COLORS.placeholder}
                    keyboardType="numeric"
                  />
                  <Text style={styles.timeUnit}>min</Text>
                </View>
              </View>

              <View style={styles.timeInput}>
                <Text style={styles.label}>Rest Time</Text>
                <View style={styles.timeInputWrapper}>
                  <TextInput
                    style={styles.timeInputField}
                    value={recipe.rest_time}
                    onChangeText={value => handleChange('rest_time', value)}
                    placeholder="0"
                    placeholderTextColor={COLORS.placeholder}
                    keyboardType="numeric"
                  />
                  <Text style={styles.timeUnit}>min</Text>
                </View>
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
  placeholderText: {
    color: COLORS.placeholder,
  },
  selectedText: {
    color: COLORS.white,
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
    justifyContent: 'center',
  },
  amountInput: {
    flex: 1,
    marginRight: 8,
  },
  unitInput: {
    flex: 1.5,
    marginRight: 8,
    justifyContent: 'center',
    height: 50,
    paddingVertical: 0, // Reduce vertical padding to match height
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
  addIngredientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.tertiary,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
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
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius,
    marginBottom: 16,
  },
  categoryText: {
    flex: 1,
    marginBottom: 0,
    height: 50,
    textAlignVertical: 'center',
  },
  categoryIcon: {
    marginRight: 10,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '80%',
    maxHeight: '70%',
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radius,
    padding: SIZES.padding * 2,
    ...SHADOWS.medium,
  },
  modalTitle: {
    ...FONTS.h3,
    color: COLORS.white,
    marginBottom: SIZES.padding * 2,
    textAlign: 'center',
  },
  categoryItem: {
    padding: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  categoryItemText: {
    ...FONTS.body2,
    color: COLORS.white,
  },
  closeButton: {
    marginTop: SIZES.padding * 2,
    backgroundColor: COLORS.secondary,
    paddingVertical: SIZES.padding,
    borderRadius: SIZES.radius,
    alignItems: 'center',
  },
  closeButtonText: {
    ...FONTS.body2,
    color: COLORS.white,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: COLORS.white,
    ...FONTS.body3,
  },
  clearSearchButton: {
    padding: 5,
  },
  emptyListContainer: {
    padding: SIZES.padding * 2,
    alignItems: 'center',
  },
  emptyListText: {
    ...FONTS.body3,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  unitSystemText: {
    ...FONTS.body3,
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    paddingVertical: SIZES.padding,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius,
    height: 50,
    paddingHorizontal: SIZES.padding,
    marginBottom: 8,
  },
  timeInputField: {
    flex: 1,
    color: COLORS.white,
    ...FONTS.body3,
  },
  timeUnit: {
    color: COLORS.placeholder,
    ...FONTS.body3,
    marginLeft: 4,
  },
});

export default CreateRecipeScreen; 