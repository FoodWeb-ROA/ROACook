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
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { CATEGORIES, RECIPES } from '../constants/dummyData';
import { RootStackParamList } from '../navigation/types';
import { Category, Recipe } from '../types';
import RecipeCard from '../components/RecipeCard';
import CategoryCard from '../components/CategoryCard';
import AddCategoryCard from '../components/AddCategoryCard';

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

  // Get the 5 most recent recipes
  const recentRecipes = [...RECIPES]
    .sort((a, b) => parseInt(b.id) - parseInt(a.id))
    .slice(0, 5);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Chef's Recipes</Text>
          <Text style={styles.headerSubtitle}>Main Restaurant</Text>
        </View>
        <TouchableOpacity style={styles.profileButton}>
          <MaterialCommunityIcons name="account-circle" size={40} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

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
          
          {recentRecipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onPress={handleRecipePress}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding * 2,
    paddingVertical: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.primary,
  },
  headerTitle: {
    ...FONTS.h2,
    color: COLORS.white,
  },
  headerSubtitle: {
    ...FONTS.body2,
    color: COLORS.textLight,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
  recentRecipesSection: {
    padding: SIZES.padding * 2,
    paddingTop: 0,
  },
  viewAllText: {
    ...FONTS.body3,
    color: COLORS.primary,
  },
});

export default HomeScreen;