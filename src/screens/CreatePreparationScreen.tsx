import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Modal, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { ParsedIngredient, Unit, Preparation, DishComponent, Ingredient } from '../types';
import { useUnits, useIngredients } from '../hooks/useSupabase';
import { useLookup } from '../hooks/useLookup';
import AppHeader from '../components/AppHeader';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { capitalizeWords, formatQuantity, formatQuantityAuto } from '../utils/textFormatters';
import PreparationCard from '../components/PreparationCard';
import { useTranslation } from 'react-i18next';
import { slug, stripDirections, fingerprintPreparation } from '../utils/normalise';
import { 
  findDishByName, 
  findCloseIngredient, 
  checkIngredientNameExists, 
  checkPreparationNameExists,
  findPreparationByFingerprint 
} from '../data/dbLookup';

type CreatePrepRouteProp = RouteProp<RootStackParamList, 'CreatePreparation'>;
type CreatePrepNavProp = StackNavigationProp<RootStackParamList, 'CreatePreparation'>;

// Type for internal state management of ingredients
// Adjusted to potentially hold more info for adding/lookup
// Removed Partial<ParsedIngredient> to avoid potential type conflicts
type EditablePrepIngredient = {
    key: string; // Unique key for lists
    ingredient_id?: string | null; // Keep track of existing ID
    name: string;
    amountStr: string; // Keep original (base) amount as string for TextInput
    unitId: string | null; // Store matched unit ID
    isPreparation?: boolean;
    // Carry over other potentially useful fields from ParsedIngredient if needed
    unit?: string | null; // Original unit string for reference
    item?: string | null; // Item description
    reference_ingredient?: string | null;
    matched?: boolean; // ADDED: Flag to indicate ingredient was auto-matched
    // Avoid carrying over 'components'/'instructions' here unless absolutely necessary
};

