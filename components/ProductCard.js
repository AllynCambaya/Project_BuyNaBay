import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { supabase } from '../supabase/supabaseClient';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // For grid view
const nameCache = {};

export default function ProductCard({
  product,
  canEdit,
  onEdit,
  onDelete,
  onMessageSeller,
  onPress,
  viewMode = 'list', // 'list' or 'grid'
}) {
  const [sellerName, setSellerName] = useState('');
  const [imageIndex, setImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);

  // Automatically detect system theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const favoriteAnim = useRef(new Animated.Value(1)).current;

  // Get current theme colors
  const theme = isDarkMode ? darkTheme : lightTheme;

  // Parse image URLs from JSON if multiple images
  const imageUrls = product.product_image_url
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

    const fetchSellerName = async () => {
      if (!product?.email) return;
      if (nameCache[product.email]) {
        setSellerName(nameCache[product.email]);
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('name')
        .eq('email', product.email)
        .single();

      if (error) {
        console.log('Failed fetching seller name:', error.message || error);
        if (mounted) setSellerName(product.email);
        return;
      }

      const name = data?.name || product.email;
      nameCache[product.email] = name;
      if (mounted) setSellerName(name);
    };

    fetchSellerName();
    return () => {
      mounted = false;
    };
  }, [product]);

  // Handle press animation
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 100,
      friction: 7,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 7,
    }).start();
  };

  // Handle favorite toggle
  const handleFavoriteToggle = () => {
    Animated.sequence([
      Animated.timing(favoriteAnim, {
        toValue: 1.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(favoriteAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    setIsFavorite(!isFavorite);
  };

  // Calculate discount percentage (if you have original price)
  const hasDiscount = product.original_price && parseFloat(product.original_price) > parseFloat(product.price);
  const discountPercent = hasDiscount
    ? Math.round(((parseFloat(product.original_price) - parseFloat(product.price)) / parseFloat(product.original_price)) * 100)
    : 0;

  // Check if product is new (created within last 7 days)
  const isNewProduct = () => {
    if (!product.created_at) return false;
    const createdDate = new Date(product.created_at);
    const daysDiff = (new Date() - createdDate) / (1000 * 60 * 60 * 24);
    return daysDiff <= 7;
  };

  // Get stock status
  const getStockStatus = () => {
    const qty = parseInt(product.quantity) || 0;
    if (qty === 0) return { text: 'Out of Stock', color: theme.error };
    if (qty <= 5) return { text: `Only ${qty} left`, color: theme.warning };
    return { text: 'In Stock', color: theme.success };
  };

  const stockStatus = getStockStatus();

  const styles = createStyles(theme, viewMode);

  // Grid View Layout
  if (viewMode === 'grid') {
    return (
      <Animated.View style={[styles.gridCardWrapper, { transform: [{ scale: scaleAnim }] }]}>
        <TouchableOpacity
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.95}
          style={styles.gridCard}
        >
          {/* Image Section */}
          <View style={styles.gridImageContainer}>
            {imageUrls.length > 0 ? (
              <Image source={{ uri: imageUrls[0] }} style={styles.gridImage} />
            ) : (
              <View style={styles.gridImagePlaceholder}>
                <Icon name="image" size={32} color={theme.textSecondary} />
              </View>
            )}

            {/* Badges */}
            <View style={styles.gridBadgesContainer}>
              {isNewProduct() && (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>NEW</Text>
                </View>
              )}
              {hasDiscount && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountBadgeText}>-{discountPercent}%</Text>
                </View>
              )}
            </View>

            {/* Favorite Button */}
            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={handleFavoriteToggle}
              activeOpacity={0.8}
            >
              <Animated.View style={{ transform: [{ scale: favoriteAnim }] }}>
                <Ionicons
                  name={isFavorite ? 'heart' : 'heart-outline'}
                  size={20}
                  color={isFavorite ? '#FF3B30' : theme.text}
                />
              </Animated.View>
            </TouchableOpacity>

            {/* Image Counter */}
            {imageUrls.length > 1 && (
              <View style={styles.gridImageCounter}>
                <Icon name="images" size={10} color="#fff" />
                <Text style={styles.gridImageCounterText}> {imageUrls.length}</Text>
              </View>
            )}
          </View>

          {/* Info Section */}
          <View style={styles.gridInfoSection}>
            {/* Category Badge */}
            {product.category && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText} numberOfLines={1}>
                  {product.category}
                </Text>
              </View>
            )}

            {/* Product Name */}
            <Text style={styles.gridProductName} numberOfLines={2}>
              {product.product_name}
            </Text>

            {/* Price Section */}
            <View style={styles.gridPriceSection}>
              <Text style={styles.gridPrice}>₱{product.price}</Text>
              {hasDiscount && (
                <Text style={styles.gridOriginalPrice}>₱{product.original_price}</Text>
              )}
            </View>

            {/* Stock Status */}
            <View style={[styles.stockBadge, { backgroundColor: `${stockStatus.color}20` }]}>
              <View style={[styles.stockDot, { backgroundColor: stockStatus.color }]} />
              <Text style={[styles.stockText, { color: stockStatus.color }]}>
                {stockStatus.text}
              </Text>
            </View>

            {/* Seller Info */}
            <View style={styles.gridSellerContainer}>
              <Ionicons name="person-circle" size={14} color={theme.textSecondary} />
              <Text style={styles.gridSellerName} numberOfLines={1}>
                {sellerName || product.email}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // List View Layout (Original Enhanced Design)
  return (
    <Animated.View style={[styles.cardWrapper, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.95}
        style={styles.cardContainer}
      >
        <View style={styles.card}>
          {/* Product Images */}
          {imageUrls.length > 0 ? (
            <View style={styles.imageSection}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                pagingEnabled
                decelerationRate="fast"
                onScroll={(e) => {
                  const index = Math.round(e.nativeEvent.contentOffset.x / (width - 40));
                  setImageIndex(index);
                }}
                scrollEventThrottle={16}
              >
                {imageUrls.map((uri, index) => (
                  <View key={index} style={styles.imageContainer}>
                    <Image source={{ uri }} style={styles.productImage} />
                  </View>
                ))}
              </ScrollView>

              {/* Image Indicators */}
              {imageUrls.length > 1 && (
                <View style={styles.imageIndicators}>
                  {imageUrls.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.indicator,
                        imageIndex === index && styles.activeIndicator,
                      ]}
                    />
                  ))}
                </View>
              )}

              {/* Badges Overlay */}
              <View style={styles.badgesContainer}>
                {isNewProduct() && (
                  <View style={styles.newBadge}>
                    <Icon name="star" size={10} color="#fff" style={{ marginRight: 4 }} />
                    <Text style={styles.newBadgeText}>NEW</Text>
                  </View>
                )}
                {hasDiscount && (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>-{discountPercent}%</Text>
                  </View>
                )}
              </View>

              {/* Favorite Button */}
              <TouchableOpacity
                style={styles.favoriteButton}
                onPress={handleFavoriteToggle}
                activeOpacity={0.8}
              >
                <Animated.View style={{ transform: [{ scale: favoriteAnim }] }}>
                  <Ionicons
                    name={isFavorite ? 'heart' : 'heart-outline'}
                    size={24}
                    color={isFavorite ? '#FF3B30' : '#fff'}
                  />
                </Animated.View>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Icon name="image" size={48} color={theme.textSecondary} />
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}

          {/* Product Info Section */}
          <View style={styles.infoSection}>
            {/* Category & Condition */}
            <View style={styles.tagsRow}>
              {product.category && (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{product.category}</Text>
                </View>
              )}
              {product.condition && (
                <View style={styles.conditionBadge}>
                  <Text style={styles.conditionBadgeText}>{product.condition}</Text>
                </View>
              )}
            </View>

            {/* Product Name */}
            <Text style={styles.productName} numberOfLines={2}>
              {product.product_name}
            </Text>

            {/* Price Section */}
            <View style={styles.priceRow}>
              <View style={styles.priceContainer}>
                <Icon name="tag" size={16} color={theme.accent} style={styles.priceIcon} />
                <Text style={styles.price}>₱{product.price}</Text>
              </View>
              {hasDiscount && (
                <Text style={styles.originalPrice}>₱{product.original_price}</Text>
              )}
            </View>

            {/* Description */}
            {product.description ? (
              <Text style={styles.description} numberOfLines={3}>
                {product.description}
              </Text>
            ) : null}

            {/* Stock & Quantity Info */}
            <View style={styles.stockRow}>
              <View style={[styles.stockBadge, { backgroundColor: `${stockStatus.color}20` }]}>
                <View style={[styles.stockDot, { backgroundColor: stockStatus.color }]} />
                <Text style={[styles.stockText, { color: stockStatus.color }]}>
                  {stockStatus.text}
                </Text>
              </View>
              {product.quantity && parseInt(product.quantity) > 5 && (
                <View style={styles.quantityBadge}>
                  <Icon name="cube" size={12} color={theme.textSecondary} />
                  <Text style={styles.quantityText}> {product.quantity} available</Text>
                </View>
              )}
            </View>

            {/* Seller Info */}
            <View style={styles.sellerContainer}>
              <View style={styles.sellerIconContainer}>
                <Ionicons name="person-circle" size={18} color={theme.textSecondary} />
              </View>
              <View style={styles.sellerInfo}>
                <Text style={styles.sellerLabel}>Seller</Text>
                <Text style={styles.sellerName} numberOfLines={1}>
                  {sellerName || product.email}
                </Text>
              </View>
              {!canEdit && (
                <TouchableOpacity
                  style={styles.quickMessageButton}
                  onPress={onMessageSeller}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.accent} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Action Buttons */}
          {canEdit && (
            <View style={styles.actionSection}>
              <TouchableOpacity
                style={[styles.actionButton, styles.editButton]}
                onPress={onEdit}
                activeOpacity={0.85}
              >
                <Ionicons name="pencil" size={16} color="#fff" />
                <Text style={styles.actionButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={onDelete}
                activeOpacity={0.85}
              >
                <Ionicons name="trash" size={16} color="#fff" />
                <Text style={styles.actionButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// Dark theme colors
const darkTheme = {
  background: '#0f0f2e',
  cardBackground: '#1e1e3f',
  cardBackgroundAlt: '#252550',
  text: '#fff',
  textSecondary: '#bbb',
  textTertiary: '#ccc',
  accent: '#FDAD00',
  accentSecondary: '#e8ecf1',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#d32f2f',
  primaryButton: '#1976d2',
  shadowColor: '#000',
  borderColor: '#2a2a4a',
  overlayColor: 'rgba(0, 0, 0, 0.6)',
};

// Light theme colors
const lightTheme = {
  background: '#f5f7fa',
  cardBackground: '#ffffff',
  cardBackgroundAlt: '#f9f9fc',
  text: '#1a1a2e',
  textSecondary: '#4a4a6a',
  textTertiary: '#2c2c44',
  accent: '#f39c12',
  accentSecondary: '#e67e22',
  success: '#27ae60',
  warning: '#f39c12',
  error: '#e74c3c',
  primaryButton: '#1976d2',
  shadowColor: '#000',
  borderColor: '#e0e0ea',
  overlayColor: 'rgba(0, 0, 0, 0.3)',
};

const createStyles = (theme, viewMode) =>
  StyleSheet.create({
    // Grid View Styles
    gridCardWrapper: {
      width: CARD_WIDTH,
      marginBottom: 16,
    },
    gridCard: {
      backgroundColor: theme.cardBackground,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.borderColor,
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
    gridImageContainer: {
      width: '100%',
      height: CARD_WIDTH * 1.1,
      position: 'relative',
      backgroundColor: theme.cardBackgroundAlt,
    },
    gridImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    gridImagePlaceholder: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.cardBackgroundAlt,
    },
    gridBadgesContainer: {
      position: 'absolute',
      top: 8,
      left: 8,
      gap: 6,
    },
    gridImageCounter: {
      position: 'absolute',
      bottom: 8,
      right: 8,
      backgroundColor: theme.overlayColor,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
    },
    gridImageCounterText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: Platform.OS === 'android' ? '700' : '600',
      fontFamily: Platform.select({
        ios: 'Poppins-SemiBold',
        android: 'Poppins-Bold',
        default: 'Poppins-SemiBold',
      }),
    },
    gridInfoSection: {
      padding: 12,
    },
    gridProductName: {
      fontSize: 14,
      fontWeight: Platform.OS === 'android' ? '700' : '600',
      color: theme.text,
      marginBottom: 6,
      lineHeight: 18,
      minHeight: 36,
      fontFamily: Platform.select({
        ios: 'Poppins-SemiBold',
        android: 'Poppins-Bold',
        default: 'Poppins-SemiBold',
      }),
    },
    gridPriceSection: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      gap: 6,
    },
    gridPrice: {
      fontSize: 18,
      fontWeight: Platform.OS === 'android' ? '900' : '800',
      color: theme.accent,
      fontFamily: Platform.select({
        ios: 'Poppins-ExtraBold',
        android: 'Poppins-Black',
        default: 'Poppins-ExtraBold',
      }),
    },
    gridOriginalPrice: {
      fontSize: 12,
      color: theme.textSecondary,
      textDecorationLine: 'line-through',
      fontFamily: Platform.select({
        ios: 'Poppins-Regular',
        android: 'Poppins-Medium',
        default: 'Poppins-Regular',
      }),
    },
    gridSellerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.borderColor,
      gap: 4,
    },
    gridSellerName: {
      fontSize: 11,
      color: theme.textSecondary,
      flex: 1,
      fontFamily: Platform.select({
        ios: 'Poppins-Regular',
        android: 'Poppins-Medium',
        default: 'Poppins-Regular',
      }),
    },

    // List View Styles
    cardWrapper: {
      marginVertical: 8,
      marginHorizontal: 0,
    },
    cardContainer: {
      width: '100%',
    },
    card: {
      backgroundColor: theme.cardBackground,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.borderColor,
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    imageSection: {
      width: '100%',
      height: 240,
      position: 'relative',
    },
    imageContainer: {
      width: width - 40,
      height: 240,
    },
    productImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    imageIndicators: {
      position: 'absolute',
      bottom: 12,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
    },
    indicator: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(255, 255, 255, 0.5)',
    },
    activeIndicator: {
      backgroundColor: '#fff',
      width: 20,
    },
    badgesContainer: {
      position: 'absolute',
      top: 12,
      left: 12,
      gap: 8,
    },
    newBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.success,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    newBadgeText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: Platform.OS === 'android' ? '800' : '700',
      fontFamily: Platform.select({
        ios: 'Poppins-Bold',
        android: 'Poppins-ExtraBold',
        default: 'Poppins-Bold',
      }),
    },
    discountBadge: {
      backgroundColor: '#FF3B30',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    discountBadgeText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: Platform.OS === 'android' ? '800' : '700',
      fontFamily: Platform.select({
        ios: 'Poppins-Bold',
        android: 'Poppins-ExtraBold',
        default: 'Poppins-Bold',
      }),
    },
    favoriteButton: {
      position: 'absolute',
      top: 12,
      right: 12,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.overlayColor,
      justifyContent: 'center',
      alignItems: 'center',
      backdropFilter: 'blur(10px)',
    },
    imagePlaceholder: {
      width: '100%',
      height: 240,
      backgroundColor: theme.cardBackgroundAlt,
      justifyContent: 'center',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.borderColor,
    },
    placeholderText: {
      marginTop: 8,
      fontSize: 14,
      color: theme.textSecondary,
      fontFamily: Platform.select({
        ios: 'Poppins-Regular',
        android: 'Poppins-Medium',
        default: 'Poppins-Regular',
      }),
    },
    infoSection: {
      padding: 16,
    },
    tagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    categoryBadge: {
      backgroundColor: `${theme.accent}20`,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    categoryBadgeText: {
      fontSize: 11,
      color: theme.accent,
      fontWeight: Platform.OS === 'android' ? '700' : '600',
      fontFamily: Platform.select({
        ios: 'Poppins-SemiBold',
        android: 'Poppins-Bold',
        default: 'Poppins-SemiBold',
      }),
    },
    conditionBadge: {
      backgroundColor: `${theme.success}20`,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    conditionBadgeText: {
      fontSize: 11,
      color: theme.success,
      fontWeight: Platform.OS === 'android' ? '700' : '600',
      fontFamily: Platform.select({
        ios: 'Poppins-SemiBold',
        android: 'Poppins-Bold',
        default: 'Poppins-SemiBold',
      }),
    },
    productName: {
      fontSize: 20,
      fontWeight: Platform.OS === 'android' ? '800' : '700',
      color: theme.text,
      marginBottom: 12,
      lineHeight: 26,
      fontFamily: Platform.select({
        ios: 'Poppins-Bold',
        android: 'Poppins-ExtraBold',
        default: 'Poppins-Bold',
      }),
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 12,
    },
    priceContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: theme.accent + '15',
      borderRadius: 12,
    },
    priceIcon: {
      marginRight: 8,
    },
    price: {
      fontSize: 22,
      fontWeight: Platform.OS === 'android' ? '900' : '800',
      color: theme.accent,
      fontFamily: Platform.select({
        ios: 'Poppins-ExtraBold',
        android: 'Poppins-Black',
        default: 'Poppins-ExtraBold',
      }),
    },
    originalPrice: {
      fontSize: 16,
      color: theme.textSecondary,
      textDecorationLine: 'line-through',
      fontFamily: Platform.select({
        ios: 'Poppins-Regular',
        android: 'Poppins-Medium',
        default: 'Poppins-Regular',
      }),
    },
    description: {
      fontSize: 15,
      color: theme.textSecondary,
      lineHeight: 22,
      marginBottom: 12,
      fontFamily: Platform.select({
        ios: 'Poppins-Regular',
        android: 'Poppins-Medium',
        default: 'Poppins-Regular',
      }),
    },
    stockRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 10,
    },
    stockBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      gap: 6,
    },
    stockDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    stockText: {
      fontSize: 12,
      fontWeight: Platform.OS === 'android' ? '700' : '600',
      fontFamily: Platform.select({
        ios: 'Poppins-SemiBold',
        android: 'Poppins-Bold',
        default: 'Poppins-SemiBold',
      }),
    },
    quantityBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.cardBackgroundAlt,
    },
    quantityText: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: Platform.OS === 'android' ? '500' : '400',
      fontFamily: Platform.select({
        ios: 'Poppins-Regular',
        android: 'Poppins-Medium',
        default: 'Poppins-Regular',
      }),
    },
    sellerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.borderColor,
    },
    sellerIconContainer: {
      marginRight: 8,
    },
    sellerInfo: {
      flex: 1,
    },
    sellerLabel: {
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
    sellerName: {
      fontSize: 14,
      color: theme.text,
      fontWeight: Platform.OS === 'android' ? '700' : '600',
      fontFamily: Platform.select({
        ios: 'Poppins-SemiBold',
        android: 'Poppins-Bold',
        default: 'Poppins-SemiBold',
      }),
    },
    quickMessageButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: `${theme.accent}20`,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionSection: {
      flexDirection: 'row',
      padding: 16,
      paddingTop: 0,
      gap: 10,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Platform.OS === 'ios' ? 14 : 12,
      paddingHorizontal: 20,
      borderRadius: 12,
      gap: 8,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.2,
          shadowRadius: 6,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    editButton: {
      backgroundColor: theme.primaryButton,
    },
    deleteButton: {
      backgroundColor: theme.error,
    },
    actionButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: Platform.OS === 'android' ? '800' : '700',
      fontFamily: Platform.select({
        ios: 'Poppins-Bold',
        android: 'Poppins-ExtraBold',
        default: 'Poppins-Bold',
      }),
    },
  });