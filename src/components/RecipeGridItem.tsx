import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Recipe } from '../types';
import { COLORS, SIZES, SHADOWS, GRADIENTS } from '../constants/theme';

interface RecipeGridItemProps {
  recipe: Recipe;
  onPress: (recipe: Recipe) => void;
}

const RecipeGridItem: React.FC<RecipeGridItemProps> = ({ recipe, onPress }) => {
  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={() => onPress(recipe)}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={GRADIENTS.secondary}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.title} numberOfLines={1}>{recipe.recipe_name}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 25,
    paddingVertical: SIZES.small,
    paddingHorizontal: SIZES.medium,
    ...SHADOWS.small,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 50,
    overflow: 'hidden',
  },
  title: {
    fontSize: SIZES.font,
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'center',
  },
});

export default RecipeGridItem;