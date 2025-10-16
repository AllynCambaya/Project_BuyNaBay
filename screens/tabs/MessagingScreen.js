import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

export default function MessagingScreen({ route }) {
  const navigation = useNavigation();
  // Use email for sender/receiver
  const receiverId = route?.params?.receiverId || 'receiver_user_email';
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const user = auth.currentUser;

  // NEW: block access for users who are not approved
  useEffect(() => {
    const checkStatus = async () => {
      if (!user) {
        Alert.alert('Not Logged In', 'Please log in to access messaging.');
        navigation.goBack();
        return;
      }

      try {
        const { data, error } = await supabase
          .from('verifications')
          .select('status, created_at')
          .eq('email', user.email)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data?.status && data.status !== 'approved') {
          // pending or rejected -> block
          Alert.alert(
            'Access Restricted',
            'Your account is not verified to use messaging. Please complete verification to access this feature.'
          );
          navigation.goBack();
          return;
        }
      } catch (err) {
        console.log('verification check error', err?.message || err);
        // If check fails, be conservative and block access (optional). For now we allow fallback.
      }
    };

    checkStatus();
  }, [user, navigation]);

  // Fetch messages between current user and receiver
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

  // Send a message
  const sendMessage = async () => {
    if (input.trim() === '' || !user) return;
    const { error } = await supabase
      .from('messages')
      .insert([
        {
          sender_id: user.email,
          receiver_id: receiverId,
          text: input,
        },
      ]);
    if (!error) setInput('');
  };

  const renderItem = ({ item }) => (
    <View style={[
      styles.messageContainer,
      item.sender_id === user.email ? styles.myMessage : styles.otherMessage
    ]}>
      <Text style={styles.messageText}>{item.text}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        style={styles.list}
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: '#fff' },
  list: { flex: 1 },
  messageContainer: {
    marginVertical: 4,
    padding: 10,
    borderRadius: 8,
    maxWidth: '80%',
  },
  myMessage: {
    backgroundColor: '#DCF8C6',
    alignSelf: 'flex-end',
  },
  otherMessage: {
    backgroundColor: '#EEE',
    alignSelf: 'flex-start',
  },
  messageText: { fontSize: 16 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: '#ddd',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  sendButton: {
    marginLeft: 8,
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  sendText: { color: '#fff', fontWeight: 'bold' },
});