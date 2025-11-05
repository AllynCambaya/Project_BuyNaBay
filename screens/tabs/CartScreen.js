import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { darkTheme, lightTheme } from '../../theme/theme';
import { fontFamily } from '../../theme/typography';

const { width } = Dimensions.get('window');

export default function CartScreen({ navigation, route }) {
  // Assume cart items are passed via route or context
  const [cartItems, setCartItems] = useState(route.params?.cartItems || []);
  
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();

  // Animation refs
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  // Header collapse animation
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, -20],
    extrapolate: 'clamp',
  });

  // Initialize animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerSlideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Cart calculations
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = subtotal > 0 ? 50 : 0;
  const total = subtotal + deliveryFee;

  const handleQuantityChange = (itemId, change) => {
    setCartItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQty = Math.max(0, item.quantity + change);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const handleRemoveItem = (itemId) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => setCartItems(prev => prev.filter(item => item.id !== itemId))
        }
      ]
    );
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Add items to your cart before checking out');
      return;
    }
    // Navigate to checkout
    navigation.navigate('Checkout', { cartItems, total });
  };

  const styles = createStyles(theme, insets, isDarkMode);

  const renderHeader = () => (
    <Animated.View
      style={[
        styles.headerContainer,
        {
          transform: [{ translateY: headerSlideAnim }],
          opacity: fadeAnim,
        },
      ]}
    >
      {/* Gradient Background */}
      <View style={styles.backgroundGradient}>
        <View style={styles.gradientOverlay} />
      </View>

      {/* Top Navigation Bar */}
      <View style={styles.topNavBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>

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
              Your Cart
            </Text>
          </View>
        </View>

        <View style={styles.cartBadgeContainer}>
          <View style={[styles.cartBadge, { backgroundColor: theme.accent }]}>
            <Text style={[styles.cartBadgeText, { fontFamily: fontFamily.bold }]}>
              {cartItems.length}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );

  const renderCartItem = (item, index) => (
    <Animated.View
      key={item.id}
      style={[
        styles.cartItemCard,
        {
          opacity: fadeAnim,
          transform: [
            { scale: scaleAnim },
            { translateY: Animated.add(fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0]
            }), new Animated.Value(index * 2)) }
          ]
        }
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.cartItemContent}
        onPress={() => navigation.navigate('ProductDetails', { product: item })}
      >
        {/* Product Image */}
        <View style={styles.itemImageContainer}>
          <Image
            source={{ uri: item.image || item.product_image_url }}
            style={styles.itemImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.1)']}
            style={styles.imageGradient}
          />
        </View>

        {/* Product Details */}
        <View style={styles.itemDetails}>
          <Text
            style={[styles.itemName, { fontFamily: fontFamily.semiBold }]}
            numberOfLines={2}
          >
            {item.product_name || item.name}
          </Text>
          
          {item.category && (
            <View style={styles.itemCategoryBadge}>
              <Text style={[styles.itemCategoryText, { fontFamily: fontFamily.medium }]}>
                {item.category}
              </Text>
            </View>
          )}

          <View style={styles.priceQuantityRow}>
            <Text style={[styles.itemPrice, { fontFamily: fontFamily.bold }]}>
              ₱{item.price}
            </Text>

            {/* Quantity Controls */}
            <View style={styles.quantityControl}>
              <TouchableOpacity
                style={[styles.qtyButton, item.quantity <= 1 && styles.qtyButtonDisabled]}
                onPress={() => handleQuantityChange(item.id, -1)}
                disabled={item.quantity <= 1}
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={16} color="#fff" />
              </TouchableOpacity>
              
              <Text style={[styles.qtyText, { fontFamily: fontFamily.bold }]}>
                {item.quantity}
              </Text>
              
              <TouchableOpacity
                style={styles.qtyButton}
                onPress={() => handleQuantityChange(item.id, 1)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Item Total */}
          <Text style={[styles.itemTotal, { fontFamily: fontFamily.bold }]}>
            Total: ₱{(item.price * item.quantity).toFixed(2)}
          </Text>
        </View>

        {/* Remove Button */}
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveItem(item.id)}
          activeOpacity={0.7}
        >
          <Ionicons name="close-circle" size={24} color="#FF6B6B" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderEmptyCart = () => (
    <Animated.View
      style={[
        styles.emptyContainer,
        { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
      ]}
    >
      <View style={styles.emptyIconWrapper}>
        <Ionicons name="cart-outline" size={80} color={theme.textSecondary} />
      </View>
      <Text style={[styles.emptyTitle, { fontFamily: fontFamily.bold }]}>
        Your Cart is Empty
      </Text>
      <Text style={[styles.emptySubtitle, { fontFamily: fontFamily.medium }]}>
        Start adding items to your cart and they'll appear here
      </Text>
      <TouchableOpacity
        style={styles.shopButton}
        onPress={() => navigation.navigate('HomeScreen')}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#FDAD00', '#FF9500']}
          style={styles.shopButtonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Ionicons name="storefront" size={20} color="#fff" />
          <Text style={[styles.shopButtonText, { fontFamily: fontFamily.bold }]}>
            Start Shopping
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
        translucent={false}
      />
      <View style={styles.container}>
        {renderHeader()}

        <Animated.ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        >
          {cartItems.length === 0 ? (
            renderEmptyCart()
          ) : (
            <>
              {/* Cart Items */}
              <View style={styles.itemsContainer}>
                {cartItems.map((item, index) => renderCartItem(item, index))}
              </View>

              {/* Spacer for bottom summary */}
              <View style={{ height: 220 }} />
            </>
          )}
        </Animated.ScrollView>

        {/* Bottom Summary (Fixed) */}
        {cartItems.length > 0 && (
          <Animated.View
            style={[
              styles.summaryContainer,
              { opacity: fadeAnim, transform: [{ translateY: scaleAnim.interpolate({
                inputRange: [0.95, 1],
                outputRange: [100, 0]
              })}]}
            ]}
          >
            <View style={styles.summaryContent}>
              {/* Summary Rows */}
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { fontFamily: fontFamily.medium }]}>
                  Subtotal ({cartItems.length} {cartItems.length === 1 ? 'item' : 'items'})
                </Text>
                <Text style={[styles.summaryValue, { fontFamily: fontFamily.semiBold }]}>
                  ₱{subtotal.toFixed(2)}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { fontFamily: fontFamily.medium }]}>
                  Delivery Fee
                </Text>
                <Text style={[styles.summaryValue, { fontFamily: fontFamily.semiBold }]}>
                  ₱{deliveryFee.toFixed(2)}
                </Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryRow}>
                <Text style={[styles.totalLabel, { fontFamily: fontFamily.extraBold }]}>
                  Total
                </Text>
                <Text style={[styles.totalValue, { fontFamily: fontFamily.black }]}>
                  ₱{total.toFixed(2)}
                </Text>
              </View>

              {/* Checkout Button */}
              <TouchableOpacity
                style={styles.checkoutButton}
                onPress={handleCheckout}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#FDAD00', '#FF9500']}
                  style={styles.checkoutGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="card" size={22} color="#fff" />
                  <Text style={[styles.checkoutText, { fontFamily: fontFamily.bold }]}>
                    Proceed to Checkout
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.continueButton}
                onPress={() => navigation.goBack()}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-back" size={18} color={theme.text} />
                <Text style={[styles.continueText, { fontFamily: fontFamily.semiBold }]}>
                  Continue Shopping
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </View>
    </>
  );
}

