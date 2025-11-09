import { supabase } from '../supabase/supabaseClient';
import { sendPushNotification } from './PushNotificationSender';

export const sendMessageNotification = async ({
  senderEmail,
  receiverEmail,
  messageText,
  hasImages = false,
}) => {
  try {
    console.log('🔔 [NotificationHelper] Sending notification to:', receiverEmail);

    // Fetch sender's name
    const { data: senderData, error: senderError } = await supabase
      .from('users')
      .select('name')
      .eq('email', senderEmail)
      .maybeSingle();

    if (senderError) {
      console.warn('⚠️ [NotificationHelper] Error fetching sender name:', senderError);
    }

    const senderName = senderData?.name || senderEmail;

    // Construct notification message
    let notificationMessage = '';
    let pushTitle = 'New Message';
    
    if (hasImages && !messageText) {
      notificationMessage = `${senderName} sent you a photo`;
    } else if (hasImages && messageText) {
      const truncatedText = messageText.length > 50 
        ? `${messageText.substring(0, 50)}...` 
        : messageText;
      notificationMessage = `${senderName} sent you a photo: ${truncatedText}`;
    } else if (messageText) {
      const truncatedText = messageText.length > 100 
        ? `${messageText.substring(0, 100)}...` 
        : messageText;
      notificationMessage = `${truncatedText}`;
      pushTitle = senderName; // Use sender name as title for text messages
    } else {
      notificationMessage = `${senderName} sent you a message`;
    }

    // Insert notification into database
    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .insert({
        sender_id: senderEmail,
        receiver_id: receiverEmail,
        title: 'New Message',
        message: notificationMessage,
        is_read: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (notificationError) {
      console.error('❌ [NotificationHelper] Failed to insert notification:', notificationError);
      return false;
    }

    console.log('✅ [NotificationHelper] Database notification created:', notification.id);

    // 🆕 Send push notification
    await sendPushNotification(
      receiverEmail,
      pushTitle,
      notificationMessage,
      {
        type: 'message',
        senderId: senderEmail,
        senderName: senderName,
        screen: 'Messaging',
        params: {
          receiverId: senderEmail,
          receiverName: senderName,
        },
      }
    );

    return true;

  } catch (error) {
    console.error('❌ [NotificationHelper] Unexpected error:', error);
    return false;
  }
};

export const sendProductSoldNotification = async ({
  buyerEmail,
  sellerEmail,
  productName,
  price,
}) => {
  try {
    console.log('🔔 [NotificationHelper] Sending product sold notification to:', sellerEmail);

    // Fetch buyer's name
    const { data: buyerData } = await supabase
      .from('users')
      .select('name')
      .eq('email', buyerEmail)
      .maybeSingle();

    const buyerName = buyerData?.name || buyerEmail;
    const notificationMessage = `${buyerName} purchased "${productName}" for ₱${price}`;

    // Insert notification
    const { error } = await supabase
      .from('notifications')
      .insert({
        sender_id: buyerEmail,
        receiver_id: sellerEmail,
        title: 'Product Sold',
        message: notificationMessage,
        is_read: false,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('❌ [NotificationHelper] Failed to send product sold notification:', error);
      return false;
    }

    // 🆕 Send push notification
    await sendPushNotification(
      sellerEmail,
      'Product Sold! 🎉',
      notificationMessage,
      {
        type: 'order',
        buyerEmail: buyerEmail,
        productName: productName,
        price: price,
        screen: 'OrderHistory',
      }
    );

    console.log('✅ [NotificationHelper] Product sold notification sent successfully');
    return true;

  } catch (error) {
    console.error('❌ [NotificationHelper] Unexpected error:', error);
    return false;
  }
};