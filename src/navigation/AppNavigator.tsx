import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, StackNavigationProp, CardStyleInterpolators } from '@react-navigation/stack';
import { createDrawerNavigator, DrawerNavigationProp } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View, TouchableOpacity, Dimensions, Text } from 'react-native';
import { useNavigation, NavigationProp, RouteProp } from '@react-navigation/native';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();

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
      <Drawer.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{
          drawerLabel: ({ focused, color }) => (
            <Text style={{ color, fontFamily: 'Poppins', fontSize: SIZES.font }}>{t('navigation.home')}</Text>
          )
        }}
      />
      <Drawer.Screen 
        name="AllRecipes" 
        component={AllRecipesScreen} 
        options={{
          drawerLabel: ({ focused, color }) => (
            <Text style={{ color, fontFamily: 'Poppins', fontSize: SIZES.font }}>{t('navigation.allRecipes')}</Text>
          )
        }}
      />
      <Drawer.Screen 
        name="Inventory" 
        component={InventoryScreen} 
        options={{
          drawerLabel: ({ focused, color }) => (
            <Text style={{ color, fontFamily: 'Poppins', fontSize: SIZES.font }}>{t('navigation.inventory')}</Text>
          )
        }}
      />
      <Drawer.Screen 
        name="Account" 
        component={AccountScreen} 
        options={{
          drawerLabel: ({ focused, color }) => (
            <Text style={{ color, fontFamily: 'Poppins', fontSize: SIZES.font }}>{t('navigation.account')}</Text>
          )
        }}
      />
      <Drawer.Screen 
        name="Preferences" 
        component={PreferencesScreen} 
        options={{
          drawerLabel: ({ focused, color }) => (
            <Text style={{ color, fontFamily: 'Poppins', fontSize: SIZES.font }}>{t('navigation.preferences')}</Text>
          )
        }}
      />
      <Drawer.Screen 
        name="Support" 
        component={SupportScreen} 
        options={{
          drawerLabel: ({ focused, color }) => (
            <Text style={{ color, fontFamily: 'Poppins', fontSize: SIZES.font }}>{t('navigation.support')}</Text>
          )
        }}
      />
      <Drawer.Screen 
        name="PrepList" 
        component={PrepListScreen} 
        options={{
          drawerLabel: ({ focused, color }) => (
            <Text style={{ color, fontFamily: 'Poppins', fontSize: SIZES.font }}>{t('navigation.preparationsList')}</Text>
          )
        }}
      />
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