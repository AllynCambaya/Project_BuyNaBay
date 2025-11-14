// utils/MessageNotificationHelper.js
import { supabase } from '../supabase/supabaseClient';
import { sendPushNotification } from './PushNotificationSender';

// Notification Types
export const NotificationType = {
  MESSAGE: 'message',
  PURCHASE: 'purchase',
  SALE: 'sale',
  PRODUCT_SHARED: 'product_shared',
};

// Base notification sender
export const sendEnhancedNotification = async ({
  senderId,
  receiverId,
  type,
  title,
  message,
  metadata = {},
}) => {
  try {
    console.log('🔔 [NotificationHelper] Sending notification:', type);

    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        type: type,
        title: title,
        message: message,
        metadata: metadata,
        is_read: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (notificationError) {
      console.error('❌ Notification error:', notificationError);
      return false;
    }

    console.log('✅ Notification sent:', notification.id);
    return true;
  } catch (err) {
    console.error('❌ Notification exception:', err);
    return false;
  }
};

// Purchase Notification (for seller)
export const sendPurchaseNotification = async ({
  buyerId,
  sellerId,
  buyerName,
  productName,
  productPrice,
  productId,
  productImage = null,
}) => {
  const metadata = {
    product_id: productId,
    product_name: productName,
    product_price: productPrice,
    product_image: productImage,
    buyer_id: buyerId,
    buyer_name: buyerName,
    action: 'purchase',
  };

  const success = await sendEnhancedNotification({
    senderId: buyerId,
    receiverId: sellerId,
    type: NotificationType.PURCHASE,
    title: '🎉 Product Sold!',
    message: `${buyerName} purchased "${productName}" for ₱${productPrice}`,
    metadata: metadata,
  });

  if (success) {
    // ✅ FIXED: Pass object parameter instead of positional parameters
    await sendPushNotification({
      receiverEmail: sellerId,
      title: '🎉 Product Sold!',
      body: `${buyerName} purchased "${productName}"`,
      data: {
        type: 'purchase',
        screen: 'MessagingScreen',
        params: {
          receiverId: buyerId,
          receiverName: buyerName,
        },
      },
    });
  }

  return success;
};

// Sale Confirmation (for buyer)
export const sendSaleConfirmationNotification = async ({
  buyerId,
  sellerId,
  sellerName,
  productName,
  productPrice,
  productId,
  productImage = null,
}) => {
  const metadata = {
    product_id: productId,
    product_name: productName,
    product_price: productPrice,
    product_image: productImage,
    seller_id: sellerId,
    seller_name: sellerName,
    action: 'sale_confirmation',
  };

  const success = await sendEnhancedNotification({
    senderId: sellerId,
    receiverId: buyerId,
    type: NotificationType.SALE,
    title: '✅ Purchase Confirmed',
    message: `Your purchase of "${productName}" (₱${productPrice}) has been confirmed`,
    metadata: metadata,
  });

  if (success) {
    // ✅ FIXED: Pass object parameter
    await sendPushNotification({
      receiverEmail: buyerId,
      title: '✅ Purchase Confirmed',
      body: `You successfully purchased "${productName}"`,
      data: {
        type: 'sale',
        screen: 'OrderHistory',
      },
    });
  }

  return success;
};

// Message Notification (enhanced with product context)
export const sendMessageNotification = async ({
  senderEmail,
  receiverEmail,
  messageText,
  hasImages = false,
  productContext = null,
}) => {
  try {
    console.log('🔔 [NotificationHelper] Sending notification to:', receiverEmail);

    const { data: senderData, error: senderError } = await supabase
      .from('users')
      .select('name')
      .eq('email', senderEmail)
      .maybeSingle();

    if (senderError) {
      console.warn('⚠️ [NotificationHelper] Error fetching sender name:', senderError);
    }

    const senderName = senderData?.name || senderEmail;

    let notificationMessage = '';
    let pushTitle = 'New Message';
    let notificationType = NotificationType.MESSAGE;
    let metadata = { has_images: hasImages };

    // Product shared
    if (productContext) {
      notificationType = NotificationType.PRODUCT_SHARED;
      notificationMessage = `${senderName} shared a product: ${productContext.product_name || productContext.item_name}`;
      pushTitle = '📦 Product Shared';
      metadata = {
        ...metadata,
        product_id: productContext.id,
        product_name: productContext.product_name || productContext.item_name,
        product_price: productContext.price,
        product_image: productContext.product_image_url || productContext.rental_item_image,
      };
    }
    // Image message
    else if (hasImages && !messageText) {
      notificationMessage = `${senderName} sent you a photo`;
    } else if (hasImages && messageText) {
      const truncatedText = messageText.length > 50 
        ? `${messageText.substring(0, 50)}...` 
        : messageText;
      notificationMessage = `${senderName} sent you a photo: ${truncatedText}`;
    }
    // Text message
    else if (messageText) {
      const truncatedText = messageText.length > 100 
        ? `${messageText.substring(0, 100)}...` 
        : messageText;
      notificationMessage = `${truncatedText}`;
      pushTitle = senderName;
    } else {
      notificationMessage = `${senderName} sent you a message`;
    }

    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .insert({
        sender_id: senderEmail,
        receiver_id: receiverEmail,
        type: notificationType,
        title: productContext ? '📦 Product Shared' : 'New Message',
        message: notificationMessage,
        metadata: metadata,
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

    // ✅ FIXED: Pass object parameter instead of positional parameters
    await sendPushNotification({
      receiverEmail: receiverEmail,
      title: pushTitle,
      body: notificationMessage,
      data: {
        type: notificationType,
        senderId: senderEmail,
        senderName: senderName,
        screen: 'MessagingScreen',
        params: {
          receiverId: senderEmail,
          receiverName: senderName,
        },
      },
    });

    return true;

  } catch (error) {
    console.error('❌ [NotificationHelper] Unexpected error:', error);
    return false;
  }
};

// Keep your existing sendProductSoldNotification for backward compatibility
export const sendProductSoldNotification = async ({
  buyerEmail,
  sellerEmail,
  productName,
  price,
  productId = null,
}) => {
  try {
    const { data: buyerData } = await supabase
      .from('users')
      .select('name')
      .eq('email', buyerEmail)
      .maybeSingle();

    const buyerName = buyerData?.name || buyerEmail;

    return await sendPurchaseNotification({
      buyerId: buyerEmail,
      sellerId: sellerEmail,
      buyerName: buyerName,
      productName: productName,
      productPrice: price,
      productId: productId,
    });
  } catch (error) {
    console.error('❌ [NotificationHelper] Unexpected error:', error);
    return false;
  }
};