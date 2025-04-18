import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerParamList } from '../navigation/AppNavigator';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import AppHeader from '../components/AppHeader';
import { COLORS, SIZES, FONTS } from '../constants/theme';
import { Preparation } from '../types';
import { usePreparations } from '../hooks/useSupabase';

type PrepListScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'PrepList'>;
type PrepListScreenStackProp = StackNavigationProp<RootStackParamList>;

const PrepListScreen = () => {
  const drawerNavigation = useNavigation<PrepListScreenNavigationProp>();
  const stackNavigation = useNavigation<PrepListScreenStackProp>();

  const { preparations, loading, error } = usePreparations();

  const handlePreparationPress = (preparation: Preparation) => {
    stackNavigation.navigate('PreparationDetails', {
      preparationId: preparation.preparation_id,
    });
  };

  const openDrawerMenu = () => {
    drawerNavigation.openDrawer();
  };

  const renderPreparationItem = ({ item }: { item: Preparation }) => (
    <TouchableOpacity 
      style={styles.itemContainer}
      onPress={() => handlePreparationPress(item)}
    >
      <Text style={styles.itemText}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <AppHeader
        title="Preparations List"
        showMenuButton={true}
        onMenuPress={openDrawerMenu}
      />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <Text style={styles.errorText}>Error loading preparations</Text>
      ) : (
        <FlatList
          data={preparations}
          renderItem={renderPreparationItem}
          keyExtractor={(item) => item.preparation_id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={<Text style={styles.emptyText}>No preparations found.</Text>}
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
  emptyText: {
    ...FONTS.body3,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: SIZES.padding * 4,
  },
  listContainer: {
    padding: SIZES.padding * 2,
  },
  itemContainer: {
    backgroundColor: COLORS.secondary,
    padding: SIZES.padding,
    marginBottom: SIZES.padding,
    borderRadius: SIZES.radius,
    borderLeftWidth: 5,
    borderLeftColor: COLORS.primary,
  },
  itemText: {
    ...FONTS.h3,
    color: COLORS.white,
  },
});

export default PrepListScreen; 