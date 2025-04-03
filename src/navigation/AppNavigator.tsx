import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';

// Screens
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import SearchScreen from '../screens/SearchScreen';
import SettingsScreen from '../screens/SettingsScreen';
import RecipeDetailScreen from '../screens/RecipeDetailScreen';
import CategoryRecipesScreen from '../screens/CategoryRecipesScreen';
import PreparationDetailScreen from '../screens/PreparationDetailScreen';
import CreateRecipeScreen from '../screens/CreateRecipeScreen';

// Types
import { RootStackParamList, TabParamList } from './types';
import { COLORS } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any; // Use any to avoid type issues with Ionicons
          
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Categories') {
            iconName = focused ? 'list' : 'list-outline';
          } else if (route.name === 'Search') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Categories" component={CategoriesScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { user, loading } = useAuth();

  // Show loading indicator while checking authentication
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={user ? "Main" : "Login"}
        screenOptions={{
          headerStyle: {
            backgroundColor: COLORS.primary,
          },
          headerTintColor: COLORS.white,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          cardStyle: { backgroundColor: COLORS.background },
        }}
      >
        {user ? (
          // Authenticated screens
          <>
            <Stack.Screen
              name="Main"
              component={TabNavigator}
              options={{ headerShown: false, title: 'Recipe Manager' }}
            />
            <Stack.Screen
              name="RecipeDetails"
              component={RecipeDetailScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PreparationDetails"
              component={PreparationDetailScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CategoryRecipes"
              component={CategoryRecipesScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CreateRecipe"
              component={CreateRecipeScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          // Authentication screens
          <Stack.Screen 
            name="Login" 
            component={LoginScreen} 
            options={{ headerShown: false }} 
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;