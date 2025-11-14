// utils/PushNotificationSender.js
import { supabase } from '../supabase/supabaseClient';

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

/**
 * Send push notification to a single user
 */
export async function sendPushNotification({ 
  receiverEmail, 
  title, 
  body, 
  data = {} 
}) {
  console.log('📤 [PushNotificationSender] Sending push to:', receiverEmail);

  try {
    // ✅ FIXED: Fetch from push_tokens table instead of users table
    const { data: tokenData, error: fetchError } = await supabase
      .from('push_tokens')
      .select('push_token, device_type')
      .eq('user_email', receiverEmail)
      .maybeSingle();

    if (fetchError) {
      console.error('❌ [PushNotificationSender] Error fetching push token:', fetchError);
      return { success: false, error: fetchError };
    }

    if (!tokenData?.push_token) {
      console.warn('⚠️ [PushNotificationSender] No push token found for:', receiverEmail);
      return { success: false, error: 'No push token' };
    }

    console.log('✅ [PushNotificationSender] Found push token for:', receiverEmail);

    // Construct push notification payload
    const message = {
      to: tokenData.push_token,
      sound: 'default',
      title: title,
      body: body,
      data: data,
      priority: 'high',
      channelId: 'default',
      badge: 1,
    };

    // Send to Expo Push API
    const response = await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    // Check for errors in Expo response
    if (result.data?.[0]?.status === 'error') {
      console.error('❌ [PushNotificationSender] Expo API error:', result.data[0]);
      
      // Handle DeviceNotRegistered error (token expired)
      if (result.data[0].details?.error === 'DeviceNotRegistered') {
        console.log('🗑️ [PushNotificationSender] Removing expired token');
        await supabase
          .from('push_tokens')
          .delete()
          .eq('push_token', tokenData.push_token);
      }
      
      return { success: false, error: result.data[0] };
    }

    console.log('✅ [PushNotificationSender] Push sent successfully');
    return { success: true, data: result };

  } catch (error) {
    console.error('❌ [PushNotificationSender] Unexpected error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send push notifications to multiple users (bulk)
 */
export async function sendBulkPushNotifications(notifications) {
  console.log(`📤 [PushNotificationSender] Sending ${notifications.length} push notifications`);
  
  const results = await Promise.allSettled(
    notifications.map(notif => sendPushNotification(notif))
  );

  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.length - successful;

  console.log(`📊 [PushNotificationSender] Bulk send: ${successful} succeeded, ${failed} failed`);
  
  return { successful, failed, results };
}

/**
 * Get all push tokens for a user (in case of multiple devices)
 */
export async function getAllPushTokensForUser(userEmail) {
  try {
    const { data, error } = await supabase
      .from('push_tokens')
      .select('push_token, device_type')
      .eq('user_email', userEmail);

    if (error) {
      console.error('❌ [PushNotificationSender] Error fetching tokens:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ [PushNotificationSender] Error in getAllPushTokensForUser:', error);
    return [];
  }
}