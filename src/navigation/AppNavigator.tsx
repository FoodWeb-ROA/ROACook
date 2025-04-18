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
import DishDetailScreen from '../screens/DishDetailScreen';
import CategoryRecipesScreen from '../screens/CategoryRecipesScreen';
import PreparationDetailScreen from '../screens/PreparationDetailScreen';
import CreateRecipeScreen from '../screens/CreateRecipeScreen';
import ConfirmParsedRecipeScreen from '../screens/ConfirmParsedRecipeScreen';
// @ts-ignore next-line
import InventoryScreen from '../screens/InventoryScreen';
import ConfirmPreparationScreen from '../screens/ConfirmPreparationScreen';

// Types
import { RootStackParamList } from './types';
import { COLORS, FONTS, SIZES } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

// Define DrawerParamList type
export type DrawerParamList = {
  Home: undefined;
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
              options={({ navigation }: { navigation: StackNavigationProp<RootStackParamList> }) => ({
                headerShown: true,
                headerStyle: {
                  backgroundColor: COLORS.background,
                  shadowOpacity: 0,
                  elevation: 0,
                },
                headerTitle: '',
                headerBackTitle: ' ',
                headerTintColor: COLORS.white,
                headerLeft: () => (
                  <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={{ 
                      marginLeft: SIZES.padding * 2,
                      marginTop: SIZES.padding * 4
                     }}
                  >
                    <Ionicons name="arrow-back" size={28} color={COLORS.white} />
                  </TouchableOpacity>
                ),
              })}
            />
            <Stack.Screen
              name="ConfirmParsedRecipe"
              component={ConfirmParsedRecipeScreen}
              options={{ 
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="ConfirmPreparation"
              component={ConfirmPreparationScreen}
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