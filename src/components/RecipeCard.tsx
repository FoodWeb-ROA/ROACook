import React from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Recipe } from '../types';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';

interface RecipeCardProps {
  recipe: Recipe;
  onPress: (recipe: Recipe) => void;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onPress }) => {
  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={() => onPress(recipe)}
      activeOpacity={0.8}
    >
      <Image 
        source={{ uri: recipe.imageUrl || 'https://via.placeholder.com/150' }} 
        style={styles.image} 
      />
      <View style={styles.infoContainer}>
        <Text style={styles.title} numberOfLines={1}>{recipe.name}</Text>
        <View style={styles.detailsContainer}>
          <View style={styles.detail}>
            <MaterialCommunityIcons name="clock-outline" size={16} color={COLORS.textLight} />
            <Text style={styles.detailText}>{recipe.prepTime + recipe.cookTime} min</Text>
          </View>
          <View style={styles.detail}>
            <MaterialCommunityIcons name="food-variant" size={16} color={COLORS.textLight} />
            <Text style={styles.detailText}>{recipe.servings} servings</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: COLORS.secondary,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.padding,
    ...SHADOWS.medium,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  infoContainer: {
    padding: SIZES.padding,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 8,
  },
  detailsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    marginLeft: 4,
    fontSize: 12,
    color: COLORS.textLight,
  },
});

export default RecipeCard;