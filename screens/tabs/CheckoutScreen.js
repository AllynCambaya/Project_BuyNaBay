// screens/tabs/CheckoutScreen.js
import { FontAwesome as Icon, Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';
import { darkTheme, lightTheme } from '../../theme/theme';
import { fontFamily } from '../../theme/typography';

const { width, height } = Dimensions.get('window');

const CheckoutItem = ({ item, index, theme, onDelete, onReorder }) => {
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

  const thumbnail = item.product_image_urls?.[0];
  const date = new Date(item.checkout_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const time = new Date(item.checkout_date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const subtotal = (parseFloat(item.price) * parseInt(item.quantity)).toFixed(2);

  const itemDate = new Date(item.checkout_date);
  const now = new Date();
  const diffDays = Math.floor((now - itemDate) / (1000 * 60 * 60 * 24));
  const isRecent = diffDays < 7;

  const styles = createStyles(theme);

  return (
    <Animated.View
      style={[
        styles.itemContainer,
        {
          opacity: actionOpacity,
          transform: [{ scale: animatedScale }]
        }
      ]}
    >
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={[
          styles.orderCard,
          isRecent && styles.orderCardRecent
        ]}
      >
        {/* Top Bar with Date/Time */}
        <View style={styles.cardTopBar}>
          <View style={styles.dateInfo}>
            <Icon name="calendar" size={13} color={theme.accent} />
            <Text style={[styles.dateLabel, { fontFamily: fontFamily.semiBold }]}>
              {' '}{date}
            </Text>
          </View>
          <View style={styles.timeInfo}>
            <Icon name="clock-o" size={13} color={theme.textSecondary} />
            <Text style={[styles.timeLabel, { fontFamily: fontFamily.medium }]}>
              {' '}{time}
            </Text>
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.cardBody}>
          <View style={styles.imageSection}>
            {thumbnail ? (
              <Image source={{ uri: thumbnail }} style={styles.productImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Icon name="image" size={32} color={theme.iconPlaceholder} />
              </View>
            )}
            {isRecent && (
              <View style={styles.recentBadge}>
                <Text style={[styles.recentText, { fontFamily: fontFamily.bold }]}>
                  New
                </Text>
              </View>
            )}
          </View>

          <View style={styles.infoSection}>
            <Text style={[styles.productTitle, { fontFamily: fontFamily.bold }]} numberOfLines={2}>
              {item.product_name}
            </Text>

            <View style={styles.priceRow}>
              <View style={styles.priceBlock}>
                <Text style={[styles.priceTag, { fontFamily: fontFamily.medium }]}>
                  Unit Price
                </Text>
                <Text style={[styles.priceAmount, { fontFamily: fontFamily.bold }]}>
                  ₱{item.price}
                </Text>
              </View>
              <View style={styles.qtyBlock}>
                <Text style={[styles.qtyTag, { fontFamily: fontFamily.medium }]}>
                  Qty
                </Text>
                <Text style={[styles.qtyAmount, { fontFamily: fontFamily.bold }]}>
                  ×{item.quantity}
                </Text>
              </View>
            </View>

            <View style={styles.sellerInfo}>
              <Icon name="user" size={11} color={theme.textSecondary} />
              <Text style={[styles.sellerName, { fontFamily: fontFamily.medium }]} numberOfLines={1}>
                {' '}Sold by: {item.seller_name || 'Unknown'}
              </Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={[styles.totalTag, { fontFamily: fontFamily.medium }]}>
                Order Total
              </Text>
              <Text style={[styles.totalAmount, { fontFamily: fontFamily.bold }]}>
                ₱{subtotal}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onReorder(item);
            }}
            style={[styles.actionBtn, styles.reorderBtn]}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={18} color={theme.accent} />
            <Text style={[styles.actionBtnText, { fontFamily: fontFamily.semiBold, color: theme.accent }]}>
              Reorder
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onDelete(item);
            }}
            style={[styles.actionBtn, styles.deleteBtn]}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={18} color="#FF3B30" />
            <Text style={[styles.actionBtnText, { fontFamily: fontFamily.semiBold, color: '#FF3B30' }]}>
              Delete
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function CheckoutScreen({ navigation }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
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

  useEffect(() => {
    fetchCheckoutHistory();
  }, []);

  const fetchCheckoutHistory = async () => {
    if (!user?.email) return;

    try {
      if (!refreshing) setLoading(true);

      const { data, error } = await supabase
        .from('checkout_history')
        .select('*')
        .eq('buyer_email', user.email)
        .order('checkout_date', { ascending: false });

      if (error) throw error;

      const enrichedData = await Promise.all(
        data.map(async (item) => {
          const { data: productData } = await supabase
            .from('products')
            .select('product_image_url')
            .eq('product_name', item.product_name)
            .maybeSingle();

          if (productData) {
            let images;
            try {
              images = JSON.parse(productData.product_image_url);
              if (!Array.isArray(images)) images = [productData.product_image_url];
            } catch {
              images = [productData.product_image_url];
            }
            return { ...item, product_image_urls: images };
          }
          return item;
        })
      );

      setHistory(enrichedData);

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
    } catch (err) {
      console.error('Error fetching checkout history:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateStats = () => {
    const totalOrders = history.length;
    const totalSpent = history.reduce(
      (sum, item) => sum + parseFloat(item.price) * parseInt(item.quantity),
      0
    );
    const uniqueSellers = [...new Set(history.map((item) => item.seller_name))].length;

    return {
      totalOrders,
      totalSpent: totalSpent.toFixed(2),
      uniqueSellers,
    };
  };

  const getFilteredHistory = () => {
    if (filter === 'all') return history;
    
    const now = new Date();
    if (filter === 'today') {
      return history.filter(item => {
        const itemDate = new Date(item.checkout_date);
        return itemDate.toDateString() === now.toDateString();
      });
    }
    if (filter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return history.filter(item => new Date(item.checkout_date) >= weekAgo);
    }
    if (filter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return history.filter(item => new Date(item.checkout_date) >= monthAgo);
    }
    return history;
  };

  const handleDelete = (item) => {
    setConfirmAction({
      title: 'Delete Order',
      message: 'Are you sure you want to remove this order from your history? This action cannot be undone.',
      onConfirm: async () => {
        const { error } = await supabase
          .from('checkout_history')
          .delete()
          .eq('id', item.id);

        if (!error) {
          setHistory(prev => prev.filter(h => h.id !== item.id));
          showToast('Order deleted successfully');
        }
      },
    });
    setConfirmModalVisible(true);
  };

  const handleReorder = (item) => {
    showToast('Reorder feature coming soon!');
  };

  const clearAllHistory = () => {
    setConfirmAction({
      title: 'Clear All History',
      message: 'Are you sure you want to delete all checkout history? This action cannot be undone.',
      onConfirm: async () => {
        const { error } = await supabase
          .from('checkout_history')
          .delete()
          .eq('buyer_email', user.email);

        if (!error) {
          setHistory([]);
          showToast('All history cleared');
        }
      },
    });
    setConfirmModalVisible(true);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCheckoutHistory();
  };

  const filteredHistory = getFilteredHistory();
  const stats = calculateStats();
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

        {history.length > 0 && (
          <TouchableOpacity
            onPress={clearAllHistory}
            style={[styles.actionIconButton, { backgroundColor: '#FF3B3015' }]}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.welcomeContainer}>
        <Text style={[styles.greetingText, { fontFamily: fontFamily.medium }]}>
          Your Orders
        </Text>
        <Text style={[styles.userNameText, { fontFamily: fontFamily.extraBold }]}>
          Checkout History
        </Text>
        <Text style={[styles.descriptionText, { fontFamily: fontFamily.regular }]}>
          Review your purchase history
        </Text>
      </View>

      {history.length > 0 && (
        <View style={styles.summaryCards}>
          <View style={styles.summaryCard}>
            <View style={[styles.cardIcon, { backgroundColor: `${theme.accent}15` }]}>
              <Icon name="shopping-bag" size={18} color={theme.accent} />
            </View>
            <Text style={[styles.cardValue, { fontFamily: fontFamily.bold }]}>
              {stats.totalOrders}
            </Text>
            <Text style={[styles.cardLabel, { fontFamily: fontFamily.medium }]}>
              Orders
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <View style={[styles.cardIcon, { backgroundColor: `${theme.success}15` }]}>
              <Icon name="money" size={18} color={theme.success} />
            </View>
            <Text style={[styles.cardValue, { fontFamily: fontFamily.bold }]}>
              ₱{stats.totalSpent}
            </Text>
            <Text style={[styles.cardLabel, { fontFamily: fontFamily.medium }]}>
              Total Spent
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <View style={[styles.cardIcon, { backgroundColor: `${theme.secondary}15` }]}>
              <Icon name="users" size={18} color={theme.secondary} />
            </View>
            <Text style={[styles.cardValue, { fontFamily: fontFamily.bold }]}>
              {stats.uniqueSellers}
            </Text>
            <Text style={[styles.cardLabel, { fontFamily: fontFamily.medium }]}>
              Sellers
            </Text>
          </View>
        </View>
      )}

      {history.length > 0 && (
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
              All Time
            </Text>
            {filter === 'all' && <View style={styles.filterDot} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filter === 'today' && styles.filterChipActive]}
            onPress={() => setFilter('today')}
            activeOpacity={0.7}
          >
            <Icon 
              name="calendar-check-o" 
              size={12} 
              color={filter === 'today' ? '#fff' : theme.textSecondary} 
              style={{ marginRight: 6 }}
            />
            <Text style={[
              styles.filterText, 
              filter === 'today' && styles.filterTextActive,
              { fontFamily: filter === 'today' ? fontFamily.bold : fontFamily.semiBold }
            ]}>
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filter === 'week' && styles.filterChipActive]}
            onPress={() => setFilter('week')}
            activeOpacity={0.7}
          >
            <Icon 
              name="calendar" 
              size={12} 
              color={filter === 'week' ? '#fff' : theme.textSecondary} 
              style={{ marginRight: 6 }}
            />
            <Text style={[
              styles.filterText, 
              filter === 'week' && styles.filterTextActive,
              { fontFamily: filter === 'week' ? fontFamily.bold : fontFamily.semiBold }
            ]}>
              This Week
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filter === 'month' && styles.filterChipActive]}
            onPress={() => setFilter('month')}
            activeOpacity={0.7}
          >
            <Icon 
              name="history" 
              size={12} 
              color={filter === 'month' ? '#fff' : theme.textSecondary} 
              style={{ marginRight: 6 }}
            />
            <Text style={[
              styles.filterText, 
              filter === 'month' && styles.filterTextActive,
              { fontFamily: filter === 'month' ? fontFamily.bold : fontFamily.semiBold }
            ]}>
              30 Days
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );

  const renderItem = ({ item, index }) => (
    <CheckoutItem
      item={item}
      index={index}
      theme={theme}
      onDelete={handleDelete}
      onReorder={handleReorder}
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
        <Icon name="receipt" size={64} color={theme.iconPlaceholder} />
      </View>
      <Text style={[styles.emptyTitle, { fontFamily: fontFamily.bold }]}>
        No Orders Yet
      </Text>
      <Text style={[styles.emptyDescription, { fontFamily: fontFamily.regular }]}>
        Your checkout history will appear here once you make a purchase
      </Text>
      <TouchableOpacity
        style={styles.shopButton}
        onPress={() => navigation.navigate('MainTabs', { screen: 'Tabs', params: { screen: 'Home' } })}
        activeOpacity={0.8}
      >
        <Icon name="shopping-bag" size={18} color="#fff" style={{ marginRight: 10 }} />
        <Text style={[styles.shopButtonText, { fontFamily: fontFamily.bold }]}>
          Start Shopping
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loadingText, { fontFamily: fontFamily.medium }]}>
          Loading your orders...
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
        data={filteredHistory}
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
    backgroundColor: theme.gradientBackground,
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
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
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
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
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
    borderColor: theme.borderColor,
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  filterChipActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
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
  orderCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.borderColor,
    overflow: 'hidden',
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  orderCardRecent: {
    backgroundColor: theme.cardBackgroundRecent,
    borderColor: theme.accent,
    borderWidth: 1.5,
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  cardTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.cardBackgroundAlt,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 13,
    color: theme.text,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  cardBody: {
    flexDirection: 'row',
    padding: 16,
  },
  imageSection: {
    position: 'relative',
    marginRight: 14,
  },
  productImage: {
    width: 90,
    height: 90,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: theme.imagePlaceholder,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  recentBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: theme.success,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  recentText: {
    color: '#fff',
    fontSize: 10,
  },
  infoSection: {
    flex: 1,
  },
  productTitle: {
    fontSize: 16,
    color: theme.text,
    marginBottom: 10,
    lineHeight: 20,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  priceBlock: {
    flex: 1,
  },
  priceTag: {
    fontSize: 11,
    color: theme.textSecondary,
    marginBottom: 3,
  },
  priceAmount: {
    fontSize: 15,
    color: theme.accent,
  },
  qtyBlock: {
    alignItems: 'flex-end',
  },
  qtyTag: {
    fontSize: 11,
    color: theme.textSecondary,
    marginBottom: 3,
  },
  qtyAmount: {
    fontSize: 15,
    color: theme.text,
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sellerName: {
    fontSize: 12,
    color: theme.textSecondary,
    flex: 1,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  totalTag: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  totalAmount: {
    fontSize: 18,
    color: theme.accent,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  reorderBtn: {
    backgroundColor: `${theme.accent}08`,
    borderRightWidth: 0.5,
    borderRightColor: theme.border,
  },
  deleteBtn: {
    backgroundColor: '#FF3B3008',
    borderLeftWidth: 0.5,
    borderLeftColor: theme.border,
  },
  actionBtnText: {
    fontSize: 14,
    letterSpacing: -0.2,
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
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
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
  shopButton: {
    backgroundColor: theme.accent,
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  shopButtonText: {
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
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
    backgroundColor: theme.borderColor,
  },
  confirmButton: {
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    letterSpacing: -0.2,
  },
});