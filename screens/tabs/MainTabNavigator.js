// navigation/MainTabNavigator.js
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View, useColorScheme } from 'react-native';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

import AddProductScreen from './AddProductScreen';
import AddScreen from './AddScreen';
import AdminPanel from './AdminPanel';
import CartScreen from './CartScreen';
import CheckoutScreen from './CheckoutScreen';
import GetVerifiedScreen from './GetVerifiedScreen';
import HomeScreen from './HomeScreen';
import InboxScreen from './InboxScreen';
import MessagingScreen from './MessagingScreen';
import NotVerifiedScreen from './NotVerifiedScreen';
import ProductScreen from './ProductScreen';
import ProfileScreen from './ProfileScreen';
import RentalScreen from './RentalScreen';
import RentItemScreen from './RentItemScreen';
import ReportScreen from './ReportScreen';
import VerificationStatusScreen from './VerificationStatusScreen';

import AddLostItemScreen from './AddLostItemScreen';
import LostAndFoundDetailsScreen from './LostAndFoundDetailsScreen';
import LostAndFoundScreen from './LostAndFoundScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Animated Tab Icon Component
function AnimatedTabIcon({ name, color, size, focused }) {
  const scaleAnim = useRef(new Animated.Value(focused ? 1 : 0.9)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (focused) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1.1,
          friction: 3,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: -4,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(bounceAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else {
      Animated.spring(scaleAnim, {
        toValue: 0.9,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }
  }, [focused]);

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }, { translateY: bounceAnim }],
      }}
    >
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}

// Custom Tab Bar Background Component
function CustomTabBarBackground({ theme }) {
  return (
    <View style={styles.tabBarBackgroundContainer}>
      <View style={[styles.tabBarBackground, { backgroundColor: theme.tabBarBackground }]} />
      <View style={[styles.tabBarTopBorder, { backgroundColor: theme.borderColor }]} />
    </View>
  );
}

