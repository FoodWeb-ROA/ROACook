import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';
import { RootStackParamList } from '../navigation/types';
import { Category, Recipe } from '../types';
import CategoryCard from '../components/CategoryCard';
import AddCategoryCard from '../components/AddCategoryCard';
import RecipeGridItem from '../components/RecipeGridItem';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';
import { useMenuSections, useRecipes } from '../hooks/useSupabase';
import { supabase } from '../data/supabaseClient';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { user } = useAuth();
  
  // Quick DB check for debugging
  React.useEffect(() => {
    const checkIngredientsTable = async () => {
      // Check if there are any ingredients in the recipe_ingredients table
      const { data, error, count } = await supabase
        .from('recipe_ingredients')
        .select('*', { count: 'exact' });
      
      console.log('Recipe ingredients check - count:', count);
      console.log('Recipe ingredients check - error:', error);
      if (data && data.length > 0) {
        console.log('Recipe ingredients check - first item:', JSON.stringify(data[0]));
      } else {
        console.log('Recipe ingredients check - no data found');
      }
    };
    
    checkIngredientsTable();
  }, []);
  
  // Use dynamic data loading hooks
  const { menuSections, loading: loadingCategories, error: categoriesError } = useMenuSections();
  const { recipes, loading: loadingRecipes, error: recipesError } = useRecipes();

  const handleCategoryPress = (category: any) => {
    navigation.navigate('CategoryRecipes', {
      categoryId: category.menu_section_id,
      categoryName: category.name,
    });
  };

  const handleRecipePress = (recipe: any) => {
    navigation.navigate('RecipeDetails', { recipeId: recipe.recipe_id });
  };

  const handleAddSection = async (sectionName: string) => {
    // We would add logic here to save to Supabase
    Alert.alert(
      "New Section Added",
      `Section "${sectionName}" has been added.`,
      [{ text: "OK" }]
    );
    
    // In a real app, we would call a function to save to Supabase
    // and then refresh our categories list
  };

  // Get the 8 most recent recipes for the grid
  const recentRecipes = recipes
    ? [...recipes]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 8)
    : [];

  // Map menu sections to the format expected by CategoryCard
  const formattedCategories = menuSections?.map(section => ({
    ...section,
    icon: 'silverware-fork-knife' // Default icon
  })) || [];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <AppHeader 
        title="Home"
        onProfilePress={() => navigation.navigate('Settings')}
      />

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.categoriesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Categories')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {loadingCategories ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : categoriesError ? (
            <Text style={styles.errorText}>Error loading categories</Text>
          ) : (
            <View style={styles.categoriesGrid}>
              {/* Map through categories */}
              {formattedCategories.slice(0, 7).map(category => (
                <CategoryCard
                  key={category.menu_section_id}
                  category={category}
                  onPress={handleCategoryPress}
                />
              ))}
              
              {/* Add Category Card */}
              <AddCategoryCard onAdd={handleAddSection} />
            </View>
          )}
        </View>

        <View style={styles.recentRecipesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Recipes</Text>
            <TouchableOpacity onPress={() => console.log('View all recipes')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {loadingRecipes ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : recipesError ? (
            <Text style={styles.errorText}>Error loading recipes</Text>
          ) : (
            <View style={styles.recipesGrid}>
              {recentRecipes.map((recipe) => (
                <RecipeGridItem
                  key={recipe.recipe_id}
                  recipe={{
                    recipe_id: recipe.recipe_id.toString(),
                    recipe_name: recipe.recipe_name,
                    menu_section_id: recipe.menu_section_id.toString(),
                    directions: recipe.directions || '',
                    prep_time: recipe.prep_time,
                    total_time: recipe.total_time,
                    rest_time: recipe.rest_time,
                    servings: recipe.servings,
                    cooking_notes: recipe.cooking_notes || '',
                  }}
                  onPress={() => handleRecipePress(recipe)}
                />
              ))}
              
              {recentRecipes.length === 0 && (
                <Text style={styles.noDataText}>No recipes found</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>
      
      {/* Floating Action Buttons */}
      <View style={styles.floatingButtonsContainer}>
        <TouchableOpacity 
          style={[styles.floatingButton, styles.createButton]}
          onPress={() => console.log('Create Recipe pressed')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="plus" size={20} color={COLORS.white} />
          <Text style={styles.floatingButtonText}>Create Recipe</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.floatingButton, styles.uploadButton]}
          onPress={() => console.log('Upload Recipe pressed')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="upload" size={20} color={COLORS.white} />
          <Text style={styles.floatingButtonText}>Upload Recipe</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  categoriesSection: {
    padding: SIZES.padding * 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.padding,
  },
  sectionTitle: {
    ...FONTS.h3,
    color: COLORS.text,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  recipesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  recentRecipesSection: {
    padding: SIZES.padding * 2,
    paddingTop: 0,
  },
  viewAllText: {
    ...FONTS.body3,
    color: COLORS.primary,
  },
  floatingButtonsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  floatingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SIZES.padding * 0.75,
    paddingHorizontal: SIZES.padding * 1.5,
    borderRadius: 25, // Pill shape
    margin: 8,
    ...SHADOWS.medium,
  },
  createButton: {
    backgroundColor: COLORS.tertiary,
  },
  uploadButton: {
    backgroundColor: COLORS.primary,
  },
  floatingButtonText: {
    ...FONTS.body3,
    color: COLORS.white,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    ...FONTS.body3,
    color: COLORS.error,
    textAlign: 'center',
    padding: 10,
  },
  noDataText: {
    ...FONTS.body3,
    color: COLORS.text,
    textAlign: 'center',
    padding: 20,
    width: '100%',
  },
});

export default HomeScreen;