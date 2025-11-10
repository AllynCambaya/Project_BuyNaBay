// screens/tabs/NotificationsScreen.js
import { FontAwesome as Icon, Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from "../../firebase/firebaseConfig";
import { supabase } from '../../supabase/supabaseClient';
import { darkTheme, lightTheme } from '../../theme/theme';
import { fontFamily } from '../../theme/typography';
import { sendPushNotification } from '../../utils/PushNotificationSender';

// Message notification helpers (unchanged)
export const sendMessageNotification = async ({
  senderEmail,
  receiverEmail,
  messageText,
  hasImages = false,
}) => {
  try {
    console.log('🔔 [NotificationHelper] Sending notification to:', receiverEmail);

    const { data: senderData, error: senderError } = await supabase
      .from('users')
      .select('name')
      .eq('email', senderEmail)
      .maybeSingle();

    if (senderError) {
      console.warn('⚠️ [NotificationHelper] Error fetching sender name:', senderError);
    }

    const senderName = senderData?.name || senderEmail;

    let notificationMessage = '';
    let pushTitle = 'New Message';
    
    if (hasImages && !messageText) {
      notificationMessage = `${senderName} sent you a photo`;
    } else if (hasImages && messageText) {
      const truncatedText = messageText.length > 50 
        ? `${messageText.substring(0, 50)}...` 
        : messageText;
      notificationMessage = `${senderName} sent you a photo: ${truncatedText}`;
    } else if (messageText) {
      const truncatedText = messageText.length > 100 
        ? `${messageText.substring(0, 100)}...` 
        : messageText;
      notificationMessage = `${truncatedText}`;
      pushTitle = senderName;
    } else {
      notificationMessage = `${senderName} sent you a message`;
    }

    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .insert({
        sender_id: senderEmail,
        receiver_id: receiverEmail,
        title: 'New Message',
        message: notificationMessage,
        is_read: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (notificationError) {
      console.error('❌ [NotificationHelper] Failed to insert notification:', notificationError);
      return false;
    }

    console.log('✅ [NotificationHelper] Database notification created:', notification.id);

    await sendPushNotification(
      receiverEmail,
      pushTitle,
      notificationMessage,
      {
        type: 'message',
        senderId: senderEmail,
        senderName: senderName,
        screen: 'MessagingScreen',
        params: {
          receiverId: senderEmail,
          receiverName: senderName,
        },
      }
    );

    return true;

  } catch (error) {
    console.error('❌ [NotificationHelper] Unexpected error:', error);
    return false;
  }
};

export const sendProductSoldNotification = async ({
  buyerEmail,
  sellerEmail,
  productName,
  price,
}) => {
  try {
    console.log('🔔 [NotificationHelper] Sending product sold notification to:', sellerEmail);

    const { data: buyerData } = await supabase
      .from('users')
      .select('name')
      .eq('email', buyerEmail)
      .maybeSingle();

    const buyerName = buyerData?.name || buyerEmail;
    const notificationMessage = `${buyerName} purchased "${productName}" for ₱${price}`;

    const { error } = await supabase
      .from('notifications')
      .insert({
        sender_id: buyerEmail,
        receiver_id: sellerEmail,
        title: 'Product Sold',
        message: notificationMessage,
        is_read: false,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('❌ [NotificationHelper] Failed to send product sold notification:', error);
      return false;
    }

    await sendPushNotification(
      sellerEmail,
      'Product Sold! 🎉',
      notificationMessage,
      {
        type: 'order',
        buyerEmail: buyerEmail,
        productName: productName,
        price: price,
        screen: 'OrderHistory',
      }
    );

    console.log('✅ [NotificationHelper] Product sold notification sent successfully');
    return true;

  } catch (error) {
    console.error('❌ [NotificationHelper] Unexpected error:', error);
    return false;
  }
};

const { width, height } = Dimensions.get('window');

// Enhanced notification item component with improved UI
const NotificationItem = ({ item, index, theme, onPress, onMarkAsRead, onDelete }) => {
  const animatedScale = useRef(new Animated.Value(1)).current;
  const actionOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(actionOpacity, {
      toValue: 1,
      duration: 300,
      delay: index * 50,
      useNativeDriver: true,
    }).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(animatedScale, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(animatedScale, {
      toValue: 1,
      tension: 100,
      friction: 7,
      useNativeDriver: true,
    }).start();
  };

  const senderDisplay = item.sender_name || item.sender_id;
  let displayMessage = item.message || '';
  if (item.sender_id && displayMessage.includes(item.sender_id)) {
    displayMessage = displayMessage.replace(item.sender_id, senderDisplay);
  }

  if (item.grouped_count > 1) {
    displayMessage = `${item.grouped_count} new messages`;
  }

  const iconName = getNotificationIcon(item.title);
  const iconColor = getNotificationColor(item.title, theme);

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

  const isUnread = !item.is_read;
  const styles = createStyles(theme);

  return (
    <Animated.View 
      style={[
        styles.itemContainer,
        { 
          transform: [{ scale: animatedScale }],
          opacity: actionOpacity
        }
      ]}
    >
      <TouchableOpacity
        onPress={() => onPress(item)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={[
          styles.notificationCard, 
          isUnread && styles.notificationCardUnread
        ]}
      >
        {/* Left Icon Section */}
        <View style={[styles.iconCircle, { backgroundColor: `${iconColor}15` }]}>
          <Icon name={iconName} size={22} color={iconColor} />
          {item.grouped_count > 1 && (
            <View style={styles.groupBadge}>
              <Text style={[styles.groupBadgeText, { fontFamily: fontFamily.bold }]}>
                {item.grouped_count}
              </Text>
            </View>
          )}
        </View>

        {/* Content Area */}
        <View style={styles.contentArea}>
          <View style={styles.headerRow}>
            <Text 
              style={[styles.titleText, { fontFamily: fontFamily.bold }]} 
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {isUnread && (
              <View style={styles.unreadBadge}>
                <View style={styles.unreadDot} />
              </View>
            )}
          </View>

          <Text 
            style={[styles.messageText, { fontFamily: fontFamily.regular }]} 
            numberOfLines={2}
          >
            {displayMessage}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.timeRow}>
              <Ionicons name="time-outline" size={12} color={theme.textSecondary} />
              <Text style={[styles.timeText, { fontFamily: fontFamily.medium }]}>
                {timeAgo}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons - Properly Centered */}
        <View style={styles.actionButtonsContainer}>
          {!item.is_read && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onMarkAsRead(item);
              }}
              style={[styles.actionButton, styles.readButton]}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-circle" size={22} color={theme.accent} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onDelete(item);
            }}
            style={[styles.actionButton, styles.deleteButton]}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Helper functions (unchanged)
const getNotificationIcon = (title) => {
  if (title.includes('Order') || title.includes('Checkout') || title.includes('Sold')) return 'shopping-cart';
  if (title.includes('Rent') || title.includes('Rental')) return 'calendar';
  if (title.includes('Message')) return 'envelope';
  if (title.includes('Review')) return 'star';
  return 'bell';
};

const getNotificationColor = (title, theme) => {
  if (title.includes('Order') || title.includes('Checkout') || title.includes('Sold')) return theme.accent;
  if (title.includes('Rent') || title.includes('Rental')) return theme.rentalColor || '#6366F1';
  if (title.includes('Message')) return theme.messageColor || '#10B981';
  if (title.includes('Review')) return theme.reviewColor || '#F59E0B';
  return theme.accent;
};

const getNotificationCategory = (title) => {
  if (title.includes('Order') || title.includes('Checkout') || title.includes('Sold')) return 'orders';
  if (title.includes('Rent') || title.includes('Rental')) return 'rentals';
  if (title.includes('Message')) return 'messages';
  return 'other';
};

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const user = auth.currentUser;

  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const headerAnim = useRef(new Animated.Value(-50)).current;
  const toastAnim = useRef(new Animated.Value(-100)).current;
  const isMounted = useRef(true);

  // Toast notification
  const showToast = (message) => {
    setToastMessage(message);
    setToastVisible(true);
    Animated.sequence([
      Animated.spring(toastAnim, {
        toValue: 0,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(toastAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setToastVisible(false));
  };

  // Group notifications by sender (unchanged)
  const groupNotifications = (notifs) => {
    const grouped = [];
    const messageGroups = {};

    notifs.forEach(notif => {
      if (notif.title.includes('Message') && notif.sender_id) {
        if (!messageGroups[notif.sender_id]) {
          messageGroups[notif.sender_id] = {
            ...notif,
            grouped_count: 1,
            grouped_ids: [notif.id],
            latest_created_at: notif.created_at,
            is_read: notif.is_read,
          };
        } else {
          messageGroups[notif.sender_id].grouped_count++;
          messageGroups[notif.sender_id].grouped_ids.push(notif.id);
          
          if (new Date(notif.created_at) > new Date(messageGroups[notif.sender_id].latest_created_at)) {
            messageGroups[notif.sender_id].message = notif.message;
            messageGroups[notif.sender_id].latest_created_at = notif.created_at;
            messageGroups[notif.sender_id].created_at = notif.created_at;
          }
          
          if (!notif.is_read) {
            messageGroups[notif.sender_id].is_read = false;
          }
        }
      } else {
        grouped.push(notif);
      }
    });

    Object.values(messageGroups).forEach(group => {
      grouped.push(group);
    });

    return grouped.sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );
  };

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
      console.error("❌ Error fetching notifications:", error);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const notificationsData = data || [];
    const grouped = groupNotifications(notificationsData);
    
    const uniqueSenders = Array.from(new Set(notificationsData.map(n => n.sender_id).filter(Boolean)));

    let senderMap = {};
    if (uniqueSenders.length > 0) {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('email,name')
        .in('email', uniqueSenders);

      if (!usersError && usersData) {
        senderMap = usersData.reduce((acc, u) => {
          acc[u.email] = u.name;
          return acc;
        }, {});
      }
    }

    const annotated = grouped.map(n => ({
      ...n,
      sender_name: senderMap[n.sender_id] || null,
    }));

    if (isMounted.current) {
      setNotifications(annotated);
      const unread = annotated.filter(n => !n.is_read).length;
      setUnreadCount(unread);
    }
    
    setLoading(false);
    setRefreshing(false);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(headerAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => {
    if (!user?.email) return;

    fetchNotifications();

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
        async (payload) => {
          if (!isMounted.current) return;

          let annotatedNotification = { ...payload.new };
          
          if (payload.new.sender_id) {
            const { data: senderData } = await supabase
              .from('users')
              .select('name')
              .eq('email', payload.new.sender_id)
              .maybeSingle();
            
            annotatedNotification = {
              ...payload.new,
              sender_name: senderData?.name || null,
            };
          }
          
          setNotifications((prev) => {
            const newList = [annotatedNotification, ...prev];
            return groupNotifications(newList);
          });
          
          if (!payload.new.is_read) {
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `receiver_id=eq.${user.email}`,
        },
        (payload) => {
          if (!isMounted.current) return;

          setNotifications((prev) => {
            const updated = prev.map((n) => (n.id === payload.new.id ? { ...n, ...payload.new } : n));
            const unread = updated.filter(n => !n.is_read).length;
            setUnreadCount(unread);
            return updated;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `receiver_id=eq.${user.email}`,
        },
        (payload) => {
          if (!isMounted.current) return;

          setNotifications((prev) => {
            const filtered = prev.filter((n) => n.id !== payload.old.id);
            const unread = filtered.filter(n => !n.is_read).length;
            setUnreadCount(unread);
            return filtered;
          });
        }
      )
      .subscribe();

    return () => {
      isMounted.current = false;
      channel.unsubscribe();
    };
  }, [user?.email]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (Notifications.setBadgeCountAsync) {
      Notifications.setBadgeCountAsync(unreadCount).catch(err => {
        console.warn('Failed to set badge count:', err);
      });
    }
  }, [unreadCount]);

  const navigateToMessaging = (params) => {
    try {
      navigation.navigate('MessagingScreen', params);
      return;
    } catch (e) {}

    const parent = navigation.getParent && navigation.getParent();
    if (parent && parent.navigate) {
      parent.navigate('MessagingScreen', params);
      return;
    }

    const grandParent = parent && parent.getParent && parent.getParent();
    if (grandParent && grandParent.navigate) {
      grandParent.navigate('MessagingScreen', params);
      return;
    }

    try {
      navigation.navigate('MainTabs', { screen: 'Messaging', params });
    } catch (err) {
      console.error('Failed to navigate:', err);
    }
  };

  const markAsRead = async (notification) => {
    if (notification.is_read) return;

    const idsToUpdate = notification.grouped_ids || [notification.id];

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', idsToUpdate);

    if (!error) {
      setNotifications(prev =>
        prev.map(n =>
          n.id === notification.id || idsToUpdate.includes(n.id)
            ? { ...n, is_read: true }
            : n
        )
      );
      
      const newUnreadCount = Math.max(0, unreadCount - idsToUpdate.length);
      setUnreadCount(newUnreadCount);
      showToast('Marked as read');
    }
  };

  const deleteNotification = async (notification) => {
    const idsToDelete = notification.grouped_ids || [notification.id];
    
    setConfirmAction({
      title: 'Delete Notification',
      message: notification.grouped_count > 1 
        ? `Delete all ${notification.grouped_count} messages from this conversation?`
        : 'Are you sure you want to delete this notification?',
      onConfirm: async () => {
        const { error } = await supabase
          .from('notifications')
          .delete()
          .in('id', idsToDelete);

        if (!error) {
          setNotifications(prev =>
            prev.filter(n => !idsToDelete.includes(n.id))
          );
          
          if (!notification.is_read) {
            const newUnreadCount = Math.max(0, unreadCount - idsToDelete.length);
            setUnreadCount(newUnreadCount);
          }
          showToast('Notification deleted');
        }
      },
    });
    setConfirmModalVisible(true);
  };

  const markAllAsRead = async () => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('receiver_id', user.email)
      .eq('is_read', false);

    if (!error) {
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
      showToast('All notifications marked as read');
    }
  };

  const deleteAllNotifications = async () => {
    setConfirmAction({
      title: 'Clear All Notifications',
      message: 'Are you sure you want to delete all notifications? This action cannot be undone.',
      onConfirm: async () => {
        const { error } = await supabase
          .from('notifications')
          .delete()
          .eq('receiver_id', user.email);

        if (!error) {
          setNotifications([]);
          setUnreadCount(0);
          showToast('All notifications cleared');
        }
      },
    });
    setConfirmModalVisible(true);
  };

  const handleNotificationPress = async (notification) => {
    await markAsRead(notification);

    if (notification.title.includes('Message') && notification.sender_id) {
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('name')
          .eq('email', notification.sender_id)
          .maybeSingle();

        const receiverName = userData?.name || null;
        navigateToMessaging({ receiverId: notification.sender_id, receiverName });
      } catch (err) {
        navigateToMessaging({ receiverId: notification.sender_id });
      }
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications(true);
  };

  const getFilteredNotifications = () => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter(n => !n.is_read);
    return notifications.filter(n => getNotificationCategory(n.title) === filter);
  };

  const filteredNotifications = getFilteredNotifications();
  const messageCount = notifications.filter(n => n.title.includes('Message')).length;

  const styles = createStyles(theme);

  const renderHeader = () => (
    <Animated.View 
      style={[
        styles.headerContainer,
        { transform: [{ translateY: headerAnim }] }
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
          <View style={styles.logoWrapper}>
            <Image
              source={require('../../assets/images/OfficialBuyNaBay.png')}
              style={styles.brandLogo}
              resizeMode="contain"
            />
          </View>
          <View>
            <Text style={[styles.brandText, { fontFamily: fontFamily.extraBold }]}>
              BuyNaBay
            </Text>
            <Text style={[styles.brandSubtext, { fontFamily: fontFamily.medium }]}>
              Campus Marketplace
            </Text>
          </View>
        </View>

        {notifications.length > 0 && (
          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <TouchableOpacity
                onPress={markAllAsRead}
                style={styles.actionIconButton}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark-done" size={20} color={theme.accent} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={deleteAllNotifications}
              style={styles.actionIconButton}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.welcomeContainer}>
        <Text style={[styles.greetingText, { fontFamily: fontFamily.medium }]}>
          Notifications
        </Text>
        <Text style={[styles.userNameText, { fontFamily: fontFamily.extraBold }]}>
          {user?.displayName || user?.email?.split('@')[0] || 'User'}
        </Text>
        <Text style={[styles.descriptionText, { fontFamily: fontFamily.regular }]}>
          Stay updated with your activity
        </Text>
      </View>

      <View style={styles.summaryCards}>
        <View style={styles.summaryCard}>
          <View style={[styles.cardIcon, { backgroundColor: `${theme.accent}15` }]}>
            <Icon name="bell" size={18} color={theme.accent} />
          </View>
          <Text style={[styles.cardValue, { fontFamily: fontFamily.bold }]}>
            {notifications.length}
          </Text>
          <Text style={[styles.cardLabel, { fontFamily: fontFamily.medium }]}>
            Total
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <View style={[styles.cardIcon, { backgroundColor: `${theme.rentalColor || '#6366F1'}15` }]}>
            <Icon name="circle" size={18} color={theme.rentalColor || '#6366F1'} />
          </View>
          <Text style={[styles.cardValue, { fontFamily: fontFamily.bold }]}>
            {unreadCount}
          </Text>
          <Text style={[styles.cardLabel, { fontFamily: fontFamily.medium }]}>
            Unread
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <View style={[styles.cardIcon, { backgroundColor: `${theme.messageColor || '#10B981'}15` }]}>
            <Icon name="envelope" size={18} color={theme.messageColor || '#10B981'} />
          </View>
          <Text style={[styles.cardValue, { fontFamily: fontFamily.bold }]}>
            {messageCount}
          </Text>
          <Text style={[styles.cardLabel, { fontFamily: fontFamily.medium }]}>
            Messages
          </Text>
        </View>
      </View>

      {notifications.length > 0 && (
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
            onPress={() => setFilter('all')}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.filterText, 
              filter === 'all' && styles.filterTextActive,
              { fontFamily: filter === 'all' ? fontFamily.bold : fontFamily.semiBold }
            ]}>
              All
            </Text>
            {filter === 'all' && <View style={styles.filterDot} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filter === 'unread' && styles.filterChipActive]}
            onPress={() => setFilter('unread')}
            activeOpacity={0.7}
          >
            <Icon 
              name="circle" 
              size={12} 
              color={filter === 'unread' ? '#fff' : theme.textSecondary} 
              style={{ marginRight: 6 }}
            />
            <Text style={[
              styles.filterText, 
              filter === 'unread' && styles.filterTextActive,
              { fontFamily: filter === 'unread' ? fontFamily.bold : fontFamily.semiBold }
            ]}>
              Unread
            </Text>
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
            <Text style={[
              styles.filterText, 
              filter === 'orders' && styles.filterTextActive,
              { fontFamily: filter === 'orders' ? fontFamily.bold : fontFamily.semiBold }
            ]}>
              Orders
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
            <Text style={[
              styles.filterText, 
              filter === 'messages' && styles.filterTextActive,
              { fontFamily: filter === 'messages' ? fontFamily.bold : fontFamily.semiBold }
            ]}>
              Messages
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );

  const renderItem = ({ item, index }) => (
    <NotificationItem
      item={item}
      index={index}
      theme={theme}
      onPress={handleNotificationPress}
      onMarkAsRead={markAsRead}
      onDelete={deleteNotification}
    />
  );

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
        <Icon name="bell-slash" size={64} color={theme.iconPlaceholder || theme.textSecondary} />
      </View>
      <Text style={[styles.emptyTitle, { fontFamily: fontFamily.bold }]}>
        No Notifications Yet
      </Text>
      <Text style={[styles.emptyDescription, { fontFamily: fontFamily.regular }]}>
        You're all caught up! Notifications about your orders and activity will appear here.
      </Text>
      <TouchableOpacity
        style={styles.exploreButton}
        onPress={() => {
          try {
            navigation.navigate('MainTabs', { screen: 'Home' });
          } catch (e) {
            navigation.goBack();
          }
        }}
        activeOpacity={0.8}
      >
        <Icon name="shopping-bag" size={18} color="#fff" style={{ marginRight: 10 }} />
        <Text style={[styles.exploreButtonText, { fontFamily: fontFamily.bold }]}>
          Explore Products
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loadingText, { fontFamily: fontFamily.medium }]}>
          Loading notifications...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />
      <FlatList
        data={filteredNotifications}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
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

      {/* Confirmation Modal */}
      <Modal
        visible={confirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconContainer}>
                <Ionicons name="alert-circle" size={32} color="#FF3B30" />
              </View>
              <Text style={[styles.modalTitle, { fontFamily: fontFamily.bold }]}>
                {confirmAction?.title}
              </Text>
            </View>
            
            <Text style={[styles.modalMessage, { fontFamily: fontFamily.regular }]}>
              {confirmAction?.message}
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setConfirmModalVisible(false)}
                style={[styles.modalButton, styles.cancelButton]}
                activeOpacity={0.8}
              >
                <Text style={[styles.cancelButtonText, { fontFamily: fontFamily.semiBold }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  confirmAction?.onConfirm();
                  setConfirmModalVisible(false);
                }}
                style={[styles.modalButton, styles.confirmButton]}
                activeOpacity={0.8}
              >
                <Text style={[styles.confirmButtonText, { fontFamily: fontFamily.bold }]}>
                  Confirm
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Toast Notification */}
      {toastVisible && (
        <Animated.View
          style={[
            styles.toastContainer,
            { transform: [{ translateY: toastAnim }] }
          ]}
        >
          <View style={styles.toastContent}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={[styles.toastText, { fontFamily: fontFamily.semiBold }]}>
              {toastMessage}
            </Text>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  listContent: {
    paddingBottom: 100,
  },
  headerContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  headerBackground: {
    height: 60,
    backgroundColor: theme.gradientBackground || theme.headerBackground,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.08,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
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
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor || '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        shadowColor: theme.shadowColor || '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor || '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        shadowColor: theme.shadowColor || '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginLeft: 12,
  },
  logoWrapper: {
    width: 34,
    height: 34,
    borderRadius: 10,
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
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
    }),
  },
  brandLogo: {
    width: 22,
    height: 22,
  },
  brandText: {
    fontSize: 17,
    color: theme.accent,
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  brandSubtext: {
    fontSize: 10,
    color: theme.textSecondary,
    letterSpacing: 0.2,
    marginTop: -1,
  },
  welcomeContainer: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 20,
  },
  greetingText: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  userNameText: {
    fontSize: Math.min(width * 0.07, 28),
    color: theme.text,
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  descriptionText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  summaryCards: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: theme.cardBackground,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor || '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardValue: {
    fontSize: 19,
    color: theme.text,
    marginTop: 2,
  },
  cardLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 1,
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
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: theme.borderColor || theme.border,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor || '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        shadowColor: theme.shadowColor || '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
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
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
    }),
  },
  filterText: {
    fontSize: 12,
    color: theme.textSecondary,
    letterSpacing: 0.2,
  },
  filterTextActive: {
    color: '#fff',
  },
  filterDot: {
    width: 5,
    height: 5,
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
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.borderColor || theme.border,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor || '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        shadowColor: theme.shadowColor || '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
    }),
  },
  notificationCardUnread: {
    backgroundColor: theme.cardBackgroundNew || `${theme.accent}08`,
    borderColor: theme.accent,
    borderWidth: 1.5,
    ...Platform.select({
      ios: {
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
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
    position: 'relative',
  },
  groupBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: theme.cardBackground,
  },
  groupBadgeText: {
    color: '#fff',
    fontSize: 10,
  },
  contentArea: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleText: {
    flex: 1,
    fontSize: 15,
    color: theme.text,
    letterSpacing: -0.2,
  },
  unreadBadge: {
    marginLeft: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  messageText: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 19,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timeText: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor || '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        shadowColor: theme.shadowColor || '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
  readButton: {
    backgroundColor: `${theme.accent}15`,
  },
  deleteButton: {
    backgroundColor: '#FF3B3015',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: theme.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor || '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        shadowColor: theme.shadowColor || '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
    }),
  },
  emptyTitle: {
    fontSize: 22,
    color: theme.text,
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptyDescription: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
    paddingHorizontal: 10,
  },
  exploreButton: {
    backgroundColor: theme.accent,
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 22,
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
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: 15,
    letterSpacing: -0.2,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    color: theme.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  modalContent: {
    backgroundColor: theme.cardBackground,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
    }),
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF3B3015',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    color: theme.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  modalMessage: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: theme.borderColor || theme.border,
  },
  confirmButton: {
    backgroundColor: '#FF3B30',
    ...Platform.select({
      ios: {
        shadowColor: '#FF3B30',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        shadowColor: '#FF3B30',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
    }),
  },
  cancelButtonText: {
    fontSize: 15,
    color: theme.text,
    letterSpacing: -0.2,
  },
  confirmButtonText: {
    fontSize: 15,
    color: '#fff',
    letterSpacing: -0.2,
  },
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  toastContent: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    letterSpacing: -0.2,
  },
});