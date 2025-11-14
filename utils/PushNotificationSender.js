// utils/PushNotificationSender.js
import { supabase } from '../supabase/supabaseClient';

/**
 * Send a push notification to a specific user
 * @param {string} receiverEmail - Email of the user to send notification to
 * @param {string} title - Notification title
 * @param {string} body - Notification body/message
 * @param {object} data - Additional data to include (for navigation, etc.)
 */
export const sendPushNotification = async (receiverEmail, title, body, data = {}) => {
  try {
    console.log('📤 [PushNotificationSender] Sending push to:', receiverEmail);

    // Fetch the user's push token from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('push_token')
      .eq('email', receiverEmail)
      .maybeSingle();

    if (userError) {
      console.error('❌ [PushNotificationSender] Error fetching push token:', userError);
      return false;
    }

    if (!userData?.push_token) {
      console.warn('⚠️ [PushNotificationSender] No push token found for user:', receiverEmail);
      return false;
    }

    const pushToken = userData.push_token;

    // Send the push notification via Expo's push notification service
    const message = {
      to: pushToken,
      sound: 'default',
      title: title,
      body: body,
      data: data,
      priority: 'high',
      channelId: 'default',
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (result.data?.status === 'error') {
      console.error('❌ [PushNotificationSender] Push notification failed:', result.data.message);
      return false;
    }

    console.log('✅ [PushNotificationSender] Push notification sent successfully');
    return true;

  } catch (error) {
    console.error('❌ [PushNotificationSender] Unexpected error:', error);
    return false;
  }
};

/**
 * Send push notifications to multiple users
 * @param {Array<string>} receiverEmails - Array of user emails
 * @param {string} title - Notification title
 * @param {string} body - Notification body/message
 * @param {object} data - Additional data to include
 */
export const sendBulkPushNotifications = async (receiverEmails, title, body, data = {}) => {
  try {
    console.log(`📤 [PushNotificationSender] Sending bulk push to ${receiverEmails.length} users`);

    // Fetch all push tokens
    const { data: usersData, error } = await supabase
      .from('users')
      .select('email, push_token')
      .in('email', receiverEmails);

    if (error) {
      console.error('❌ [PushNotificationSender] Error fetching push tokens:', error);
      return false;
    }

    // Filter out users without push tokens
    const validTokens = usersData
      .filter(user => user.push_token)
      .map(user => user.push_token);

    if (validTokens.length === 0) {
      console.warn('⚠️ [PushNotificationSender] No valid push tokens found');
      return false;
    }

    // Create messages for all tokens
    const messages = validTokens.map(token => ({
      to: token,
      sound: 'default',
      title: title,
      body: body,
      data: data,
      priority: 'high',
      channelId: 'default',
    }));

    // Send all notifications
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log('✅ [PushNotificationSender] Bulk push notifications sent:', result);
    return true;

  } catch (error) {
    console.error('❌ [PushNotificationSender] Unexpected error:', error);
    return false;
  }
};