import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { RootStackParamList } from '../navigation/types';
import { Dish, DishComponent } from '../types';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DishCard from '../components/DishCard';
import AppHeader from '../components/AppHeader';
import { useDishes } from '../hooks/useSupabase';
import { useTranslation } from 'react-i18next';

type CategoryRecipesRouteProp = RouteProp<RootStackParamList, 'CategoryRecipes'>;
type CategoryRecipesNavigationProp = StackNavigationProp<RootStackParamList>;

const CategoryRecipesScreen = () => {
  const navigation = useNavigation<CategoryRecipesNavigationProp>();
  const route = useRoute<CategoryRecipesRouteProp>();
  const { categoryId, categoryName } = route.params;
  const { t } = useTranslation();

  // Fetch dishes filtered by menu section id (assuming useDishes supports this)
  const { dishes, loading: loadingDishes, error: dishesError } = useDishes(categoryId);
  
  const handleDishPress = (dish: Dish) => {
    navigation.navigate('DishDetails', { dishId: dish.dish_id });
  };
  
  const handlePreparationPress = (preparationId: string) => {
    navigation.navigate('PreparationDetails', { preparationId });
  };
  
  // Helper function to render preparations for a dish - removed since DishCard already shows preparations
  // This helps eliminate duplicate "Preparations" sections

  if (loadingDishes) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.loadingContainer]}>
        <StatusBar style="light" />
        <AppHeader title={t('screens.categoryRecipes.loading', { categoryName })} showBackButton={true} />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (dishesError) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.errorContainer]}>
        <StatusBar style="light" />
        <AppHeader title={t('common.error')} showBackButton={true} />
        <Text style={styles.errorText}>{dishesError.message}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <AppHeader 
        title={categoryName || t('screens.categoryRecipes.titleFallback', 'Category Dishes')}
        showBackButton={true} 
      />
      <View style={styles.container}>
        <FlatList
          data={dishes}
          renderItem={({ item }) => (
            <View style={styles.dishContainer}>
              <DishCard
                dish={item}
                onPress={handleDishPress}
                onPreparationPress={handlePreparationPress}
              />
              {/* Removed the renderPreparations call to avoid duplicate sections */}
            </View>
          )}
          keyExtractor={(item) => item.dish_id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{t('screens.categoryRecipes.noDishesInCategory')}</Text>
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
    ...FONTS.h2,
    color: COLORS.white,
    paddingHorizontal: SIZES.padding * 2,
    paddingTop: SIZES.padding,
    paddingBottom: SIZES.padding,
    textAlign: 'center',
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
  dishContainer: {
    marginBottom: SIZES.padding * 2,
  },
  preparationsContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginTop: -SIZES.padding, // Overlap with the card slightly
    marginBottom: SIZES.padding,
    marginHorizontal: SIZES.padding / 2,
  },
  preparationsTitle: {
    ...FONTS.body3,
    color: COLORS.textLight,
    marginBottom: SIZES.base,
  },
  preparationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.base,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  preparationName: {
    ...FONTS.body3,
    color: COLORS.white,
    flex: 1,
    marginLeft: SIZES.base,
  },
});

export default CategoryRecipesScreen;