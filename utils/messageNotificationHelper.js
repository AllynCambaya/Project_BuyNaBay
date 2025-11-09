// utils/MessageNotificationHelper.js
import { supabase } from '../supabase/supabaseClient';

/**
 * 🔔 Send a notification when a message is sent
 * @param {Object} params
 * @param {string} params.senderEmail - Email of the sender
 * @param {string} params.receiverEmail - Email of the receiver
 * @param {string} params.messageText - The message text content
 * @param {boolean} params.hasImages - Whether the message contains images
 */
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
    if (hasImages && !messageText) {
      notificationMessage = `${senderName} sent you a photo`;
    } else if (hasImages && messageText) {
      // Truncate message if too long
      const truncatedText = messageText.length > 50 
        ? `${messageText.substring(0, 50)}...` 
        : messageText;
      notificationMessage = `${senderName} sent you a photo: ${truncatedText}`;
    } else if (messageText) {
      // Truncate message if too long
      const truncatedText = messageText.length > 100 
        ? `${messageText.substring(0, 100)}...` 
        : messageText;
      notificationMessage = `${senderName}: ${truncatedText}`;
    } else {
      // Fallback (shouldn't happen)
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

    console.log('✅ [NotificationHelper] Notification sent successfully:', notification.id);
    return true;

  } catch (error) {
    console.error('❌ [NotificationHelper] Unexpected error sending notification:', error);
    return false;
  }
};

/**
 * 🔔 Send a product sold notification
 * @param {Object} params
 * @param {string} params.buyerEmail - Email of the buyer
 * @param {string} params.sellerEmail - Email of the seller
 * @param {string} params.productName - Name of the product
 * @param {number} params.price - Price of the product
 */
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

    // Insert notification
    const { error } = await supabase
      .from('notifications')
      .insert({
        sender_id: buyerEmail,
        receiver_id: sellerEmail,
        title: 'Product Sold',
        message: `${buyerName} purchased "${productName}" for ₱${price}`,
        is_read: false,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('❌ [NotificationHelper] Failed to send product sold notification:', error);
      return false;
    }

    console.log('✅ [NotificationHelper] Product sold notification sent successfully');
    return true;

  } catch (error) {
    console.error('❌ [NotificationHelper] Unexpected error:', error);
    return false;
  }
};