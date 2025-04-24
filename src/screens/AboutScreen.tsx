import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  Image,
  Dimensions
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import AppHeader from '../components/AppHeader';
import { useTranslation } from 'react-i18next';
import { COLORS, SIZES, FONTS } from '../constants/theme';

// Define navigation prop type
type AboutScreenNavigationProp = StackNavigationProp<RootStackParamList, 'About'>;

const { width } = Dimensions.get('window');

const AboutScreen = () => {
  const navigation = useNavigation<AboutScreenNavigationProp>();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <AppHeader
        title={t('navigation.about')} // Add this key
        showBackButton={true}
      />
      <View style={styles.container}>
        <Image 
          source={require('../../assets/icon.png')} // Corrected path to root assets folder
          style={styles.icon}
          resizeMode="contain"
        />
        <Text style={styles.text}>{t('screens.about.moreToCome')}</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZES.padding * 2,
  },
  icon: {
    width: width * 0.5, // Set width to 50% of screen width
    height: width * 0.5, // Set height equal to width for square aspect ratio
    marginBottom: SIZES.padding * 3,
  },
  text: {
    ...FONTS.h3,
    color: COLORS.text,
    textAlign: 'center',
  },
});

export default AboutScreen; 