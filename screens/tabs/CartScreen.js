// screens/CartScreen.js
import { Ionicons } from '@expo/vector-icons';
import ExpoCheckbox from "expo-checkbox";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

export const handleDirectCheckout = async (product, buyer, buyerName) => {
  if (!product || !buyer || !buyerName) {
    Alert.alert("Error", "Missing product or user information for checkout.");
    return false;
  }

  try {
    // Add item to checkout history
    const { error: historyError } = await supabase
      .from("checkout_history")
      .insert([{
        buyer_email: buyer.email,
        product_name: product.product_name,
        price: product.price,
        quantity: 1, // Assuming checkout of 1 item
        seller_name: product.seller_name || 'Unknown Seller',
        checkout_date: new Date().toISOString(),
      }]);

    if (historyError) throw historyError;

    // Get current product data to ensure quantity is up-to-date
    const { data: currentProduct, error: productError } = await supabase
      .from("products")
      .select("quantity, email")
      .eq("id", product.id || product.product_id) // Handle both product objects
      .single();

    if (productError || !currentProduct) {
      throw new Error("Could not retrieve product details for checkout.");
    }

    if (currentProduct.quantity < 1) {
      Alert.alert("Out of Stock", "This item is no longer available.");
      return false;
    }

    // Update product quantity
    const newQuantity = currentProduct.quantity - 1;
    const { error: updateError } = await supabase
      .from("products")
      .update({ 
        quantity: newQuantity,
        is_visible: newQuantity > 0 
      })
      .eq("id", product.id || product.product_id);

    if (updateError) throw updateError;

    // Send notification to seller
    await supabase.from("notifications").insert({
      sender_id: buyer.email,
      receiver_id: currentProduct.email,
      title: "Product Sold! 🎉",
      message: `${buyerName} has purchased your product: "${product.product_name}".`,
    });

    return true;
  } catch (e) {
    console.error("Direct checkout error:", e);
    Alert.alert("Checkout Failed", e.message || "There was a problem processing your order.");
    return false;
  }
};

