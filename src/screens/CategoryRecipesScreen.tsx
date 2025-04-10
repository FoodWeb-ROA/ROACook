import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { RootStackParamList } from '../navigation/types';
import RecipeCard from '../components/RecipeCard';
import AppHeader from '../components/AppHeader';
import { useRecipes } from '../hooks/useSupabase';

type CategoryRecipesRouteProp = RouteProp<RootStackParamList, 'CategoryRecipes'>;
type CategoryRecipesNavigationProp = StackNavigationProp<RootStackParamList>;

const CategoryRecipesScreen = () => {
  const navigation = useNavigation<CategoryRecipesNavigationProp>();
  const route = useRoute<CategoryRecipesRouteProp>();
  const { categoryId, categoryName } = route.params;

  // Fetch recipes filtered by menu section id
  const { recipes, loading, error } = useRecipes(categoryId);
  
  // Debug: Check if ingredients are available
  useEffect(() => {
    if (recipes && recipes.length > 0) {
      console.log('First recipe has ingredients?', !!recipes[0].ingredients);
      console.log('First recipe ingredients count:', recipes[0].ingredients?.length || 0);
      
      // Log the structure of the first ingredient if available
      if (recipes[0].ingredients && recipes[0].ingredients.length > 0) {
        console.log('First ingredient structure:', JSON.stringify(recipes[0].ingredients[0], null, 2));
      }
    }
  }, [recipes]);
  
  const handleRecipePress = (recipe: any) => {
    navigation.navigate('RecipeDetails', { recipeId: recipe.recipe_id });
  };
  
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={{ marginTop: SIZES.verticalPadding }}>
        <AppHeader
          showBackButton={true}
        />
      </View>
      <Text style={styles.categoryTitle}>{categoryName}</Text>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <Text style={styles.errorText}>Error loading recipes</Text>
      ) : (
        <FlatList
          data={recipes}
          renderItem={({ item }) => (
            <RecipeCard
              recipe={item}
              onPress={handleRecipePress}
            />
          )}
          keyExtractor={(item) => item.recipe_id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No recipes found in this category</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  categoryTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.white,
    paddingHorizontal: SIZES.padding * 2,
    paddingVertical: SIZES.padding,
  },
  listContent: {
    padding: SIZES.padding * 2,
    paddingBottom: 120, // Extra padding for tab bar
  },
  emptyContainer: {
    padding: SIZES.padding * 2,
    justifyContent: 'center',
    alignItems: 'center',
    height: 300,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...FONTS.body3,
    color: COLORS.error,
    textAlign: 'center',
    padding: SIZES.padding * 2,
  },
});

export default CategoryRecipesScreen;