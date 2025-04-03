import React from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Recipe } from '../types';
import { COLORS, SIZES, SHADOWS, FONTS } from '../constants/theme';

interface RecipeCardProps {
  recipe: Recipe;
  onPress: (recipe: Recipe) => void;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onPress }) => {
  // Debug the ingredients structure
  console.log('Recipe card ingredients:', recipe.ingredients);
  
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
        <Text style={styles.title} numberOfLines={1}>{recipe.recipe_name}</Text>
        <View style={styles.detailsContainer}>
          <View style={styles.detail}>
            <MaterialCommunityIcons name="clock-outline" size={16} color={COLORS.textLight} />
            <Text style={styles.detailText}>{recipe.total_time} min</Text>
          </View>
          <View style={styles.detail}>
            <MaterialCommunityIcons name="food-variant" size={16} color={COLORS.textLight} />
            <Text style={styles.detailText}>{recipe.servings} servings</Text>
          </View>
        </View>
        
        <View style={{ marginTop: 10 }}>
          <Text style={{ fontWeight: '700', fontSize: 16, color: COLORS.white }}>Ingredients:</Text>
          {recipe.ingredients && recipe.ingredients.length > 0 ? (
            <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap' }}>
              {recipe.ingredients.slice(0, 4).map((ingredient, index) => (
                <View 
                  key={index} 
                  style={{ 
                    backgroundColor: COLORS.tertiary,
                    borderRadius: 16,
                    paddingHorizontal: 10, 
                    paddingVertical: 6,
                    margin: 4,
                    ...SHADOWS.small
                  }}
                >
                  <Text style={{ fontSize: 12, color: COLORS.white, fontWeight: '500' }}>
                    {ingredient.amount > 0 ? (
                      <>
                        {ingredient.amount}
                        {ingredient.unit && ingredient.unit.abbreviation ? ` ${ingredient.unit.abbreviation} ` : ' '}
                        {ingredient.ingredient?.name}
                      </>
                    ) : (
                      ingredient.ingredient?.name
                    )}
                  </Text>
                </View>
              ))}
              {recipe.ingredients.length > 4 && (
                <View 
                  style={{ 
                    backgroundColor: COLORS.primary,
                    borderRadius: 16,
                    paddingHorizontal: 10, 
                    paddingVertical: 6,
                    margin: 4,
                    ...SHADOWS.small
                  }}
                >
                  <Text style={{ fontSize: 12, color: COLORS.white, fontWeight: '500' }}>
                    +{recipe.ingredients.length - 4} more
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={{ fontStyle: 'italic', fontSize: 14 }}>No ingredients listed</Text>
          )}
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
    marginBottom: 12,
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
  ingredientsContainer: {
    marginTop: 12,
  },
  ingredientsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.white,
    marginBottom: 8,
  },
  ingredientsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    marginHorizontal: -4,
  },
  ingredientPill: {
    backgroundColor: COLORS.tertiary,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    margin: 4,
    ...SHADOWS.small,
  },
  ingredientText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '500',
  },
  morePill: {
    backgroundColor: COLORS.primary,
  },
});

export default RecipeCard;