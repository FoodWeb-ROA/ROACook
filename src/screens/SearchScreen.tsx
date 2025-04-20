import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { RootStackParamList } from '../navigation/types';
import { Dish, MenuSection } from '../types';
import { useDishes, useMenuSections } from '../hooks/useSupabase';
import DishCard from '../components/DishCard';
import AppHeader from '../components/AppHeader';
import { SafeAreaView as SafeAreaViewContext } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

type SearchScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const SearchScreen = () => {
  const navigation = useNavigation<SearchScreenNavigationProp>();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | 'All'>('All');

  const { dishes, loading: loadingDishes, error: errorDishes } = useDishes();
  const { menuSections, loading: loadingSections, error: errorSections } = useMenuSections();

  const { t } = useTranslation();

  const handleDishPress = (dish: Dish) => {
    navigation.navigate('DishDetails', { dishId: dish.dish_id });
  };

  const filteredDishes = useMemo(() => {
    if (!dishes) return [];
    return dishes.filter(dish => {
      const matchesSearch = dish.dish_name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = activeFilter === 'All' || dish.menu_section_id === activeFilter;
      
      return matchesSearch && matchesCategory;
    });
  }, [dishes, searchQuery, activeFilter]);

  const filterOptions = useMemo(() => {
    if (!menuSections) return ['All'];
    return ['All', ...menuSections.filter(s => s.name && s.menu_section_id).map(section => ({ 
      id: section.menu_section_id, 
      name: section.name 
    }))];
  }, [menuSections]);

  const isLoading = loadingDishes || loadingSections;
  const hasError = errorDishes || errorSections;

  return (
    <SafeAreaViewContext style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.searchContainer}>
          <View style={styles.searchBarWrapper}>
            <MaterialCommunityIcons name="magnify" size={24} color={COLORS.textLight} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('screens.search.placeholder')}
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
          
          {!loadingSections && !errorSections && filterOptions.length > 1 && (
            <FlatList
              data={filterOptions}
              renderItem={({ item }) => {
                const id = typeof item === 'string' ? item : item.id;
                const name = typeof item === 'string' ? item : item.name;
                return (
                  <TouchableOpacity 
                    style={[
                      styles.filterButton,
                      activeFilter === id && styles.activeFilterButton
                    ]}
                    onPress={() => setActiveFilter(id)}
                  >
                    <Text 
                      style={[
                        styles.filterButtonText,
                        activeFilter === id && styles.activeFilterText
                      ]}
                    >
                      {name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              keyExtractor={(item) => (typeof item === 'string' ? item : item.id)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersContainer}
            />
          )}
        </View>
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
             <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : hasError ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.errorText}>{t('screens.search.errorLoadingData')}</Text>
          </View>
        ) : filteredDishes.length > 0 ? (
          <FlatList
            data={filteredDishes}
            renderItem={({ item }) => (
              <DishCard
                dish={item}
                onPress={handleDishPress}
              />
            )}
            keyExtractor={(item) => item.dish_id}
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
              No dishes found {searchQuery ? `for "${searchQuery}"` : ''}
              {activeFilter !== 'All' ? ` in selected category` : ''}
            </Text>
            <Text style={styles.emptySubtext}>
              Try adjusting your search or filter
            </Text>
          </View>
        )}
      </View>
    </SafeAreaViewContext>
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
    paddingVertical: SIZES.padding * 0.75,
    marginBottom: SIZES.padding,
  },
  searchInput: {
    flex: 1,
    marginLeft: SIZES.padding,
    fontSize: SIZES.font,
    color: COLORS.text,
    height: 24,
    lineHeight: 24,
  },
  filtersContainer: {
    paddingBottom: SIZES.padding,
  },
  filterButton: {
    paddingHorizontal: SIZES.padding * 1.5,
    paddingVertical: SIZES.base,
    borderRadius: SIZES.radius * 2,
    backgroundColor: COLORS.surface,
    marginRight: SIZES.base,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeFilterButton: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterButtonText: {
    ...FONTS.body3,
    color: COLORS.text,
    fontWeight: '500',
  },
  activeFilterText: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  listContent: {
    padding: SIZES.padding * 2,
    paddingBottom: SIZES.padding * 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding * 2,
    marginTop: -SIZES.padding * 4,
  },
  emptyText: {
    ...FONTS.h3,
    color: COLORS.text,
    marginTop: SIZES.padding,
    textAlign: 'center',
  },
  emptySubtext: {
    ...FONTS.body3,
    color: COLORS.textLight,
    marginTop: SIZES.base,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...FONTS.body3,
    color: COLORS.error,
    textAlign: 'center',
    padding: SIZES.padding * 2,
  },
});

export default SearchScreen;