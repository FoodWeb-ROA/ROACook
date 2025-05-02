import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { Unit, Preparation, ComponentInput, DishComponent } from '../types';
import PreparationCard from './PreparationCard'; // Assuming PreparationCard exists
import { capitalizeWords } from '../utils/textFormatters';

interface PreparationListComponentProps {
  preparations: ComponentInput[];
  units: Unit[];
  originalServings: number;
  numServings: number;
  onSelectPrep: (prep: ComponentInput) => void; // Callback when a prep card is pressed
  onRemove: (key: string) => void; // Callback to remove a prep
}

const PreparationListComponent: React.FC<PreparationListComponentProps> = ({
  preparations,
  units,
  originalServings,
  numServings,
  onSelectPrep,
  onRemove,
}) => {
  const { t } = useTranslation();

  return (
    <View>
      {preparations.length === 0 ? (
        <Text style={styles.emptyListText}>{t('screens.createRecipe.noPreparations', 'No preparations added yet.')}</Text>
      ) : (
        preparations.map((item) => {
          const prepUnit = units.find(u => u.unit_id === item.unit_id);
          const prepAmountNum = parseFloat(item.amount);

          // Construct necessary details for PreparationCard
          // Note: We might not have full sub-ingredient details here unless fetched/passed
          const pseudoPreparationDetails: Preparation = {
            preparation_id: item.ingredient_id,
            name: item.name,
            directions: item.prepStateInstructions ? item.prepStateInstructions.join('\n') : null,
            total_time: null, // Not typically available directly in ComponentInput
            yield_unit: prepUnit || null,
            yield_amount: isNaN(prepAmountNum) ? null : prepAmountNum,
            ingredients: (item.prepStateEditableIngredients || []).map(subIng => { // Use stored state if available
              const subUnit = units.find(u => u.unit_id === subIng.unitId);
              const subAmount = parseFloat(subIng.amountStr);
              return {
                preparation_id: item.ingredient_id,
                ingredient_id: subIng.ingredient_id || subIng.name, // Use name as fallback ID
                name: capitalizeWords(subIng.name),
                amount: isNaN(subAmount) ? null : subAmount,
                unit: subUnit || null
              };
            }),
            cooking_notes: null // Not typically available directly
          };

          const componentForCard: DishComponent = {
            dish_id: '', // Placeholder
            ingredient_id: item.ingredient_id,
            name: item.name,
            amount: isNaN(prepAmountNum) ? null : prepAmountNum,
            unit: prepUnit || null,
            isPreparation: true,
            preparationDetails: pseudoPreparationDetails, // Use the constructed details
            rawIngredientDetails: null
          };

          const currentScale = originalServings > 0 ? numServings / originalServings : 1;

          return (
            <View key={item.key} style={styles.preparationCardContainer}>
              <PreparationCard
                amountLabel={t('common.amount', 'Amount')}
                component={componentForCard}
                onPress={() => onSelectPrep(item)}
                scaleMultiplier={currentScale}
              />
              <TouchableOpacity onPress={() => onRemove(item.key)} style={styles.removeButtonPrepCard}>
                <MaterialCommunityIcons name="close-circle" size={24} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  emptyListText: {
    ...FONTS.body3,
    color: COLORS.textLight,
    textAlign: 'center',
    paddingVertical: SIZES.padding * 2,
    fontStyle: 'italic',
  },
  preparationCardContainer: {
    marginBottom: SIZES.base,
    position: 'relative',
  },
  removeButtonPrepCard: {
    position: 'absolute',
    top: SIZES.padding / 2,
    right: SIZES.padding / 2,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 2,
    zIndex: 1, // Ensure button is clickable over the card
  },
});

export default PreparationListComponent; 