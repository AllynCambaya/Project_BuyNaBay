// navigation/MainTabNavigator.js
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { BlurView } from 'expo-blur';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View, useColorScheme } from 'react-native';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';
import { darkTheme, lightTheme } from '../../theme/theme';
import { fontFamily, fontSizes } from '../../theme/typography';

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

// Animated Tab Icon with smooth spring animations
function AnimatedTabIcon({ name, color, size, focused, theme }) {
  const scaleAnim = useRef(new Animated.Value(focused ? 1 : 0.88)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(focused ? 1 : 0.65)).current;

  useEffect(() => {
    if (focused) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1.12,
          friction: 5,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: -4,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.spring(bounceAnim, {
            toValue: 0,
            friction: 5,
            tension: 50,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 0.88,
          friction: 5,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.65,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [focused]);

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }, { translateY: bounceAnim }],
        opacity: opacityAnim,
      }}
    >
      <Ionicons name={name} size={size} color={color} />
      {focused && (
        <Animated.View
          style={[
            styles.activeIndicator,
            { backgroundColor: color, opacity: opacityAnim },
          ]}
        />
      )}
    </Animated.View>
  );
}

// Custom Tab Bar Background matching ProfileScreen aesthetic
function CustomTabBarBackground({ theme, isDarkMode }) {
  return (
    <View style={styles.tabBarContainer}>
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={isDarkMode ? 90 : 80}
          tint={isDarkMode ? 'dark' : 'light'}
          style={[styles.blurView, { backgroundColor: isDarkMode ? 'rgba(31, 29, 71, 0.85)' : 'rgba(255, 255, 255, 0.85)' }]}
        />
      ) : (
        <View style={[styles.solidBackground, { backgroundColor: theme.cardBackground }]} />
      )}
      {/* Subtle top border */}
      <View style={[styles.topBorder, { backgroundColor: isDarkMode ? 'rgba(253, 173, 0, 0.15)' : 'rgba(0, 0, 0, 0.08)' }]} />
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

          // Special elevated Add button
          if (route.name === 'Add') {
            return (
              <View style={styles.addButtonWrapper}>
                <View style={[styles.addButtonOuter, { 
                  backgroundColor: theme.accent,
                  ...Platform.select({
                    ios: {
                      shadowColor: theme.accent,
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.4,
                      shadowRadius: 12,
                    },
                    android: {
                      elevation: 8,
                    },
                  })
                }]}>
                  <Ionicons name={name} size={size + 4} color="#fff" />
                </View>
              </View>
            );
          }

          return <AnimatedTabIcon name={name} color={color} size={size} focused={focused} theme={theme} />;
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarBackground: () => <CustomTabBarBackground theme={theme} isDarkMode={isDarkMode} />,
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
          fontSize: fontSizes.xs,
          fontFamily: fontFamily.semiBold,
          marginTop: route.name === 'Add' ? 6 : 2,
          letterSpacing: 0.2,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
          borderRadius: 12,
          marginHorizontal: 2,
        },
        tabBarBadgeStyle: {
          backgroundColor: theme.error,
          color: '#fff',
          fontSize: 9,
          fontFamily: fontFamily.bold,
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          borderWidth: 2,
          borderColor: theme.cardBackground,
          lineHeight: Platform.OS === 'ios' ? 14 : 12,
          ...Platform.select({
            ios: {
              shadowColor: theme.error,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.4,
              shadowRadius: 4,
            },
            android: {
              elevation: 4,
            },
          }),
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
        // Smooth horizontal slide matching ProfileScreen transitions
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
                        outputRange: [1, 0.96],
                      })
                    : 1,
                },
              ],
              opacity: current.progress.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 0.7, 1],
              }),
            },
            overlayStyle: {
              opacity: current.progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.15],
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
                {
                  scale: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.94, 1],
                  }),
                },
              ],
            },
            overlayStyle: {
              opacity: current.progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.4],
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
                outputRange: [0, 0.4],
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
                    outputRange: [0.92, 1],
                  }),
                },
              ],
              opacity: current.progress.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 0.8, 1],
              }),
            },
            overlayStyle: {
              opacity: current.progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.4],
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
                outputRange: [0, 0.4],
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

const styles = StyleSheet.create({
  // Tab Bar Container
  tabBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  blurView: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  solidBackground: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...Platform.select({
      android: {
        elevation: 12,
      },
    }),
  },
  topBorder: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    opacity: 0.6,
  },

  // Active Indicator
  activeIndicator: {
    position: 'absolute',
    bottom: -6,
    left: '50%',
    marginLeft: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  // Add Button
  addButtonWrapper: {
    marginTop: -8,
  },
  addButtonOuter: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
});