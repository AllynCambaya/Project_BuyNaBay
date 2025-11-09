// App.js
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import * as NavigationBar from 'expo-navigation-bar';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler'; // ✅ ADD THIS
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from './firebase/firebaseConfig';
import LoginScreen from './screens/authentication/LoginScreen';
import RegisterScreen from './screens/authentication/RegisterScreen';
import ResetPasswordScreen from './screens/authentication/ResetPasswordScreen';
import MainTabNavigator from './screens/tabs/MainTabNavigator';
import MessagingScreen from './screens/tabs/MessagingScreen';
import NotificationsScreen from './screens/tabs/NotificationScreen';
import { registerForPushNotificationsAsync } from './services/NotificationService';
import { customFontsToLoad } from './theme/typography';

const Stack = createNativeStackNavigator();
SplashScreen.preventAutoHideAsync();

const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#FDAD00" />
  </View>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fontsLoaded, fontError] = useFonts(customFontsToLoad);
  const colorScheme = useColorScheme();
  
  const navigationRef = useRef();
  const notificationListener = useRef();
  const responseListener = useRef();

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

useEffect(() => {
  notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
    console.log('🔔 Notification received:', notification);
  });

  responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('👆 Notification tapped:', response);
    
    const data = response.notification.request.content.data;
    
    if (data.type === 'message' && data.screen) {
      navigationRef.current?.navigate(data.screen, data.params);
    } else if (data.type === 'order' && data.screen) {
      navigationRef.current?.navigate(data.screen);
    }
  });

  return () => {
    if (notificationListener.current) {
      Notifications.removeNotificationSubscription(notificationListener.current);
    }
    if (responseListener.current) {
      Notifications.removeNotificationSubscription(responseListener.current);
    }
  };
}, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      // NavigationBar.setBackgroundColorAsync(
      //   colorScheme === 'dark' ? '#0F0F2E' : '#F5F7FA'
      // );
      NavigationBar.setButtonStyleAsync(
        colorScheme === 'dark' ? 'light' : 'dark'
      );
    }
  }, [colorScheme]);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    // ✅ WRAP EVERYTHING IN GestureHandlerRootView
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <StatusBar
          style={colorScheme === 'dark' ? 'light' : 'dark'}
          backgroundColor={colorScheme === 'dark' ? '#0F0F2E' : '#F5F7FA'}
        />
        <NavigationContainer ref={navigationRef} onReady={onLayoutRootView}>
          <Stack.Navigator 
            initialRouteName={user ? "MainTabs" : "Login"}
            screenOptions={{ headerShown: false }}
          >
            {user ? (
              <>
                <Stack.Screen name="MainTabs" component={MainTabNavigator} />
                <Stack.Screen name="Notifications" component={NotificationsScreen} />
                <Stack.Screen name="MessagingScreen" component={MessagingScreen} />
              </>
            ) : (
              <>
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Register" component={RegisterScreen} />
                <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaView>
    </GestureHandlerRootView>
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