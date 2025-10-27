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
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/FontAwesome';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

const { width, height } = Dimensions.get('window');

export default function MessagingScreen({ route }) {
  const navigation = useNavigation();
  const receiverId = route?.params?.receiverId || 'receiver_user_email';
  const receiverName = route?.params?.receiverName || 'User';
  const user = auth.currentUser;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState(null);

  const [receiverAvatar, setReceiverAvatar] = useState(null);
  const [userAvatar, setUserAvatar] = useState(null);

  const [selectedImage, setSelectedImage] = useState(null);

  // --- Long press options ---
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);

  // Automatically detect system theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';

  // Get current theme colors based on system settings
  const theme = isDarkMode ? darkTheme : lightTheme;
  const styles = createStyles(theme);

  const flatListRef = useRef(null);

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

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.email},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.email})`
        )
        .order('created_at', { ascending: true });

      if (!error) setMessages(data || []);
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
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

    if (!result.canceled) {
      setImages(prev => [...prev, ...result.assets.map(a => a.uri)]);
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

    const { error } = await supabase.from('messages').insert([
      {
        sender_id: user.email,
        receiver_id: receiverId,
        text: input.trim() || null,
        messages_image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
        reply_to: replyTo ? replyTo.id : null,
      },
    ]);

    if (!error) {
      setInput('');
      setImages([]);
      setReplyTo(null);
    } else {
      console.error('Send message error:', error.message);
    }
  };

  // --- Render item with swipe & animated movement ---
  const renderItem = ({ item }) => {
    const isMine = item.sender_id === user.email;
    const avatarSource = isMine ? userAvatar : receiverAvatar;

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
    const translateX = new Animated.Value(0);

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
            <Animated.View style={[styles.swipeReply, { transform: [{ translateX: trans }] }]}>
              <Icon name="reply" size={18} color="#fff" />
              <Text style={styles.swipeText}>Reply</Text>
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
            <Animated.View style={[styles.swipeReply, { transform: [{ translateX: trans }] }]}>
              <Icon name="reply" size={18} color="#fff" />
              <Text style={styles.swipeText}>Reply</Text>
            </Animated.View>
          );
        }}
      >
        <Animated.View style={{ transform: [{ translateX }] }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onLongPress={() => showMessageOptions(item)}
            style={[styles.messageWrapper, isMine ? styles.myWrapper : styles.otherWrapper]}
          >
            {!isMine && avatarSource && (
              <Image source={{ uri: avatarSource }} style={styles.avatar} />
            )}
            <View style={styles.messageContent}>
              {repliedMessage && (
                <View style={styles.replyBubble}>
                  <Text style={styles.replyLabel}>
                    Replying to {repliedMessage.sender_id === user.email ? 'yourself' : receiverName}
                  </Text>
                  {repliedMessage.text ? (
                    <Text numberOfLines={1} style={styles.replyText}>
                      {repliedMessage.text}
                    </Text>
                  ) : repliedMessage.messages_image_url ? (
                    <View style={styles.replyPhotoContainer}>
                      <Icon name="camera" size={12} color={theme.accent} />
                      <Text style={styles.replyText}> Photo</Text>
                    </View>
                  ) : null}
                </View>
              )}
              <View style={[styles.messageContainer, isMine ? styles.myMessage : styles.otherMessage]}>
                {item.text ? <Text style={styles.messageText}>{item.text}</Text> : null}
                {imageUrls.length > 0 &&
                  imageUrls.map((url, index) => (
                    <TouchableOpacity key={index} onPress={() => setSelectedImage(url)}>
                      <Image source={{ uri: url }} style={styles.messageImage} />
                    </TouchableOpacity>
                  ))}
              </View>
            </View>
            {isMine && avatarSource && (
              <Image source={{ uri: avatarSource }} style={styles.avatar} />
            )}
          </TouchableOpacity>
        </Animated.View>
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
            <View style={styles.headerLeft}>
              <TouchableOpacity 
                onPress={() => navigation.goBack()} 
                style={styles.backButton}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
              {receiverAvatar && (
                <Image source={{ uri: receiverAvatar }} style={styles.headerAvatar} />
              )}
              <View style={styles.headerInfo}>
                <Text style={styles.headerName}>{receiverName}</Text>
                <View style={styles.statusContainer}>
                  <View style={styles.activeIndicator} />
                  <Text style={styles.headerStatus}>Active now</Text>
                </View>
              </View>
            </View>
            {/* Report button - navigates to ReportScreen with reported user info */}
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('ReportScreen', {
                  reported_student_id: receiverId,
                  reported_name: receiverName,
                })
              }
              style={styles.reportButton}
              activeOpacity={0.7}
            >
              <Ionicons name="flag" size={22} color={theme.error} />
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderItem}
            keyExtractor={(item) => item.id?.toString()}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />

          {/* Reply Preview */}
          {replyTo && (
            <View style={styles.replyPreview}>
              <View style={styles.replyPreviewLeft}>
                <Icon name="reply" size={16} color={theme.accent} />
              </View>
              <View style={styles.replyPreviewContent}>
                <Text style={styles.replyingTo}>
                  Replying to {replyTo.sender_id === user.email ? 'yourself' : receiverName}
                </Text>
                {replyTo.text ? (
                  <Text numberOfLines={1} style={styles.replyPreviewText}>
                    {replyTo.text}
                  </Text>
                ) : (
                  <View style={styles.replyPhotoContainer}>
                    <Icon name="camera" size={12} color={theme.textSecondary} />
                    <Text style={styles.replyPreviewText}> Photo</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={cancelReply} style={styles.cancelReplyButton}>
                <Ionicons name="close-circle" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Image Preview */}
          {images.length > 0 && (
            <View style={styles.imagePreviewContainer}>
              <FlatList
                horizontal
                data={images}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item, index }) => (
                  <View style={styles.imagePreviewWrapper}>
                    <Image source={{ uri: item }} style={styles.imagePreview} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => setImages(images.filter((_, i) => i !== index))}
                    >
                      <Ionicons name="close-circle" size={24} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
                showsHorizontalScrollIndicator={false}
              />
            </View>
          )}

          {/* Input */}
          <View style={styles.inputContainer}>
            <TouchableOpacity 
              onPress={pickImage} 
              style={styles.imageButton}
              activeOpacity={0.7}
            >
              <Ionicons name="image-outline" size={26} color={theme.accent} />
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder={uploading ? 'Uploading image...' : replyTo ? 'Reply...' : 'Send message...'}
              placeholderTextColor={theme.textSecondary}
              editable={!uploading}
              multiline
              maxLength={500}
            />

            <TouchableOpacity
              onPress={sendMessage}
              style={[
                styles.sendButton,
                (uploading || (!input.trim() && images.length === 0)) && styles.sendButtonDisabled
              ]}
              disabled={uploading || (!input.trim() && images.length === 0)}
              activeOpacity={0.85}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Image Modal */}
          <Modal visible={!!selectedImage} transparent onRequestClose={() => setSelectedImage(null)}>
            <View style={styles.modalBackground}>
              <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedImage(null)}>
                <Ionicons name="close-circle" size={40} color="#fff" />
              </TouchableOpacity>
              <Image source={{ uri: selectedImage }} style={styles.fullscreenImage} resizeMode="contain" />
            </View>
          </Modal>

          {/* Long-press options modal */}
          <Modal transparent visible={optionsVisible} animationType="fade">
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setOptionsVisible(false)}
            >
              <View style={styles.optionsModal}>
                <Text style={styles.optionsTitle}>Message Options</Text>
                
                <TouchableOpacity
                  onPress={() => {
                    handleReply(selectedMessage);
                    setOptionsVisible(false);
                  }}
                  style={styles.optionButton}
                  activeOpacity={0.7}
                >
                  <Icon name="reply" size={18} color={theme.accent} />
                  <Text style={styles.optionText}>Reply</Text>
                </TouchableOpacity>

                {/* Only show unsend if it is the current user's message */}
                {selectedMessage?.sender_id === user.email && (
                  <TouchableOpacity 
                    onPress={handleUnsend} 
                    style={styles.optionButton}
                    activeOpacity={0.7}
                  >
                    <Icon name="trash" size={18} color={theme.error} />
                    <Text style={[styles.optionText, { color: theme.error }]}>Unsend</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  onPress={() => setOptionsVisible(false)} 
                  style={[styles.optionButton, styles.cancelButton]}
                  activeOpacity={0.7}
                >
                  <Icon name="times" size={18} color={theme.textSecondary} />
                  <Text style={[styles.optionText, { color: theme.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

// Dark theme colors (matching CartScreen)
const darkTheme = {
  background: '#0f0f2e',
  gradientBackground: '#1b1b41',
  text: '#fff',
  textSecondary: '#bbb',
  textTertiary: '#ccc',
  cardBackground: '#1e1e3f',
  cardBackgroundAlt: '#252550',
  messageBackground: '#252550',
  myMessageBackground: '#2a4a7c',
  otherMessageBackground: '#1e1e3f',
  accent: '#FDAD00',
  accentSecondary: '#e8ecf1',
  historyColor: '#4CAF50',
  error: '#d32f2f',
  shadowColor: '#000',
  borderColor: '#2a2a4a',
  inputBackground: '#1e1e3f',
  activeIndicator: '#4CAF50',
  replyBackground: '#2a2a55',
  swipeBackground: '#3a7bd5',
};

// Light theme colors (matching CartScreen)
const lightTheme = {
  background: '#f5f7fa',
  gradientBackground: '#e8ecf1',
  text: '#1a1a2e',
  textSecondary: '#4a4a6a',
  textTertiary: '#2c2c44',
  cardBackground: '#ffffff',
  cardBackgroundAlt: '#f9f9fc',
  messageBackground: '#ffffff',
  myMessageBackground: '#DCF8C6',
  otherMessageBackground: '#F2F2F2',
  accent: '#f39c12',
  accentSecondary: '#e67e22',
  historyColor: '#27ae60',
  error: '#e74c3c',
  shadowColor: '#000',
  borderColor: '#e0e0ea',
  inputBackground: '#f1f1f1',
  activeIndicator: '#27ae60',
  replyBackground: '#E8F0FE',
  swipeBackground: '#3a7bd5',
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
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingVertical: 14, 
    paddingHorizontal: Math.max(width * 0.04, 16), 
    borderBottomWidth: 1, 
    borderColor: theme.borderColor, 
    backgroundColor: theme.cardBackground,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerAvatar: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    marginRight: 12,
    borderWidth: 2,
    borderColor: theme.accent,
  },
  headerInfo: { 
    flex: 1,
  },
  headerName: { 
    fontSize: 18, 
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    color: theme.text,
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  activeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.activeIndicator,
    marginRight: 6,
  },
  headerStatus: { 
    fontSize: 13, 
    color: theme.textSecondary,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  reportButton: {
    padding: 8,
    borderRadius: 20,
  },
  list: { 
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Math.max(width * 0.04, 16),
    paddingTop: 10,
    paddingBottom: 10,
  },
  messageWrapper: { 
    flexDirection: 'row', 
    alignItems: 'flex-end', 
    marginVertical: 6,
  },
  myWrapper: { 
    alignSelf: 'flex-end',
  },
  otherWrapper: { 
    alignSelf: 'flex-start',
  },
  avatar: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    marginHorizontal: 6,
    borderWidth: 1.5,
    borderColor: theme.borderColor,
  },
  messageContent: { 
    maxWidth: '75%',
  },
  messageContainer: { 
    padding: 12, 
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  myMessage: { 
    backgroundColor: theme.myMessageBackground, 
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  otherMessage: { 
    backgroundColor: theme.otherMessageBackground, 
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: { 
    fontSize: 15, 
    color: theme.text,
    lineHeight: 20,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  messageImage: { 
    width: 200, 
    height: 200, 
    borderRadius: 12, 
    marginTop: 8,
  },
  replyBubble: { 
    backgroundColor: theme.replyBackground, 
    borderLeftWidth: 3, 
    borderLeftColor: theme.accent, 
    padding: 8, 
    borderRadius: 8, 
    marginBottom: 6,
  },
  replyLabel: { 
    fontSize: 12, 
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    color: theme.accent,
    marginBottom: 2,
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  replyText: { 
    fontSize: 13, 
    color: theme.text,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  replyPhotoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyPreview: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: theme.cardBackground, 
    padding: 12, 
    borderTopWidth: 1, 
    borderColor: theme.borderColor,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  replyPreviewLeft: {
    marginRight: 12,
  },
  replyPreviewContent: { 
    flex: 1,
  },
  replyingTo: { 
    fontSize: 12, 
    color: theme.accent, 
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    marginBottom: 2,
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  replyPreviewText: { 
    fontSize: 13, 
    color: theme.textSecondary,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  cancelReplyButton: {
    padding: 4,
  },
  imagePreviewContainer: {
    backgroundColor: theme.cardBackground,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderColor: theme.borderColor,
  },
  imagePreviewWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: theme.error,
    borderRadius: 12,
  },
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderTopWidth: 1, 
    borderColor: theme.borderColor, 
    padding: 12, 
    backgroundColor: theme.cardBackground,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  imageButton: {
    padding: 8,
    marginRight: 8,
  },
  input: { 
    flex: 1, 
    backgroundColor: theme.inputBackground, 
    borderRadius: 20, 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    fontSize: 15,
    color: theme.text,
    maxHeight: 100,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  sendButton: { 
    backgroundColor: theme.accent, 
    borderRadius: 20, 
    padding: 12,
    marginLeft: 8,
    ...Platform.select({
      ios: {
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  sendButtonDisabled: {
    backgroundColor: theme.textSecondary,
    opacity: 0.5,
  },
  modalBackground: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.95)', 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  fullscreenImage: { 
    width: '100%', 
    height: '100%',
  },
  closeButton: { 
    position: 'absolute', 
    top: Platform.OS === 'ios' ? 60 : 40, 
    right: 20, 
    zIndex: 1,
    padding: 8,
  },

  // Swipe styles
  swipeReply: { 
    backgroundColor: theme.swipeBackground, 
    justifyContent: 'center', 
    alignItems: 'center', 
    width: 80, 
    borderRadius: 12, 
    marginVertical: 6,
    marginHorizontal: 4,
    flexDirection: 'row',
    gap: 6,
  },
  swipeText: { 
    color: '#fff', 
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    fontSize: 14,
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },

  // Long-press modal
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  optionsModal: { 
    backgroundColor: theme.cardBackground, 
    padding: 20, 
    borderRadius: 20, 
    width: width * 0.8,
    maxWidth: 320,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  optionsTitle: {
    fontSize: 18,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    color: theme.text,
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: theme.cardBackgroundAlt,
  },
  cancelButton: {
    backgroundColor: theme.inputBackground,
    marginTop: 4,
  },
  optionText: { 
    fontSize: 16, 
    paddingLeft: 12,
    color: theme.text,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
})