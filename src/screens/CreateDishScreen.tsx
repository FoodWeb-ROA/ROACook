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
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';
import { RootStackParamList } from '../navigation/types';
import { supabase } from '../data/supabaseClient';
import { Unit, MenuSection, Ingredient } from '../types';
import { useMenuSections, useUnits, useIngredients } from '../hooks/useSupabase';
import { Picker } from '@react-native-picker/picker';
import AppHeader from '../components/AppHeader';
import { TextInputChangeEventData } from 'react-native';

type CreateDishNavigationProp = StackNavigationProp<RootStackParamList>;

// Input type for a component being added
export type ComponentInput = {
    key: string; // Unique key for FlatList/mapping
    ingredient_id: string;
    name: string; // Store name for display convenience
    amount: string; // Keep as string for input field
    unit_id: string | null;
    isPreparation: boolean;
};

// Rename screen component
const CreateDishScreen = () => {
  const navigation = useNavigation<CreateDishNavigationProp>();

  // --- Hooks for fetching data --- 
  const { menuSections, loading: loadingSections } = useMenuSections();
  const { units, loading: loadingUnits } = useUnits(); // Assumes useUnits hook exists
  // Fetch both ingredients and preparations for component selection
  const { ingredients: availableComponents, loading: loadingComponents } = useIngredients(true); // Assumes useIngredients hook exists and accepts flag

  // --- Form State --- 
  const [dishName, setDishName] = useState('');
  const [menuSectionId, setMenuSectionId] = useState<string | null>(null);
  const [directions, setDirections] = useState('');
  const [totalTimeHours, setTotalTimeHours] = useState('0'); // Store time parts
  const [totalTimeMinutes, setTotalTimeMinutes] = useState('30');
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

  // --- Effects --- 
  // Effect to handle loading state based on all hooks
  useEffect(() => {
    setLoading(loadingSections || loadingUnits || loadingComponents);
  }, [loadingSections, loadingUnits, loadingComponents]);

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

  // Implement submission logic
  const handleSaveDish = async () => {
    // --- 1. Validation --- 
    if (!dishName.trim()) {
      Alert.alert('Missing Information', 'Please enter a dish name.');
      return;
    }
    if (!servingUnitId) {
      Alert.alert('Missing Information', 'Please select a serving unit.');
      return;
    }
    // Validate components: ensure amount is a positive number and unit is selected
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

    setSubmitting(true);

    try {
        // --- 2. Data Formatting --- 
        const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
        const servingSizeNum = parseInt(servingSize) || 1; // Default to 1 if invalid

        // --- 3. Insert into 'dishes' table --- 
        const { data: dishInsertData, error: dishError } = await supabase
            .from('dishes')
            .insert({ 
                dish_name: dishName.trim(), 
                menu_section_id: menuSectionId, // Can be null
                directions: directions.trim() || null,
                total_time: timeString, // Format as interval string
                serving_size: servingSizeNum,
                serving_unit_id: servingUnitId, // Already validated
                cooking_notes: cookingNotes.trim() || null
                // Add other fields like total_yield, serving_item if needed
             })
            .select('dish_id') // Select the ID of the newly inserted dish
            .single();

        // Handle potential error during dish insertion
        if (dishError) throw dishError; 
        if (!dishInsertData || !dishInsertData.dish_id) throw new Error('Failed to insert dish or retrieve dish ID');
        
        const newDishId = dishInsertData.dish_id;
        console.log('Dish inserted with ID:', newDishId);

        // --- 5. Prepare components array for insert --- 
        const componentsToInsert = components.map(c => ({ 
            dish_id: newDishId,
            ingredient_id: c.ingredient_id,
            amount: parseFloat(c.amount), // Convert amount string to number
            unit_id: c.unit_id // Already validated to be non-null
        })); 
        
        console.log('Inserting components:', componentsToInsert);

        // --- 6. Insert into 'dish_components' table --- 
        const { error: componentsError } = await supabase
            .from('dish_components')
            .insert(componentsToInsert);
            
        // Handle potential error during component insertion
        if (componentsError) throw componentsError;
        
        // --- 7. Success Feedback & Navigation --- 
        Alert.alert('Success', 'Dish created successfully!');
        // TODO: Maybe navigate to the new dish detail screen? Requires passing dishId
        navigation.goBack(); // Go back to the previous screen

    } catch (error: any) {
        console.error("Error saving dish:", error);
        Alert.alert('Error Saving Dish', error.message || 'An unexpected error occurred. Please try again.');
    } finally {
        setSubmitting(false);
    }
  };


  // --- Render Logic --- 
  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" /></View>;
  }

  // Find names for selected category and unit for display
  const selectedCategoryName = menuSections.find(s => s.menu_section_id === menuSectionId)?.name || 'Select Category';
  const selectedServingUnitName = units.find(u => u.unit_id === servingUnitId)?.unit_name || 'Select Unit';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled" // Closes keyboard when tapping outside inputs
        >
          {/* Dish Name Input */}
          <Text style={styles.label}>Dish Name *</Text>
          <TextInput 
              style={styles.input}
              placeholder="Enter dish name"
              placeholderTextColor={COLORS.placeholder}
              value={dishName}
              onChangeText={setDishName}
          />

          {/* Category Picker Trigger */}
          <Text style={styles.label}>Category</Text>
          <TouchableOpacity style={styles.pickerTrigger} onPress={openCategorySelector}>
              <Text style={[styles.pickerText, !menuSectionId && styles.placeholderText]}>
                  {selectedCategoryName}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={24} color={COLORS.textLight} />
          </TouchableOpacity>

          {/* Serving Size & Unit Inputs Row */}
          <View style={styles.rowContainer}>
              <View style={styles.inputGroup}> 
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
              <View style={styles.inputGroup}> 
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
           <View style={styles.rowContainer}>
              <View style={styles.inputGroup}> 
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
              <View style={styles.inputGroup}> 
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
          <TextInput 
              style={[styles.input, styles.textArea]}
              placeholder="Enter step-by-step directions"
              placeholderTextColor={COLORS.placeholder}
              value={directions}
              onChangeText={setDirections}
              multiline
          />

          {/* Cooking Notes Input */}
          <Text style={styles.label}>Cooking Notes</Text>
          <TextInput 
              style={[styles.input, styles.textArea, { minHeight: 60 }]} // Shorter text area
              placeholder="Optional notes, tips, variations"
              placeholderTextColor={COLORS.placeholder}
              value={cookingNotes}
              onChangeText={setCookingNotes}
              multiline
          />

          {/* --- Components Section --- */}
          <Text style={styles.sectionTitle}>Components</Text>
          <FlatList
              data={components}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                  <View style={styles.componentItemContainer}>
                      <Text style={styles.componentNameText}>{item.name} {item.isPreparation ? '(Prep)' : ''}</Text>
                      <View style={styles.componentControlsContainer}>
                          <TextInput 
                              style={styles.componentInputAmount}
                              placeholder="Amt"
                              placeholderTextColor={COLORS.placeholder}
                              value={item.amount}
                              onChangeText={(value) => handleComponentUpdate(item.key, 'amount', value)}
                              keyboardType="numeric"
                          />
                          {/* Unit Picker Trigger for Component */}
                          <TouchableOpacity 
                              style={styles.componentUnitTrigger}
                              onPress={() => openComponentUnitSelector(item.key)} 
                          >
                              <Text style={[styles.pickerText, !item.unit_id && styles.placeholderText]}>
                                  {units.find(u => u.unit_id === item.unit_id)?.abbreviation || 'Unit'}
                              </Text>
                               <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.textLight} />
                          </TouchableOpacity>
                          {/* Remove Button */}
                          <TouchableOpacity onPress={() => handleRemoveComponent(item.key)} style={styles.removeButton}>
                              <MaterialCommunityIcons name="close-circle" size={24} color={COLORS.error} />
                          </TouchableOpacity>
                      </View>
                  </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyListText}>No components added yet.</Text>}
              // Disable scrolling within the main ScrollView
              scrollEnabled={false} 
          />

          <TouchableOpacity 
              style={styles.addButton} 
              onPress={() => setComponentSearchModalVisible(true)}
          >
              <Text style={styles.addButtonText}>+ Add Component</Text>
          </TouchableOpacity>

          <TouchableOpacity 
              style={[styles.button, styles.saveButton]} 
              onPress={handleSaveDish} 
              disabled={submitting}
          >
              {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.buttonText}>Save Dish</Text>}
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
    // Remove padding if added by SafeAreaView
    // padding: SIZES.padding,
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    padding: SIZES.padding * 2, // Add padding inside scroll view
    paddingBottom: SIZES.padding * 5, // Ensure space for save button
  },
  inputGroup: {
    marginBottom: SIZES.padding * 1.5,
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    ...FONTS.body3,
    color: COLORS.textLight,
    marginBottom: SIZES.base,
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
});

// Rename export
export default CreateDishScreen; 