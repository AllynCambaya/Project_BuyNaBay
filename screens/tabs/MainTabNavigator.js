// screens/tabs/MainTabNavigator.js
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';

import AddProductScreen from './AddProductScreen';
import CartScreen from './CartScreen';
import HomeScreen from './HomeScreen';
import InboxScreen from './InboxScreen';
import MessagingScreen from './MessagingScreen';
import ProfileScreen from './ProfileScreen';
import AdminPanel from './AdminPanel';
import GetVerifiedScreen from './GetVerifiedScreen';
import NotVerifiedScreen from './NotVerifiedScreen'; // <-- new

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function Tabs({ showAdmin, status }) {
  // status values: 'approved', 'pending', 'rejected'
  const isApproved = status === 'approved';
  const isRejected = status === 'rejected';
  const isPending = status === 'pending';

  // helper to require approval for a screen but keep the tab visible
  const requireApproved = (Component) => {
    return (props) => (isApproved ? <Component {...props} /> : <NotVerifiedScreen {...props} />);
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
      {/* Home always available */}
      <Tab.Screen name="Home" component={HomeScreen} />

      {/* Cart tab visible but restricted to approved users */}
      <Tab.Screen name="Cart" component={requireApproved(CartScreen)} />

      {/* Add product tab visible but restricted to approved users */}
      <Tab.Screen name="Add" component={requireApproved(AddProductScreen)} />

      {/* Inbox tab visible but restricted to approved users */}
      <Tab.Screen name="Inbox" component={requireApproved(InboxScreen)} />

      {/* Profile: available for all (you previously wanted Profile for rejected/pending — keep visible and accessible) */}
      <Tab.Screen name="Profile" component={ProfileScreen} />

      {/* Admin: keep the admin tab visible only for admins AND approved */}
      {showAdmin && isApproved && <Tab.Screen name="Admin" component={AdminPanel} />}
    </Tab.Navigator>
  );
}

export default function MainTabNavigator({ route }) {
  // role and status are passed from LoginScreen via navigation.replace("MainTabs", { role, status })
  const role = route?.params?.role ?? 'user';
  const status = route?.params?.status ?? 'approved';
  const showAdmin = role === 'admin';

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="Tabs"
        // pass showAdmin and status into Tabs via children prop
        children={() => <Tabs showAdmin={showAdmin} status={status} />}
      />
      {/* Keep Messaging route registered (for navigations),
          but MessagingScreen will also guard access itself based on verification status. */}
      <Stack.Screen name="Messaging" component={MessagingScreen} />
      <Stack.Screen name="ProductDetails" component={require('./ProductDetailsScreen').default} />
      <Stack.Screen name="GetVerified" component={GetVerifiedScreen} />
      <Stack.Screen name="VerificationStatus" component={require('./VerificationStatusScreen').default} />
    </Stack.Navigator>
  );
}
