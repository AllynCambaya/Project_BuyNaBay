// screens/tabs/MainTabNavigator.js
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import AddProductScreen from './AddProductScreen';
import CartScreen from './CartScreen';
import HomeScreen from './HomeScreen';
import MessagingScreen from './MessagingScreen';
import ProfileScreen from './ProfileScreen';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Home: 'home',
            Cart: 'cart',
            Add: 'add-circle',
            Messages: 'chatbox',
            Profile: 'person',
          };

          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1976d2',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Cart" component={CartScreen} />
      <Tab.Screen name="Add" component={AddProductScreen} />
      <Tab.Screen name="Messages" component={MessagingScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
