// screens/tabs/MainTabNavigator.js
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { supabase } from '../../supabase/supabaseClient';

import AddProductScreen from './AddProductScreen';
import AdminPanel from './AdminPanel';
import CartScreen from './CartScreen';
import GetVerifiedScreen from './GetVerifiedScreen';
import HomeScreen from './HomeScreen';
import InboxScreen from './InboxScreen';
import MessagingScreen from './MessagingScreen';
import NotVerifiedScreen from './NotVerifiedScreen';
import ProductDetailsScreen from './ProductDetailsScreen';
import ProfileScreen from './ProfileScreen';
import VerificationStatusScreen from './VerificationStatusScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// ✅ Route guard HOC
const withAccessGuard = (Component, canAccess) => (props) => {
  if (canAccess) return <Component {...props} />;
  return <NotVerifiedScreen {...props} />;
};

function Tabs({ role, userId }) {
  const [status, setStatus] = useState('not_requested');
  const [loading, setLoading] = useState(true);

  const isAdmin = role === 'admin';

  // Fetch user status and refresh every 3 seconds
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('status')
          .eq('id', userId)
          .single();

        if (!error && data?.status) {
          const normalized = data.status.trim().toLowerCase();
          if (isMounted) setStatus(normalized);
        } else {
          if (isMounted) setStatus('not_requested');
        }
      } catch (err) {
        console.error('Error fetching status:', err);
        if (isMounted) setStatus('not_requested');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000); // refresh every 3s

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [userId]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1976d2" />
        <Text style={{ marginTop: 10 }}>Loading...</Text>
      </View>
    );
  }

  const canAccess = status === 'approved' || isAdmin;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Home: 'home',
            Cart: 'cart',
            Add: 'add-circle',
            Inbox: 'chatbox',
            Profile: 'person',
            Admin: 'shield-checkmark',
          };
          return <Ionicons name={icons[route.name] || 'ellipse'} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1976d2',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      {/* Always visible */}
      <Tab.Screen name="Home" component={HomeScreen} />

      {/* Restricted screens wrapped in access guard */}
      <Tab.Screen name="Cart" component={withAccessGuard(CartScreen, canAccess)} />
      <Tab.Screen name="Add" component={withAccessGuard(AddProductScreen, canAccess)} />
      <Tab.Screen name="Inbox" component={withAccessGuard(InboxScreen, canAccess)} />

      {/* Profile tab */}
      <Tab.Screen name="Profile" component={ProfileScreen} />

      {/* Admin-only tab */}
      {isAdmin && <Tab.Screen name="Admin" component={AdminPanel} />}
    </Tab.Navigator>
  );
}

export default function MainTabNavigator({ route }) {
  const role = route?.params?.role ?? 'user';
  const userId = route?.params?.userId;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs">
        {() => <Tabs role={role} userId={userId} />}
      </Stack.Screen>
      <Stack.Screen name="Messaging" component={MessagingScreen} />
      <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} />
      <Stack.Screen name="GetVerified" component={GetVerifiedScreen} />
      <Stack.Screen name="VerificationStatus" component={VerificationStatusScreen} />
    </Stack.Navigator>
  );
}
