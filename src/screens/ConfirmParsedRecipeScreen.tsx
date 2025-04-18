import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Button, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { ParsedRecipe } from '../types'; // Import the type
import { COLORS, SIZES, FONTS } from '../constants/theme';
import AppHeader from '../components/AppHeader'; // Optional: Use AppHeader if needed

type ConfirmRouteProp = RouteProp<RootStackParamList, 'ConfirmParsedRecipe'>;
type ConfirmNavigationProp = StackNavigationProp<RootStackParamList>;

const ConfirmParsedRecipeScreen = () => {
  const route = useRoute<ConfirmRouteProp>();
  const navigation = useNavigation<ConfirmNavigationProp>();
  const { parsedRecipes } = route.params;

  // State to hold the recipe being edited
  const [editableRecipe, setEditableRecipe] = useState<ParsedRecipe | null>(null);
  // Add state for loading/saving later if needed
  // const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Log the received data structure from the parser
    console.log("Received Parsed Recipes:", JSON.stringify(parsedRecipes, null, 2));

    // Initialize state with the first parsed recipe (handle if empty)
    if (parsedRecipes && parsedRecipes.length > 0) {
        // TODO: Handle multiple recipes? For now, use the first.
        setEditableRecipe(parsedRecipes[0]);
    } else {
        // Handle case where no recipes were parsed or passed
        console.error("No parsed recipes received by confirmation screen.");
        Alert.alert("Error", "No recipe data was received from the parser.", [
            { text: "OK", onPress: () => navigation.goBack() }
        ]);
    }
  }, [parsedRecipes, navigation]); // Depend on parsedRecipes

  // TODO: Implement handleConfirmSave logic
  // TODO: Implement handleDiscard logic

  // --- Render Logic --- 
  // Show loading or placeholder if state isn't ready yet
  if (!editableRecipe) {
      // Optional: Show a loading indicator or a message 
      // while state initializes or if there was an error handled in useEffect
      return (
          <SafeAreaView style={styles.safeArea}>
              <View style={styles.loadingContainer}>
                  <Text style={styles.errorText}>Loading recipe data...</Text>
                  {/* Or <ActivityIndicator size="large" color={COLORS.primary} /> */}
              </View>
          </SafeAreaView>
      );
  }

  // Render the editable recipe details (using placeholder UI for now)
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* <AppHeader title="Confirm Recipe" showBackButton={true} /> // Use navigator header */}
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.title}>Confirm Parsed Recipe</Text>
        
        {/* Display data from state */}
        <View>
          <Text style={styles.recipeName}>{editableRecipe.name || 'Unnamed Recipe'}</Text>
          <Text style={styles.sectionHeader}>Components:</Text>
          {editableRecipe.components?.map((comp, index) => (
            <Text key={index} style={styles.itemText}>
              - {comp.quantity} {comp.unit} {comp.name}
            </Text>
          ))}
           <Text style={styles.sectionHeader}>Directions:</Text>
          {editableRecipe.directions?.map((dir, index) => (
            <Text key={index} style={styles.itemText}>{index + 1}. {dir}</Text>
          ))}
        </View>

        <View style={styles.buttonContainer}>
            <Button title="Discard" onPress={() => navigation.goBack()} color={COLORS.error} />
            {/* TODO: Replace with actual save logic */}
            <Button title="Confirm & Save" onPress={() => Alert.alert('Save', 'Save logic not implemented yet.')} color={COLORS.primary} />
        </View>

      </ScrollView>
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
  contentContainer: {
      padding: SIZES.padding * 2,
  },
  title: {
      ...FONTS.h1,
      color: COLORS.white,
      textAlign: 'center',
      marginBottom: SIZES.padding * 2,
  },
  recipeName: {
      ...FONTS.h2,
      color: COLORS.white,
      marginBottom: SIZES.padding,
  },
  sectionHeader: {
      ...FONTS.h3,
      color: COLORS.white,
      marginTop: SIZES.padding,
      marginBottom: SIZES.base,
  },
  itemText: {
      ...FONTS.body3,
      color: COLORS.text,
      marginBottom: SIZES.base / 2,
      marginLeft: SIZES.padding,
  },
  errorText: {
      ...FONTS.body2,
      color: COLORS.error,
      textAlign: 'center',
      marginTop: SIZES.padding * 2,
  },
  buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: SIZES.padding * 3,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      paddingTop: SIZES.padding * 2,
  },
  loadingContainer: { // Add style for loading state
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ConfirmParsedRecipeScreen; 