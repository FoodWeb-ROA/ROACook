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
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { RootStackParamList } from '../navigation/types';
import { Dish } from '../types';
import DishCard from '../components/DishCard';
import AppHeader from '../components/AppHeader';
import { useDishes } from '../hooks/useSupabase';

type CategoryRecipesRouteProp = RouteProp<RootStackParamList, 'CategoryRecipes'>;
type CategoryRecipesNavigationProp = StackNavigationProp<RootStackParamList>;

const CategoryRecipesScreen = () => {
  const navigation = useNavigation<CategoryRecipesNavigationProp>();
  const route = useRoute<CategoryRecipesRouteProp>();
  const { categoryId, categoryName } = route.params;

  // Fetch dishes filtered by menu section id (assuming useDishes supports this)
  const { dishes, loading: loadingDishes, error: dishesError } = useDishes(categoryId);
  
  const handleDishPress = (dish: Dish) => {
    navigation.navigate('DishDetails', { dishId: dish.dish_id });
  };
  
  if (loadingDishes) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.loadingContainer]}>
        <StatusBar style="light" />
        <AppHeader title={`Loading ${categoryName}...`} showBackButton={true} />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (dishesError) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.errorContainer]}>
        <StatusBar style="light" />
        <AppHeader title="Error" showBackButton={true} />
        <Text style={styles.errorText}>{dishesError.message}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <AppHeader
        title={categoryName || 'Category Dishes'}
        showBackButton={true}
      />
      <View style={styles.container}>
        <Text style={styles.categoryTitle}>{categoryName}</Text>
        <FlatList
          data={dishes}
          renderItem={({ item }) => (
            <DishCard
              dish={item}
              onPress={handleDishPress}
            />
          )}
          keyExtractor={(item) => item.dish_id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No dishes found in this category</Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding * 2,
  },
  errorText: {
    ...FONTS.body3,
    color: COLORS.error,
    textAlign: 'center',
    padding: SIZES.padding * 2,
  },
});

export default CategoryRecipesScreen;