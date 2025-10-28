import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
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

export default function CheckoutScreen({ navigation }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const user = auth.currentUser;

  // Automatically detect system theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';

  // Get current theme colors based on system settings
  const theme = isDarkMode ? darkTheme : lightTheme;
  const styles = createStyles(theme);

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

      // Enrich with product images
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
    } catch (err) {
      console.error('Error fetching checkout history:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Calculate statistics
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

  const stats = calculateStats();

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

      {/* Branded logo - upper center-left */}
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
        <Text style={styles.welcomeText}>Your Orders</Text>
        <Text style={styles.userName}>Checkout History</Text>
        <Text style={styles.subtitle}>Review your purchase history</Text>
      </View>

      {/* Stats Section */}
      {history.length > 0 && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Icon name="shopping-bag" size={20} color={theme.accent} />
            <Text style={styles.statValue}>{stats.totalOrders}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <View style={styles.statCard}>
            <Icon name="money" size={20} color={theme.accent} />
            <Text style={styles.statValue}>₱{stats.totalSpent}</Text>
            <Text style={styles.statLabel}>Total Spent</Text>
          </View>
          <View style={styles.statCard}>
            <Icon name="users" size={20} color={theme.accent} />
            <Text style={styles.statValue}>{stats.uniqueSellers}</Text>
            <Text style={styles.statLabel}>Sellers</Text>
          </View>
        </View>
      )}

      {/* Section Title */}
      {history.length > 0 && (
        <View style={styles.sectionTitleContainer}>
          <Icon name="history" size={18} color={theme.text} />
          <Text style={styles.sectionTitle}> Order History</Text>
        </View>
      )}
    </View>
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

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.dateContainer}>
            <Icon name="calendar" size={14} color={theme.accent} />
            <Text style={styles.dateText}> {date}</Text>
          </View>
          <View style={styles.timeContainer}>
            <Icon name="clock-o" size={14} color={theme.textSecondary} />
            <Text style={styles.timeText}> {time}</Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          {thumbnail ? (
            <Image source={{ uri: thumbnail }} style={styles.thumbnail} />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Icon name="image" size={32} color={theme.textSecondary} />
            </View>
          )}

          <View style={styles.details}>
            <Text style={styles.productName} numberOfLines={2}>
              {item.product_name}
            </Text>

            <View style={styles.priceQuantityRow}>
              <View style={styles.priceContainer}>
                <Text style={styles.priceLabel}>Unit Price</Text>
                <Text style={styles.price}>₱{item.price}</Text>
              </View>
              <View style={styles.quantityContainer}>
                <Text style={styles.quantityLabel}>Quantity</Text>
                <Text style={styles.quantity}>x{item.quantity}</Text>
              </View>
            </View>

            <View style={styles.sellerRow}>
              <Icon name="user" size={12} color={theme.textSecondary} />
              <Text style={styles.sellerText} numberOfLines={1}>
                {' '}Sold by: {item.seller_name || 'Unknown'}
              </Text>
            </View>

            <View style={styles.subtotalContainer}>
              <Text style={styles.subtotalLabel}>Order Total:</Text>
              <Text style={styles.subtotal}>₱{subtotal}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="receipt" size={64} color={theme.textSecondary} />
      <Text style={styles.emptyTitle}>No Orders Yet</Text>
      <Text style={styles.emptySubtext}>
        Your checkout history will appear here once you make a purchase
      </Text>
      <TouchableOpacity
        style={styles.shopNowButton}
        onPress={() => navigation.navigate('Home')}
        activeOpacity={0.85}
      >
        <Icon name="shopping-bag" size={16} color="#fff" style={styles.buttonIcon} />
        <Text style={styles.shopNowButtonText}>Start Shopping</Text>
      </TouchableOpacity>
    </View>
  );

  // Full-screen loading overlay
  if (loading && !refreshing) {
    return (
      <View style={styles.loadingOverlay}>
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
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={history}
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

// Dark theme colors (matching CartScreen)
const darkTheme = {
  background: '#0f0f2e',
  gradientBackground: '#1b1b41',
  text: '#fff',
  textSecondary: '#bbb',
  textTertiary: '#ccc',
  cardBackground: '#1e1e3f',
  cardBackgroundAlt: '#252550',
  accent: '#FDAD00',
  accentSecondary: '#e8ecf1',
  success: '#4CAF50',
  shadowColor: '#000',
  borderColor: '#2a2a4a',
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
  accent: '#f39c12',
  accentSecondary: '#e67e22',
  success: '#27ae60',
  shadowColor: '#000',
  borderColor: '#e0e0ea',
};

const createStyles = (theme) =>
  StyleSheet.create({
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
      marginTop: Platform.OS === 'ios' ? 10 : 20,
      marginLeft: 60,
      marginBottom: 20,
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
      fontSize: 18,
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
      marginHorizontal: Math.max(width * 0.05, 20),
      borderWidth: 1,
      borderColor: theme.borderColor,
      overflow: 'hidden',
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
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.cardBackgroundAlt,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderColor,
    },
    dateContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    dateText: {
      fontSize: 14,
      fontWeight: Platform.OS === 'android' ? '600' : '500',
      color: theme.text,
      fontFamily: Platform.select({
        ios: 'Poppins-Medium',
        android: 'Poppins-SemiBold',
        default: 'Poppins-Medium',
      }),
    },
    timeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    timeText: {
      fontSize: 13,
      color: theme.textSecondary,
      fontFamily: Platform.select({
        ios: 'Poppins-Regular',
        android: 'Poppins-Medium',
        default: 'Poppins-Regular',
      }),
    },
    cardContent: {
      flexDirection: 'row',
      padding: 16,
    },
    thumbnail: {
      width: 100,
      height: 100,
      borderRadius: 12,
      marginRight: 16,
      resizeMode: 'cover',
    },
    thumbnailPlaceholder: {
      width: 100,
      height: 100,
      borderRadius: 12,
      marginRight: 16,
      backgroundColor: theme.cardBackgroundAlt,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    details: {
      flex: 1,
    },
    productName: {
      fontSize: 16,
      fontWeight: Platform.OS === 'android' ? '700' : '600',
      color: theme.text,
      marginBottom: 8,
      fontFamily: Platform.select({
        ios: 'Poppins-SemiBold',
        android: 'Poppins-Bold',
        default: 'Poppins-SemiBold',
      }),
    },
    priceQuantityRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    priceContainer: {
      flex: 1,
    },
    priceLabel: {
      fontSize: 11,
      color: theme.textSecondary,
      marginBottom: 2,
      fontWeight: Platform.OS === 'android' ? '500' : '400',
      fontFamily: Platform.select({
        ios: 'Poppins-Regular',
        android: 'Poppins-Medium',
        default: 'Poppins-Regular',
      }),
    },
    price: {
      fontSize: 15,
      fontWeight: Platform.OS === 'android' ? '700' : '600',
      color: theme.accent,
      fontFamily: Platform.select({
        ios: 'Poppins-SemiBold',
        android: 'Poppins-Bold',
        default: 'Poppins-SemiBold',
      }),
    },
    quantityContainer: {
      alignItems: 'flex-end',
    },
    quantityLabel: {
      fontSize: 11,
      color: theme.textSecondary,
      marginBottom: 2,
      fontWeight: Platform.OS === 'android' ? '500' : '400',
      fontFamily: Platform.select({
        ios: 'Poppins-Regular',
        android: 'Poppins-Medium',
        default: 'Poppins-Regular',
      }),
    },
    quantity: {
      fontSize: 15,
      fontWeight: Platform.OS === 'android' ? '700' : '600',
      color: theme.text,
      fontFamily: Platform.select({
        ios: 'Poppins-Medium',
        android: 'Poppins-SemiBold',
        default: 'Poppins-Medium',
      }),
    },
    sellerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    sellerText: {
      fontSize: 13,
      color: theme.textSecondary,
      flex: 1,
      fontFamily: Platform.select({
        ios: 'Poppins-Regular',
        android: 'Poppins-Medium',
        default: 'Poppins-Regular',
      }),
    },
    subtotalContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.borderColor,
    },
    subtotalLabel: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: Platform.OS === 'android' ? '500' : '400',
      fontFamily: Platform.select({
        ios: 'Poppins-Regular',
        android: 'Poppins-Medium',
        default: 'Poppins-Regular',
      }),
    },
    subtotal: {
      fontSize: 18,
      fontWeight: Platform.OS === 'android' ? '800' : '700',
      color: theme.accent,
      fontFamily: Platform.select({
        ios: 'Poppins-Bold',
        android: 'Poppins-ExtraBold',
        default: 'Poppins-Bold',
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
    shopNowButton: {
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
    shopNowButtonText: {
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