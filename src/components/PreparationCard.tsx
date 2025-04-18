import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DishComponent, PreparationIngredient } from '../types';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';

interface PreparationCardProps {
  component: DishComponent;
  onPress: () => void;
}

const PreparationCard: React.FC<PreparationCardProps> = ({ component, onPress }) => {
  const preparation = component.preparationDetails;

  if (!preparation) {
    // Should ideally not happen if component.isPreparation is true, but handle defensively
    return (
      <View style={styles.card}>
        <Text style={styles.errorText}>Preparation details missing.</Text>
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

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.title}>{preparation.name || component.name}</Text>

      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <MaterialCommunityIcons name="clock-outline" size={16} color={COLORS.textLight} />
          <Text style={styles.infoText}>{formatTime(preparation.total_time)}</Text>
        </View>
        <View style={styles.infoItem}>
          <MaterialCommunityIcons name="weight" size={16} color={COLORS.textLight} />
          <Text style={styles.infoText}>
            Yield: {preparation.yield_amount || 'N/A'} {preparation.yield_unit?.abbreviation || preparation.yield_unit?.unit_name || ''}
          </Text>
        </View>
      </View>

      <Text style={styles.subTitle}>Ingredients:</Text>
      {preparation.ingredients && preparation.ingredients.length > 0 ? (
        preparation.ingredients.map((ing: PreparationIngredient) => (
          <View key={ing.ingredient_id} style={styles.ingredientItem}>
            <Text style={styles.ingredientName}>• {ing.name}</Text>
            <Text style={styles.ingredientQuantity}>
              {(ing.amount ?? 0) % 1 === 0 ? (ing.amount ?? 0).toString() : (ing.amount ?? 0).toFixed(1)} {ing.unit?.abbreviation || ing.unit?.unit_name || ''}
            </Text>
          </View>
        ))
      ) : (
        <Text style={styles.noIngredientsText}>No ingredients listed.</Text>
      )}
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
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    ...FONTS.body3,
    color: COLORS.textLight,
    marginLeft: SIZES.base / 2,
  },
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
  errorText: {
    ...FONTS.body3,
    color: COLORS.error,
    textAlign: 'center',
  },
});

export default PreparationCard; 