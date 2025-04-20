import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { StackNavigationProp } from '@react-navigation/stack';
import { DrawerParamList } from '../navigation/AppNavigator';
import { RootStackParamList } from '../navigation/types';
import { useIngredients, usePreparations, useDishes } from '../hooks/useSupabase';
import { Ingredient, Preparation } from '../types';
import AppHeader from '../components/AppHeader';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { capitalizeWords } from '../utils/textFormatters';
import { useTranslation } from 'react-i18next';
import { DrawerActions } from '@react-navigation/native';

const InventoryScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const drawerNav = useNavigation<DrawerNavigationProp<DrawerParamList>>();
  const { ingredients, loading: loadingIng, error: errorIng } = useIngredients(true);
  const { preparations, loading: loadingPrep, error: errorPrep } = usePreparations();
  const { dishes } = useDishes();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<'ingredients' | 'preparations'>('ingredients');
  const [expandedIngredient, setExpandedIngredient] = useState<string | null>(null);

  const displayData = useMemo(() => {
    if (activeTab === 'ingredients') {
      return (ingredients as (Ingredient & { isPreparation?: boolean })[]).filter(i => !i.isPreparation);
    }
    return preparations as Preparation[];
  }, [activeTab, ingredients, preparations]);

  const openDrawerMenu = () => drawerNav.openDrawer();

  const getRecipesUsingIngredient = (ingredientId: string) => {
    return dishes?.filter(dish => 
      dish.components?.some((component: { ingredient_id: string }) => component.ingredient_id === ingredientId)
    ) || [];
  };

  const renderItem = ({ item }: { item: any }) => {
    const isExpanded = activeTab === 'ingredients' && expandedIngredient === item.ingredient_id;
    const recipesUsingIngredient = isExpanded ? getRecipesUsingIngredient(item.ingredient_id) : [];

    const handlePress = () => {
      if (activeTab === 'ingredients') {
        setExpandedIngredient(isExpanded ? null : item.ingredient_id);
      } else if (activeTab === 'preparations' && item.preparation_id) {
        navigation.navigate('PreparationDetails', { preparationId: item.preparation_id });
      }
    };

    return (
      <View>
        <TouchableOpacity
          style={[styles.itemRow, isExpanded && styles.itemRowExpanded]}
          onPress={handlePress}
        >
          <Text style={styles.itemText}>{capitalizeWords(item.name)}</Text>
          {activeTab === 'ingredients' && (
            <MaterialCommunityIcons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={COLORS.text}
            />
          )}
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <Text style={styles.expandedTitle}>{t('screens.inventory.usedInTitle')}</Text>
            {recipesUsingIngredient.length > 0 ? (
              recipesUsingIngredient.map(recipe => (
                <Text key={recipe.dish_id} style={styles.recipeText}>
                  • {recipe.dish_name || recipe.name}
                </Text>
              ))
            ) : (
              <Text style={styles.noRecipesText}>{t('screens.inventory.notUsedInRecipes')}</Text>
            )}
          </View>
        )}
      </View>
    );
  };

  const loading = activeTab === 'ingredients' ? loadingIng : loadingPrep;
  const error = activeTab === 'ingredients' ? errorIng : errorPrep;

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title={t('screens.inventory.title')} showMenuButton={true} onMenuPress={openDrawerMenu} />

      <View style={styles.toggleContainer}>
        {(['ingredients', 'preparations'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.toggleBtn, activeTab === tab && styles.toggleBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.toggleText, activeTab === tab && styles.toggleTextActive]}>
              {t(tab === 'ingredients' ? 'common.ingredients' : 'common.preparation')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: SIZES.padding * 2 }} />
      ) : error ? (
        <Text style={styles.errorText}>{error.message}</Text>
      ) : (
        <FlatList
          data={displayData}
          keyExtractor={(item) => ('preparation_id' in item ? item.preparation_id : item.ingredient_id)}
          renderItem={renderItem}
          contentContainerStyle={displayData.length === 0 && { flex: 1, justifyContent: 'center', alignItems: 'center' }}
          ListEmptyComponent={<Text style={styles.emptyText}>{t('screens.inventory.noDataFound')}</Text>}
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
    padding: SIZES.padding,
  },
  toggleBtn: {
    flex: 1,
    padding: SIZES.padding,
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
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding * 2,
    paddingVertical: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  itemRowExpanded: {
    backgroundColor: COLORS.secondary,
  },
  itemText: {
    ...FONTS.body3,
    color: COLORS.text,
    flex: 1,
  },
  expandedContent: {
    padding: SIZES.padding,
    backgroundColor: COLORS.background,
    marginHorizontal: SIZES.padding,
    borderRadius: SIZES.radius,
    marginBottom: SIZES.padding,
  },
  expandedTitle: {
    ...FONTS.h4,
    color: COLORS.text,
    marginBottom: SIZES.base,
  },
  recipeText: {
    ...FONTS.body3,
    color: COLORS.textLight,
    marginVertical: SIZES.base / 2,
  },
  noRecipesText: {
    ...FONTS.body3,
    color: COLORS.textLight,
    fontStyle: 'italic',
  },
  errorText: {
    ...FONTS.body3,
    color: COLORS.error,
    textAlign: 'center',
    marginTop: SIZES.padding * 2,
  },
  emptyText: {
    ...FONTS.body3,
    color: COLORS.textLight,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: SIZES.padding * 2,
  },
});

export default InventoryScreen; 