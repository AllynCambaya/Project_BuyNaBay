import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

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
            {!isMine && <Image source={{ uri: avatarSource }} style={styles.avatar} />}
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
                    <Text style={styles.replyText}>📷 Photo</Text>
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
            {isMine && <Image source={{ uri: avatarSource }} style={styles.avatar} />}
          </TouchableOpacity>
        </Animated.View>
      </Swipeable>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Image source={{ uri: receiverAvatar }} style={styles.headerAvatar} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{receiverName}</Text>
          <Text style={styles.headerStatus}>Active now</Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        data={messages}
        renderItem={renderItem}
        keyExtractor={(item) => item.id?.toString()}
        style={styles.list}
        showsVerticalScrollIndicator={false}
      />

      {/* Reply Preview */}
      {replyTo && (
        <View style={styles.replyPreview}>
          <View style={styles.replyPreviewContent}>
            <Text style={styles.replyingTo}>
              Replying to {replyTo.sender_id === user.email ? 'yourself' : receiverName}
            </Text>
            {replyTo.text ? (
              <Text numberOfLines={1} style={styles.replyPreviewText}>
                {replyTo.text}
              </Text>
            ) : (
              <Text style={styles.replyPreviewText}>📷 Photo</Text>
            )}
          </View>
          <TouchableOpacity onPress={cancelReply}>
            <Ionicons name="close-circle" size={22} color="#555" />
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        <TouchableOpacity onPress={pickImage}>
          <Ionicons name="image-outline" size={26} color="#555" />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={uploading ? 'Uploading image...' : replyTo ? 'Reply...' : 'Send message...'}
          editable={!uploading}
        />

        <TouchableOpacity
          onPress={sendMessage}
          style={[styles.sendButton, uploading && { opacity: 0.6 }]}
          disabled={uploading}
        >
          <Ionicons name="send" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Image Modal */}
      <Modal visible={!!selectedImage} transparent onRequestClose={() => setSelectedImage(null)}>
        <View style={styles.modalBackground}>
          <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedImage(null)}>
            <Ionicons name="close-circle" size={32} color="#fff" />
          </TouchableOpacity>
          <Image source={{ uri: selectedImage }} style={styles.fullscreenImage} resizeMode="contain" />
        </View>
      </Modal>

      {/* Long-press options modal */}
      <Modal transparent visible={optionsVisible} animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setOptionsVisible(false)}
        >
          <View style={styles.optionsModal}>
            <TouchableOpacity
              onPress={() => {
                handleReply(selectedMessage);
                setOptionsVisible(false);
              }}
            >
              <Text style={styles.optionText}>Reply</Text>
            </TouchableOpacity>

            {/* Only show unsend if it is the current user's message */}
            {selectedMessage?.sender_id === user.email && (
              <TouchableOpacity onPress={handleUnsend}>
                <Text style={styles.optionText}>Unsend</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={() => setOptionsVisible(false)}>
              <Text style={styles.optionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderColor: '#eee', backgroundColor: '#fff' },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, marginHorizontal: 10 },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 18, fontWeight: '600', color: '#111' },
  headerStatus: { fontSize: 13, color: '#777' },
  list: { flex: 1, paddingHorizontal: 12, paddingTop: 10 },
  messageWrapper: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 8 },
  myWrapper: { alignSelf: 'flex-end' },
  otherWrapper: { alignSelf: 'flex-start' },
  avatar: { width: 36, height: 36, borderRadius: 18, marginHorizontal: 6 },
  messageContent: { maxWidth: '80%' },
  messageContainer: { padding: 10, borderRadius: 14 },
  myMessage: { backgroundColor: '#DCF8C6', alignSelf: 'flex-end' },
  otherMessage: { backgroundColor: '#F2F2F2', alignSelf: 'flex-start' },
  messageText: { fontSize: 15, color: '#333' },
  messageImage: { width: 180, height: 180, borderRadius: 10, marginTop: 6 },
  replyBubble: { backgroundColor: '#eaeaea', borderLeftWidth: 3, borderLeftColor: '#007AFF', padding: 6, borderRadius: 8, marginBottom: 4 },
  replyLabel: { fontSize: 12, fontWeight: 'bold', color: '#007AFF' },
  replyText: { fontSize: 13, color: '#333' },
  replyPreview: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F0FE', padding: 8, borderTopWidth: 1, borderColor: '#ccc' },
  replyPreviewContent: { flex: 1 },
  replyingTo: { fontSize: 12, color: '#007AFF', fontWeight: 'bold' },
  replyPreviewText: { fontSize: 13, color: '#333' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderColor: '#ddd', padding: 8, backgroundColor: '#fff' },
  input: { flex: 1, marginHorizontal: 8, backgroundColor: '#f1f1f1', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 15 },
  sendButton: { backgroundColor: '#007AFF', borderRadius: 20, padding: 10 },
  modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  fullscreenImage: { width: '100%', height: '100%' },
  closeButton: { position: 'absolute', top: 40, right: 20, zIndex: 1 },

  // Swipe styles
  swipeReply: { backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', width: 80, borderRadius: 10, marginVertical: 8 },
  swipeText: { color: '#fff', fontWeight: 'bold' },

  // Long-press modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  optionsModal: { backgroundColor: '#fff', padding: 16, borderRadius: 10, width: 200 },
  optionText: { fontSize: 16, paddingVertical: 8 },
});
