// screens/InboxScreen.js
import { FontAwesome as Icon, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
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
import { darkTheme, lightTheme } from '../../theme/theme';
import { fontFamily } from '../../theme/typography';

const { width } = Dimensions.get('window');

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
  const [userProfileImage, setUserProfileImage] = useState(null);
  
  const user = auth.currentUser;
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  // Animation refs
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const searchSlideAnim = useRef(new Animated.Value(0)).current;
  const listSlideAnim = useRef(new Animated.Value(50)).current;

  // Fetch user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user?.email) {
        const { data, error } = await supabase
          .from('users')
          .select('profile_photo')
          .eq('email', user.email)
          .single();
        if (!error && data) {
          setUserProfileImage(data.profile_photo);
        }
      }
    };
    fetchUserProfile();
  }, [user]);

  // Initial animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerSlideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(listSlideAnim, {
        toValue: 0,
        duration: 600,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!user) return;

    if (!refreshing) setLoading(true);

    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, text, created_at, read')
      .or(`sender_id.eq.${user.email},receiver_id.eq.${user.email}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch messages error:', error);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const usersSet = new Set();
    const lastMsgs = {};
    const unreadCount = {};

    messages.forEach((msg) => {
      const otherUser = msg.sender_id === user.email ? msg.receiver_id : msg.sender_id;
      usersSet.add(otherUser);

      // Track last message
      if (!lastMsgs[otherUser] || new Date(msg.created_at) > new Date(lastMsgs[otherUser].created_at)) {
        lastMsgs[otherUser] = {
          id: msg.id,
          text: msg.text,
          created_at: msg.created_at,
          sender_id: msg.sender_id,
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
      usersData?.forEach((u) => {
        nameMap[u.email] = u;
      });
      setUserNames(nameMap);
    }

    setLoading(false);
    setRefreshing(false);
  }, [user, refreshing]);

  // Refresh on screen focus
  useFocusEffect(
    useCallback(() => {
      fetchConversations();
      const interval = setInterval(fetchConversations, 5000);
      return () => clearInterval(interval);
    }, [fetchConversations])
  );

  // Search filter
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredConversations(conversations);
    } else {
      const filtered = conversations.filter((item) => {
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
  }, [fetchConversations]);

  // Toggle search bar
  const toggleSearch = () => {
    const newValue = !searchVisible;
    setSearchVisible(newValue);

    Animated.spring(searchSlideAnim, {
      toValue: newValue ? 1 : 0,
      useNativeDriver: false,
      tension: 60,
      friction: 8,
    }).start();

    if (!newValue) {
      setSearchQuery('');
    }
  };

  // Clear unread messages for a conversation
  const clearUnread = async (otherUser) => {
    setUnreadMessages((prev) => ({ ...prev, [otherUser]: 0 }));

    await supabase
      .from('messages')
      .update({ read: true })
      .eq('receiver_id', user.email)
      .eq('sender_id', otherUser)
      .is('read', false);
  };

  // Format relative time
  const getRelativeTime = (timestamp) => {
    const now = new Date();
    const msgDate = new Date(timestamp);
    const diffMs = now - msgDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return msgDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const styles = createStyles(theme, isDarkMode);

  // Calculate total unread
  const totalUnread = Object.values(unreadMessages).reduce((sum, count) => sum + count, 0);

  const renderHeader = () => (
    <Animated.View
      style={[
        styles.headerContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: headerSlideAnim }],
        },
      ]}
    >
      {/* Gradient Background */}
      <View style={styles.backgroundGradient}>
        <View style={styles.gradientOverlay} />
      </View>

      {/* Top Navigation Bar */}
      <View style={styles.topNavBar}>
        <View style={styles.brandedLogoContainer}>
          <View style={styles.logoWrapper}>
            <Image
              source={require('../../assets/images/OfficialBuyNaBay.png')}
              style={styles.brandedLogoImage}
              resizeMode="contain"
            />
          </View>
          <View>
            <Text style={[styles.brandedLogoText, { fontFamily: fontFamily.extraBold }]}>
              BuyNaBay
            </Text>
            <Text style={[styles.brandedSubtext, { fontFamily: fontFamily.medium }]}>
              Messages
            </Text>
          </View>
        </View>

        <View style={styles.headerActionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={toggleSearch}
            activeOpacity={0.7}
          >
            <Ionicons name={searchVisible ? 'close' : 'search-outline'} size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('ProfileScreen')} activeOpacity={0.8}>
            <View style={styles.profileImageWrapper}>
              <Image
                source={
                  userProfileImage
                    ? { uri: userProfileImage }
                    : require('../../assets/images/OfficialBuyNaBay.png')
                }
                style={styles.profileImage}
              />
              <View style={styles.onlineIndicator} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      {searchVisible && (
        <Animated.View
          style={[
            styles.searchContainer,
            {
              opacity: searchSlideAnim,
              transform: [
                {
                  translateY: searchSlideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Icon name="search" size={16} color={theme.inputIcon} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { fontFamily: fontFamily.medium }]}
            placeholder="Search conversations..."
            placeholderTextColor={theme.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={18} color={theme.inputIcon} />
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {/* Summary Cards */}
      <View style={styles.summaryCards}>
        <Animated.View style={[styles.summaryCard, { transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.cardIconContainer, { backgroundColor: `${theme.accent}15` }]}>
            <Ionicons name="chatbubbles" size={18} color={theme.accent} />
          </View>
          <Text style={[styles.cardValue, { fontFamily: fontFamily.bold }]}>
            {conversations.length}
          </Text>
          <Text style={[styles.cardLabel, { fontFamily: fontFamily.medium }]}>Active</Text>
        </Animated.View>

        <Animated.View style={[styles.summaryCard, { transform: [{ scale: scaleAnim }] }]}>
          <View
            style={[
              styles.cardIconContainer,
              totalUnread > 0 && { backgroundColor: theme.accent },
            ]}
          >
            <Ionicons
              name="mail"
              size={18}
              color={totalUnread > 0 ? '#fff' : theme.accent}
            />
          </View>
          <Text
            style={[
              styles.cardValue,
              { fontFamily: fontFamily.bold },
              totalUnread > 0 && { color: theme.accent },
            ]}
          >
            {totalUnread}
          </Text>
          <Text style={[styles.cardLabel, { fontFamily: fontFamily.medium }]}>Unread</Text>
        </Animated.View>

        <Animated.View style={[styles.summaryCard, { transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.cardIconContainer, { backgroundColor: `${theme.success}15` }]}>
            <Ionicons name="time-outline" size={18} color={theme.success} />
          </View>
          <Text style={[styles.cardValue, { fontFamily: fontFamily.bold }]}>
            {conversations.length > 0
              ? getRelativeTime(
                  Math.max(...Object.values(lastMessages).map((m) => new Date(m.created_at).getTime()))
                )
              : '-'}
          </Text>
          <Text style={[styles.cardLabel, { fontFamily: fontFamily.medium }]}>Latest</Text>
        </Animated.View>
      </View>

      {/* Section Divider */}
      {filteredConversations.length > 0 && (
        <View style={styles.sectionDivider}>
          <View style={styles.dividerLine} />
          <Text style={[styles.dividerText, { fontFamily: fontFamily.bold }]}>
            Recent Chats
          </Text>
          <View style={styles.dividerLine} />
        </View>
      )}
    </Animated.View>
  );

  const renderConversation = ({ item, index }) => {
    const userData = userNames[item];
    const lastMsgData = lastMessages[item];
    const unreadCount = unreadMessages[item] || 0;

    const relativeTime = lastMsgData ? getRelativeTime(lastMsgData.created_at) : 'Now';
    const lastText = lastMsgData?.text || 'No messages yet';
    const isUnread = unreadCount > 0;
    const isSentByMe = lastMsgData?.sender_id === user.email;

    return (
      <Animated.View
        style={[
          styles.conversationContainer,
          {
            opacity: fadeAnim,
            transform: [
              {
                translateY: listSlideAnim.interpolate({
                  inputRange: [0, 50],
                  outputRange: [0, 50 + index * 10],
                }),
              },
              { scale: scaleAnim },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.conversationCard, isUnread && styles.conversationCardUnread]}
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
                uri:
                  userData?.profile_photo ||
                  'https://cdn-icons-png.flaticon.com/512/149/149071.png',
              }}
              style={styles.avatarImage}
            />
            {isUnread && <View style={styles.onlineDot} />}
            {unreadCount > 0 && (
              <View style={styles.avatarBadge}>
                <Text style={[styles.avatarBadgeText, { fontFamily: fontFamily.bold }]}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </View>

          {/* Chat Content */}
          <View style={styles.chatContent}>
            <View style={styles.chatHeader}>
              <Text
                style={[styles.chatName, { fontFamily: fontFamily.semiBold }]}
                numberOfLines={1}
              >
                {userData?.name || item}
              </Text>
              <Text style={[styles.chatTime, { fontFamily: fontFamily.medium }]}>
                {relativeTime}
              </Text>
            </View>

            <View style={styles.messageRow}>
              {isSentByMe && (
                <Ionicons
                  name="checkmark-done"
                  size={14}
                  color={theme.textSecondary}
                  style={styles.checkIcon}
                />
              )}
              <Text
                style={[
                  styles.messageText,
                  { fontFamily: isUnread ? fontFamily.semiBold : fontFamily.regular },
                  isUnread && styles.messageTextBold,
                ]}
                numberOfLines={1}
              >
                {isSentByMe && (
                  <Text style={[styles.youLabel, { fontFamily: fontFamily.medium }]}>You: </Text>
                )}
                {lastText}
              </Text>
            </View>
          </View>

          {/* Action Indicator */}
          <View style={styles.chevronContainer}>
            <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderEmptyState = () => (
    <Animated.View
      style={[
        styles.emptyState,
        {
          opacity: fadeAnim,
          transform: [{ translateY: listSlideAnim }, { scale: scaleAnim }],
        },
      ]}
    >
      <View style={styles.emptyIconContainer}>
        <Ionicons name="chatbubbles-outline" size={72} color={theme.iconPlaceholder} />
      </View>
      <Text style={[styles.emptyTitle, { fontFamily: fontFamily.bold }]}>
        No Messages Yet
      </Text>
      <Text style={[styles.emptyDescription, { fontFamily: fontFamily.medium }]}>
        Start connecting with buyers and sellers.{'\n'}Your conversations will appear here.
      </Text>
      <TouchableOpacity
        style={styles.ctaButton}
        onPress={() => navigation.navigate('Home')}
        activeOpacity={0.8}
      >
        <View style={styles.ctaGradient}>
          <Ionicons name="storefront-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={[styles.ctaText, { fontFamily: fontFamily.bold }]}>
            Browse Marketplace
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  // Full-screen loading
  if (loading && !refreshing) {
    return (
      <>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={theme.background}
          translucent={false}
        />
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.loadingText, { fontFamily: fontFamily.semiBold }]}>
            Loading messages...
          </Text>
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
      <SafeAreaView style={styles.container} edges={['top']}>
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item}
          renderItem={renderConversation}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={Platform.OS === 'android'}
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

const createStyles = (theme, isDarkMode) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    listContent: {
      paddingBottom: 24,
      flexGrow: 1,
    },
    loadingScreen: {
      flex: 1,
      backgroundColor: theme.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 16,
      fontSize: 15,
      color: theme.textSecondary,
    },
    headerContainer: {
      position: 'relative',
      marginBottom: 20,
      paddingBottom: 16,
    },
    backgroundGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 260,
      backgroundColor: theme.gradientBackground,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
      overflow: 'hidden',
    },
    gradientOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.08,
    },
    topNavBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 12,
      marginBottom: 16,
    },
    brandedLogoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    logoWrapper: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: 'rgba(253, 173, 0, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: theme.accent,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    brandedLogoImage: {
      width: 26,
      height: 26,
    },
    brandedLogoText: {
      fontSize: 18,
      color: theme.accent,
      letterSpacing: -0.4,
      lineHeight: 22,
    },
    brandedSubtext: {
      fontSize: 10,
      color: theme.textSecondary,
      letterSpacing: 0.2,
      marginTop: -1,
    },
    headerActionsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    actionButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.accent,
      justifyContent: 'center',
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: theme.accent,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        },
        android: {
          elevation: 5,
        },
      }),
    },
    profileImageWrapper: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: theme.accent,
      padding: 2,
      backgroundColor: theme.cardBackground,
      position: 'relative',
      ...Platform.select({
        ios: {
          shadowColor: theme.accent,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    profileImage: {
      width: '100%',
      height: '100%',
      borderRadius: 18,
    },
    onlineIndicator: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.success,
      borderWidth: 2.5,
      borderColor: theme.gradientBackground,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.inputBackground,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginHorizontal: 20,
      marginBottom: 16,
      borderWidth: 1.5,
      borderColor: theme.borderColor,
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
    searchIcon: {
      marginRight: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
    },
    summaryCards: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      gap: 12,
      marginBottom: 16,
    },
    summaryCard: {
      flex: 1,
      backgroundColor: theme.cardBackground,
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    cardIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    cardValue: {
      fontSize: 20,
      color: theme.text,
      marginTop: 4,
    },
    cardLabel: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 2,
    },
    sectionDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: isDarkMode ? 'rgba(253, 173, 0, 0.2)' : 'rgba(0, 0, 0, 0.08)',
    },
    dividerText: {
      fontSize: 11,
      color: theme.textSecondary,
      paddingHorizontal: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    conversationContainer: {
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    conversationCard: {
      backgroundColor: theme.cardBackground,
      borderRadius: 16,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: isDarkMode ? 'rgba(253, 173, 0, 0.1)' : 'rgba(0, 0, 0, 0.05)',
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    conversationCardUnread: {
      borderColor: theme.accent,
      backgroundColor: isDarkMode ? 'rgba(253, 173, 0, 0.05)' : 'rgba(253, 173, 0, 0.08)',
      ...Platform.select({
        ios: {
          shadowColor: theme.accent,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    avatarWrapper: {
      position: 'relative',
      marginRight: 14,
    },
    avatarImage: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 2,
      borderColor: isDarkMode ? 'rgba(253, 173, 0, 0.2)' : 'rgba(0, 0, 0, 0.08)',
    },
    onlineDot: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: theme.success,
      borderWidth: 2.5,
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
    },
    chatContent: {
      flex: 1,
    },
    chatHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    chatName: {
      fontSize: 16,
      color: theme.text,
      flex: 1,
    },
    chatTime: {
      fontSize: 12,
      color: theme.textSecondary,
      marginLeft: 8,
    },
    messageRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    checkIcon: {
      marginRight: 6,
    },
    messageText: {
      fontSize: 14,
      color: theme.textSecondary,
      flex: 1,
    },
    messageTextBold: {
      color: theme.text,
    },
    youLabel: {
      fontStyle: 'italic',
      color: theme.textTertiary,
    },
    chevronContainer: {
      marginLeft: 8,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
      paddingVertical: 80,
    },
    emptyIconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: isDarkMode ? 'rgba(42, 40, 86, 0.6)' : 'rgba(245, 245, 245, 1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
      borderWidth: 3,
      borderColor: isDarkMode ? 'rgba(253, 173, 0, 0.2)' : 'rgba(0, 0, 0, 0.08)',
      borderStyle: 'dashed',
    },
    emptyTitle: {
      fontSize: 24,
      color: theme.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    emptyDescription: {
      fontSize: 15,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 32,
      paddingHorizontal: 20,
    },
    ctaButton: {
      borderRadius: 16,
      overflow: 'hidden',
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
    ctaGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 32,
      backgroundColor: theme.accent,
    },
    ctaText: {
      color: '#fff',
      fontSize: 16,
    },
  });