function Tabs({ showAdmin, userStatus }) {
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  const handleTabPress = (e, navigation, tabName) => {
    if (userStatus === 'approved') return;

    e.preventDefault();
    const parent = navigation.getParent ? navigation.getParent() : null;

    if (userStatus === 'pending') {
      if (parent && parent.navigate) parent.navigate('VerificationStatus');
      else navigation.navigate('VerificationStatus');
    } else {
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
            Home: focused ? 'home' : 'home-outline',
            Cart: focused ? 'cart' : 'cart-outline',
            Add: 'add-circle',
            Community: focused ? 'people' : 'people-outline',
            Inbox: focused ? 'chatbox' : 'chatbox-outline',
            Admin: focused ? 'shield-checkmark' : 'shield-checkmark-outline',
          };
          const name = icons[route.name] || 'ellipse';

          // Special styling for Add button
          if (route.name === 'Add') {
            return (
              <View style={[styles.addButtonContainer, { backgroundColor: theme.accent }]}>
                <Ionicons name={name} size={size + 4} color="#fff" />
              </View>
            );
          }

          return <AnimatedTabIcon name={name} color={color} size={size} focused={focused} />;
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.tabBarInactive,
        tabBarBackground: () => <CustomTabBarBackground theme={theme} />,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 12,
          paddingTop: 8,
          paddingHorizontal: 8,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: Platform.OS === 'android' ? '700' : '600',
          marginTop: route.name === 'Add' ? 6 : 2,
          fontFamily: Platform.select({
            ios: 'Poppins-SemiBold',
            android: 'Poppins-Bold',
            default: 'Poppins-SemiBold',
          }),
        },
        tabBarItemStyle: {
          paddingVertical: 6,
          borderRadius: 12,
          marginHorizontal: 2,
        },
        tabBarBadgeStyle: {
          backgroundColor: theme.badgeColor,
          color: '#fff',
          fontSize: 10,
          fontWeight: Platform.OS === 'android' ? '700' : '600',
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          borderWidth: 2,
          borderColor: theme.tabBarBackground,
          lineHeight: Platform.OS === 'ios' ? 14 : 12,
          fontFamily: 'Poppins-Bold',
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
        component={AddScreen}
        options={{
          tabBarLabel: '',
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => handleTabPress(e, navigation, 'Add'),
        })}
      />

      <Tab.Screen
        name="Community"
        component={require('./CommunityScreen').default}
        options={{
          tabBarLabel: 'Community',
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => handleTabPress(e, navigation, 'Community'),
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

  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  const [userStatus, setUserStatus] = useState(null);

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
        presentation: 'card',
        animationEnabled: true,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        cardStyleInterpolator: ({ current, next, layouts }) => {
          return {
            cardStyle: {
              transform: [
                {
                  translateX: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [layouts.screen.width, 0],
                  }),
                },
                {
                  scale: next
                    ? next.progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0.95],
                      })
                    : 1,
                },
              ],
              opacity: current.progress.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 0.5, 1],
              }),
            },
            overlayStyle: {
              opacity: current.progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.3],
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
          cardStyleInterpolator: ({ current }) => ({
            cardStyle: {
              transform: [
                {
                  translateY: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1000, 0],
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
          }),
        }}
      />
      <Stack.Screen 
        name="Messaging" 
        component={MessagingScreen}
      />
      <Stack.Screen
        name="LostAndFound"
        component={LostAndFoundScreen}
      />
      <Stack.Screen
        name="AddLostItem"
        component={AddLostItemScreen}
      />
      <Stack.Screen
        name="LostAndFoundDetails"
        component={LostAndFoundDetailsScreen}
      />
      <Stack.Screen 
        name="ReportScreen" 
        component={ReportScreen}
        options={{
          presentation: 'modal',
          gestureEnabled: true,
          gestureDirection: 'vertical',
          cardStyleInterpolator: ({ current }) => ({
            cardStyle: {
              transform: [
                {
                  translateY: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1000, 0],
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
          }),
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
          cardStyleInterpolator: ({ current }) => ({
            cardStyle: {
              transform: [
                {
                  translateY: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1000, 0],
                  }),
                },
                {
                  scale: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                },
              ],
              opacity: current.progress.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 0.5, 1],
              }),
            },
            overlayStyle: {
              opacity: current.progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.5],
              }),
            },
          }),
        }}
      />
      <Stack.Screen 
        name="VerificationStatus" 
        component={VerificationStatusScreen}
      />
      <Stack.Screen 
        name="UserProfile" 
        component={ProfileScreen}
      />
      <Stack.Screen
        name="AddProductScreen"
        component={AddProductScreen}
      />
      <Stack.Screen
        name="ProductScreen"
        component={ProductScreen}
      />
      <Stack.Screen 
        name="NotVerified" 
        component={NotVerifiedScreen}
        options={{
          presentation: 'modal',
          gestureEnabled: true,
          gestureDirection: 'vertical',
          cardStyleInterpolator: ({ current }) => ({
            cardStyle: {
              transform: [
                {
                  translateY: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1000, 0],
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
          }),
        }}
      />
      <Stack.Screen 
        name="CheckoutScreen" 
        component={CheckoutScreen}
      />
      <Stack.Screen
        name="ProfileScreen"
        component={ProfileScreen}
      />
    </Stack.Navigator>
  );
}

const darkTheme = {
  background: '#0f0f2e',
  tabBarBackground: '#1a1a3e',
  text: '#ffffff',
  textSecondary: '#9ca3af',
  accent: '#FDAD00',
  tabBarInactive: '#64748b',
  borderColor: '#2d2d5a',
  shadowColor: '#000',
  badgeColor: '#ef4444',
};

const lightTheme = {
  background: '#f8fafc',
  tabBarBackground: '#ffffff',
  text: '#1e293b',
  textSecondary: '#64748b',
  accent: '#f39c12',
  tabBarInactive: '#94a3b8',
  borderColor: '#e2e8f0',
  shadowColor: '#000',
  badgeColor: '#ef4444',
};

const styles = StyleSheet.create({
  tabBarBackgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  tabBarBackground: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  tabBarTopBorder: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    opacity: 0.3,
  },
  addButtonContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -8,
    ...Platform.select({
      ios: {
        shadowColor: '#FDAD00',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
});