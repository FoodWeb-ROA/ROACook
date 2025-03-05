import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Modal, 
  TextInput, 
  TouchableWithoutFeedback, 
  Keyboard,
  Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS, FONTS } from '../constants/theme';

interface AddCategoryCardProps {
  onAdd: (sectionName: string) => void;
}

const AddCategoryCard: React.FC<AddCategoryCardProps> = ({ onAdd }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [sectionName, setSectionName] = useState('');

  const handleAddSection = () => {
    if (sectionName.trim()) {
      onAdd(sectionName.trim());
      setSectionName('');
    }
    setModalVisible(false);
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  // Add console log for debugging
  console.log("Rendering AddCategoryCard, platform:", Platform.OS);
  
  // On web, we need to handle the border style differently
  const containerStyle = [
    styles.container,
    Platform.OS === 'web' ? { 
      borderStyle: 'dashed',  // Explicitly set dashed for web
      borderWidth: 2,
      borderColor: COLORS.border
    } : {}
  ];
  
  return (
    <>
      <TouchableOpacity 
        style={containerStyle}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
        testID="add-category-card" // Add test ID for easy identification
      >
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name="plus" size={30} color={COLORS.white} />
        </View>
        <Text style={styles.title}>New Section</Text>
      </TouchableOpacity>

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={dismissKeyboard}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add New Section</Text>
              <TextInput
                style={styles.input}
                placeholder="Section Name"
                placeholderTextColor={COLORS.placeholder}
                value={sectionName}
                onChangeText={setSectionName}
                autoFocus={true}
              />
              <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => {
                    setSectionName('');
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.addButton}
                  onPress={handleAddSection}
                >
                  <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '45%',
    backgroundColor: 'transparent', // Transparent background to focus on border
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginBottom: SIZES.padding,
    alignItems: 'center',
    ...SHADOWS.small,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.border, // Match theme's border color
    minHeight: 120, // Ensure consistent height
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: COLORS.primary, // Match CategoryCard
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.base,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    padding: SIZES.padding * 2,
    ...SHADOWS.medium,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.white,
    marginBottom: SIZES.padding,
    textAlign: 'center',
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    color: COLORS.white,
    marginBottom: SIZES.padding,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    paddingVertical: SIZES.padding,
    paddingHorizontal: SIZES.padding * 2,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.background,
    flex: 1,
    marginRight: SIZES.padding,
  },
  cancelButtonText: {
    color: COLORS.white,
    textAlign: 'center',
    fontWeight: '600',
  },
  addButton: {
    paddingVertical: SIZES.padding,
    paddingHorizontal: SIZES.padding * 2,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.tertiary,
    flex: 1,
    marginLeft: SIZES.padding,
  },
  addButtonText: {
    color: COLORS.white,
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default AddCategoryCard;