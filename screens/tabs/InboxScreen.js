// screens/InboxScreen.js
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

const { width, height } = Dimensions.get('window');

export default function InboxScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [userNames, setUserNames] = useState({});
  const [lastMessages, setLastMessages] = useState({});
  const [unreadMessages, setUnreadMessages] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const user = auth.currentUser;

  // Automatically detect system theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  
  // Get current theme colors based on system settings
  const theme = isDarkMode ? darkTheme : lightTheme;

  // --- Fetch all conversations ---
  const fetchConversations = async () => {
    if (!user) return;

    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, text, created_at, read')
      .or(`sender_id.eq.${user.email},receiver_id.eq.${user.email}`);
    
    if (error) {
      console.log('Fetch messages error:', error);
      setLoading(false);
      return;
    }

    const usersSet = new Set();
    const lastMsgs = {};
    const unreadCount = {};

    messages.forEach(msg => {
      const otherUser = msg.sender_id === user.email ? msg.receiver_id : msg.sender_id;
      usersSet.add(otherUser);

      // Track last message
      if (!lastMsgs[otherUser] || new Date(msg.created_at) > new Date(lastMsgs[otherUser].created_at)) {
        lastMsgs[otherUser] = { 
          id: msg.id, 
          text: msg.text, 
          created_at: msg.created_at, 
          sender_id: msg.sender_id 
        };
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
    
    setLoading(false);
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

  const styles = createStyles(theme);

  // Calculate total unread messages
  const totalUnread = Object.values(unreadMessages).reduce((sum, count) => sum + count, 0);

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Background gradient effect */}
      <View style={styles.backgroundGradient} />

      {/* Branded logo - upper left */}
      <View style={styles.brandedLogoContainer}>
        <Image
          source={require('../../assets/images/OfficialBuyNaBay.png')}
          style={styles.brandedLogoImage}
          resizeMode="contain"
        />
        <Text style={styles.brandedLogoText}>BuyNaBay</Text>
      </View>

      {/* Welcome Section */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>Messages</Text>
        <Text style={styles.userName}>
          {user?.displayName || user?.email?.split('@')[0] || 'User'}
        </Text>
        <Text style={styles.subtitle}>Stay connected with your chats</Text>
      </View>

      {/* Stats Section */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Icon name="comments" size={20} color={theme.accent} />
          <Text style={styles.statValue}>{conversations.length}</Text>
          <Text style={styles.statLabel}>Chats</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="envelope" size={20} color={theme.accent} />
          <Text style={styles.statValue}>{totalUnread}</Text>
          <Text style={styles.statLabel}>Unread</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="check-circle" size={20} color={theme.accent} />
          <Text style={styles.statValue}>
            {conversations.length - Object.keys(unreadMessages).filter(k => unreadMessages[k] > 0).length}
          </Text>
          <Text style={styles.statLabel}>Read</Text>
        </View>
      </View>

      {/* Section Title */}
      {conversations.length > 0 && (
        <View style={styles.sectionTitleContainer}>
          <Icon name="comment" size={18} color={theme.text} />
          <Text style={styles.sectionTitle}> Conversations</Text>
        </View>
      )}
    </View>
  );

  const renderConversation = ({ item, index }) => {
    const userData = userNames[item];
    const lastMsgData = lastMessages[item];
    const unreadCount = unreadMessages[item] || 0;
    
    // Format time
    const formattedTime = lastMsgData 
      ? new Date(lastMsgData.created_at).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        }) 
      : 'Now';
    
    const lastText = lastMsgData?.text || 'No messages yet';
    const isUnread = unreadCount > 0;
    const isSentByMe = lastMsgData?.sender_id === user.email;

    return (
      <TouchableOpacity
        style={[
          styles.conversationCard,
          isUnread && styles.conversationCardUnread,
        ]}
        activeOpacity={0.85}
        onPress={() => {
          navigation.navigate('Messaging', {
            receiverId: item,
            receiverName: userData?.name || item,
          });
          clearUnread(item);
        }}
      >
        <View style={styles.avatarContainer}>
          <Image
            source={{
              uri: userData?.profile_photo || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
            }}
            style={styles.avatar}
          />
          {isUnread && <View style={styles.avatarBadge} />}
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.conversationName} numberOfLines={1}>
              {userData?.name || item}
            </Text>
            <Text style={styles.conversationTime}>{formattedTime}</Text>
          </View>
          
          <View style={styles.messagePreviewContainer}>
            <Text 
              style={[
                styles.messagePreview,
                isUnread && styles.messagePreviewUnread
              ]} 
              numberOfLines={1}
            >
              {isSentByMe && (
                <Text style={styles.youPrefix}>You: </Text>
              )}
              {lastText}
            </Text>
            {isUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </View>

        <Icon 
          name="chevron-right" 
          size={16} 
          color={theme.textSecondary} 
          style={styles.chevron}
        />
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="comments-o" size={64} color={theme.textSecondary} />
      <Text style={styles.emptyTitle}>No Conversations Yet</Text>
      <Text style={styles.emptySubtext}>
        Start chatting with sellers and buyers to see your messages here!
      </Text>
      <TouchableOpacity
        style={styles.browseButton}
        onPress={() => navigation.navigate('Home')}
        activeOpacity={0.85}
      >
        <Icon name="search" size={16} color="#fff" style={styles.buttonIcon} />
        <Text style={styles.browseButtonText}>Browse Products</Text>
      </TouchableOpacity>
    </View>
  );

  // Full-screen loading overlay
  if (loading && !refreshing) {
    return (
      <>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={theme.background}
          translucent={false}
        />
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.loadingText}>Loading your messages...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
        translucent={false}
      />
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={conversations}
          keyExtractor={(item) => item}
          renderItem={renderConversation}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          }
        />
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
  cardBackgroundUnread: '#2a2a55',
  accent: '#FDAD00',
  accentSecondary: '#e8ecf1',
  unreadBadge: '#4CAF50',
  error: '#d32f2f',
  shadowColor: '#000',
  borderColor: '#2a2a4a',
  borderUnread: '#FDAD00',
  avatarBadge: '#4CAF50',
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
  cardBackgroundUnread: '#fffbf0',
  accent: '#f39c12',
  accentSecondary: '#e67e22',
  unreadBadge: '#27ae60',
  error: '#e74c3c',
  shadowColor: '#000',
  borderColor: '#e0e0ea',
  borderUnread: '#f39c12',
  avatarBadge: '#27ae60',
};

const createStyles = (theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  listContent: {
    paddingBottom: 20,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 340 : 360,
    backgroundColor: theme.gradientBackground,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    zIndex: 0,
  },
  headerContainer: {
    paddingHorizontal: Math.max(width * 0.05, 20),
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 20,
    zIndex: 1,
  },
  brandedLogoContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 10 : 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  brandedLogoImage: {
    width: 32,
    height: 32,
    marginRight: 8,
  },
  brandedLogoText: {
    fontSize: 18,
    fontWeight: Platform.OS === 'android' ? '900' : '800',
    color: theme.accentSecondary,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
    letterSpacing: -0.5,
  },
  welcomeSection: {
    marginTop: 70,
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 16,
    color: theme.textSecondary,
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
    marginBottom: 4,
  },
  userName: {
    fontSize: Math.min(width * 0.08, 32),
    color: theme.text,
    fontWeight: Platform.OS === 'android' ? '900' : '800',
    fontFamily: Platform.select({
      ios: 'Poppins-ExtraBold',
      android: 'Poppins-Black',
      default: 'Poppins-ExtraBold',
    }),
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  statValue: {
    fontSize: 20,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    color: theme.text,
    marginTop: 8,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  statLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    color: theme.text,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  conversationCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    marginHorizontal: Math.max(width * 0.05, 20),
    marginBottom: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.borderColor,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  conversationCardUnread: {
    borderColor: theme.borderUnread,
    backgroundColor: theme.cardBackgroundUnread,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: theme.borderColor,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.avatarBadge,
    borderWidth: 2,
    borderColor: theme.cardBackground,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  conversationName: {
    fontSize: 17,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    color: theme.text,
    flex: 1,
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  conversationTime: {
    fontSize: 12,
    color: theme.textSecondary,
    marginLeft: 8,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  messagePreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  messagePreview: {
    fontSize: 14,
    color: theme.textSecondary,
    flex: 1,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  messagePreviewUnread: {
    color: theme.text,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
  youPrefix: {
    color: theme.textSecondary,
    fontStyle: 'italic',
  },
  unreadBadge: {
    backgroundColor: theme.unreadBadge,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 24,
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  chevron: {
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    color: theme.text,
    marginTop: 20,
    marginBottom: 12,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  emptySubtext: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  browseButton: {
    backgroundColor: theme.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  buttonIcon: {
    marginRight: 8,
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: theme.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.textSecondary,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
});