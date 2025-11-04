// screens/tabs/NotificationsScreen.js
import { FontAwesome as Icon, Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from "react";
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
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from "../../firebase/firebaseConfig";
import { supabase } from "../../supabase/supabaseClient";

const { width, height } = Dimensions.get('window');

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const user = auth.currentUser;

  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;

  const fetchNotifications = async (isRefreshing = false) => {
    if (!user?.email) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (!isRefreshing) setLoading(true);

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("receiver_id", user.email)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching notifications:", error);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const notificationsData = data || [];
    const uniqueSenders = Array.from(new Set(notificationsData.map(n => n.sender_id).filter(Boolean)));

    let senderMap = {};
    if (uniqueSenders.length > 0) {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('email,name')
        .in('email', uniqueSenders);

      if (usersError) {
        console.warn('Error fetching sender names:', usersError);
      } else if (usersData) {
        senderMap = usersData.reduce((acc, u) => {
          acc[u.email] = u.name;
          return acc;
        }, {});
      }
    }

    const annotated = notificationsData.map(n => ({
      ...n,
      sender_name: senderMap[n.sender_id] || null,
    }));

    setNotifications(annotated);
    setLoading(false);
    setRefreshing(false);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    fetchNotifications();

    if (!user?.email) return;

    const channel = supabase
      .channel("notifications-channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `receiver_id=eq.${user.email}`,
        },
        (payload) => {
          console.log("New notification received:", payload.new);
          setNotifications((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const navigateToMessaging = (params) => {
    try {
      navigation.navigate('Messaging', params);
      return;
    } catch (e) {}

    const parent = navigation.getParent && navigation.getParent();
    if (parent && parent.navigate) {
      parent.navigate('Messaging', params);
      return;
    }

    const grandParent = parent && parent.getParent && parent.getParent();
    if (grandParent && grandParent.navigate) {
      grandParent.navigate('Messaging', params);
      return;
    }

    try {
      navigation.navigate('Tabs', { screen: 'Messaging', params });
    } catch (err) {
      console.error('Failed to navigate to Messaging via any navigator:', err);
    }
  };

  const handleNotificationPress = async (notification) => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('name')
        .eq('email', notification.sender_id)
        .maybeSingle();

      if (userError) console.warn('Error fetching sender name:', userError);

      const receiverName = userData?.name || null;
      navigateToMessaging({ receiverId: notification.sender_id, receiverName });
    } catch (err) {
      console.error('Error navigating from notification:', err);
      navigateToMessaging({ receiverId: notification.sender_id });
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications(true);
  };

  const getNotificationIcon = (title) => {
    if (title.includes('Order') || title.includes('Checkout') || title.includes('Sold')) return 'shopping-cart';
    if (title.includes('Rent') || title.includes('Rental')) return 'calendar';
    if (title.includes('Message')) return 'envelope';
    if (title.includes('Review')) return 'star';
    return 'bell';
  };

  const getNotificationColor = (title) => {
    if (title.includes('Order') || title.includes('Checkout') || title.includes('Sold')) return theme.accent;
    if (title.includes('Rent') || title.includes('Rental')) return theme.rentalColor;
    if (title.includes('Message')) return theme.messageColor;
    if (title.includes('Review')) return theme.reviewColor;
    return theme.accent;
  };

  const getNotificationCategory = (title) => {
    if (title.includes('Order') || title.includes('Checkout') || title.includes('Sold')) return 'orders';
    if (title.includes('Rent') || title.includes('Rental')) return 'rentals';
    if (title.includes('Message')) return 'messages';
    return 'other';
  };

  const getFilteredNotifications = () => {
    if (filter === 'all') return notifications;
    return notifications.filter(n => getNotificationCategory(n.title) === filter);
  };

  const filteredNotifications = getFilteredNotifications();

  const todayCount = notifications.filter(n => {
    const now = new Date();
    const notifDate = new Date(n.created_at);
    const diffHours = (now - notifDate) / (1000 * 60 * 60);
    return diffHours < 24;
  }).length;

  const messageCount = notifications.filter(n => n.title.includes('Message')).length;

  const styles = createStyles(theme);

  const renderHeader = () => (
    <Animated.View 
      style={[
        styles.headerContainer,
        {
          opacity: headerAnim,
          transform: [{
            translateY: headerAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-20, 0]
            })
          }]
        }
      ]}
    >
      <View style={styles.headerBackground}>
        <View style={styles.gradientOverlay} />
      </View>

      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.brandContainer}>
          <Image
            source={require('../../assets/images/OfficialBuyNaBay.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Text style={styles.brandText}>BuyNaBay</Text>
        </View>
      </View>

      <View style={styles.welcomeContainer}>
        <Text style={styles.greetingText}>Notifications</Text>
        <Text style={styles.userNameText}>
          {user?.displayName || user?.email?.split('@')[0] || 'User'}
        </Text>
        <Text style={styles.descriptionText}>Stay updated with your activity</Text>
      </View>

      <View style={styles.summaryCards}>
        <View style={styles.summaryCard}>
          <View style={[styles.cardIcon, { backgroundColor: `${theme.accent}15` }]}>
            <Icon name="bell" size={18} color={theme.accent} />
          </View>
          <Text style={styles.cardValue}>{notifications.length}</Text>
          <Text style={styles.cardLabel}>Total</Text>
        </View>
        <View style={styles.summaryCard}>
          <View style={[styles.cardIcon, { backgroundColor: `${theme.rentalColor}15` }]}>
            <Icon name="clock-o" size={18} color={theme.rentalColor} />
          </View>
          <Text style={styles.cardValue}>{todayCount}</Text>
          <Text style={styles.cardLabel}>Today</Text>
        </View>
        <View style={styles.summaryCard}>
          <View style={[styles.cardIcon, { backgroundColor: `${theme.messageColor}15` }]}>
            <Icon name="envelope" size={18} color={theme.messageColor} />
          </View>
          <Text style={styles.cardValue}>{messageCount}</Text>
          <Text style={styles.cardLabel}>Messages</Text>
        </View>
      </View>

      {notifications.length > 0 && (
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
            onPress={() => setFilter('all')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              All
            </Text>
            {filter === 'all' && <View style={styles.filterDot} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filter === 'orders' && styles.filterChipActive]}
            onPress={() => setFilter('orders')}
            activeOpacity={0.7}
          >
            <Icon 
              name="shopping-cart" 
              size={12} 
              color={filter === 'orders' ? '#fff' : theme.textSecondary} 
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.filterText, filter === 'orders' && styles.filterTextActive]}>
              Orders
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filter === 'rentals' && styles.filterChipActive]}
            onPress={() => setFilter('rentals')}
            activeOpacity={0.7}
          >
            <Icon 
              name="calendar" 
              size={12} 
              color={filter === 'rentals' ? '#fff' : theme.textSecondary} 
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.filterText, filter === 'rentals' && styles.filterTextActive]}>
              Rentals
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filter === 'messages' && styles.filterChipActive]}
            onPress={() => setFilter('messages')}
            activeOpacity={0.7}
          >
            <Icon 
              name="envelope" 
              size={12} 
              color={filter === 'messages' ? '#fff' : theme.textSecondary} 
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.filterText, filter === 'messages' && styles.filterTextActive]}>
              Messages
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );

  const renderItem = ({ item, index }) => {
    const senderDisplay = item.sender_name || item.sender_id;
    let displayMessage = item.message || '';
    if (item.sender_id && displayMessage.includes(item.sender_id)) {
      displayMessage = displayMessage.replace(item.sender_id, senderDisplay);
    }

    const iconName = getNotificationIcon(item.title);
    const iconColor = getNotificationColor(item.title);

    const notifDate = new Date(item.created_at);
    const now = new Date();
    const diffMs = now - notifDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    let timeAgo;
    if (diffMins < 1) timeAgo = 'Just now';
    else if (diffMins < 60) timeAgo = `${diffMins}m ago`;
    else if (diffHours < 24) timeAgo = `${diffHours}h ago`;
    else if (diffDays < 7) timeAgo = `${diffDays}d ago`;
    else timeAgo = notifDate.toLocaleDateString();

    const isNew = diffHours < 24;

    return (
      <Animated.View 
        style={[
          styles.itemContainer,
          {
            opacity: fadeAnim,
            transform: [{
              translateY: slideAnim.interpolate({
                inputRange: [0, 50],
                outputRange: [0, 50 + index * 5]
              })
            }]
          }
        ]}
      >
        <TouchableOpacity
          onPress={() => handleNotificationPress(item)}
          activeOpacity={0.8}
          style={[styles.notificationCard, isNew && styles.notificationCardNew]}
        >
          <View style={[styles.iconCircle, { backgroundColor: `${iconColor}20` }]}>
            <Icon name={iconName} size={22} color={iconColor} />
          </View>

          <View style={styles.contentArea}>
            <View style={styles.headerRow}>
              <Text style={styles.titleText} numberOfLines={1}>
                {item.title}
              </Text>
              {isNew && <View style={styles.newBadge} />}
            </View>

            <Text style={styles.messageText} numberOfLines={2}>
              {displayMessage}
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.timeRow}>
                <Icon name="clock-o" size={11} color={theme.textSecondary} />
                <Text style={styles.timeText}> {timeAgo}</Text>
              </View>
              <View style={styles.actionHint}>
                <Text style={styles.hintText}>Tap to open</Text>
                <Ionicons name="chevron-forward" size={14} color={theme.accent} />
              </View>
            </View>
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
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <View style={styles.emptyIconContainer}>
        <Icon name="bell-slash" size={72} color={theme.iconPlaceholder} />
      </View>
      <Text style={styles.emptyTitle}>No Notifications Yet</Text>
      <Text style={styles.emptyDescription}>
        You're all caught up! Notifications about your orders and activity will appear here.
      </Text>
      <TouchableOpacity
        style={styles.exploreButton}
        onPress={() => navigation.navigate('Home')}
        activeOpacity={0.8}
      >
        <Icon name="shopping-bag" size={18} color="#fff" style={{ marginRight: 10 }} />
        <Text style={styles.exploreButtonText}>Explore Products</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
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
          data={filteredNotifications}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
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

const darkTheme = {
  background: '#0f0f2e',
  headerBackground: '#1b1b41',
  text: '#ffffff',
  textSecondary: '#a8a8c8',
  cardBackground: '#1e1e3f',
  cardBackgroundNew: '#252550',
  accent: '#FDAD00',
  rentalColor: '#4CAF50',
  messageColor: '#3b82f6',
  reviewColor: '#f59e0b',
  border: '#2a2a4a',
  iconPlaceholder: '#4a4a6a',
  newBadge: '#4CAF50',
};

const lightTheme = {
  background: '#f8f9fa',
  headerBackground: '#e8ecf1',
  text: '#1a1a2e',
  textSecondary: '#6b7280',
  cardBackground: '#ffffff',
  cardBackgroundNew: '#fffbf0',
  accent: '#f39c12',
  rentalColor: '#27ae60',
  messageColor: '#3b82f6',
  reviewColor: '#f59e0b',
  border: '#e5e7eb',
  iconPlaceholder: '#9ca3af',
  newBadge: '#27ae60',
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  listContent: {
    paddingBottom: 24,
  },
  headerContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  headerBackground: {
    height: Platform.OS === 'ios' ? 360 : 380,
    backgroundColor: theme.headerBackground,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.03,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 12 : 20,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandLogo: {
    width: 28,
    height: 28,
    marginRight: 8,
  },
  brandText: {
    fontSize: 17,
    fontWeight: Platform.OS === 'android' ? '900' : '800',
    color: theme.text,
    letterSpacing: -0.3,
  },
  welcomeContainer: {
    paddingHorizontal: 20,
    paddingTop: 70,
    paddingBottom: 24,
  },
  greetingText: {
    fontSize: 15,
    color: theme.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  userNameText: {
    fontSize: Math.min(width * 0.075, 30),
    fontWeight: Platform.OS === 'android' ? '900' : '800',
    color: theme.text,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  descriptionText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '400',
  },
  summaryCards: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    color: theme.text,
    marginTop: 4,
  },
  cardLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    flexWrap: 'wrap',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  filterChipActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
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
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  filterTextActive: {
    color: '#fff',
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginLeft: 6,
  },
  itemContainer: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  notificationCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  notificationCardNew: {
    backgroundColor: theme.cardBackgroundNew,
    borderColor: theme.accent,
    borderWidth: 1.5,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  contentArea: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
  },
  newBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.newBadge,
    marginLeft: 8,
  },
  messageText: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  actionHint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hintText: {
    fontSize: 12,
    color: theme.accent,
    marginRight: 4,
    fontWeight: '600',
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
    backgroundColor: theme.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
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
  exploreButton: {
    backgroundColor: theme.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 24,
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
  exploreButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: theme.textSecondary,
    fontWeight: '500',
  },
});