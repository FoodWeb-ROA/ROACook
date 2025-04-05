import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerParamList } from '../navigation/AppNavigator';
import AppHeader from '../components/AppHeader';
import { COLORS } from '../constants/theme';

// Define navigation prop type
type PrepListScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'PrepList'>;

const PrepListScreen = () => {
  const navigation = useNavigation<PrepListScreenNavigationProp>();

  const openDrawerMenu = () => {
    navigation.openDrawer();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <AppHeader
        title="Prep List"
        showMenuButton={true}
        onMenuPress={openDrawerMenu}
      />
      <View style={styles.contentContainer}>
        <Text style={styles.text}>Prep List Screen</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 20,
    color: COLORS.text,
  },
});

export default PrepListScreen; 