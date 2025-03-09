import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS, SHADOWS } from '../constants/theme';
import { CATEGORIES, RECIPES } from '../constants/dummyData';
import { RootStackParamList } from '../navigation/types';
import { Category, Recipe } from '../types';
import CategoryCard from '../components/CategoryCard';
import AddCategoryCard from '../components/AddCategoryCard';
import RecipeGridItem from '../components/RecipeGridItem';
import AppHeader from '../components/AppHeader';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [categories, setCategories] = useState<Category[]>(CATEGORIES);

  const handleCategoryPress = (category: Category) => {
    navigation.navigate('CategoryRecipes', {
      categoryId: category.id,
      categoryName: category.name,
    });
  };

  const handleRecipePress = (recipe: Recipe) => {
    navigation.navigate('RecipeDetails', { recipe });
  };

  const handleAddSection = (sectionName: string) => {
    // For now, just display an alert without backend logic
    if (Platform.OS === 'web') {
      window.alert(`Section "${sectionName}" has been added.`);
    } else {
      // React Native's Alert for iOS/Android
      Alert.alert(
        "New Section Added",
        `Section "${sectionName}" has been added.`,
        [{ text: "OK" }]
      );
    }
    
    // Add the new section to the local state
    const newSection: Category = {
      id: `${Date.now()}`, // Simple temporary ID
      name: sectionName,
      icon: 'folder', // Default icon
    };
    
    setCategories([...categories, newSection]);
  };

  // Get the 8 most recent recipes for the grid
  const recentRecipes = [...RECIPES]
    .sort((a, b) => parseInt(b.id) - parseInt(a.id))
    .slice(0, 8);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <AppHeader 
        title="Home"
        showProfileButton={true}
        onProfilePress={() => console.log('Profile button pressed')}
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
          
          {/* Using a grid layout instead of FlatList for better cross-platform support */}
          <View style={styles.categoriesGrid}>
            {/* Map through categories */}
            {categories.slice(0, 3).map(category => (
              <CategoryCard
                key={category.id}
                category={category}
                onPress={handleCategoryPress}
              />
            ))}
            
            {/* Add Category Card */}
            <AddCategoryCard onAdd={handleAddSection} />
          </View>
        </View>

        <View style={styles.recentRecipesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Recipes</Text>
            <TouchableOpacity onPress={() => console.log('View all recipes')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.recipesGrid}>
            {recentRecipes.map((recipe) => (
              <RecipeGridItem
                key={recipe.id}
                recipe={recipe}
                onPress={handleRecipePress}
              />
            ))}
          </View>
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
  categoriesRow: {
    justifyContent: 'space-between',
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
    elevation: 5,
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
});

export default HomeScreen;