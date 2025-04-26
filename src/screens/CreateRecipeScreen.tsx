import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { Unit, MenuSection, Ingredient, RecipeKind, ParsedIngredient, ParsedRecipe, Preparation, ComponentInput, EditablePrepIngredient } from '../types';
import { useMenuSections, useUnits, useIngredients, useDishDetail, usePreparationDetail } from '../hooks/useSupabase';
import { useLookup } from '../hooks/useLookup';
import AppHeader from '../components/AppHeader';
import { TextInputChangeEventData } from 'react-native';
import PreparationCard from '../components/PreparationCard';
import { DishComponent } from '../types';
import ScaleSliderInput from '../components/ScaleSliderInput';
import { formatQuantityAuto, capitalizeWords } from '../utils/textFormatters';
import { useTranslation } from 'react-i18next';
// ADDED: Import new utility functions and lookup methods
import { slug, stripDirections, fingerprintPreparation } from '../utils/normalise';
import { 
  findDishByName, 
  findCloseIngredient, 
  checkIngredientNameExists, 
  checkPreparationNameExists,
  findPreparationByFingerprint 
} from '../data/dbLookup';
import { resolveIngredient, resolveDish, resolvePreparation } from '../services/duplicateResolver';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Database } from '../data/database.types'; // <-- CORRECTED IMPORT PATH

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

  // Get active kitchen ID from Redux
  const activeKitchenId = useSelector((state: RootState) => state.kitchens.activeKitchenId);

  // Temporary placeholder to satisfy references until refactor completes
  const saveDishLogic = async (_id?: string) => {};

  const existingId = useRef<string | undefined>(undefined);

  // MODIFIED: handlePrepSaveChanges - Store isDirty status
  const handlePrepSaveChanges = useCallback((prepKey: string, updatedState: {
    editableIngredients: EditablePrepIngredient[];
    prepUnitId: string | null;
    instructions: string[];
    isDirty: boolean; // Receive dirty status
  }) => {
    setComponents(prevComponents =>
      prevComponents.map(comp =>
        comp.key === prepKey
          ? {
              ...comp,
              prepStateEditableIngredients: updatedState.editableIngredients,
              prepStatePrepUnitId: updatedState.prepUnitId,
              prepStateInstructions: updatedState.instructions,
              prepStateIsDirty: updatedState.isDirty, // Store dirty status
            }
          : comp
      )
    );
    console.log(`Updated prep state for key ${prepKey}, isDirty: ${updatedState.isDirty}`); // Log update
  }, []); 

  const handlePrepSelect = useCallback((prepComponent: ComponentInput) => {
    if (!prepComponent.originalPrep) {
      console.warn('Cannot navigate to preparation: Missing originalPrep data');
      return;
    }
    // Calculate the scale multiplier based on the current recipe servings
    const currentRecipeScale = originalServings > 0 ? numServings / originalServings : 1;
    
    // Calculate the actual scaled amount of this prep component used in the dish
    const baseAmountNum = parseFloat(prepComponent.amount);
    const dishComponentScaledAmount = isNaN(baseAmountNum) ? null : baseAmountNum * currentRecipeScale;

    navigation.navigate('CreatePreparation', {
      preparation: prepComponent.originalPrep, 
      prepKey: prepComponent.key, 
      scaleMultiplier: currentRecipeScale, // Pass the recipe's scale factor
      onUpdatePrepAmount: handlePrepSaveChanges, 
      initialEditableIngredients: prepComponent.prepStateEditableIngredients,
      initialPrepUnitId: prepComponent.prepStatePrepUnitId,
      initialInstructions: prepComponent.prepStateInstructions,
      // Pass the calculated scaled amount
      dishComponentScaledAmount: dishComponentScaledAmount, 
    });
  }, [navigation, originalServings, numServings, handlePrepSaveChanges]); 

  // *** INSERT searchIngredients useCallback and useEffect HERE ***
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

  useEffect(() => {
    const handler = setTimeout(() => {
      searchIngredients(componentSearchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [componentSearchQuery, searchIngredients]);
  // *** END INSERTED CODE ***

  // --- Effects --- (Now defined AFTER ALL top-level hooks including search)
  useEffect(() => {
    const isLoading = loadingSections || loadingUnits || loadingComponents || (isEditing && (loadingDish || loadingPrep));
    setIsScreenLoading(isLoading);
  }, [loadingSections, loadingUnits, loadingComponents, isEditing, loadingDish, loadingPrep]);

  // Effect to populate form when editing data is loaded
  useEffect(() => {
    // Only run if editing and done loading
    if (!isEditing || isScreenLoading) return; 

    if (dishIdToEdit && dishToEdit) {
      console.log("[Edit Mode] Populating form for editing dish:", JSON.stringify(dishToEdit, null, 2)); // Log fetched dish data
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
      console.log("[Edit Mode] Raw dishToEdit.components:", JSON.stringify(dishToEdit.components, null, 2)); // Log components before mapping
      const loadedComponents: ComponentInput[] = dishToEdit.components.map((comp, index) => ({
        key: `loaded-${comp.ingredient_id}-${index}`, // Generate a unique key
        ingredient_id: comp.ingredient_id,
        name: comp.name || t('common.unknownComponent'), 
        amount: String(comp.amount || ''),
        unit_id: comp.unit?.unit_id || null,
        isPreparation: comp.isPreparation || false,
        item: comp.item || null, // Ensure item is mapped correctly
        // TODO: Need to potentially load prep state here if editing a dish containing preps
      }));
      console.log("[Edit Mode] Mapped loadedComponents:", JSON.stringify(loadedComponents, null, 2)); // Log components after mapping
      setComponents(loadedComponents);

    } else if (preparationIdToEdit && prepToEdit) {
      console.log("[Edit Mode] Populating form for editing preparation:", JSON.stringify(prepToEdit, null, 2)); // Log fetched prep data
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
      console.log("[Edit Mode] Raw prepComponentsToEdit:", JSON.stringify(prepComponentsToEdit, null, 2)); // Log components before mapping
      const loadedComponents: ComponentInput[] = prepComponentsToEdit.map((comp: any, index) => ({
          key: `loaded-prep-${comp.ingredient_id}-${index}`, // Generate a unique key
          ingredient_id: (comp as any).ingredient_id,
          name: comp.name || t('common.unknownIngredient'), 
          amount: String(comp.amount || ''),
          unit_id: comp.unit?.unit_id || null,
          isPreparation: false, // Ingredients within a prep are not themselves preps in this context
          item: (comp as any).item || null, // Ensure item is mapped (adjust type if needed)
      }));
      console.log("[Edit Mode] Mapped loadedComponents (from prep):", JSON.stringify(loadedComponents, null, 2)); // Log components after mapping
      setComponents(loadedComponents);
    }
    
  }, [isEditing, isScreenLoading, dishIdToEdit, dishToEdit, preparationIdToEdit, prepToEdit, prepComponentsToEdit, t]);

  // Add a separate effect to log the final state after update
  useEffect(() => {
    if (isEditing) {
      console.log("[Edit Mode] Final 'components' state:", JSON.stringify(components, null, 2));
    }
  }, [components, isEditing]);

  // Effect to populate form from parsed recipe data
  useEffect(() => {
    if (!isConfirming || isScreenLoading) return;
    if (!parsedRecipe) return; 

    console.log("Populating form from parsed recipe:", parsedRecipe);

    // --- Populate form fields directly (Dish Name, Directions, Time, Servings etc.) ---
    setRecipeKind('dish'); 
    setDishName(parsedRecipe.recipe_name || '');
    setDirections(parsedRecipe.instructions || ['']);
    const totalMinutes = parsedRecipe.total_time || 30;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    setTotalTimeHours(String(hours));
    setTotalTimeMinutes(String(minutes));
    setServingSize(String(parsedRecipe.serving_size || 1));
    setCookingNotes(parsedRecipe.cook_notes || '');
    const initialParsedServings = parsedRecipe.num_servings ?? 1;
    setNumServings(initialParsedServings);
    setOriginalServings(initialParsedServings);
    setServingItem(parsedRecipe.serving_item || '');
    // --- End Form Field Population ---

    // Declare matchedServingUnitId here, BEFORE mapParsedComponents is defined
    let matchedServingUnitId: string | null = null; 

    // --- Define mapParsedComponents INSIDE useEffect --- 
    const mapParsedComponents = async () => {
      const mappedComponents: ComponentInput[] = [];
      
      if (!parsedRecipe.components) {
        setComponents([]); 
        return;
      }
      
      const unitsMap = new Map<string, string>(); 
      units.forEach((u: Unit) => { 
        if(u.unit_name) unitsMap.set(u.unit_name.toLowerCase(), u.unit_id);
        if (u.abbreviation) unitsMap.set(u.abbreviation.toLowerCase(), u.unit_id);
      });

      // Match the top-level serving unit (assign to outer scope variable)
      const parsedServingUnit = parsedRecipe.serving_unit?.toLowerCase().trim();
      // Remove internal 'let' or 'const' declaration for matchedServingUnitId here
      if (parsedServingUnit && unitsMap.has(parsedServingUnit)) {
          matchedServingUnitId = unitsMap.get(parsedServingUnit) || null; // Assign to outer variable
          setServingUnitId(matchedServingUnitId); 
      } else if (parsedServingUnit) {
          console.warn(`Parsed serving unit "${parsedRecipe.serving_unit}" not found.`);
      }
      
      for (const ing of parsedRecipe.components) {
        let matchedIngredient = null;
        let matched = false;
        let matchedUnitId: string | null = null;
        let matchedPrepId: string | null = null; // Variable to hold matched prep ID
        
        try {
          if (ing.ingredient_type !== 'Preparation') {
            // Lookup for raw ingredients
            const closeMatches = await findCloseIngredient(ing.name);
            if (closeMatches.length > 0) {
              matchedIngredient = closeMatches[0];
              matched = true;
            }
          } else {
            // Lookup for existing preparations by name
            // Explicitly cast the awaited result, despite explicit typing before
            const result = await checkPreparationNameExists(ing.name) as (string | null);
            matchedPrepId = result;
            if (matchedPrepId) {
              console.log(`Matched existing preparation: ${ing.name} with ID: ${matchedPrepId}`);
              matched = true; // Mark as matched if prep found
            } else {
              console.log(`No existing preparation found for: ${ing.name}. Will be treated as new.`);
            }
          }
        } catch (error) { console.error(`Error matching component ${ing.name}:`, error); }
        
        const parsedUnit = ing.unit?.toLowerCase().trim();
        if (parsedUnit) {
            matchedUnitId = unitsMap.get(parsedUnit) || null;
        }

        let initialPrepStateIngredients: EditablePrepIngredient[] | null = null;
        let initialPrepStateUnitId: string | null = null;
        let initialPrepStateInstructions: string[] | null = null;

        if (ing.ingredient_type === 'Preparation') {
            initialPrepStateInstructions = ing.instructions || [];
            initialPrepStateUnitId = matchedUnitId; 
            initialPrepStateIngredients = [];
            if (ing.components) {
                for (const subIng of ing.components) {
                    let subMatchedIngredient = null;
                    let subMatched = false;
                    let subMatchedUnitId: string | null = null;
                    try {
                        const subCloseMatches = await findCloseIngredient(subIng.name);
                        if (subCloseMatches.length > 0) {
                            subMatchedIngredient = subCloseMatches[0];
                            subMatched = true;
                        }
                    } catch (error) { console.error(`Error matching sub-ingredient ${subIng.name}:`, error); }

                    const subParsedUnit = subIng.unit?.toLowerCase().trim();
                    if (subParsedUnit) {
                        subMatchedUnitId = unitsMap.get(subParsedUnit) || null;
                    }

                    initialPrepStateIngredients.push({
                        key: `prep-sub-${subIng.name}-${Date.now()}`,
                        ingredient_id: subMatched ? subMatchedIngredient?.ingredient_id : null,
                        name: subMatched ? subMatchedIngredient?.name || subIng.name : (subIng.name || 'Unknown Ingredient'),
                        amountStr: String(subIng.amount ?? ''),
                        unitId: subMatchedUnitId,
                        isPreparation: false, 
                        unit: subIng.unit, 
                        item: subIng.item,
                        reference_ingredient: null,
                        matched: subMatched, // This should be boolean, which it is
                    });
                }
            }
        }
        
        // Determine the final ingredient ID string
        const finalIngredientId = matchedPrepId ? matchedPrepId : (matchedIngredient?.ingredient_id ? matchedIngredient.ingredient_id : '');
        console.log(`[Map Flow] Determined finalIngredientId for ${ing.name}: ${finalIngredientId} (Type: ${typeof finalIngredientId})`); // Log ID before push

        mappedComponents.push({
          key: `parsed-${ing.name}-${Date.now()}`,
          ingredient_id: finalIngredientId, // Use the determined ID
          name: matchedIngredient?.name || ing.name, // Prefer matched name if raw ingredient was matched
          amount: String(ing.amount || ''), 
          unit_id: matchedUnitId, 
          isPreparation: ing.ingredient_type === 'Preparation',
          originalPrep: ing.ingredient_type?.toLowerCase() === 'preparation' ? (ing as ParsedIngredient) : undefined,
          subIngredients: ing.ingredient_type?.toLowerCase() === 'preparation' ? (ing.components ?? null) : null,
          item: ing.item || null,
          reference_ingredient: ing.ingredient_type === 'Preparation' ? ing.reference_ingredient : null,
          matched: matched,
          prepStateEditableIngredients: initialPrepStateIngredients,
          prepStatePrepUnitId: initialPrepStateUnitId, 
          prepStateInstructions: initialPrepStateInstructions,
        });
      }
      
      setComponents(mappedComponents);
    };
    // --- END mapParsedComponents Definition ---
    
    mapParsedComponents(); // Execute the async mapping function

    // Set default serving unit if it wasn't matched (use outer scope variable)
    if (!matchedServingUnitId && units.length > 0) { 
        const defaultUnit = units.find((u: Unit) => u.unit_name.toLowerCase() === 'serving') || units[0];
        setServingUnitId(defaultUnit?.unit_id || null);
    }

  }, [parsedRecipe, units, loadingUnits, findCloseIngredient, isConfirming, isScreenLoading, t]);

  // --- Handlers (Placeholder/Basic Structure) --- 

  // Enhance handleAddComponent to better handle UUIDs and duplicates
  const handleAddComponent = async (selectedIngredient: any) => {
    const ingredient_id = selectedIngredient?.ingredient_id || '';
    const name = selectedIngredient?.name || '';
    const trimmedName = name.trim();
    
    if (!trimmedName) {
      console.error('Cannot add component: Missing name', selectedIngredient);
      Alert.alert(t('common.error'), t('alerts.errorAddComponentMissingName')); 
      return;
    }

    // If we have an ID, add it directly (this came from search results)
    if (ingredient_id) {
      addComponentWithDetails(ingredient_id, trimmedName, !!selectedIngredient.isPreparation, true);
      return;
    }
    
    // No ID provided (user wants to create a new ingredient)
    try {
      // Use central duplicate resolver
      const result = await resolveIngredient(trimmedName, t);
      if (result.mode === 'existing' && result.id) {
        addComponentWithDetails(result.id, trimmedName, false, true);
        return;
      }
      // Otherwise treat as new
      addComponentWithDetails('', trimmedName, false, false);
    } catch (error) {
      console.error(`Error checking for similar/exact ingredients "${trimmedName}":`, error);
      Alert.alert(t('common.error'), t('alerts.errorCheckingDuplicates'));
      addComponentWithDetails('', trimmedName, false, false);
    }

    // Helper function to add the component with given details
    function addComponentWithDetails(id: string, name: string, isPrep: boolean, matched: boolean) {
      setComponents(prev => [
        ...prev,
        {
          key: `component-${id || 'new'}-${Date.now()}`, // Adjusted key
          ingredient_id: id, 
          name: name,
          amount: '', // Start with empty amount
          unit_id: null, // Start with no unit selected
          isPreparation: isPrep,
          matched: matched, // Add the matched flag
        }
      ]);
      setComponentSearchModalVisible(false); // Close modal
      setComponentSearchQuery(''); // Reset search
    }
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

  // MODIFIED: handleSaveDish - Check prepStateIsDirty
  const handleSaveDish = async () => {
    let dishIdToUse = dishIdToEdit; // Use editing ID by default
    let prepIdToUse = preparationIdToEdit;
    let shouldProceed = true;

    // --- 1. Validation & Resolution (New Section) ---
    if (!dishName.trim()) {
      Alert.alert(t('alerts.missingInfoTitle'), t('alerts.enterRecipeName'));
      return;
    }

    // Resolve Dish/Preparation Duplicates *before* other validation
    if (!isEditing) { // Only resolve duplicates when creating new
      if (recipeKind === 'dish') {
        const dishResolution = await resolveDish(dishName.trim(), t);
        switch (dishResolution.mode) {
          case 'overwrite':
            dishIdToUse = dishResolution.id ?? undefined; // Ensure it's string | undefined
            existingId.current = dishResolution.id ?? undefined; // Set the ref as well
            break;
          case 'new': // Treat cancel/rename manually as new for now
            break;
          default: // Should not happen for dishes
            shouldProceed = false;
            break;
        }
      } else { // recipeKind === 'preparation'
        const currentFingerprint = fingerprintPreparation(components, directions);
        const prepResolution = await resolvePreparation(dishName.trim(), currentFingerprint, null, t);
        switch (prepResolution.mode) {
          case 'existing': // Prep with same fingerprint exists
            Alert.alert(t('alerts.duplicatePreparationFingerprintMessage'));
            shouldProceed = false;
            break;
          case 'overwrite':
            prepIdToUse = prepResolution.id ?? undefined; // Ensure it's string | undefined
            existingId.current = prepResolution.id ?? undefined; // Also set ref for update logic
            break;
          case 'rename':
            if (prepResolution.newName) setDishName(prepResolution.newName);
            // Continue as 'new' but with the updated name
            break;
          case 'new': // User explicitly cancelled via prompt
            shouldProceed = false; 
            break;
          default:
            shouldProceed = false;
            break;
        }
      }
    }

    if (!shouldProceed) return; // Stop if resolution indicated cancellation or error

    // Continue with other validations (components, time, servings etc.)
    if (!servingUnitId) {
      Alert.alert(t('alerts.missingInfoTitle'), t('alerts.selectServingUnit'));
      return;
    }
    const invalidComponent = components.find(c =>
      !c.amount.trim() || isNaN(parseFloat(c.amount)) || parseFloat(c.amount) <= 0 || !c.unit_id
    );
    if (invalidComponent) {
      Alert.alert(t('alerts.invalidComponentTitle'), t('alerts.invalidComponentMessage', { name: invalidComponent.name }));
      return;
    }
    if (components.length === 0) {
      Alert.alert(t('alerts.missingComponentsTitle'), t('alerts.addOneComponent'));
      return;
    }
    const hours = parseInt(totalTimeHours);
    const minutes = parseInt(totalTimeMinutes);
    if (isNaN(hours) || hours < 0 || isNaN(minutes) || minutes < 0 || minutes >= 60) {
      Alert.alert(t('alerts.invalidTimeTitle'), t('alerts.invalidTimeMessage'));
      return;
    }
    if (isNaN(numServings) || numServings <= 0) {
      Alert.alert(t('alerts.invalidServingsTitle'), t('alerts.invalidServingsMessage'));
      return;
    }

    // --- Start Save Process ---
    setSubmitting(true);

    // --- Prepare common data needed for inserts/updates ---
      const timeString = `${String(totalTimeHours).padStart(2, '0')}:${String(totalTimeMinutes).padStart(2, '0')}:00`;
    let servingSizeNum: number | null = parseFloat(servingSize); // Use parseFloat
      if (isNaN(servingSizeNum) || servingSizeNum <= 0) servingSizeNum = null;
      const formattedDirections = directions.map(step => step.trim()).filter(step => step).join('\n');

    try {
      // --- Create any new ingredients first ---
      const componentsToSave: Array<{ // Type for dish_components
        ingredient_id: string;
        amount: number;
        unit_id: string;
        item?: string; // Optional item for dish_components (if schema allows)
        kitchen_id?: string; // Include if schema needs it
      }> = [];
      
      // Loop through components to resolve/create ingredients AND trigger nested prep creation
      for (const component of components) {
        console.log(`[Save Flow] Processing component: ${component.name}, ID: ${component.ingredient_id}, isPrep: ${component.isPreparation}`); // Log component start
        let componentIngredientId = component.ingredient_id;
        let requiresPreparationSave = false; // Flag to check if prep needs DB update

        if (!componentIngredientId) {
          // --- Handle NEW components --- 
          if (component.isPreparation && component.originalPrep) {
            // --- NEW Nested Preparation --- 
            console.log(`Attempting to create nested preparation: ${component.name}`);
            try {
              // Pass the detailed component info, including any stored state if needed
              // createNewPreparation internally handles resolving/creating sub-ingredients now
              // It will return null if creation fails or is skipped
              // Explicitly pass fingerprint as string or null
              const newPrepId = await createNewPreparation(component.name, null, component); // Pass null for fingerprint, let createNewPreparation handle it
              if (newPrepId) {
                componentIngredientId = newPrepId;
                component.ingredient_id = newPrepId;
                console.log(`Nested preparation ${component.name} processed, using ID: ${newPrepId}`);
                // Since it's brand new, the DB was definitely updated
              } else {
                console.warn(`Creation/resolution failed for nested preparation: ${component.name}. Skipping.`);
                 shouldProceed = false;
                 break; 
              }
            } catch (nestedPrepError) {
              // ... error handling ...
              shouldProceed = false; 
              break;
              }
            } else if (!component.isPreparation) {
             // --- New Raw Ingredient --- 
             // ... (existing logic to resolve/create raw ingredient) ...
          } 
        } else {
          // --- Existing component (ingredient_id present) ---
          if (component.isPreparation) {
             // Check if the internal state of this existing preparation was modified
             if (component.prepStateIsDirty) {
                 console.log(`Preparation ${component.name} (ID: ${component.ingredient_id}) marked as dirty, will require DB update.`);
                 requiresPreparationSave = true;
             } else {
                  console.log(`Preparation ${component.name} (ID: ${component.ingredient_id}) not dirty, skipping DB update.`);
             }
          }
          componentIngredientId = component.ingredient_id;
        }

        console.log(`[Save Flow] Resolved componentIngredientId: ${componentIngredientId}`); // Log resolved ID

        // --- Add to dish_components save list --- 
        if (componentIngredientId && component.unit_id) {
          const baseAmount = parseFloat(component.amount);
          if (!isNaN(baseAmount)) {
              // Prepare the component data, dish_id will be added later
              const componentData = { 
                ingredient_id: componentIngredientId,
                amount: baseAmount * (numServings / originalServings), // Always use recipe-scaled amount
                unit_id: component.unit_id,
                piece_type: component.item || undefined, // Map item to piece_type
              };
              componentsToSave.push(componentData); // Add to the array
              console.log(`[Save Flow] Added component ${component.name} to componentsToSave.`); // Log successful add
          } else { 
             console.warn(`[Save Flow] Skipping component ${component.name} due to invalid base amount: ${component.amount}`);
          } 
        } else if (shouldProceed) { 
            console.warn(`Skipping component ${component.name} due to missing ingredient ID or unit ID.`);
        }

        // --- Trigger Preparation DB Update if needed --- 
        // This needs to happen *after* resolving/creating raw ingredients *within* the prep
        // but before saving the dish itself. Let's move this logic outside the loop for simplicity?
        // OR: Call savePrepLogic conditionally here?
        if (requiresPreparationSave && componentIngredientId) {
           console.log(`Calling savePrepLogic for dirty preparation: ${component.name} (ID: ${componentIngredientId})`);
           // We need the fully resolved internal components state to save the prep correctly.
           // This state is stored in component.prepStateEditableIngredients
           // We need to adapt savePrepLogic or call a different function.
           
           // TODO: Adapt savePrepLogic or create updatePrepLogic to accept ComponentInput
           // For now, let's just log it. The savePrepLogic called later will handle updates.
           // await savePrepLogic(componentIngredientId); // This might re-resolve things unnecessarily
        }

      } // End of component loop

      if (!shouldProceed) { /* ... return ... */ }

      // --- INSERT or UPDATE Dish/Preparation Logic --- 
      const isUpdating = !!(dishIdToUse || prepIdToUse);

      if (isUpdating) {
          // --- UPDATE DISH/PREP --- 
          const dishIdToUpdate = existingId.current || dishIdToUse || dishIdToEdit;
        const prepIdToUpdate = prepIdToUse || preparationIdToEdit;

        if (dishIdToUpdate) {
              // --- Update DISH --- 
          console.log("Updating dish:", dishIdToUpdate);
          const { error: dishUpdateError } = await supabase
            .from('dishes')
            .update({ 
              dish_name: dishName.trim(), 
              menu_section_id: menuSectionId, 
                      directions: formattedDirections,
              total_time: timeString, 
                      serving_size: servingSizeNum === null ? undefined : servingSizeNum, // Handle null -> undefined
              serving_unit_id: servingUnitId, 
              serving_item: servingItem.trim() || undefined,
                      num_servings: numServings, // Update num_servings
                      cooking_notes: cookingNotes.trim() || undefined,
                      // kitchen_id should not change on update typically
            })
            .eq('dish_id', dishIdToUpdate);
          if (dishUpdateError) throw dishUpdateError;

              // --- Update dish_components (delete existing, insert new) ---
              await supabase.from('dish_components').delete().eq('dish_id', dishIdToUpdate);
          if (componentsToSave.length > 0) {
                  const componentsInsertData = componentsToSave.map(c => ({ 
                      ...c, // Spread previously prepared data (ingredient_id, amount, unit_id, piece_type)
                      dish_id: dishIdToUpdate // Add dish_id
                  }));
                  const { error: componentsInsertError } = await supabase.from('dish_components').insert(componentsInsertData);
            if (componentsInsertError) throw componentsInsertError;
          }
          Alert.alert(t('common.success'), t('alerts.dishUpdateSuccess')); 
              // Go back to the previous screen
              if (navigation.canGoBack()) navigation.goBack();
          } else if (prepIdToUpdate) {
              // --- Update TOP-LEVEL PREPARATION --- 
              console.log("Updating top-level preparation:", prepIdToUpdate);
              // Only update the DB if the proportions changed
              const topLevelPrepComponent = components.find(c => c.ingredient_id === prepIdToUpdate);
              if (topLevelPrepComponent?.prepStateIsDirty) {
                 console.log("Top-level prep is dirty, calling savePrepLogic...");
                 await savePrepLogic(prepIdToUpdate); // savePrepLogic needs adaptation
        } else {
                 console.log("Top-level prep not dirty, skipping DB update for proportions.");
                 Alert.alert(t('common.success'), t('alerts.prepUpdateSuccessNoChanges')); // Maybe a different message
        }
              // Go back to the previous screen
              if (navigation.canGoBack()) navigation.goBack();
          }
          // ... (navigation) ...
      } else {
          // --- INSERT NEW DISH/PREP --- 
        if (recipeKind === 'dish') {
              // --- Insert into dishes table --- 
              const { data: dishInsertData, error: dishInsertError } = await supabase
                  .from('dishes')
                  // Explicitly cast to the Insert type
                  .insert({
              dish_name: dishName.trim(),
              menu_section_id: menuSectionId,
                      directions: formattedDirections,
              total_time: timeString,
                      serving_size: servingSizeNum === null ? undefined : servingSizeNum, // Handle null -> undefined
              serving_unit_id: servingUnitId,
              serving_item: servingItem.trim() || undefined,
                      num_servings: numServings, // Use numServings state
              cooking_notes: cookingNotes.trim() || undefined,
                      kitchen_id: activeKitchenId, // Use active kitchen ID
                  } as Database['public']['Tables']['dishes']['Insert'])
                  .select('dish_id') // Select the newly created dish_id
              .single();
                if (dishInsertError) throw dishInsertError;
                const newDishId = dishInsertData?.dish_id;
                if (!newDishId) throw new Error('Failed to retrieve new dish ID after insert.');
              
              // --- Insert into dish_components --- 
            if (componentsToSave.length > 0) {
                  const componentsInsertData = componentsToSave.map(c => ({ 
                      ...c, // Spread previously prepared data (ingredient_id, amount, unit_id, piece_type)
                      dish_id: newDishId // Use the new dish ID
                  }));
                  console.log(`[Save Flow - Create] Inserting dish_components:`, JSON.stringify(componentsInsertData, null, 2)); // Log data before insert
                  const { error: componentsInsertError } = await supabase.from('dish_components').insert(componentsInsertData);
                  if (componentsInsertError) {
                     console.error("[Save Flow - Create] Error inserting dish_components:", componentsInsertError); // Log specific error
                     throw componentsInsertError;
                  }
              } else {
                  console.warn("[Save Flow - Create] componentsToSave array is empty. No dish_components inserted."); // Log if array is empty
            }
            Alert.alert(t('common.success'), t('alerts.dishCreateSuccess')); 
              // Go back to the previous screen
              if (navigation.canGoBack()) navigation.goBack();
        } else if (recipeKind === 'preparation') {
              // This call will create the new preparation in the DB
              await savePrepLogic(); // savePrepLogic needs adaptation
              // Go back to the previous screen
              if (navigation.canGoBack()) navigation.goBack();
          }
          // ... (navigation) ...
      }

    } catch (error: any) { /* ... error handling ... */ }
     finally { setSubmitting(false); }
  };

  // MODIFIED: savePrepLogic - Adapt to use ComponentInput state and handle updates
const savePrepLogic = async (existingPrepId?: string) => {
    const prepComponentState = existingPrepId 
        ? components.find(c => c.ingredient_id === existingPrepId) 
        : (recipeKind === 'preparation' ? components[0] : undefined); 

    if (!prepComponentState && existingPrepId) { throw new Error(`Internal error: Missing component state for prep ${existingPrepId}`); }
    if (!existingPrepId && recipeKind === 'preparation' && !prepComponentState) { throw new Error('Internal error: Missing component state for new preparation.'); }
    
    // Derive data, providing fallbacks for creation
    const nameToSave = prepComponentState?.name ?? dishName;
    const directionsToSave = prepComponentState?.prepStateInstructions ?? directions;
    const yieldUnitIdToSave = prepComponentState?.prepStatePrepUnitId ?? servingUnitId; // Nullable
    const yieldAmountToSave = prepComponentState ? parseFloat(prepComponentState.amount) : parseFloat(servingSize);
    const cookingNotesToSave = prepComponentState?.prepStateIsDirty === false ? null : cookingNotes; // Only save screen notes if prep was dirty or new?
    const referenceIngredientToSave = prepComponentState?.reference_ingredient ?? null;
    const ingredientsToSave = prepComponentState?.prepStateEditableIngredients ?? []; 
  const totalMinutes = parseInt(totalTimeHours) * 60 + parseInt(totalTimeMinutes);
    let yieldAmountNum: number | null = isNaN(yieldAmountToSave) ? null : yieldAmountToSave;
    if (yieldAmountNum === null || yieldAmountNum <= 0) yieldAmountNum = 1; 
    const formattedDirections = directionsToSave.map(step => step.trim()).filter(step => step).join('\n');

    try {
        const componentsForFingerprint: ComponentInput[] = ingredientsToSave.map(epi => ({
            key: epi.key,
            ingredient_id: epi.ingredient_id || '',
            name: epi.name,
            amount: epi.amountStr,
            unit_id: epi.unitId, 
            isPreparation: epi.isPreparation || false,
            matched: epi.matched,
            item: epi.item, // Include item if needed by fingerprint?
            reference_ingredient: epi.reference_ingredient,
            // Don't need prepState* fields for fingerprint
        }));

        // Resolve missing IDs/Units for fingerprint components
        for (const comp of componentsForFingerprint) {
             if (!comp.ingredient_id) {
                 const nameToResolve = comp.name?.trim();
                 if (nameToResolve) { // Check if name exists and is not empty
                     const res = await resolveIngredient(nameToResolve, t); 
                     if (res.id) comp.ingredient_id = res.id;
                     else { console.warn(`Could not resolve ingredient ${comp.name} during prep save.`); }
                 } else {
                     console.warn(`Skipping ingredient resolution due to missing/empty name.`);
                 }
             }
             if (!comp.unit_id) {
                // ... (unit lookup - ensure comp.name is handled if null)
                const unitNameLower = comp.name?.toLowerCase();
                const unitRes = units.find(u => 
                    (unitNameLower && u.unit_name?.toLowerCase() === unitNameLower) || 
                    (u.abbreviation && unitNameLower && u.abbreviation.toLowerCase() === unitNameLower)
                );
                if(unitRes) comp.unit_id = unitRes.unit_id;
                else { console.warn(`Could not resolve unit for ${comp.name} during prep save.`); }
             }
        }
        const validComponentsToSave = componentsForFingerprint.filter(c => c.ingredient_id && c.unit_id);
        const prepFingerprint = fingerprintPreparation(validComponentsToSave, formattedDirections);
        console.log(`Prep fingerprint (savePrepLogic): ${prepFingerprint.substring(0, 50)}...`);

    if (existingPrepId) {
            console.log("Updating preparation in DB:", existingPrepId);
            // --- Update preparations table ---
            const prepUpdateData: Partial<Database['public']['Tables']['preparations']['Row']> = {
                directions: formattedDirections || undefined,
                total_time: !isNaN(totalMinutes) ? totalMinutes : null, // Keep null if allowed
                amount_unit_id: yieldUnitIdToSave === null ? undefined : yieldUnitIdToSave, // null -> undefined
                fingerprint: prepFingerprint, // Ensure fingerprint is included if it exists in the type
                reference_ingredient: referenceIngredientToSave === null ? undefined : referenceIngredientToSave // null -> undefined
            };
      const { error: prepUpdateError } = await supabase
        .from('preparations')
                .update(prepUpdateData)
        .eq('preparation_id', existingPrepId);
      if (prepUpdateError) throw prepUpdateError;
      
            // --- Update ingredients table (parent row) ---
            const ingredientUpdateData: Partial<Database['public']['Tables']['ingredients']['Row']> = {
                name: nameToSave.trim(),
                cooking_notes: cookingNotesToSave?.trim() || undefined,
                // Ensure null unit_id becomes undefined for update if column doesn't allow null
                unit_id: yieldUnitIdToSave === null ? undefined : yieldUnitIdToSave, // null -> undefined
                amount: yieldAmountNum, 
            };
      const { error: ingredientUpdateError } = await supabase
        .from('ingredients')
                .update(ingredientUpdateData)
        .eq('ingredient_id', existingPrepId);
      if (ingredientUpdateError) throw ingredientUpdateError;
      
            // --- Update preparation_ingredients --- 
            await supabase.from('preparation_ingredients').delete().eq('preparation_id', existingPrepId);
            if (validComponentsToSave.length > 0) {
                const prepIngredientsInsert = validComponentsToSave.map(c => ({
            preparation_id: existingPrepId,
                    ingredient_id: c.ingredient_id!, // Assert non-null after filter
                    amount: parseFloat(c.amount) || 0,
                    unit_id: c.unit_id!, // Assert non-null after filter
                }));
                const { error: prepComponentsInsertError } = await supabase.from('preparation_ingredients').insert(prepIngredientsInsert);
          if (prepComponentsInsertError) throw prepComponentsInsertError;
        }
      Alert.alert(t('common.success'), t('alerts.prepUpdateSuccess')); 
    } else {
      // Creating a new preparation
            console.log("Creating new preparation via savePrepLogic...");
      const existingFingerprintPrepId = await findPreparationByFingerprint(prepFingerprint);
      if (existingFingerprintPrepId) {
                Alert.alert(t('alerts.duplicatePreparationTitle'), t('alerts.duplicatePreparationFingerprintMessage'));
                return; // Return null or existing ID? For now, just return to avoid creating duplicate.
            }
            
            await createNewPreparation(nameToSave, prepFingerprint, null, {
                components: validComponentsToSave, // Pass resolved components
                directions: directionsToSave,
                yieldUnitId: yieldUnitIdToSave,
                yieldAmount: yieldAmountNum,
                totalTimeMinutes: !isNaN(totalMinutes) ? totalMinutes : 0, 
                reference_ingredient: referenceIngredientToSave,
                cookingNotes: cookingNotesToSave
            });
        }
    } catch (error: any) { console.error("Error in savePrepLogic:", error); throw error; }
  };

  // MODIFIED: createNewPreparation - Handle nullables for insert
  const createNewPreparation = async (
    prepName: string, 
    prepFingerprint: string | null, // Explicitly allow null for fingerprint param
    _componentDetails?: ComponentInput | null, 
    resolvedPrepData?: { 
        components: ComponentInput[]; 
        directions: string[];
        yieldUnitId: string | null;
        yieldAmount: number | null;
        totalTimeMinutes: number; 
        reference_ingredient: string | null; // Corrected field name
        cookingNotes: string | null;
    }
  ): Promise<string | null> => { 
      if (!resolvedPrepData) { /* ... */ return null; }

      const finalDirectionsStr = resolvedPrepData.directions.map(s => s.trim()).filter(Boolean).join('\n');
      
      // Calculate fingerprint inside if not provided
      const finalFingerprint = prepFingerprint ?? fingerprintPreparation(resolvedPrepData.components, finalDirectionsStr);

      try {
          console.log(`Creating new preparation DB entry: ${prepName}`);
          // 1. Insert parent ingredient row
          // --- Add validation checks --- 
          if (!resolvedPrepData.yieldUnitId) {
            throw new Error(`Cannot create preparation '${prepName}': Missing yield unit ID.`);
          }
          if (!activeKitchenId) {
            throw new Error(`Cannot create preparation '${prepName}': No active kitchen selected.`);
          }
          // --- End validation --- 

          const ingredientInsert: Database['public']['Tables']['ingredients']['Insert'] = {
        name: prepName.trim(),
              cooking_notes: resolvedPrepData.cookingNotes?.trim() || undefined,
              // Use validated non-null values
              unit_id: resolvedPrepData.yieldUnitId, 
              amount: resolvedPrepData.yieldAmount ?? 1,
              kitchen_id: activeKitchenId,
          };
          const { data: ingredientInsertData, error: ingredientError } = await supabase
            .from('ingredients')
            .insert(ingredientInsert)
            .select('ingredient_id')
            .single();
          if (ingredientError) { /* ... handle specific errors ... */ throw ingredientError; }
          if (!ingredientInsertData?.ingredient_id) throw new Error("Failed to insert ingredient row for preparation.");
          const newPreparationId = ingredientInsertData.ingredient_id;

          // 2. Insert preparations row
          const prepInsert: Database['public']['Tables']['preparations']['Insert'] = {
          preparation_id: newPreparationId,
              directions: finalDirectionsStr || '', // Use empty string instead of undefined if directions must be string
              total_time: resolvedPrepData.totalTimeMinutes, 
              amount_unit_id: resolvedPrepData.yieldUnitId ?? undefined, // Use undefined if null
              fingerprint: finalFingerprint, 
              reference_ingredient: resolvedPrepData.reference_ingredient ?? undefined // Use undefined if null
          };
          const { error: prepError } = await supabase.from('preparations').insert(prepInsert);
          if (prepError) { /* ... handle error ... */ throw prepError; }

          // 3. Insert preparation_ingredients rows
          if (resolvedPrepData.components.length > 0) {
             const prepIngredientsInsert = resolvedPrepData.components.map(c => ({
                preparation_id: newPreparationId,
                ingredient_id: c.ingredient_id!, // Assert non-null after pre-save resolution
                amount: parseFloat(c.amount) || 0,
                unit_id: c.unit_id!, // Assert non-null after pre-save resolution
             }));
             const { error: prepIngErr } = await supabase.from('preparation_ingredients').insert(prepIngredientsInsert);
             if (prepIngErr) { /* ... handle error ... */ throw prepIngErr; }
          }
    Alert.alert(t('common.success'), t('alerts.prepCreateSuccess'));
    return newPreparationId;
      } catch (error) { console.error(`Error in createNewPreparation for ${prepName}:`, error); throw error; }
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
              displaySuffix={t('components.scaleSlider.servingsSuffix')} 
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
              <Text style={styles.label}>{t('screens.createRecipe.servingItemLabel')}</Text>
                <TextInput 
                  style={styles.input} // Use standard input style
                    placeholder={t('screens.createRecipe.servingItemPlaceholder')}
                    placeholderTextColor={COLORS.placeholder}
                    value={servingItem}
                    onChangeText={setServingItem}
                />
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
                                <Text style={styles.componentNameText}>
                                  {capitalizeWords(item.name)}
                                  {item.matched && (
                                    <Text style={styles.matchedBadge}> {t('common.matched')}</Text>
                                  )}
                                </Text>
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
                        // *** ADD CONSOLE LOG ***
                        console.log(`Rendering PrepCard for ${item.name} (key: ${item.key}), prepStateEditableIngredients:`, item.prepStateEditableIngredients);
                        
                        const prepUnit = units.find(u => u.unit_id === item.unit_id);
                        const prepAmountNum = parseFloat(item.amount);

                        const pseudoPreparationDetails: Preparation = {
                            preparation_id: item.ingredient_id,
                            name: item.name,
                            directions: item.prepStateInstructions ? item.prepStateInstructions.join('\n') : null, 
                            total_time: null, 
                            yield_unit: prepUnit || null,
                            yield_amount: isNaN(prepAmountNum) ? null : prepAmountNum,
                            reference_ingredient: item.reference_ingredient || null,
                            // Use stored state for ingredients preview
                            ingredients: (item.prepStateEditableIngredients || []).map(subIng => { 
                                const subUnit = units.find(u => u.unit_id === subIng.unitId);
                                const subAmount = parseFloat(subIng.amountStr);
                                return {
                                    preparation_id: item.ingredient_id, 
                                    ingredient_id: subIng.ingredient_id || subIng.name, 
                                    name: capitalizeWords(subIng.name),
                                    amount: isNaN(subAmount) ? null : subAmount,
                                    unit: subUnit || null
                                };
                            }),
                            cooking_notes: null 
                        };

                        const componentForCard: DishComponent = {
                            dish_id: '', 
                            ingredient_id: item.ingredient_id,
                            name: item.name,
                            amount: isNaN(prepAmountNum) ? null : prepAmountNum,
                            unit: prepUnit || null,
                            isPreparation: true,
                            preparationDetails: pseudoPreparationDetails,
                            rawIngredientDetails: null
                        };

                        const currentScale = originalServings > 0 ? numServings / originalServings : 1;

                        return (
                           <View key={item.key} style={styles.preparationCardContainer}>
                               <PreparationCard
                                   amountLabel={t('common.amount')} 
                                   component={componentForCard}
                                   onPress={() => handlePrepSelect(item)} 
                                   scaleMultiplier={currentScale} 
                               />
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
  matchedBadge: {
    fontSize: SIZES.font,
    color: COLORS.primary,
    marginLeft: SIZES.base,
  },
});

// Rename export
export default CreateRecipeScreen; 