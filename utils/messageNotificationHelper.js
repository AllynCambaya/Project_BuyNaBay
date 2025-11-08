// utils/messageNotificationHelper.js
// Add this utility function to handle message notifications

import { supabase } from '../supabase/supabaseClient';

/**
 * Sends a notification when a new message is sent
 * @param {string} senderId - Email of the sender
 * @param {string} receiverId - Email of the receiver
 * @param {string} messageText - The message text (will be truncated if too long)
 * @param {boolean} hasImage - Whether the message contains an image
 */
export const sendMessageNotification = async (senderId, receiverId, messageText, hasImage = false) => {
  try {
    // Get sender's name
    const { data: senderData } = await supabase
      .from('users')
      .select('name')
      .eq('email', senderId)
      .maybeSingle();

    const senderName = senderData?.name || senderId;

    // Create notification message
    let notificationMessage = '';
    if (hasImage && !messageText) {
      notificationMessage = `${senderName} sent you a photo`;
    } else if (hasImage && messageText) {
      notificationMessage = `${senderName} sent you a photo: ${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}`;
    } else {
      notificationMessage = `${senderName}: ${messageText.substring(0, 100)}${messageText.length > 100 ? '...' : ''}`;
    }

    // Insert notification into database
    const { error } = await supabase
      .from('notifications')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        title: 'New Message',
        message: notificationMessage,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error sending notification:', error);
    }
  } catch (error) {
    console.error('Error in sendMessageNotification:', error);
  }
};

/**
 * Sends a notification for product sharing in messages
 * @param {string} senderId - Email of the sender
 * @param {string} receiverId - Email of the receiver
 * @param {string} productName - Name of the product
 */
export const sendProductShareNotification = async (senderId, receiverId, productName) => {
  try {
    const { data: senderData } = await supabase
      .from('users')
      .select('name')
      .eq('email', senderId)
      .maybeSingle();

    const senderName = senderData?.name || senderId;

    const { error } = await supabase
      .from('notifications')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        title: 'Product Shared',
        message: `${senderName} shared "${productName}" with you`,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error sending product notification:', error);
    }
  } catch (error) {
    console.error('Error in sendProductShareNotification:', error);
  }
};