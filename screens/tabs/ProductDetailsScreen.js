// screens/ProductDetailsScreen.js
import { FontAwesome as Icon, Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Platform,
  ScrollView,
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

export default function ProductDetailsScreen({ route, navigation }) {
  const product = route?.params?.product;
  const user = auth.currentUser;
  const [userStatus, setUserStatus] = useState('not_requested');
  const [adding, setAdding] = useState(false);
  const [sellerName, setSellerName] = useState('');
  const [sellerAvatar, setSellerAvatar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Automatically detect system theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';

  // Get current theme colors based on system settings
  const theme = isDarkMode ? darkTheme : lightTheme;

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Parse image URLs from JSON if multiple images
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

  // Fetch seller name
  useEffect(() => {
    let mounted = true;
    const fetchName = async () => {
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
        setSellerName(data.name);
        setSellerAvatar(data.profile_photo);
      }
      if (error) console.log('Seller fetch error', error.message || error);
      
      if (mounted) {
        setLoading(false);
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
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
        ]).start();
      }
    };
    fetchName();
    return () => { mounted = false; };
  }, [product]);

  // Fetch current user's verification status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        if (!user?.email) {
          setUserStatus('not_requested');
          return;
        }
        const { data, error } = await supabase
          .from('users')
          .select('status')
          .eq('email', user.email)
          .single();
        if (error || !data) setUserStatus('not_requested');
        else setUserStatus(data.status || 'not_requested');
      } catch (_) {
        setUserStatus('not_requested');
      }
    };
    fetchStatus();
  }, [user]);

  const handleAddToCart = async () => {
    if (!user) {
      navigation.navigate('GetVerified');
      return;
    }
    // require verified users
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

  // View store navigation handled inline in the button (always allowed)

  const styles = createStyles(theme);

  if (!product) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Icon name="exclamation-triangle" size={64} color={theme.textSecondary} />
          <Text style={styles.errorText}>No product specified.</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Icon name="arrow-left" size={16} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Loading product details...</Text>
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
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* Header with back button */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.headerButton}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Product Details</Text>
            <View style={styles.headerButton} />
          </View>

          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
            }}
          >
            {/* Image Gallery */}
            {imageUrls.length > 0 ? (
              <View style={styles.imageSection}>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) => {
                    const index = Math.round(e.nativeEvent.contentOffset.x / (width - 32));
                    setActiveImageIndex(index);
                  }}
                  style={styles.imageScroll}
                >
                  {imageUrls.map((uri, index) => (
                    <View key={index} style={styles.imageContainer}>
                      <Image
                        source={{ uri }}
                        style={styles.image}
                        resizeMode="cover"
                      />
                    </View>
                  ))}
                </ScrollView>
                
                {/* Image indicators */}
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
              </View>
            ) : (
              <View style={styles.noImageContainer}>
                <Icon name="image" size={64} color={theme.textSecondary} />
                <Text style={styles.noImageText}>No Image Available</Text>
              </View>
            )}

            {/* Product Info Card */}
            <View style={styles.card}>
              {/* Title and Price */}
              <View style={styles.titleSection}>
                <Text style={styles.title}>{product.product_name}</Text>
                <View style={styles.priceContainer}>
                  <Icon name="tag" size={20} color={theme.accent} />
                  <Text style={styles.price}> ₱{product.price}</Text>
                </View>
              </View>

              {/* Quick Info Grid */}
              <View style={styles.quickInfoGrid}>
                <View style={styles.quickInfoCard}>
                  <Icon name="folder-open" size={18} color={theme.accent} />
                  <Text style={styles.quickInfoLabel}>Category</Text>
                  <Text style={styles.quickInfoValue}>{product.category || 'N/A'}</Text>
                </View>
                
                <View style={styles.quickInfoCard}>
                  <Icon name="certificate" size={18} color={theme.historyColor} />
                  <Text style={styles.quickInfoLabel}>Condition</Text>
                  <Text style={styles.quickInfoValue}>{product.condition || 'N/A'}</Text>
                </View>
                
                <View style={styles.quickInfoCard}>
                  <Icon name="cubes" size={18} color="#3a7bd5" />
                  <Text style={styles.quickInfoLabel}>In Stock</Text>
                  <Text style={styles.quickInfoValue}>{product.quantity ?? 'N/A'}</Text>
                </View>
              </View>

              {/* Description Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon name="align-left" size={18} color={theme.text} />
                  <Text style={styles.sectionTitle}> Description</Text>
                </View>
                <Text style={styles.desc}>{product.description}</Text>
              </View>

              {/* Seller Info */}
              <View style={styles.sellerSection}>
                <View style={styles.sellerHeader}>
                  <Icon name="user" size={18} color={theme.text} />
                  <Text style={styles.sellerTitle}> Seller Information</Text>
                </View>
                <View style={styles.sellerCard}>
                  {sellerAvatar ? (
                    <Image source={{ uri: sellerAvatar }} style={styles.sellerAvatarImage} />
                  ) : (
                    <View style={[styles.sellerAvatarImage, styles.avatarPlaceholder]}>
                      <Icon name="user" size={24} color={theme.text} />
                    </View>
                  )}
                  <View style={styles.sellerInfoWrapper}>
                    <View style={styles.sellerInfo}>
                      <Text style={styles.sellerName}>{sellerName || 'Seller'}</Text>
                      <Text style={styles.sellerEmail}>{product.email}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.viewStoreButton} // This button was being pushed out of view
                    onPress={() => navigation.navigate('UserProfile', { userId: product.email })}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.viewStoreButtonText}>View Store</Text>
                    <Icon name="chevron-right" size={12} color={theme.accent} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Animated.View>
        </ScrollView>

        {/* Fixed Bottom Button */}
        {user?.email !== product.email && (
          <View style={styles.bottomContainer}>
            <TouchableOpacity
              style={[
                styles.addToCartButton,
                adding && styles.addToCartButtonDisabled,
              ]}
              onPress={handleAddToCart}
              disabled={adding}
              activeOpacity={0.85}
            >
              {adding ? (
                <View style={styles.buttonLoadingContainer}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.addToCartButtonText, { marginLeft: 10 }]}>Adding...</Text>
                </View>
              ) : (
                <>
                  <Icon name="shopping-cart" size={20} color="#fff" style={{ marginRight: 10 }} />
                  <Text style={styles.addToCartButtonText}>Add to Cart</Text>
                  <Icon name="arrow-right" size={16} color="#fff" style={{ marginLeft: 10 }} />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
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
  quickInfoBackground: '#252550',
  accent: '#FDAD00',
  accentSecondary: '#e8ecf1',
  historyColor: '#4CAF50',
  error: '#d32f2f',
  shadowColor: '#000',
  borderColor: '#2a2a4a',
  buttonDisabled: '#555',
  indicatorInactive: '#444',
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
  quickInfoBackground: '#f9f9fc',
  accent: '#f39c12',
  accentSecondary: '#e67e22',
  historyColor: '#27ae60',
  error: '#e74c3c',
  shadowColor: '#000',
  borderColor: '#e0e0ea',
  buttonDisabled: '#ccc',
  indicatorInactive: '#ddd',
};

const createStyles = (theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Math.max(width * 0.04, 16),
    paddingVertical: 16,
    backgroundColor: theme.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    color: theme.text,
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    color: theme.textSecondary,
    marginTop: 20,
    marginBottom: 30,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  imageSection: {
    marginBottom: 20,
  },
  imageScroll: {
    height: width - 32,
  },
  imageContainer: {
    width: width - 32,
    height: width - 32,
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: theme.cardBackgroundAlt,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.indicatorInactive,
  },
  indicatorActive: {
    width: 24,
    backgroundColor: theme.accent,
  },
  noImageContainer: {
    width: width - 32,
    height: width - 32,
    marginHorizontal: 16,
    borderRadius: 20,
    backgroundColor: theme.cardBackgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: theme.borderColor,
    borderStyle: 'dashed',
  },
  noImageText: {
    marginTop: 12,
    fontSize: 16,
    color: theme.textSecondary,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  card: {
    marginHorizontal: Math.max(width * 0.04, 16),
    backgroundColor: theme.cardBackground,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.borderColor,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  titleSection: {
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: Platform.OS === 'android' ? '900' : '800',
    color: theme.text,
    marginBottom: 12,
    lineHeight: 32,
    fontFamily: Platform.select({
      ios: 'Poppins-ExtraBold',
      android: 'Poppins-Black',
      default: 'Poppins-ExtraBold',
    }),
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  price: {
    fontSize: 28,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    color: theme.accent,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  quickInfoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  quickInfoCard: {
    flex: 1,
    backgroundColor: theme.quickInfoBackground,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  quickInfoLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 6,
    marginBottom: 4,
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  quickInfoValue: {
    fontSize: 14,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    color: theme.text,
    textAlign: 'center',
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    color: theme.text,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  desc: {
    fontSize: 15,
    lineHeight: 24,
    color: theme.textSecondary,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  sellerSection: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: theme.borderColor,
  },
  sellerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sellerTitle: {
    fontSize: 18,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    color: theme.text,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.quickInfoBackground,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  sellerInfoWrapper: {
    flex: 1,
  },
  sellerAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
  },
  avatarPlaceholder: {
    backgroundColor: theme.cardBackgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    color: theme.text,
    marginBottom: 4,
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  sellerEmail: {
    fontSize: 14,
    color: theme.textSecondary,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.cardBackground,
    paddingHorizontal: Math.max(width * 0.04, 16),
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    borderTopWidth: 1,
    borderTopColor: theme.borderColor,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  addToCartButton: {
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
  addToCartButtonDisabled: {
    backgroundColor: theme.buttonDisabled,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOpacity: 0.2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  addToCartButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  buttonLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  backButton: {
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
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
});