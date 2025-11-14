import { FontAwesome as Icon, Ionicons } from '@expo/vector-icons';
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
  useColorScheme
} from 'react-native';
import { auth } from '../firebase/firebaseConfig';
import { supabase } from '../supabase/supabaseClient';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;
const nameCache = {};

export default function ProductCard({
  product,
  canEdit,
  onEdit,
  onDelete,
  onMessageSeller,
  onPress,
  viewMode = 'list',
}) {
  const [sellerName, setSellerName] = useState('');
  const [imageIndex, setImageIndex] = useState(0);

  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const messageScaleAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  const currentUser = auth.currentUser;
  const theme = isDarkMode ? darkTheme : lightTheme;

  // Parse image URLs
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

  // Shimmer animation for loading state
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 120,
      friction: 7,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 120,
      friction: 7,
    }).start();
  };

  const handleMessagePress = (e) => {
    if (e) e.stopPropagation();
    
    Animated.sequence([
      Animated.spring(messageScaleAnim, {
        toValue: 1.2,
        useNativeDriver: true,
        tension: 100,
        friction: 3,
      }),
      Animated.spring(messageScaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 3,
      }),
    ]).start();
    
    if (onMessageSeller) {
      onMessageSeller();
    }
  };

  // Calculate discount
  const hasDiscount = product.original_price && parseFloat(product.original_price) > parseFloat(product.price);
  const discountPercent = hasDiscount
    ? Math.round(((parseFloat(product.original_price) - parseFloat(product.price)) / parseFloat(product.original_price)) * 100)
    : 0;

  // Check if new product
  const isNewProduct = () => {
    if (!product.created_at) return false;
    const createdDate = new Date(product.created_at);
    const daysDiff = (new Date() - createdDate) / (1000 * 60 * 60 * 24);
    return daysDiff <= 7;
  };

  // Stock status
  const getStockStatus = () => {
    const qty = parseInt(product.quantity) || 0;
    if (qty === 0) return { text: 'Out of Stock', color: theme.error };
    if (qty <= 5) return { text: `Only ${qty} left`, color: theme.warning };
    return { text: 'In Stock', color: theme.success };
  };

  const stockStatus = getStockStatus();
  const styles = createStyles(theme, viewMode);

  // Grid View
  if (viewMode === 'grid') {
    return (
      <Animated.View style={[styles.gridCardWrapper, { transform: [{ scale: scaleAnim }] }]}>
        <TouchableOpacity
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
          style={styles.gridCard}
        >
          {/* Image Section */}
          <View style={styles.gridImageContainer}>
            {imageUrls.length > 0 ? (
              <>
                <Image source={{ uri: imageUrls[0] }} style={styles.gridImage} />
                <View style={styles.imageOverlay} />
              </>
            ) : (
              <View style={styles.gridImagePlaceholder}>
                <Icon name="image" size={32} color={theme.textSecondary} />
              </View>
            )}

            {/* Top Badges */}
            <View style={styles.gridBadgesContainer}>
              {isNewProduct() && (
                <View style={styles.newBadge}>
                  <Icon name="star" size={8} color="#fff" style={{ marginRight: 3 }} />
                  <Text style={styles.newBadgeText}>NEW</Text>
                </View>
              )}
              {hasDiscount && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountBadgeText}>-{discountPercent}%</Text>
                </View>
              )}
            </View>

            {/* Messaging Button */}
            {product.email !== currentUser?.email && (
              <Animated.View style={[styles.gridMessageButton, { transform: [{ scale: messageScaleAnim }] }]}>
                <TouchableOpacity onPress={handleMessagePress} activeOpacity={0.8}>
                  <Ionicons
                    name="chatbubble-ellipses"
                    size={18}
                    color="#fff"
                  />
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Image Counter */}
            {imageUrls.length > 1 && (
              <View style={styles.gridImageCounter}>
                <Icon name="image" size={9} color="#fff" />
                <Text style={styles.gridImageCounterText}> {imageUrls.length}</Text>
              </View>
            )}
          </View>

          {/* Info Section */}
          <View style={styles.gridInfoSection}>
            {/* Category Badge */}
            {product.category && (
              <View style={styles.categoryBadgeSmall}>
                <Text style={styles.categoryBadgeTextSmall} numberOfLines={1}>
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
            <View style={[styles.stockBadgeSmall, { backgroundColor: `${stockStatus.color}15` }]}>
              <View style={[styles.stockDot, { backgroundColor: stockStatus.color }]} />
              <Text style={[styles.stockTextSmall, { color: stockStatus.color }]} numberOfLines={1}>
                {stockStatus.text}
              </Text>
            </View>

            {/* Seller Info */}
            <View style={styles.gridSellerContainer}>
              {product.seller_avatar ? (
                <Image source={{ uri: product.seller_avatar }} style={styles.gridSellerAvatar} />
              ) : (
                <View style={[styles.gridSellerAvatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={8} color={theme.textSecondary} />
                </View>
              )}
              <Text style={styles.gridSellerName} numberOfLines={1}>
                {sellerName || product.email}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // List View
  return (
    <Animated.View style={[styles.cardWrapper, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
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
                    <View style={styles.imageGradient} />
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
                    <Text style={styles.discountBadgeText}>-{discountPercent}% OFF</Text>
                  </View>
                )}
              </View>

              {/* Messaging Button */}
              {product.email !== currentUser?.email && (
                <Animated.View style={[styles.messageButton, { transform: [{ scale: messageScaleAnim }] }]}>
                  <TouchableOpacity onPress={handleMessagePress} activeOpacity={0.8}>
                    <Ionicons
                      name="chatbubble-ellipses"
                      size={22}
                      color="#fff"
                    />
                  </TouchableOpacity>
                </Animated.View>
              )}
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
                  <Icon name="check-circle" size={10} color={theme.success} style={{ marginRight: 4 }} />
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
                <Text style={styles.price}>₱{product.price}</Text>
                {hasDiscount && (
                  <Text style={styles.originalPrice}>₱{product.original_price}</Text>
                )}
              </View>
              <View style={styles.priceBadge}>
                <Icon name="tag" size={12} color={theme.accent} />
              </View>
            </View>

            {/* Description */}
            {product.description ? (
              <Text style={styles.description} numberOfLines={3}>
                {product.description}
              </Text>
            ) : null}

            {/* Stock & Quantity Info */}
            <View style={styles.stockRow}>
              <View style={[styles.stockBadge, { backgroundColor: `${stockStatus.color}15` }]}>
                <View style={[styles.stockDot, { backgroundColor: stockStatus.color }]} />
                <Text style={[styles.stockText, { color: stockStatus.color }]}>
                  {stockStatus.text}
                </Text>
              </View>
              {product.quantity && parseInt(product.quantity) > 5 && (
                <View style={styles.quantityBadge}>
                  <Icon name="cube" size={11} color={theme.textSecondary} />
                  <Text style={styles.quantityText}> {product.quantity} available</Text>
                </View>
              )}
            </View>

            {/* Seller Info */}
            <View style={styles.sellerContainer}>
              <View style={styles.sellerIconContainer}>
                {product.seller_avatar ? (
                  <Image source={{ uri: product.seller_avatar }} style={styles.sellerAvatar} />
                ) : (
                  <View style={[styles.sellerAvatar, styles.avatarPlaceholder]}>
                    <Ionicons name="person" size={16} color={theme.textSecondary} />
                  </View>
                )}
                <View style={styles.onlineIndicator} />
              </View>
              <View style={styles.sellerInfo}>
                <Text style={styles.sellerLabel}>Seller</Text>
                <Text style={styles.sellerName} numberOfLines={1}>
                  {sellerName || product.email}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          {canEdit && (
            <View style={styles.actionSection}>
              <TouchableOpacity
                style={[styles.actionButton, styles.editButton]}
                onPress={onEdit}
                activeOpacity={0.8}
              >
                <Ionicons name="pencil" size={16} color="#fff" />
                <Text style={styles.actionButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={onDelete}
                activeOpacity={0.8}
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

const lightTheme = {
  background: '#f5f7fa',
  cardBackground: '#ffffff',
  cardBackgroundAlt: '#f9f9fc',
  text: '#1a1a2e',
  textSecondary: '#4a4a6a',
  textTertiary: '#2c2c44',
  accent: '#FDAD00',
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
    cardWrapper: {
      marginBottom: 20,
    },
    // Grid View Styles
    gridCardWrapper: {
      width: CARD_WIDTH,
      marginBottom: 16,
    },
    gridCard: {
      backgroundColor: theme.cardBackground,
      borderRadius: 18,
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
    gridImageContainer: {
      width: '100%',
      height: CARD_WIDTH * 1.15,
      position: 'relative',
      backgroundColor: theme.cardBackgroundAlt,
    },
    gridImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    imageOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.03)',
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
      top: 10,
      left: 10,
      gap: 6,
    },
    gridMessageButton: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.accent,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
    },
    gridImageCounter: {
      position: 'absolute',
      bottom: 10,
      right: 10,
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
      fontWeight: '700',
      fontFamily: 'Poppins-Bold',
    },
    gridInfoSection: {
      padding: 14,
    },
    categoryBadgeSmall: {
      alignSelf: 'flex-start',
      backgroundColor: `${theme.accent}18`,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      marginBottom: 8,
    },
    categoryBadgeTextSmall: {
      fontSize: 9,
      color: theme.accent,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      fontFamily: 'Poppins-Bold',
    },
    gridProductName: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 8,
      lineHeight: 19,
      minHeight: 38,
      fontFamily: 'Poppins-Bold',
    },
    gridPriceSection: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      gap: 6,
    },
    gridPrice: {
      fontSize: 18,
      fontWeight: '900',
      color: theme.accent,
      fontFamily: 'Poppins-ExtraBold',
    },
    gridOriginalPrice: {
      fontSize: 12,
      color: theme.textSecondary,
      textDecorationLine: 'line-through',
      fontFamily: 'Poppins-Regular',
    },
    stockBadgeSmall: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 6,
      gap: 4,
      marginBottom: 8,
    },
    stockTextSmall: {
      fontSize: 10,
      fontWeight: '600',
      fontFamily: 'Poppins-SemiBold',
    },
    gridSellerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.borderColor,
      gap: 6,
    },
    gridSellerAvatar: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: theme.cardBackgroundAlt,
    },
    gridSellerName: {
      fontSize: 11,
      color: theme.textSecondary,
      flex: 1,
      fontFamily: 'Poppins-Medium',
    },
    // List View Styles
    card: {
      backgroundColor: theme.cardBackground,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.borderColor,
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        },
        android: {
          elevation: 6,
        },
      }),
    },
    imageSection: {
      width: '100%',
      height: 260,
      position: 'relative',
      backgroundColor: theme.cardBackgroundAlt,
    },
    imageContainer: {
      width: width - 40,
      height: 260,
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
      backgroundColor: 'transparent',
    },
    imageIndicators: {
      position: 'absolute',
      bottom: 14,
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
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.3,
          shadowRadius: 2,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    activeIndicator: {
      backgroundColor: '#fff',
      width: 24,
    },
    badgesContainer: {
      position: 'absolute',
      top: 14,
      left: 14,
      gap: 8,
    },
    newBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.success,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      ...Platform.select({
        ios: {
          shadowColor: theme.success,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.4,
          shadowRadius: 4,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    newBadgeText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.5,
      fontFamily: 'Poppins-ExtraBold',
    },
    discountBadge: {
      backgroundColor: '#FF3B30',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      ...Platform.select({
        ios: {
          shadowColor: '#FF3B30',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.4,
          shadowRadius: 4,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    discountBadgeText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.5,
      fontFamily: 'Poppins-ExtraBold',
    },
    messageButton: {
      position: 'absolute',
      top: 14,
      right: 14,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.accent,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
    },
    imagePlaceholder: {
      width: '100%',
      height: 260,
      backgroundColor: theme.cardBackgroundAlt,
      justifyContent: 'center',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.borderColor,
    },
    placeholderText: {
      marginTop: 12,
      fontSize: 14,
      color: theme.textSecondary,
      fontFamily: 'Poppins-Medium',
    },
    infoSection: {
      padding: 18,
    },
    tagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 14,
    },
    categoryBadge: {
      backgroundColor: `${theme.accent}18`,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: `${theme.accent}30`,
    },
    categoryBadgeText: {
      fontSize: 11,
      color: theme.accent,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      fontFamily: 'Poppins-Bold',
    },
    conditionBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: `${theme.success}18`,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: `${theme.success}30`,
    },
    conditionBadgeText: {
      fontSize: 11,
      color: theme.success,
      fontWeight: '700',
      fontFamily: 'Poppins-Bold',
    },
    productName: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 14,
      lineHeight: 30,
      letterSpacing: -0.3,
      fontFamily: 'Poppins-ExtraBold',
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
      gap: 10,
    },
    priceContainer: {
      flexDirection: 'row',
      alignItems: 'baseline',
      paddingVertical: 10,
      paddingHorizontal: 14,
      backgroundColor: `${theme.accent}12`,
      borderRadius: 12,
      flex: 1,
      gap: 8,
    },
    priceBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: `${theme.accent}20`,
      justifyContent: 'center',
      alignItems: 'center',
    },
    price: {
      fontSize: 24,
      fontWeight: '900',
      color: theme.accent,
      letterSpacing: -0.5,
      fontFamily: 'Poppins-Black',
    },
    originalPrice: {
      fontSize: 16,
      color: theme.textSecondary,
      textDecorationLine: 'line-through',
      fontFamily: 'Poppins-Regular',
    },
    description: {
      fontSize: 15,
      color: theme.textSecondary,
      lineHeight: 23,
      marginBottom: 14,
      fontFamily: 'Poppins-Regular',
    },
    stockRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
      gap: 10,
    },
    stockBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
      gap: 6,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    stockDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    stockText: {
      fontSize: 12,
      fontWeight: '700',
      fontFamily: 'Poppins-Bold',
    },
    quantityBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
      backgroundColor: theme.cardBackgroundAlt,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    quantityText: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: '500',
      fontFamily: 'Poppins-Medium',
    },
    sellerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: theme.borderColor,
    },
    avatarPlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.cardBackgroundAlt,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    sellerIconContainer: {
      marginRight: 12,
      position: 'relative',
    },
    sellerInfo: {
      flex: 1,
    },
    sellerLabel: {
      fontSize: 11,
      color: theme.textSecondary,
      marginBottom: 3,
      fontWeight: '500',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      fontFamily: 'Poppins-Medium',
    },
    sellerAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: theme.accent,
    },
    onlineIndicator: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.success,
      borderWidth: 2,
      borderColor: theme.cardBackground,
    },
    sellerName: {
      fontSize: 15,
      color: theme.text,
      fontWeight: '700',
      fontFamily: 'Poppins-Bold',
    },
    actionSection: {
      flexDirection: 'row',
      padding: 18,
      paddingTop: 0,
      gap: 12,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Platform.OS === 'ios' ? 15 : 13,
      paddingHorizontal: 20,
      borderRadius: 14,
      gap: 8,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
        },
        android: {
          elevation: 5,
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
      fontWeight: '800',
      letterSpacing: 0.3,
      fontFamily: 'Poppins-ExtraBold',
    },
  });