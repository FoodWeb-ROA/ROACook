import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { COLORS, SIZES } from '../constants/theme';
import { RECIPES } from '../constants/dummyData';
import { RootStackParamList } from '../navigation/types';
import { Recipe } from '../types';
import RecipeCard from '../components/RecipeCard';

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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <FlatList
        data={categoryRecipes}
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            onPress={handleRecipePress}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No recipes found in this category</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    fontSize: 16,
    color: COLORS.textLight,
    textAlign: 'center',
  },
});

export default CategoryRecipesScreen;