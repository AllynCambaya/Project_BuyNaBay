// App.js
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './screens/authentication/LoginScreen';
import RegisterScreen from './screens/authentication/RegisterScreen';
import ResetPasswordScreen from './screens/authentication/ResetPasswordScreen';
import MainTabNavigator from './screens/tabs/MainTabNavigator';
import MessagingScreen from './screens/tabs/MessagingScreen'; // ✅ import MessagingScreen
import NotificationsScreen from './screens/tabs/NotificationScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="MessagingScreen" component={MessagingScreen} /> 
      </Stack.Navigator>
    </NavigationContainer>
  );
}
