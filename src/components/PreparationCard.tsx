import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DishComponent, PreparationIngredient } from '../types';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';
import { formatQuantityAuto, capitalizeWords } from '../utils/textFormatters';
import { useTranslation } from 'react-i18next';

interface PreparationCardProps {
  component: DishComponent;
  onPress: () => void;
  scaleMultiplier?: number;
  amountLabel?: string;
  hideReferenceIngredient?: boolean;
}

const PreparationCard: React.FC<PreparationCardProps> = ({ component, onPress, scaleMultiplier = 1, amountLabel, hideReferenceIngredient = false }) => {
  const preparation = component.preparationDetails;
  const { t } = useTranslation();

  // Use translated default for amountLabel
  const displayLabel = amountLabel || t('common.yield');

  if (!preparation) {
    // Should ideally not happen if component.isPreparation is true, but handle defensively
    return (
      <View style={styles.card}>
        <Text style={styles.errorText}>{t('components.preparationCard.errorText')}</Text>
      </View>
    );
  }

  // Helper to format time (similar to DishDetailScreen)
  const formatTime = (interval: number | null): string => {
      if (interval === null || interval === undefined) return 'N/A';
      // Assuming interval is in minutes for simplicity based on previous schema/hooks
      const hours = Math.floor(interval / 60);
      const minutes = interval % 60;
      if (hours > 0) return `${hours}h ${minutes}m`;
      return `${minutes} min`;
  };

  // Calculate scaled yield
  const scaledYieldAmount = preparation.yield_amount ? preparation.yield_amount * scaleMultiplier : null;
  const yieldUnitAbbr = preparation.yield_unit?.abbreviation || preparation.yield_unit?.unit_name || '';
  const formattedYield = formatQuantityAuto(scaledYieldAmount, yieldUnitAbbr);

  // Construct yield text, conditionally adding reference ingredient
  let yieldText = `${formattedYield.amount} ${formattedYield.unit}`;
  if (preparation.reference_ingredient && !hideReferenceIngredient) {
    // Use the new localization key with interpolation
    yieldText += ` ${t('common.ofReferenceIngredient', { ingredient: capitalizeWords(preparation.reference_ingredient) })}`;
  }

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.title}>{preparation.name || component.name}</Text>

      <View style={styles.infoRow}>
        {preparation.total_time !== null && preparation.total_time !== undefined && (
          <View style={styles.infoItem}>
            <MaterialCommunityIcons name="clock-outline" size={16} color={COLORS.textLight} />
            <Text style={styles.infoText}>{formatTime(preparation.total_time)}</Text>
          </View>
        )}
        {/* Only show Yield/Amount if available */}
        {formattedYield.amount !== 'N/A' && (
           <View style={styles.infoItem}> 
            <MaterialCommunityIcons name="scale-balance" size={16} color={COLORS.textLight} />
            <Text style={styles.infoText}>
              {displayLabel}: {yieldText} {/* Use combined yield text */}
            </Text>
           </View>
        )}
      </View>
      
      {/* REMOVED reference ingredient section */}

      <Text style={styles.subTitle}>{t('components.preparationCard.subTitle')}</Text>
      {preparation.ingredients && preparation.ingredients.length > 0 ? (
        preparation.ingredients.slice(0, 3).map((ing: PreparationIngredient) => {
          const scaledIngAmount = ing.amount ? ing.amount * scaleMultiplier : null;
          const ingUnitAbbr = ing.unit?.abbreviation || ing.unit?.unit_name || '';
          const formattedIng = formatQuantityAuto(scaledIngAmount, ingUnitAbbr);
          return (
            <View key={ing.ingredient_id} style={styles.ingredientItem}>
              <Text style={styles.ingredientName}>• {capitalizeWords(ing.name)}</Text>
              <Text style={styles.ingredientQuantity}>
                {formattedIng.amount} {formattedIng.unit}
              </Text>
            </View>
          );
        })
      ) : (
        <Text style={styles.noIngredientsText}>{t('components.preparationCard.noIngredientsText')}</Text>
      )}
      {preparation.ingredients && preparation.ingredients.length > 3 && <Text style={styles.ellipsisText}>...</Text>}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginBottom: SIZES.base,
    ...SHADOWS.medium,
  },
  title: {
    ...FONTS.h3,
    color: COLORS.text,
    marginBottom: SIZES.base,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SIZES.base,
    flexWrap: 'wrap', // Allow wrapping if content is too long
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SIZES.padding, // Add spacing between items
    marginBottom: SIZES.base / 2, // Add spacing if items wrap
  },
  infoText: {
    ...FONTS.body3,
    color: COLORS.textLight,
    marginLeft: SIZES.base / 2,
    flexShrink: 1, // Allow text to shrink if needed
  },
  // REMOVED referenceIngredientContainer and referenceIngredientText styles
  subTitle: {
    ...FONTS.h4,
    color: COLORS.text,
    marginTop: SIZES.base,
    marginBottom: SIZES.base / 2,
  },
  ingredientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SIZES.base / 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginLeft: SIZES.base, // Indent ingredients
  },
  ingredientName: {
    ...FONTS.body3,
    color: COLORS.text,
    flex: 1, // Allow name to wrap
    marginRight: SIZES.base,
  },
  ingredientQuantity: {
    ...FONTS.body3,
    color: COLORS.textLight,
  },
  noIngredientsText: {
    ...FONTS.body3,
    color: COLORS.textLight,
    fontStyle: 'italic',
    marginLeft: SIZES.base,
  },
  ellipsisText: {
    ...FONTS.body3,
    color: COLORS.textLight,
    marginLeft: SIZES.base,
    textAlign: 'left',
  },
  errorText: {
    ...FONTS.body3,
    color: COLORS.error,
    textAlign: 'center',
  },
});

export default PreparationCard; 