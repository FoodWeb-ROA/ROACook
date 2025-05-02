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
import { RootStackParamList, OnUpdatePrepAmountCallback, OnNewPreparationCreatedCallback } from '../navigation/types';
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
import { resolveIngredient, resolvePreparation, resolveDish } from '../services/duplicateResolver';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Database } from '../data/database.types'; // <-- CORRECTED IMPORT PATH
import { useCurrentKitchenId } from '../hooks/useSupabase';
// ADDED: Import the refreshData utility
import { refreshData } from '../utils/dataRefresh';

// Import newly created components
import DirectionsInputList from '../components/DirectionsInputList'; 
import ComponentSearchModal, { SearchResultItem } from '../components/ComponentSearchModal';
import IngredientListComponent from '../components/IngredientListComponent'; // ADDED
import PreparationListComponent from '../components/PreparationListComponent'; // ADDED

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

  // MODIFIED: Get kitchenId to pass to hooks
  const kitchenId = useCurrentKitchenId();

  // Hooks for fetching data for editing
  // MODIFIED: Pass kitchenId to useDishDetail
  const { dish: dishToEdit, loading: loadingDish, error: dishError } = useDishDetail(dishIdToEdit, kitchenId);
  // Fetch preparation details separately if editing a preparation
  // Need to adapt usePreparationDetail or create a simpler fetch for basic prep info + its components
  // For now, let's use usePreparationDetail and assume it fetches components needed
  // MODIFIED: Removed kitchenId argument, as usePreparationDetail gets it internally
  const { preparation: prepToEdit, ingredients: prepComponentsToEdit, loading: loadingPrep, error: prepError } = usePreparationDetail(preparationIdToEdit);

  // --- Hooks for fetching data --- 
  const { menuSections, isLoading: loadingSections } = useMenuSections(); // <-- Renamed loading to isLoading
  const { units, loading: loadingUnits } = useUnits(); // Assumes useUnits hook exists
  // Fetch both ingredients and preparations for component selection
  const { ingredients: availableComponents, loading: loadingComponents } = useIngredients(true); // Assumes useIngredients hook exists and accepts flag

  // Add lookup hooks
  const { checkDishNameExists, lookupIngredient } = useLookup();

  // --- Form State --- 
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
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [servingUnitModalVisible, setServingUnitModalVisible] = useState(false);
  const [componentSearchModalVisible, setComponentSearchModalVisible] = useState(false);
  const [componentSearchQuery, setComponentSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // State for Serving Item logic
  const [pieceUnitId, setPieceUnitId] = useState<string | null>(null);

  // State to track overall loading including edit data fetching
  const [isScreenLoading, setIsScreenLoading] = useState(true);

  // ADDED: State to track search mode
  const [searchMode, setSearchMode] = useState<'ingredient' | 'preparation'>('ingredient');

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
      // MODIFIED: Search based on searchMode
      if (searchMode === 'ingredient') {
        // TODO: Potentially update lookupIngredient to filter out preparations
        // Removed filter option for now
        const results = await lookupIngredient(query); 
        setSearchResults(results);
      } else { // searchMode === 'preparation'
        // TODO: Implement or ensure lookupIngredient can find preparations
        // Removed filter option for now. Assumes lookupIngredient returns preparations too.
        // We might need a dedicated lookupPreparation or filter client-side later.
        const results = await lookupIngredient(query); 
        // Ensure isPreparation flag is set for display, filter later if needed.
        setSearchResults(results.map((r: any) => ({ ...r, isPreparation: true }))); 
      }
    } catch (error) {
      console.error(`Error searching ${searchMode}s:`, error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [lookupIngredient, searchMode]); // Added searchMode dependency

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
            // REMOVED incorrect type assertion
            // const prepExists = await checkPreparationNameExists(ing.name);
            // MODIFIED: Get the actual ID if the prep name exists
            matchedPrepId = await checkPreparationNameExists(ing.name);
            // MODIFIED: Logic to handle boolean result
            // if (prepExists) {
            if (matchedPrepId) { // Check if we got an ID back
              console.log(`Preparation '${ing.name}' exists with ID: ${matchedPrepId}. Marking as matched.`);
              matched = true; // Mark as matched
              // matchedPrepId remains null here. We don't have the ID yet.
              // The save logic will handle finding/creating based on fingerprint.
            } else {
              console.log(`No existing preparation found for: ${ing.name}. Will be treated as new.`);
            }
            // END MODIFIED Logic
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
                        // @ts-ignore 
                        matched: subMatched, 
                    });
                }
            }
        }
        
        // Determine the final ingredient ID string
        // MODIFIED: Use null for matchedPrepId if prepExists was true but ID wasn't fetched
        // MODIFIED AGAIN: Directly use matchedPrepId if found, otherwise use matchedIngredient ID, fallback to empty string
        const finalIngredientId = matchedPrepId ? matchedPrepId : (matchedIngredient?.ingredient_id ? matchedIngredient.ingredient_id : '');
        console.log(`[Map Flow] Determined finalIngredientId for ${ing.name}: ${finalIngredientId} (Type: ${typeof finalIngredientId})`); // Log ID before push

        mappedComponents.push({
          key: `parsed-${ing.name}-${Date.now()}`,
          ingredient_id: finalIngredientId, // Use the determined ID
          name: matchedPrepId ? ing.name : (matchedIngredient?.name || ing.name), // Use parsed name if it's a matched prep
          amount: String(ing.amount || ''), 
          unit_id: matchedUnitId, 
          isPreparation: ing.ingredient_type === 'Preparation',
          originalPrep: ing.ingredient_type?.toLowerCase() === 'preparation' ? (ing as ParsedIngredient) : undefined,
          subIngredients: ing.ingredient_type?.toLowerCase() === 'preparation' ? (ing.components ?? null) : null,
          item: ing.item || null,
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

  // MODIFIED: handleAddComponent to handle different modes and navigation
  const handleAddComponent = async (selectedItem: any) => {
    const item_id = selectedItem?.ingredient_id || '';
    const name = selectedItem?.name || '';
    const trimmedName = name.trim();

    if (!trimmedName) {
      console.error('Cannot add component: Missing name', selectedItem);
      Alert.alert(t('common.error'), t('alerts.errorAddComponentMissingName'));
      return;
    }

    setComponentSearchModalVisible(false); // Close modal immediately
    setComponentSearchQuery('');

    if (searchMode === 'ingredient') {
      // --- Ingredient Flow --- 
      if (item_id) {
        // Add existing ingredient directly
        addComponentWithDetails(item_id, trimmedName, false, true);
      } else {
        // No ID provided (user wants to create a new ingredient)
        try {
          const result = await resolveIngredient(trimmedName, t);
          if (result.mode === 'existing' && result.id) {
            addComponentWithDetails(result.id, trimmedName, false, true);
          } else if (result.mode === 'new') {
            // Create and add new raw ingredient
            const newIngId = await createNewIngredient(trimmedName);
            if (newIngId) {
              addComponentWithDetails(newIngId, trimmedName, false, false);
            }
          } // Handle cancel/error if necessary
        } catch (error) {
          console.error(`Error resolving/creating ingredient "${trimmedName}":`, error);
          Alert.alert(t('common.error'), t('alerts.errorCheckingDuplicates'));
        }
      }
    } else { // searchMode === 'preparation'
      // --- Preparation Flow --- 
      if (item_id) {
        // Add existing preparation directly
        addComponentWithDetails(item_id, trimmedName, true, true);
      } else {
        // No ID provided (user wants to create a new preparation)
        // Navigate to CreatePreparationScreen
        console.log(`Navigating to CreatePreparationScreen to create new prep: ${trimmedName}`);
        navigation.navigate('CreatePreparation', { 
          preparation: { // Pass minimal data for a new prep
            name: trimmedName,
            // No components, yield, etc. initially
          } as ParsedIngredient,
          onNewPreparationCreated: handleNewPreparationCreated, // Pass the callback
        });
      }
    }
  };

  // Helper function to add the component with given details (Unchanged)
  function addComponentWithDetails(id: string, name: string, isPrep: boolean, matched: boolean) {
    setComponents(prev => [
      ...prev,
      {
        key: `component-${id || 'new'}-${Date.now()}`,
        ingredient_id: id,
        name: name,
        amount: '',
        unit_id: null,
        isPreparation: isPrep,
        matched: matched,
      }
    ]);
  }

  // ADDED: Callback handler for when a new preparation is created via CreatePreparationScreen
  const handleNewPreparationCreated: OnNewPreparationCreatedCallback = useCallback((newPrepData) => {
    console.log('New preparation created, adding to dish components:', newPrepData);
    addComponentWithDetails(
      newPrepData.id, 
      newPrepData.name, 
      true, // It's a preparation
      false // It's newly created, not matched initially
    );
    // Optionally set default amount/unit based on returned yield?
    // For now, just adds it with empty amount/unit
  }, [addComponentWithDetails]); // Include dependencies if needed

  // MODIFIED: Update field type to match IngredientListComponent prop
  const handleComponentUpdate = (key: string, field: 'amount' | 'amountStr' | 'unitId' | 'item' | 'scaledAmountStr' | 'unit_id', value: string | null) => {
      setComponents(prev => 
          // Map field names if necessary (e.g., unitId to unit_id)
          prev.map(c => {
              if (c.key === key) {
                  let fieldToUpdate: keyof ComponentInput = field as any; // Cast initially
                  if (field === 'unitId') fieldToUpdate = 'unit_id';
                  // We ignore amountStr/scaledAmountStr/unitId here as we only deal with 'amount'/'unit_id'/'item'
                  if (field === 'amount' || field === 'unit_id' || field === 'item') {
                     return { ...c, [fieldToUpdate]: value };
                  }
              }
              return c;
          })
      );
  };

  // TODO: Implement handler to remove a component from the list
  const handleRemoveComponent = (key: string) => {
      setComponents(prev => prev.filter(c => c.key !== key));
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
    // --- Define variables needed for save logic ---
    const isUpdating = !!dishIdToEdit || !!preparationIdToEdit; // Check if editing existing dish or prep
    const formattedDirections = directions.map(d => d.trim()).filter(Boolean).join('\n');
    const timeString = `${String(totalTimeHours || '0').padStart(2, '0')}:${String(totalTimeMinutes || '0').padStart(2, '0')}:00`;
    const servingSizeNum = isNaN(parseFloat(servingSize)) ? null : parseFloat(servingSize);

    // Define type for processed components
    type ProcessedComponent = {
        ingredient_id: string;
      amount: number | null;
      unit_id: string | null;
      isPreparation: boolean;
      item?: string | null; // Optional item field
      // Add other fields if necessary for saving (e.g., piece_type)
    };

    // --- Prepare components data (resolve IDs, parse amounts) ---
    // This part needs careful implementation based on how new/existing ingredients/preps are handled
    // For now, creating a placeholder array. The actual implementation will involve async calls.
    // TODO: Implement full component processing logic here, resolving/creating ingredients/preps
    // This will likely involve mapping over `components` state and calling `resolveIngredient`, `resolvePreparation`, `createNewIngredient`, `createNewPreparation` etc.
    const componentsToSave: ProcessedComponent[] = await Promise.all(
      components.map(async (comp): Promise<ProcessedComponent | null> => {
        // Placeholder logic: Assumes comp.ingredient_id is correct if present, otherwise needs resolution/creation.
        // Actual implementation needs to handle 'matched' flag and potential creation.
        let finalIngredientId = comp.ingredient_id;

        // --- Logic for handling new components --- 
        if (!finalIngredientId) { 
            if (comp.isPreparation) {
                 // --- Handle NEW Preparation --- 
                console.log(`Attempting resolution for new preparation component: ${comp.name}`);
                 try {
                     // Prepare data needed for fingerprinting
                     const prepName = comp.name.trim();
                     const prepDirections = comp.prepStateInstructions || [];
                     const formattedPrepDirections = prepDirections.map(s => s.trim()).filter(Boolean).join('\n');
                     const prepComponents = comp.prepStateEditableIngredients || [];
                     const componentsForFingerprint: ComponentInput[] = prepComponents.map(epi => ({
                          key: epi.key,
                          name: epi.name,
                          ingredient_id: epi.ingredient_id || "",
                          amount: epi.amountStr,
                          amountStr: epi.amountStr, // Add amountStr
                          unit_id: epi.unitId || null,
                          isPreparation: epi.isPreparation || false,
                          item: epi.item,
                          matched: epi.matched || false,
                      }));
                     const prepFingerprint = fingerprintPreparation(componentsForFingerprint, formattedPrepDirections);

                     // Resolve potential duplicates (fingerprint or name)
                     // Pass parent dish name if available for better renaming suggestions
                     // RESOLUTION ONLY - CREATION IS HANDLED EXPLICITLY VIA NAVIGATION
                     const prepResolution = await resolvePreparation(prepName, prepFingerprint, dishName, t);

                     if (prepResolution.mode === 'existing' && prepResolution.id) {
                         finalIngredientId = prepResolution.id;
                         console.log(`Resolved new prep component "${prepName}" to existing ID: ${finalIngredientId} (identical content or user chose existing)`);
                     } else {
                         // If resolvePreparation suggests rename/overwrite/new, it means the user hasn't explicitly created it.
                         // The user should have been navigated to CreatePreparationScreen to handle this.
                         // If we reach here, it implies an issue or the user added a prep name without going through the creation flow.
                         console.warn(`Preparation component "${prepName}" needs explicit creation/resolution. Skipping.`);
                         Alert.alert(t('common.error'), t('alerts.errorPrepNeedsCreation', { name: prepName }));
                         return null; // Skip this component
                     }
                 } catch (error) {
                     console.error(`Error processing new preparation component "${comp.name}":`, error);
                     return null; // Skip component on error
                 }
              } else {
                 // --- Handle NEW Raw Ingredient --- 
                console.log(`Attempting creation for new raw ingredient: ${comp.name}`);
                 try {
                     const ingResolution = await resolveIngredient(comp.name, t);
                     if (ingResolution.mode === 'existing' && ingResolution.id) {
                         finalIngredientId = ingResolution.id;
                         console.log(`Resolved new raw ingredient "${comp.name}" to existing ID: ${finalIngredientId}`);
                     } else if (ingResolution.mode === 'new') {
                         const newIngId = await createNewIngredient(comp.name);
                         if (newIngId) {
                             finalIngredientId = newIngId;
                             console.log(`Created new raw ingredient "${comp.name}" with ID: ${finalIngredientId}`);
              } else {
                             console.error(`Failed to create new raw ingredient "${comp.name}". Skipping component.`);
                             return null;
                         }
                     } else {
                         // User cancelled or error during resolution
                         console.warn(`Resolution cancelled or failed for raw ingredient "${comp.name}". Skipping component.`);
                         return null;
                     }
                 } catch (error) {
                     console.error(`Error processing new raw ingredient "${comp.name}":`, error);
                     return null;
                 }
            }
        } 
        // --- End logic for handling new components ---
        else if (!finalIngredientId && comp.matched) {
           // It was matched during parsing but we didn't store the ID? Look it up again.
           // This indicates a potential issue in the parsing/mapping logic.
           // Re-resolve based on name (this might be inefficient)
           try {
              if (comp.isPreparation) {
                 const prepId = await checkPreparationNameExists(comp.name);
                 if (prepId) finalIngredientId = prepId;
        } else {
                 const ingId = await checkIngredientNameExists(comp.name);
                 if (ingId) finalIngredientId = ingId;
              }
           } catch (e) { console.error(`Error re-resolving component ${comp.name}`, e); }

           if (!finalIngredientId) {
               console.warn(`Component "${comp.name}" was matched but ID lookup failed. Skipping.`);
               return null;
           }
        }


        const amountNum = parseFloat(comp.amount);
        return {
          ingredient_id: finalIngredientId!, // Asserting non-null after checks
          amount: isNaN(amountNum) ? null : amountNum,
          unit_id: comp.unit_id || null,
          isPreparation: comp.isPreparation || false,
          item: comp.item || null,
        };
      })
    ).then(results => results.filter((c): c is ProcessedComponent => c !== null)); // Filter out null results


    try {
      // Validation logic... (e.g., check dishName)
      if (!dishName.trim()) {
         Alert.alert(t('common.error'), t('alerts.errorMissingDishName'));
         return;
      }
       if (!dishName.trim()) { // Prep name stored in dishName
         Alert.alert(t('common.error'), t('alerts.errorMissingPrepName'));
        return; 
      }
      // Add other validation as needed (e.g., components have amount/unit)

      // --- Start Save Process ---
      setSubmitting(true);

      // Removed duplicate variable definitions from here

      if (isUpdating) {
          // --- UPDATE DISH/PREP --- 
          // Use dishIdToEdit or preparationIdToEdit directly
          const dishIdToUpdate = dishIdToEdit;
          const prepIdToUpdate = preparationIdToEdit;

        if (dishIdToUpdate) {
              // --- Update DISH --- 
          console.log("Updating dish:", dishIdToUpdate);
          const { error: dishUpdateError } = await supabase
            .from('dishes')
            .update({ 
              dish_name: dishName.trim(), 
              menu_section_id: menuSectionId, 
                  directions: formattedDirections, // Use defined variable
                  total_time: timeString, // Use defined variable
                  serving_size: servingSizeNum === null ? undefined : servingSizeNum, // Use defined variable
                  serving_unit_id: servingUnitId || undefined, // Corrected type handling
              serving_item: servingItem.trim() || undefined,
                      num_servings: numServings, // Update num_servings
                      cooking_notes: cookingNotes.trim() || undefined,
                      // kitchen_id should not change on update typically
            })
            .eq('dish_id', dishIdToUpdate);
          if (dishUpdateError) throw dishUpdateError;

              // --- Update dish_components (delete existing, insert new) ---
              console.log(`[Save Flow - Update] Attempting to delete components for dish: ${dishIdToUpdate}`);
              await supabase.from('dish_components').delete().eq('dish_id', dishIdToUpdate);

              // Use the processed componentsToSave array
          if (componentsToSave.length > 0) {
                  const componentsInsertData = componentsToSave.map(c => ({ 
                      dish_id: dishIdToUpdate, // Add dish_id
                      ingredient_id: c.ingredient_id,
                      amount: c.amount,
                      unit_id: c.unit_id,
                      // Map item state to piece_type column
                      piece_type: c.item || null, 
                  }));
                  console.log(`[Save Flow - Update] Attempting to insert components:`, JSON.stringify(componentsInsertData, null, 2));
                  const { error: componentsInsertError } = await supabase.from('dish_components').insert(componentsInsertData);
            if (componentsInsertError) throw componentsInsertError;
          } else {
            console.log("[Save Flow - Update] No components to save after processing.");
          }
              // ... rest of update dish flow ...
              refreshData(kitchenId);
              if (navigation.canGoBack()) navigation.goBack();

          } else if (prepIdToUpdate) {
              // --- Update TOP-LEVEL PREPARATION --- 
              console.log("Updating top-level preparation:", prepIdToUpdate);
              const topLevelPrepComponent = components.find(c => c.ingredient_id === prepIdToUpdate);
              if (topLevelPrepComponent?.prepStateIsDirty) {
                 console.log("Top-level prep is dirty, calling savePrepLogic...");
                 // Ensure savePrepLogic handles updating the preparation's own fields if needed
                 await savePrepLogic(prepIdToUpdate); // This updates sub-components/directions
                 // Potentially add updates for prep's own fields (name, yield, time) here if needed
        } else {
                 console.log("Top-level prep not dirty, skipping DB update for proportions/directions.");
        }
              refreshData(kitchenId, 'preparations');
              if (navigation.canGoBack()) navigation.goBack();
          }
      } else {
          // --- INSERT NEW DISH/PREP --- 
        if (dishIdToEdit) {
              // --- Insert into dishes table --- 
              // ADDED: Check for duplicate dish name first
              const trimmedDishName = dishName.trim();
              const dishResolution = await resolveDish(trimmedDishName, t);
               
              // --- Handle User Choice from Duplicate Prompt --- 
              if (dishResolution.mode === 'cancel') {
                  // User cancelled the save operation
                  console.log("User cancelled dish save due to duplicate name.");
                  setSubmitting(false); // Reset submitting state
                  return; // Stop the save process
              }
              
              if (dishResolution.mode === 'overwrite' && dishResolution.id) {
                  // User chose to replace existing dish - redirect to update flow
                  console.log(`User chose to replace existing dish: ${dishResolution.id}`);
                  
                  // First delete the existing dish's components
                  await supabase.from('dish_components').delete().eq('dish_id', dishResolution.id);
                  
                  // Then update the existing dish with new data
                  const { error: dishUpdateError } = await supabase
                    .from('dishes')
                    .update({ 
                      dish_name: trimmedDishName,
                      menu_section_id: menuSectionId,
                      directions: formattedDirections,
                      total_time: timeString,
                      serving_size: servingSizeNum === null ? undefined : servingSizeNum,
                      serving_unit_id: servingUnitId || undefined,
                      serving_item: servingItem.trim() || undefined,
                      num_servings: numServings,
                      cooking_notes: cookingNotes.trim() || undefined,
                    })
                    .eq('dish_id', dishResolution.id);
                    
                  if (dishUpdateError) throw dishUpdateError;
                  
                  // Insert components for the existing dish
                  if (componentsToSave.length > 0) {
                      const componentsInsertData = componentsToSave.map(c => ({
                          dish_id: dishResolution.id!,  // Use non-null assertion since we've already checked
                          ingredient_id: c.ingredient_id,
                          amount: c.amount,
                          unit_id: c.unit_id,
                          // Map item state to piece_type column
                          piece_type: c.item || null, 
                      }));
                      console.log(`[Save Flow - Replace] Inserting dish_components for existing dish:`, JSON.stringify(componentsInsertData, null, 2));
                      const { error: componentsInsertError } = await supabase.from('dish_components').insert(componentsInsertData);
                      if (componentsInsertError) throw componentsInsertError;
                  }
                  
                  console.log(`Successfully replaced dish: ${dishResolution.id}`);
                  refreshData(kitchenId);
                  if (navigation.canGoBack()) navigation.goBack();
                  // Ensure we exit after overwrite
                  setSubmitting(false); 
                  return; 
              }
              
              // --- Proceed with insert only if mode is 'new' --- 
              if (dishResolution.mode === 'new') {
                 console.log(`Proceeding to insert new dish: ${trimmedDishName}`);
                  const { data: dishInsertData, error: dishInsertError } = await supabase
                      .from('dishes')
                      .insert({
                  dish_name: dishName.trim(),
                  menu_section_id: menuSectionId,
                          directions: formattedDirections, // Use defined variable
                          total_time: timeString, // Use defined variable
                          serving_size: servingSizeNum === null ? undefined : servingSizeNum, // Use defined variable
                          serving_unit_id: servingUnitId || undefined, // Corrected type handling
                  serving_item: servingItem.trim() || undefined,
                          num_servings: numServings,
                  cooking_notes: cookingNotes.trim() || undefined,
                          kitchen_id: activeKitchenId,
                      } as Database['public']['Tables']['dishes']['Insert']) // Keep explicit cast
                      .select('dish_id')
                  .single();
                    if (dishInsertError) throw dishInsertError;
                    const newDishId = dishInsertData?.dish_id;
                    if (!newDishId) throw new Error('Failed to retrieve new dish ID after insert.');
                  
                  // --- Insert into dish_components --- 
                if (componentsToSave.length > 0) {
                      const componentsInsertData = componentsToSave.map(c => ({ 
                          dish_id: newDishId, // Use the new dish ID
                          ingredient_id: c.ingredient_id,
                          amount: c.amount,
                          unit_id: c.unit_id,
                          // Map item state to piece_type column
                          piece_type: c.item || null, 
                      }));
                      console.log(`[Save Flow - Create] Inserting dish_components:`, JSON.stringify(componentsInsertData, null, 2));
                      const { error: componentsInsertError } = await supabase.from('dish_components').insert(componentsInsertData);
                      if (componentsInsertError) {
                          console.error("[Save Flow - Create] Error inserting dish_components:", componentsInsertError);
                         throw componentsInsertError;
                      }
                  } else {
                      console.log("[Save Flow - Create] No components to save after processing.");
                    }
                  // ... rest of insert dish flow ...
                  refreshData(kitchenId);
                  if (navigation.canGoBack()) navigation.goBack();
              } else {
                 // Should not happen if resolveDish modes are handled correctly
                 console.error("Unexpected dish resolution mode:", dishResolution.mode);
                 Alert.alert(t('common.error'), t('alerts.errorUnexpectedSaveState'));
                 setSubmitting(false);
                 return;
              }
           } else if (preparationIdToEdit) {
               // --- Insert NEW PREPARATION --- 
               // REMOVED: This flow is now handled entirely by CreatePreparationScreen when creating a new prep.
               console.log("Attempting to create new preparation...");

               // Prepare data for createNewPreparation based on current state
               const prepName = dishName.trim();
               const prepDirections = directions; // Use directions state
               const prepYieldAmount = servingSizeNum; // Use parsed serving size
               const prepYieldUnitId = servingUnitId; // Use selected serving unit
               const prepTotalTime = parseInt(totalTimeHours || '0') * 60 + parseInt(totalTimeMinutes || '0');
               const prepCookingNotes = cookingNotes.trim() || null;
               // Finalize prep info
               const formattedPrepDirections = prepDirections.map(d => d.trim()).filter(Boolean).join('\\n'); // Create the string version for DB/fingerprint
               const prepFingerprint = fingerprintPreparation(
                  components, // Use the 'components' state array (ComponentInput[])
                  formattedPrepDirections // Use the joined string version
               );

               // ADDED: Check for duplicate preparation name
               // The parent dish name is null since we're creating a top-level preparation
               const prepResolution = await resolvePreparation(prepName, prepFingerprint, null, t);
               
               if (prepResolution.mode === 'existing' && prepResolution.id) {
                  // Content is identical to existing preparation - use that one
                  console.log(`Using existing preparation with identical content: ${prepResolution.id}`);
                  Alert.alert(
                     t('common.success'),
                     t('alerts.usingExistingPreparation', { name: prepName }),
                     [{ text: t('common.ok'), onPress: () => { 
                        refreshData(kitchenId, 'preparations');
              if (navigation.canGoBack()) navigation.goBack();
                     }}]
                  );
                  return;
               } 
               else if (prepResolution.mode === 'overwrite' && prepResolution.id) {
                  // Update existing preparation
                  console.log(`Overwriting existing preparation: ${prepResolution.id}`);
                  
                  // First update the preparations table
                  const { error: prepUpdateError } = await supabase
                     .from('preparations')
                     .update({
                        directions: formattedPrepDirections, // Use the joined string version
                        total_time: prepTotalTime,
                     })
                     .eq('preparation_id', prepResolution.id);
                     
                  if (prepUpdateError) throw prepUpdateError;
                  
                  // Update the ingredient record (name, kitchen_id, etc.)
                  const { error: ingredientUpdateError } = await supabase
                     .from('ingredients')
                     .update({
                        name: prepName,
                        unit_id: prepYieldUnitId || undefined,
                        amount: prepYieldAmount || undefined,
                        cooking_notes: prepCookingNotes || undefined
                     })
                     .eq('ingredient_id', prepResolution.id);
                     
                  if (ingredientUpdateError) throw ingredientUpdateError;
                  
                  // Delete existing preparation ingredients
                  await supabase.from('preparation_ingredients').delete().eq('preparation_id', prepResolution.id);
                  
                  // Add new preparation ingredients
                  const validComponents = components // Use 'components' state array
                     .filter(c => c.ingredient_id && c.amount !== null && !isNaN(parseFloat(c.amount))) // Ensure amount is parseable
                     .map(c => ({
                        preparation_id: prepResolution.id!,
                        ingredient_id: c.ingredient_id,
                        amount: parseFloat(c.amount), // Parse amount to number
                        unit_id: c.unit_id || undefined
                     }));
                     
                  if (validComponents.length > 0) {
                     const { error: insertComponentsError } = await supabase
                        .from('preparation_ingredients')
                        .insert(validComponents);
                     
                     if (insertComponentsError) throw insertComponentsError;
                  }
                  
                  console.log(`Successfully updated preparation: ${prepResolution.id}`);
                  refreshData(kitchenId, 'preparations');
                  if (navigation.canGoBack()) navigation.goBack();
                  return;
               }
               else if (prepResolution.mode === 'rename' && prepResolution.newName) {
                  // Use the suggested new name
                  console.log(`Renaming preparation to avoid conflict: ${prepResolution.newName}`);
                  const newPrepId = await createNewPreparation(
                     prepResolution.newName, // Use the suggested name
                     prepFingerprint,
                     null,
                     {
                        components: components.map(c => ({
                            key: `create-${c.ingredient_id}`,
                            name: 'Placeholder Name',
                            ingredient_id: c.ingredient_id,
                            amount: String(c.amount),
                            amountStr: String(c.amount),
                            unit_id: c.unit_id,
                            isPreparation: c.isPreparation,
                            item: c.item,
                            matched: true,
                        })),
                        directions: prepDirections,
                        yieldUnitId: prepYieldUnitId,
                        yieldAmount: prepYieldAmount,
                        totalTimeMinutes: prepTotalTime,
                        cookingNotes: prepCookingNotes
                     }
                  );
                  
                  if (newPrepId) {
                    console.log(`New preparation created with renamed: ${newPrepId}`);
                    refreshData(kitchenId, 'preparations');
                    if (navigation.canGoBack()) navigation.goBack();
                  }
                  return;
               }
               
               // Normal creation for a new preparation (no conflicts)
               // Check for existing fingerprint
               const existingPrepIdByFingerprint = await findPreparationByFingerprint(prepFingerprint);
               if (existingPrepIdByFingerprint) {
                  console.log(`Preparation with fingerprint ${prepFingerprint} already exists (ID: ${existingPrepIdByFingerprint}). Skipping creation.`);
                  // Optionally link to the existing prep or inform the user
                  Alert.alert(t('common.info'), t('alerts.infoPrepExistsFingerprint'));
                  // Decide how to proceed - maybe navigate back or show the existing prep?
               } else {
                   const newPrepId = await createNewPreparation(
                      prepName,
                      prepFingerprint, // Pass calculated fingerprint
                      null, // Pass null for _componentDetails (already processed)
                      { // Pass resolved data directly
                          // MODIFIED: Adapt ProcessedComponent to match ComponentInput for creation
                          components: components.map(c => ({
                              key: `create-${c.ingredient_id}`, // Placeholder key
                              name: 'Placeholder Name', // Placeholder name
                              ingredient_id: c.ingredient_id,
                              amount: String(c.amount), // Amount as string
                              amountStr: String(c.amount), // Add amountStr
                              unit_id: c.unit_id,
                              isPreparation: c.isPreparation,
                              item: c.item,
                              matched: true, // Assume matched
                          })),
                          directions: prepDirections,
                          yieldUnitId: prepYieldUnitId,
                          yieldAmount: prepYieldAmount,
                          totalTimeMinutes: prepTotalTime,
                          cookingNotes: prepCookingNotes
                      }
                  );

                  if (newPrepId) {
                    console.log("New preparation created successfully:", newPrepId);
                    refreshData(kitchenId, 'preparations');
                    if (navigation.canGoBack()) navigation.goBack();
                  } else {
                    // Error handled within createNewPreparation
                  }
              }
          }
      }

    } catch (error: any) { 
      // MODIFIED: Improved error logging and user feedback
      console.error("Error saving recipe:", error);
      const errorMessage = error.message || 'An unexpected error occurred.';
      // Optionally show specific messages for known Supabase errors
      if (error.code) {
        console.error(`Supabase error code: ${error.code}, details: ${error.details}`);
      }
      Alert.alert(
        t('common.error'), 
        t('alerts.errorSavingRecipe', { message: errorMessage })
      );
    } finally { 
      setSubmitting(false); 
    }
  }; // End of handleSaveDish

  // MODIFIED: savePrepLogic - Adapt to use ComponentInput state and handle updates
  // *** Ensure savePrepLogic is defined WITHIN CreateRecipeScreen component scope ***
const savePrepLogic = async (existingPrepId?: string) => {
    if (!existingPrepId) {
      console.error("Cannot update preparation: No preparation ID provided");
      return;
    }

    try {
      // Find the preparation data from components array
      const prepComponent = components.find(c => c.ingredient_id === existingPrepId);
      if (!prepComponent) {
        console.error(`Preparation with ID ${existingPrepId} not found in components list`);
        return;
      }

      console.log(`Updating preparation: ${prepComponent.name} (ID: ${existingPrepId})`);

      // Get updated directions
      const updatedDirections = prepComponent.prepStateInstructions || [];
      const finalDirectionsStr = updatedDirections.map(s => s.trim()).filter(Boolean).join('\n');

      // First, update the preparations table
      const { error: prepError } = await supabase
        .from('preparations')
        .update({
          directions: finalDirectionsStr,
          // You may need to update other fields like total_time if needed
        })
        .eq('preparation_id', existingPrepId);

      if (prepError) {
        console.error(`Error updating preparation ${existingPrepId}:`, prepError);
        throw prepError;
      }

      // Next, update preparation_ingredients if needed
      if (prepComponent.prepStateEditableIngredients?.length) {
        // First, delete existing preparation_ingredients
        const { error: deleteError } = await supabase
          .from('preparation_ingredients')
          .delete()
          .eq('preparation_id', existingPrepId);

        if (deleteError) {
          console.error(`Error deleting preparation ingredients for ${existingPrepId}:`, deleteError);
          throw deleteError;
        }

        // Then insert new ones
        const validComponents = prepComponent.prepStateEditableIngredients
          .filter(epi => epi.ingredient_id && epi.unitId && !isNaN(parseFloat(epi.amountStr)))
          .map(epi => ({
            preparation_id: existingPrepId,
            ingredient_id: epi.ingredient_id!,
            amount: parseFloat(epi.amountStr) || 0,
            unit_id: epi.unitId!,
          }));

        if (validComponents.length) {
          const { error: insertError } = await supabase
            .from('preparation_ingredients')
            .insert(validComponents);

          if (insertError) {
            console.error(`Error inserting updated preparation ingredients for ${existingPrepId}:`, insertError);
            throw insertError;
          }
        }
      }

      console.log(`Successfully updated preparation: ${prepComponent.name} (ID: ${existingPrepId})`);
      
      // Refresh preparation data after successful update
      refreshData(kitchenId, 'preparations');
      
      return existingPrepId;
    } catch (error) {
      console.error(`Error in savePrepLogic for ID ${existingPrepId}:`, error);
      Alert.alert(t('common.error'), t('alerts.errorUpdatingPreparation'));
      return null;
    }
  };

  // --- ADDED: Function to create a new basic ingredient ---
  const createNewIngredient = async (name: string): Promise<string | null> => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      console.error("Cannot create ingredient: Name is empty.");
      return null;
    }
    if (!activeKitchenId) {
      console.error(`Cannot create ingredient '${trimmedName}': No active kitchen selected.`);
      Alert.alert(t('common.error'), t('alerts.errorCreatingIngredientNoKitchen'));
      return null;
    }
    
    // Find a default unit (e.g., 'piece' or the first available unit)
    const defaultUnit = units.find(u => u.unit_name?.toLowerCase() === 'piece' || u.abbreviation?.toLowerCase() === 'x') || units[0];
    const defaultUnitId = defaultUnit?.unit_id; // This might be null/undefined if units list is empty
    
    if (!defaultUnitId) {
       console.error(`Cannot create ingredient '${trimmedName}': No default unit found.`);
       Alert.alert(t('common.error'), t('alerts.errorCreatingIngredientNoDefaultUnit'));
       return null;
    }

    console.log(`Creating new ingredient DB entry: ${trimmedName}`);
    try {
      // Basic insert - include default unit and amount
      const ingredientInsert: Database['public']['Tables']['ingredients']['Insert'] = {
        name: trimmedName,
        kitchen_id: activeKitchenId,
        unit_id: defaultUnitId, // Use resolved default unit ID
        amount: 1, // Default amount
            };
      const { data, error } = await supabase
        .from('ingredients')
        .insert(ingredientInsert)
        .select('ingredient_id')
        .single();

      if (error) {
        // Handle potential duplicate name error (e.g., unique constraint)
        if (error.code === '23505') { // Unique violation
          console.warn(`Ingredient named "${trimmedName}" likely already exists (unique constraint). Attempting lookup.`);
          // Attempt to lookup the existing ID as a fallback
          // MODIFIED: Ensure existingId variable is correctly typed
          const existingIdString: string | null = await checkIngredientNameExists(trimmedName);
          // MODIFIED: Added ts-ignore to suppress persistent linter warning
          // @ts-ignore
          if (existingIdString) return existingIdString;
        }
        console.error(`Error inserting new ingredient '${trimmedName}':`, error);
        throw error; // Re-throw other errors
      }

      if (!data?.ingredient_id) {
        throw new Error("Failed to retrieve new ingredient ID after insert.");
      }
      
      console.log(`Successfully created ingredient '${trimmedName}' with ID: ${data.ingredient_id}`);
      return data.ingredient_id;

    } catch (error) {
      console.error(`Error in createNewIngredient for ${trimmedName}:`, error);
      Alert.alert(t('common.error'), t('alerts.errorCreatingIngredient', { name: trimmedName }));
      return null; // Return null on failure
    }
  };
  // --- END createNewIngredient ---

  // Add the createNewPreparation function before handleSaveDish
  // (placed right after savePrepLogic)

  const createNewPreparation = async (
    prepName: string, 
    prepFingerprint: string | null, 
    _componentDetails: any | null,
    options: {
      components: ComponentInput[],
      directions: string[],
      yieldUnitId: string | null,
      yieldAmount: number | null,
      totalTimeMinutes: number | null,
      cookingNotes: string | null
    }
  ): Promise<string | null> => { 
    try {
      console.log(`Creating new preparation DB entry: ${prepName}`);
      
      if (!options.yieldUnitId) {
        console.error(`Cannot create preparation '${prepName}': Missing yield unit ID.`);
        Alert.alert(t('common.error'), t('alerts.errorMissingPrepYieldUnit'));
        return null;
      }
      
      if (!activeKitchenId) {
        console.error(`Cannot create preparation '${prepName}': No active kitchen selected.`);
        Alert.alert(t('common.error'), t('alerts.errorCreatingPreparationNoKitchen'));
        return null;
      }

      const finalDirectionsStr = options.directions.map(d => d.trim()).filter(Boolean).join('\n');
      
      // Create the ingredient entry for the preparation
      const ingredientInsert: Database['public']['Tables']['ingredients']['Insert'] = {
        name: prepName.trim(),
        cooking_notes: options.cookingNotes?.trim() || undefined,
        unit_id: options.yieldUnitId,
        amount: options.yieldAmount ?? 1,
        kitchen_id: activeKitchenId,
      };
      
      const { data: ingredientInsertData, error: ingredientError } = await supabase
        .from('ingredients')
        .insert(ingredientInsert)
        .select('ingredient_id')
        .single();
        
      if (ingredientError) { 
        console.error(`Error creating ingredient for preparation '${prepName}':`, ingredientError);
        throw ingredientError; 
      }
      
      if (!ingredientInsertData?.ingredient_id) {
        throw new Error("Failed to insert ingredient row for preparation.");
      }
      
      const newPreparationId = ingredientInsertData.ingredient_id;

      // Create the preparation entry
      const prepInsert = {
        preparation_id: newPreparationId,
        directions: finalDirectionsStr || undefined,
        total_time: options.totalTimeMinutes,
        fingerprint: prepFingerprint
      } as Database['public']['Tables']['preparations']['Insert'];
      
      const { error: prepError } = await supabase.from('preparations').insert(prepInsert);
      
      if (prepError) { 
        console.error(`Error creating preparation '${prepName}':`, prepError);
        throw prepError; 
      }

      // Add preparation ingredients if provided
      if (options.components.length > 0) {
        const validComponents = options.components.filter(c => 
          c.ingredient_id && c.unit_id && !isNaN(parseFloat(c.amount))
        );
        
        if (validComponents.length !== options.components.length) {
          console.warn(`Skipped ${options.components.length - validComponents.length} invalid components when creating preparation ${prepName}`);
        }
        
        if (validComponents.length > 0) {
          const prepIngredientsInsert = validComponents.map(c => ({
            preparation_id: newPreparationId,
            ingredient_id: c.ingredient_id!,
            amount: parseFloat(c.amount) || 0,
            unit_id: c.unit_id!,
          }));
          
          const { error: prepIngErr } = await supabase.from('preparation_ingredients').insert(prepIngredientsInsert);
          
          if (prepIngErr) { 
            console.error(`Error adding ingredients to preparation '${prepName}':`, prepIngErr);
            throw prepIngErr; 
          }
        }
      }
      
      console.log(`Successfully created preparation '${prepName}' with ID: ${newPreparationId}`);
      return newPreparationId;
    } catch (error) {
      console.error(`Error in createNewPreparation for ${prepName}:`, error);
      Alert.alert(t('common.error'), t('alerts.errorCreatingPreparation', { name: prepName }));
      return null;
    }
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

  // ADDED: Handler to open unit modal (passed to IngredientListComponent)
  const openComponentUnitSelector = (key: string) => {
    // Need logic to find the component type and open the correct modal
    // For now, assuming it always opens a generic unit modal tied to a key
    // This might need more context depending on how unit selection modals are managed
    console.log("Attempting to open unit selector for component key:", key);
    // Example: Find component, set state for modal visibility + current key
    // setEditingComponentKey(key);
    // setComponentUnitModalVisible(true);
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

          {/* Serving Item Input (Removed unnecessary FlatList, fixed style) */}
          <View style={styles.inputGroup}> {/* MODIFIED: Used styles.inputGroup */}
              <Text style={styles.label}>{t('screens.createRecipe.servingItemLabel')}</Text>
            {/* Simplified display - use TextInput directly */}
            <TextInput
              style={styles.input}
              placeholder={t('screens.createRecipe.servingItemPlaceholder')}
              value={servingItem}
              onChangeText={setServingItem}
                  />
          </View>

          {/* --- Components Section (Moved) --- */}
          <View style={styles.componentsSection}>
            {/* === Ingredients List === */}
            <Text style={styles.sectionTitle}>{t('screens.createRecipe.ingredientsTitle')}</Text>
            {/* Use IngredientListComponent */}
            <IngredientListComponent
                ingredients={ingredientsList}
                units={units}
                pieceUnitId={pieceUnitId}
                originalServings={originalServings}
                numServings={numServings}
                onUpdate={handleComponentUpdate} // Pass existing handler
                onRemove={handleRemoveComponent} // Pass existing handler
                onSelectUnit={openComponentUnitSelector} // Pass new handler for modal
                isPrepScreen={false} // Indicate this is not the prep screen context
            />

            {/* === Preparations List === */}
            <Text style={styles.sectionTitle}>{t('screens.createRecipe.preparationsTitle')}</Text>
            {/* Use PreparationListComponent */}
            <PreparationListComponent 
                preparations={preparationsList}
                units={units}
                originalServings={originalServings}
                numServings={numServings}
                onSelectPrep={handlePrepSelect} // Pass existing handler
                onRemove={handleRemoveComponent} // Pass existing handler
            />
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

          {/* Directions Input - USE COMPONENT */}
          <Text style={styles.label}>{t('screens.createRecipe.directionsLabel')}</Text>
          <DirectionsInputList 
            // Pass initial directions state and update callback
            initialDirections={directions}
            onDirectionsUpdate={setDirections} 
          />

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
      
      {/* Component Search Modal - USE COMPONENT */} 
       <ComponentSearchModal
          visible={componentSearchModalVisible}
          onClose={() => setComponentSearchModalVisible(false)}
          searchMode={searchMode}
          // Pass the actual search function from useLookup
          performSearch={async (query) => {
              // Adapt the return type to SearchResultItem[]
              const results = await lookupIngredient(query);
              // Ensure isPreparation flag exists for potential filtering/display
              return results.map((r: any) => ({ 
                  ingredient_id: r.ingredient_id,
                  name: r.name,
                  isPreparation: r.isPreparation || false, // Assume false if not present
              }));
          }}
          onSelectItem={handleAddComponent} // Pass the existing handler
          onCreateNew={(name, isPreparation) => {
              // Call handleAddComponent, passing null for item_id and the correct isPreparation flag
              handleAddComponent({ name: name, isPreparation: isPreparation, ingredient_id: null });
          }}
       />

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
    backgroundColor: COLORS.secondary, // Match addStepButton
    borderColor: COLORS.primary, // Match addStepButton
    borderWidth: 1, // Match addStepButton
    padding: SIZES.padding * 0.75, // Match addStepButton padding
    borderRadius: SIZES.radius, // Match addStepButton
    alignItems: 'center',
    marginTop: SIZES.base, // Match addStepButton margin
    marginBottom: SIZES.padding, // Add margin below button before list starts
  },
  addButtonText: {
    color: COLORS.primary, // Match addStepButton
    ...FONTS.body3,
    fontWeight: '600', // Match addStepButton
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
    color: COLORS.white,
    ...FONTS.body3,
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
  // ADDED Styles for inline serving item list
  servingItemListContainer: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    maxHeight: 150, // Limit height and make it scrollable
    backgroundColor: COLORS.surface,
  },
  servingItemList: {
    // No specific styles needed here if container manages layout
  },
  servingListItem: { // Based on modalItem
    paddingVertical: SIZES.padding * 0.75,
    paddingHorizontal: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  servingListItemText: { // Based on modalItemText
    ...FONTS.body3,
    color: COLORS.text,
  },
  disabledButton: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  },
  disabledButtonText: {
    color: COLORS.textLight,
  },
});

// Rename export
export default CreateRecipeScreen; 