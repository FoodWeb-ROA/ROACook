import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Modal, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { ParsedIngredient, Unit, Preparation, DishComponent } from '../types';
import { useUnits } from '../hooks/useSupabase'; // Import useUnits hook
import AppHeader from '../components/AppHeader';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { capitalizeWords, formatQuantity, formatQuantityAuto } from '../utils/textFormatters'; // Corrected import path assumption
import PreparationCard from '../components/PreparationCard'; // Import PreparationCard

type CreatePrepRouteProp = RouteProp<RootStackParamList, 'CreatePreparation'>;
type CreatePrepNavProp = StackNavigationProp<RootStackParamList, 'CreatePreparation'>;

// Type for internal state management of ingredients
type EditablePrepIngredient = ParsedIngredient & {
    key: string; // Unique key for lists
    amountStr: string; // Keep original amount as string for TextInput
    scaledAmountStr: string; // Keep scaled amount as string for display
    unitId: string | null; // Store matched unit ID
};

const CreatePreparationScreen = () => {
  const route = useRoute<CreatePrepRouteProp>();
  const navigation = useNavigation<CreatePrepNavProp>();
  const { preparation, scaleMultiplier = 1 } = route.params;
  const { units, loading: loadingUnits } = useUnits(); // Fetch units

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


  // --- Effects ---
  // Initialize state from route params and match units
  useEffect(() => {
    if (loadingUnits) return; // Wait for units to load

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


    // Process ingredients
    const initialIngredients: EditablePrepIngredient[] = (typedPrep.components || []).map((ing, index) => {
      let matchedUnitId: string | null = null;
      const parsedUnit = ing.unit?.toLowerCase().trim();
      if (parsedUnit && units.length > 0) {
        const foundUnit = units.find(u => u.unit_name.toLowerCase() === parsedUnit || u.abbreviation?.toLowerCase() === parsedUnit);
        matchedUnitId = foundUnit?.unit_id || null;
      }

      return {
        ...ing,
        key: `prep-ing-${index}-${Date.now()}`,
        amountStr: String(ing.amount ?? ''),
        scaledAmountStr: String(ing.amount ? formatQuantity(ing.amount * scaleMultiplier) : ''),
        unitId: matchedUnitId,
      };
    });
    setEditableIngredients(initialIngredients);

  }, [preparation, units, loadingUnits, scaleMultiplier]); // Depend on preparation, units, and loading state

  // --- Handlers ---
  const handleIngredientUpdate = (key: string, field: 'amountStr' | 'unitId', value: string | null) => {
    setEditableIngredients(prev =>
      prev.map(ing => (ing.key === key ? { ...ing, [field]: value } : ing))
    );
    // Close unit modal if a unit was selected
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
    // Modal closing is handled in handleIngredientUpdate
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

  // Navigate to sub-preparation screen
  const handleSubPreparationPress = (ingredient: EditablePrepIngredient) => {
    // Only navigate if it's a preparation type
    if (ingredient.ingredient_type?.toLowerCase() === 'preparation') {
      navigation.navigate('CreatePreparation', { 
        preparation: ingredient, 
        scaleMultiplier
      });
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
  if (loadingUnits) {
      return <SafeAreaView style={styles.safeArea}><View style={styles.centered}><Text>Loading units...</Text></View></SafeAreaView>
  }

  const prepUnitName = units.find(u => u.unit_id === prepUnitId)?.abbreviation || 'Unit';
  const displayPrepAmount = formatQuantity(parseFloat(prepAmount) * scaleMultiplier);

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader title="Create/Edit Preparation" showBackButton={true} />
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
              <Text style={styles.label}>Reference Ingredient:</Text>
              <Text style={styles.itemText}>{capitalizeWords(referenceIngredient)}</Text>
            </View>
          )}

          {/* Prep Amount & Unit (Editable - shows scaled amount) */}
          <View style={styles.section}>
              <Text style={styles.label}>Amount Used in Recipe (Scaled):</Text>
              <View style={styles.componentControlsContainer}>
                   <TextInput
                       style={styles.componentInputAmount}
                       placeholder="Amt"
                       value={displayPrepAmount}
                       onChangeText={setPrepAmount}
                       keyboardType="numeric"
                       editable={false}
                   />
                   <TouchableOpacity
                       style={styles.componentUnitTrigger}
                       onPress={openPrepUnitModal}
                   >
                       <Text style={[styles.pickerText, !prepUnitId && styles.placeholderText]}>
                           {prepUnitName}
                       </Text>
                        <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.textLight} />
                   </TouchableOpacity>
               </View>
           </View>


          {/* Ingredients Section */}
          <View style={styles.section}>
              <Text style={styles.sectionHeader}>Ingredients:</Text>
              {editableIngredients.length > 0 ? (
                editableIngredients.map((item) => {
                  // Calculate scaled amount for display
                  const scaledAmount = parseFloat(item.amountStr) * scaleMultiplier;
                  const formattedDisplay = formatQuantityAuto(scaledAmount, item.unit, item.item);
                  return (
                    <View key={item.key} style={styles.componentItemContainer}>
                      {item.ingredient_type === 'Preparation' ? (
                        // Construct a temporary DishComponent-like object for PreparationCard
                        (() => {
                          const pseudoPrepDetails: Preparation = {
                            preparation_id: item.key, // Use item key as temporary ID
                            name: item.name,
                            directions: item.instructions?.join('\n') || null,
                            total_time: null, // Re-add mapping, parser doesn't provide this
                            yield_unit: units.find(u => u.unit_id === item.unitId) || null,
                            yield_amount: parseFloat(item.amountStr) || null,
                            reference_ingredient: item.reference_ingredient || null,
                            // Map ParsedIngredient sub-ingredients to PreparationIngredient (simplified)
                            ingredients: (item.components || []).map(subIng => ({
                              preparation_id: item.key, // Temporary ID
                              ingredient_id: subIng.name, // Use name as temporary ID
                              name: capitalizeWords(subIng.name),
                              amount: subIng.amount,
                              unit: units.find(u => u.abbreviation?.toLowerCase() === subIng.unit?.toLowerCase() || u.unit_name.toLowerCase() === subIng.unit?.toLowerCase()) || null,
                            })),
                            cooking_notes: null, // Not available
                          };

                          const pseudoComponent: DishComponent = {
                            dish_id: '', // Not relevant here
                            ingredient_id: item.key, // Temporary ID
                            name: item.name,
                            amount: parseFloat(item.amountStr) || null,
                            unit: units.find(u => u.unit_id === item.unitId) || null,
                            isPreparation: true,
                            preparationDetails: pseudoPrepDetails,
                            rawIngredientDetails: null,
                          };

                          return (
                            <PreparationCard
                              component={pseudoComponent}
                              onPress={() => handleSubPreparationPress(item)}
                              scaleMultiplier={scaleMultiplier}
                            />
                          );
                        })()
                      ) : (
                        // Regular ingredient
                        <>
                          <Text style={styles.componentNameText}>{capitalizeWords(item.name)}</Text>
                          <View style={styles.componentControlsContainer}>
                            <TextInput
                              style={styles.componentInputAmount}
                              placeholder="Amt"
                              placeholderTextColor={COLORS.placeholder}
                              value={formattedDisplay.amount}
                              onChangeText={(value) => handleIngredientUpdate(item.key, 'amountStr', value)}
                              keyboardType="numeric"
                              editable={false}
                            />
                            <TouchableOpacity
                              style={styles.componentUnitTrigger}
                              onPress={() => openUnitModal(item.key)}
                            >
                              <Text style={[styles.pickerText, !item.unitId && styles.placeholderText]}>
                                {formattedDisplay.unit || 'Unit'}
                              </Text>
                              <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.textLight} />
                            </TouchableOpacity>
                          </View>
                        </>
                      )}
                    </View>
                  );
                })
              ) : (
                <Text style={styles.itemText}>No sub-ingredients listed.</Text>
              )}
           </View>

          {/* Instructions Section */}
          <View style={styles.section}>
              <Text style={styles.sectionHeader}>Instructions:</Text>
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
                <Text style={styles.itemText}>No instructions provided.</Text>
              )}
              <TouchableOpacity 
                onPress={handleAddInstructionStep} 
                style={styles.addStepButton}
              >
                <Text style={styles.addStepButtonText}>+ Add Step</Text>
              </TouchableOpacity>
           </View>

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
                   <Text style={styles.modalTitle}>Select Unit</Text>
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
                   />
                   <TouchableOpacity
                       style={styles.closeButton}
                       onPress={closeUnitModal}
                   >
                       <Text style={styles.closeButtonText}>Close</Text>
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
                   <Text style={styles.modalTitle}>Select Preparation Unit</Text>
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
                   />
                   <TouchableOpacity
                       style={styles.closeButton}
                       onPress={closePrepUnitModal}
                   >
                       <Text style={styles.closeButtonText}>Close</Text>
                   </TouchableOpacity>
               </View>
           </View>
       </Modal>

    </SafeAreaView>
  );
};

