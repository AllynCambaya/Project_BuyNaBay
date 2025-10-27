<<<<<<< Updated upstream
import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
=======
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
>>>>>>> Stashed changes
import { supabase } from '../supabase/supabaseClient';

const { width } = Dimensions.get('window');
const nameCache = {};

export default function ProductCard({ product, canEdit, onEdit, onDelete, onMessageSeller, onPress }) {
  const [sellerName, setSellerName] = useState('');

<<<<<<< Updated upstream
=======
  // Automatically detect system theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;

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

>>>>>>> Stashed changes
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

  const styles = createStyles(theme);

  return (
<<<<<<< Updated upstream
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <View style={{
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginVertical: 8,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 3
      }}>
        {/* Product Info */}
        <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 4 }}>{product.product_name}</Text>
        <Text style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: 16 }}>₱{product.price}</Text>
        <Text style={{ marginVertical: 6, color: '#444' }}>{product.description}</Text>
        <Text style={{ color: 'gray', fontSize: 12 }}>Added by: {sellerName || product.email}</Text>

        {/* Buttons */}
        {canEdit ? (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
            <TouchableOpacity
              style={{ backgroundColor: '#1976d2', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 6, marginRight: 8 }}
              onPress={onEdit}
=======
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.imageScrollView}
              contentContainerStyle={styles.imageScrollContent}
              pagingEnabled
              decelerationRate="fast"
              snapToInterval={width - 40}
>>>>>>> Stashed changes
            >
              {imageUrls.map((uri, index) => (
                <View key={index} style={styles.imageContainer}>
                  <Image source={{ uri }} style={styles.productImage} />
                  {imageUrls.length > 1 && (
                    <View style={styles.imageCounter}>
                      <Text style={styles.imageCounterText}>
                        {index + 1}/{imageUrls.length}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Icon name="image" size={48} color={theme.textSecondary} />
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}

          {/* Product Info Section */}
          <View style={styles.infoSection}>
            {/* Product Name */}
            <Text style={styles.productName} numberOfLines={2}>
              {product.product_name}
            </Text>

            {/* Price Tag */}
            <View style={styles.priceContainer}>
              <Icon name="tag" size={16} color={theme.accent} style={styles.priceIcon} />
              <Text style={styles.price}>₱{product.price}</Text>
            </View>

            {/* Description */}
            {product.description ? (
              <Text style={styles.description} numberOfLines={3}>
                {product.description}
              </Text>
            ) : null}

            {/* Seller Info */}
            <View style={styles.sellerContainer}>
              <View style={styles.sellerIconContainer}>
                <Ionicons name="person-circle" size={18} color={theme.textSecondary} />
              </View>
              <Text style={styles.sellerLabel}>Seller: </Text>
              <Text style={styles.sellerName} numberOfLines={1}>
                {sellerName || product.email}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionSection}>
            {canEdit ? (
              <View style={styles.editButtonContainer}>
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
            ) : (
              <TouchableOpacity
                style={[styles.actionButton, styles.messageButton]}
                onPress={onMessageSeller}
                activeOpacity={0.85}
              >
                <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Message Seller</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// Dark theme colors (matching CartScreen)
const darkTheme = {
  background: '#0f0f2e',
  cardBackground: '#1e1e3f',
  cardBackgroundAlt: '#252550',
  text: '#fff',
  textSecondary: '#bbb',
  textTertiary: '#ccc',
  accent: '#FDAD00',
  accentSecondary: '#e8ecf1',
  successColor: '#4CAF50',
  error: '#d32f2f',
  primaryButton: '#1976d2',
  shadowColor: '#000',
  borderColor: '#2a2a4a',
  overlayColor: 'rgba(0, 0, 0, 0.6)',
};

// Light theme colors (matching CartScreen)
const lightTheme = {
  background: '#f5f7fa',
  cardBackground: '#ffffff',
  cardBackgroundAlt: '#f9f9fc',
  text: '#1a1a2e',
  textSecondary: '#4a4a6a',
  textTertiary: '#2c2c44',
  accent: '#f39c12',
  accentSecondary: '#e67e22',
  successColor: '#27ae60',
  error: '#e74c3c',
  primaryButton: '#1976d2',
  shadowColor: '#000',
  borderColor: '#e0e0ea',
  overlayColor: 'rgba(0, 0, 0, 0.3)',
};

const createStyles = (theme) =>
  StyleSheet.create({
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
    imageScrollView: {
      width: '100%',
      maxHeight: 240,
    },
    imageScrollContent: {
      paddingRight: 0,
    },
    imageContainer: {
      width: width - 40,
      height: 240,
      position: 'relative',
    },
    productImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    imageCounter: {
      position: 'absolute',
      bottom: 12,
      right: 12,
      backgroundColor: theme.overlayColor,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backdropFilter: 'blur(10px)',
    },
    imageCounterText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: Platform.OS === 'android' ? '700' : '600',
      fontFamily: Platform.select({
        ios: 'Poppins-SemiBold',
        android: 'Poppins-Bold',
        default: 'Poppins-SemiBold',
      }),
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
    priceContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: theme.accent + '15',
      borderRadius: 12,
      alignSelf: 'flex-start',
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
    sellerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.borderColor,
    },
    sellerIconContainer: {
      marginRight: 6,
    },
    sellerLabel: {
      fontSize: 13,
      color: theme.textSecondary,
      fontWeight: Platform.OS === 'android' ? '500' : '400',
      fontFamily: Platform.select({
        ios: 'Poppins-Regular',
        android: 'Poppins-Medium',
        default: 'Poppins-Regular',
      }),
    },
    sellerName: {
      fontSize: 13,
      color: theme.text,
      fontWeight: Platform.OS === 'android' ? '700' : '600',
      flex: 1,
      fontFamily: Platform.select({
        ios: 'Poppins-SemiBold',
        android: 'Poppins-Bold',
        default: 'Poppins-SemiBold',
      }),
    },
    actionSection: {
      padding: 16,
      paddingTop: 0,
    },
    editButtonContainer: {
      flexDirection: 'row',
      gap: 10,
    },
    actionButton: {
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
      flex: 1,
      backgroundColor: theme.primaryButton,
    },
    deleteButton: {
      flex: 1,
      backgroundColor: theme.error,
    },
    messageButton: {
      width: '100%',
      backgroundColor: theme.successColor,
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