export default function CartScreen({ navigation }) {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [buyerName, setBuyerName] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  
  const user = auth.currentUser;
  
  // Automatically detect system theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  
  // Animation values - FIXED: Start with full opacity
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const headerSlideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Get current theme colors based on system settings
  const theme = isDarkMode ? darkTheme : lightTheme;

  // Fetch buyer name
  useEffect(() => {
    const fetchBuyerName = async () => {
      if (!user?.email) return;
      const { data, error } = await supabase
        .from("users")
        .select("name")
        .eq("email", user.email)
        .maybeSingle();
      if (!error && data?.name) setBuyerName(data.name);
    };
    fetchBuyerName();
  }, [user]);

  // Fetch cart items
  const fetchCart = useCallback(async () => {
    if (!buyerName) return;
    if (!refreshing) setLoading(true);
    
    const { data, error } = await supabase.from("cart").select("*");

    if (!error) {
      // Enrich with product images
      const enrichedData = await Promise.all(
        data.map(async (item) => {
          const { data: productData, error: productError } = await supabase
            .from("products")
            .select("*")
            .eq("product_name", item.product_name)
            .maybeSingle();

          if (!productError && productData) {
            let images;
            try {
              images = JSON.parse(productData.product_image_url);
              if (!Array.isArray(images)) images = [productData.product_image_url];
            } catch {
              images = [productData.product_image_url];
            }
            return { ...item, productData, product_image_urls: images };
          }
          return item;
        })
      );

      setCartItems(enrichedData.filter((item) => item.name === buyerName));
      setSelectedIds([]);
    } else {
      console.error(error);
      Alert.alert('Error', 'Failed to load cart items');
    }
    setLoading(false);
    setRefreshing(false);
  }, [buyerName, refreshing]);

  useEffect(() => {
    if (buyerName) fetchCart();
  }, [buyerName, fetchCart]);

  // Remove item
  const removeFromCart = async (id) => {
    Alert.alert('Remove Item', 'Are you sure you want to remove this item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from("cart").delete().eq("id", id);
          if (!error) {
            setCartItems(cartItems.filter((item) => item.id !== id));
            setSelectedIds(selectedIds.filter((sid) => sid !== id));
          } else {
            Alert.alert('Error', 'Failed to remove item');
          }
        },
      },
    ]);
  };

  const handleCheckout = async () => {
    if (selectedIds.length === 0) {
      Alert.alert("No Items Selected", "Please select items to checkout.");
      return;
    }

    const itemsToCheckout = cartItems.filter((item) => selectedIds.includes(item.id));

    setIsCheckingOut(true);
    let allCheckoutsSuccessful = true;

    for (const item of itemsToCheckout) {
      const productToCheckout = {
        ...item.productData,
        product_id: item.productData.id,
      };
      const success = await handleDirectCheckout(productToCheckout, user, buyerName);
      if (!success) {
        allCheckoutsSuccessful = false;
        // The handleDirectCheckout function already shows an alert on failure.
        // We can break here or continue trying other items. Let's continue.
      }
    }
    
    if (allCheckoutsSuccessful) {
      const { error } = await supabase.from("cart").delete().in("id", selectedIds);
      if (!error) {
        setCartItems(cartItems.filter((item) => !selectedIds.includes(item.id)));
        setSelectedIds([]);
        Alert.alert("Order Successful 🎉", "Thank you for shopping at BuyNaBay!");
      } else {
        console.error(error);
        Alert.alert("Checkout Failed", "There was a problem processing your order.");
      }
    }

    setIsCheckingOut(false);
  };

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((sid) => sid !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const allSelected = cartItems.length > 0 && selectedIds.length === cartItems.length;

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(cartItems.map((c) => c.id));
  };

  // Calculate total price of selected items
  const calculateTotal = () => {
    return cartItems
      .filter(item => selectedIds.includes(item.id))
      .reduce((sum, item) => sum + (parseFloat(item.price) * parseInt(item.quantity)), 0)
      .toFixed(2);
  };

  const styles = createStyles(theme);

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Background gradient effect */}
      <View style={styles.backgroundGradient} />

      {/* Branded logo - upper left */}
      <View style={styles.brandedLogoContainer}>
        <Image
          source={require('../../assets/images/OfficialBuyNaBay.png')}
          style={styles.brandedLogoImage}
          resizeMode="contain"
        />
        <Text style={styles.brandedLogoText}>BuyNaBay</Text>
      </View>

      {/* Action buttons - upper right */}
      <View style={styles.headerActionsContainer}>
        {/* History Button */}
        <TouchableOpacity
          onPress={() => navigation.navigate('CheckoutScreen')}
          style={[styles.actionButton, styles.historyButton]}
          activeOpacity={0.85}
        >
          <Ionicons name="receipt-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Welcome Section */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>My Shopping Cart</Text>
        <Text style={styles.userName}>
          {buyerName || user?.displayName || user?.email?.split('@')[0] || 'Shopper'}
        </Text>
        <Text style={styles.subtitle}>Review and checkout your items</Text>
      </View>

      {/* Stats Section */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Icon name="shopping-cart" size={20} color={theme.accent} />
          <Text style={styles.statValue}>{cartItems.length}</Text>
          <Text style={styles.statLabel}>Items</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="check-circle" size={20} color={theme.accent} />
          <Text style={styles.statValue}>{selectedIds.length}</Text>
          <Text style={styles.statLabel}>Selected</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="money" size={20} color={theme.accent} />
          <Text style={styles.statValue}>₱{calculateTotal()}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {/* Select All Section */}
      {cartItems.length > 0 && (
        <View style={styles.selectAllContainer}>
          <ExpoCheckbox
            value={allSelected}
            onValueChange={toggleSelectAll}
            color={allSelected ? theme.accent : undefined}
            style={styles.checkbox}
          />
          <Text style={styles.selectAllText}>Select All Items</Text>
        </View>
      )}

      {/* Section Title */}
      {cartItems.length > 0 && (
        <View style={styles.sectionTitleContainer}>
          <Icon name="shopping-bag" size={18} color={theme.text} />
          <Text style={styles.sectionTitle}> Cart Items</Text>
        </View>
      )}
    </View>
  );

  const renderItem = ({ item, index }) => {
    const thumbnail = item.product_image_urls?.[0] || null;
    const isSelected = selectedIds.includes(item.id);

    return (
      <View style={styles.cardRow}>
        <View style={styles.cardLeft}>
          <ExpoCheckbox
            value={isSelected}
            onValueChange={() => toggleSelect(item.id)}
            color={isSelected ? theme.accent : undefined}
            style={styles.checkbox}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.card,
            isSelected && styles.cardSelected,
          ]}
          activeOpacity={0.85}
          onPress={() =>
            item.productData && navigation.navigate("ProductDetails", { product: item.productData })
          }
        >
          {thumbnail ? (
            <Image source={{ uri: thumbnail }} style={styles.thumbnail} />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Icon name="image" size={40} color={theme.textSecondary} />
            </View>
          )}

          <View style={styles.cardContent}>
            <Text style={styles.productName} numberOfLines={2}>
              {item.product_name}
            </Text>
            
            <View style={styles.priceQuantityRow}>
              <View style={styles.priceContainer}>
                <Text style={styles.priceLabel}>Price</Text>
                <Text style={styles.price}>₱{item.price}</Text>
              </View>
              <View style={styles.quantityContainer}>
                <Text style={styles.quantityLabel}>Quantity</Text>
                <Text style={styles.quantity}>{item.quantity}</Text>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <View style={styles.subtotalContainer}>
                <Text style={styles.subtotalLabel}>Subtotal:</Text>
                <Text style={styles.subtotal}>
                  ₱{(parseFloat(item.price) * parseInt(item.quantity)).toFixed(2)}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.removeBtn} 
                onPress={() => removeFromCart(item.id)}
                activeOpacity={0.85}
              >
                <Icon name="trash" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="shopping-cart" size={64} color={theme.textSecondary} />
      <Text style={styles.emptyTitle}>Your Cart is Empty</Text>
      <Text style={styles.emptySubtext}>
        Start adding products to your cart and enjoy shopping!
      </Text>
      <TouchableOpacity
        style={styles.shopNowButton}
        onPress={() => navigation.navigate('Home')}
        activeOpacity={0.85}
      >
        <Icon name="shopping-bag" size={16} color="#fff" style={styles.buttonIcon} />
        <Text style={styles.shopNowButtonText}>Shop Now</Text>
      </TouchableOpacity>
    </View>
  );

  // Full-screen loading overlay
  if (loading && !refreshing) {
    return (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Loading your cart...</Text>
      </View>
    );
  }

  const selectedCount = selectedIds.length;

  return (
    <>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
        translucent={false}
      />
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={cartItems}
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
                fetchCart();
              }}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          }
        />

        {/* Checkout Footer */}
        {cartItems.length > 0 && (
          <View style={styles.checkoutContainer}>
            <View style={styles.checkoutSummary}>
              <View>
                <Text style={styles.summaryLabel}>Total Amount</Text>
                <Text style={styles.summaryValue}>₱{calculateTotal()}</Text>
              </View>
              <Text style={styles.selectedCount}>
                {selectedCount} {selectedCount === 1 ? 'item' : 'items'} selected
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.checkoutBtn,
                (selectedCount === 0 || isCheckingOut) && styles.checkoutBtnDisabled,
              ]}
              onPress={handleCheckout}
              disabled={selectedCount === 0 || isCheckingOut}
              activeOpacity={0.85}
            >
              {isCheckingOut ? (
                <View style={styles.checkoutLoadingContainer}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.checkoutText, { marginLeft: 10 }]}>Processing...</Text>
                </View>
              ) : (
                <>
                  <Icon name="shopping-bag" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.checkoutText}>Checkout Now</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </>
  );
}

