// screens/tabs/ProductDetailsScreen.js
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';
import { darkTheme, lightTheme } from '../../theme/theme';
import { fontFamily } from '../../theme/typography';
import { getVerificationStatus } from '../../utils/verificationHelpers';

const { width } = Dimensions.get('window');

export default function ProductDetailsScreen({ route, navigation }) {
  const product = route?.params?.product;
  const user = auth.currentUser;
  const insets = useSafeAreaInsets(); 
  
  const [sellerName, setSellerName] = useState('');
  const [sellerAvatar, setSellerAvatar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [messaging, setMessaging] = useState(false);

  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const headerTranslate = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [-50, 0],
    extrapolate: 'clamp',
  });

  const imageScale = scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.2, 1],
    extrapolate: 'clamp',
  });

  const imageUrls = product?.product_image_url
    ? Array.isArray(product.product_image_url)
      ? product.product_image_url
      : (() => {
          try {
            return JSON.parse(product.product_image_url);
          } catch {
            return [product.product_image_url];
          }
        })()
    : [];

  useEffect(() => {
    let mounted = true;
    const fetchSellerInfo = async () => {
      if (!product?.email) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('name, profile_photo')
        .eq('email', product.email)
        .single();
      
      if (!error && data && mounted) {
        setSellerName(data.name || 'Seller');
        setSellerAvatar(data.profile_photo);
      }
      
      if (mounted) {
        setLoading(false);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            tension: 60,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 60,
            friction: 8,
            useNativeDriver: true,
          }),
        ]).start();
      }
      // Fetch user status
      if (user?.email && mounted) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('status')
          .eq('email', user.email)
          .single();
        
        if (!userError && userData) {
          setUserStatus(userData.status || 'not_requested');
        }
      }
    };
    
    fetchSellerInfo();
    return () => { mounted = false; };
  }, [product]);

  const [userStatus, setUserStatus] = useState('not_requested');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        if (!user?.email) {
          setUserStatus('not_requested');
          return;
        }
        const { status } = await getVerificationStatus(user.email);
        setUserStatus(status || 'not_requested');
      } catch (_) {
        setUserStatus('not_requested');
      }
    };
    fetchStatus();
  }, [user]);

 const handleMessageSeller = async () => {
  if (!user) {
    Alert.alert('Login Required', 'Please login to message the seller.');
    navigation.navigate('Login');
    return;
  }

  if (user.email === product.email) {
    Alert.alert('Not Allowed', 'You cannot message yourself.');
    return;
  }

  // ✅ CHECK VERIFICATION STATUS
  if (userStatus !== 'approved') {
    navigation.navigate('GetVerified');
    return;
  }

  setMessaging(true);
  
  navigation.navigate('Messaging', {
    receiverId: product.email,
    receiverName: sellerName,
    productToSend: product,
  });

  setTimeout(() => setMessaging(false), 500);
  };

  const handleAddToCart = async () => {
    if (!user) {
      navigation.navigate('GetVerified');
      return;
    }
    
    if (userStatus !== 'approved') {
      navigation.navigate('GetVerified');
      return;
    }
    
    if (user.email === product.email) {
      Alert.alert('Not Allowed', 'You cannot add your own product to the cart.');
      return;
    }

    setAdding(true);

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("name")
      .eq("email", user.email)
      .single();

    if (userError || !userData?.name) {
      setAdding(false);
      Alert.alert("Error", "Could not fetch your account name.");
      return;
    }

    const buyerName = userData.name;

    const { error } = await supabase.from("cart").insert([
      {
        name: buyerName,
        product_name: product.product_name,
        price: product.price,
        quantity: 1,
      },
    ]);

    setAdding(false);

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert("Added", "Product added to cart.");
      navigation.navigate("Tabs", { screen: "Cart" });
    }
  };

  const styles = createStyles(theme, isDarkMode);

  if (!product) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <View style={styles.errorIconWrapper}>
            <Ionicons name="alert-circle-outline" size={64} color={theme.textSecondary} />
          </View>
          <Text style={[styles.errorTitle, { fontFamily: fontFamily.bold }]}>
            Product Not Found
          </Text>
          <Text style={[styles.errorSubtitle, { fontFamily: fontFamily.medium }]}>
            This product may have been removed or doesn't exist.
          </Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <LinearGradient colors={['#FDAD00', '#FF9500']} style={styles.errorButtonGradient}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
              <Text style={[styles.errorButtonText, { fontFamily: fontFamily.bold }]}>
                Go Back
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loadingText, { fontFamily: fontFamily.semiBold }]}>
          Loading product details...
        </Text>
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
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Collapsible Header */}
        <Animated.View
          style={[
            styles.collapsibleHeader,
            {
              top: insets.top,
              opacity: headerOpacity,
              transform: [{ translateY: headerTranslate }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { fontFamily: fontFamily.bold }]} numberOfLines={1}>
              {product.product_name}
            </Text>
          </View>

          <View style={styles.headerActions}>
            {user?.email !== product.email && (
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() =>
                  navigation.navigate('ReportScreen', {
                    reported_student_id: product.email,
                    reported_name: sellerName,
                  })
                }
                activeOpacity={0.7}
              >
                <Ionicons name="flag" size={18} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

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
          {/* Image Gallery */}
          <Animated.View style={[styles.imageSection, { transform: [{ scale: imageScale }] }]}>
            {imageUrls.length > 0 ? (
              <>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) => {
                    const index = Math.round(e.nativeEvent.contentOffset.x / width);
                    setActiveImageIndex(index);
                  }}
                  style={styles.imageScroll}
                >
                  {imageUrls.map((uri, index) => (
                    <View key={index} style={styles.imageContainer}>
                      <Image source={{ uri }} style={styles.productImage} resizeMode="cover" />
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.3)']}
                        style={styles.imageGradient}
                      />
                    </View>
                  ))}
                </ScrollView>

                {imageUrls.length > 1 && (
                  <View style={styles.indicatorContainer}>
                    {imageUrls.map((_, index) => (
                      <View
                        key={index}
                        style={[
                          styles.indicator,
                          activeImageIndex === index && styles.indicatorActive,
                        ]}
                      />
                    ))}
                  </View>
                )}
              </>
            ) : (
              <View style={styles.noImageContainer}>
                <Ionicons name="image-outline" size={64} color={theme.textSecondary} />
                <Text style={[styles.noImageText, { fontFamily: fontFamily.medium }]}>
                  No Image Available
                </Text>
              </View>
            )}
          </Animated.View>

          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
            }}
          >
            {/* Product Info Card */}
            <View style={styles.contentCard}>
              {/* Category Badge */}
              {product.category && (
                <View style={styles.categoryBadge}>
                  <Text style={[styles.categoryText, { fontFamily: fontFamily.semiBold }]}>
                    {product.category}
                  </Text>
                </View>
              )}

              {/* Product Name */}
              <Text style={[styles.productName, { fontFamily: fontFamily.extraBold }]}>
                {product.product_name}
              </Text>

              {/* Price and Stock Row */}
              <View style={styles.priceRow}>
                <View style={styles.priceContainer}>
                  <Text style={[styles.priceLabel, { fontFamily: fontFamily.medium }]}>
                    Price
                  </Text>
                  <Text style={[styles.price, { fontFamily: fontFamily.bold }]}>
                    ₱{parseFloat(product.price).toFixed(2)}
                  </Text>
                </View>

                <View style={styles.stockContainer}>
                  <View style={[styles.stockBadge, { backgroundColor: product.quantity > 0 ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)' }]}>
                    <Ionicons
                      name={product.quantity > 0 ? 'checkmark-circle' : 'close-circle'}
                      size={16}
                      color={product.quantity > 0 ? '#4CAF50' : '#F44336'}
                    />
                    <Text style={[
                      styles.stockText,
                      { 
                        fontFamily: fontFamily.semiBold,
                        color: product.quantity > 0 ? '#4CAF50' : '#F44336'
                      }
                    ]}>
                      {product.quantity > 0 ? `${product.quantity} in stock` : 'Out of stock'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Quick Info Grid */}
              {product.condition && (
                <View style={styles.infoGrid}>
                  <View style={styles.infoItem}>
                    <View style={[styles.infoIconCircle, { backgroundColor: isDarkMode ? 'rgba(253, 173, 0, 0.15)' : 'rgba(253, 173, 0, 0.1)' }]}>
                      <Ionicons name="star" size={18} color={theme.accent} />
                    </View>
                    <View style={styles.infoTextBlock}>
                      <Text style={[styles.infoLabel, { fontFamily: fontFamily.medium }]}>
                        Condition
                      </Text>
                      <Text style={[styles.infoValue, { fontFamily: fontFamily.semiBold }]}>
                        {product.condition}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Description Section */}
              {product.description && (
                <View style={styles.descriptionSection}>
                  <Text style={[styles.sectionTitle, { fontFamily: fontFamily.semiBold }]}>
                    Description
                  </Text>
                  <Text style={[styles.description, { fontFamily: fontFamily.regular }]}>
                    {product.description}
                  </Text>
                </View>
              )}

              {/* Seller Section */}
              <View style={styles.sellerSection}>
                <Text style={[styles.sectionTitle, { fontFamily: fontFamily.semiBold }]}>
                  Seller Information
                </Text>

                <View style={styles.sellerCard}>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('UserProfile', { userId: product.email })}
                    activeOpacity={0.8}
                    style={styles.sellerInfo}
                  >
                    {sellerAvatar ? (
                      <Image source={{ uri: sellerAvatar }} style={styles.sellerAvatar} />
                    ) : (
                      <View style={[styles.sellerAvatar, styles.avatarPlaceholder]}>
                        <Ionicons name="person" size={24} color={theme.textSecondary} />
                      </View>
                    )}

                    <View style={styles.sellerDetails}>
                      <Text style={[styles.sellerName, { fontFamily: fontFamily.semiBold }]}>
                        {sellerName}
                      </Text>
                      <Text style={[styles.sellerEmail, { fontFamily: fontFamily.medium }]} numberOfLines={1}>
                        {product.email}
                      </Text>
                    </View>

                    <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Bottom Spacing */}
            <View style={{ height: 120 }} />
          </Animated.View>
        </Animated.ScrollView>

        {/* Fixed Bottom Bar with Action Buttons */}
        {user?.email !== product.email && (
          <View style={styles.bottomContainer}>
            <View style={styles.actionButtonsRow}>
              {/* Add to Cart Button - Takes full width */}
              <TouchableOpacity
                style={[
                  styles.addToCartButton,
                  adding && styles.addToCartButtonDisabled,
                ]}
                onPress={handleAddToCart}
                disabled={adding}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={adding ? ['#9CA3AF', '#6B7280'] : ['#FDAD00', '#FF9500']}
                  style={styles.addToCartButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {adding ? (
                    <>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={[styles.addToCartButtonText, { fontFamily: fontFamily.bold, marginLeft: 10 }]}>
                        Adding...
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="cart" size={22} color="#fff" />
                      <Text style={[styles.addToCartButtonText, { fontFamily: fontFamily.bold }]}>
                        Add to Cart
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Message Button */}
              <TouchableOpacity
                style={styles.iconActionButton}
                onPress={handleMessageSeller}
                disabled={messaging}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={messaging ? ['rgba(156, 163, 175, 0.3)', 'rgba(107, 114, 128, 0.2)'] : isDarkMode ? ['rgba(253, 173, 0, 0.2)', 'rgba(253, 173, 0, 0.1)'] : ['rgba(253, 173, 0, 0.15)', 'rgba(253, 173, 0, 0.08)']}
                  style={styles.iconButtonGradient}
                >
                  {messaging ? (
                    <ActivityIndicator color={theme.accent} size="small" />
                  ) : (
                    <Ionicons name="chatbubble-ellipses" size={20} color={theme.accent} />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    </>
  );
}

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },

  // Collapsible Header
  collapsibleHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 12,
    backgroundColor: theme.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
    zIndex: 10,
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  headerTitleContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 16,
    color: theme.text,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },

  // Image Section
  imageSection: {
    marginBottom: 20,
  },
  imageScroll: {
    height: width,
  },
  imageContainer: {
    width: width,
    height: width,
    position: 'relative',
    backgroundColor: isDarkMode ? 'rgba(42, 40, 86, 0.4)' : 'rgba(245, 245, 245, 1)',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  indicatorContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  indicatorActive: {
    width: 24,
    backgroundColor: '#FDAD00',
  },
  noImageContainer: {
    width: width,
    height: width,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(42, 40, 86, 0.4)' : 'rgba(245, 245, 245, 1)',
  },
  noImageText: {
    marginTop: 12,
    fontSize: 16,
    color: theme.textSecondary,
  },

  // Content Card
  contentCard: {
    marginHorizontal: 20,
    backgroundColor: theme.cardBackground,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.borderColor,
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: isDarkMode ? 'rgba(253, 173, 0, 0.15)' : 'rgba(253, 173, 0, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  categoryText: {
    fontSize: 12,
    color: theme.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productName: {
    fontSize: 28,
    color: theme.text,
    marginBottom: 20,
    lineHeight: 36,
  },

  // Price Row
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
  },
  priceContainer: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  price: {
    fontSize: 32,
    color: theme.accent,
  },
  stockContainer: {
    justifyContent: 'center',
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  stockText: {
    fontSize: 13,
  },

  // Info Grid
  infoGrid: {
    marginBottom: 24,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(42, 40, 86, 0.6)' : 'rgba(245, 245, 245, 1)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  infoIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTextBlock: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    color: theme.text,
  },

  // Description Section
  descriptionSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    color: theme.text,
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: theme.textSecondary,
    lineHeight: 24,
  },

  // Seller Section
  sellerSection: {
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: theme.borderColor,
  },
  sellerCard: {
    backgroundColor: isDarkMode ? 'rgba(42, 40, 86, 0.6)' : 'rgba(245, 245, 245, 1)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
  },
  avatarPlaceholder: {
    backgroundColor: theme.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  sellerDetails: {
    flex: 1,
  },
  sellerName: {
    fontSize: 16,
    color: theme.text,
    marginBottom: 4,
  },
  sellerEmail: {
    fontSize: 14,
    color: theme.textSecondary,
  },

  // Bottom Container
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.background,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 24, 
    borderTopWidth: 1,
    borderTopColor: theme.borderColor,
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addToCartButton: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#FDAD00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  addToCartButtonDisabled: {
    shadowColor: theme.shadowColor,
    shadowOpacity: 0.2,
  },
  addToCartButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  addToCartButtonText: {
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  iconActionButton: {
    width: 56,
    height: 56,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  iconButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
  },

  // Error State
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorIconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: isDarkMode ? 'rgba(42, 40, 86, 0.6)' : 'rgba(245, 245, 245, 1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 3,
    borderColor: theme.borderColor,
    borderStyle: 'dashed',
  },
  errorTitle: {
    fontSize: 22,
    color: theme.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  errorButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#FDAD00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  errorButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 8,
  },
  errorButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
  },

  // Loading State
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.textSecondary,
  },
});