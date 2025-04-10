import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, StackNavigationProp } from '@react-navigation/stack';
import { createDrawerNavigator, DrawerNavigationProp } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View, TouchableOpacity } from 'react-native';
import { useNavigation, NavigationProp, RouteProp } from '@react-navigation/native';

// Screens
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import AccountScreen from '../screens/AccountScreen';
import PreferencesScreen from '../screens/PreferencesScreen';
import SupportScreen from '../screens/SupportScreen';
import PrepListScreen from '../screens/PrepListScreen';
import RecipeDetailScreen from '../screens/RecipeDetailScreen';
import CategoryRecipesScreen from '../screens/CategoryRecipesScreen';
import PreparationDetailScreen from '../screens/PreparationDetailScreen';
import CreateRecipeScreen from '../screens/CreateRecipeScreen';

// Types
import { RootStackParamList } from './types';
import { COLORS, FONTS, SIZES, OPACITY } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

// Define DrawerParamList type
export type DrawerParamList = {
  Home: undefined;
  Account: undefined;
  Preferences: undefined;
  Support: undefined;
  PrepList: undefined;
};

// Define the navigation prop type for the Drawer
type DrawerNavProp = DrawerNavigationProp<DrawerParamList>;

const Stack = createStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();

const DrawerNavigator = () => {
  return (
    <Drawer.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          backgroundColor: COLORS.background,
          width: 240,
        },
        drawerActiveTintColor: COLORS.white,
        drawerActiveBackgroundColor: `rgba(91, 107, 92, ${OPACITY.low})`,
        drawerInactiveTintColor: COLORS.textLight,
        drawerLabelStyle: {
          fontFamily: 'Poppins',
          fontSize: SIZES.font,
        },
        drawerItemStyle: {
          marginHorizontal: SIZES.padding,
          borderRadius: SIZES.radius,
        }
      }}
    >
      <Drawer.Screen name="Home" component={HomeScreen} />
      <Drawer.Screen name="Account" component={AccountScreen} />
      <Drawer.Screen name="Preferences" component={PreferencesScreen} />
      <Drawer.Screen name="Support" component={SupportScreen} />
      <Drawer.Screen name="PrepList" component={PrepListScreen} options={{ title: 'Prep List' }}/>
    </Drawer.Navigator>
  );
};

const AppNavigator = () => {
  const { user, loading } = useAuth();

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
        initialRouteName={user ? "MainDrawer" : "Login"}
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: COLORS.background },
        }}
      >
        {user ? (
          <>
            <Stack.Screen
              name="MainDrawer"
              component={DrawerNavigator}
            />
            <Stack.Screen
              name="RecipeDetails"
              component={RecipeDetailScreen}
              options={{ headerShown: false, title: 'Recipe Details' }}
            />
            <Stack.Screen
              name="PreparationDetails"
              component={PreparationDetailScreen}
              options={{ headerShown: false, title: 'Preparation Details' }}
            />
            <Stack.Screen
              name="CategoryRecipes"
              component={CategoryRecipesScreen}
              options={{ headerShown: false, title: 'Category Recipes' }}
            />
            <Stack.Screen
              name="CreateRecipe"
              component={CreateRecipeScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
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