// Dark theme colors (matching HomeScreen)
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
  borderSelected: '#FDAD00',
  buttonDisabled: '#555',
};

// Light theme colors (matching HomeScreen)
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
  borderSelected: '#f39c12',
  buttonDisabled: '#ccc',
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
  brandedLogoContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 10 : 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
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
  headerActionsContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 10 : 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 10,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  historyButton: {
    backgroundColor: theme.historyColor,
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
  selectAllContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 16,
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
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
  },
  selectAllText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    color: theme.text,
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
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
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingHorizontal: Math.max(width * 0.05, 20),
  },
  cardLeft: {
    width: 40,
    alignItems: 'center',
    marginTop: 16,
  },
  card: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    overflow: 'hidden',
    flex: 1,
    marginLeft: 8,
    borderWidth: 2,
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
  cardSelected: {
    borderColor: theme.borderSelected,
    backgroundColor: theme.cardBackgroundSelected,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  thumbnail: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: 140,
    backgroundColor: theme.cardBackgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
  },
  cardContent: {
    padding: 16,
  },
  productName: {
    fontSize: 18,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    color: theme.text,
    marginBottom: 12,
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  priceQuantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  priceContainer: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 4,
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  price: {
    fontSize: 18,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    color: theme.accent,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  quantityContainer: {
    alignItems: 'flex-end',
  },
  quantityLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 4,
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  quantity: {
    fontSize: 18,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    color: theme.text,
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  subtotalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subtotalLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    marginRight: 8,
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  subtotal: {
    fontSize: 16,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    color: theme.accent,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  removeBtn: {
    backgroundColor: theme.error,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: theme.error,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  removeText: {
    color: '#fff',
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    fontSize: 14,
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
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
  checkoutContainer: {
    backgroundColor: theme.cardBackground,
    paddingHorizontal: Math.max(width * 0.05, 20),
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: theme.borderColor,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  checkoutSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    color: theme.textSecondary,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    color: theme.accent,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  selectedCount: {
    fontSize: 14,
    color: theme.textSecondary,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  checkoutBtn: {
    backgroundColor: theme.accent,
    paddingVertical: Platform.OS === 'ios' ? 18 : 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  checkoutBtnDisabled: {
    backgroundColor: theme.buttonDisabled,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  checkoutText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  checkoutLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});