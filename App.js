// App.js
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import * as NavigationBar from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from './firebase/firebaseConfig';
import LoginScreen from './screens/authentication/LoginScreen';
import RegisterScreen from './screens/authentication/RegisterScreen';
import ResetPasswordScreen from './screens/authentication/ResetPasswordScreen';
import MainTabNavigator from './screens/tabs/MainTabNavigator';
import MessagingScreen from './screens/tabs/MessagingScreen';
import NotificationsScreen from './screens/tabs/NotificationScreen';
import { customFontsToLoad } from './theme/typography';

const Stack = createNativeStackNavigator();

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Loading component
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#0000ff" />
  </View>
);

// Push notification registration (implement based on your needs)
const registerForPushNotificationsAsync = async (email) => {
  // TODO: Implement push notification registration
  console.log('Registering push notifications for:', email);
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fontsLoaded, fontError] = useFonts(customFontsToLoad);
  const colorScheme = useColorScheme();

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
      if (currentUser) {
        console.log('✅ User is logged in:', currentUser.email);
        registerForPushNotificationsAsync(currentUser.email);
      } else {
        console.log('❌ User is logged out');
      }
    });

    return unsubscribe;
  }, []);

  // Set Android navigation bar
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync(
        colorScheme === 'dark' ? '#0F0F2E' : '#F5F7FA'
      );
      NavigationBar.setButtonStyleAsync(
        colorScheme === 'dark' ? 'light' : 'dark'
      );
    }
  }, [colorScheme]);

  // Handle splash screen
  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Wait for fonts to load
  if (!fontsLoaded && !fontError) {
    return null;
  }

  // Show loading while checking auth
  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        style={colorScheme === 'dark' ? 'light' : 'dark'}
        backgroundColor={colorScheme === 'dark' ? '#0F0F2E' : '#F5F7FA'}
      />
      <NavigationContainer onReady={onLayoutRootView}>
        <Stack.Navigator 
          initialRouteName={user ? "MainTabs" : "Login"}
          screenOptions={{ headerShown: false }}
        >
          {user ? (
            // Authenticated screens
            <>
              <Stack.Screen name="MainTabs" component={MainTabNavigator} />
              <Stack.Screen name="Notifications" component={NotificationsScreen} />
              <Stack.Screen name="MessagingScreen" component={MessagingScreen} />
            </>
          ) : (
            // Auth screens
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
              <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
            </>
          )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});