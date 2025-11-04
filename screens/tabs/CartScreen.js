// screens/CartScreen.js
import { FontAwesome as Icon, Ionicons } from '@expo/vector-icons';
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
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../firebase/firebaseConfig";
import { supabase } from "../../supabase/supabaseClient";

const { width, height } = Dimensions.get('window');

export const handleDirectCheckout = async (product, buyer, buyerName) => {
  if (!product || !buyer || !buyerName) {
    Alert.alert("Error", "Missing product or user information for checkout.");
    return false;
  }

  try {
    const { error: historyError } = await supabase
      .from("checkout_history")
      .insert([{
        buyer_email: buyer.email,
        product_name: product.product_name,
        price: product.price,
        quantity: 1,
        seller_name: product.seller_name || 'Unknown Seller',
        checkout_date: new Date().toISOString(),
      }]);

    if (historyError) throw historyError;

    const { data: currentProduct, error: productError } = await supabase
      .from("products")
      .select("quantity, email")
      .eq("id", product.id || product.product_id)
      .single();

    if (productError || !currentProduct) {
      throw new Error("Could not retrieve product details for checkout.");
    }

    if (currentProduct.quantity < 1) {
      Alert.alert("Out of Stock", "This item is no longer available.");
      return false;
    }

    const newQuantity = currentProduct.quantity - 1;
    const { error: updateError } = await supabase
      .from("products")
      .update({ 
        quantity: newQuantity,
        is_visible: newQuantity > 0 
      })
      .eq("id", product.id || product.product_id);

    if (updateError) throw updateError;

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
  const [userProfileImage, setUserProfileImage] = useState(null);
  
  const user = auth.currentUser;
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  const slideAnim = useRef(new Animated.Value(50)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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
    const fetchUserProfile = async () => {
      if (user?.email) {
        const { data, error } = await supabase
          .from('users')
          .select('profile_photo')
          .eq('email', user.email)
          .single();
        if (!error && data) {
          setUserProfileImage(data.profile_photo);
        }
      }
    };

    fetchUserProfile();
    fetchBuyerName();
  }, [user]);

  const fetchCart = useCallback(async () => {
    if (!buyerName) return;
    if (!refreshing) setLoading(true);
    
    const { data, error } = await supabase.from("cart").select("*");

    if (!error) {
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

  const calculateTotal = () => {
    return cartItems
      .filter(item => selectedIds.includes(item.id))
      .reduce((sum, item) => sum + (parseFloat(item.price) * parseInt(item.quantity)), 0)
      .toFixed(2);
  };

  const styles = createStyles(theme);

  const renderHeader = () => (
    <Animated.View 
      style={[
        styles.headerContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <View style={styles.headerBackground}>
        <View style={styles.gradientOverlay} />
      </View>

      <View style={styles.topBar}>
        <View style={styles.brandContainer}>
          <Image
            source={require('../../assets/images/OfficialBuyNaBay.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <Text style={styles.brandText}>BuyNaBay</Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            onPress={() => navigation.navigate('CheckoutScreen')}
            style={[styles.iconButton, styles.historyButton]}
            activeOpacity={0.7}
          >
            <Ionicons name="receipt-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => navigation.navigate("ProfileScreen")}
            activeOpacity={0.8}
          >
            <Image
              source={userProfileImage ? { uri: userProfileImage } : require("../../assets/images/OfficialBuyNaBay.png")}
              style={styles.profileImage}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.welcomeContainer}>
        <Text style={styles.greetingText}>Shopping Cart</Text>
        <Text style={styles.userNameText}>
          {buyerName || user?.displayName || user?.email?.split('@')[0] || 'Shopper'}
        </Text>
        <Text style={styles.descriptionText}>Review your items before checkout</Text>
      </View>

      <View style={styles.summaryCards}>
        <View style={styles.summaryCard}>
          <View style={styles.cardIconContainer}>
            <Icon name="shopping-cart" size={18} color={theme.accent} />
          </View>
          <Text style={styles.cardValue}>{cartItems.length}</Text>
          <Text style={styles.cardLabel}>Items</Text>
        </View>
        <View style={styles.summaryCard}>
          <View style={styles.cardIconContainer}>
            <Icon name="check-circle" size={18} color={theme.accent} />
          </View>
          <Text style={styles.cardValue}>{selectedIds.length}</Text>
          <Text style={styles.cardLabel}>Selected</Text>
        </View>
        <View style={styles.summaryCard}>
          <View style={styles.cardIconContainer}>
            <Icon name="money" size={18} color={theme.accent} />
          </View>
          <Text style={styles.cardValue}>₱{calculateTotal()}</Text>
          <Text style={styles.cardLabel}>Total</Text>
        </View>
      </View>

      {cartItems.length > 0 && (
        <TouchableOpacity 
          style={styles.selectAllBar}
          onPress={toggleSelectAll}
          activeOpacity={0.7}
        >
          <ExpoCheckbox
            value={allSelected}
            onValueChange={toggleSelectAll}
            color={allSelected ? theme.accent : undefined}
            style={styles.checkbox}
          />
          <Text style={styles.selectAllLabel}>Select All Items</Text>
          <View style={styles.selectAllBadge}>
            <Text style={styles.badgeText}>{cartItems.length}</Text>
          </View>
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  const renderItem = ({ item, index }) => {
    const thumbnail = item.product_image_urls?.[0] || null;
    const isSelected = selectedIds.includes(item.id);

    return (
      <Animated.View 
        style={[
          styles.itemContainer,
          {
            opacity: fadeAnim,
            transform: [{ 
              translateY: slideAnim.interpolate({
                inputRange: [0, 50],
                outputRange: [0, 50 + index * 10]
              })
            }]
          }
        ]}
      >
        <TouchableOpacity
          style={[styles.itemCard, isSelected && styles.itemCardSelected]}
          activeOpacity={0.9}
          onPress={() =>
            item.productData && navigation.navigate("ProductDetails", { product: item.productData })
          }
        >
          <TouchableOpacity 
            style={styles.checkboxContainer}
            onPress={() => toggleSelect(item.id)}
            activeOpacity={0.7}
          >
            <ExpoCheckbox
              value={isSelected}
              onValueChange={() => toggleSelect(item.id)}
              color={isSelected ? theme.accent : undefined}
              style={styles.itemCheckbox}
            />
          </TouchableOpacity>

          <View style={styles.imageContainer}>
            {thumbnail ? (
              <Image source={{ uri: thumbnail }} style={styles.productImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Icon name="image" size={32} color={theme.iconPlaceholder} />
              </View>
            )}
          </View>

          <View style={styles.detailsContainer}>
            <Text style={styles.productTitle} numberOfLines={2}>
              {item.product_name}
            </Text>
            
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Price</Text>
                <Text style={styles.priceText}>₱{item.price}</Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Qty</Text>
                <Text style={styles.quantityText}>×{item.quantity}</Text>
              </View>
            </View>

            <View style={styles.footerRow}>
              <View style={styles.totalContainer}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalAmount}>
                  ₱{(parseFloat(item.price) * parseInt(item.quantity)).toFixed(2)}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.deleteButton} 
                onPress={() => removeFromCart(item.id)}
                activeOpacity={0.7}
              >
                <Icon name="trash-o" size={16} color="#fff" />
              </TouchableOpacity>
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
        <Icon name="shopping-cart" size={72} color={theme.iconPlaceholder} />
      </View>
      <Text style={styles.emptyTitle}>Your Cart is Empty</Text>
      <Text style={styles.emptyDescription}>
        Discover amazing products and start adding them to your cart
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
        <Text style={styles.loadingText}>Loading your cart...</Text>
      </View>
    );
  }

  const selectedCount = selectedIds.length;

  return (
      <SafeAreaView style={styles.container}>
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

        {cartItems.length > 0 && (
          <View style={styles.checkoutFooter}>
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.totalText}>Total Amount</Text>
                <Text style={styles.totalPrice}>₱{calculateTotal()}</Text>
              </View>
              <Text style={styles.itemCount}>
                {selectedCount} {selectedCount === 1 ? 'item' : 'items'}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.checkoutButton,
                (selectedCount === 0 || isCheckingOut) && styles.checkoutButtonDisabled,
              ]}
              onPress={handleCheckout}
              disabled={selectedCount === 0 || isCheckingOut}
              activeOpacity={0.8}
            >
              {isCheckingOut ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.checkoutButtonText, { marginLeft: 10 }]}>Processing...</Text>
                </View>
              ) : (
                <>
                  <Icon name="check-circle" size={20} color="#fff" style={{ marginRight: 10 }} />
                  <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
  );
}

const darkTheme = {
  background: '#0f0f2e',
  headerBackground: '#1b1b41',
  text: '#ffffff',
  textSecondary: '#a8a8c8',
  cardBackground: '#1e1e3f',
  cardSelected: '#2a2a55',
  accent: '#FDAD00',
  error: '#ef4444',
  border: '#2a2a4a',
  borderSelected: '#FDAD00',
  iconPlaceholder: '#4a4a6a',
  buttonDisabled: '#3a3a5a',
  imagePlaceholder: '#252545',
};

const lightTheme = {
  background: '#f8f9fa',
  headerBackground: '#e8ecf1',
  text: '#1a1a2e',
  textSecondary: '#6b7280',
  cardBackground: '#ffffff',
  cardSelected: '#fffbf0',
  accent: '#f39c12',
  error: '#ef4444',
  border: '#e5e7eb',
  borderSelected: '#f39c12',
  iconPlaceholder: '#9ca3af',
  buttonDisabled: '#d1d5db',
  imagePlaceholder: '#f3f4f6',
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
    height: 330,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20, // Adjusted padding
    paddingTop: 16,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
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
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  historyButton: {
    backgroundColor: '#10b981',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: theme.border,
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
    fontWeight: '800',
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
    elevation: 2,
  },
  cardIconContainer: {
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
    marginTop: 4,
  },
  cardLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  selectAllBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    marginHorizontal: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    elevation: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
  },
  selectAllLabel: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  selectAllBadge: {
    backgroundColor: theme.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  itemContainer: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  itemCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.border,
    elevation: 2,
  },
  itemCardSelected: {
    borderColor: theme.borderSelected,
    backgroundColor: theme.cardSelected,
    elevation: 4,
  },
  checkboxContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 10,
    backgroundColor: theme.cardBackground,
    borderRadius: 8,
    padding: 6,
    elevation: 2,
  },
  itemCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
  },
  imageContainer: {
    width: '100%',
    height: 160,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.imagePlaceholder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    padding: 16,
  },
  productTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 12,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  metaItem: {
    flex: 1,
  },
  metaDivider: {
    width: 1,
    height: 30,
    backgroundColor: theme.border,
    marginHorizontal: 12,
  },
  metaLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  priceText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.accent,
  },
  quantityText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  totalContainer: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.accent,
  },
  deleteButton: {
    backgroundColor: theme.error,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    elevation: 3,
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
    elevation: 4,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
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
    elevation: 6,
  },
  shopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
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
  checkoutFooter: {
    backgroundColor: theme.cardBackground,
    paddingHorizontal: 20,
    paddingVertical: 16, // Adjusted padding
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    elevation: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  totalText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  totalPrice: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.accent,
    letterSpacing: -0.5,
  },
  itemCount: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  checkoutButton: {
    backgroundColor: theme.accent,
    paddingVertical: 15,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
  checkoutButtonDisabled: {
    backgroundColor: theme.buttonDisabled,
    elevation: 2,
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});