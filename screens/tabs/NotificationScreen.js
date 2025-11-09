// screens/tabs/NotificationsScreen.js
import { FontAwesome as Icon, Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from "../../firebase/firebaseConfig";
import { supabase } from '../../supabase/supabaseClient'; // ✅ Fixed path
import { darkTheme, lightTheme } from '../../theme/theme';
import { fontFamily } from '../../theme/typography';
import { sendPushNotification } from '../../utils/PushNotificationSender'; // ✅ Fixed path

// ✅ MOVED: Message notification helpers - these should ideally be in utils/MessageNotificationHelper.js
export const sendMessageNotification = async ({
  senderEmail,
  receiverEmail,
  messageText,
  hasImages = false,
}) => {
  try {
    console.log('🔔 [NotificationHelper] Sending notification to:', receiverEmail);

    // Fetch sender's name
    const { data: senderData, error: senderError } = await supabase
      .from('users')
      .select('name')
      .eq('email', senderEmail)
      .maybeSingle();

    if (senderError) {
      console.warn('⚠️ [NotificationHelper] Error fetching sender name:', senderError);
    }

    const senderName = senderData?.name || senderEmail;

    // Construct notification message
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
      pushTitle = senderName; // Use sender name as title for text messages
    } else {
      notificationMessage = `${senderName} sent you a message`;
    }

    // Insert notification into database
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

    // 🆕 Send push notification
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

    // Fetch buyer's name
    const { data: buyerData } = await supabase
      .from('users')
      .select('name')
      .eq('email', buyerEmail)
      .maybeSingle();

    const buyerName = buyerData?.name || buyerEmail;
    const notificationMessage = `${buyerName} purchased "${productName}" for ₱${price}`;

    // Insert notification
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

    // 🆕 Send push notification
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

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const user = auth.currentUser;

  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const headerAnim = useRef(new Animated.Value(-50)).current;

  // CRITICAL: Track if component is mounted
  const isMounted = useRef(true);

  // Group notifications by sender
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
          
          // Update to latest message
          if (new Date(notif.created_at) > new Date(messageGroups[notif.sender_id].latest_created_at)) {
            messageGroups[notif.sender_id].message = notif.message;
            messageGroups[notif.sender_id].latest_created_at = notif.created_at;
            messageGroups[notif.sender_id].created_at = notif.created_at;
          }
          
          // If any message in group is unread, mark group as unread
          if (!notif.is_read) {
            messageGroups[notif.sender_id].is_read = false;
          }
        }
      } else {
        grouped.push(notif);
      }
    });

    // Add grouped messages
    Object.values(messageGroups).forEach(group => {
      grouped.push(group);
    });

    // Sort by created_at
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

    console.log('📥 [NotificationsScreen] Fetching notifications for:', user.email);

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("receiver_id", user.email)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ [NotificationsScreen] Error fetching notifications:", error);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const notificationsData = data || [];
    console.log('✅ [NotificationsScreen] Loaded', notificationsData.length, 'notifications');
    
    // Group notifications by sender
    const grouped = groupNotifications(notificationsData);
    
    const uniqueSenders = Array.from(new Set(notificationsData.map(n => n.sender_id).filter(Boolean)));

    let senderMap = {};
    if (uniqueSenders.length > 0) {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('email,name')
        .in('email', uniqueSenders);

      if (usersError) {
        console.warn('⚠️ [NotificationsScreen] Error fetching sender names:', usersError);
      } else if (usersData) {
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
      
      // Calculate unread count
      const unread = annotated.filter(n => !n.is_read).length;
      setUnreadCount(unread);
    }
    
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

  // FIXED: Initial fetch and realtime subscription
  useEffect(() => {
    if (!user?.email) return;

    console.log('📨 [NotificationsScreen] Setting up notification subscription for:', user.email);

    // Initial fetch
    fetchNotifications();

    // FIXED: Set up realtime subscription with proper event handling
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
          console.log("🔔 [NotificationsScreen] New notification received:", payload.new);
          
          if (!isMounted.current) return;

          // Fetch sender name for the new notification
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
          
          // Update notifications state with proper grouping
          setNotifications((prev) => {
            const newList = [annotatedNotification, ...prev];
            const regrouped = groupNotifications(newList);
            return regrouped;
          });
          
          // Increment unread count if notification is unread
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
          console.log("🔄 [NotificationsScreen] Notification updated:", payload.new);
          
          if (!isMounted.current) return;

          setNotifications((prev) =>
            prev.map((n) => (n.id === payload.new.id ? { ...n, ...payload.new } : n))
          );
          
          // Recalculate unread count
          setNotifications((prev) => {
            const unread = prev.filter(n => !n.is_read).length;
            setUnreadCount(unread);
            return prev;
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
          console.log("🗑️ [NotificationsScreen] Notification deleted:", payload.old);
          
          if (!isMounted.current) return;

          setNotifications((prev) => {
            const filtered = prev.filter((n) => n.id !== payload.old.id);
            const unread = filtered.filter(n => !n.is_read).length;
            setUnreadCount(unread);
            return filtered;
          });
        }
      )
      .subscribe((status) => {
        console.log('🔌 [NotificationsScreen] Subscription status:', status);
      });

    return () => {
      console.log('🧹 [NotificationsScreen] Cleaning up subscription');
      isMounted.current = false;
      supabase.removeChannel(channel);
    };
  }, [user?.email]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    // Update badge when unread count changes
    Notifications.setBadgeCountAsync(unreadCount);
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
      console.error('Failed to navigate to Messaging via any navigator:', err);
    }
  };

  const markAsRead = async (notification) => {
    if (notification.is_read) return;

    const idsToUpdate = notification.grouped_ids || [notification.id];

    console.log('✅ [NotificationsScreen] Marking as read:', idsToUpdate);

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
    } else {
      console.error('❌ [NotificationsScreen] Error marking as read:', error);
    }
  };

  const deleteNotification = async (notification) => {
    Alert.alert(
      'Delete Notification',
      notification.grouped_count > 1 
        ? `Delete all ${notification.grouped_count} messages from this conversation?`
        : 'Delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const idsToDelete = notification.grouped_ids || [notification.id];
            
            console.log('🗑️ [NotificationsScreen] Deleting notifications:', idsToDelete);

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
            } else {
              console.error('❌ [NotificationsScreen] Error deleting:', error);
              Alert.alert('Error', 'Failed to delete notification');
            }
          },
        },
      ]
    );
  };

  const markAllAsRead = async () => {
    console.log('✅ [NotificationsScreen] Marking all as read');

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
    } else {
      console.error('❌ [NotificationsScreen] Error marking all as read:', error);
    }
  };

  const deleteAllNotifications = async () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to delete all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            console.log('🗑️ [NotificationsScreen] Deleting all notifications');

            const { error } = await supabase
              .from('notifications')
              .delete()
              .eq('receiver_id', user.email);

            if (!error) {
              setNotifications([]);
              setUnreadCount(0);
            } else {
              console.error('❌ [NotificationsScreen] Error clearing all:', error);
              Alert.alert('Error', 'Failed to clear notifications');
            }
          },
        },
      ]
    );
  };

  const handleNotificationPress = async (notification) => {
    // Mark as read
    await markAsRead(notification);

    // Check if it's a message notification
    if (notification.title.includes('Message') && notification.sender_id) {
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
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Notification Actions',
                'Choose an action',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Mark All Read', onPress: markAllAsRead },
                  { text: 'Clear All', style: 'destructive', onPress: deleteAllNotifications },
                ]
              );
            }}
            style={styles.moreButton}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={theme.text} />
          </TouchableOpacity>
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

  const renderItem = ({ item, index }) => {
    const senderDisplay = item.sender_name || item.sender_id;
    let displayMessage = item.message || '';
    if (item.sender_id && displayMessage.includes(item.sender_id)) {
      displayMessage = displayMessage.replace(item.sender_id, senderDisplay);
    }

    // Add grouping info to message
    if (item.grouped_count > 1) {
      displayMessage = `${item.grouped_count} new messages`;
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

    const isUnread = !item.is_read;

    return (
      <Animated.View 
        style={[
          styles.itemContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <TouchableOpacity
          onPress={() => handleNotificationPress(item)}
          onLongPress={() => {
            Alert.alert(
              'Notification Options',
              'Choose an action',
              [
                { text: 'Cancel', style: 'cancel' },
                !item.is_read && { 
                  text: 'Mark as Read', 
                  onPress: () => markAsRead(item) 
                },
                { 
                  text: 'Delete', 
                  style: 'destructive',
                  onPress: () => deleteNotification(item) 
                },
              ].filter(Boolean)
            );
          }}
          activeOpacity={0.8}
          style={[
            styles.notificationCard, 
            isUnread && styles.notificationCardUnread
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: `${iconColor}20` }]}>
            <Icon name={iconName} size={20} color={iconColor} />
            {item.grouped_count > 1 && (
              <View style={styles.groupBadge}>
                <Text style={styles.groupBadgeText}>{item.grouped_count}</Text>
              </View>
            )}
          </View>

          <View style={styles.contentArea}>
            <View style={styles.headerRow}>
              <Text 
                style={[styles.titleText, { fontFamily: fontFamily.bold }]} 
                numberOfLines={1}
              >
                {item.title}
              </Text>
              {isUnread && <View style={styles.unreadDot} />}
            </View>

            <Text 
              style={[styles.messageText, { fontFamily: fontFamily.regular }]} 
              numberOfLines={2}
            >
              {displayMessage}
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.timeRow}>
                <Icon name="clock-o" size={11} color={theme.textSecondary} />
                <Text style={[styles.timeText, { fontFamily: fontFamily.medium }]}>
                  {' '}{timeAgo}
                </Text>
              </View>
              <View style={styles.actionHint}>
                <Text style={[styles.hintText, { fontFamily: fontFamily.semiBold }]}>
                  Tap to open
                </Text>
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
    height: 340,
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
        elevation: 2,
      },
    }),
  },
  moreButton: {
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
        elevation: 2,
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
        elevation: 2,
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
    paddingTop: 64,
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
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
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
    marginBottom: 10,
  },
  notificationCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.borderColor || theme.border,
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
  notificationCardUnread: {
    backgroundColor: theme.cardBackgroundNew || `${theme.accent}08`,
    borderColor: theme.accent,
    borderWidth: 1.5,
    ...Platform.select({
      ios: {
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
    fontWeight: '700',
  },
  contentArea: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  titleText: {
    flex: 1,
    fontSize: 15,
    color: theme.text,
    letterSpacing: -0.2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    marginLeft: 8,
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
  },
  timeText: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  actionHint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hintText: {
    fontSize: 11,
    color: theme.accent,
    marginRight: 3,
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
        elevation: 4,
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
        elevation: 6,
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
})