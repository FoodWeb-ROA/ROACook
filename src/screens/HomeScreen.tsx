import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
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

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();

  const handleCategoryPress = (category: Category) => {
    navigation.navigate('CategoryRecipes', {
      categoryId: category.id,
      categoryName: category.name,
    });
  };

  const handleRecipePress = (recipe: Recipe) => {
    navigation.navigate('RecipeDetails', { recipe });
  };

  const handleAddCategory = () => {
    // This would open a modal or navigate to an add category screen
    // For demo purposes, we will just log a message
    console.log('Add category pressed');
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
            <TouchableOpacity onPress={handleAddCategory}>
              <MaterialCommunityIcons name="plus-circle" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={CATEGORIES}
            renderItem={({ item }) => (
              <CategoryCard
                category={item}
                onPress={handleCategoryPress}
              />
            )}
            keyExtractor={(item) => item.id}
            horizontal={false}
            numColumns={2}
            columnWrapperStyle={styles.categoriesRow}
            scrollEnabled={false}
          />
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