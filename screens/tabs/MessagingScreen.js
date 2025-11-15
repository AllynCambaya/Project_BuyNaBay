// screens/MessagingScreen.js - MODERNIZED UI (Matches NotificationScreen Design System)
// ✅ All functionality preserved
// ✅ Modern, clean UI matching NotificationScreen
// ✅ Fixed keyboard overlap issues
// ✅ Improved typography, spacing, and visual hierarchy

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';
import { fontFamily } from '../../theme/typography';
import { sendMessageNotification, sendPurchaseNotification, sendSaleConfirmationNotification } from '../../utils/MessageNotificationHelper';
import { handleDirectCheckout } from './CartScreen';

const { width } = Dimensions.get('window');

// 🎨 BEAUTIFUL PRODUCT MESSAGE CARD
const ProductMessageCard = ({ product, isMine, theme, styles, onCheckout, canCheckout, onLongPress }) => {
  let imageUrl = null;
  try {
    const rawImage = product.product_image_url || product.rental_item_image;
    if (rawImage) {
      if (typeof rawImage === 'string' && rawImage.startsWith('http')) {
        imageUrl = rawImage;
      } else if (typeof rawImage === 'string' && rawImage.startsWith('[')) {
        imageUrl = JSON.parse(rawImage)[0];
      } else {
        imageUrl = rawImage;
      }
    }
  } catch (e) {
    console.error('Error parsing product image:', e);
  }

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onLongPress={onLongPress}
      style={[styles.productMessageCard, isMine && styles.productMessageCardMine]}
    >
      <View style={styles.productCardBorder} />
      
      <View style={styles.productMessageHeader}>
        <View style={styles.productBadge}>
          <Ionicons name="bag-handle" size={14} color="#fff" />
        </View>
        <Text style={[styles.productMessageHeaderText, { fontFamily: fontFamily.bold }]}>
          {isMine ? 'Product Shared' : 'Product Recommendation'}
        </Text>
      </View>
      
      <View style={styles.productMessageContent}>
        {imageUrl && (
          <View style={styles.productImageWrapper}>
            <Image 
              source={{ uri: imageUrl }} 
              style={styles.productMessageImage}
              resizeMode="cover"
            />
            <View style={styles.productImageOverlay} />
          </View>
        )}
        <View style={styles.productMessageInfo}>
          <Text style={[styles.productMessageName, { fontFamily: fontFamily.bold }]} numberOfLines={2}>
            {product.product_name || product.item_name}
          </Text>
          <View style={styles.priceRow}>
            <Text style={[styles.productMessagePrice, { fontFamily: fontFamily.extraBold }]}>₱{product.price}</Text>
            {product.rental_duration && (
              <Text style={[styles.productMessageDuration, { fontFamily: fontFamily.semiBold }]}>/ {product.rental_duration}</Text>
            )}
          </View>
          {product.condition && (
            <View style={styles.productMessageConditionBadge}>
              <View style={styles.conditionDot} />
              <Text style={[styles.productMessageConditionText, { fontFamily: fontFamily.bold }]}>{product.condition}</Text>
            </View>
          )}
        </View>
      </View>

      {canCheckout && !product.rental_duration && (
        <TouchableOpacity 
          style={styles.productMessageCheckoutBtn}
          onPress={() => onCheckout(product)}
          activeOpacity={0.85}
        >
          <View style={styles.checkoutGradient}>
            <Ionicons name="cart" size={16} color="#fff" />
            <Text style={[styles.productMessageCheckoutText, { fontFamily: fontFamily.extraBold }]}>Buy Now</Text>
            <Ionicons name="chevron-forward" size={14} color="#fff" />
          </View>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

// 🎉 PURCHASE CONFIRMATION CARD
const PurchaseConfirmationCard = ({ product, theme, styles, onLongPress }) => {
  let imageUrl = null;
  try {
    const rawImage = product.product_image_url || product.rental_item_image;
    if (rawImage) {
      if (typeof rawImage === 'string' && rawImage.startsWith('http')) {
        imageUrl = rawImage;
      } else if (typeof rawImage === 'string' && rawImage.startsWith('[')) {
        imageUrl = JSON.parse(rawImage)[0];
      } else {
        imageUrl = rawImage;
      }
    }
  } catch (e) {
    console.error('Error parsing product image:', e);
  }

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onLongPress={onLongPress}
      style={styles.purchaseConfirmationCard}
    >
      <View style={styles.purchaseCardBorder} />
      
      <View style={styles.purchaseConfirmationHeader}>
        <View style={styles.purchaseSuccessBadge}>
          <Ionicons name="checkmark-circle" size={16} color="#fff" />
        </View>
        <Text style={[styles.purchaseConfirmationHeaderText, { fontFamily: fontFamily.bold }]}>
          Purchase Confirmed
        </Text>
        <View style={styles.purchaseSparkle}>
          <Ionicons name="star" size={12} color="#10B981" />
        </View>
      </View>
      
      <View style={styles.purchaseMessageContent}>
        {imageUrl && (
          <View style={styles.purchaseImageWrapper}>
            <Image 
              source={{ uri: imageUrl }} 
              style={styles.purchaseMessageImage}
              resizeMode="cover"
            />
            <View style={styles.purchaseImageOverlay}>
              <View style={styles.purchaseImageBadge}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </View>
            </View>
          </View>
        )}
        <View style={styles.purchaseMessageInfo}>
          <Text style={[styles.purchaseMessageName, { fontFamily: fontFamily.bold }]} numberOfLines={2}>
            {product.product_name || product.item_name}
          </Text>
          <View style={styles.purchasePriceRow}>
            <Text style={[styles.purchaseMessagePrice, { fontFamily: fontFamily.extraBold }]}>₱{product.price}</Text>
          </View>
          <View style={styles.purchaseStatusBadge}>
            <View style={styles.purchaseStatusDot} />
            <Text style={[styles.purchaseStatusText, { fontFamily: fontFamily.bold }]}>Order Placed</Text>
          </View>
        </View>
      </View>

      <View style={styles.purchaseSuccessFooter}>
        <Ionicons name="shield-checkmark" size={14} color="#10B981" />
        <Text style={[styles.purchaseSuccessFooterText, { fontFamily: fontFamily.semiBold }]}>
          Your order has been successfully placed
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// 💬 MESSAGE ITEM COMPONENT
const MessageItem = ({ item, index, messages, user, receiverName, userAvatar, receiverAvatar, onReply, onLongPress, onImagePress, onProductCheckout, theme, styles }) => {
  const isMine = item.sender_id === user.email;
  const avatarSource = isMine ? userAvatar : receiverAvatar;
  const isProductMessage = item.message_type === 'product' && item.product_context;
  const isPurchaseConfirmation = item.message_type === 'purchase_confirmation';

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  if (!item.text && !item.messages_image_url && !isProductMessage && !isPurchaseConfirmation) return null;

  let imageUrls = [];
  if (item.messages_image_url) {
    try {
      imageUrls = item.messages_image_url.trim().startsWith('[')
        ? JSON.parse(item.messages_image_url)
        : [item.messages_image_url];
    } catch {
      imageUrls = [item.messages_image_url];
    }
  }

  const repliedMessage = messages.find(m => m.id === item.reply_to);
  const prevMessage = index > 0 ? messages[index - 1] : null;
  const shouldGroup = prevMessage && 
    item.sender_id === prevMessage.sender_id && 
    (new Date(item.created_at) - new Date(prevMessage.created_at)) < 60000 &&
    !isProductMessage && prevMessage.message_type !== 'product' &&
    !isPurchaseConfirmation && prevMessage.message_type !== 'purchase_confirmation';
  const showAvatar = !shouldGroup;

  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <Swipeable
        friction={2}
        leftThreshold={50}
        rightThreshold={50}
        onSwipeableLeftOpen={() => onReply(item)}
        onSwipeableRightOpen={() => onReply(item)}
        renderLeftActions={(progress, dragX) => {
          const trans = dragX.interpolate({
            inputRange: [0, 100],
            outputRange: [-50, 0],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View style={[styles.swipeAction, { transform: [{ translateX: trans }] }]}>
              <View style={styles.swipeIconContainer}>
                <Ionicons name="arrow-undo" size={20} color="#fff" />
              </View>
            </Animated.View>
          );
        }}
        renderRightActions={(progress, dragX) => {
          const trans = dragX.interpolate({
            inputRange: [-100, 0],
            outputRange: [0, 50],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View style={[styles.swipeAction, { transform: [{ translateX: trans }] }]}>
              <View style={styles.swipeIconContainer}>
                <Ionicons name="arrow-undo" size={20} color="#fff" />
              </View>
            </Animated.View>
          );
        }}
      >
        <View style={[styles.messageWrapper, isMine ? styles.myWrapper : styles.otherWrapper]}>
          {!isMine && (
            <View style={styles.avatarContainer}>
              {showAvatar && avatarSource ? (
                <View style={styles.avatarWrapper}>
                  <Image source={{ uri: avatarSource }} style={styles.messageAvatar} />
                </View>
              ) : (
                <View style={styles.avatarSpacer} />
              )}
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.9}
            onLongPress={() => !isProductMessage && !isPurchaseConfirmation && onLongPress(item)}
            style={styles.messageContentWrapper}
          >
            {repliedMessage && (
              <View style={[styles.replyIndicator, isMine && styles.replyIndicatorMine]}>
                <View style={styles.replyLine} />
                <View style={styles.replyContent}>
                  <Text style={[styles.replyLabel, { fontFamily: fontFamily.bold }]}>
                    {repliedMessage.sender_id === user.email ? 'You' : receiverName}
                  </Text>
                  
                  {repliedMessage.message_type === 'product' && repliedMessage.product_context ? (
                    <View style={styles.replyPhotoRow}>
                      <Ionicons name="bag-handle" size={12} color={theme.accent} />
                      <Text style={[styles.replyText, { fontFamily: fontFamily.regular }]}>
                        {' '}{repliedMessage.product_context.product_name || repliedMessage.product_context.item_name}
                      </Text>
                    </View>
                  ) : repliedMessage.text ? (
                    <Text numberOfLines={1} style={[styles.replyText, { fontFamily: fontFamily.regular }]}>
                      {repliedMessage.text}
                    </Text>
                  ) : repliedMessage.messages_image_url ? (
                    <View style={styles.replyPhotoRow}>
                      <Ionicons name="image" size={12} color={theme.textSecondary} />
                      <Text style={[styles.replyText, { fontFamily: fontFamily.regular }]}> Photo</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            )}

            {isPurchaseConfirmation && item.product_context ? (
              <PurchaseConfirmationCard
                product={item.product_context}
                theme={theme}
                styles={styles}
                onLongPress={() => onReply(item)}
              />
            ) : isProductMessage ? (
              <ProductMessageCard
                product={item.product_context}
                isMine={isMine}
                theme={theme}
                styles={styles}
                onCheckout={onProductCheckout}
                canCheckout={!isMine && user.email !== item.product_context.email}
                onLongPress={() => onReply(item)}
              />
            ) : (
              <View style={[
                styles.messageBubble, 
                isMine ? styles.myBubble : styles.otherBubble,
              ]}>
                {item.text ? (
                  <Text style={[styles.bubbleText, isMine && styles.myBubbleText, { fontFamily: fontFamily.regular }]}>
                    {item.text}
                  </Text>
                ) : null}
                
                {imageUrls.length > 0 && imageUrls.map((url, idx) => (
                  <TouchableOpacity key={idx} onPress={() => onImagePress(url)}>
                    <Image source={{ uri: url }} style={styles.messageImage} />
                  </TouchableOpacity>
                ))}

                <View style={styles.messageFooter}>
                  <Text style={[styles.messageTime, isMine && styles.myMessageTime, { fontFamily: fontFamily.medium }]}>
                    {formatMessageTime(item.created_at)}
                  </Text>
                  {isMine && (
                    <View style={styles.checkMarks}>
                      <Ionicons name="checkmark" size={12} color="rgba(255,255,255,0.9)" />
                      <Ionicons name="checkmark" size={12} color="rgba(255,255,255,0.9)" style={{ marginLeft: -6 }} />
                    </View>
                  )}
                </View>
              </View>
            )}
          </TouchableOpacity>

          {isMine && (
            <View style={styles.avatarContainer}>
              {showAvatar && avatarSource ? (
                <View style={styles.avatarWrapper}>
                  <Image source={{ uri: avatarSource }} style={styles.messageAvatar} />
                </View>
              ) : (
                <View style={styles.avatarSpacer} />
              )}
            </View>
          )}
        </View>
      </Swipeable>
    </Animated.View>
  );
};

export default function MessagingScreen({ route }) {
  const navigation = useNavigation();
  const receiverId = route?.params?.receiverId || 'receiver_user_email';
  const { receiverName, productToSend } = route?.params || {};
  const user = auth.currentUser;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState(null);

  const [receiverAvatar, setReceiverAvatar] = useState(null);
  const [userAvatar, setUserAvatar] = useState(null);
  const [activeProduct, setActiveProduct] = useState(productToSend || null);
  const [buyerName, setBuyerName] = useState('');
  const [productSent, setProductSent] = useState(false);

  const [selectedImage, setSelectedImage] = useState(null);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);

  const [isTyping, setIsTyping] = useState(false);
  const typingDotAnim = useRef(new Animated.Value(0)).current;

  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;
  const styles = createStyles(theme);

  const flatListRef = useRef(null);
  const isMounted = useRef(true);

  // Fetch avatars
  useEffect(() => {
    const fetchAvatars = async () => {
      if (!user?.email || !receiverId) return;

      const { data: receiverData } = await supabase
        .from('users')
        .select('profile_photo')
        .eq('email', receiverId)
        .single();
      if (receiverData?.profile_photo && isMounted.current) {
        setReceiverAvatar(receiverData.profile_photo);
      }

      const { data: userData } = await supabase
        .from('users')
        .select('profile_photo')
        .eq('email', user.email)
        .single();
      if (userData?.profile_photo && isMounted.current) {
        setUserAvatar(userData.profile_photo);
      }
    };

    fetchAvatars();
  }, [user, receiverId]);

  useEffect(() => {
    const fetchBuyerName = async () => {
      if (!user?.email) return;
      const { data, error } = await supabase
        .from("users")
        .select("name")
        .eq("email", user.email)
        .single();
      if (!error && data && isMounted.current) setBuyerName(data.name);
    };
    fetchBuyerName();
  }, [user]);

  useEffect(() => {
    if (isTyping) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingDotAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(typingDotAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isTyping]);

  const showMessageOptions = (message) => {
    setSelectedMessage(message);
    setOptionsVisible(true);
  };

  const handleUnsend = async () => {
    if (!selectedMessage) return;

    if (selectedMessage.sender_id !== user.email) {
      Alert.alert('Cannot unsend', 'You can only unsend your own messages.');
      setOptionsVisible(false);
      return;
    }

    const { error } = await supabase
      .from('messages')
      .update({ text: 'Message unsent', messages_image_url: null })
      .eq('id', selectedMessage.id);

    if (!error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === selectedMessage.id
            ? { ...m, text: 'Message unsent', messages_image_url: null }
            : m
        )
      );
    } else {
      Alert.alert('Error', 'Failed to unsend the message.');
    }

    setOptionsVisible(false);
  };

  const handleReply = (message) => {
    setReplyTo(message);
  };

  const cancelReply = () => setReplyTo(null);

  useEffect(() => {
    if (!user?.email || !receiverId) return;

    console.log('📨 [MessagingScreen] Setting up message subscription');

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.email},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.email})`
        )
        .order('created_at', { ascending: true });

      if (!error && isMounted.current) {
        console.log('✅ [MessagingScreen] Loaded', data?.length || 0, 'messages');
        setMessages(data || []);
      } else if (error) {
        console.error("❌ [MessagingScreen] Error fetching messages:", error);
      }
    };

    fetchMessages();

    const channel = supabase
      .channel(`messages-${user.email}-${receiverId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          console.log('🔔 [MessagingScreen] New message received:', payload.new);
          
          const isForThisConversation = 
            (payload.new.sender_id === user.email && payload.new.receiver_id === receiverId) ||
            (payload.new.sender_id === receiverId && payload.new.receiver_id === user.email);
          
          if (isForThisConversation && isMounted.current) {
            setMessages((prev) => {
              if (prev.some(m => m.id === payload.new.id)) {
                console.log('⚠️ [MessagingScreen] Duplicate message ID, skipping');
                return prev;
              }
              
              const hasTempMatch = prev.some(m => 
                m.id && typeof m.id === 'string' && m.id.startsWith('temp-') &&
                m.message_type === payload.new.message_type &&
                Math.abs(new Date(m.created_at) - new Date(payload.new.created_at)) < 2000
              );
              
              if (hasTempMatch) {
                console.log('⚠️ [MessagingScreen] Temp message already exists, skipping');
                return prev;
              }
              
              console.log('✅ [MessagingScreen] Adding new message to state');
              return [...prev, payload.new];
            });
            
            setTimeout(() => {
              if (flatListRef.current && isMounted.current) {
                flatListRef.current.scrollToEnd({ animated: true });
              }
            }, 100);
          } else {
            console.log('⚠️ [MessagingScreen] Message not for this conversation, ignoring');
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          console.log('🔄 [MessagingScreen] Message updated:', payload.new);
          if (isMounted.current) {
            setMessages((prev) =>
              prev.map((m) => (m.id === payload.new.id ? payload.new : m))
            );
          }
        }
      )
      .subscribe((status) => {
        console.log('🔌 [MessagingScreen] Subscription status:', status);
      });

    return () => {
      console.log('🧹 [MessagingScreen] Cleaning up subscription');
      isMounted.current = false;
      supabase.removeChannel(channel);
    };
  }, [user?.email, receiverId]);

  useEffect(() => {
    if (messages.length > 0 && flatListRef.current && isMounted.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'We need access to your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const uris = result.assets.map((asset) => asset.uri);
      setImages((prev) => [...prev, ...uris]);
    }
  };

  const uploadImagesToSupabase = async (uris) => {
    try {
      setUploading(true);
      const uploadedUrls = [];

      for (const uri of uris) {
        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();
        const fileExt = uri.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `inbox/${fileName}`;
        const mimeType = response.headers.get('content-type') || 'image/jpeg';

        const { error: uploadError } = await supabase.storage
          .from('inbox-images')
          .upload(filePath, arrayBuffer, { contentType: mimeType, upsert: false });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('inbox-images')
          .getPublicUrl(filePath);

        if (data?.publicUrl) uploadedUrls.push(data.publicUrl);
      }

      return uploadedUrls;
    } catch (error) {
      console.error('Upload failed:', error.message);
      Alert.alert('Upload failed', 'Could not upload image(s).');
      return [];
    } finally {
      setUploading(false);
    }
  };

  const sendProductMessage = async () => {
    if (!activeProduct || productSent || !user) return;

    const tempId = `temp-product-${Date.now()}`;

    const optimisticMessage = {
      id: tempId,
      sender_id: user.email,
      receiver_id: receiverId,
      text: null,
      messages_image_url: null,
      reply_to: null,
      created_at: new Date().toISOString(),
      message_type: 'product',
      product_context: activeProduct,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setProductSent(true);

    const { data: insertedMessage, error } = await supabase
      .from('messages')
      .insert([{
        sender_id: user.email,
        receiver_id: receiverId,
        text: null,
        messages_image_url: null,
        reply_to: null,
        message_type: 'product',
        product_context: activeProduct,
      }])
      .select()
      .single();

    if (!error && insertedMessage) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? insertedMessage : m))
      );

      await sendMessageNotification({
        senderEmail: user.email,
        receiverEmail: receiverId,
        messageText,
        hasImages,
      });

    } else if (error) {
      console.error('❌ Send message error:', error.message);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      Alert.alert('Error', 'Failed to send message.');
    }
  };

  const onProductCheckout = async (product) => {
    const productName = product.product_name || product.item_name;
    const productImage = product.product_image_url || product.rental_item_image;

    Alert.alert(
      "Confirm Purchase",
      `Do you want to buy "${productName}" for ₱${product.price}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Buy Now",
          onPress: async () => {
            console.log('🛒 [Checkout] Starting checkout process...');
            const success = await handleDirectCheckout(product, user, buyerName);
            
            if (success) {
              console.log('✅ [Checkout] Order placed successfully');
              Alert.alert("Success!", "Your order has been placed.");
              
              const confirmationText = `✅ I have successfully purchased "${productName}" for ₱${product.price}`;
              const tempId = `temp-confirmation-${Date.now()}`;

              console.log('💬 [Checkout] Creating confirmation message...');

              const optimisticMessage = {
                id: tempId,
                sender_id: user.email,
                receiver_id: receiverId,
                text: confirmationText,
                messages_image_url: null,
                reply_to: null,
                created_at: new Date().toISOString(),
                message_type: 'purchase_confirmation',
                product_context: product,
              };

              console.log('⚡ [Checkout] Adding optimistic message to UI');
              setMessages((prev) => {
                const newMessages = [...prev, optimisticMessage];
                console.log('📊 [Checkout] Total messages:', newMessages.length);
                return newMessages;
              });

              setTimeout(() => {
                if (flatListRef.current) {
                  flatListRef.current.scrollToEnd({ animated: true });
                }
              }, 100);

              console.log('💾 [Checkout] Inserting to database...');
              const { data: insertedMessage, error: msgError } = await supabase
                .from('messages')
                .insert({
                  sender_id: user.email,
                  receiver_id: receiverId,
                  text: confirmationText,
                  message_type: 'purchase_confirmation',
                  product_context: product,
                })
                .select()
                .single();

              if (!msgError && insertedMessage) {
                console.log('✅ [Checkout] Message saved to database:', insertedMessage.id);
                setMessages((prev) =>
                  prev.map((m) => (m.id === tempId ? insertedMessage : m))
                );
              } else if (msgError) {
                console.error('❌ [Checkout] Failed to save message:', msgError);
                console.log('⚠️ [Checkout] Keeping optimistic message despite DB error');
              }

              try {
                console.log('📧 [Checkout] Sending notifications...');
                const { data: buyerData } = await supabase
                  .from('users')
                  .select('name')
                  .eq('email', user.email)
                  .maybeSingle();

                const buyerDisplayName = buyerData?.name || user.email;

                const { data: sellerData } = await supabase
                  .from('users')
                  .select('name')
                  .eq('email', receiverId)
                  .maybeSingle();

                const sellerDisplayName = sellerData?.name || receiverId;

                await sendPurchaseNotification({
                  buyerId: user.email,
                  sellerId: receiverId,
                  buyerName: buyerDisplayName,
                  productName: productName,
                  productPrice: product.price,
                  productId: product.id,
                  productImage: productImage,
                });

                await sendSaleConfirmationNotification({
                  buyerId: user.email,
                  sellerId: receiverId,
                  sellerName: sellerDisplayName,
                  productName: productName,
                  productPrice: product.price,
                  productId: product.id,
                  productImage: productImage,
                });

                console.log('✅ [Checkout] Notifications sent');

              } catch (notifError) {
                console.error('❌ [Checkout] Notification error:', notifError);
              }
            } else {
              console.error('❌ [Checkout] Order failed');
              Alert.alert('Error', 'Purchase failed. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleQuickCheckout = async () => {
    if (!activeProduct || !user) return;

    const product = activeProduct;
    const productName = product.product_name || product.item_name;
    const productImage = product.product_image_url || product.rental_item_image;

    Alert.alert(
      "Confirm Purchase",
      `Do you want to buy "${productName}" for ₱${product.price}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Buy Now",
          onPress: async () => {
            const success = await handleDirectCheckout(product, user, buyerName);
            
            if (success) {
              Alert.alert("Success!", "Your order has been placed.");
              
              const confirmationText = `✅ I have successfully purchased "${productName}" for ₱${product.price}`;
              const tempId = `temp-confirmation-${Date.now()}`;

              const optimisticMessage = {
                id: tempId,
                sender_id: user.email,
                receiver_id: receiverId,
                text: confirmationText,
                messages_image_url: null,
                reply_to: null,
                created_at: new Date().toISOString(),
                message_type: 'purchase_confirmation',
                product_context: product,
              };

              setMessages((prev) => [...prev, optimisticMessage]);

              setTimeout(() => {
                if (flatListRef.current) {
                  flatListRef.current.scrollToEnd({ animated: true });
                }
              }, 100);

              const { data: insertedMessage, error: msgError } = await supabase
                .from('messages')
                .insert({
                  sender_id: user.email,
                  receiver_id: receiverId,
                  text: confirmationText,
                  message_type: 'purchase_confirmation',
                  product_context: product,
                })
                .select()
                .single();

              if (!msgError && insertedMessage) {
                setMessages((prev) =>
                  prev.map((m) => (m.id === tempId ? insertedMessage : m))
                );
              } else if (msgError) {
                console.error('❌ Failed to send confirmation:', msgError);
              }

              try {
                const { data: buyerData } = await supabase
                  .from('users')
                  .select('name')
                  .eq('email', user.email)
                  .maybeSingle();

                const buyerDisplayName = buyerData?.name || user.email;

                const { data: sellerData } = await supabase
                  .from('users')
                  .select('name')
                  .eq('email', receiverId)
                  .maybeSingle();

                const sellerDisplayName = sellerData?.name || receiverId;

                await sendPurchaseNotification({
                  buyerId: user.email,
                  sellerId: receiverId,
                  buyerName: buyerDisplayName,
                  productName: productName,
                  productPrice: product.price,
                  productId: product.id,
                  productImage: productImage,
                });

                await sendSaleConfirmationNotification({
                  buyerId: user.email,
                  sellerId: receiverId,
                  sellerName: sellerDisplayName,
                  productName: productName,
                  productPrice: product.price,
                  productId: product.id,
                  productImage: productImage,
                });

              } catch (notifError) {
                console.error('Error sending notifications:', notifError);
              }

              setActiveProduct(null);
              setProductSent(false);
            } else {
              Alert.alert('Error', 'Purchase failed. Please try again.');
            }
          },
        },
      ]
    );
  };

  const sendMessage = async () => {
  if ((!input.trim() && images.length === 0) || !user) return;

  const messageText = input.trim() || null;
  const tempId = `temp-${Date.now()}`;

  const optimisticMessage = {
    id: tempId,
    sender_id: user.email,
    receiver_id: receiverId,
    text: messageText,
    messages_image_url: null,
    reply_to: replyTo ? replyTo.id : null,
    created_at: new Date().toISOString(),
    message_type: 'text',
    product_context: null,
  };

  setMessages((prev) => [...prev, optimisticMessage]);
  setInput('');
  setReplyTo(null);

  let imageUrls = [];
  if (images.length > 0) {
    imageUrls = await uploadImagesToSupabase(images);
    setImages([]);
  }

  const hasImages = imageUrls.length > 0;

  const { data: insertedMessage, error } = await supabase
    .from('messages')
    .insert([
      {
        sender_id: user.email,
        receiver_id: receiverId,
        text: messageText,
        product_context: null,
        message_type: 'text',
        messages_image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
        reply_to: replyTo ? replyTo.id : null,
      },
    ])
    .select()
    .single();

  if (!error && insertedMessage) {
    setMessages((prev) =>
      prev.map((m) => (m.id === tempId ? insertedMessage : m))
    );

    await sendMessageNotification({
      senderEmail: user.email,
      receiverEmail: receiverId,
      messageText,
      hasImages,
    });

  } else if (error) {
    console.error('❌ Send message error:', error.message);
    setMessages((prev) => prev.filter((m) => m.id !== tempId));
    Alert.alert('Error', 'Failed to send message.');
  }
};
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const renderItem = ({ item, index }) => {
    return (
      <MessageItem
        item={item}
        index={index}
        messages={messages}
        user={user}
        receiverName={receiverName}
        userAvatar={userAvatar}
        receiverAvatar={receiverAvatar}
        onReply={handleReply}
        onLongPress={showMessageOptions}
        onImagePress={setSelectedImage}
        onProductCheckout={onProductCheckout}
        theme={theme}
        styles={styles}
      />
    );
  };

  return (
    <>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
        translucent={false}
      />
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* 🎨 MODERN HEADER (Matches NotificationScreen) */}
          <View style={styles.header}>
            <View style={styles.headerBackground}>
              <View style={styles.gradientOverlay} />
            </View>

            <View style={styles.headerContent}>
              <TouchableOpacity 
                onPress={() => navigation.goBack()} 
                style={styles.backButton}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={22} color={theme.text} />
              </TouchableOpacity>
              
              <View style={styles.headerUser}>
                <View style={styles.headerAvatarWrapper}>
                  {receiverAvatar ? (
                    <Image source={{ uri: receiverAvatar }} style={styles.headerAvatar} />
                  ) : (
                    <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
                      <Ionicons name="person" size={22} color={theme.textSecondary} />
                    </View>
                  )}
                  <View style={styles.onlineDot} />
                </View>
                <View style={styles.headerTextContainer}>
                  <Text style={[styles.headerName, { fontFamily: fontFamily.bold }]}>{receiverName || 'User'}</Text>
                  <View style={styles.statusRow}>
                    <View style={styles.statusPulse} />
                    <Text style={[styles.statusText, { fontFamily: fontFamily.medium }]}>Active now</Text>
                  </View>
                </View>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('ReportScreen', {
                      reported_student_id: receiverId,
                      reported_name: receiverName,
                    })
                  }
                  style={styles.headerIconButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="flag" size={18} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* 📦 PRODUCT CONTEXT BAR */}
          {activeProduct && (
            <View style={styles.productContextBar}>
              <View style={styles.productContextGlow} />
              <View style={styles.productContextContent}>
                <View style={styles.productContextInfo}>
                  <View style={styles.productContextIcon}>
                    <Ionicons name="bag-handle" size={18} color="#fff" />
                  </View>
                  <View style={styles.productContextText}>
                    <Text style={[styles.productContextLabel, { fontFamily: fontFamily.bold }]}>Product Selected</Text>
                    <Text style={[styles.productContextName, { fontFamily: fontFamily.semiBold }]} numberOfLines={1}>
                      {activeProduct.product_name || activeProduct.item_name}
                    </Text>
                  </View>
                </View>

                <View style={styles.productContextActions}>
                  {!productSent && (
                    <TouchableOpacity
                      style={styles.productInfoButton}
                      onPress={sendProductMessage}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="send" size={14} color="#fff" />
                      <Text style={[styles.productInfoButtonText, { fontFamily: fontFamily.bold }]}>Send Info</Text>
                    </TouchableOpacity>
                  )}

                  {!activeProduct.rental_duration && (
                    <TouchableOpacity
                      style={styles.productCheckoutButton}
                      onPress={handleQuickCheckout}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="cart" size={14} color="#fff" />
                      <Text style={[styles.productCheckoutButtonText, { fontFamily: fontFamily.bold }]}>Checkout</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.dismissContextButton}
                  onPress={() => {
                    setActiveProduct(null);
                    setProductSent(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 💬 MESSAGES LIST */}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderItem}
            keyExtractor={(item) => item.id?.toString()}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToEnd({ animated: true });
              }
            }}
          />

          {/* ⌨️ TYPING INDICATOR */}
          {isTyping && (
            <View style={styles.typingContainer}>
              <Image 
                source={{ uri: receiverAvatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }} 
                style={styles.typingAvatar} 
              />
              <View style={styles.typingBubble}>
                <Animated.View style={[styles.typingDot, { opacity: typingDotAnim }]} />
                <Animated.View style={[styles.typingDot, { opacity: typingDotAnim }]} />
                <Animated.View style={[styles.typingDot, { opacity: typingDotAnim }]} />
              </View>
            </View>
          )}

          {/* 📝 REPLY PREVIEW */}
          {replyTo && (
            <View style={styles.replyPreviewBar}>
              <View style={styles.replyPreviewGlow} />
              <View style={styles.replyPreviewIndicator} />
              <View style={styles.replyPreviewContent}>
                <Text style={[styles.replyPreviewLabel, { fontFamily: fontFamily.bold }]}>
                  Replying to {replyTo.sender_id === user.email ? 'yourself' : receiverName}
                </Text>
                
                {replyTo.message_type === 'product' && replyTo.product_context ? (
                  <View style={styles.replyProductRow}>
                    <Ionicons name="bag-handle" size={12} color={theme.accent} />
                    <Text style={[styles.replyPreviewText, { fontFamily: fontFamily.regular }]} numberOfLines={1}>
                      {' '}{replyTo.product_context.product_name || replyTo.product_context.item_name}
                    </Text>
                  </View>
                ) : replyTo.text ? (
                  <Text numberOfLines={1} style={[styles.replyPreviewText, { fontFamily: fontFamily.regular }]}>
                    {replyTo.text}
                  </Text>
                ) : replyTo.messages_image_url ? (
                  <View style={styles.replyPhotoRow}>
                    <Ionicons name="image" size={12} color={theme.textSecondary} />
                    <Text style={[styles.replyPreviewText, { fontFamily: fontFamily.regular }]}> Photo</Text>
                  </View>
                ) : null}
              </View>
              <TouchableOpacity onPress={cancelReply} style={styles.replyPreviewClose}>
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* 🖼️ IMAGE PREVIEW */}
          {images.length > 0 && (
            <View style={styles.imagePreviewSection}>
              <FlatList
                horizontal
                data={images}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item, index }) => (
                  <View style={styles.previewImageWrapper}>
                    <Image source={{ uri: item }} style={styles.previewImage} />
                    <View style={styles.previewImageOverlay} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => setImages(images.filter((_, i) => i !== index))}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close-circle" size={24} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
                showsHorizontalScrollIndicator={false}
              />
            </View>
          )}

          {/* ⌨️ INPUT BAR (FIXED - No longer overlaps with keyboard) */}
          <View style={styles.inputBar}>
            <View style={styles.inputBarGlow} />
            <TouchableOpacity 
              onPress={pickImage} 
              style={styles.attachButton}
              activeOpacity={0.7}
            >
              <View style={styles.attachButtonGradient}>
                <Ionicons name="image" size={22} color={theme.accent} />
              </View>
            </TouchableOpacity>

            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.textInput, { fontFamily: fontFamily.regular }]}
                value={input}
                onChangeText={setInput}
                placeholder={uploading ? 'Uploading...' : 'Type a message...'}
                placeholderTextColor={theme.textTertiary}
                editable={!uploading}
                multiline
                maxLength={500}
              />
            </View>

            <TouchableOpacity
              onPress={sendMessage}
              style={[
                styles.sendButton,
                (uploading || (!input.trim() && images.length === 0)) && styles.sendButtonDisabled
              ]}
              disabled={uploading || (!input.trim() && images.length === 0)}
              activeOpacity={0.85}
            >
              <View style={styles.sendButtonInner}>
                <Ionicons name="send" size={18} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>

          {/* 🖼️ IMAGE MODAL */}
          <Modal visible={!!selectedImage} transparent onRequestClose={() => setSelectedImage(null)}>
            <View style={styles.imageModal}>
              <TouchableOpacity 
                style={styles.modalCloseButton} 
                onPress={() => setSelectedImage(null)}
                activeOpacity={0.8}
              >
                <View style={styles.modalCloseInner}>
                  <Ionicons name="close" size={26} color="#fff" />
                </View>
              </TouchableOpacity>
              <Image 
                source={{ uri: selectedImage }} 
                style={styles.modalImage} 
                resizeMode="contain" 
              />
            </View>
          </Modal>

          {/* ⚙️ OPTIONS MODAL */}
          <Modal transparent visible={optionsVisible} animationType="fade">
            <TouchableOpacity
              style={styles.optionsModalOverlay}
              activeOpacity={1}
              onPress={() => setOptionsVisible(false)}
            >
              <View style={styles.optionsModalContent}>
                <View style={styles.optionsHandle} />
                
                <TouchableOpacity
                  onPress={() => {
                    handleReply(selectedMessage);
                    setOptionsVisible(false);
                  }}
                  style={styles.optionItem}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionIconContainer}>
                    <Ionicons name="arrow-undo" size={20} color={theme.accent} />
                  </View>
                  <Text style={[styles.optionLabel, { fontFamily: fontFamily.bold }]}>Reply</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
                </TouchableOpacity>

                {selectedMessage?.sender_id === user.email && (
                  <TouchableOpacity 
                    onPress={handleUnsend} 
                    style={styles.optionItem}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.optionIconContainer, styles.optionIconDanger]}>
                      <Ionicons name="trash" size={20} color="#FF3B30" />
                    </View>
                    <Text style={[styles.optionLabel, styles.optionLabelDanger, { fontFamily: fontFamily.bold }]}>Unsend</Text>
                    <Ionicons name="chevron-forward" size={16} color="#FF3B30" />
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  onPress={() => setOptionsVisible(false)} 
                  style={[styles.optionItem, styles.optionItemCancel]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionLabelCancel, { fontFamily: fontFamily.bold }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

// 🎨 MODERN THEMES (Matching NotificationScreen)
const darkTheme = {
  background: '#0a0e27',
  cardBackground: '#141b3c',
  text: '#ffffff',
  textSecondary: '#a8b2d1',
  textTertiary: '#6b7280',
  myBubble: '#0084ff',
  otherBubble: '#1e2544',
  accent: '#FDAD00',
  success: '#10b981',
  error: '#FF3B30',
  border: '#252b47',
  borderColor: '#252b47',
  inputBackground: '#1e2544',
  replyLine: '#0084ff',
  swipeBackground: '#3b82f6',
  shadowColor: '#000',
  headerBackground: '#141b3c',
  gradientBackground: '#141b3c',
};

const lightTheme = {
  background: '#f8fafc',
  cardBackground: '#ffffff',
  text: '#1e293b',
  textSecondary: '#64748b',
  textTertiary: '#94a3b8',
  myBubble: '#0084ff',
  otherBubble: '#f1f5f9',
  accent: '#FDAD00',
  success: '#10b981',
  error: '#FF3B30',
  border: '#e2e8f0',
  borderColor: '#e2e8f0',
  inputBackground: '#f1f5f9',
  replyLine: '#0084ff',
  swipeBackground: '#3b82f6',
  shadowColor: '#000',
  headerBackground: '#ffffff',
  gradientBackground: '#ffffff',
};

const createStyles = (theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  container: { 
    flex: 1, 
    backgroundColor: theme.background,
  },
  
  // 🎨 MODERN HEADER (Matches NotificationScreen)
  header: { 
    backgroundColor: theme.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    position: 'relative',
  },
  headerBackground: {
    height: 45,
    backgroundColor: theme.headerBackground,
    overflow: 'hidden',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.05,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  headerUser: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerAvatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  headerAvatar: { 
    width: 44, 
    height: 44, 
    borderRadius: 22,
    borderWidth: 2,
    borderColor: theme.border,
  },
  headerAvatarPlaceholder: {
    backgroundColor: theme.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.success,
    borderWidth: 2,
    borderColor: theme.cardBackground,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerName: { 
    fontSize: 17, 
    color: theme.text,
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  statusPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.success,
    marginRight: 6,
  },
  statusText: { 
    fontSize: 12, 
    color: theme.textSecondary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },

  // 📦 PRODUCT CONTEXT BAR
  productContextBar: {
    backgroundColor: theme.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    paddingHorizontal: 20,
    paddingVertical: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  productContextGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: theme.accent,
    opacity: 0.6,
  },
  productContextContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  productContextInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  productContextIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  productContextText: {
    flex: 1,
  },
  productContextLabel: {
    fontSize: 10,
    color: theme.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  productContextName: {
    fontSize: 14,
    color: theme.text,
    letterSpacing: -0.2,
  },
  productContextActions: {
    flexDirection: 'row',
    gap: 8,
  },
  productInfoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  productInfoButtonText: {
    fontSize: 12,
    color: '#fff',
  },
  productCheckoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.success,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    shadowColor: theme.success,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  productCheckoutButtonText: {
    fontSize: 12,
    color: '#fff',
  },
  dismissContextButton: {
    width: 36,
    height:36,
    borderRadius: 18,
    backgroundColor: theme.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // 💬 MESSAGES LIST
  messagesList: { 
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 8,
  },
  messageWrapper: { 
    flexDirection: 'row', 
    alignItems: 'flex-end',
    marginVertical: 3,
  },
  myWrapper: { 
    justifyContent: 'flex-end',
  },
  otherWrapper: { 
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 32,
    marginHorizontal: 6,
  },
  avatarWrapper: {
    position: 'relative',
  },
  messageAvatar: { 
    width: 32, 
    height: 32, 
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.border,
  },
  avatarSpacer: {
    width: 32,
    height: 32,
  },
  messageContentWrapper: {
    maxWidth: '75%',
  },

  // 💬 MESSAGE BUBBLES (Modern Design)
  messageBubble: { 
    paddingHorizontal: 16, 
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  myBubble: { 
    backgroundColor: theme.myBubble,
    borderBottomRightRadius: 6,
  },
  otherBubble: { 
    backgroundColor: theme.otherBubble,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: theme.border,
  },
  bubbleText: { 
    fontSize: 15, 
    color: theme.text,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  myBubbleText: {
    color: '#ffffff',
  },
  messageImage: { 
    width: 240, 
    height: 240, 
    borderRadius: 16, 
    marginTop: 8,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  messageTime: {
    fontSize: 11,
    color: theme.textTertiary,
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.75)',
  },
  checkMarks: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // 🎁 PRODUCT MESSAGE CARD
  productMessageCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: theme.border,
    minWidth: 280,
    maxWidth: 300,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  productMessageCardMine: {
    borderColor: `${theme.myBubble}40`,
  },
  productCardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: theme.accent,
  },
  productMessageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    gap: 8,
  },
  productBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productMessageHeaderText: {
    fontSize: 11,
    color: theme.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    flex: 1,
  },
  productMessageContent: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  productImageWrapper: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 12,
  },
  productMessageImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: theme.inputBackground,
  },
  productImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  productMessageInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  productMessageName: {
    fontSize: 15,
    color: theme.text,
    lineHeight: 20,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 6,
  },
  productMessagePrice: {
    fontSize: 18,
    color: theme.accent,
    letterSpacing: -0.3,
  },
  productMessageDuration: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  productMessageConditionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: `${theme.success}20`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  conditionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.success,
  },
  productMessageConditionText: {
    fontSize: 11,
    color: theme.success,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productMessageCheckoutBtn: {
    overflow: 'hidden',
    borderRadius: 12,
    shadowColor: theme.success,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  checkoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.success,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
  },
  productMessageCheckoutText: {
    fontSize: 14,
    color: '#fff',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // 🎉 PURCHASE CONFIRMATION CARD
  purchaseConfirmationCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 18,
    padding: 14,
    borderWidth: 2,
    borderColor: '#10B981',
    minWidth: 280,
    maxWidth: 300,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  purchaseCardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#10B981',
  },
  purchaseConfirmationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: `${theme.border}80`,
    gap: 8,
  },
  purchaseSuccessBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  purchaseConfirmationHeaderText: {
    fontSize: 11,
    color: '#10B981',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    flex: 1,
  },
  purchaseSparkle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: `${theme.success}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  purchaseMessageContent: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  purchaseImageWrapper: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  purchaseMessageImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: theme.inputBackground,
  },
  purchaseImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  purchaseImageBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  purchaseMessageInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  purchaseMessageName: {
    fontSize: 15,
    color: theme.text,
    lineHeight: 20,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  purchasePriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 8,
  },
  purchaseMessagePrice: {
    fontSize: 18,
    color: '#10B981',
    letterSpacing: -0.3,
  },
  purchaseStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: `${theme.success}20`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  purchaseStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  purchaseStatusText: {
    fontSize: 11,
    color: '#10B981',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  purchaseSuccessFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${theme.success}15`,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  purchaseSuccessFooterText: {
    fontSize: 12,
    color: theme.text,
    flex: 1,
    lineHeight: 16,
  },

  // 📝 REPLY INDICATOR
  replyIndicator: { 
    backgroundColor: theme.otherBubble,
    borderLeftWidth: 3, 
    borderLeftColor: theme.replyLine,
    padding: 10,
    borderRadius: 12,
    marginBottom: 6,
    flexDirection: 'row',
  },
  replyIndicatorMine: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  replyLine: {
    width: 3,
    backgroundColor: theme.replyLine,
    borderRadius: 2,
    marginRight: 10,
  },
  replyContent: {
    flex: 1,
  },
  replyLabel: { 
    fontSize: 12, 
    color: theme.accent,
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  replyText: { 
    fontSize: 13, 
    color: theme.textSecondary,
  },
  replyPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // ⌨️ TYPING INDICATOR
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 26,
    paddingVertical: 10,
  },
  typingAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  typingBubble: {
    flexDirection: 'row',
    backgroundColor: theme.otherBubble,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 5,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.textTertiary,
  },

  // 📝 REPLY PREVIEW BAR
  replyPreviewBar: { 
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    position: 'relative',
    overflow: 'hidden',
  },
  replyPreviewGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: theme.accent,
  },
  replyPreviewIndicator: {
    width: 3,
    height: 40,
    backgroundColor: theme.accent,
    borderRadius: 2,
    marginRight: 14,
  },
  replyPreviewContent: { 
    flex: 1,
  },
  replyPreviewLabel: { 
    fontSize: 12, 
    color: theme.accent,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  replyPreviewText: { 
    fontSize: 14, 
    color: theme.textSecondary,
  },
  replyPreviewClose: {
    padding: 6,
    marginLeft: 10,
    borderRadius: 10,
    backgroundColor: theme.inputBackground,
  },

  // 🖼️ IMAGE PREVIEW SECTION
  imagePreviewSection: {
    backgroundColor: theme.cardBackground,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  previewImageWrapper: {
    position: 'relative',
    marginRight: 12,
    overflow: 'hidden',
    borderRadius: 14,
  },
  previewImage: {
    width: 90,
    height: 90,
    borderRadius: 14,
  },
  previewImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  removeImageButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: theme.error,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },

  // ⌨️ INPUT BAR (FIXED - No keyboard overlap)
  inputBar: { 
    flexDirection: 'row', 
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.cardBackground,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  inputBarGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: theme.accent,
    opacity: 0.3,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 10,
  },
  attachButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: theme.inputBackground,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  textInput: { 
    fontSize: 15,
    color: theme.text,
    maxHeight: 100,
    letterSpacing: -0.1,
  },
  sendButton: { 
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    marginLeft: 10,
  },
  sendButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },

  // 👆 SWIPE ACTIONS
  swipeAction: { 
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    marginVertical: 3,
  },
  swipeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.swipeBackground,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.swipeBackground,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },

  // 🖼️ IMAGE MODAL
  imageModal: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.96)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: { 
    width: '100%', 
    height: '100%',
  },
  modalCloseButton: { 
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
  },
  modalCloseInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  // ⚙️ OPTIONS MODAL (Matching NotificationScreen)
  optionsModalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  optionsModalContent: { 
    backgroundColor: theme.cardBackground,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  optionsHandle: {
    width: 40,
    height: 5,
    backgroundColor: theme.border,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 24,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: theme.inputBackground,
    borderWidth: 1,
    borderColor: theme.border,
  },
  optionItemCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.border,
    marginTop: 8,
  },
  optionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${theme.accent}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionIconDanger: {
    backgroundColor: `${theme.error}20`,
  },
  optionLabel: { 
    fontSize: 16,
    color: theme.text,
    flex: 1,
    letterSpacing: -0.2,
  },
  optionLabelDanger: {
    color: theme.error,
  },
  optionLabelCancel: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    flex: 1,
    letterSpacing: -0.2,
  },
});