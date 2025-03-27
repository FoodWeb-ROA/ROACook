import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { COLORS, SIZES } from '../constants/theme';
import { RECIPES } from '../constants/dummyData';
import { RootStackParamList } from '../navigation/types';
import { Recipe } from '../types';
import RecipeCard from '../components/RecipeCard';
import AppHeader from '../components/AppHeader';

type CategoryRecipesRouteProp = RouteProp<RootStackParamList, 'CategoryRecipes'>;
type CategoryRecipesNavigationProp = StackNavigationProp<RootStackParamList>;

const CategoryRecipesScreen = () => {
  const navigation = useNavigation<CategoryRecipesNavigationProp>();
  const route = useRoute<CategoryRecipesRouteProp>();
  const { categoryId } = route.params;

  // Filter recipes by category
  const categoryRecipes = RECIPES.filter(recipe => recipe.category === categoryId);

  const handleRecipePress = (recipe: Recipe) => {
    navigation.navigate('RecipeDetails', { recipe });
  };

  // Extract category name from route params
  const categoryName = route.params.categoryName;
  
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <AppHeader
        showBackButton={true}
      />
      <Text style={styles.categoryTitle}>{categoryName}</Text>
      
      {/* Use a simple map instead of FlatList as a test */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {categoryRecipes.length > 0 ? (
          categoryRecipes.map(item => (
            <RecipeCard
              key={item.id}
              recipe={item}
              onPress={handleRecipePress}
            />
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No recipes found in this category</Text>
          </View>
        )}
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
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
});

export default CategoryRecipesScreen;