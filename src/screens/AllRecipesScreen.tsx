import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DrawerParamList } from '../navigation/AppNavigator';
import { RootStackParamList } from '../navigation/types';
import { useDishes } from '../hooks/useSupabase';
import { Dish } from '../types';
import AppHeader from '../components/AppHeader';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { capitalizeWords } from '../utils/textFormatters';

const AllRecipesScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const drawerNav = useNavigation<DrawerNavigationProp<DrawerParamList>>();
  const { dishes, loading, error } = useDishes();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'newest'>('name');
  
  const openDrawerMenu = () => drawerNav.openDrawer();
  
  const filteredDishes = useMemo(() => {
    if (!dishes) return [];
    
    let filtered = [...dishes];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(dish => 
        dish.dish_name?.toLowerCase().includes(query)
      );
    }
    
    // Apply sorting
    if (sortBy === 'name') {
      filtered.sort((a, b) => (a.dish_name || '').localeCompare(b.dish_name || ''));
    } else if (sortBy === 'newest') {
      // Assuming there's some field that indicates creation time
      // This is a placeholder - replace with actual field if available
      filtered.sort((a, b) => {
        return (b.created_at as any) - (a.created_at as any);
      });
    }
    
    return filtered;
  }, [dishes, searchQuery, sortBy]);
  
  const handleDishPress = (dish: Dish) => {
    navigation.navigate('DishDetails', { dishId: dish.dish_id });
  };
  
  const renderDishItem = ({ item }: { item: Dish }) => (
    <TouchableOpacity 
      style={styles.dishItem}
      onPress={() => handleDishPress(item)}
    >
      <View style={styles.dishContent}>
        <Text style={styles.dishName}>{capitalizeWords(item.dish_name)}</Text>
        <Text style={styles.servingInfo}>
          {item.num_servings} {item.serving_unit ? 'servings' : 'servings'}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.primary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="All Recipes" showMenuButton={true} onMenuPress={openDrawerMenu} />
      
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search recipes..."
          placeholderTextColor={COLORS.textLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      
      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <TouchableOpacity 
          style={[styles.sortButton, sortBy === 'name' && styles.sortButtonActive]}
          onPress={() => setSortBy('name')}
        >
          <Text style={[styles.sortButtonText, sortBy === 'name' && styles.sortButtonTextActive]}>Name</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.sortButton, sortBy === 'newest' && styles.sortButtonActive]}
          onPress={() => setSortBy('newest')}
        >
          <Text style={[styles.sortButtonText, sortBy === 'newest' && styles.sortButtonTextActive]}>Newest</Text>
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : error ? (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error.message}</Text>
          <TouchableOpacity style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredDishes}
          keyExtractor={(item) => item.dish_id}
          renderItem={renderDishItem}
          contentContainerStyle={filteredDishes.length === 0 ? styles.centerContent : styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {searchQuery ? 'No recipes match your search' : 'No recipes found'}
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
  dishItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding * 2,
    paddingVertical: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dishContent: {
    flex: 1,
  },
  dishName: {
    ...FONTS.h4,
    color: COLORS.white,
    marginBottom: SIZES.base / 2,
  },
  servingInfo: {
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