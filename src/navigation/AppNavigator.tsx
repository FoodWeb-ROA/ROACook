import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, StackNavigationProp, CardStyleInterpolators } from '@react-navigation/stack';
import { createDrawerNavigator, DrawerNavigationProp } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View, TouchableOpacity, Dimensions } from 'react-native';
import { useNavigation, NavigationProp, RouteProp } from '@react-navigation/native';
import Sidebar from '../components/Sidebar';

// Screens
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import AccountScreen from '../screens/AccountScreen';
import PreferencesScreen from '../screens/PreferencesScreen';
import SupportScreen from '../screens/SupportScreen';
import PrepListScreen from '../screens/PrepListScreen';
import DishDetailScreen from '../screens/DishDetailScreen';
import CategoryRecipesScreen from '../screens/CategoryRecipesScreen';
import PreparationDetailScreen from '../screens/PreparationDetailScreen';
import CreateRecipeScreen from '../screens/CreateRecipeScreen';
import CreatePreparationScreen from '../screens/CreatePreparationScreen';
// @ts-ignore next-line
import InventoryScreen from '../screens/InventoryScreen';
import AllRecipesScreen from '../screens/AllRecipesScreen';

// Types
import { RootStackParamList } from './types';
import { COLORS, FONTS, SIZES } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

// Define DrawerParamList type
export type DrawerParamList = {
  Home: undefined;
  AllRecipes: undefined;
  Account: undefined;
  Preferences: undefined;
  Support: undefined;
  PrepList: undefined;
  Inventory: undefined;
};

// Define the navigation prop type for the Drawer
type DrawerNavProp = DrawerNavigationProp<DrawerParamList>;

const Stack = createStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();

const DrawerNavigator = () => {
  const { width: SCREEN_WIDTH } = Dimensions.get('window');

  return (
    <Drawer.Navigator
      initialRouteName="Home"
      drawerContent={(props) => <Sidebar {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        overlayColor: 'rgba(0,0,0,0.5)',
        drawerStyle: {
          backgroundColor: 'transparent',
          width: SCREEN_WIDTH,
        },
        drawerActiveTintColor: COLORS.white,
        drawerInactiveTintColor: COLORS.textLight,
        drawerLabelStyle: {
          fontFamily: 'Poppins',
          fontSize: SIZES.font,
          marginLeft: SIZES.padding,
          zIndex: 1,
        },
        drawerActiveBackgroundColor: 'rgba(76, 175, 80, 0.15)',
        drawerItemStyle: {
          borderRadius: SIZES.radius * 2,
          marginHorizontal: 12,
          paddingVertical: 5,
          marginLeft: 8,
        },
      }}
    >
      <Drawer.Screen name="Home" component={HomeScreen} />
      <Drawer.Screen 
        name="AllRecipes" 
        component={AllRecipesScreen} 
        options={{ title: 'All Recipes' }}
      />
      <Drawer.Screen name="Inventory" component={InventoryScreen} />
      <Drawer.Screen name="Account" component={AccountScreen} />
      <Drawer.Screen name="Preferences" component={PreferencesScreen} />
      <Drawer.Screen name="Support" component={SupportScreen} />
      <Drawer.Screen name="PrepList" component={PrepListScreen} options={{ title: 'Prep List' }}/>
    </Drawer.Navigator>
  );
};

const AppNavigator = () => {
  const { user, loading } = useAuth();
  const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      >
        {user ? (
          <>
            <Stack.Screen
              name="MainDrawer"
              component={DrawerNavigator}
              options={{ cardStyleInterpolator: CardStyleInterpolators.forNoAnimation }}
            />
            <Stack.Screen
              name="Inventory"
              component={InventoryScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="DishDetails"
              component={DishDetailScreen}
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
              options={{ headerShown: false, title: 'Category Recipes' }}
            />
            <Stack.Screen
              name="CreateRecipe"
              component={CreateRecipeScreen}
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="CreatePreparation"
              component={CreatePreparationScreen}
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