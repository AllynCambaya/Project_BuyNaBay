import { supabase } from '../supabase/supabaseClient';

/**
 * Send push notification via Expo Push API
 * @param {string} receiverEmail - Email of the receiver
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data to send
 */
export async function sendPushNotification(receiverEmail, title, body, data = {}) {
  try {
    console.log('📤 Sending push notification to:', receiverEmail);

    // Get receiver's push token
    const { data: tokenData, error: tokenError } = await supabase
      .from('push_tokens')
      .select('push_token')
      .eq('user_email', receiverEmail)
      .maybeSingle();

    if (tokenError || !tokenData?.push_token) {
      console.log('⚠️ No push token found for user:', receiverEmail);
      return false;
    }

    const pushToken = tokenData.push_token;

    // Send push notification via Expo API
    const message = {
      to: pushToken,
      sound: 'default',
      title: title,
      body: body,
      data: data,
      badge: 1,
      priority: 'high',
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

    if (result.data && result.data.status === 'ok') {
      console.log('✅ Push notification sent successfully');
      return true;
    } else {
      console.error('❌ Push notification failed:', result);
      return false;
    }
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    return false;
  }
}

/**
 * Send bulk push notifications
 */
export async function sendBulkPushNotifications(messages) {
  try {
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
    console.log('✅ Bulk push notifications sent:', result);
    return result;
  } catch (error) {
    console.error('❌ Error sending bulk push notifications:', error);
    return null;
  }
}