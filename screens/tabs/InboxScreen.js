import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

export default function InboxScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [userNames, setUserNames] = useState({});
  const [lastMessages, setLastMessages] = useState({});
  const [unreadMessages, setUnreadMessages] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const user = auth.currentUser;

  // --- Fetch all conversations ---
  const fetchConversations = async () => {
    if (!user) return;

    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, text, created_at, read')
      .or(`sender_id.eq.${user.email},receiver_id.eq.${user.email}`);
    if (error) return console.log('Fetch messages error:', error);

    const usersSet = new Set();
    const lastMsgs = {};
    const unreadCount = {};

    messages.forEach(msg => {
      const otherUser = msg.sender_id === user.email ? msg.receiver_id : msg.sender_id;
      usersSet.add(otherUser);

      // Track last message
      if (!lastMsgs[otherUser] || new Date(msg.created_at) > new Date(lastMsgs[otherUser].created_at)) {
        lastMsgs[otherUser] = { id: msg.id, text: msg.text, created_at: msg.created_at, sender_id: msg.sender_id };
      }

      // Track unread messages (sent by other user)
      if (msg.sender_id !== user.email && !msg.read) {
        if (!unreadCount[otherUser]) unreadCount[otherUser] = 0;
        unreadCount[otherUser] += 1;
      }
    });

    const userList = Array.from(usersSet);

    // Sort users by latest message timestamp descending
    userList.sort((a, b) => {
      const timeA = new Date(lastMsgs[a]?.created_at || 0).getTime();
      const timeB = new Date(lastMsgs[b]?.created_at || 0).getTime();
      return timeB - timeA;
    });

    setConversations(userList);
    setLastMessages(lastMsgs);
    setUnreadMessages(unreadCount);

    if (userList.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('email, name, profile_photo')
        .in('email', userList);

      const nameMap = {};
      usersData?.forEach(u => { nameMap[u.email] = u; });
      setUserNames(nameMap);
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConversations();
    setRefreshing(false);
  }, [user]);

  // --- Clear unread messages for a conversation ---
  const clearUnread = async (otherUser) => {
    const conversation = conversations.find(c => c === otherUser);
    if (!conversation) return;

    // Update locally
    setUnreadMessages((prev) => ({ ...prev, [otherUser]: 0 }));

    // Update in Supabase: mark messages as read
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('receiver_id', user.email)
      .eq('sender_id', otherUser)
      .is('read', false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Inbox</Text>
      <FlatList
        data={conversations}
        keyExtractor={item => item}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => {
          const userData = userNames[item];
          const lastMsgData = lastMessages[item];
          const unreadCount = unreadMessages[item] || 0;
          const formattedTime = lastMsgData ? new Date(lastMsgData.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now';
          const lastText = lastMsgData?.text || 'No messages yet';

          return (
            <TouchableOpacity
              style={[styles.chatCard, unreadCount > 0 && styles.unreadCard]}
              onPress={() => {
                navigation.navigate('Messaging', {
                  receiverId: item,
                  receiverName: userData?.name || item,
                });
                clearUnread(item); // clear unread count when opening chat
              }}
            >
              <Image
                source={{
                  uri: userData?.profile_photo || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
                }}
                style={styles.avatar}
              />
              <View style={styles.chatInfo}>
                <Text style={styles.chatName} numberOfLines={1}>
                  {userData?.name || item}
                </Text>
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {lastText}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.timeText}>{formattedTime}</Text>
                {unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.badgeText}>{unreadCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', paddingHorizontal: 16, paddingTop: 10 },
  header: { fontSize: 26, fontWeight: '700', marginBottom: 10, color: '#111827', textAlign: 'center' },
  chatCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    marginBottom: 10, padding: 14, borderRadius: 16,
    shadowColor: '#000', shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 3,
  },
  unreadCard: { backgroundColor: '#E0F2FE' },
  avatar: { width: 52, height: 52, borderRadius: 26, marginRight: 14 },
  chatInfo: { flex: 1 },
  chatName: { fontSize: 17, fontWeight: '600', color: '#111827' },
  lastMessage: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  timeText: { fontSize: 12, color: '#9CA3AF' },
  unreadBadge: {
    marginTop: 4,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
});
