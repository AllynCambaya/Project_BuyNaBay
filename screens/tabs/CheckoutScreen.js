import { FontAwesome as Icon, Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

const { width, height } = Dimensions.get('window');

export default function CheckoutScreen({ navigation }) {
  const [history, setHistory] = useState([]);
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

  const filteredHistory = getFilteredHistory();
  const stats = calculateStats();

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
        <Text style={styles.greetingText}>Your Orders</Text>
        <Text style={styles.userNameText}>Checkout History</Text>
        <Text style={styles.descriptionText}>Review your purchase history</Text>
      </View>

      {history.length > 0 && (
        <View style={styles.summaryCards}>
          <View style={styles.summaryCard}>
            <View style={[styles.cardIcon, { backgroundColor: `${theme.accent}15` }]}>
              <Icon name="shopping-bag" size={18} color={theme.accent} />
            </View>
            <Text style={styles.cardValue}>{stats.totalOrders}</Text>
            <Text style={styles.cardLabel}>Orders</Text>
          </View>
          <View style={styles.summaryCard}>
            <View style={[styles.cardIcon, { backgroundColor: `${theme.success}15` }]}>
              <Icon name="money" size={18} color={theme.success} />
            </View>
            <Text style={styles.cardValue}>₱{stats.totalSpent}</Text>
            <Text style={styles.cardLabel}>Total Spent</Text>
          </View>
          <View style={styles.summaryCard}>
            <View style={[styles.cardIcon, { backgroundColor: `${theme.secondary}15` }]}>
              <Icon name="users" size={18} color={theme.secondary} />
            </View>
            <Text style={styles.cardValue}>{stats.uniqueSellers}</Text>
            <Text style={styles.cardLabel}>Sellers</Text>
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
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              All Time
            </Text>
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
            <Text style={[styles.filterText, filter === 'today' && styles.filterTextActive]}>
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
            <Text style={[styles.filterText, filter === 'week' && styles.filterTextActive]}>
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
            <Text style={[styles.filterText, filter === 'month' && styles.filterTextActive]}>
              30 Days
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );

  const renderItem = ({ item, index }) => {
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

    return (
      <Animated.View 
        style={[
          styles.itemWrapper,
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
        <View style={[styles.orderCard, isRecent && styles.orderCardRecent]}>
          <View style={styles.cardTopBar}>
            <View style={styles.dateInfo}>
              <Icon name="calendar" size={13} color={theme.accent} />
              <Text style={styles.dateLabel}> {date}</Text>
            </View>
            <View style={styles.timeInfo}>
              <Icon name="clock-o" size={13} color={theme.textSecondary} />
              <Text style={styles.timeLabel}> {time}</Text>
            </View>
          </View>

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
                  <Text style={styles.recentText}>New</Text>
                </View>
              )}
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.productTitle} numberOfLines={2}>
                {item.product_name}
              </Text>

              <View style={styles.priceRow}>
                <View style={styles.priceBlock}>
                  <Text style={styles.priceTag}>Unit Price</Text>
                  <Text style={styles.priceAmount}>₱{item.price}</Text>
                </View>
                <View style={styles.qtyBlock}>
                  <Text style={styles.qtyTag}>Qty</Text>
                  <Text style={styles.qtyAmount}>×{item.quantity}</Text>
                </View>
              </View>

              <View style={styles.sellerInfo}>
                <Icon name="user" size={11} color={theme.textSecondary} />
                <Text style={styles.sellerName} numberOfLines={1}>
                  {' '}Sold by: {item.seller_name || 'Unknown'}
                </Text>
              </View>

              <View style={styles.totalRow}>
                <Text style={styles.totalTag}>Order Total</Text>
                <Text style={styles.totalAmount}>₱{subtotal}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.detailsButton} activeOpacity={0.7}>
            <Text style={styles.detailsButtonText}>View Details</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.accent} />
          </TouchableOpacity>
        </View>
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
        <Icon name="receipt" size={72} color={theme.iconPlaceholder} />
      </View>
      <Text style={styles.emptyTitle}>No Orders Yet</Text>
      <Text style={styles.emptyDescription}>
        Your checkout history will appear here once you make a purchase
      </Text>
      <TouchableOpacity
        style={styles.shopButton}
        onPress={() => navigation.navigate('Home')}
        activeOpacity={0.8}
      >
        <Icon name="shopping-bag" size={18} color="#fff" style={{ marginRight: 10 }} />
        <Text style={styles.shopButtonText}>Start Shopping</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Loading your orders...</Text>
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
              onRefresh={() => {
                setRefreshing(true);
                fetchCheckoutHistory();
              }}
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
  cardBackgroundRecent: '#252550',
  cardBackgroundAlt: '#252550',
  accent: '#FDAD00',
  success: '#4CAF50',
  secondary: '#3b82f6',
  border: '#2a2a4a',
  iconPlaceholder: '#4a4a6a',
  imagePlaceholder: '#252545',
};

const lightTheme = {
  background: '#f8f9fa',
  headerBackground: '#e8ecf1',
  text: '#1a1a2e',
  textSecondary: '#6b7280',
  cardBackground: '#ffffff',
  cardBackgroundRecent: '#fffbf0',
  cardBackgroundAlt: '#f9f9fc',
  accent: '#f39c12',
  success: '#27ae60',
  secondary: '#3b82f6',
  border: '#e5e7eb',
  iconPlaceholder: '#9ca3af',
  imagePlaceholder: '#f3f4f6',
};

const createStyles = (theme) =>
  StyleSheet.create({
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
      fontSize: 18,
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
      paddingHorizontal: 14,
      paddingVertical: 9,
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
    itemWrapper: {
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    orderCard: {
      backgroundColor: theme.cardBackground,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
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
    orderCardRecent: {
      backgroundColor: theme.cardBackgroundRecent,
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
      fontWeight: '600',
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
      fontWeight: '700',
    },
    infoSection: {
      flex: 1,
    },
    productTitle: {
      fontSize: 16,
      fontWeight: '700',
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
      fontWeight: '700',
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
      fontWeight: '700',
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
      fontWeight: '500',
    },
    totalAmount: {
      fontSize: 18,
      fontWeight: Platform.OS === 'android' ? '800' : '700',
      color: theme.accent,
    },
    detailsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      backgroundColor: theme.cardBackgroundAlt,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    detailsButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.accent,
      marginRight: 6,
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
    shopButton: {
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
    shopButtonText: {
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