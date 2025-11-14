// screens/tabs/PurchasedHistoryScreen.js
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

const CheckoutItem = ({ item, index, theme, onViewDetails, onContactSeller }) => {
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
        onPress={() => onViewDetails(item)}
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
              onViewDetails(item);
            }}
            style={[styles.actionBtn, styles.viewDetailsBtn]}
            activeOpacity={0.7}
          >
            <Ionicons name="receipt-outline" size={18} color={theme.accent} />
            <Text style={[styles.actionBtnText, { fontFamily: fontFamily.semiBold, color: theme.accent }]}>
              View Receipt
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onContactSeller(item);
            }}
            style={[styles.actionBtn, styles.contactBtn]}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-outline" size={18} color={theme.secondary} />
            <Text style={[styles.actionBtnText, { fontFamily: fontFamily.semiBold, color: theme.secondary }]}>
              Contact Seller
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function PurchasedHistoryScreen({ navigation }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
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

  const handleViewDetails = (item) => {
    setSelectedOrder(item);
    setReceiptModalVisible(true);
  };

  const handleContactSeller = async (item) => {
    try {
      // Fetch seller details
      const { data: sellerData, error } = await supabase
        .from('users')
        .select('email, name')
        .eq('name', item.seller_name)
        .maybeSingle();

      if (error || !sellerData) {
        showToast('Unable to find seller contact');
        return;
      }

      // Navigate to messaging screen
      navigation.navigate('MessagingScreen', {
        receiverId: sellerData.email,
        receiverName: sellerData.name,
        productContext: {
          id: item.id,
          product_name: item.product_name,
          price: item.price,
          product_image_url: item.product_image_urls?.[0],
        }
      });

      showToast('Opening chat with seller...');
    } catch (error) {
      console.error('Error contacting seller:', error);
      showToast('Failed to open chat');
    }
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
      </View>

      <View style={styles.welcomeContainer}>
        <Text style={[styles.greetingText, { fontFamily: fontFamily.medium }]}>
          Your Orders
        </Text>
        <Text style={[styles.userNameText, { fontFamily: fontFamily.extraBold }]}>
          Purchase History
        </Text>
        <Text style={[styles.descriptionText, { fontFamily: fontFamily.regular }]}>
          Track and manage your purchases
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
      onViewDetails={handleViewDetails}
      onContactSeller={handleContactSeller}
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
        Your purchase history will appear here once you make an order
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

      {/* Receipt Modal */}
      <Modal
        visible={receiptModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReceiptModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={styles.receiptModalContent}>
            {/* Header */}
            <View style={styles.receiptHeader}>
              <View style={styles.receiptIconContainer}>
                <Ionicons name="receipt" size={32} color={theme.accent} />
              </View>
              <Text style={[styles.receiptTitle, { fontFamily: fontFamily.bold }]}>
                Order Receipt
              </Text>
              <TouchableOpacity
                onPress={() => setReceiptModalVisible(false)}
                style={styles.closeButton}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <View style={styles.receiptBody}>
                {/* Product Image */}
                {selectedOrder.product_image_urls?.[0] && (
                  <Image 
                    source={{ uri: selectedOrder.product_image_urls[0] }} 
                    style={styles.receiptImage} 
                  />
                )}

                {/* Order Details */}
                <View style={styles.receiptSection}>
                  <Text style={[styles.receiptLabel, { fontFamily: fontFamily.medium }]}>
                    Product Name
                  </Text>
                  <Text style={[styles.receiptValue, { fontFamily: fontFamily.bold }]}>
                    {selectedOrder.product_name}
                  </Text>
                </View>

                <View style={styles.receiptDivider} />

                <View style={styles.receiptRow}>
                  <View style={styles.receiptSection}>
                    <Text style={[styles.receiptLabel, { fontFamily: fontFamily.medium }]}>
                      Unit Price
                    </Text>
                    <Text style={[styles.receiptValue, { fontFamily: fontFamily.bold }]}>
                      ₱{selectedOrder.price}
                    </Text>
                  </View>

                  <View style={styles.receiptSection}>
                    <Text style={[styles.receiptLabel, { fontFamily: fontFamily.medium }]}>
                      Quantity
                    </Text>
                    <Text style={[styles.receiptValue, { fontFamily: fontFamily.bold }]}>
                      ×{selectedOrder.quantity}
                    </Text>
                  </View>
                </View>

                <View style={styles.receiptDivider} />

                <View style={styles.receiptSection}>
                  <Text style={[styles.receiptLabel, { fontFamily: fontFamily.medium }]}>
                    Seller
                  </Text>
                  <Text style={[styles.receiptValue, { fontFamily: fontFamily.bold }]}>
                    {selectedOrder.seller_name || 'Unknown'}
                  </Text>
                </View>

                <View style={styles.receiptDivider} />

                <View style={styles.receiptSection}>
                  <Text style={[styles.receiptLabel, { fontFamily: fontFamily.medium }]}>
                    Purchase Date
                  </Text>
                  <Text style={[styles.receiptValue, { fontFamily: fontFamily.bold }]}>
                    {new Date(selectedOrder.checkout_date).toLocaleString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </View>

                <View style={styles.receiptDivider} />

                {/* Total */}
                <View style={styles.receiptTotalSection}>
                  <Text style={[styles.receiptTotalLabel, { fontFamily: fontFamily.bold }]}>
                    Total Amount
                  </Text>
                  <Text style={[styles.receiptTotalValue, { fontFamily: fontFamily.extraBold }]}>
                    ₱{(parseFloat(selectedOrder.price) * parseInt(selectedOrder.quantity)).toFixed(2)}
                  </Text>
                </View>

                {/* Action Button */}
                <TouchableOpacity
                  onPress={() => {
                    setReceiptModalVisible(false);
                    handleContactSeller(selectedOrder);
                  }}
                  style={styles.contactSellerButton}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chatbubble" size={18} color="#fff" />
                  <Text style={[styles.contactSellerText, { fontFamily: fontFamily.bold }]}>
                    Contact Seller
                  </Text>
                </TouchableOpacity>
              </View>
            )}
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
  viewDetailsBtn: {
    backgroundColor: `${theme.accent}08`,
    borderRightWidth: 0.5,
    borderRightColor: theme.border,
  },
  contactBtn: {
    backgroundColor: `${theme.secondary}08`,
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
    justifyContent: 'flex-end',
  },
  receiptModalContent: {
    backgroundColor: theme.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: height * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  receiptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    position: 'relative',
  },
  receiptIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${theme.accent}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  receiptTitle: {
    fontSize: 20,
    color: theme.text,
    letterSpacing: -0.3,
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    top: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptBody: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  receiptImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 20,
    resizeMode: 'cover',
  },
  receiptSection: {
    marginBottom: 16,
  },
  receiptLabel: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 6,
  },
  receiptValue: {
    fontSize: 16,
    color: theme.text,
  },
  receiptRow: {
    flexDirection: 'row',
    gap: 20,
  },
  receiptDivider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 16,
  },
  receiptTotalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: `${theme.accent}10`,
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  receiptTotalLabel: {
    fontSize: 16,
    color: theme.text,
  },
  receiptTotalValue: {
    fontSize: 24,
    color: theme.accent,
  },
  contactSellerButton: {
    backgroundColor: theme.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
    shadowColor: theme.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  contactSellerText: {
    color: '#fff',
    fontSize: 16,
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