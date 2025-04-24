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
import { Unit, MenuSection, Ingredient, RecipeKind, ParsedIngredient, Preparation, ComponentInput } from '../types';
import { useMenuSections, useUnits, useIngredients, useDishDetail, usePreparationDetail } from '../hooks/useSupabase';
import { useLookup } from '../hooks/useLookup';
import AppHeader from '../components/AppHeader';
import { TextInputChangeEventData } from 'react-native';
import PreparationCard from '../components/PreparationCard';
import { DishComponent } from '../types';
import ScaleSliderInput from '../components/ScaleSliderInput';
import { formatQuantityAuto, capitalizeWords } from '../utils/textFormatters';
import { useTranslation } from 'react-i18next';

type CreateRecipeNavigationProp = StackNavigationProp<RootStackParamList>;
// Define RouteProp type for this screen
type CreateRecipeRouteProp = RouteProp<RootStackParamList, 'CreateRecipe'>;

// Rename screen component
const CreateRecipeScreen = () => {
  const navigation = useNavigation<CreateRecipeNavigationProp>();
  // Get route params
  const route = useRoute<CreateRecipeRouteProp>();
  const { t } = useTranslation(); // MOVED HOOK CALL HERE
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

  // Add lookup hooks
  const { checkDishNameExists, lookupIngredient, checkPreparationNameExists, checkIngredientNameExists } = useLookup();

  // --- Form State --- 
  const [recipeKind, setRecipeKind] = useState<RecipeKind>('dish');
  const [dishName, setDishName] = useState('');
  const [menuSectionId, setMenuSectionId] = useState<string | null>(null);
  const [directions, setDirections] = useState<string[]>(['']);
  const [totalTimeHours, setTotalTimeHours] = useState('0'); // Store time parts
  const [totalTimeMinutes, setTotalTimeMinutes] = useState('30');
  const [numServings, setNumServings] = useState(1); // Target servings (number)
  const [originalServings, setOriginalServings] = useState(1); // Base servings for scaling
  const [servingSize, setServingSize] = useState('1');
  const [servingUnitId, setServingUnitId] = useState<string | null>(null);
  const [cookingNotes, setCookingNotes] = useState('');
  const [servingItem, setServingItem] = useState(''); // State for serving item description
  
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
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Add state for unit modal related to components
  const [componentUnitModalVisible, setComponentUnitModalVisible] = useState(false);
  const [currentManagingComponentKey, setCurrentManagingComponentKey] = useState<string | null>(null);

  // State for Serving Item logic
  const [servingItemPickerVisible, setServingItemPickerVisible] = useState(false);
  const [pieceUnitId, setPieceUnitId] = useState<string | null>(null);

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
      const initialDishServings = (dishToEdit as any).num_servings ?? 1;
      setNumServings(initialDishServings); // Set number
      setOriginalServings(initialDishServings); // Set number
      setCookingNotes(dishToEdit.cooking_notes || '');
      setServingItem((dishToEdit as any).serving_item || ''); // Populate serving item
      
      // Populate components including the 'item' field
      const loadedComponents: ComponentInput[] = dishToEdit.components.map((comp, index) => ({
        key: `loaded-${comp.ingredient_id}-${index}`, // Generate a unique key
        ingredient_id: comp.ingredient_id,
        name: comp.name || 'Unknown Component', 
        amount: String(comp.amount || ''),
        unit_id: comp.unit?.unit_id || null,
        isPreparation: comp.isPreparation || false,
        item: comp.item || null, // <-- ADDED: Populate item
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
      
      // Populate components (ingredients of the preparation) including 'item'
      const loadedComponents: ComponentInput[] = prepComponentsToEdit.map((comp, index) => ({
          key: `loaded-prep-${comp.ingredient_id}-${index}`, // Generate a unique key
          ingredient_id: comp.ingredient_id,
          name: comp.name || 'Unknown Ingredient', 
          amount: String(comp.amount || ''),
          unit_id: comp.unit?.unit_id || null,
          isPreparation: false, // Ingredients within a prep are not themselves preps in this context
          item: (comp as any).item || null, // <-- ADDED: Populate item (cast if needed)
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
    const initialParsedServings = parsedRecipe.num_servings ?? 1;
    setNumServings(initialParsedServings); // Set number
    setOriginalServings(initialParsedServings); // Set number
    setServingItem(parsedRecipe.serving_item || ''); // Populate serving item

    // Populate components - **Attempt to match units and populate item**
    const initialComponents: ComponentInput[] = (parsedRecipe.components || []).map((ing, index) => {
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
            originalPrep: ing.ingredient_type?.toLowerCase() === 'preparation' ? (ing as ParsedIngredient) : undefined,
            subIngredients: ing.ingredient_type?.toLowerCase() === 'preparation' ? (ing.components ?? null) : null, // Store sub-ingredients if it's a prep
            item: ing.item || null, // <-- MODIFIED: Copy item description (was already there)
            reference_ingredient: ing.ingredient_type === 'Preparation' ? ing.reference_ingredient : null,  // ADDED: Store reference ingredient
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

  // Effect to find the unit ID for 'piece' or 'count'
  useEffect(() => {
    if (!loadingUnits && units.length > 0 && !pieceUnitId) {
      const countUnit = units.find(u => 
        u.unit_name.toLowerCase() === 'piece' || 
        u.unit_name.toLowerCase() === 'count' ||
        u.abbreviation?.toLowerCase() === 'x'
      );
      setPieceUnitId(countUnit?.unit_id || null);
    }
  }, [units, loadingUnits, pieceUnitId]);

  // Replace the component search effect with a function
  const searchIngredients = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setSearchLoading(true);
    try {
      const results = await lookupIngredient(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching ingredients:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [lookupIngredient]);

  // Debounce the ingredient search
  useEffect(() => {
    const handler = setTimeout(() => {
      searchIngredients(componentSearchQuery);
    }, 300);
    
    return () => clearTimeout(handler);
  }, [componentSearchQuery, searchIngredients]);

  // --- Handlers (Placeholder/Basic Structure) --- 

  // Enhance handleAddComponent to better handle UUIDs
  const handleAddComponent = async (selectedIngredient: any) => {
    const ingredient_id = selectedIngredient?.ingredient_id || '';
    const name = selectedIngredient?.name || '';
    
    if (!name.trim()) {
      console.error('Cannot add component: Missing name', selectedIngredient);
      Alert.alert(t('common.error'), t('alerts.errorAddComponentMissingName')); 
      return;
    }

    // If creating a new ingredient, check if it already exists
    if (!ingredient_id) {
      try {
        const nameExists = await checkIngredientNameExists(name.trim());
        if (nameExists) {
          Alert.alert(
            t('alerts.duplicateIngredientTitle'), 
            t('alerts.duplicateIngredientMessage', { name: name.trim() }), 
            [
              { 
                text: t('common.ok'), 
                onPress: () => {
                  // Reset search to help them find the existing ingredient
                  setComponentSearchQuery(name.trim());
                }
              }
            ]
          );
          return;
        }
      } catch (error) {
        console.error(`Failed to check for duplicate ingredient name "${name}":`, error);
      }
    }

    // The isPreparation flag should be provided by the lookup function now
    const isPrep = !!selectedIngredient.isPreparation;
    
    setComponents(prev => [
        ...prev,
        {
            key: `component-${Date.now()}`, 
            ingredient_id: ingredient_id, 
            name: name,
            amount: '', // Start with empty amount
            unit_id: null, // Start with no unit selected
            isPreparation: isPrep,
        }
    ]);
    setComponentSearchModalVisible(false); // Close modal
    setComponentSearchQuery(''); // Reset search
  };

  // TODO: Implement handler to update amount/unit_id/item for a component in the list
  const handleComponentUpdate = (key: string, field: 'amount' | 'unit_id' | 'item', value: string | null) => { // <-- Added 'item'
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
      Alert.alert(t('alerts.missingInfoTitle'), t('alerts.enterRecipeName')); 
      return;
    }
    
    // Check for duplicate names when creating new entries (not when editing)
    if (!isEditing) {
      try {
        if (recipeKind === 'dish') {
          const nameExists = await checkDishNameExists(dishName.trim());
          if (nameExists) {
            Alert.alert(
              t('alerts.duplicateNameTitle'), 
              t('alerts.duplicateDishMessage', { name: dishName.trim() }) 
            );
            return;
          }
        } else if (recipeKind === 'preparation') {
          const nameExists = await checkPreparationNameExists(dishName.trim());
          if (nameExists) {
            Alert.alert(
              t('alerts.duplicateNameTitle'), 
              t('alerts.duplicatePrepMessage', { name: dishName.trim() }) 
            );
            return;
          }
        }
      } catch (error) {
        console.error('Failed to check for duplicate name:', error);
        // Continue with saving - better UX than preventing save if the check fails
      }
    }
    
    // Check for duplicate ingredient names when creating new ingredients
    for (const component of components) {
      if (!component.ingredient_id) {
        try {
          const nameExists = await checkIngredientNameExists(component.name.trim());
          if (nameExists) {
            Alert.alert(
              t('alerts.duplicateIngredientTitle'), 
              t('alerts.duplicateIngredientMessage', { name: component.name.trim() }) 
            );
            return;
          }
        } catch (error) {
          console.error(`Failed to check for duplicate ingredient name "${component.name}":`, error);
        }
      }
    }
    
    if (!servingUnitId) {
      Alert.alert(t('alerts.missingInfoTitle'), t('alerts.selectServingUnit')); s
      return;
    }
    // Validate components
    const invalidComponent = components.find(c => 
        !c.amount.trim() || isNaN(parseFloat(c.amount)) || parseFloat(c.amount) <= 0 || !c.unit_id
    );
    if (invalidComponent) {
        Alert.alert(t('alerts.invalidComponentTitle'), t('alerts.invalidComponentMessage', { name: invalidComponent.name })); s
        return;
    }
    if (components.length === 0) {
        Alert.alert(t('alerts.missingComponentsTitle'), t('alerts.addOneComponent')); s
        return;
    }
    // Validate time inputs
    const hours = parseInt(totalTimeHours); 
    const minutes = parseInt(totalTimeMinutes);
    if (isNaN(hours) || hours < 0 || isNaN(minutes) || minutes < 0 || minutes >= 60) {
        Alert.alert(t('alerts.invalidTimeTitle'), t('alerts.invalidTimeMessage')); s
        return;
    }
    // Validate numServings (now a number state)
    if (isNaN(numServings) || numServings <= 0) {
        Alert.alert(t('alerts.invalidServingsTitle'), t('alerts.invalidServingsMessage')); s
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
      
      // --- Validate and prepare component data --- 
      for (const component of components) {
        if (!component.unit_id) {
          throw new Error(`Missing unit ID for component: ${component.name}`);
        }
      }
      
      // --- Create any new ingredients first ---
      const componentsToSave = [];
      for (const component of components) {
        if (!component.ingredient_id) {
          try {
            // If this component is a NEW preparation and we have the full parsed details, create it (and its nested structure) recursively.
            if (component.isPreparation && component.originalPrep) {
              console.log(`Creating full nested preparation for component: ${component.name}`);
              const newPrepId = await createParsedPreparation(component.originalPrep);
              component.ingredient_id = newPrepId;
              console.log(`Nested preparation created with ID: ${newPrepId}`);
            } else {
              // Otherwise, fall back to creating a simple ingredient entry (and optionally a blank preparation).
              if (!component.unit_id) {
                throw new Error(`Cannot create ingredient: Missing unit for ${component.name}`);
              }
              const { data: newIngredient, error: newIngError } = await supabase
                .from('ingredients')
                .insert({
                  name: component.name.trim(),
                  unit_id: component.unit_id,
                  amount: 0,
                })
                .select('ingredient_id')
                .single();
              if (newIngError) throw newIngError;
              if (!newIngredient) throw new Error(`Failed to create new ingredient: ${component.name}`);
              component.ingredient_id = newIngredient.ingredient_id;
              console.log(`Created new ingredient with ID: ${newIngredient.ingredient_id}`);

              // If the user flagged it as a preparation but we don't have full details, create a basic preparation row.
              if (component.isPreparation) {
                console.log(`Creating basic preparation entry for ID: ${newIngredient.ingredient_id}`);
                const { error: prepInsertError } = await supabase
                  .from('preparations')
                  .insert({
                    preparation_id: newIngredient.ingredient_id,
                    directions: '',
                    total_time: 0,
                  });
                if (prepInsertError) throw prepInsertError;
                console.log('Basic preparation entry created.');
              }
            }
          } catch (error: any) {
            console.error(`Error creating component ${component.name}:`, error);
            throw new Error(`Failed to create component ${component.name}: ${error.message || 'Unknown error'}`);
          }
        }

        // After ensuring ingredient_id exists, push to componentsToSave
        componentsToSave.push({
          ingredient_id: component.ingredient_id,
          amount: parseFloat(component.amount) * (originalServings > 0 ? numServings / originalServings : 1),
          unit_id: component.unit_id,
          item: component.item || null, // <-- ADDED: Include item in saved data
        });
      }
      
      // Log data before sending
      console.log('Recipe data to be saved:', {
          dish_name: dishName.trim(),
          menu_section_id: menuSectionId,
          serving_unit_id: servingUnitId,
          serving_size: servingSizeNum,
          components: componentsToSave
      });

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
              num_servings: numServings,
              serving_size: servingSizeNum ?? undefined, 
              serving_unit_id: servingUnitId, 
              serving_item: servingItem.trim() || undefined,
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
          Alert.alert(t('common.success'), t('alerts.dishUpdateSuccess')); s

        } else if (preparationIdToEdit) {
          console.log("Updating preparation:", preparationIdToEdit);

          // Update preparations table (directions, time, yield)
          const { error: prepUpdateError } = await supabase
            .from('preparations')
            .update({ 
              directions: formattedDirections || undefined, 
              // Calculate total minutes for preparation update
              total_time: (parseInt(totalTimeHours) * 60 + parseInt(totalTimeMinutes)) || undefined, 
              num_servings: numServings,
              serving_size: servingSizeNum ?? undefined,
              amount_unit_id: servingUnitId,
              reference_ingredient: (prepToEdit && prepToEdit.reference_ingredient) ? prepToEdit.reference_ingredient : "",
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
          Alert.alert(t('common.success'), t('alerts.prepUpdateSuccess')); s

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
        // --- INSERT LOGIC --- 
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
                    num_servings: numServings,
                    serving_size: servingSizeNum ?? undefined,
                    serving_unit_id: servingUnitId, // Already validated
                    serving_item: servingItem.trim() || undefined,
                    cooking_notes: cookingNotes.trim() || undefined
                })
                .select('dish_id') // Select the DB-generated ID
                .single();

                if (dishError) {
                  console.error('Error inserting dish:', dishError);
                  throw dishError;
                }
                if (!dishInsertData || !dishInsertData.dish_id) throw new Error('Failed to insert dish or retrieve dish ID');
                
                const newDishId = dishInsertData.dish_id;
                console.log('Dish inserted with ID:', newDishId);

                // Insert into 'dish_components' table
                if (componentsToSave.length > 0) {
                    try {
                      const componentsToInsert = componentsToSave.map(c => ({ 
                          ...c,
                          dish_id: newDishId
                      })); 
                      console.log('Inserting dish components:', componentsToInsert);
                      
                      // Insert components one by one to better handle errors
                      for (const component of componentsToInsert) {
                        const { error: componentError } = await supabase
                          .from('dish_components')
                          .insert(component);
                          
                        if (componentError) {
                          console.error(`Error inserting component ${component.ingredient_id}:`, componentError);
                          // Continue with other components instead of failing completely
                        }
                      }
                    } catch (componentsError) {
                        console.error("Error inserting components:", componentsError);
                        // Don't rethrow - the dish was created, components can be added later
                        Alert.alert(t('common.warning'), t('alerts.dishCreateWarnComponents')); s
                    }
                }
                Alert.alert(t('common.success'), t('alerts.dishCreateSuccess')); s
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

                if (ingredientError) {
                    console.error("Error inserting base ingredient for preparation:", ingredientError);
                    throw ingredientError;
                }
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
                        num_servings: numServings,
                        serving_size: servingSizeNum ?? undefined,
                        amount_unit_id: servingUnitId,
                        reference_ingredient: (preparationsList.length > 0 && preparationsList[0].reference_ingredient) 
                            ? preparationsList[0].reference_ingredient 
                            : "",
                    });

                if (prepError) {
                    console.error("Error inserting preparation details:", prepError);
                    throw prepError;
                }
                console.log('Preparation details inserted for ID:', newPreparationId);

                // 3. Insert into 'preparation_ingredients' table
                if (componentsToSave.length > 0) {
                    const prepComponentsToInsert = componentsToSave.map(c => ({ 
                        ...c, 
                        preparation_id: newPreparationId 
                    }));
                    console.log("Inserting preparation ingredients:", JSON.stringify(prepComponentsToInsert));
                    const { error: prepComponentsError } = await supabase
                        .from('preparation_ingredients')
                        .insert(prepComponentsToInsert);
                    if (prepComponentsError) {
                        console.error("Error inserting preparation ingredients:", prepComponentsError);
                        throw prepComponentsError;
                    }
                }
                Alert.alert(t('common.success'), t('alerts.prepCreateSuccess')); s
            }
            
            // Common navigation for successful creation
            navigation.goBack(); 
        }

    } catch (error: any) {
        console.error("Error saving recipe:", error);
        Alert.alert(t('alerts.errorSavingRecipeTitle'), error.message || t('alerts.errorSavingRecipeDefault')); s
    } finally {
        setSubmitting(false);
    }
  };

  const createParsedIngredient = async (ing: ParsedIngredient): Promise<string> => {
      // Check for duplicate ingredient name
      try {
        const nameExists = await checkIngredientNameExists(ing.name.trim());
        if (nameExists) {
          // If ingredient already exists, fetch its ID instead of creating a new one
          const { data: existingIng, error: lookupErr } = await supabase
            .from('ingredients')
            .select('ingredient_id')
            .ilike('name', ing.name.trim())
            .limit(1)
            .single();
            
          if (!lookupErr && existingIng) {
            console.log(`Using existing ingredient "${ing.name}" with ID: ${existingIng.ingredient_id}`);
            return existingIng.ingredient_id;
          }
          // Fall through to creation if lookup fails
        }
      } catch (error) {
        console.error(`Error checking if ingredient "${ing.name}" exists:`, error);
        // Continue with creation if check fails
      }
      
      // returns ingredient_id
      // map unit
      let unitId: string | null = null;
      const parsedUnit = ing.unit?.toLowerCase().trim();
      if (parsedUnit) {
         const found = units.find(u => u.unit_name.toLowerCase() === parsedUnit || u.abbreviation?.toLowerCase() === parsedUnit);
         unitId = found?.unit_id || null;
      }
      // Ensure unitId is always a valid UUID, not empty string
      if (!unitId && units.length > 0) {
        unitId = units[0].unit_id;
      }
      
      // Extra validation to absolutely prevent empty string UUIDs
      if (!unitId || unitId === '') {
        throw new Error("Invalid input syntax for type uuid: Cannot use empty string as unit_id");
      }
      
      // insert ingredient
      const { data: ingInsert, error: ingErr } = await supabase
        .from('ingredients')
        .insert({ 
          name: ing.name.trim(), 
          unit_id: unitId, // Now guaranteed to be a valid string
          amount: ing.amount ?? 1 
        })
        .select('ingredient_id')
        .single();
      if (ingErr || !ingInsert) throw new Error(ingErr?.message || 'Failed to insert ingredient');
      return ingInsert.ingredient_id;
   };

   const createParsedPreparation = async (prep: ParsedIngredient): Promise<string> => {
       // Check for duplicate preparation name
       try {
         const nameExists = await checkPreparationNameExists(prep.name.trim());
         if (nameExists) {
           // If preparation already exists, fetch its ID instead of creating a new one
           const { data: existingPrep, error: lookupErr } = await supabase
             .from('ingredients')
             .select('ingredient_id')
             .ilike('name', prep.name.trim())
             .limit(1)
             .single();
             
           if (!lookupErr && existingPrep) {
             // Check if it's actually a preparation
             const { data: prepCheck, error: prepCheckErr } = await supabase
               .from('preparations')
               .select('preparation_id')
               .eq('preparation_id', existingPrep.ingredient_id)
               .limit(1);
               
             if (!prepCheckErr && prepCheck && prepCheck.length > 0) {
               console.log(`Using existing preparation "${prep.name}" with ID: ${existingPrep.ingredient_id}`);
               return existingPrep.ingredient_id;
             }
             // If it's an ingredient but not a preparation, we should create a new preparation
           }
           // Fall through to creation if lookup fails or it's not a preparation
         }
       } catch (error) {
         console.error(`Error checking if preparation "${prep.name}" exists:`, error);
         // Continue with creation if check fails
       }
       
       // create base ingredient first
       const baseId = await createParsedIngredient(prep);
       // insert into preparations table
       const { error: prepErr } = await supabase
         .from('preparations')
         .insert({ 
           preparation_id: baseId, 
           directions: (prep as any).instructions?.join('\n') || '', 
           total_time: 0, 
           reference_ingredient: prep.reference_ingredient || ''
         });
       if (prepErr) throw new Error(prepErr.message);
       // insert sub ingredients
       const subIngs = (prep as any).components as ParsedIngredient[] | undefined;
       if (subIngs && subIngs.length > 0) {
          for (const sub of subIngs) {
             try {
                const childId = sub.ingredient_type === 'Preparation' ? 
                    await createParsedPreparation(sub) : 
                    await createParsedIngredient(sub);
                
                // Ensure we have a valid unit_id for the sub-ingredient
                let subUnitId = null;
                if (units.length > 0) {
                    // Try to match the parsed unit name with available units
                    if (sub.unit) {
                        const parsedSubUnit = sub.unit.toLowerCase().trim();
                        const foundUnit = units.find(u => 
                            u.unit_name.toLowerCase() === parsedSubUnit || 
                            u.abbreviation?.toLowerCase() === parsedSubUnit
                        );
                        if (foundUnit) {
                            subUnitId = foundUnit.unit_id;
                        }
                    }
                    
                    // If no match found, use first available unit
                    if (!subUnitId) {
                        subUnitId = units[0].unit_id;
                    }
                    
                    console.log(`Adding sub-ingredient ${sub.name} (ID: ${childId}) with unit ${subUnitId}`);
                    
                    const { error: subIngError } = await supabase
                        .from('preparation_ingredients')
                        .insert({ 
                            preparation_id: baseId, 
                            ingredient_id: childId, 
                            amount: sub.amount ?? 1, 
                            unit_id: subUnitId
                        });
                        
                    if (subIngError) {
                        console.error(`Error adding sub-ingredient ${sub.name}:`, subIngError);
                        throw new Error(subIngError.message);
                    }
                } else {
                    console.error('No units available for sub-ingredient:', sub.name);
                    throw new Error('No units available for sub-ingredient: ' + sub.name);
                }
             } catch (error) {
                console.error('Error processing sub-ingredient:', sub.name, error);
                throw error;
             }
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

  const handlePrepSelect = (prep: ParsedIngredient) => {
    const { scaleMultiplier } = route.params || {};
    navigation.navigate('CreatePreparation', { preparation: prep, scaleMultiplier });
  };

  const handleRemoveIngredient = (index: number) => {
    // ... existing code ...
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      {/* Update Header Title Dynamically */}
      <AppHeader 
        title={t(isEditing ? (dishIdToEdit ? 'screens.createRecipe.editDishTitle' : 'screens.createRecipe.editPreparationTitle') : (isConfirming ? 'screens.createRecipe.confirmParsedTitle' : 'screens.createRecipe.createTitle'))} 
        showBackButton={true} 
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled" // Closes keyboard when tapping outside inputs
        >
          {/* Recipe Name Input */}
          <Text style={styles.label}>{t('screens.createRecipe.nameLabel')}</Text>
          <TextInput 
              style={styles.input}
              placeholder={t('screens.createRecipe.namePlaceholder')}
              placeholderTextColor={COLORS.placeholder}
              value={dishName}
              onChangeText={setDishName}
          />

          {/* --- Scale Slider --- */}
          {originalServings > 0 && ( // Only show slider if original servings are known
          <View style={styles.scalingSection}>
            <ScaleSliderInput
              label={t('screens.createRecipe.adjustServingsLabelProportions')} 
              minValue={1} // Minimum 1 serving
              maxValue={Math.max(10, Math.ceil(originalServings * 5))} // Sensible max
              step={1} // Step by whole servings
              currentValue={numServings} // Use target servings state
              displayValue={String(numServings)} // Display target servings
              displaySuffix={t('common.servings')} 
              onValueChange={(value) => setNumServings(Math.round(value))} // Update target servings (rounded)
              onSlidingComplete={(value) => setNumServings(Math.round(value))} // Final update (rounded)
              onTextInputChange={(text) => { // Handle direct text input for servings
                const newServings = parseInt(text, 10);
                if (!isNaN(newServings) && newServings >= 1) {
                  const maxSliderValue = Math.max(10, Math.ceil(originalServings * 5));
                  setNumServings(Math.min(newServings, maxSliderValue)); // Clamp
                } else if (text === '') {
                  setNumServings(originalServings); // Reset to original if cleared
                }
              }}
            />
          </View>
          )}

          {/* Display total yield calculated from the target servings */}
          {originalServings > 0 && typeof parseFloat(servingSize) === 'number' && servingUnitId && (
            (() => {
              const targetServings = numServings; // Already a number
              const servingSizeNum = parseFloat(servingSize);
              const totalYieldAmount = servingSizeNum * targetServings;
              const yieldUnit = units.find(u => u.unit_id === servingUnitId);
              const yieldUnitAbbr = yieldUnit?.abbreviation || yieldUnit?.unit_name || '';
              const itemForYield = servingItem.trim() || null; // Use the state value directly
              const formattedTotalYield = formatQuantityAuto(totalYieldAmount, yieldUnitAbbr, itemForYield);
              if (formattedTotalYield.amount !== 'N/A' && totalYieldAmount > 0) {
                return (
                  <Text style={styles.calculatedYieldText}>
                    (Yields: {formattedTotalYield.amount} {formattedTotalYield.unit} total)
                  </Text>
                );
              }
              return null;
            })()
          )}

          {/* Serving Size & Unit Inputs Row */}
          <View style={[styles.rowContainer, styles.inputGroup]}>
              <View style={styles.columnFlex}>
                  <Text style={styles.label}>{t('screens.createRecipe.servingSizeLabel')}</Text>
                  <TextInput 
                      style={styles.input}
                      placeholder={t('screens.createRecipe.servingSizePlaceholder')}
                      placeholderTextColor={COLORS.placeholder}
                      value={servingSize}
                      onChangeText={setServingSize}
                      keyboardType="numeric"
                  />
              </View>
              <View style={styles.columnFlex}>
                  <Text style={styles.label}>{t('screens.createRecipe.servingUnitLabel')}</Text>
                  <TouchableOpacity style={styles.pickerTrigger} onPress={openServingUnitSelector}>
                      <Text style={[styles.pickerText, !servingUnitId && styles.placeholderText]}>
                           {selectedServingUnitName}
                      </Text>
                       <MaterialCommunityIcons name="chevron-down" size={24} color={COLORS.textLight} />
                  </TouchableOpacity>
              </View>
          </View>

          {/* Serving Item Input (Conditionally Rendered) */}
          {servingUnitId === pieceUnitId && (
            <View style={styles.inputGroup}> 
              <Text style={styles.label}>{t('screens.createRecipe.servingIngredientLabel')}</Text>
              <View style={styles.servingItemRow}>
                <TextInput 
                    style={styles.servingItemInput} // Use new style for flex layout
                    placeholder={t('screens.createRecipe.servingIngredientPlaceholder')}
                    placeholderTextColor={COLORS.placeholder}
                    value={servingItem}
                    onChangeText={setServingItem}
                />
                <TouchableOpacity 
                    style={styles.servingItemPickerButton}
                    onPress={() => setServingItemPickerVisible(true)}
                >
                    <MaterialCommunityIcons name="playlist-edit" size={24} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* --- Components Section (Moved) --- */}
          <View style={styles.componentsSection}>
            {/* Ingredients List */}
            <Text style={styles.sectionTitle}>{t('screens.createRecipe.ingredientsTitle')}</Text>
            {ingredientsList.length === 0 ? (
                <Text style={styles.emptyListText}>{t('screens.createRecipe.noRawIngredients')}</Text>
            ) : (
                ingredientsList.map((item) => (
                    // --- Render Scaled Raw Ingredient --- 
                    (() => {
                        const baseAmount = parseFloat(item.amount);
                        // Calculate scale dynamically
                        const currentScale = originalServings > 0 ? numServings / originalServings : 1;
                        const scaledAmount = isNaN(baseAmount) ? null : baseAmount * currentScale;
                        const unitAbbr = units.find(u => u.unit_id === item.unit_id)?.abbreviation || 'Unit';
                        // Pass item.item to formatQuantityAuto
                        const formattedDisplay = formatQuantityAuto(scaledAmount, unitAbbr, item.item);
                        
                        return (
                           <View key={item.key} style={styles.componentItemContainer}>
                                <Text style={styles.componentNameText}>{capitalizeWords(item.name)}</Text>
                                <View style={styles.componentControlsContainer}>
                                    {/* Editable Base Amount Input */}
                                    <TextInput
                                        style={styles.componentInputAmount} // Keep original style for base amount
                                        placeholder={t('common.amount')} // Generic amount placeholder
                                        placeholderTextColor={COLORS.placeholder}
                                        value={item.amount} // Bind to base amount string
                                        onChangeText={(value) => handleComponentUpdate(item.key, 'amount', value)}
                                        keyboardType="numeric"
                                    />
                                    {/* Unit selector */}
                                    <TouchableOpacity
                                        style={[styles.componentUnitTrigger, { marginLeft: SIZES.base }]} // Added margin
                                        onPress={() => openComponentUnitSelector(item.key)}
                                    >
                                        {/* Find unit abbreviation directly */}
                                        <Text style={[styles.pickerText, !item.unit_id && styles.placeholderText]}>
                                            {units.find(u => u.unit_id === item.unit_id)?.abbreviation || 'Unit'}
                                        </Text>
                                         <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.textLight} />
                                    </TouchableOpacity>

                                    {/* Conditionally Render Item Input */}
                                    {item.unit_id === pieceUnitId && (
                                       <TextInput
                                          style={styles.itemInput} // Style includes marginLeft/marginRight
                                          placeholder="(e.g., large)"
                                          placeholderTextColor={COLORS.placeholder}
                                          value={item.item || ''}
                                          onChangeText={(value) => handleComponentUpdate(item.key, 'item', value)}
                                       />
                                    )}

                                    {/* Remove Button */}
                                    <TouchableOpacity onPress={() => handleRemoveComponent(item.key)} style={styles.removeButton}>
                                        <MaterialCommunityIcons name="close-circle" size={24} color={COLORS.error} />
                                    </TouchableOpacity>
                                </View>
                           </View>
                        );
                    })()
                ))
            )}

            {/* Preparations List */}
            <Text style={styles.sectionTitle}>{t('screens.createRecipe.preparationsTitle')}</Text>
            {preparationsList.length === 0 ? (
                <Text style={styles.emptyListText}>{t('screens.createRecipe.noPreparations')}</Text>
            ) : (
                preparationsList.map((item) => (
                    // --- Render PreparationCard --- 
                    (() => {
                        // Map ComponentInput to DishComponent
                        // Note: Preparation details (sub-ingredients, directions, time) are NOT available in ComponentInput
                        //       So the card will only show name, yield, and potentially time if we add it to ComponentInput.
                        //       For now, prep details will be mostly empty when rendered here.
                        const prepUnit = units.find(u => u.unit_id === item.unit_id);
                        const prepAmountNum = parseFloat(item.amount);

                        const pseudoPreparationDetails: Preparation = {
                            preparation_id: item.ingredient_id,
                            name: item.name,
                            directions: null, // Not stored in ComponentInput
                            total_time: null, // Not stored in ComponentInput
                            yield_unit: prepUnit || null,
                            yield_amount: isNaN(prepAmountNum) ? null : prepAmountNum,
                            reference_ingredient: null, // Not stored
                            // Map stored parsed sub-ingredients (if any)
                            ingredients: (item.subIngredients || []).map(subIng => {
                                // Match unit for sub-ingredient
                                let matchedSubUnit: Unit | null = null;
                                const parsedSubUnit = subIng.unit?.toLowerCase().trim();
                                if (parsedSubUnit && units.length > 0) {
                                    const foundSubUnit = units.find(u => 
                                        u.unit_name.toLowerCase() === parsedSubUnit || 
                                        u.abbreviation?.toLowerCase() === parsedSubUnit
                                    );
                                    matchedSubUnit = foundSubUnit || null;
                                }
                                
                                return {
                                    preparation_id: item.ingredient_id, // Parent prep ID
                                    ingredient_id: subIng.name, // Use name as temp ID
                                    name: capitalizeWords(subIng.name),
                                    amount: subIng.amount,
                                    unit: matchedSubUnit
                                };
                            }),
                            cooking_notes: null // Not stored
                        };

                        const componentForCard: DishComponent = {
                            dish_id: '', // Not relevant here
                            ingredient_id: item.ingredient_id,
                            name: item.name,
                            amount: isNaN(prepAmountNum) ? null : prepAmountNum,
                            unit: prepUnit || null,
                            isPreparation: true,
                            preparationDetails: pseudoPreparationDetails,
                            rawIngredientDetails: null
                        };

                        // Calculate scale here, before returning JSX
                        const currentScale = originalServings > 0 ? numServings / originalServings : 1;

                        return (
                           <View key={item.key} style={styles.preparationCardContainer}>
                               <PreparationCard
                                   amountLabel={t('common.amount')} 
                                   component={componentForCard}
                                   onPress={() => {
                                       if(isConfirming && item.originalPrep) {
                                           navigation.navigate('CreatePreparation', { preparation: item.originalPrep, scaleMultiplier: currentScale });
                                       }
                                   }}
                                   // Pass the current scale multiplier to the card
                                   // Calculate scale dynamically
                                   scaleMultiplier={currentScale} 
                               />
                               {/* Keep remove button */}
                               <TouchableOpacity onPress={() => handleRemoveComponent(item.key)} style={styles.removeButtonPrepCard}>
                                   <MaterialCommunityIcons name="close-circle" size={24} color={COLORS.error} />
                               </TouchableOpacity>
                           </View>
                        );
                    })()
                ))
            )}

            {/* Add Component Button */}
            <TouchableOpacity
                style={styles.addButton}
                onPress={() => setComponentSearchModalVisible(true)}
            >
                <Text style={styles.addButtonText}>{t('screens.createRecipe.addIngredientPreparationButton')}</Text>
            </TouchableOpacity>
          </View>

          {/* Recipe Type Toggle */}
          <Text style={styles.label}>{t('screens.createRecipe.recipeTypeLabel')}</Text>
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
          <Text style={styles.label}>{t('screens.createRecipe.categoryLabel')}</Text>
          <TouchableOpacity style={[styles.pickerTrigger, styles.inputGroup]} onPress={openCategorySelector}>
              <Text style={[styles.pickerText, !menuSectionId && styles.placeholderText]}>
                  {selectedCategoryName}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={24} color={COLORS.textLight} />
          </TouchableOpacity>

          {/* Total Time Inputs Row */}
           <View style={[styles.rowContainer, styles.inputGroup]}>
              <View style={styles.columnFlex}>
                  <Text style={styles.label}>{t('screens.createRecipe.timeHoursLabel')}</Text>
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
                  <Text style={styles.label}>{t('screens.createRecipe.timeMinutesLabel')}</Text>
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
          <Text style={styles.label}>{t('screens.createRecipe.directionsLabel')}</Text>
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
              <Text style={styles.addStepButtonText}>{t('screens.createRecipe.addStepButton')}</Text>
            </TouchableOpacity>
          </View>

          {/* Cooking Notes Input */}
          <Text style={styles.label}>{t('screens.createRecipe.notesLabel')}</Text>
          <TextInput 
              style={[styles.input, styles.textArea, { minHeight: 60 }, styles.inputGroup]} // Shorter text area
              placeholder={t('screens.createRecipe.notesPlaceholder')}
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
              {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.buttonText}>{t(isEditing ? 'screens.createRecipe.updateRecipeButton' : (isConfirming ? 'screens.createRecipe.confirmSaveButton' : 'screens.createRecipe.saveRecipeButton'))}</Text>}
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
                    <Text style={styles.modalTitle}>{t('screens.createRecipe.selectComponentModalTitle')}</Text>
                    <TextInput
                        style={styles.searchInput}
                        placeholder={t('screens.createRecipe.searchComponentPlaceholder')}
                        value={componentSearchQuery}
                        onChangeText={setComponentSearchQuery}
                    />
                    {searchLoading ? (
                        <ActivityIndicator size="large" color={COLORS.primary} style={styles.searchLoader} />
                    ) : (
                        <FlatList
                            data={searchResults}
                            keyExtractor={(item, index) => item.ingredient_id || `search-result-${index}`} 
                            renderItem={({ item }) => (
                                <TouchableOpacity 
                                    style={styles.modalItem}
                                    onPress={() => handleAddComponent(item)} 
                                >
                                    <Text style={styles.modalItemText}>
                                        {item.name} {item.isPreparation ? t('screens.createRecipe.prepSuffix') : ''} 
                                    </Text> 
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                componentSearchQuery.trim() !== '' ? (
                                    <View>
                                        <Text style={styles.emptyListText}>
                                            {t('screens.createRecipe.searchNoResults')} 
                                        </Text>
                                        <TouchableOpacity 
                                            style={[styles.createNewButton, { marginTop: SIZES.padding }]}
                                            onPress={() => handleAddComponent({ 
                                                name: componentSearchQuery.trim(),
                                                isPreparation: false // New items are raw ingredients by default
                                            })}
                                        >
                                            <Text style={styles.createNewButtonText}>
                                                {t('screens.createRecipe.createButtonLabel', { query: componentSearchQuery.trim() })}  with interpolation
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <Text style={styles.emptyListText}>
                                        {t('screens.createRecipe.searchPlaceholderComponents')} 
                                    </Text>
                                )
                            }
                        />
                    )}
                    <TouchableOpacity 
                        style={styles.closeButton}
                        onPress={() => setComponentSearchModalVisible(false)}
                    >
                        <Text style={styles.closeButtonText}>{t('common.close')}</Text>
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
                    <Text style={styles.modalTitle}>{t('screens.createRecipe.selectCategoryModalTitle')}</Text>
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
                        ListEmptyComponent={<Text style={styles.emptyListText}>{t('screens.createRecipe.noCategoriesFound')}</Text>}
                    />
                     <TouchableOpacity 
                        style={styles.closeButton}
                        onPress={() => setCategoryModalVisible(false)}
                    >
                        <Text style={styles.closeButtonText}>{t('common.close')}</Text>
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
                    <Text style={styles.modalTitle}>{t('screens.createRecipe.selectServingUnitModalTitle')}</Text>
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
                        ListEmptyComponent={<Text style={styles.emptyListText}>{t('screens.createRecipe.noUnitsFound')}</Text>}
                    />
                    <TouchableOpacity 
                        style={styles.closeButton}
                        onPress={() => setServingUnitModalVisible(false)}
                    >
                        <Text style={styles.closeButtonText}>{t('common.close')}</Text>
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
                    <Text style={styles.modalTitle}>{t('screens.createRecipe.selectComponentUnitModalTitle')}</Text>
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
                        ListEmptyComponent={<Text style={styles.emptyListText}>{t('screens.createRecipe.noUnitsFound')}</Text>}
                    />
                     <TouchableOpacity 
                        style={styles.closeButton}
                        onPress={() => setComponentUnitModalVisible(false)}
                    >
                        <Text style={styles.closeButtonText}>{t('common.close')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>

        {/* Serving Item Component Picker Modal */}
        <Modal
            animationType="slide"
            transparent={true}
            visible={servingItemPickerVisible}
            onRequestClose={() => setServingItemPickerVisible(false)}
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>{t('screens.createRecipe.selectServingIngredientModalTitle')}</Text>
                    <FlatList
                        data={components} // Use the current components list
                        keyExtractor={(item) => item.key}
                        renderItem={({ item }) => (
                            <TouchableOpacity 
                                style={styles.modalItem}
                                onPress={() => {
                                    setServingItem(item.name); // Set the selected name
                                    setServingItemPickerVisible(false); // Close modal
                                }}
                            >
                                <Text style={styles.modalItemText}>{item.name} {item.isPreparation ? t('screens.createRecipe.prepSuffix') : ''}</Text> 
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={<Text style={styles.emptyListText}>{t('screens.createRecipe.noComponentsInRecipe')}</Text>}
                    />
                    <TouchableOpacity 
                        style={styles.closeButton}
                        onPress={() => setServingItemPickerVisible(false)}
                    >
                        <Text style={styles.closeButtonText}>{t('cancel')}</Text>
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
  readOnlyInput: {
    backgroundColor: COLORS.secondary,
    color: COLORS.textLight,
    borderColor: COLORS.secondary,
    marginRight: SIZES.base, // Add margin to separate from unit picker
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
    // Removed marginLeft, relying on marginRight of previous/next elements
    minHeight: 36, 
    minWidth: 60, 
  },
  itemInput: { // Style for the new item description input
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 80, // Adjust width as needed
    fontSize: SIZES.font,
    marginLeft: SIZES.base, // Add margin before this input
    marginRight: SIZES.base, // Add margin after this input
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
  preparationCardContainer: {
    marginBottom: SIZES.base,
    position: 'relative', // Needed for absolute positioning of remove button
  },
  removeButtonPrepCard: {
    position: 'absolute',
    top: SIZES.padding / 2,
    right: SIZES.padding / 2,
    backgroundColor: 'rgba(0,0,0,0.2)', // Slight background for visibility
    borderRadius: 12,
    padding: 2,
  },
  scalingSection: { // Style for the slider section
    marginVertical: SIZES.padding,
    paddingHorizontal: SIZES.padding / 2, // Add some horizontal padding
    marginBottom: SIZES.base, // Reduced space below slider
  },
  calculatedYieldText: {
    ...FONTS.body3,
    color: COLORS.textLight,
    marginTop: SIZES.base / 2, // Reduced space above yield text
    textAlign: 'center',
  },
  // Styles for Serving Item input row
  servingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  servingItemInput: {
    flex: 1, // Input takes most space
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 0.75,
    ...FONTS.body3,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SIZES.base, // Space before button
  },
  servingItemPickerButton: {
    padding: SIZES.base,
  },
  searchLoader: {
    marginVertical: SIZES.padding * 2,
  },
  createNewButton: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.primary,
    borderWidth: 1,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    marginHorizontal: SIZES.padding * 2,
  },
  createNewButtonText: {
    color: COLORS.primary,
    ...FONTS.body3,
    fontWeight: '600',
  },
});

// Rename export
export default CreateRecipeScreen; 