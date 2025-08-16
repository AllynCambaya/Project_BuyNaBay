import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

export default function InboxScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const user = auth.currentUser;

  useEffect(() => {
    const fetchConversations = async () => {
      if (!user) return;
      // Get all messages where current user is the receiver
      const { data, error } = await supabase
        .from('messages')
        .select('sender_id, receiver_id')
        .or(`sender_id.eq.${user.email},receiver_id.eq.${user.email}`);

      if (error) return;

      const users = new Set();
      data.forEach(msg => {
        if (msg.sender_id !== user.email) users.add(msg.sender_id);
        if (msg.receiver_id !== user.email) users.add(msg.receiver_id);
      });
      setConversations(Array.from(users));
    };
    fetchConversations();
  }, [user]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Inbox</Text>
      <FlatList
        data={conversations}
        keyExtractor={item => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => navigation.navigate('Messaging', { receiverId: item })}
          >
            <Text style={styles.text}>Chat with: {item}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  item: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  text: { fontSize: 18 },
});