const createStyles = (theme, insets, isDarkMode) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    backgroundGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '100%',
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
    headerContainer: {
      paddingHorizontal: 20,
      paddingTop: insets.top + 12,
      paddingBottom: 16,
      zIndex: 1,
    },
    topNavBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
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
    brandedLogoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      marginLeft: 12,
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
    cartBadgeContainer: {
      position: 'relative',
    },
    cartBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
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
          elevation: 4,
        },
      }),
    },
    cartBadgeText: {
      fontSize: 16,
      color: '#fff',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: 8,
      paddingBottom: 32,
    },
    itemsContainer: {
      paddingHorizontal: 20,
      gap: 16,
    },
    cartItemCard: {
      backgroundColor: theme.cardBackground,
      borderRadius: 20,
      overflow: 'hidden',
      marginBottom: 4,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(253, 173, 0, 0.1)' : 'rgba(0, 0, 0, 0.05)',
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    cartItemContent: {
      flexDirection: 'row',
      padding: 16,
      position: 'relative',
    },
    itemImageContainer: {
      width: 100,
      height: 100,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: isDarkMode ? 'rgba(42, 40, 86, 0.4)' : 'rgba(245, 245, 245, 1)',
      marginRight: 16,
    },
    itemImage: {
      width: '100%',
      height: '100%',
    },
    imageGradient: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 30,
    },
    itemDetails: {
      flex: 1,
      justifyContent: 'space-between',
    },
    itemName: {
      fontSize: 16,
      color: theme.text,
      marginBottom: 6,
      lineHeight: 22,
    },
    itemCategoryBadge: {
      alignSelf: 'flex-start',
      backgroundColor: isDarkMode ? 'rgba(253, 173, 0, 0.15)' : 'rgba(253, 173, 0, 0.1)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      marginBottom: 8,
    },
    itemCategoryText: {
      fontSize: 10,
      color: isDarkMode ? theme.accent : '#FF9500',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    priceQuantityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    itemPrice: {
      fontSize: 18,
      color: theme.accent,
    },
    quantityControl: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkMode ? 'rgba(42, 40, 86, 0.6)' : 'rgba(245, 245, 245, 1)',
      borderRadius: 12,
      overflow: 'hidden',
    },
    qtyButton: {
      width: 32,
      height: 32,
      backgroundColor: theme.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    qtyButtonDisabled: {
      backgroundColor: theme.textSecondary,
      opacity: 0.4,
    },
    qtyText: {
      paddingHorizontal: 14,
      fontSize: 15,
      color: theme.text,
    },
    itemTotal: {
      fontSize: 14,
      color: theme.text,
    },
    removeButton: {
      position: 'absolute',
      top: 12,
      right: 12,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDarkMode ? 'rgba(255, 107, 107, 0.15)' : 'rgba(255, 107, 107, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    summaryContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.cardBackground,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingBottom: insets.bottom || 20,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(253, 173, 0, 0.1)' : 'rgba(0, 0, 0, 0.05)',
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    summaryContent: {
      paddingHorizontal: 24,
      paddingTop: 24,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    summaryLabel: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    summaryValue: {
      fontSize: 15,
      color: theme.text,
    },
    summaryDivider: {
      height: 1,
      backgroundColor: isDarkMode ? 'rgba(253, 173, 0, 0.1)' : 'rgba(0, 0, 0, 0.08)',
      marginVertical: 8,
    },
    totalLabel: {
      fontSize: 20,
      color: theme.text,
    },
    totalValue: {
      fontSize: 26,
      color: theme.accent,
    },
    checkoutButton: {
      marginTop: 20,
      borderRadius: 16,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#FDAD00',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
        },
        android: {
          elevation: 6,
        },
      }),
    },
    checkoutGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 18,
      gap: 10,
    },
    checkoutText: {
      fontSize: 16,
      color: '#fff',
      letterSpacing: 0.3,
    },
    continueButton: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      gap: 8,
    },
    continueText: {
      fontSize: 14,
      color: theme.text,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 100,
      paddingHorizontal: 32,
    },
    emptyIconWrapper: {
      width: 160,
      height: 160,
      borderRadius: 80,
      backgroundColor: isDarkMode ? 'rgba(42, 40, 86, 0.6)' : 'rgba(245, 245, 245, 1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 32,
      borderWidth: 3,
      borderColor: isDarkMode ? 'rgba(253, 173, 0, 0.2)' : 'rgba(0, 0, 0, 0.08)',
      borderStyle: 'dashed',
    },
    emptyTitle: {
      fontSize: 26,
      color: theme.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 15,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 40,
      lineHeight: 22,
    },
    shopButton: {
      borderRadius: 16,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#FDAD00',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
        },
        android: {
          elevation: 6,
        },
      }),
    },
    shopButtonGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 32,
      gap: 10,
    },
    shopButtonText: {
      fontSize: 16,
      color: '#fff',
    },
  });