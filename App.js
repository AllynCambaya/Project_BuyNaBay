// App.js
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoginScreen from './screens/authentication/LoginScreen';
import RegisterScreen from './screens/authentication/RegisterScreen';
import ResetPasswordScreen from './screens/authentication/ResetPasswordScreen';
import MainTabNavigator from './screens/tabs/MainTabNavigator';
import MessagingScreen from './screens/tabs/MessagingScreen';
import NotificationsScreen from './screens/tabs/NotificationScreen';
import { customFontsToLoad, setDefaultFont } from './theme/typography';

const Stack = createNativeStackNavigator();

// Set the default font for all Text components
setDefaultFont();

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, fontError] = useFonts(customFontsToLoad);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <NavigationContainer onReady={onLayoutRootView}>
        <Stack.Navigator 
          initialRouteName="Login"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="MessagingScreen" component={MessagingScreen} /> 
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
