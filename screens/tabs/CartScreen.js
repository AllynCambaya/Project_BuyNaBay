// screens/tabs/CartScreen.js
import { FontAwesome as Icon, Ionicons } from '@expo/vector-icons';
import ExpoCheckbox from "expo-checkbox";
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../firebase/firebaseConfig";
import { supabase } from "../../supabase/supabaseClient";
import { darkTheme, lightTheme } from '../../theme/theme';
import { fontFamily } from '../../theme/typography';

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
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerSlideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
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
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
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

  const styles = createStyles(theme, isDarkMode);

  const renderHeader = () => (
    <Animated.View 
      style={[
        styles.headerContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: headerSlideAnim }]
        }
      ]}
    >
      {/* Gradient Background */}
      <View style={styles.backgroundGradient}>
        <View style={styles.gradientOverlay} />
      </View>

      {/* Top Navigation Bar */}
      <View style={styles.topNavBar}>
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
              Shopping Cart
            </Text>
          </View>
        </View>

        <View style={styles.headerActionsContainer}>
          <TouchableOpacity
            onPress={() => navigation.navigate('CheckoutScreen')}
            style={[styles.actionButton, styles.historyButton]}
            activeOpacity={0.7}
          >
            <Ionicons name="receipt-outline" size={20} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => navigation.navigate("ProfileScreen")}
            activeOpacity={0.8}
          >
            <View style={styles.profileImageWrapper}>
              <Image
                source={userProfileImage ? { uri: userProfileImage } : require("../../assets/images/OfficialBuyNaBay.png")}
                style={styles.profileImage}
              />
              <View style={styles.onlineIndicator} />
            </View>
          </TouchableOpacity>
        </View>
      </View>


      {/* Summary Cards */}
      <View style={styles.summaryCards}>
        <Animated.View style={[styles.summaryCard, { transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.cardIconContainer, { backgroundColor: `${theme.accent}15` }]}>
            <Icon name="shopping-cart" size={18} color={theme.accent} />
          </View>
          <Text style={[styles.cardValue, { fontFamily: fontFamily.bold }]}>{cartItems.length}</Text>
          <Text style={[styles.cardLabel, { fontFamily: fontFamily.medium }]}>Items</Text>
        </Animated.View>
        
        <Animated.View style={[styles.summaryCard, { transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.cardIconContainer, { backgroundColor: `${theme.success}15` }]}>
            <Icon name="check-circle" size={18} color={theme.success} />
          </View>
          <Text style={[styles.cardValue, { fontFamily: fontFamily.bold }]}>{selectedIds.length}</Text>
          <Text style={[styles.cardLabel, { fontFamily: fontFamily.medium }]}>Selected</Text>
        </Animated.View>
        
        <Animated.View style={[styles.summaryCard, { transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.cardIconContainer, { backgroundColor: `${theme.accent}15` }]}>
            <Icon name="money" size={18} color={theme.accent} />
          </View>
          <Text style={[styles.cardValue, { fontFamily: fontFamily.bold }]}>₱{calculateTotal()}</Text>
          <Text style={[styles.cardLabel, { fontFamily: fontFamily.medium }]}>Total</Text>
        </Animated.View>
      </View>

      {/* Select All Bar */}
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
          <Text style={[styles.selectAllLabel, { fontFamily: fontFamily.semiBold }]}>
            Select All Items
          </Text>
          <View style={[styles.selectAllBadge, { backgroundColor: theme.accent }]}>
            <Text style={[styles.badgeText, { fontFamily: fontFamily.bold }]}>{cartItems.length}</Text>
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
            transform: [
              { translateY: slideAnim.interpolate({
                inputRange: [0, 50],
                outputRange: [0, 50 + index * 10]
              })},
              { scale: scaleAnim }
            ]
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
              <>
                <Image source={{ uri: thumbnail }} style={styles.productImage} />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.3)']}
                  style={styles.imageGradient}
                />
              </>
            ) : (
              <View style={styles.imagePlaceholder}>
                <Icon name="image" size={32} color={theme.iconPlaceholder} />
              </View>
            )}
          </View>

          <View style={styles.detailsContainer}>
            <Text style={[styles.productTitle, { fontFamily: fontFamily.semiBold }]} numberOfLines={2}>
              {item.product_name}
            </Text>
            
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Text style={[styles.metaLabel, { fontFamily: fontFamily.medium }]}>Price</Text>
                <Text style={[styles.priceText, { fontFamily: fontFamily.bold }]}>₱{item.price}</Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaItem}>
                <Text style={[styles.metaLabel, { fontFamily: fontFamily.medium }]}>Qty</Text>
                <Text style={[styles.quantityText, { fontFamily: fontFamily.bold }]}>×{item.quantity}</Text>
              </View>
            </View>

            <View style={styles.footerRow}>
              <View style={styles.totalContainer}>
                <Text style={[styles.totalLabel, { fontFamily: fontFamily.medium }]}>Subtotal</Text>
                <Text style={[styles.totalAmount, { fontFamily: fontFamily.bold }]}>
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
          transform: [{ translateY: slideAnim }, { scale: scaleAnim }]
        }
      ]}
    >
      <View style={styles.emptyIconContainer}>
        <Icon name="shopping-cart" size={72} color={theme.iconPlaceholder} />
      </View>
      <Text style={[styles.emptyTitle, { fontFamily: fontFamily.bold }]}>
        Your Cart is Empty
      </Text>
      <Text style={[styles.emptyDescription, { fontFamily: fontFamily.medium }]}>
        Discover amazing products and start adding them to your cart
      </Text>
      <TouchableOpacity
        style={styles.shopButton}
        onPress={() => navigation.navigate('Home')}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#FDAD00', '#FF9500']}
          style={styles.shopButtonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Icon name="shopping-bag" size={18} color="#fff" style={{ marginRight: 10 }} />
          <Text style={[styles.shopButtonText, { fontFamily: fontFamily.bold }]}>Start Shopping</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loadingText, { fontFamily: fontFamily.semiBold }]}>
          Loading your cart...
        </Text>
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
      <SafeAreaView style={styles.container} edges={['top']}>
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
          <Animated.View 
            style={[
              styles.checkoutFooter,
              { opacity: fadeAnim, transform: [{ translateY: scaleAnim.interpolate({
                inputRange: [0.95, 1],
                outputRange: [100, 0]
              })}]}
            ]}
          >
            <View style={styles.summaryRow}>
              <View>
                <Text style={[styles.totalText, { fontFamily: fontFamily.medium }]}>
                  Total Amount
                </Text>
                <Text style={[styles.totalPrice, { fontFamily: fontFamily.black }]}>
                  ₱{calculateTotal()}
                </Text>
              </View>
              <Text style={[styles.itemCount, { fontFamily: fontFamily.semiBold }]}>
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
              <LinearGradient
                colors={selectedCount === 0 || isCheckingOut ? ['#6b7280', '#6b7280'] : ['#FDAD00', '#FF9500']}
                style={styles.checkoutGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isCheckingOut ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={[styles.checkoutButtonText, { fontFamily: fontFamily.bold, marginLeft: 10 }]}>
                      Processing...
                    </Text>
                  </View>
                ) : (
                  <>
                    <Icon name="check-circle" size={20} color="#fff" style={{ marginRight: 10 }} />
                    <Text style={[styles.checkoutButtonText, { fontFamily: fontFamily.bold }]}>
                      Proceed to Checkout
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}
      </SafeAreaView>
    </>
  );
}

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  listContent: {
    paddingBottom: 24,
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
  },
  headerContainer: {
    position: 'relative',
    marginBottom: 20,
    paddingBottom: 16,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 260,
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
  topNavBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    marginBottom: 16,
  },
  brandedLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(253, 173, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
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
  headerActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  historyButton: {
    backgroundColor: '#10b981',
  },
  profileImageWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: theme.accent,
    padding: 2,
    backgroundColor: theme.cardBackground,
    position: 'relative',
    
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.success,
    borderWidth: 2.5,
    borderColor: theme.gradientBackground,
  },
  welcomeContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  greetingText: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  userNameText: {
    fontSize: Math.min(width * 0.07, 28),
    color: theme.text,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  descriptionText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  summaryCards: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  cardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 20,
    color: theme.text,
    marginTop: 4,
  },
  cardLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 2,
  },
  selectAllBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    marginHorizontal: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
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
    color: theme.text,
  },
  selectAllBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
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
    borderColor: isDarkMode ? 'rgba(253, 173, 0, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  itemCardSelected: {
    borderColor: theme.accent,
    backgroundColor: isDarkMode ? 'rgba(253, 173, 0, 0.05)' : 'rgba(253, 173, 0, 0.08)',
    
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  checkboxContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 10,
    backgroundColor: theme.cardBackground,
    borderRadius: 8,
    padding: 6,
    
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
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
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: isDarkMode ? 'rgba(42, 40, 86, 0.4)' : 'rgba(245, 245, 245, 1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    padding: 16,
  },
  productTitle: {
    fontSize: 17,
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
    backgroundColor: isDarkMode ? 'rgba(253, 173, 0, 0.2)' : 'rgba(0, 0, 0, 0.08)',
    marginHorizontal: 12,
  },
  metaLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  priceText: {
    fontSize: 18,
    color: theme.accent,
  },
  quantityText: {
    fontSize: 18,
    color: theme.text,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: isDarkMode ? 'rgba(253, 173, 0, 0.1)' : 'rgba(0, 0, 0, 0.05)',
  },
  totalContainer: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 18,
    color: theme.accent,
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
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
    backgroundColor: isDarkMode ? 'rgba(42, 40, 86, 0.6)' : 'rgba(245, 245, 245, 1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 3,
    borderColor: isDarkMode ? 'rgba(253, 173, 0, 0.2)' : 'rgba(0, 0, 0, 0.08)',
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 24,
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
    borderRadius: 16,
    overflow: 'hidden',
    
    shadowColor: '#FDAD00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  shopButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  shopButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  checkoutFooter: {
    backgroundColor: theme.cardBackground,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 28, 
    borderTopWidth: 1,
    borderTopColor: isDarkMode ? 'rgba(253, 173, 0, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
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
    marginBottom: 4,
  },
  totalPrice: {
    fontSize: 26,
    color: theme.accent,
    letterSpacing: -0.5,
  },
  itemCount: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  checkoutButton: {
    borderRadius: 16,
    overflow: 'hidden',
    
    shadowColor: '#FDAD00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  checkoutButtonDisabled: {
    opacity: 0.5,
  },
  checkoutGradient: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 17,
    letterSpacing: 0.2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});