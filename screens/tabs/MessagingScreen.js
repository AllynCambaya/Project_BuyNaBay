// screens/MessagingScreen.js
import { FontAwesome as Icon } from '@expo/vector-icons';
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
import { handleDirectCheckout } from './CartScreen';

const { width, height } = Dimensions.get('window');

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

  const [selectedImage, setSelectedImage] = useState(null);

  // --- Long press options ---
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);

  // Typing indicator
  const [isTyping, setIsTyping] = useState(false);
  const typingDotAnim = useRef(new Animated.Value(0)).current;

  // Automatically detect system theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';

  // Get current theme colors based on system settings
  const theme = isDarkMode ? darkTheme : lightTheme;
  const styles = createStyles(theme);

  const flatListRef = useRef(null);

  // Fetch avatars
  useEffect(() => {
    const fetchAvatars = async () => {
      if (!user?.email || !receiverId) return;

      // Fetch receiver avatar
      const { data: receiverData } = await supabase
        .from('users')
        .select('profile_photo')
        .eq('email', receiverId)
        .single();
      if (receiverData?.profile_photo) {
        setReceiverAvatar(receiverData.profile_photo);
      }

      // Fetch current user avatar
      const { data: userData } = await supabase
        .from('users')
        .select('profile_photo')
        .eq('email', user.email)
        .single();
      if (userData?.profile_photo) {
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
      if (!error && data) setBuyerName(data.name);
    };
    fetchBuyerName();
  }, [user]);

  // Typing indicator animation
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

    // Only allow unsend if the message was sent by the current user
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

  // --- Fetch messages ---
  useEffect(() => {
    if (!user) return;

    // 1. Define the function to fetch messages
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*, product_context')
        .or(
          `and(sender_id.eq.${user.email},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.email})`
        )
        .order('created_at', { ascending: true });

      if (!error) {
        setMessages(data || []);
      } else {
        console.error("Error fetching messages:", error);
      }
    };

    // 2. Fetch messages when the screen loads
    fetchMessages();

    // 3. Set up the real-time subscription
    const channel = supabase
      .channel(`messages-${user.email}-${receiverId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchMessages)
      .subscribe();

    // 4. Return a cleanup function to remove the channel subscription when the component unmounts
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, receiverId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // --- Pick multiple images ---
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

  // --- Upload images ---
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

  // --- Send message ---
const sendMessage = async () => {
  if ((!input.trim() && images.length === 0) || !user) return;

  let imageUrls = [];
  if (images.length > 0) {
    imageUrls = await uploadImagesToSupabase(images);
  }

  const messageText = input.trim() || null;
  const hasImages = imageUrls.length > 0;

  // Insert the message
  const { error } = await supabase.from('messages').insert([
    {
      sender_id: user.email,
      receiver_id: receiverId,
      text: messageText,
      product_context: null,
      messages_image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
      reply_to: replyTo ? replyTo.id : null,
    },
  ]);

  if (!error) {
    setInput('');
    setImages([]);
    setReplyTo(null);

    // 🆕 SEND NOTIFICATION TO RECEIVER
    try {
      const { data: senderData } = await supabase
        .from('users')
        .select('name')
        .eq('email', user.email)
        .maybeSingle();

      const senderName = senderData?.name || user.email;

      let notificationMessage = '';
      if (hasImages && !messageText) {
        notificationMessage = `${senderName} sent you a photo`;
      } else if (hasImages && messageText) {
        notificationMessage = `${senderName} sent you a photo: ${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}`;
      } else if (messageText) {
        notificationMessage = `${senderName}: ${messageText.substring(0, 100)}${messageText.length > 100 ? '...' : ''}`;
      }

      await supabase.from('notifications').insert({
        sender_id: user.email,
        receiver_id: receiverId,
        title: 'New Message',
        message: notificationMessage,
        created_at: new Date().toISOString(),
      });
    } catch (notifError) {
      console.error('Error sending notification:', notifError);
    }
  } else {
    console.error('Send message error:', error.message);
  }
};

 const onProductCheckout = async (product) => {
  Alert.alert(
    "Confirm Checkout",
    `Do you want to buy "${product.product_name}" for ₱${product.price}?`,
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Checkout",
        onPress: async () => {
          const success = await handleDirectCheckout(product, user, buyerName);
          if (success) {
            Alert.alert("Success!", "Your order has been placed.");
            
            // Send confirmation message
            const confirmationText = `I have successfully purchased "${product.product_name}".`;
            await supabase.from('messages').insert({
              sender_id: user.email,
              receiver_id: receiverId,
              text: confirmationText,
            });

            // Send notification to seller
            try {
              const { data: buyerData } = await supabase
                .from('users')
                .select('name')
                .eq('email', user.email)
                .maybeSingle();

              const buyerName = buyerData?.name || user.email;

              await supabase
                .from('notifications')
                .insert({
                  sender_id: user.email,
                  receiver_id: receiverId,
                  title: 'Product Sold',
                  message: `${buyerName} purchased "${product.product_name}" for ₱${product.price}`,
                  created_at: new Date().toISOString(),
                });
            } catch (notifError) {
              console.error('Error sending purchase notification:', notifError);
            }
          }
        },
      },
    ]
  );
};
  // Format message time
  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Check if messages should be grouped
  const shouldGroupMessage = (currentMsg, prevMsg) => {
    if (!prevMsg) return false;
    if (currentMsg.sender_id !== prevMsg.sender_id) return false;
    
    const timeDiff = new Date(currentMsg.created_at) - new Date(prevMsg.created_at);
    return timeDiff < 60000; // Group if within 1 minute
  };

  // --- Render item with swipe & animated movement ---
  const renderItem = ({ item, index }) => {
    const isMine = item.sender_id === user.email;
    const avatarSource = isMine ? userAvatar : receiverAvatar;
    const isProductMessage = !!item.product_context;

    // Don't render empty messages unless they are product messages
    if (!item.text && !item.messages_image_url && !isProductMessage) return null;

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
    const isGrouped = shouldGroupMessage(item, prevMessage);
    const showAvatar = !isGrouped;

    return (
      <Swipeable
        friction={2}
        leftThreshold={50}
        rightThreshold={50}
        onSwipeableLeftOpen={() => handleReply(item)}
        onSwipeableRightOpen={() => handleReply(item)}
        renderLeftActions={(progress, dragX) => {
          const trans = dragX.interpolate({
            inputRange: [0, 100],
            outputRange: [-50, 0],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View style={[styles.swipeAction, { transform: [{ translateX: trans }] }]}>
              <View style={styles.swipeIconContainer}>
                <Icon name="reply" size={18} color="#fff" />
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
                <Icon name="reply" size={18} color="#fff" />
              </View>
            </Animated.View>
          );
        }}
      >
        <View style={[styles.messageWrapper, isMine ? styles.myWrapper : styles.otherWrapper]}>
          {/* Avatar (only show if not grouped) */}
          {!isMine && (
            <View style={styles.avatarContainer}>
              {showAvatar && avatarSource ? (
                <Image source={{ uri: avatarSource }} style={styles.messageAvatar} />
              ) : (
                <View style={styles.avatarSpacer} />
              )}
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.9}
            onLongPress={() => showMessageOptions(item)}
            style={styles.messageContentWrapper}
          >
            {/* Reply indicator */}
            {repliedMessage && (
              <View style={[styles.replyIndicator, isMine && styles.replyIndicatorMine]}>
                <View style={styles.replyLine} />
                <View style={styles.replyContent}>
                  <Text style={styles.replyLabel}>
                    {repliedMessage.sender_id === user.email ? 'You' : receiverName}
                  </Text>
                  {repliedMessage.text ? (
                    <Text numberOfLines={1} style={styles.replyText}>
                      {repliedMessage.text}
                    </Text>
                  ) : repliedMessage.messages_image_url ? (
                    <View style={styles.replyPhotoRow}>
                      <Icon name="camera" size={10} color={theme.textTertiary} />
                      <Text style={styles.replyText}> Photo</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            )}

            {/* Message bubble */}
            <View style={[styles.messageBubble, isMine ? styles.myBubble : styles.otherBubble]}>
              {item.text ? (
                <Text style={[styles.bubbleText, isMine && styles.myBubbleText]}>
                  {item.text}
                </Text>
              ) : null}
              
              {imageUrls.length > 0 && imageUrls.map((url, idx) => (
                <TouchableOpacity key={idx} onPress={() => setSelectedImage(url)}>
                  <Image source={{ uri: url }} style={styles.messageImage} />
                </TouchableOpacity>
              ))}

              {/* Timestamp */}
              <Text style={[styles.messageTime, isMine && styles.myMessageTime]}>
                {formatMessageTime(item.created_at)}
                {isMine && (
                  <Text style={styles.checkMark}> ✓✓</Text>
                )}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Avatar for sent messages */}
          {isMine && (
            <View style={styles.avatarContainer}>
              {showAvatar && avatarSource ? (
                <Image source={{ uri: avatarSource }} style={styles.messageAvatar} />
              ) : (
                <View style={styles.avatarSpacer} />
              )}
            </View>
          )}
        </View>
      </Swipeable>
    );
  };

  return (
    <>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
        translucent={false}
      />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <TouchableOpacity 
                onPress={() => navigation.goBack()} 
                style={styles.backButton}
                activeOpacity={0.7}
              >
                <Icon name="chevron-left" size={24} color={theme.text} />
              </TouchableOpacity>
              
              <View style={styles.headerUser}>
                {receiverAvatar ? (
                  <Image source={{ uri: receiverAvatar }} style={styles.headerAvatar} />
                ) : (
                  <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
                    <Icon name="user" size={20} color={theme.textSecondary} />
                  </View>
                )}
                <View style={styles.headerTextContainer}>
                  <Text style={styles.headerName}>{receiverName || 'User'}</Text>
                  <View style={styles.statusRow}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>Active now</Text>
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
                  <Icon name="flag" size={18} color={theme.error} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* FLOATING PRODUCT CARD */}
          {activeProduct && (
            <View style={styles.floatingProductCard}>
              <Image
                source={{
                  uri: (() => {
                    const imageUrl = activeProduct.product_image_url || activeProduct.rental_item_image;
                    if (!imageUrl) return null;
                    if (typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
                      return imageUrl;
                    }
                    return JSON.parse(imageUrl || '[]')[0];
                  })(),
                }}
                style={styles.floatingProductImage}
              />
              <View style={styles.floatingProductInfo}>
                <Text style={styles.floatingProductName} numberOfLines={1}>
                  {activeProduct.product_name || activeProduct.item_name}
                </Text>
                <Text style={styles.floatingProductPrice}>
                  ₱{activeProduct.price}
                  {activeProduct.rental_duration && (
                    <Text style={styles.rentalDuration}> / {activeProduct.rental_duration}</Text>
                  )}
                </Text>
              </View>
              {!activeProduct.rental_duration && user.email !== activeProduct.email && (
                <TouchableOpacity 
                  style={styles.productCheckoutButton}
                  onPress={() => onProductCheckout(activeProduct)}
                  activeOpacity={0.85}
                >
                  <Icon name="shopping-cart" size={14} color="#fff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={styles.productCloseButton}
                onPress={() => setActiveProduct(null)}
                activeOpacity={0.7}
              >
                <Icon name="times" size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderItem}
            keyExtractor={(item) => item.id?.toString()}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />

          {/* Typing Indicator */}
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

          {/* Reply Preview */}
          {replyTo && (
            <View style={styles.replyPreviewBar}>
              <View style={styles.replyPreviewIndicator} />
              <View style={styles.replyPreviewContent}>
                <Text style={styles.replyPreviewLabel}>
                  Replying to {replyTo.sender_id === user.email ? 'yourself' : receiverName}
                </Text>
                {replyTo.text ? (
                  <Text numberOfLines={1} style={styles.replyPreviewText}>
                    {replyTo.text}
                  </Text>
                ) : (
                  <View style={styles.replyPhotoRow}>
                    <Icon name="camera" size={12} color={theme.textTertiary} />
                    <Text style={styles.replyPreviewText}> Photo</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={cancelReply} style={styles.replyPreviewClose}>
                <Icon name="times" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Image Preview */}
          {images.length > 0 && (
            <View style={styles.imagePreviewSection}>
              <FlatList
                horizontal
                data={images}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item, index }) => (
                  <View style={styles.previewImageWrapper}>
                    <Image source={{ uri: item }} style={styles.previewImage} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => setImages(images.filter((_, i) => i !== index))}
                      activeOpacity={0.8}
                    >
                      <Icon name="times-circle" size={22} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
                showsHorizontalScrollIndicator={false}
              />
            </View>
          )}

          {/* Input Bar */}
          <View style={styles.inputBar}>
            <TouchableOpacity 
              onPress={pickImage} 
              style={styles.attachButton}
              activeOpacity={0.7}
            >
              <Icon name="image" size={22} color={theme.accent} />
            </TouchableOpacity>

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                value={input}
                onChangeText={setInput}
                placeholder={uploading ? 'Uploading...' : 'Message...'}
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
              <Icon 
                name="send" 
                size={16} 
                color="#fff" 
                style={styles.sendIcon}
              />
            </TouchableOpacity>
          </View>

          {/* Image Modal */}
          <Modal visible={!!selectedImage} transparent onRequestClose={() => setSelectedImage(null)}>
            <View style={styles.imageModal}>
              <TouchableOpacity 
                style={styles.modalCloseButton} 
                onPress={() => setSelectedImage(null)}
                activeOpacity={0.8}
              >
                <Icon name="times" size={28} color="#fff" />
              </TouchableOpacity>
              <Image 
                source={{ uri: selectedImage }} 
                style={styles.modalImage} 
                resizeMode="contain" 
              />
            </View>
          </Modal>

          {/* Long-press options modal */}
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
                    <Icon name="reply" size={18} color={theme.accent} />
                  </View>
                  <Text style={styles.optionLabel}>Reply</Text>
                </TouchableOpacity>

                {selectedMessage?.sender_id === user.email && (
                  <TouchableOpacity 
                    onPress={handleUnsend} 
                    style={styles.optionItem}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.optionIconContainer, styles.optionIconDanger]}>
                      <Icon name="trash" size={18} color={theme.error} />
                    </View>
                    <Text style={[styles.optionLabel, styles.optionLabelDanger]}>Unsend</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  onPress={() => setOptionsVisible(false)} 
                  style={[styles.optionItem, styles.optionItemCancel]}
                  activeOpacity={0.7}
                >
                  <Text style={styles.optionLabelCancel}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

// Dark theme colors (matching InboxScreen)
const darkTheme = {
  background: '#0a0e27',
  cardBackground: '#141b3c',
  text: '#ffffff',
  textSecondary: '#a8b2d1',
  textTertiary: '#6b7280',
  myBubble: '#0084ff',
  otherBubble: '#2d3548',
  accent: '#FDAD00',
  success: '#10b981',
  error: '#ef4444',
  border: '#252b47',
  inputBackground: '#1e2544',
  statusDot: '#10b981',
  replyLine: '#0084ff',
  swipeBackground: '#3b82f6',
  shadowColor: '#000',
};

// Light theme colors (matching InboxScreen)
const lightTheme = {
  background: '#f8fafc',
  cardBackground: '#ffffff',
  text: '#1e293b',
  textSecondary: '#64748b',
  textTertiary: '#94a3b8',
  myBubble: '#0084ff',
  otherBubble: '#e5e7eb',
  accent: '#f59e0b',
  success: '#10b981',
  error: '#ef4444',
  border: '#e2e8f0',
  inputBackground: '#f1f5f9',
  statusDot: '#10b981',
  replyLine: '#0084ff',
  swipeBackground: '#3b82f6',
  shadowColor: '#000',
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
  
  // Header
  header: { 
    backgroundColor: theme.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerUser: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerAvatar: { 
    width: 42, 
    height: 42, 
    borderRadius: 21,
    marginRight: 12,
    borderWidth: 2,
    borderColor: theme.accent,
  },
  headerAvatarPlaceholder: {
    backgroundColor: theme.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerName: { 
    fontSize: 17, 
    fontWeight: '700',
    color: theme.text,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.statusDot,
    marginRight: 6,
  },
  statusText: { 
    fontSize: 13, 
    color: theme.textSecondary,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Floating Product Card
  floatingProductCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  floatingProductImage: {
    width: 50,
    height: 50,
    borderRadius: 10,
    marginRight: 12,
  },
  floatingProductInfo: {
    flex: 1,
  },
  floatingProductName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 2,
  },
  floatingProductPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.accent,
  },
  rentalDuration: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  productCheckoutButton: {
    backgroundColor: theme.success,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  productCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  
  // Messages List
  messagesList: { 
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  
  // Message Wrapper
  messageWrapper: { 
    flexDirection: 'row', 
    alignItems: 'flex-end',
    marginVertical: 2,
  },
  myWrapper: { 
    justifyContent: 'flex-end',
  },
  otherWrapper: { 
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 32,
    marginHorizontal: 4,
  },
  messageAvatar: { 
    width: 32, 
    height: 32, 
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  avatarSpacer: {
    width: 32,
    height: 32,
  },
  messageContentWrapper: {
    maxWidth: '75%',
  },
  
  // Message Bubble
  messageBubble: { 
    paddingHorizontal: 14, 
    paddingVertical: 10,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  myBubble: { 
    backgroundColor: theme.myBubble,
    borderBottomRightRadius: 6,
  },
  otherBubble: { 
    backgroundColor: theme.otherBubble,
    borderBottomLeftRadius: 6,
  },
  bubbleText: { 
    fontSize: 15, 
    color: theme.text,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  myBubbleText: {
    color: '#ffffff',
  },
  messageImage: { 
    width: 220, 
    height: 220, 
    borderRadius: 14, 
    marginTop: 6,
  },
  messageTime: {
    fontSize: 11,
    color: theme.textTertiary,
    marginTop: 4,
    fontWeight: '500',
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'right',
  },
  checkMark: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
  },
  
  // Reply Indicator
  replyIndicator: { 
    backgroundColor: theme.otherBubble,
    borderLeftWidth: 3, 
    borderLeftColor: theme.replyLine,
    padding: 8,
    borderRadius: 10,
    marginBottom: 4,
    flexDirection: 'row',
  },
  replyIndicatorMine: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  replyLine: {
    width: 3,
    backgroundColor: theme.replyLine,
    borderRadius: 2,
    marginRight: 8,
  },
  replyContent: {
    flex: 1,
  },
  replyLabel: { 
    fontSize: 12, 
    fontWeight: '600',
    color: theme.accent,
    marginBottom: 2,
  },
  replyText: { 
    fontSize: 13, 
    color: theme.textSecondary,
  },
  replyPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  // Typing Indicator
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  typingAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  typingBubble: {
    flexDirection: 'row',
    backgroundColor: theme.otherBubble,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.textTertiary,
  },
  
  // Reply Preview Bar
  replyPreviewBar: { 
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  replyPreviewIndicator: {
    width: 3,
    height: 36,
    backgroundColor: theme.accent,
    borderRadius: 2,
    marginRight: 12,
  },
  replyPreviewContent: { 
    flex: 1,
  },
  replyPreviewLabel: { 
    fontSize: 13, 
    color: theme.accent, 
    fontWeight: '600',
    marginBottom: 2,
  },
  replyPreviewText: { 
    fontSize: 14, 
    color: theme.textSecondary,
  },
  replyPreviewClose: {
    padding: 4,
    marginLeft: 8,
  },
  
  // Image Preview Section
  imagePreviewSection: {
    backgroundColor: theme.cardBackground,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  previewImageWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: theme.error,
    borderRadius: 11,
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Input Bar
  inputBar: { 
    flexDirection: 'row', 
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.cardBackground,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: theme.inputBackground,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  textInput: { 
    fontSize: 15,
    color: theme.text,
    maxHeight: 100,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  sendButton: { 
    backgroundColor: theme.accent,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    ...Platform.select({
      ios: {
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  sendButtonDisabled: {
    backgroundColor: theme.textTertiary,
    opacity: 0.6,
  },
  sendIcon: {
    marginLeft: 2,
  },
  
  // Swipe Action
  swipeAction: { 
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    marginVertical: 2,
  },
  swipeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.swipeBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Image Modal
  imageModal: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: { 
    width: '100%', 
    height: '100%',
  },
  modalCloseButton: { 
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Options Modal
  optionsModalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  optionsModalContent: { 
    backgroundColor: theme.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  optionsHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: theme.inputBackground,
  },
  optionItemCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.border,
    marginTop: 8,
  },
  optionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${theme.accent}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  optionIconDanger: {
    backgroundColor: `${theme.error}20`,
  },
  optionLabel: { 
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  optionLabelDanger: {
    color: theme.error,
  },
  optionLabelCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textSecondary,
    textAlign: 'center',
    flex: 1,
  },
});