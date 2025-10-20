import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useEffect, useState } from 'react';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

import AddProductScreen from './AddProductScreen';
import AdminPanel from './AdminPanel';
import CartScreen from './CartScreen';
import GetVerifiedScreen from './GetVerifiedScreen';
import HomeScreen from './HomeScreen';
import InboxScreen from './InboxScreen';
import MessagingScreen from './MessagingScreen';
import NotVerifiedScreen from './NotVerifiedScreen';
import ProfileScreen from './ProfileScreen';
import VerificationStatusScreen from './VerificationStatusScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function Tabs({ showAdmin, userStatus }) {
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
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Home: 'home',
            Cart: 'cart',
            Add: 'add-circle',
            Inbox: 'chatbox',
            Profile: 'person',
            Admin: 'shield-checkmark',
          };
          const name = icons[route.name] || 'ellipse';
          return <Ionicons name={name} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1976d2',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />

      <Tab.Screen
        name="Cart"
        component={CartScreen}
        listeners={({ navigation }) => ({
          tabPress: (e) => handleTabPress(e, navigation, 'Cart'),
        })}
      />

      <Tab.Screen
        name="Add"
        component={AddProductScreen}
        listeners={({ navigation }) => ({
          tabPress: (e) => handleTabPress(e, navigation, 'Add'),
        })}
      />

      <Tab.Screen
        name="Inbox"
        component={InboxScreen}
        listeners={({ navigation }) => ({
          tabPress: (e) => handleTabPress(e, navigation, 'Inbox'),
        })}
      />

      <Tab.Screen name="Profile" component={ProfileScreen} />

      {showAdmin && (
        <Tab.Screen name="Admin" component={AdminPanel} />
      )}
    </Tab.Navigator>
  );
}

export default function MainTabNavigator({ route }) {
  const role = route?.params?.role ?? 'user';
  const showAdmin = role === 'admin';

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
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="Tabs"
        children={() => (
          <Tabs showAdmin={showAdmin} userStatus={userStatus} />
        )}
      />
      <Stack.Screen name="Messaging" component={MessagingScreen} />
      <Stack.Screen name="ProductDetails" component={require('./ProductDetailsScreen').default} />
      <Stack.Screen name="GetVerified" component={GetVerifiedScreen} />
      <Stack.Screen name="VerificationStatus" component={VerificationStatusScreen} />
      <Stack.Screen name="NotVerified" component={NotVerifiedScreen} />
    </Stack.Navigator>
  );
}
