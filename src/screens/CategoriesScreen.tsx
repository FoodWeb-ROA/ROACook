import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { CATEGORIES } from '../constants/dummyData';
import { RootStackParamList } from '../navigation/types';
import { Category } from '../types';
import CategoryCard from '../components/CategoryCard';

type CategoriesScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const CategoriesScreen = () => {
  const navigation = useNavigation<CategoriesScreenNavigationProp>();

  const handleCategoryPress = (category: Category) => {
    navigation.navigate('CategoryRecipes', {
      categoryId: category.id,
      categoryName: category.name,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recipe Categories</Text>
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
        numColumns={2}
        columnWrapperStyle={styles.categoriesRow}
        contentContainerStyle={styles.listContent}
      />
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
  listContent: {
    padding: SIZES.padding * 2,
  },
  categoriesRow: {
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.padding,
  },
});

export default CategoriesScreen;