const CreatePreparationScreen = () => {
  const route = useRoute<CreatePrepRouteProp>();
  const navigation = useNavigation<CreatePrepNavProp>();
  const { preparation, scaleMultiplier = 1 } = route.params;
  const { units, loading: loadingUnits } = useUnits();
  const { lookupIngredient, checkIngredientNameExists } = useLookup();
  const { t } = useTranslation();

  // --- State ---
  const [prepName, setPrepName] = useState(preparation.name || 'Preparation');
  const [prepAmount, setPrepAmount] = useState(String(preparation.amount ?? ''));
  const [prepUnitId, setPrepUnitId] = useState<string | null>(null); // For the prep's own amount/unit
  const [editableIngredients, setEditableIngredients] = useState<EditablePrepIngredient[]>([]);
  const [instructions, setInstructions] = useState<string[]>([]);
  const [referenceIngredient, setReferenceIngredient] = useState<string | null>(null);

  // Unit Modal State
  const [unitModalVisible, setUnitModalVisible] = useState(false);
  const [currentManagingComponentKey, setCurrentManagingComponentKey] = useState<string | null>(null); // Track which ingredient's unit is being set

  // Prep Unit Modal State
  const [prepUnitModalVisible, setPrepUnitModalVisible] = useState(false);

  // --- State for adding components (from CreateRecipeScreen) ---
  const [componentSearchModalVisible, setComponentSearchModalVisible] = useState(false);
  const [componentSearchQuery, setComponentSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<(Ingredient & { isPreparation?: boolean })[]>([]); // Use Ingredient type
  const [searchLoading, setSearchLoading] = useState(false);

  // --- Loading State ---
  const [isScreenLoading, setIsScreenLoading] = useState(true);

  // Add state for pieceUnitId
  const [pieceUnitId, setPieceUnitId] = useState<string | null>(null);

  // --- Effects ---
  // Combined loading effect
  useEffect(() => {
    const isLoading = loadingUnits; // Add other loading states if needed
    setIsScreenLoading(isLoading);
  }, [loadingUnits]);

  // Effect to find pieceUnitId
  useEffect(() => {
    if (!isScreenLoading && units.length > 0 && !pieceUnitId) {
      const countUnit = units.find(u =>
        u.unit_name.toLowerCase() === 'piece' ||
        u.unit_name.toLowerCase() === 'count' ||
        u.abbreviation?.toLowerCase() === 'x'
      );
      setPieceUnitId(countUnit?.unit_id || null);
    }
  }, [isScreenLoading, units, pieceUnitId]);

  // Initialize state from route params and match units
  useEffect(() => {
    if (isScreenLoading) return; // Wait for units to load

    const typedPrep = preparation as ParsedIngredient & { ingredients?: ParsedIngredient[]; instructions?: string[], reference_ingredient?: string | null };
    setPrepName(typedPrep.name || 'Preparation');
    setPrepAmount(String(typedPrep.amount ?? ''));
    setInstructions(typedPrep.instructions || []);
    setReferenceIngredient(typedPrep.reference_ingredient || null);

    // Match prep's own unit
    const parsedPrepUnit = typedPrep.unit?.toLowerCase().trim();
    let matchedPrepUnitId: string | null = null;
    if (parsedPrepUnit && units.length > 0) {
        const foundUnit = units.find(u => u.unit_name.toLowerCase() === parsedPrepUnit || u.abbreviation?.toLowerCase() === parsedPrepUnit);
        matchedPrepUnitId = foundUnit?.unit_id || null;
    }
    setPrepUnitId(matchedPrepUnitId);

    // MODIFIED: Process ingredients with auto-matching similar to CreateRecipeScreen
    const mapParsedIngredients = async () => {
      const mappedIngredients: EditablePrepIngredient[] = [];
      
      for (const ing of (typedPrep.components || [])) {
        // 1. Try to match raw ingredients (not preps) automatically
        let matchedIngredient = null;
        let matched = false;
        let matchedUnitId: string | null = null;
        
        try {
          // Only search for matches if this is a raw ingredient (not a preparation)
          if (ing.ingredient_type !== 'Preparation') {
            console.log(`Trying to auto-match "${ing.name}"...`);
            const closeMatches = await findCloseIngredient(ing.name);
            // Consider it a close match if we found something with a good similarity score
            if (closeMatches.length > 0) {
              matchedIngredient = closeMatches[0]; // Use the first/best match
              matched = true;
              console.log(`Auto-matched "${ing.name}" to "${matchedIngredient.name}" (ID: ${matchedIngredient.ingredient_id})`);
            }
          }
        } catch (error) {
          console.error(`Error trying to match ingredient "${ing.name}":`, error);
          // Continue without matching - we'll create a new ingredient later
        }
        
        // 2. Match the unit regardless
        const parsedUnit = ing.unit?.toLowerCase().trim();
        if (parsedUnit && units.length > 0) {
          const foundUnit = units.find(u => u.unit_name.toLowerCase() === parsedUnit || u.abbreviation?.toLowerCase() === parsedUnit);
          matchedUnitId = foundUnit?.unit_id || null;
        }
        
        // 3. Create the EditablePrepIngredient
        mappedIngredients.push({
          key: `prep-ing-${ing.name}-${Date.now()}`,
          ingredient_id: matched ? matchedIngredient.ingredient_id : null,
          name: matched ? matchedIngredient.name : (ing.name || 'Unknown Ingredient'),
          amountStr: String(ing.amount ?? ''),
          unitId: matchedUnitId,
          isPreparation: ing.ingredient_type?.toLowerCase() === 'preparation',
          unit: ing.unit, // Carry over original unit string
          item: ing.item, // Carry over item description
          reference_ingredient: ing.ingredient_type?.toLowerCase() === 'preparation' ? ing.reference_ingredient : null,
          matched: matched, // Flag auto-matched ingredients
        });
      }
      
      setEditableIngredients(mappedIngredients);
    };
    
    // Execute the async mapping function
    mapParsedIngredients();

  }, [preparation, isScreenLoading, units, scaleMultiplier]); // Adjusted dependencies

  // --- Handlers ---
  // Debounced search function (from CreateRecipeScreen)
  const searchIngredients = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      // Assuming lookupIngredient returns items with an `isPreparation` flag
      const results = await lookupIngredient(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching components:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [lookupIngredient]);

  // Debounce effect (from CreateRecipeScreen)
  useEffect(() => {
    const handler = setTimeout(() => {
      searchIngredients(componentSearchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [componentSearchQuery, searchIngredients]);

  // Add Component Handler (adapted from CreateRecipeScreen)
  const handleAddComponent = async (selectedComponent: any) => {
    const ingredient_id = selectedComponent?.ingredient_id || '';
    const name = selectedComponent?.name || '';
    const trimmedName = name.trim();

    if (!trimmedName) {
      Alert.alert(t('common.error'), t('alerts.errorAddComponentMissingName'));
      return;
    }

    // If we have an ID, add it directly
    if (ingredient_id) {
      addComponentWithDetails(ingredient_id, trimmedName, !!selectedComponent.isPreparation, true);
      return;
    }
    
    // No ID provided (user wants to create a new ingredient/preparation)
    try {
      // 1. Check for close/exact matches first
      const closeMatches = await findCloseIngredient(trimmedName);
      
      // 1a. Check for an exact (case-insensitive) match
      const exactMatch = closeMatches.find(match => slug(match.name) === slug(trimmedName));
      
      if (exactMatch) {
        console.log(`Found exact match for "${trimmedName}": ${exactMatch.name} (ID: ${exactMatch.ingredient_id}). Using it directly.`);
        addComponentWithDetails(exactMatch.ingredient_id, exactMatch.name, !!exactMatch.isPreparation, true);
        return;
      } 
      
      // 1b. If no exact match, but similar matches exist, prompt the user
      if (closeMatches.length > 0) {
        const bestMatch = closeMatches[0];
        Alert.alert(
          t('alerts.similarIngredientFoundTitle'),
          t('alerts.similarIngredientFoundMessage', { 
            entered: trimmedName, 
            found: bestMatch.name
          }),
          [
            {
              text: t('common.useExisting'),
              onPress: () => {
                // Add with the matched ID and name
                addComponentWithDetails(
                  bestMatch.ingredient_id,
                  bestMatch.name,
                  !!bestMatch.isPreparation,
                  true // Marked as matched
                );
              }
            },
            {
              text: t('common.createNew'),
              style: 'destructive',
              onPress: () => {
                // User explicitly wants to create new
                console.log(`User chose to create new component "${trimmedName}" despite similar matches.`);
                // Determine if it should be created as a prep based on the modal choice (if applicable)
                // For simplicity here, assume new components added this way are raw ingredients
                addComponentWithDetails('', trimmedName, false, false); 
              }
            }
          ]
        );
        return; // Exit early
      }
      
      // 2. No close or exact matches found - safe to add as new
      console.log(`No similar or exact matches found for "${trimmedName}". Creating new.`);
      // Assume new components are raw unless explicitly created as prep (e.g., via separate button)
      addComponentWithDetails('', trimmedName, false, false); 

    } catch (error) {
      console.error(`Error checking for similar/exact components "${trimmedName}":`, error);
      Alert.alert(t('common.error'), t('alerts.errorCheckingDuplicates'));
      addComponentWithDetails('', trimmedName, false, false);
    }

    // Helper function to add the component with given details
    function addComponentWithDetails(id: string, name: string, isPrep: boolean, matched: boolean) {
      setEditableIngredients(prev => [
        ...prev,
        {
          key: `new-prep-ing-${id || 'new'}-${Date.now()}`, // Adjusted key
          ingredient_id: id,
          name: name,
          amountStr: '', // Start with empty amount for new components
          unitId: null,
          isPreparation: isPrep,
          matched: matched, // Add the matched flag
        }
      ]);
      setComponentSearchModalVisible(false);
      setComponentSearchQuery('');
    }
  };

  // Remove Component Handler (from CreateRecipeScreen)
  const handleRemoveComponent = (key: string) => {
    setEditableIngredients(prev => prev.filter(c => c.key !== key));
  };

  // Update existing handler to manage amount string AND item string
  const handleIngredientUpdate = (key: string, field: 'amountStr' | 'unitId' | 'item', value: string | null) => {
    setEditableIngredients(prev =>
      prev.map(ing => (ing.key === key ? { ...ing, [field]: value } : ing))
    );
    if (field === 'unitId') {
        closeUnitModal();
    }
  };

  // Open unit modal for a specific ingredient
  const openUnitModal = (key: string) => {
    setCurrentManagingComponentKey(key);
    setUnitModalVisible(true);
  };

  const closeUnitModal = () => {
      setCurrentManagingComponentKey(null);
      setUnitModalVisible(false);
  }

  // Select unit for a specific ingredient
  const handleUnitSelect = (unit: Unit) => {
    if (currentManagingComponentKey) {
      handleIngredientUpdate(currentManagingComponentKey, 'unitId', unit.unit_id);
    }
  };

  // Open unit modal for the preparation itself
  const openPrepUnitModal = () => {
      setPrepUnitModalVisible(true);
  };

  const closePrepUnitModal = () => {
      setPrepUnitModalVisible(false);
  };

  // Select unit for the preparation itself
  const handlePrepUnitSelect = (unit: Unit) => {
      setPrepUnitId(unit.unit_id);
      closePrepUnitModal();
  };

  // Navigate to sub-preparation screen (Keep existing logic, ensure it uses the correct navigation)
  const handleSubPreparationPress = (ingredient: EditablePrepIngredient) => {
    if (ingredient.isPreparation) {
      // Need to reconstruct a ParsedIngredient-like object if needed by the screen
      // This might require storing the original parsed prep data if we navigate back to this screen type
      // For now, let's assume we navigate away or handle it differently
      console.warn("Navigation to sub-preparation edit from within preparation edit not fully implemented yet.");
      // If we navigate to PreparationDetails instead:
      // if (ingredient.ingredient_id) {
      //   navigation.navigate('PreparationDetails', { preparationId: ingredient.ingredient_id, recipeServingScale: scaleMultiplier });
      // }
    }
  };

  const handleInstructionChange = (index: number, text: string) => {
    const newInstructions = [...instructions];
    newInstructions[index] = text;
    setInstructions(newInstructions);
  };

  // Add new handlers for adding and removing instruction steps
  const handleAddInstructionStep = () => {
    setInstructions([...instructions, '']);
  };

  const handleRemoveInstructionStep = (index: number) => {
    if (instructions.length <= 1) return; // Prevent removing the last step
    const newInstructions = instructions.filter((_, i) => i !== index);
    setInstructions(newInstructions);
  };

  // --- Render ---
  if (isScreenLoading) { // Use combined loading state
      return <SafeAreaView style={styles.safeArea}><View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View></SafeAreaView>
  }

  const prepUnitAbbr = units.find(u => u.unit_id === prepUnitId)?.abbreviation || 'Unit';
  // Calculate scaled prep amount for display only
  const displayPrepAmount = formatQuantityAuto(parseFloat(prepAmount) * scaleMultiplier, prepUnitAbbr).amount;

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader title={t('screens.createPreparation.title')} showBackButton={true} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Prep Name (Not Editable here) */}
          <Text style={styles.prepName}>{capitalizeWords(prepName)}</Text>

          {/* Reference Ingredient (Display only) */}
          {referenceIngredient && (
            <View style={styles.refIngredientContainer}>
              <Text style={styles.label}>{t('screens.createPreparation.refIngredientLabel')}:</Text>
              <Text style={styles.itemText}>{capitalizeWords(referenceIngredient)}</Text>
            </View>
          )}

          {/* Prep Amount & Unit (Displays scaled amount, unit editable) */}
          <View style={styles.section}>
              <Text style={styles.label}>{t('screens.createPreparation.scaledAmountLabel')}:</Text>
              <View style={styles.componentControlsContainer}>
                   {/* Display Scaled Amount (Non-Editable) */}
                   <TextInput
                       style={[styles.componentInputAmount, styles.readOnlyInput]} // Make visually distinct
                       value={displayPrepAmount}
                       editable={false}
                   />
                   {/* Unit Selector */}
                   <TouchableOpacity
                       style={styles.componentUnitTrigger}
                       onPress={openPrepUnitModal}
                   >
                       <Text style={[styles.pickerText, !prepUnitId && styles.placeholderText]}>
                           {prepUnitAbbr}
                       </Text>
                        <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.textLight} />
                   </TouchableOpacity>
               </View>
           </View>

          {/* Ingredients Section - REFACTORED */}
          <View style={styles.section}>
              <Text style={styles.sectionHeader}>{t('screens.createPreparation.ingredientsTitle')}:</Text>
              {editableIngredients.length > 0 ? (
                editableIngredients.map((item) => {
                  const unit = units.find(u => u.unit_id === item.unitId);
                  const unitAbbr = unit?.abbreviation || 'Unit';
                  const baseAmountNum = parseFloat(item.amountStr);
                  const scaledAmount = isNaN(baseAmountNum) ? null : baseAmountNum * scaleMultiplier;
                  const formattedDisplay = formatQuantityAuto(scaledAmount, unitAbbr, item.item);

                  return (
                    <View key={item.key} style={item.isPreparation ? styles.preparationCardContainer : styles.componentItemContainer}>
                      {item.isPreparation ? (
                        // --- Render Preparation Card ---
                        <>
                          <PreparationCard
                             component={{ // Construct necessary DishComponent props
                               dish_id: '',
                               ingredient_id: item.ingredient_id || item.key,
                            name: item.name,
                               amount: isNaN(baseAmountNum) ? null : baseAmountNum, // Pass base amount
                            unit: units.find(u => u.unit_id === item.unitId) || null,
                            isPreparation: true,
                               preparationDetails: { // Construct minimal Preparation details
                                 preparation_id: item.ingredient_id || item.key,
                                 name: item.name,
                                 yield_amount: isNaN(baseAmountNum) ? null : baseAmountNum,
                                 yield_unit: units.find(u => u.unit_id === item.unitId) || null,
                                 // Add other known details if available from 'item'
                                 directions: null, total_time: null, reference_ingredient: null, ingredients: [], cooking_notes: null,
                               },
                            rawIngredientDetails: null,
                             }}
                              onPress={() => handleSubPreparationPress(item)}
                             scaleMultiplier={scaleMultiplier} // Pass scale multiplier
                             amountLabel={t('common.amount')} // Label as Amount
                           />
                          <TouchableOpacity onPress={() => handleRemoveComponent(item.key)} style={styles.removeButtonPrepCard}>
                              <MaterialCommunityIcons name="close-circle" size={24} color={COLORS.error} />
                          </TouchableOpacity>
                         </>
                      ) : (
                        // --- Render Raw Ingredient ---
                        <>
                          <Text style={styles.componentNameText}>
                            {capitalizeWords(item.name)}
                            {item.matched && (
                              <Text style={styles.matchedBadge}> {t('common.matched')}</Text>
                            )}
                          </Text>
                          <View style={styles.componentControlsContainer}>
                            {/* Editable Base Amount Input */}
                            <TextInput
                                style={[styles.componentInputAmount, { minWidth: 60 }]} // Removed marginLeft
                                placeholder={t('screens.createPreparation.amountPlaceholder')}
                                placeholderTextColor={COLORS.placeholder}
                                value={item.amountStr}
                                onChangeText={(value) => handleIngredientUpdate(item.key, 'amountStr', value)}
                                keyboardType="numeric"
                            />
                             {/* Unit Selector */}
                            <TouchableOpacity
                              style={[styles.componentUnitTrigger, { minWidth: 60, marginLeft: SIZES.base }]} // Added marginLeft
                              onPress={() => openUnitModal(item.key)}
                            >
                              <Text style={[styles.pickerText, !item.unitId && styles.placeholderText]}>
                                {unitAbbr} { /* Display only unit abbreviation */}
                              </Text>
                              <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.textLight} />
                            </TouchableOpacity>

                            {/* Conditionally Render Item Input */}
                            {item.unitId === pieceUnitId && (
                               <TextInput
                                  style={styles.itemInput} // Style includes marginLeft/marginRight
                                  placeholder="(e.g., large)"
                                  placeholderTextColor={COLORS.placeholder}
                                  value={item.item || ''}
                                  onChangeText={(value) => handleIngredientUpdate(item.key, 'item', value)}
                               />
                            )}

                            {/* Remove Button */}
                            <TouchableOpacity onPress={() => handleRemoveComponent(item.key)} style={styles.removeButton}>
                                <MaterialCommunityIcons name="close-circle" size={24} color={COLORS.error} />
                            </TouchableOpacity>
                          </View>
                        </>
                      )}
                    </View>
                  );
                })
              ) : (
                <Text style={styles.itemText}>{t('screens.createPreparation.noSubIngredients')}</Text>
              )}
               {/* Add Component Button (from CreateRecipeScreen) */}
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setComponentSearchModalVisible(true)}
              >
                {/* Reuse translation key from CreateRecipeScreen */}
                <Text style={styles.addButtonText}>{t('screens.createRecipe.addIngredientPreparationButton')}</Text>
              </TouchableOpacity>
           </View>

          {/* Instructions Section (Keep existing) */}
          <View style={styles.section}>
              <Text style={styles.sectionHeader}>{t('screens.createPreparation.instructionsTitle')}:</Text>
              {instructions.length > 0 ? (
                instructions.map((step, index) => (
                  <View key={index} style={styles.directionStepContainer}>
                    <Text style={styles.stepNumber}>{index + 1}.</Text>
                    <TextInput
                      style={styles.directionInput}
                      placeholderTextColor={COLORS.placeholder}
                      value={step}
                      onChangeText={(text) => handleInstructionChange(index, text)}
                      multiline
                    />
                    {instructions.length > 1 && (
                      <TouchableOpacity 
                        onPress={() => handleRemoveInstructionStep(index)} 
                        style={styles.removeStepButton}
                      >
                        <MaterialCommunityIcons name="close-circle-outline" size={22} color={COLORS.textLight} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.itemText}>{t('screens.createPreparation.noInstructions')}</Text>
              )}
              <TouchableOpacity 
                onPress={handleAddInstructionStep} 
                style={styles.addStepButton}
              >
                 {/* Reuse translation key */}
                <Text style={styles.addStepButtonText}>{t('screens.createRecipe.addStepButton')}</Text>
              </TouchableOpacity>
           </View>

           {/* TODO: Add Save/Update Button */}
           {/* <TouchableOpacity style={styles.saveButton} onPress={handleSaveChanges}>
              <Text style={styles.saveButtonText}>{t('common.save')}</Text>
           </TouchableOpacity> */}

        </ScrollView>
      </KeyboardAvoidingView>

       {/* Unit Selection Modal (for Ingredients) */}
       <Modal
          animationType="slide"
          transparent={true}
          visible={unitModalVisible}
          onRequestClose={closeUnitModal}
       >
           <View style={styles.modalContainer}>
               <View style={styles.modalContent}>
                   <Text style={styles.modalTitle}>{t('screens.createPreparation.selectUnitModalTitle')}</Text>
                   <FlatList
                       data={units}
                       keyExtractor={(item) => item.unit_id}
                       renderItem={({ item }) => (
                           <TouchableOpacity
                               style={styles.modalItem}
                               onPress={() => handleUnitSelect(item)}
                           >
                               <Text style={styles.modalItemText}>{capitalizeWords(item.unit_name)} ({item.abbreviation || 'N/A'})</Text>
                           </TouchableOpacity>
                       )}
                       ListEmptyComponent={<Text style={styles.emptyListText}>{t('screens.createRecipe.noUnitsFound')}</Text>}
                   />
                   <TouchableOpacity
                       style={styles.closeButton}
                       onPress={closeUnitModal}
                   >
                       <Text style={styles.closeButtonText}>{t('common.close')}</Text>
                   </TouchableOpacity>
               </View>
           </View>
       </Modal>

       {/* Unit Selection Modal (for Preparation itself) */}
       <Modal
          animationType="slide"
          transparent={true}
          visible={prepUnitModalVisible}
          onRequestClose={closePrepUnitModal}
       >
           <View style={styles.modalContainer}>
               <View style={styles.modalContent}>
                   <Text style={styles.modalTitle}>{t('screens.createPreparation.selectPrepUnitModalTitle')}</Text>
                   <FlatList
                       data={units}
                       keyExtractor={(item) => item.unit_id}
                       renderItem={({ item }) => (
                           <TouchableOpacity
                               style={styles.modalItem}
                               onPress={() => handlePrepUnitSelect(item)}
                           >
                               <Text style={styles.modalItemText}>{capitalizeWords(item.unit_name)} ({item.abbreviation || 'N/A'})</Text>
                           </TouchableOpacity>
                       )}
                       ListEmptyComponent={<Text style={styles.emptyListText}>{t('screens.createRecipe.noUnitsFound')}</Text>}
                   />
                   <TouchableOpacity
                       style={styles.closeButton}
                       onPress={closePrepUnitModal}
                   >
                       <Text style={styles.closeButtonText}>{t('common.close')}</Text>
                   </TouchableOpacity>
               </View>
           </View>
       </Modal>

        {/* Component Search Modal (from CreateRecipeScreen) */}
        <Modal
            animationType="slide"
            transparent={true}
            visible={componentSearchModalVisible}
            onRequestClose={() => setComponentSearchModalVisible(false)}
        >
           <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    {/* Reuse translation key */}
                    <Text style={styles.modalTitle}>{t('screens.createRecipe.selectComponentModalTitle')}</Text>
                    <TextInput
                        style={styles.searchInput}
                        // Reuse translation key
                        placeholder={t('screens.createRecipe.searchComponentPlaceholder')}
                        placeholderTextColor={COLORS.placeholder}
                        value={componentSearchQuery}
                        onChangeText={setComponentSearchQuery}
                    />
                    {searchLoading ? (
                        <ActivityIndicator size="large" color={COLORS.primary} style={styles.searchLoader} />
                    ) : (
                        <FlatList
                            data={searchResults}
                            keyExtractor={(item) => item.ingredient_id || `search-${item.name}`}
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
                                        {/* Button to create NEW ingredient */}
                                        <TouchableOpacity
                                            style={[styles.createNewButton, { marginTop: SIZES.padding }]}
                                            onPress={() => handleAddComponent({
                                                name: componentSearchQuery.trim(),
                                                isPreparation: false // Default to raw ingredient
                                            })}
                                        >
                                            <Text style={styles.createNewButtonText}>
                                                {t('screens.createRecipe.createButtonLabel', { query: componentSearchQuery.trim() })}
                                            </Text>
                                        </TouchableOpacity>
                                         {/* Button to create NEW preparation */}
                                         <TouchableOpacity
                                            style={[styles.createNewButton, { marginTop: SIZES.padding, borderColor: COLORS.tertiary }]} 
                                            onPress={() => handleAddComponent({
                                                name: componentSearchQuery.trim(),
                                                isPreparation: true // Create as preparation
                                            })}
                                        >
                                            <Text style={[styles.createNewButtonText, { color: COLORS.tertiary }]}>
                                                {t('screens.createRecipe.createButtonLabel', { query: componentSearchQuery.trim() })} {t('screens.createRecipe.prepSuffix')}
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

    </SafeAreaView>
  );
};

// --- Styles (Combine styles from ConfirmParsed and CreateRecipe, adapt as needed) ---
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },
  contentContainer: { 
    paddingHorizontal: SIZES.padding * 1.5, // Adjusted padding
    paddingTop: SIZES.padding, // Added top padding
    paddingBottom: SIZES.padding * 4 
  },
  prepName: { ...FONTS.h2, color: COLORS.white, marginBottom: SIZES.padding },
  refIngredientContainer: {
    marginBottom: SIZES.padding,
    flexDirection: 'row', // Align label and text horizontally
    alignItems: 'center',
  },
  // Removed refIngredientText, use itemText instead
  section: { marginBottom: SIZES.padding * 1.5 },
  sectionHeader: { ...FONTS.h3, color: COLORS.white, marginBottom: SIZES.padding },
  itemText: { ...FONTS.body3, color: COLORS.text, marginBottom: SIZES.base / 2, marginLeft: SIZES.padding }, // Added marginLeft
  metaText: { ...FONTS.body3, color: COLORS.textLight, marginBottom: SIZES.base },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  label: {
    ...FONTS.body3,
    color: COLORS.textLight,
    marginBottom: SIZES.base * 0.8,
  },
  // Component styles (adapted from CreateRecipeScreen)
  componentItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SIZES.padding / 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SIZES.base,
  },
  componentNameText: {
    ...FONTS.body3,
    color: COLORS.text,
    flex: 0.4, // Adjust flex distribution
    marginRight: SIZES.base,
  },
  componentControlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 0.6, // Adjust flex distribution
    justifyContent: 'flex-end', // Align controls to the right
  },
  componentInputAmount: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    paddingHorizontal: SIZES.base,
    paddingVertical: SIZES.base / 2,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 50, // Adjusted minWidth
    textAlign: 'right',
    fontSize: SIZES.font,
    // marginRight: SIZES.base, // Removed margin, adjusted layout
  },
  readOnlyInput: { // Style for non-editable display fields
    backgroundColor: COLORS.secondary, // Darker background
    color: COLORS.textLight, // Lighter text
    borderColor: COLORS.secondary, // Match background
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
    minHeight: 36,
    minWidth: 60, // Adjusted minWidth
    justifyContent: 'space-between',
    marginLeft: SIZES.base, // Add margin before unit trigger
  },
  pickerText: {
    ...FONTS.body3,
    color: COLORS.text,
    marginRight: 4,
  },
  placeholderText: {
    color: COLORS.placeholder,
  },
  removeButton: {
    paddingLeft: SIZES.base, // Space before remove icon
  },
  // Modal styles (from CreateRecipeScreen)
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
    maxHeight: '80%', // Adjusted height
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
    borderBottomWidth: 1, // Add separator
    borderBottomColor: COLORS.border,
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
  // Direction styles (from CreateRecipeScreen)
   directionStepContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SIZES.base,
  },
  stepNumber: {
    ...FONTS.body3,
    color: COLORS.textLight,
    marginRight: SIZES.base,
    paddingTop: SIZES.padding * 0.75,
    lineHeight: SIZES.padding * 1.5,
  },
  directionInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding * 0.75,
    ...FONTS.body3,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 48,
    textAlignVertical: 'top',
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
    marginTop: SIZES.base,
  },
  addStepButtonText: {
    color: COLORS.primary,
    ...FONTS.body3,
    fontWeight: '600',
  },
  // Add Button (from CreateRecipeScreen)
  addButton: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.primary,
    borderWidth: 1,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    marginTop: SIZES.padding, // Add margin above
  },
  addButtonText: {
    color: COLORS.primary,
    ...FONTS.body3,
    fontWeight: '600',
  },
  // Search Modal Specific Styles (from CreateRecipeScreen)
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
  searchLoader: {
    marginVertical: SIZES.padding * 2,
  },
  emptyListText: {
    ...FONTS.body3,
    color: COLORS.textLight,
    textAlign: 'center',
    paddingVertical: SIZES.padding * 2,
    fontStyle: 'italic',
  },
  createNewButton: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.primary,
    borderWidth: 1,
    padding: SIZES.padding,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    marginHorizontal: SIZES.padding, // Reduced horizontal margin
  },
  createNewButtonText: {
    color: COLORS.primary,
    ...FONTS.body3,
    fontWeight: '600',
  },
  // Prep Card specific styles (from CreateRecipeScreen)
  preparationCardContainer: {
    marginBottom: SIZES.base,
    position: 'relative', // For remove button positioning
  },
  removeButtonPrepCard: {
    position: 'absolute',
    top: SIZES.padding / 2,
    right: SIZES.padding / 2,
    backgroundColor: 'rgba(0,0,0,0.3)', // Semi-transparent background
    borderRadius: 12,
    padding: 2,
    zIndex: 1, // Ensure it's above the card
  },
  itemInput: { // Add the itemInput style (copied from CreateRecipeScreen potentially)
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
  matchedBadge: {
    backgroundColor: COLORS.primary,
    color: COLORS.white,
    paddingHorizontal: SIZES.padding * 0.25,
    paddingVertical: SIZES.padding * 0.125,
    borderRadius: SIZES.radius,
    marginLeft: SIZES.base,
  },
});

export default CreatePreparationScreen; 