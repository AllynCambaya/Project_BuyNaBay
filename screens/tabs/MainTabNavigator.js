import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useEffect, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

import AddProductScreen from './AddProductScreen';
import AdminPanel from './AdminPanel';
import CartScreen from './CartScreen';
import CheckoutScreen from './CheckoutScreen';
import GetVerifiedScreen from './GetVerifiedScreen';
import HomeScreen from './HomeScreen';
import InboxScreen from './InboxScreen';
import MessagingScreen from './MessagingScreen';
import NotVerifiedScreen from './NotVerifiedScreen';
import ProfileScreen from './ProfileScreen';
import RentalScreen from './RentalScreen';
import RentItemScreen from './RentItemScreen';
import ReportScreen from './ReportScreen';
import VerificationStatusScreen from './VerificationStatusScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function Tabs({ showAdmin, userStatus }) {
  // Automatically detect system theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  
  // Get current theme colors
  const theme = isDarkMode ? darkTheme : lightTheme;

  // Handle tab restrictions based on status
  const handleTabPress = (e, navigation, tabName) => {
    if (userStatus === 'approved') return; // allow access

    e.preventDefault();

    const parent = navigation.getParent ? navigation.getParent() : null;

    // If pending → go to VerificationStatusScreen
    if (userStatus === 'pending') {
      if (parent && parent.navigate) parent.navigate('VerificationStatus');
      else navigation.navigate('VerificationStatus');
    } 
    // If not_requested → go to NotVerifiedScreen
    else {
      if (parent && parent.navigate) parent.navigate('NotVerified');
      else navigation.navigate('NotVerified');
    }
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size, focused }) => {
          const icons = {
            Home: 'home',
            Cart: 'cart',
            Rentals: 'layers',
            Add: 'add-circle',
            Inbox: 'chatbox',
            Profile: 'person',
            Admin: 'shield-checkmark',
          };
          const name = icons[route.name] || 'ellipse';
          
          // Use filled icons when focused for better visual feedback
          const iconName = focused && route.name !== 'Add' 
            ? name 
            : name.replace('-outline', '');
          
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.tabBarInactive,
        tabBarStyle: {
          backgroundColor: theme.tabBarBackground,
          borderTopColor: theme.borderColor,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 65,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          paddingTop: 8,
          ...Platform.select({
            ios: {
              shadowColor: theme.shadowColor,
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
            },
            android: {
              elevation: 16,
            },
          }),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: Platform.OS === 'android' ? '600' : '500',
          fontFamily: Platform.select({
            ios: 'Poppins-Medium',
            android: 'Poppins-SemiBold',
            default: 'Poppins-Medium',
          }),
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        // Add badge styling for notifications (can be used later)
        tabBarBadgeStyle: {
          backgroundColor: theme.badgeColor,
          color: '#fff',
          fontSize: 10,
          fontWeight: Platform.OS === 'android' ? '700' : '600',
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          lineHeight: Platform.OS === 'ios' ? 18 : 16,
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
        }}
      />

      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          tabBarLabel: 'Cart',
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => handleTabPress(e, navigation, 'Cart'),
        })}
      />

      <Tab.Screen
        name="Add"
        component={AddProductScreen}
        options={{
          tabBarLabel: 'Add',
          tabBarIconStyle: {
            marginTop: -4, // Slight offset for the add button to make it more prominent
          },
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => handleTabPress(e, navigation, 'Add'),
        })}
      />

      <Tab.Screen
        name="Inbox"
        component={InboxScreen}
        options={{
          tabBarLabel: 'Inbox',
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => handleTabPress(e, navigation, 'Inbox'),
        })}
      />

      <Tab.Screen 
        name="Rentals" 
        component={RentalScreen}
        options={{
          tabBarLabel: 'Rentals',
        }}
      />

      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
        }}
      />

      {showAdmin && (
        <Tab.Screen 
          name="Admin" 
          component={AdminPanel}
          options={{
            tabBarLabel: 'Admin',
          }}
        />
      )}
    </Tab.Navigator>
  );
}

