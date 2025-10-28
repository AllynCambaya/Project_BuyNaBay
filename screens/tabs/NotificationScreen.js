// screens/tabs/NotificationsScreen.js
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
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
} from "react-native";
import Icon from 'react-native-vector-icons/FontAwesome';
import { auth } from "../../firebase/firebaseConfig";
import { supabase } from "../../supabase/supabaseClient";

const { width, height } = Dimensions.get('window');

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const user = auth.currentUser;

  // Automatically detect system theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';

  // Get current theme colors based on system settings
  const theme = isDarkMode ? darkTheme : lightTheme;

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Fetch notifications
  const fetchNotifications = async (isRefreshing = false) => {
    if (!user?.email) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (!isRefreshing) setLoading(true);

    // Get notifications for this user
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

    // Collect unique sender emails to fetch their display names in one query
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

    // Attach sender_name to each notification
    const annotated = notificationsData.map(n => ({
      ...n,
      sender_name: senderMap[n.sender_id] || null,
    }));

    setNotifications(annotated);
    setLoading(false);
    setRefreshing(false);

    // Trigger animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    fetchNotifications();

    if (!user?.email) return;

    // Real-time subscription for new notifications
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
    // Try current navigator, then parent, then grandparent — whichever has the route registered.
    try {
      navigation.navigate('Messaging', params);
      return;
    } catch (e) {
      // ignore and try parent
    }

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

    // Last resort: attempt to navigate to Tabs -> Messaging if app uses nested tabs
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
    if (title.includes('Order') || title.includes('Checkout')) return 'shopping-cart';
    if (title.includes('Rent') || title.includes('Rental')) return 'calendar';
    if (title.includes('Message')) return 'envelope';
    if (title.includes('Review')) return 'star';
    return 'bell';
  };

  const getNotificationColor = (title) => {
    if (title.includes('Order') || title.includes('Checkout')) return theme.accent;
    if (title.includes('Rent') || title.includes('Rental')) return theme.historyColor;
    if (title.includes('Message')) return '#3a7bd5';
    if (title.includes('Review')) return '#f39c12';
    return theme.accent;
  };

  const styles = createStyles(theme);

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Background gradient effect */}
      <View style={styles.backgroundGradient} />

      {/* Back Button - upper left */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
        activeOpacity={0.85}
      >
        <Ionicons name="arrow-back" size={22} color={theme.text} />
      </TouchableOpacity>

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
        <Text style={styles.welcomeText}>Notifications</Text>
        <Text style={styles.userName}>
          {user?.displayName || user?.email?.split('@')[0] || 'User'}
        </Text>
        <Text style={styles.subtitle}>Stay updated with your activity</Text>
      </View>

      {/* Stats Section */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Icon name="bell" size={20} color={theme.accent} />
          <Text style={styles.statValue}>{notifications.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="clock-o" size={20} color={theme.historyColor} />
          <Text style={styles.statValue}>
            {notifications.filter(n => {
              const now = new Date();
              const notifDate = new Date(n.created_at);
              const diffHours = (now - notifDate) / (1000 * 60 * 60);
              return diffHours < 24;
            }).length}
          </Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="envelope" size={20} color="#3a7bd5" />
          <Text style={styles.statValue}>
            {notifications.filter(n => n.title.includes('Message')).length}
          </Text>
          <Text style={styles.statLabel}>Messages</Text>
        </View>
      </View>

      {/* Section Title */}
      {notifications.length > 0 && (
        <View style={styles.sectionTitleContainer}>
          <Icon name="list" size={18} color={theme.text} />
          <Text style={styles.sectionTitle}> Recent Activity</Text>
        </View>
      )}
    </View>
  );

  const renderItem = ({ item, index }) => {
    const senderDisplay = item.sender_name || item.sender_id;
    let displayMessage = item.message || '';
    if (item.sender_id && displayMessage.includes(item.sender_id)) {
      displayMessage = displayMessage.replace(item.sender_id, senderDisplay);
    }

    const iconName = getNotificationIcon(item.title);
    const iconColor = getNotificationColor(item.title);

    const animatedStyle = {
      opacity: fadeAnim,
      transform: [
        {
          translateY: slideAnim.interpolate({
            inputRange: [0, 50],
            outputRange: [0, 50],
          }),
        },
      ],
    };

    // Format date
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

    return (
      <Animated.View style={[animatedStyle, { paddingHorizontal: Math.max(width * 0.05, 20) }]}>
        <TouchableOpacity
          onPress={() => handleNotificationPress(item)}
          activeOpacity={0.85}
          style={styles.card}
        >
          <View style={styles.cardContent}>
            <View style={[styles.iconContainer, { backgroundColor: `${iconColor}20` }]}>
              <Icon name={iconName} size={24} color={iconColor} />
            </View>
            
            <View style={styles.textContent}>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <View style={styles.unreadDot} />
              </View>
              
              <Text style={styles.message} numberOfLines={2}>
                {displayMessage}
              </Text>
              
              <View style={styles.footerRow}>
                <View style={styles.timeContainer}>
                  <Icon name="clock-o" size={12} color={theme.textSecondary} />
                  <Text style={styles.timeText}> {timeAgo}</Text>
                </View>
                <View style={styles.actionIndicator}>
                  <Text style={styles.actionText}>Tap to view</Text>
                  <Ionicons name="chevron-forward" size={14} color={theme.accent} />
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="bell-slash" size={64} color={theme.textSecondary} />
      <Text style={styles.emptyTitle}>No Notifications Yet</Text>
      <Text style={styles.emptySubtext}>
        You're all caught up! Notifications about your orders and rentals will appear here.
      </Text>
      <TouchableOpacity
        style={styles.exploreButton}
        onPress={() => navigation.navigate('Home')}
        activeOpacity={0.85}
      >
        <Icon name="shopping-bag" size={16} color="#fff" style={styles.buttonIcon} />
        <Text style={styles.exploreButtonText}>Explore Products</Text>
      </TouchableOpacity>
    </View>
  );

  // Full-screen loading overlay
  if (loading && !refreshing) {
    return (
      <View style={styles.loadingOverlay}>
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
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={notifications}
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

// Dark theme colors (matching CartScreen)
const darkTheme = {
  background: '#0f0f2e',
  gradientBackground: '#1b1b41',
  text: '#fff',
  textSecondary: '#bbb',
  textTertiary: '#ccc',
  cardBackground: '#1e1e3f',
  cardBackgroundAlt: '#252550',
  cardBackgroundSelected: '#2a2a55',
  accent: '#FDAD00',
  accentSecondary: '#e8ecf1',
  historyColor: '#4CAF50',
  error: '#d32f2f',
  shadowColor: '#000',
  borderColor: '#2a2a4a',
  buttonDisabled: '#555',
  unreadDot: '#4CAF50',
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
  cardBackgroundSelected: '#fffbf0',
  accent: '#f39c12',
  accentSecondary: '#e67e22',
  historyColor: '#27ae60',
  error: '#e74c3c',
  shadowColor: '#000',
  borderColor: '#e0e0ea',
  buttonDisabled: '#ccc',
  unreadDot: '#27ae60',
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
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 10 : 20,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
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
  brandedLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 60,
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
  card: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
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
  cardContent: {
    flexDirection: 'row',
    padding: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    color: theme.text,
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.unreadDot,
    marginLeft: 8,
  },
  message: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 10,
    lineHeight: 20,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  actionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 12,
    color: theme.accent,
    marginRight: 4,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
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
  exploreButton: {
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
  exploreButtonText: {
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