import React, { useState, useEffect, useCallback } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';
import { RootStackParamList } from '../navigation/types';
import { supabase } from '../data/supabaseClient';
import { Unit, MenuSection, Ingredient, RecipeKind, ParsedIngredient } from '../types';
import { useMenuSections, useUnits, useIngredients, useDishDetail, usePreparationDetail } from '../hooks/useSupabase';
import AppHeader from '../components/AppHeader';
import { TextInputChangeEventData } from 'react-native';

type CreateRecipeNavigationProp = StackNavigationProp<RootStackParamList>;
// Define RouteProp type for this screen
type CreateRecipeRouteProp = RouteProp<RootStackParamList, 'CreateRecipe'>;

// Input type for a component being added
export type ComponentInput = {
    key: string; // Unique key for FlatList/mapping
    ingredient_id: string;
    name: string; // Store name for display convenience
    amount: string; // Keep as string for input field
    unit_id: string | null;
    isPreparation: boolean;
    originalPrep?: ParsedIngredient; // keep full parsed preparation when confirming
};

// Rename screen component
const CreateRecipeScreen = () => {
  const navigation = useNavigation<CreateRecipeNavigationProp>();
  // Get route params
  const route = useRoute<CreateRecipeRouteProp>();
  const dishIdToEdit = route.params?.dishId;
  const preparationIdToEdit = route.params?.preparationId;
  const isEditing = !!dishIdToEdit || !!preparationIdToEdit;
  // Check for parsed recipe
  const parsedRecipe = route.params?.parsedRecipe;
  const isConfirming = !!parsedRecipe && !isEditing; // Confirming only if not editing

  // Hooks for fetching data for editing
  const { dish: dishToEdit, loading: loadingDish, error: dishError } = useDishDetail(dishIdToEdit);
  // Fetch preparation details separately if editing a preparation
  // Need to adapt usePreparationDetail or create a simpler fetch for basic prep info + its components
  // For now, let's use usePreparationDetail and assume it fetches components needed
  const { preparation: prepToEdit, ingredients: prepComponentsToEdit, loading: loadingPrep, error: prepError } = usePreparationDetail(preparationIdToEdit);

  // --- Hooks for fetching data --- 
  const { menuSections, loading: loadingSections } = useMenuSections();
  const { units, loading: loadingUnits } = useUnits(); // Assumes useUnits hook exists
  // Fetch both ingredients and preparations for component selection
  const { ingredients: availableComponents, loading: loadingComponents } = useIngredients(true); // Assumes useIngredients hook exists and accepts flag

  // --- Form State --- 
  const [recipeKind, setRecipeKind] = useState<RecipeKind>('dish');
  const [dishName, setDishName] = useState('');
  const [menuSectionId, setMenuSectionId] = useState<string | null>(null);
  const [directions, setDirections] = useState<string[]>(['']);
  const [totalTimeHours, setTotalTimeHours] = useState('0'); // Store time parts
  const [totalTimeMinutes, setTotalTimeMinutes] = useState('30');
  const [numServings, setNumServings] = useState('1'); // total servings
  const [servingSize, setServingSize] = useState('1');
  const [servingUnitId, setServingUnitId] = useState<string | null>(null);
  const [cookingNotes, setCookingNotes] = useState('');
  
  // State for the list of components to be added
  const [components, setComponents] = useState<ComponentInput[]>([]); 

  // --- UI State --- 
  const [loading, setLoading] = useState(false); // For initial data load
  const [submitting, setSubmitting] = useState(false);
  // TODO: Add state for modals (Category Picker, Unit Picker, Component Search/Add)
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [servingUnitModalVisible, setServingUnitModalVisible] = useState(false);
  const [componentSearchModalVisible, setComponentSearchModalVisible] = useState(false);
  const [componentSearchQuery, setComponentSearchQuery] = useState('');
  const [filteredAvailableComponents, setFilteredAvailableComponents] = useState<Ingredient[]>([]); // Type might need adjustment based on useIngredients hook

  // Add state for unit modal related to components
  const [componentUnitModalVisible, setComponentUnitModalVisible] = useState(false);
  const [currentManagingComponentKey, setCurrentManagingComponentKey] = useState<string | null>(null);

  // State to track overall loading including edit data fetching
  const [isScreenLoading, setIsScreenLoading] = useState(true);

  // --- Effects --- 
  // Combined loading effect
  useEffect(() => {
    // Confirming mode doesn't require extra loading unless we add ingredient/unit matching
    const isLoading = loadingSections || loadingUnits || loadingComponents || (isEditing && (loadingDish || loadingPrep));
    setIsScreenLoading(isLoading);
  }, [loadingSections, loadingUnits, loadingComponents, isEditing, loadingDish, loadingPrep]);

  // Effect to populate form when editing data is loaded
  useEffect(() => {
    // Only run if editing and done loading
    if (!isEditing || isScreenLoading) return; 

    if (dishIdToEdit && dishToEdit) {
      console.log("Populating form for editing dish:", dishToEdit);
      setRecipeKind('dish'); // Assuming dish for now
      setDishName(dishToEdit.dish_name || '');
      setMenuSectionId(dishToEdit.menu_section?.menu_section_id || null);
      
      // Populate directions (assuming dishToEdit.directions is newline separated)
      setDirections(dishToEdit.directions?.split('\n') || ['']); 
      
      // Populate time
      const timeParts = dishToEdit.total_time?.split(':') || ['0', '30'];
      setTotalTimeHours(String(parseInt(timeParts[0]) || 0));
      setTotalTimeMinutes(String(parseInt(timeParts[1]) || 0));
      
      setServingSize(String(dishToEdit.serving_size || 1));
      setServingUnitId(dishToEdit.serving_unit?.unit_id || null);
      setNumServings(String((dishToEdit as any).num_servings ?? 1));
      setCookingNotes(dishToEdit.cooking_notes || '');
      
      // Populate components
      const loadedComponents: ComponentInput[] = dishToEdit.components.map((comp, index) => ({
        key: `loaded-${comp.ingredient_id}-${index}`, // Generate a unique key
        ingredient_id: comp.ingredient_id,
        name: comp.name || 'Unknown Component', 
        amount: String(comp.amount || ''),
        unit_id: comp.unit?.unit_id || null,
        isPreparation: comp.isPreparation || false,
      }));
      setComponents(loadedComponents);

    } else if (preparationIdToEdit && prepToEdit) {
      console.log("Populating form for editing preparation:", prepToEdit);
      setRecipeKind('preparation');
      setDishName(prepToEdit.name || ''); // Use dishName state for prep name
      setMenuSectionId(null); // Preparations don't have menu sections
      
      setDirections(prepToEdit.directions?.split('\n') || ['']);
      
      // Populate time (prep hook might return total_time differently, adapt as needed)
      const prepTimeMinutes = prepToEdit.total_time || 30;
      setTotalTimeHours('0'); // Assuming prep time is only minutes
      setTotalTimeMinutes(String(prepTimeMinutes));
      
      // Populate yield as serving size/unit
      setServingSize(String(prepToEdit.yield_amount || 1));
      setServingUnitId(prepToEdit.yield_unit?.unit_id || null);
      
      setCookingNotes(prepToEdit.cooking_notes || '');
      
      // Populate components (ingredients of the preparation)
      const loadedComponents: ComponentInput[] = prepComponentsToEdit.map((comp, index) => ({
          key: `loaded-prep-${comp.ingredient_id}-${index}`, // Generate a unique key
          ingredient_id: comp.ingredient_id,
          name: comp.name || 'Unknown Ingredient', 
          amount: String(comp.amount || ''),
          unit_id: comp.unit?.unit_id || null,
          isPreparation: false, // Ingredients within a prep are not themselves preps in this context
      }));
      setComponents(loadedComponents);
    }
    
  }, [isEditing, isScreenLoading, dishIdToEdit, dishToEdit, preparationIdToEdit, prepToEdit, prepComponentsToEdit]);

  // Effect to populate form from parsed recipe data
  useEffect(() => {
    // Only run if confirming and base data (units, components) is loaded
    if (!isConfirming || isScreenLoading) return;
    if (!parsedRecipe) return; // Should not happen if isConfirming is true, but for type safety

    console.log("Populating form from parsed recipe:", parsedRecipe);

    // Assume parsed recipe is a 'dish' for now
    setRecipeKind('dish'); 
    setDishName(parsedRecipe.recipe_name || '');

    // Populate directions
    setDirections(parsedRecipe.instructions || ['']);

    // Populate time (assuming parsedRecipe.total_time is in minutes)
    const totalMinutes = parsedRecipe.total_time || 30;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    setTotalTimeHours(String(hours));
    setTotalTimeMinutes(String(minutes));

    // Populate serving size/unit - requires matching parsed unit string
    setServingSize(String(parsedRecipe.serving_size || 1));
    const parsedServingUnit = parsedRecipe.serving_unit?.toLowerCase().trim();
    let matchedServingUnitId: string | null = null;
    if (parsedServingUnit && units.length > 0) {
        const foundUnit = units.find(u => 
            u.unit_name.toLowerCase() === parsedServingUnit || 
            u.abbreviation?.toLowerCase() === parsedServingUnit
        );
        if (foundUnit) {
            matchedServingUnitId = foundUnit.unit_id;
            setServingUnitId(matchedServingUnitId); // Set state immediately
        } else {
            console.warn(`Parsed serving unit "${parsedRecipe.serving_unit}" not found in database units.`);
            // Keep default or set to null
        }
    }

    setCookingNotes(parsedRecipe.cook_notes || '');
    setNumServings(String(parsedRecipe.num_servings ?? 1));

    // Populate components - **Attempt to match units**
    const initialComponents: ComponentInput[] = (parsedRecipe.ingredients || []).map((ing, index) => {
        let matchedUnitId: string | null = null;
        const parsedUnit = ing.unit?.toLowerCase().trim();
        if (parsedUnit && units.length > 0) {
            const foundUnit = units.find(u => 
                u.unit_name.toLowerCase() === parsedUnit || 
                u.abbreviation?.toLowerCase() === parsedUnit
            );
            if (foundUnit) {
                matchedUnitId = foundUnit.unit_id;
            } else {
                console.warn(`Parsed ingredient unit "${ing.unit}" for "${ing.name}" not found.`);
            }
        }

        return {
            key: `parsed-${index}-${Date.now()}`, // Generate unique key
            ingredient_id: '', // User needs to select
            name: ing.name || 'Unknown Ingredient', // Pre-fill name
            amount: String(ing.amount || ''), // Pre-fill amount
            unit_id: matchedUnitId, // Set matched unit ID, or null if not found
            isPreparation: ing.ingredient_type === 'Preparation', 
            originalPrep: ing.ingredient_type === 'Preparation' ? (ing as ParsedIngredient) : undefined,
        };
    });
    setComponents(initialComponents);

    // Set default serving unit if not found from parsed data AND not set above
    if (!matchedServingUnitId && !loadingUnits && units.length > 0) { 
        const defaultUnit = units.find((u: Unit) => u.unit_name.toLowerCase() === 'serving') || units[0];
        setServingUnitId(defaultUnit?.unit_id || null);
    }

  }, [isConfirming, isScreenLoading, parsedRecipe, units, loadingUnits]); // Add units/loadingUnits dependency

  // Effect to set default serving unit and menu section once loaded
  useEffect(() => {
      if (!loadingUnits && units.length > 0 && !servingUnitId) {
          // Find a common default like 'count' or 'serving' or just the first one
          const defaultUnit = units.find((u: Unit) => u.unit_name.toLowerCase() === 'serving') || units[0];
          setServingUnitId(defaultUnit?.unit_id || null);
      }
      if (!loadingSections && menuSections.length > 0 && !menuSectionId) {
          // Maybe default to first category or leave null/"Uncategorized"
          // setMenuSectionId(menuSections[0]?.menu_section_id || null);
      }
  }, [units, loadingUnits, menuSections, loadingSections, servingUnitId, menuSectionId]);

  // Effect for filtering available components based on search query
  useEffect(() => {
    if (!availableComponents) {
        setFilteredAvailableComponents([]);
        return;
    }
    if (componentSearchQuery.trim() === '') {
      setFilteredAvailableComponents(availableComponents);
    } else {
      const query = componentSearchQuery.toLowerCase().trim();
      const filtered = availableComponents.filter((comp: Ingredient) => 
        comp.name?.toLowerCase().includes(query) 
      );
      setFilteredAvailableComponents(filtered);
    }
  }, [componentSearchQuery, availableComponents]);


  // --- Handlers (Placeholder/Basic Structure) --- 

  // TODO: Implement handler to add a selected component from search modal
  const handleAddComponent = (selectedDbIngredient: Ingredient) => {
    // Need to know if it's a preparation - assuming hook provides this
    const isPrep = selectedDbIngredient.isPreparation === true; // Adjust based on hook structure
    setComponents(prev => [
        ...prev,
        {
            key: Date.now().toString(), // Simple unique key
            ingredient_id: selectedDbIngredient.ingredient_id,
            name: selectedDbIngredient.name,
            amount: '', // Start with empty amount
            unit_id: null, // Start with no unit selected
            isPreparation: isPrep,
        }
    ]);
    setComponentSearchModalVisible(false); // Close modal
    setComponentSearchQuery(''); // Reset search
  };

  // TODO: Implement handler to update amount/unit_id for a component in the list
  const handleComponentUpdate = (key: string, field: 'amount' | 'unit_id', value: string | null) => {
      setComponents(prev => 
          prev.map(c => c.key === key ? { ...c, [field]: value } : c)
      );
      // Close unit modal if a unit was selected
      if (field === 'unit_id') {
          setComponentUnitModalVisible(false);
      }
  };

  // TODO: Implement handler to remove a component from the list
  const handleRemoveComponent = (key: string) => {
      setComponents(prev => prev.filter(c => c.key !== key));
  };

  // Handler to open the unit modal for a specific component
  const openComponentUnitSelector = (key: string) => {
      setCurrentManagingComponentKey(key);
      setComponentUnitModalVisible(true);
  };
  
  // Handler to open category modal
  const openCategorySelector = () => {
      setCategoryModalVisible(true);
  };

  // Handler to select a category
  const handleCategorySelect = (section: MenuSection) => {
      setMenuSectionId(section.menu_section_id);
      setCategoryModalVisible(false);
  };

  // Handler to open serving unit modal
  const openServingUnitSelector = () => {
      setServingUnitModalVisible(true);
  };
  
  // Handler to select serving unit
  const handleServingUnitSelect = (unit: Unit) => {
      setServingUnitId(unit.unit_id);
      setServingUnitModalVisible(false);
  };

  // Handler to select unit for a component
   const handleComponentUnitSelect = (unit: Unit) => {
      if (currentManagingComponentKey) {
          handleComponentUpdate(currentManagingComponentKey, 'unit_id', unit.unit_id);
      }
      // Modal closing is handled in handleComponentUpdate
  };

  // --- Handlers for Directions List ---
  const handleDirectionChange = (index: number, text: string) => {
    const newDirections = [...directions];
    newDirections[index] = text;
    setDirections(newDirections);
  };

  const handleAddDirectionStep = () => {
    setDirections([...directions, '']);
  };

  const handleRemoveDirectionStep = (index: number) => {
    if (directions.length <= 1) return; // Prevent removing the last step
    const newDirections = directions.filter((_, i) => i !== index);
    setDirections(newDirections);
  };

  // Implement submission logic
  const handleSaveDish = async () => {
    // --- 1. Validation --- 
    if (!dishName.trim()) {
      Alert.alert('Missing Information', 'Please enter a recipe name.');
      return;
    }
    if (!servingUnitId) {
      Alert.alert('Missing Information', 'Please select a serving unit.');
      return;
    }
    // Validate components
    const invalidComponent = components.find(c => 
        !c.amount.trim() || isNaN(parseFloat(c.amount)) || parseFloat(c.amount) <= 0 || !c.unit_id
    );
    if (invalidComponent) {
        Alert.alert('Invalid Component', `Please enter a valid positive amount and select a unit for "${invalidComponent.name}".`);
        return;
    }
    if (components.length === 0) {
        Alert.alert('Missing Components', 'Please add at least one component to the dish.');
        return;
    }
    // Validate time inputs
    const hours = parseInt(totalTimeHours); 
    const minutes = parseInt(totalTimeMinutes);
    if (isNaN(hours) || hours < 0 || isNaN(minutes) || minutes < 0 || minutes >= 60) {
        Alert.alert('Invalid Time', 'Please enter valid numbers for hours (0+) and minutes (0-59).');
        return;
    }
    // Validate numServings
    const numServInt = parseInt(numServings);
    if (isNaN(numServInt) || numServInt <= 0) {
        Alert.alert('Invalid Servings', 'Please enter a valid positive number of servings.');
        return;
    }

    setSubmitting(true);

    try {
      // --- 2. Data Formatting --- 
      const timeString = `${String(totalTimeHours).padStart(2, '0')}:${String(totalTimeMinutes).padStart(2, '0')}:00`;
      // Ensure servingSizeNum is explicitly a number or null
      let servingSizeNum: number | null = parseInt(servingSize);
      if (isNaN(servingSizeNum) || servingSizeNum <= 0) {
          servingSizeNum = null; // Set to null if invalid or non-positive, adjust if DB requires a default like 1
      }
      const formattedDirections = directions.map(step => step.trim()).filter(step => step).join('\n');
      
      // --- Prepare Component Data (Same format needed for insert/upsert) ---
      const componentsToSave = components.map(c => ({ 
          // dish_id or preparation_id will be added conditionally below
          ingredient_id: c.ingredient_id,
          amount: parseFloat(c.amount), // Convert amount string to number
          unit_id: c.unit_id // Already validated to be non-null
      })); 

      if (isEditing) {
        // --- UPDATE LOGIC --- 
        if (dishIdToEdit) {
          console.log("Updating dish:", dishIdToEdit);
          // 3a. Update 'dishes' table
          const { error: dishUpdateError } = await supabase
            .from('dishes')
            .update({ 
              dish_name: dishName.trim(), 
              menu_section_id: menuSectionId, 
              directions: formattedDirections || undefined, 
              total_time: timeString, 
              num_servings: numServInt,
              serving_size: servingSizeNum ?? undefined, 
              serving_unit_id: servingUnitId, 
              cooking_notes: cookingNotes.trim() || undefined
            })
            .eq('dish_id', dishIdToEdit);
          
          if (dishUpdateError) throw dishUpdateError;

          // 3b. Update 'dish_components' (Simple: Delete all then insert new)
          console.log("Deleting existing components for dish:", dishIdToEdit);
          const { error: deleteError } = await supabase
            .from('dish_components')
            .delete()
            .eq('dish_id', dishIdToEdit);
          
          if (deleteError) throw deleteError;

          if (componentsToSave.length > 0) {
            const componentsWithDishId = componentsToSave.map(c => ({ ...c, dish_id: dishIdToEdit }));
            console.log("Inserting updated components:", componentsWithDishId);
            const { error: componentsInsertError } = await supabase
              .from('dish_components')
              .insert(componentsWithDishId);
            if (componentsInsertError) throw componentsInsertError;
          }
          Alert.alert('Success', 'Dish updated successfully!');

        } else if (preparationIdToEdit) {
          console.log("Updating preparation:", preparationIdToEdit);

          // Update preparations table (directions, time, yield)
          const { error: prepUpdateError } = await supabase
            .from('preparations')
            .update({ 
              directions: formattedDirections || undefined, 
              // Calculate total minutes for preparation update
              total_time: (parseInt(totalTimeHours) * 60 + parseInt(totalTimeMinutes)) || undefined, 
              num_servings: numServInt,
              serving_size: servingSizeNum ?? undefined,
              yield_unit_id: servingUnitId, 
              // Note: preparation_id is the primary key, not updated here
            })
            .eq('preparation_id', preparationIdToEdit);
          
          if (prepUpdateError) throw prepUpdateError;

          // Update ingredients table (name, notes - assuming prep name/notes are stored there)
          // Check your DB schema: are prep name/notes in 'ingredients' or 'preparations'?
          // Assuming name/notes are in 'ingredients' based on usePreparationDetail hook structure
          const { error: ingredientUpdateError } = await supabase
            .from('ingredients') 
            .update({ 
              name: dishName.trim(), // Using dishName state for prep name
              cooking_notes: cookingNotes.trim() || undefined,
            } as { name: string; cooking_notes?: string | undefined }) // Explicitly type the update object
            .eq('ingredient_id', preparationIdToEdit); // Match the ingredient corresponding to the prep

          if (ingredientUpdateError) throw ingredientUpdateError;

          // Update 'preparation_ingredients' (Simple: Delete all then insert new)
          console.log("Deleting existing ingredients for preparation:", preparationIdToEdit);
          const { error: deletePrepIngError } = await supabase
            .from('preparation_ingredients')
            .delete()
            .eq('preparation_id', preparationIdToEdit);
          
          if (deletePrepIngError) throw deletePrepIngError;

          if (componentsToSave.length > 0) {
            const prepComponentsWithId = componentsToSave.map(c => ({ ...c, preparation_id: preparationIdToEdit }));
             console.log("Inserting updated preparation ingredients:", prepComponentsWithId);
            const { error: prepComponentsInsertError } = await supabase
              .from('preparation_ingredients')
              .insert(prepComponentsWithId);
            if (prepComponentsInsertError) throw prepComponentsInsertError;
          }
          Alert.alert('Success', 'Preparation updated successfully!');

          // Navigation after update (go back to detail or list?)
          if (navigation.canGoBack()) {
             navigation.goBack(); 
          } else {
              // Fallback if cannot go back (e.g., deep link)
              // navigation.replace('Home'); // Or navigate somewhere else
          }

        }

        // Navigation after update (go back to detail or list?)
        if (navigation.canGoBack()) {
           navigation.goBack(); 
        } else {
            // Fallback if cannot go back (e.g., deep link)
            // navigation.replace('Home'); // Or navigate somewhere else
        }

      } else {
        // --- INSERT LOGIC (Original adapted for UUIDs and RecipeKind) --- 
        console.log("Creating new recipe..."); 

        if (recipeKind === 'dish') {
            // --- Creating a DISH ---
            console.log("Attempting to insert new dish...");
            const { data: dishInsertData, error: dishError } = await supabase
                .from('dishes')
                .insert({ 
                    // dish_id will be generated by the database
                    dish_name: dishName.trim(), 
                    menu_section_id: menuSectionId, // Can be null
                    directions: formattedDirections || undefined,
                    total_time: timeString, // Format as interval string
                    num_servings: numServInt,
                    serving_size: servingSizeNum ?? undefined,
                    serving_unit_id: servingUnitId, // Already validated
                    cooking_notes: cookingNotes.trim() || undefined
                })
                .select('dish_id') // Select the DB-generated ID
                .single();

                if (dishError) throw dishError; 
                if (!dishInsertData || !dishInsertData.dish_id) throw new Error('Failed to insert dish or retrieve dish ID');
                
                const newDishId = dishInsertData.dish_id;
                console.log('Dish inserted with ID:', newDishId);

                // Insert into 'dish_components' table
                if (componentsToSave.length > 0) {
                    const componentsToInsert = componentsToSave.map(c => ({ 
                        ...c,
                        dish_id: newDishId
                    })); 
                    console.log('Inserting dish components:', componentsToInsert);
                    const { error: componentsError } = await supabase
                        .from('dish_components')
                        .insert(componentsToInsert);
                    if (componentsError) throw componentsError;
                }
                Alert.alert('Success', 'Dish created successfully!');

        } else if (recipeKind === 'preparation') {
            // --- Creating a PREPARATION ---
            console.log("Attempting to insert new preparation...");
            
            // 1. Insert into ingredients table first
            const { data: ingredientInsertData, error: ingredientError } = await supabase
                .from('ingredients')
                .insert({
                    // ingredient_id will be generated by the database
                    name: dishName.trim(), // Use dishName state for prep name
                    cooking_notes: cookingNotes.trim() || undefined,
                    // TODO: Determine default unit/amount for base ingredient entry if needed by schema
                    // These might not be strictly necessary if the prep is only defined by its components/yield
                    unit_id: servingUnitId, // Placeholder: Use serving unit? Or a default? Requires schema check.
                    amount: 1,             // Placeholder: Default amount?
                })
                .select('ingredient_id') // Select the DB-generated ID
                .single();

                if (ingredientError) throw ingredientError;
                if (!ingredientInsertData || !ingredientInsertData.ingredient_id) throw new Error('Failed to insert base ingredient for preparation or retrieve ID');

                const newPreparationId = ingredientInsertData.ingredient_id;
                console.log('Base ingredient for preparation inserted with ID:', newPreparationId);

                // 2. Insert into preparations table
                const { error: prepError } = await supabase
                    .from('preparations')
                    .insert({ 
                        preparation_id: newPreparationId, // Use the generated ID
                        directions: formattedDirections || '', // Provide empty string if no directions
                        total_time: (parseInt(totalTimeHours) * 60 + parseInt(totalTimeMinutes)) || undefined,
                        num_servings: numServInt,
                        serving_size: servingSizeNum ?? undefined,
                        yield_unit_id: servingUnitId,
                        yield_amount: servingSizeNum ?? undefined,
                    });

                if (prepError) throw prepError;
                console.log('Preparation details inserted for ID:', newPreparationId);

                // 3. Insert into 'preparation_ingredients' table
                if (componentsToSave.length > 0) {
                    const prepComponentsToInsert = componentsToSave.map(c => ({ 
                        ...c, 
                        preparation_id: newPreparationId 
                    }));
                    console.log("Inserting preparation ingredients:", prepComponentsToInsert);
                    const { error: prepComponentsError } = await supabase
                        .from('preparation_ingredients')
                        .insert(prepComponentsToInsert);
                    if (prepComponentsError) throw prepComponentsError;
                }
                Alert.alert('Success', 'Preparation created successfully!');
            }
            
            // Common navigation for successful creation
            navigation.goBack(); 
        }

    } catch (error: any) {
        console.error("Error saving recipe:", error);
        Alert.alert('Error Saving Recipe', error.message || 'An unexpected error occurred. Please try again.');
    } finally {
        setSubmitting(false);
    }
  };

  const createParsedIngredient = async (ing: ParsedIngredient): Promise<string> => {
      // returns ingredient_id
      // map unit
      let unitId: string | null = null;
      const parsedUnit = ing.unit?.toLowerCase().trim();
      if (parsedUnit) {
         const found = units.find(u => u.unit_name.toLowerCase() === parsedUnit || u.abbreviation?.toLowerCase() === parsedUnit);
         unitId = found?.unit_id || null;
      }
      if (!unitId && units.length > 0) unitId = units[0].unit_id;
      // insert ingredient
      const { data: ingInsert, error: ingErr } = await supabase
        .from('ingredients')
        .insert({ name: ing.name.trim(), unit_id: unitId!, amount: ing.amount ?? 1 })
        .select('ingredient_id')
        .single();
      if (ingErr || !ingInsert) throw new Error(ingErr?.message || 'Failed to insert ingredient');
      return ingInsert.ingredient_id;
   };

   const createParsedPreparation = async (prep: ParsedIngredient): Promise<string> => {
       // create base ingredient first
       const baseId = await createParsedIngredient(prep);
       // insert into preparations table
       const { error: prepErr } = await supabase
         .from('preparations')
         .insert({ preparation_id: baseId, directions: (prep as any).instructions?.join('\n') || '', total_time: 0 });
       if (prepErr) throw new Error(prepErr.message);
       // insert sub ingredients
       const subIngs = (prep as any).ingredients as ParsedIngredient[] | undefined;
       if (subIngs && subIngs.length > 0) {
          for (const sub of subIngs) {
             const childId = sub.ingredient_type === 'Preparation' ? await createParsedPreparation(sub) : await createParsedIngredient(sub);
             await supabase.from('preparation_ingredients').insert({ preparation_id: baseId, ingredient_id: childId, amount: sub.amount ?? 1, unit_id: units[0].unit_id });
          }
       }
       return baseId;
   };

  // --- Render Logic --- 
  if (isScreenLoading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" /></View>;
  }

  // Find names for selected category and unit for display
  const selectedCategoryName = menuSections.find(s => s.menu_section_id === menuSectionId)?.name || 'Select Category';
  const selectedServingUnitName = units.find(u => u.unit_id === servingUnitId)?.unit_name || 'Select Unit';

  // Filter components into ingredients and preparations for rendering
  const ingredientsList = components.filter(c => !c.isPreparation);
  const preparationsList = components.filter(c => c.isPreparation);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <StatusBar style="light" />
      {/* Update Header Title Dynamically */}
      <AppHeader 
        title={isEditing ? (dishIdToEdit ? 'Edit Dish' : 'Edit Preparation') : (isConfirming ? 'Confirm Recipe Details' : 'Create New Recipe')} 
        showBackButton={true} 
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { marginTop: -SIZES.padding }]}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled" // Closes keyboard when tapping outside inputs
        >
          {/* Recipe Name Input */}
          <Text style={styles.label}>Recipe Name *</Text>
          <TextInput 
              style={styles.input}
              placeholder="Enter recipe name"
              placeholderTextColor={COLORS.placeholder}
              value={dishName}
              onChangeText={setDishName}
          />

          {/* --- Components Section (Moved) --- */}
          <View style={styles.componentsSection}>
            {/* Ingredients List */}
            <Text style={styles.sectionTitle}>Ingredients</Text>
            {ingredientsList.length === 0 ? (
                <Text style={styles.emptyListText}>No raw ingredients added yet.</Text>
            ) : (
                ingredientsList.map((item) => (
                    <View key={item.key} style={styles.componentItemContainer}>
                         <Text style={styles.componentNameText}>{item.name}</Text>
                         <View style={styles.componentControlsContainer}>
                             <TextInput
                                 style={styles.componentInputAmount}
                                 placeholder="Amt"
                                 placeholderTextColor={COLORS.placeholder}
                                 value={item.amount}
                                 onChangeText={(value) => handleComponentUpdate(item.key, 'amount', value)}
                                 keyboardType="numeric"
                             />
                             <TouchableOpacity
                                 style={styles.componentUnitTrigger}
                                 onPress={() => openComponentUnitSelector(item.key)}
                             >
                                 <Text style={[styles.pickerText, !item.unit_id && styles.placeholderText]}>
                                     {units.find(u => u.unit_id === item.unit_id)?.abbreviation || 'Unit'}
                                 </Text>
                                  <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.textLight} />
                             </TouchableOpacity>
                             <TouchableOpacity onPress={() => handleRemoveComponent(item.key)} style={styles.removeButton}>
                                 <MaterialCommunityIcons name="close-circle" size={24} color={COLORS.error} />
                             </TouchableOpacity>
                         </View>
                    </View>
                ))
            )}

            {/* Preparations List */}
            <Text style={styles.sectionTitle}>Preparations</Text>
            {preparationsList.length === 0 ? (
                <Text style={styles.emptyListText}>No preparations added yet.</Text>
            ) : (
                preparationsList.map((item) => (
                    <View key={item.key} style={styles.componentItemContainer}>
                         <TouchableOpacity disabled={!isConfirming || !item.originalPrep} onPress={() => { if(item.originalPrep) navigation.navigate('ConfirmPreparation', { preparation: item.originalPrep }); }}>
                           <Text style={[styles.componentNameText, isConfirming && item.originalPrep && styles.linkText]}>{item.name}</Text>
                         </TouchableOpacity>
                         <View style={styles.componentControlsContainer}>
                             <TextInput
                                 style={styles.componentInputAmount}
                                 placeholder="Amt"
                                 placeholderTextColor={COLORS.placeholder}
                                 value={item.amount}
                                 onChangeText={(value) => handleComponentUpdate(item.key, 'amount', value)}
                                 keyboardType="numeric"
                             />
                             <TouchableOpacity
                                 style={styles.componentUnitTrigger}
                                 onPress={() => openComponentUnitSelector(item.key)}
                             >
                                 <Text style={[styles.pickerText, !item.unit_id && styles.placeholderText]}>
                                     {units.find(u => u.unit_id === item.unit_id)?.abbreviation || 'Unit'}
                                 </Text>
                                  <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.textLight} />
                             </TouchableOpacity>
                             <TouchableOpacity onPress={() => handleRemoveComponent(item.key)} style={styles.removeButton}>
                                 <MaterialCommunityIcons name="close-circle" size={24} color={COLORS.error} />
                             </TouchableOpacity>
                         </View>
                    </View>
                ))
            )}

            {/* Add Component Button */}
            <TouchableOpacity
                style={styles.addButton}
                onPress={() => setComponentSearchModalVisible(true)}
            >
                <Text style={styles.addButtonText}>+ Add Ingredient / Preparation</Text>
            </TouchableOpacity>
          </View>

          {/* Recipe Type Toggle */}
          <Text style={styles.label}>Recipe Type *</Text>
          <View style={[styles.rowContainer, styles.inputGroup]}>
              {(['dish','preparation'] as RecipeKind[]).map((k, index) => (
                <TouchableOpacity
                    key={k}
                    style={[styles.toggleBtn, recipeKind===k && styles.toggleBtnActive, { flex: 1, marginRight: index === 0 ? SIZES.padding : 0 }]}
                    onPress={()=>setRecipeKind(k)}
                >
                    <Text style={[styles.toggleText, recipeKind===k && styles.toggleTextActive, { textAlign: 'center' }]}>
                        {k.charAt(0).toUpperCase()+k.slice(1)}
                    </Text>
                </TouchableOpacity>
              ))}
          </View>

          {/* Category Picker Trigger */}
          <Text style={styles.label}>Category</Text>
          <TouchableOpacity style={[styles.pickerTrigger, styles.inputGroup]} onPress={openCategorySelector}>
              <Text style={[styles.pickerText, !menuSectionId && styles.placeholderText]}>
                  {selectedCategoryName}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={24} color={COLORS.textLight} />
          </TouchableOpacity>

          {/* Total Servings */}
          <Text style={styles.label}>Total Servings *</Text>
          <TextInput 
              style={[styles.input, styles.inputGroup]}
              placeholder="e.g., 4"
              placeholderTextColor={COLORS.placeholder}
              value={numServings}
              onChangeText={setNumServings}
              keyboardType="numeric"
          />

          {/* Serving Size & Unit Inputs Row */}
          <View style={[styles.rowContainer, styles.inputGroup]}>
              <View style={styles.columnFlex}>
                  <Text style={styles.label}>Serving Size</Text>
                  <TextInput 
                      style={styles.input}
                      placeholder="e.g., 4"
                      placeholderTextColor={COLORS.placeholder}
                      value={servingSize}
                      onChangeText={setServingSize}
                      keyboardType="numeric"
                  />
              </View>
              <View style={styles.columnFlex}>
                  <Text style={styles.label}>Serving Unit *</Text>
                  <TouchableOpacity style={styles.pickerTrigger} onPress={openServingUnitSelector}>
                      <Text style={[styles.pickerText, !servingUnitId && styles.placeholderText]}>
                           {selectedServingUnitName}
                      </Text>
                       <MaterialCommunityIcons name="chevron-down" size={24} color={COLORS.textLight} />
                  </TouchableOpacity>
              </View>
          </View>

          {/* Total Time Inputs Row */}
           <View style={[styles.rowContainer, styles.inputGroup]}>
              <View style={styles.columnFlex}>
                  <Text style={styles.label}>Total Time (Hrs)</Text>
                  <TextInput 
                      style={styles.input}
                      placeholder="0"
                      placeholderTextColor={COLORS.placeholder}
                      value={totalTimeHours}
                      onChangeText={setTotalTimeHours}
                      keyboardType="numeric"
                      maxLength={2} // Limit hours input
                  />
              </View>
              <View style={styles.columnFlex}>
                  <Text style={styles.label}>Total Time (Min)</Text>
                  <TextInput 
                      style={styles.input}
                      placeholder="30"
                      placeholderTextColor={COLORS.placeholder}
                      value={totalTimeMinutes}
                      onChangeText={setTotalTimeMinutes}
                      keyboardType="numeric"
                      maxLength={2} // Limit minutes input
                  />
              </View>
          </View>

          {/* Directions Input */}
          <Text style={styles.label}>Directions</Text>
          <View style={styles.inputGroup}> 
            {directions.map((step, index) => (
              <View key={index} style={styles.directionStepContainer}>
                <Text style={styles.stepNumber}>{index + 1}.</Text>
                <TextInput 
                  style={styles.directionInput}
                  placeholderTextColor={COLORS.placeholder}
                  value={step}
                  onChangeText={(text) => handleDirectionChange(index, text)}
                  multiline
                />
                {directions.length > 1 && (
                    <TouchableOpacity onPress={() => handleRemoveDirectionStep(index)} style={styles.removeStepButton}>
                        <MaterialCommunityIcons name="close-circle-outline" size={22} color={COLORS.textLight} />
                    </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity onPress={handleAddDirectionStep} style={styles.addStepButton}>
              <Text style={styles.addStepButtonText}>+ Add Step</Text>
            </TouchableOpacity>
          </View>

          {/* Cooking Notes Input */}
          <Text style={styles.label}>Cooking Notes</Text>
          <TextInput 
              style={[styles.input, styles.textArea, { minHeight: 60 }, styles.inputGroup]} // Shorter text area
              placeholder="Optional notes, tips, variations"
              placeholderTextColor={COLORS.placeholder}
              value={cookingNotes}
              onChangeText={setCookingNotes}
              multiline
          />

          {/* Update Save Button Text Dynamically */}
          <TouchableOpacity 
              style={[styles.button, styles.saveButton]} 
              onPress={handleSaveDish} 
              disabled={submitting || isScreenLoading}
          >
              {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.buttonText}>{isEditing ? 'Update Recipe' : (isConfirming ? 'Confirm & Save' : 'Save Recipe')}</Text>}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* --- Modals --- */}
      
      {/* Component Search Modal */}
       <Modal
            animationType="slide"
            transparent={true}
            visible={componentSearchModalVisible}
            onRequestClose={() => setComponentSearchModalVisible(false)}
        >
           <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Select Component</Text>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search ingredients or preparations..."
                        value={componentSearchQuery}
                        onChangeText={setComponentSearchQuery}
                    />
                    <FlatList
                        data={filteredAvailableComponents}
                        keyExtractor={(item: Ingredient) => item.ingredient_id} 
                        renderItem={({ item }) => (
                            <TouchableOpacity 
                                style={styles.modalItem}
                                onPress={() => handleAddComponent(item)} 
                            >
                                <Text style={styles.modalItemText}>{item.name} {item.isPreparation ? '(Prep)' : ''}</Text> 
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={<Text style={styles.emptyListText}>No matching components found.</Text>}
                    />
                    <TouchableOpacity 
                        style={styles.closeButton}
                        onPress={() => setComponentSearchModalVisible(false)}
                    >
                        <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>

        {/* Category Selection Modal */}
        <Modal
            animationType="slide"
            transparent={true}
            visible={categoryModalVisible}
            onRequestClose={() => setCategoryModalVisible(false)}
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Select Category</Text>
                    <FlatList
                        data={menuSections}
                        keyExtractor={(item) => item.menu_section_id}
                        renderItem={({ item }) => (
                            <TouchableOpacity 
                                style={styles.modalItem}
                                onPress={() => handleCategorySelect(item)}
                            >
                                <Text style={styles.modalItemText}>{item.name}</Text>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={<Text style={styles.emptyListText}>No categories found.</Text>}
                    />
                     <TouchableOpacity 
                        style={styles.closeButton}
                        onPress={() => setCategoryModalVisible(false)}
                    >
                        <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
        
        {/* Serving Unit Selection Modal */}
         <Modal
            animationType="slide"
            transparent={true}
            visible={servingUnitModalVisible}
            onRequestClose={() => setServingUnitModalVisible(false)}
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Select Serving Unit</Text>
                    <FlatList
                        data={units}
                        keyExtractor={(item) => item.unit_id}
                        renderItem={({ item }) => (
                            <TouchableOpacity 
                                style={styles.modalItem}
                                onPress={() => handleServingUnitSelect(item)}
                            >
                                <Text style={styles.modalItemText}>{item.unit_name} ({item.abbreviation || 'N/A'})</Text>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={<Text style={styles.emptyListText}>No units found.</Text>}
                    />
                    <TouchableOpacity 
                        style={styles.closeButton}
                        onPress={() => setServingUnitModalVisible(false)}
                    >
                        <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>

        {/* Component Unit Selection Modal */}
         <Modal
            animationType="slide"
            transparent={true}
            visible={componentUnitModalVisible}
            onRequestClose={() => setComponentUnitModalVisible(false)}
        >
           <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Select Unit for Component</Text>
                    <FlatList
                        data={units}
                        keyExtractor={(item) => item.unit_id}
                        renderItem={({ item }) => (
                            <TouchableOpacity 
                                style={styles.modalItem}
                                onPress={() => handleComponentUnitSelect(item)}
                            >
                                <Text style={styles.modalItemText}>{item.unit_name} ({item.abbreviation || 'N/A'})</Text>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={<Text style={styles.emptyListText}>No units found.</Text>}
                    />
                     <TouchableOpacity 
                        style={styles.closeButton}
                        onPress={() => setComponentUnitModalVisible(false)}
                    >
                        <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>

    </SafeAreaView>
  );
};

// --- Styles (Keep existing styles, add/modify as needed) --- 
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    paddingHorizontal: SIZES.padding * 1.5, // Adjust horizontal padding
    paddingTop: 0, // Set paddingTop to 0 to remove space below header
    paddingBottom: SIZES.padding * 5, // Ensure space for save button
  },
  inputGroup: {
    marginBottom: SIZES.padding * 1.8, // Increase bottom margin for spacing
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SIZES.padding, // Add gap between items in a row
  },
  columnFlex: { // New style for columns in a row
    flex: 1,
  },
  label: {
    ...FONTS.body3,
    color: COLORS.textLight,
    marginBottom: SIZES.base * 0.8, // Slightly smaller margin below label
  },
  input: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 0.75,
    ...FONTS.body3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 0.75, // Match input padding
    minHeight: 48, // Ensure consistent height with TextInput
  },
  pickerText: {
    ...FONTS.body3,
    color: COLORS.text,
  },
  placeholderText: {
    color: COLORS.placeholder,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius,
    padding: SIZES.padding * 2,
    width: '90%',
    maxHeight: '80%',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    ...FONTS.h3,
    color: COLORS.white,
    marginBottom: SIZES.padding * 1.5,
    textAlign: 'center',
  },
  modalItem: {
    paddingVertical: SIZES.padding, 
  },
  modalItemText: { 
    fontSize: SIZES.font,
    color: COLORS.white,
  },
  closeButton: {
    backgroundColor: COLORS.primary,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    marginTop: SIZES.padding * 2,
  },
  closeButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '600',
  },
  emptyListText: { // Style for empty lists in modals or main list
    ...FONTS.body3,
    color: COLORS.textLight,
    textAlign: 'center',
    paddingVertical: SIZES.padding * 2, // Add padding
    fontStyle: 'italic',
  },
  searchInput: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 0.75,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.padding,
    fontSize: SIZES.font,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    ...FONTS.h3,
    color: COLORS.text,
    marginBottom: SIZES.padding,
    marginTop: SIZES.base, 
  },
  componentItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SIZES.base, // Add space below each component item
  },
  componentNameText: {
    ...FONTS.body3,
    color: COLORS.text,
    flex: 1, // Allow name to take up space
    marginRight: SIZES.base,
  },
  componentControlsContainer: { // Container for amount, unit, remove
    flexDirection: 'row',
    alignItems: 'center',
  },
  componentInputAmount: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 50,
    textAlign: 'right',
    fontSize: SIZES.font,
  },
  componentUnitTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2, 
    marginLeft: SIZES.base,
    minHeight: 36, // Make trigger slightly shorter than amount input
    minWidth: 60, // Ensure minimum width
  },
  removeButton: {
    paddingLeft: SIZES.base, // Space before remove icon
  },
  button: {
    padding: SIZES.padding * 1.5,
    borderRadius: SIZES.radius * 2,
    alignItems: 'center',
    marginTop: SIZES.padding,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    ...SHADOWS.medium, // Add shadow for emphasis
  },
  buttonText: {
    ...FONTS.h3,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.primary,
    borderWidth: 1,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    marginTop: SIZES.padding,
  },
  addButtonText: {
    color: COLORS.primary,
    ...FONTS.body3,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  toggleBtn: {
    padding: SIZES.padding,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
  },
  toggleBtnActive: {
    backgroundColor: COLORS.primary,
  },
  toggleText: {
    ...FONTS.body3,
    color: COLORS.text,
    textAlign: 'center', // Center text in toggle button
  },
  toggleTextActive: {
    fontWeight: 'bold',
    color: COLORS.white, // Ensure active text is white
  },
  componentsSection: { // Style for the moved components section
    marginBottom: SIZES.padding * 1.8, // Add margin below the whole section
  },
  // --- Styles for Directions List ---
  directionStepContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start', // Align items to the top for multiline text
    marginBottom: SIZES.base, // Space between steps
  },
  stepNumber: {
    ...FONTS.body3,
    color: COLORS.textLight,
    marginRight: SIZES.base,
    paddingTop: SIZES.padding * 0.75, // Align with TextInput padding
    lineHeight: SIZES.padding * 1.5, // Adjust line height for centering
  },
  directionInput: {
    flex: 1, // Take remaining space
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 0.75,
    ...FONTS.body3,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 48, // Match other inputs
    textAlignVertical: 'top', // For multiline
  },
  removeStepButton: {
    marginLeft: SIZES.base,
    paddingTop: SIZES.padding * 0.75, // Align with TextInput padding
    justifyContent: 'center',
  },
  addStepButton: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.primary,
    borderWidth: 1,
    padding: SIZES.padding * 0.75,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    marginTop: SIZES.base, // Space above add button
  },
  addStepButtonText: {
    color: COLORS.primary,
    ...FONTS.body3,
    fontWeight: '600',
  },
  linkText: { textDecorationLine: 'underline', color: COLORS.primary },
});

// Rename export
export default CreateRecipeScreen; 