import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DrawerParamList } from '../navigation/AppNavigator';
import { RootStackParamList } from '../navigation/types';
import { useDishes, usePreparations } from '../hooks/useSupabase';
import { Dish, Preparation } from '../types';
import AppHeader from '../components/AppHeader';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { capitalizeWords } from '../utils/textFormatters';
import { useTranslation } from 'react-i18next';
import UpdateNotificationBanner from '../components/UpdateNotificationBanner';

const AllRecipesScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const drawerNav = useNavigation<DrawerNavigationProp<DrawerParamList>>();
  const { dishes, loading: loadingDishes, error: errorDishes, lastUpdateTime: dishesLastUpdate } = useDishes();
  const { preparations, loading: loadingPreps, error: errorPreps, lastUpdateTime: prepsLastUpdate } = usePreparations();
  const { t } = useTranslation();
  
  const [activeTab, setActiveTab] = useState<'recipes' | 'preparations'>('recipes');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'newest'>('name');
  
  const [showBanner, setShowBanner] = useState(false);
  const lastUpdateTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const relevantUpdateTime = activeTab === 'recipes' ? dishesLastUpdate : prepsLastUpdate;
    
    if (relevantUpdateTime && relevantUpdateTime !== lastUpdateTimeRef.current) {
      setShowBanner(true);
      lastUpdateTimeRef.current = relevantUpdateTime;
      const timer = setTimeout(() => {
        setShowBanner(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [activeTab, dishesLastUpdate, prepsLastUpdate]);
  
  const openDrawerMenu = () => drawerNav.openDrawer();
  
  const filteredData = useMemo(() => {
    const sourceData = activeTab === 'recipes' ? dishes : preparations;
    if (!sourceData) return [];
    
    let filtered = [...sourceData];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => {
        // For Preparation, the name comes directly from the type definition now
        const itemName = ('dish_id' in item ? item.dish_name : item.name)?.toLowerCase();
        return itemName?.includes(query);
      }
      );
    }
    
    // Apply sorting (Only applying name sort for simplicity)
    if (sortBy === 'name') {
      filtered.sort((a, b) => {
        // For Preparation, the name comes directly from the type definition now
        const nameA = ('dish_id' in a ? a.dish_name : a.name) || '';
        const nameB = ('dish_id' in b ? b.dish_name : b.name) || '';
        return nameA.localeCompare(nameB);
      });
    }
    
    return filtered;
  }, [dishes, preparations, searchQuery, sortBy, activeTab]);
  
  const handleDishPress = (dish: Dish) => {
    navigation.navigate('DishDetails', { dishId: dish.dish_id });
  };
  
  const handlePreparationPress = (prep: Preparation) => {
    navigation.navigate('PreparationDetails', { preparationId: prep.preparation_id });
  };
  
  const renderItem = ({ item }: { item: Dish | Preparation }) => {
    const isDish = 'dish_id' in item;
    const itemName = isDish ? (item as Dish).dish_name : (item as Preparation).name; // Use correct name property
    
    return (
      <TouchableOpacity 
        style={styles.itemRow}
        onPress={() => isDish ? handleDishPress(item as Dish) : handlePreparationPress(item as Preparation)}
      >
        <View style={styles.itemContent}>
          <Text style={styles.itemName}>{capitalizeWords(itemName)}</Text>
          {isDish && (item as Dish).num_servings && (
            <Text style={styles.itemSubInfo}>
              {(item as Dish).num_servings} {t('screens.allRecipes.servings', 'servings')}
            </Text>
          )}
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.primary} />
      </TouchableOpacity>
    );
  };

  const loading = activeTab === 'recipes' ? loadingDishes : loadingPreps;
  const error = activeTab === 'recipes' ? errorDishes : errorPreps;

  // Keep title static as "All Recipes"
  const screenTitle = t('screens.allRecipes.title', 'All Recipes');

  return (
    <SafeAreaView style={styles.container}>
      <UpdateNotificationBanner visible={showBanner} message="List Updated" />
      <AppHeader title={screenTitle} showMenuButton={true} onMenuPress={openDrawerMenu} />
      
      {/* Tab Selector */}
      <View style={styles.toggleContainer}>
        {(['recipes', 'preparations'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.toggleBtn, activeTab === tab && styles.toggleBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.toggleText, activeTab === tab && styles.toggleTextActive]}>
              {t(tab === 'recipes' ? 'common.dishes' : 'common.preparations')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('screens.allRecipes.searchPlaceholder')}
          placeholderTextColor={COLORS.textLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      
      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>{t('screens.allRecipes.sortByLabel')}</Text>
        <TouchableOpacity 
          style={[styles.sortButton, sortBy === 'name' && styles.sortButtonActive]}
          onPress={() => setSortBy('name')}
        >
          <Text style={[styles.sortButtonText, sortBy === 'name' && styles.sortButtonTextActive]}>{t('screens.allRecipes.sortByName')}</Text>
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : error ? (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error.message}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={activeTab === 'recipes' ? () => {} : () => {}}>
            <Text style={styles.retryText}>{t('screens.allRecipes.retry', 'Retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => ('dish_id' in item ? item.dish_id : item.preparation_id)}
          renderItem={renderItem}
          contentContainerStyle={filteredData.length === 0 ? styles.centerContent : styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {searchQuery 
                ? t('screens.allRecipes.noSearchResultsGeneric', 'No items match your search') 
                : (activeTab === 'recipes' ? t('screens.allRecipes.noRecipesFound', 'No recipes found') : t('screens.allRecipes.noPreparationsFound', 'No preparations found'))
              }
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
    paddingBottom: SIZES.base,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: SIZES.padding * 0.75,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginHorizontal: SIZES.base,
    borderRadius: SIZES.radius,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  toggleText: {
    ...FONTS.body3,
    color: COLORS.text,
  },
  toggleTextActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: SIZES.padding * 2,
    paddingVertical: SIZES.padding,
  },
  searchInput: {
    backgroundColor: COLORS.inputBackground,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    color: COLORS.text,
    ...FONTS.body3,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding * 2,
    paddingBottom: SIZES.padding,
  },
  sortLabel: {
    ...FONTS.body3,
    color: COLORS.text,
    marginRight: SIZES.base,
  },
  sortButton: {
    paddingVertical: SIZES.base / 2,
    paddingHorizontal: SIZES.padding,
    marginHorizontal: SIZES.base / 2,
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sortButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  sortButtonText: {
    ...FONTS.body3,
    color: COLORS.text,
  },
  sortButtonTextActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding * 2,
    paddingVertical: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  itemContent: {
    flex: 1,
    marginRight: SIZES.base,
  },
  itemName: {
    ...FONTS.h4,
    color: COLORS.white,
    marginBottom: SIZES.base / 2,
  },
  itemSubInfo: {
    ...FONTS.body3,
    color: COLORS.textLight,
  },
  loader: {
    marginTop: SIZES.padding * 4,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding * 2,
  },
  listContent: {
    paddingBottom: SIZES.padding * 2,
  },
  errorText: {
    ...FONTS.body3,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: SIZES.padding,
  },
  emptyText: {
    ...FONTS.body3,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: SIZES.padding * 4,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SIZES.base,
    paddingHorizontal: SIZES.padding * 2,
    borderRadius: SIZES.radius,
    marginTop: SIZES.padding,
  },
  retryText: {
    ...FONTS.body3,
    color: COLORS.white,
  },
});

export default AllRecipesScreen; 