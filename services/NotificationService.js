import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../supabase/supabaseClient';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register device for push notifications
 * @param {string} userEmail - User's email
 * @returns {Promise<string|null>} Push token or null
 */
export async function registerForPushNotificationsAsync(userEmail) {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FDAD00',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('❌ Permission not granted for push notifications');
      return null;
    }

    token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('✅ Push token obtained:', token);

    // Save token to database
    await savePushToken(userEmail, token);

    return token;
  } else {
    console.log('⚠️ Must use physical device for Push Notifications');
    return null;
  }
}

/**
 * Save push token to database
 */
async function savePushToken(userEmail, pushToken) {
  try {
    const deviceType = Platform.OS;

    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_email: userEmail,
          push_token: pushToken,
          device_type: deviceType,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'push_token',
        }
      );

    if (error) {
      console.error('❌ Error saving push token:', error);
    } else {
      console.log('✅ Push token saved to database');
    }
  } catch (error) {
    console.error('❌ Error in savePushToken:', error);
  }
}

/**
 * Remove push token from database (on logout)
 */
export async function removePushToken(userEmail) {
  try {
    const { error } = await supabase
      .from('push_tokens')
      .delete()
      .eq('user_email', userEmail);

    if (error) {
      console.error('❌ Error removing push token:', error);
    } else {
      console.log('✅ Push token removed from database');
    }
  } catch (error) {
    console.error('❌ Error in removePushToken:', error);
  }
}

/**
 * Get push token for a user
 */
export async function getPushToken(userEmail) {
  try {
    const { data, error } = await supabase
      .from('push_tokens')
      .select('push_token')
      .eq('user_email', userEmail)
      .maybeSingle();

    if (error) {
      console.error('❌ Error fetching push token:', error);
      return null;
    }

    return data?.push_token || null;
  } catch (error) {
    console.error('❌ Error in getPushToken:', error);
    return null;
  }
}