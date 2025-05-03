import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, SIZES, FONTS } from '../constants/theme';

interface DirectionsInputListProps {
  directions?: string[];
  onDirectionsUpdate: (directions: string[]) => void;
}

const DirectionsInputList: React.FC<DirectionsInputListProps> = ({
  directions,
  onDirectionsUpdate,
}) => {
  const { t } = useTranslation();

  const [internalDirections, setInternalDirections] = useState<string[]>(directions || ['']);

  useEffect(() => {
    if (directions && JSON.stringify(directions) !== JSON.stringify(internalDirections)) {
      setInternalDirections(directions);
    }
  }, [directions]);

  useEffect(() => {
    onDirectionsUpdate(internalDirections);
  }, [internalDirections, onDirectionsUpdate]);

  const handleDirectionChange = (index: number, text: string) => {
    const newDirections = [...internalDirections];
    newDirections[index] = text;
    setInternalDirections(newDirections);
  };

  const handleAddStep = () => {
    setInternalDirections([...internalDirections, '']);
  };

  const handleRemoveStep = (index: number) => {
    if (internalDirections.length <= 1) return;
    const newDirections = internalDirections.filter((_, i) => i !== index);
    setInternalDirections(newDirections);
  };

  return (
    <View style={styles.inputGroup}>
      {internalDirections.map((step, index) => (
        <View key={index} style={styles.directionStepContainer}>
          <Text style={styles.stepNumber}>{String(index + 1)}.</Text>
          <TextInput
            style={styles.directionInput}
            placeholderTextColor={COLORS.placeholder}
            value={step}
            onChangeText={(text) => handleDirectionChange(index, text)}
            multiline
          />
          {internalDirections.length > 1 && (
            <TouchableOpacity onPress={() => handleRemoveStep(index)} style={styles.removeStepButton}>
              <MaterialCommunityIcons name="close-circle-outline" size={22} color={COLORS.textLight} />
            </TouchableOpacity>
          )}
        </View>
      ))}
      <TouchableOpacity onPress={handleAddStep} style={styles.addStepButton}>
        <Text style={styles.addStepButtonText}>{t('screens.createRecipe.addStepButton')}</Text>
      </TouchableOpacity>
    </View>
  );
};

// Add relevant styles from CreateRecipeScreen/CreatePreparationScreen
const styles = StyleSheet.create({
  inputGroup: {
    marginBottom: SIZES.padding * 1.8,
  },
  directionStepContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SIZES.base,
  },
  stepNumber: {
    ...FONTS.body3,
    color: COLORS.textLight,
    marginRight: SIZES.base,
    paddingTop: SIZES.padding * 0.75, // Align with TextInput padding
    lineHeight: SIZES.padding * 1.5, // Adjust line height for centering
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
    minHeight: 48, // Match other inputs
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
    color: COLORS.primary, // Match text color from original button
    ...FONTS.body3,
    fontWeight: '600', // Match weight from original button
  },
});

export default DirectionsInputList; 