export default function MainTabNavigator({ route }) {
  const role = route?.params?.role ?? 'user';
  const showAdmin = role === 'admin';

  // Automatically detect system theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  
  // Get current theme colors
  const theme = isDarkMode ? darkTheme : lightTheme;

  const [userStatus, setUserStatus] = useState(null); // 'approved' | 'pending' | 'not_requested'

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const user = auth.currentUser;
        if (!user?.email) {
          setUserStatus('not_requested');
          return;
        }

        const { data, error } = await supabase
          .from('users')
          .select('status')
          .eq('email', user.email)
          .maybeSingle();

        if (error || !data?.status) {
          setUserStatus('not_requested');
        } else {
          setUserStatus(data.status);
        }
      } catch (err) {
        console.error('Error fetching verification status:', err);
        setUserStatus('not_requested');
      }
    };

    fetchStatus();
  }, []);

  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false,
        cardStyle: { 
          backgroundColor: theme.background 
        },
        // Enhanced screen transitions
        presentation: 'card',
        animationEnabled: true,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        cardStyleInterpolator: ({ current, layouts }) => {
          return {
            cardStyle: {
              transform: [
                {
                  translateX: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [layouts.screen.width, 0],
                  }),
                },
              ],
            },
            overlayStyle: {
              opacity: current.progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.5],
              }),
            },
          };
        },
      }}
    >
      <Stack.Screen
        name="Tabs"
        children={() => (
          <Tabs showAdmin={showAdmin} userStatus={userStatus} />
        )}
      />
      <Stack.Screen 
        name="Notifications" 
        component={require('./NotificationScreen').default}
        options={{
          presentation: 'modal',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
      <Stack.Screen 
        name="Messaging" 
        component={MessagingScreen}
      />
      <Stack.Screen 
        name="ReportScreen" 
        component={ReportScreen}
        options={{
          presentation: 'modal',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
      <Stack.Screen 
        name="Rental" 
        component={RentalScreen}
      />
      <Stack.Screen 
        name="RentItemScreen" 
        component={RentItemScreen}
      />
      <Stack.Screen 
        name="ProductDetails" 
        component={require('./ProductDetailsScreen').default}
      />
      <Stack.Screen 
        name="RentalDetails" 
        component={require('./RentalDetailsScreen').default}
      />
      <Stack.Screen 
        name="GetVerified" 
        component={GetVerifiedScreen}
        options={{
          presentation: 'modal',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
      <Stack.Screen 
        name="VerificationStatus" 
        component={VerificationStatusScreen}
      />
      <Stack.Screen 
        name="NotVerified" 
        component={NotVerifiedScreen}
        options={{
          presentation: 'modal',
          gestureEnabled: true,
          gestureDirection: 'vertical',
        }}
      />
      <Stack.Screen 
        name="CheckoutScreen" 
        component={CheckoutScreen}
      />
    </Stack.Navigator>
  );
}

// Dark theme colors (matching CartScreen)
const darkTheme = {
  background: '#0f0f2e',
  tabBarBackground: '#1e1e3f',
  text: '#fff',
  textSecondary: '#bbb',
  accent: '#FDAD00',
  tabBarInactive: '#7a7a9a',
  borderColor: '#2a2a4a',
  shadowColor: '#000',
  badgeColor: '#d32f2f',
};

// Light theme colors (matching CartScreen)
const lightTheme = {
  background: '#f5f7fa',
  tabBarBackground: '#ffffff',
  text: '#1a1a2e',
  textSecondary: '#4a4a6a',
  accent: '#f39c12',
  tabBarInactive: '#8a8a9a',
  borderColor: '#e0e0ea',
  shadowColor: '#000',
  badgeColor: '#e74c3c',
};