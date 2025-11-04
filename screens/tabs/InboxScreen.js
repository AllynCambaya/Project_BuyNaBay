// screens/InboxScreen.js
import { FontAwesome as Icon } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

const { width, height } = Dimensions.get('window');

export default function InboxScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [userNames, setUserNames] = useState({});
  const [lastMessages, setLastMessages] = useState({});
  const [unreadMessages, setUnreadMessages] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const user = auth.currentUser;

  // Animation refs
  const searchAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
    setFilteredConversations(userList);
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
    
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [user]);

  // Search filter
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredConversations(conversations);
    } else {
      const filtered = conversations.filter(item => {
        const userData = userNames[item];
        const name = userData?.name || item;
        return name.toLowerCase().includes(searchQuery.toLowerCase());
      });
      setFilteredConversations(filtered);
    }
  }, [searchQuery, conversations, userNames]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConversations();
    setRefreshing(false);
  }, [user]);

  // Toggle search bar
  const toggleSearch = () => {
    const newValue = !searchVisible;
    setSearchVisible(newValue);
    
    Animated.spring(searchAnim, {
      toValue: newValue ? 1 : 0,
      useNativeDriver: false,
      tension: 50,
      friction: 7,
    }).start();
    
    if (!newValue) {
      setSearchQuery('');
    }
  };

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

  // Format relative time
  const getRelativeTime = (timestamp) => {
    const now = new Date();
    const msgDate = new Date(timestamp);
    const diffMs = now - msgDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    return msgDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Gradient Background */}
      <View style={styles.backgroundGradient} />

      {/* Top Navigation Bar */}
      <View style={styles.topNav}>
        <View style={styles.brandSection}>
          <Image
            source={require('../../assets/images/OfficialBuyNaBay.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Text style={styles.brandText}>BuyNaBay</Text>
        </View>
        
        <View style={styles.navActions}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={toggleSearch}
            activeOpacity={0.7}
          >
            <Icon name={searchVisible ? "times" : "search"} size={18} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      {searchVisible && (
        <Animated.View 
          style={[
            styles.searchContainer,
            {
              opacity: searchAnim,
              transform: [{
                translateY: searchAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0],
                }),
              }],
            }
          ]}
        >
          <Icon name="search" size={16} color={theme.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="times-circle" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {/* Welcome Section */}
      <View style={styles.welcomeSection}>
        <Text style={styles.greetingText}>Messages</Text>
        <Text style={styles.userNameText}>
          {user?.displayName || user?.email?.split('@')[0] || 'User'}
        </Text>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <View style={styles.statIconContainer}>
            <Icon name="comments" size={16} color={theme.accent} />
          </View>
          <View style={styles.statContent}>
            <Text style={styles.statValue}>{conversations.length}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
        </View>

        <View style={styles.statPill}>
          <View style={[styles.statIconContainer, totalUnread > 0 && styles.statIconActive]}>
            <Icon name="envelope" size={16} color={totalUnread > 0 ? '#fff' : theme.accent} />
          </View>
          <View style={styles.statContent}>
            <Text style={[styles.statValue, totalUnread > 0 && styles.statValueActive]}>
              {totalUnread}
            </Text>
            <Text style={styles.statLabel}>Unread</Text>
          </View>
        </View>

        <View style={styles.statPill}>
          <View style={styles.statIconContainer}>
            <Icon name="clock-o" size={16} color={theme.accent} />
          </View>
          <View style={styles.statContent}>
            <Text style={styles.statValue}>
              {conversations.length > 0 ? getRelativeTime(
                Math.max(...Object.values(lastMessages).map(m => new Date(m.created_at).getTime()))
              ) : '-'}
            </Text>
            <Text style={styles.statLabel}>Latest</Text>
          </View>
        </View>
      </View>

      {/* Section Divider */}
      {filteredConversations.length > 0 && (
        <View style={styles.sectionDivider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Recent Chats</Text>
          <View style={styles.dividerLine} />
        </View>
      )}
    </View>
  );

  const renderConversation = ({ item, index }) => {
    const userData = userNames[item];
    const lastMsgData = lastMessages[item];
    const unreadCount = unreadMessages[item] || 0;
    
    const relativeTime = lastMsgData ? getRelativeTime(lastMsgData.created_at) : 'Now';
    
    const lastText = lastMsgData?.text 
      ? lastMsgData.text 
      : lastMsgData ? '📦 Product Inquiry' : 'No messages yet';
    const isUnread = unreadCount > 0;
    const isSentByMe = lastMsgData?.sender_id === user.email;

    return (
      <Animated.View style={{ opacity: fadeAnim }}>
        <TouchableOpacity
          style={[
            styles.chatCard,
            isUnread && styles.chatCardUnread,
          ]}
          activeOpacity={0.8}
          onPress={() => {
            navigation.navigate('Messaging', {
              receiverId: item,
              receiverName: userData?.name || item,
            });
            clearUnread(item);
          }}
        >
          {/* Avatar Section */}
          <View style={styles.avatarWrapper}>
            <Image
              source={{
                uri: userData?.profile_photo || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
              }}
              style={styles.avatarImage}
            />
            {isUnread && <View style={styles.onlineDot} />}
            {unreadCount > 0 && (
              <View style={styles.avatarBadge}>
                <Text style={styles.avatarBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </View>

          {/* Chat Content */}
          <View style={styles.chatContent}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatName} numberOfLines={1}>
                {userData?.name || item}
              </Text>
              <Text style={styles.chatTime}>{relativeTime}</Text>
            </View>
            
            <View style={styles.messageRow}>
              {isSentByMe && (
                <Icon 
                  name="check" 
                  size={12} 
                  color={theme.textSecondary} 
                  style={styles.checkIcon}
                />
              )}
              <Text 
                style={[
                  styles.messageText,
                  isUnread && styles.messageTextBold
                ]} 
                numberOfLines={1}
              >
                {isSentByMe && <Text style={styles.youLabel}>You: </Text>}
                {lastText}
              </Text>
            </View>
          </View>

          {/* Action Indicator */}
          <View style={styles.chevronContainer}>
            <Icon 
              name="chevron-right" 
              size={14} 
              color={theme.textTertiary} 
            />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconCircle}>
        <Icon name="comments-o" size={48} color={theme.accent} />
      </View>
      <Text style={styles.emptyTitle}>No Messages Yet</Text>
      <Text style={styles.emptySubtext}>
        Start connecting with buyers and sellers.{'\n'}Your conversations will appear here.
      </Text>
      <TouchableOpacity
        style={styles.ctaButton}
        onPress={() => navigation.navigate('Home')}
        activeOpacity={0.85}
      >
        <Icon name="shopping-bag" size={16} color="#fff" style={styles.ctaIcon} />
        <Text style={styles.ctaText}>Browse Products</Text>
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
        <View style={styles.loadingScreen}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
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
      <SafeAreaView style={styles.container}>
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item}
          renderItem={renderConversation}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={styles.listContainer}
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

// Dark theme colors (Poppins-inspired, modern marketplace aesthetic)
const darkTheme = {
  background: '#0a0e27',
  gradientBackground: '#141b3c',
  text: '#ffffff',
  textSecondary: '#a8b2d1',
  textTertiary: '#6b7280',
  cardBackground: '#1a1f3a',
  cardBackgroundUnread: '#1e2544',
  accent: '#FDAD00',
  accentDark: '#e89b00',
  success: '#10b981',
  shadowColor: '#000',
  border: '#252b47',
  borderUnread: '#FDAD00',
  divider: '#2d3548',
  onlineDot: '#10b981',
  pillBackground: '#1e2544',
};

// Light theme colors (clean, professional marketplace design)
const lightTheme = {
  background: '#f8fafc',
  gradientBackground: '#ffffff',
  text: '#1e293b',
  textSecondary: '#64748b',
  textTertiary: '#94a3b8',
  cardBackground: '#ffffff',
  cardBackgroundUnread: '#fffbf0',
  accent: '#f59e0b',
  accentDark: '#d97706',
  success: '#10b981',
  shadowColor: '#000',
  border: '#e2e8f0',
  borderUnread: '#f59e0b',
  divider: '#e2e8f0',
  onlineDot: '#10b981',
  pillBackground: '#f1f5f9',
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  listContainer: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  
  // Header Styles
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 20,
    position: 'relative',
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 280 : 300,
    backgroundColor: theme.gradientBackground,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  
  // Top Navigation
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    zIndex: 10,
  },
  brandSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandLogo: {
    width: 36,
    height: 36,
    marginRight: 10,
  },
  brandText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.accent,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    letterSpacing: -0.5,
  },
  navActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
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
  
  // Search Bar
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: theme.text,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  
  // Welcome Section
  welcomeSection: {
    marginBottom: 20,
  },
  greetingText: {
    fontSize: 15,
    color: theme.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  userNameText: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.text,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    letterSpacing: -0.5,
  },
  
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.pillBackground,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${theme.accent}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  statIconActive: {
    backgroundColor: theme.accent,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  statValueActive: {
    color: theme.accent,
  },
  statLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 1,
    fontWeight: '500',
  },
  
  // Section Divider
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.divider,
  },
  dividerText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '600',
    paddingHorizontal: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // Chat Card
  chatCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  chatCardUnread: {
    borderColor: theme.borderUnread,
    backgroundColor: theme.cardBackgroundUnread,
    borderWidth: 1.5,
  },
  
  // Avatar
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatarImage: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: theme.border,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.onlineDot,
    borderWidth: 2,
    borderColor: theme.cardBackground,
  },
  avatarBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: theme.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: theme.cardBackground,
  },
  avatarBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  
  // Chat Content
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  chatTime: {
    fontSize: 12,
    color: theme.textSecondary,
    marginLeft: 8,
    fontWeight: '500',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkIcon: {
    marginRight: 4,
  },
  messageText: {
    fontSize: 14,
    color: theme.textSecondary,
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  messageTextBold: {
    color: theme.text,
    fontWeight: '500',
  },
  youLabel: {
    fontStyle: 'italic',
    color: theme.textTertiary,
  },
  
  // Chevron
  chevronContainer: {
    marginLeft: 8,
  },
  
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 80,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${theme.accent}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  emptySubtext: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  ctaButton: {
    backgroundColor: theme.accent,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  ctaIcon: {
    marginRight: 8,
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  
  // Loading Screen
  loadingScreen: {
    flex: 1,
    backgroundColor: theme.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: theme.textSecondary,
    fontWeight: '500',
  },
});