// --- Styles (Combine styles from ConfirmParsed and CreateRecipe) ---
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },
  contentContainer: { 
    paddingHorizontal: SIZES.padding * 2, // Keep horizontal padding
    paddingTop: 0, // Remove top padding
    paddingBottom: SIZES.padding * 4 
  },
  prepName: { ...FONTS.h2, color: COLORS.white, marginBottom: SIZES.padding },
  refIngredientContainer: {
    marginBottom: SIZES.padding,
  },
  refIngredientText: {
    ...FONTS.body3,
    color: COLORS.text,
  },
  section: { marginBottom: SIZES.padding * 1.5 }, // Add spacing between sections
  sectionHeader: { ...FONTS.h3, color: COLORS.white, marginBottom: SIZES.padding },
  itemText: { ...FONTS.body3, color: COLORS.text, marginBottom: SIZES.base / 2, marginLeft: SIZES.padding },
  metaText: { ...FONTS.body3, color: COLORS.textLight, marginBottom: SIZES.base },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  label: { // Label style from CreateRecipeScreen
    ...FONTS.body3,
    color: COLORS.textLight,
    marginBottom: SIZES.base * 0.8,
  },
  // Copied/adapted from CreateRecipeScreen for component editing
  componentItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SIZES.padding / 2, // Reduced padding
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SIZES.base,
  },
  componentNameText: {
    ...FONTS.body3,
    color: COLORS.text,
    flex: 1, // Allow name to take up space
    marginRight: SIZES.base,
  },
  componentControlsContainer: {
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
    minWidth: 60, // Increased minWidth
    textAlign: 'right',
    fontSize: SIZES.font,
    marginRight: SIZES.base, // Add margin between amount and unit
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
    minWidth: 70, // Increased minWidth
    justifyContent: 'space-between', // Align text and icon
  },
  pickerText: {
    ...FONTS.body3,
    color: COLORS.text,
    marginRight: 4, // Add space before chevron
  },
  placeholderText: {
    color: COLORS.placeholder,
  },
  // Modal styles from CreateRecipeScreen
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
    maxHeight: '70%', // Adjusted height
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
  // Direction styles from CreateRecipeScreen
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
  // Styles for sub-preparation items
  prepItemContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center', 
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
    marginVertical: SIZES.base / 2,
  },
  prepItemContent: {
    flex: 1,
    marginRight: SIZES.base,
  },
  prepItemName: {
    ...FONTS.body2,
    color: COLORS.white,
    fontWeight: '600',
  },
  prepItemInfo: {
    ...FONTS.body3,
    color: COLORS.textLight,
    fontStyle: 'italic',
  },
  chevronIcon: {
    marginLeft: SIZES.base,
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
});

export default CreatePreparationScreen; 