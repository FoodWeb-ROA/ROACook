import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { RECIPES, CATEGORIES } from '../constants/dummyData';
import { RootStackParamList } from '../navigation/types';
import { Recipe } from '../types';
import RecipeCard from '../components/RecipeCard';

type SearchScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const SearchScreen = () => {
  const navigation = useNavigation<SearchScreenNavigationProp>();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  const handleRecipePress = (recipe: Recipe) => {
    navigation.navigate('RecipeDetails', { recipe });
  };

  // Filter recipes based on search query and category filter
  const filteredRecipes = RECIPES.filter(recipe => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipe.ingredients.some(ingredient => 
        ingredient.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    
    const matchesCategory = activeFilter === 'All' || 
      recipe.category === CATEGORIES.find(cat => cat.name === activeFilter)?.id;
    
    return matchesSearch && matchesCategory;
  });

  // Get all category names for filter
  const filterOptions = ['All', ...CATEGORIES.map(category => category.name)];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search Recipes</Text>
      </View>
      
      <View style={styles.searchContainer}>
        <View style={styles.searchBarWrapper}>
          <MaterialCommunityIcons name="magnify" size={24} color={COLORS.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by recipe name or ingredient"
            placeholderTextColor={COLORS.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
          )}
        </View>
        
        <FlatList
          data={filterOptions}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[
                styles.filterButton,
                activeFilter === item && styles.activeFilterButton
              ]}
              onPress={() => setActiveFilter(item)}
            >
              <Text 
                style={[
                  styles.filterButtonText,
                  activeFilter === item && styles.activeFilterText
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContainer}
        />
      </View>
      
      {filteredRecipes.length > 0 ? (
        <FlatList
          data={filteredRecipes}
          renderItem={({ item }) => (
            <RecipeCard
              recipe={item}
              onPress={handleRecipePress}
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons 
            name="food-off" 
            size={60} 
            color={COLORS.textLight} 
          />
          <Text style={styles.emptyText}>
            No recipes found for "{searchQuery}"
          </Text>
          <Text style={styles.emptySubtext}>
            Try searching for another recipe or ingredient
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
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
  searchContainer: {
    paddingHorizontal: SIZES.padding * 2,
    paddingTop: SIZES.padding,
    paddingBottom: SIZES.padding / 2,
    backgroundColor: COLORS.secondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.padding / 2,
    marginBottom: SIZES.padding,
  },
  searchInput: {
    flex: 1,
    marginLeft: SIZES.padding,
    fontSize: 16,
    color: COLORS.text,
  },
  filtersContainer: {
    paddingVertical: SIZES.padding / 2,
  },
  filterButton: {
    paddingHorizontal: SIZES.padding,
    paddingVertical: SIZES.base,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.surface,
    marginRight: SIZES.base,
  },
  activeFilterButton: {
    backgroundColor: COLORS.primary,
  },
  filterButtonText: {
    ...FONTS.body3,
    color: COLORS.text,
  },
  activeFilterText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  listContent: {
    padding: SIZES.padding * 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding * 2,
  },
  emptyText: {
    ...FONTS.h3,
    color: COLORS.text,
    marginTop: SIZES.padding,
    textAlign: 'center',
  },
  emptySubtext: {
    ...FONTS.body2,
    color: COLORS.textLight,
    marginTop: SIZES.base,
    textAlign: 'center',
  },
});

export default SearchScreen;