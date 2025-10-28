import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
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

export default function RentalDetailsScreen({ route, navigation }) {
  const { rentalItem } = route.params;
  const [loading, setLoading] = useState(false);
  const currentUser = auth.currentUser;

  // Automatically detect system theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';

  // Get current theme colors based on system settings
  const theme = isDarkMode ? darkTheme : lightTheme;

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    // Trigger animations on mount
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
  }, []);

  const handleRentItem = async () => {
    if (rentalItem.owner_email === currentUser?.email) {
      return; // Don't allow renting own item
    }
    
    setLoading(true);
    try {
      // Create a notification for the seller
      const { error: notificationError } = await supabase.from('notifications').insert({
        sender_id: currentUser?.email,
        receiver_id: rentalItem.owner_email,
        title: 'New Rental Request',
        message: `${currentUser?.email} wants to rent your ${rentalItem.item_name}!`,
        created_at: new Date().toISOString()
      });

      if (notificationError) throw notificationError;

      // Navigate to messaging screen after sending notification
      navigation.navigate('Messaging', { 
        receiverId: rentalItem.owner_email,
        receiverName: rentalItem.seller_name,
        productToSend: { ...rentalItem, product_name: rentalItem.item_name }, // Pass rental item
      });
    } catch (err) {
      console.error('Error processing rental request:', err);
    } finally {
      setLoading(false);
    }
  };

  const styles = createStyles(theme);

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
            <Text style={styles.headerTitle}>Rental Details</Text>
            <View style={styles.headerButton} />
          </View>

          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
            }}
          >
            {/* Image Section */}
            {rentalItem.rental_item_image ? (
              <View style={styles.imageSection}>
                <Image 
                  source={{ uri: rentalItem.rental_item_image }} 
                  style={styles.image}
                  resizeMode="cover"
                />
              </View>
            ) : (
              <View style={styles.noImageContainer}>
                <Icon name="image" size={64} color={theme.textSecondary} />
                <Text style={styles.noImageText}>No Image Available</Text>
              </View>
            )}

            {/* Content Card */}
            <View style={styles.card}>
              {/* Title Section */}
              <View style={styles.titleSection}>
                <Text style={styles.title}>{rentalItem.item_name}</Text>
                
                {/* Seller Badge */}
                <View style={styles.sellerBadge}>
                  <Icon name="user-circle" size={16} color={theme.accent} />
                  <Text style={styles.sellerText}> Posted by: {rentalItem.seller_name}</Text>
                </View>
              </View>

              {/* Price and Duration Section */}
              <View style={styles.priceSection}>
                <View style={styles.priceCard}>
                  <Icon name="tag" size={20} color={theme.accent} />
                  <View style={styles.priceInfo}>
                    <Text style={styles.priceLabel}>Rental Price</Text>
                    <Text style={styles.price}>₱{rentalItem.price}</Text>
                  </View>
                </View>
                
                <View style={styles.durationCard}>
                  <Icon name="clock-o" size={20} color={theme.historyColor} />
                  <View style={styles.durationInfo}>
                    <Text style={styles.durationLabel}>Duration</Text>
                    <Text style={styles.duration}>{rentalItem.rental_duration}</Text>
                  </View>
                </View>
              </View>

              {/* Quick Info Grid */}
              <View style={styles.quickInfoGrid}>
                <View style={styles.quickInfoCard}>
                  <Icon name="folder-open" size={18} color={theme.accent} />
                  <Text style={styles.quickInfoLabel}>Category</Text>
                  <Text style={styles.quickInfoValue}>{rentalItem.category}</Text>
                </View>
                
                <View style={styles.quickInfoCard}>
                  <Icon name="certificate" size={18} color={theme.historyColor} />
                  <Text style={styles.quickInfoLabel}>Condition</Text>
                  <Text style={styles.quickInfoValue}>{rentalItem.condition}</Text>
                </View>
                
                <View style={styles.quickInfoCard}>
                  <Icon name="cubes" size={18} color="#3a7bd5" />
                  <Text style={styles.quickInfoLabel}>Available</Text>
                  <Text style={styles.quickInfoValue}>{rentalItem.quantity}</Text>
                </View>
              </View>

              {/* Description Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon name="align-left" size={18} color={theme.text} />
                  <Text style={styles.sectionTitle}> Description</Text>
                </View>
                <Text style={styles.description}>{rentalItem.description}</Text>
              </View>

              {/* Rental Info Banner */}
              <View style={styles.infoBanner}>
                <Icon name="info-circle" size={20} color={theme.accent} />
                <Text style={styles.infoBannerText}>
                  Contact the owner to arrange pickup and rental terms
                </Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>

        {/* Fixed Bottom Button */}
        {currentUser?.email !== rentalItem.owner_email && (
          <View style={styles.bottomContainer}>
            <TouchableOpacity
              style={[
                styles.rentButton,
                loading && styles.rentButtonDisabled,
              ]}
              onPress={handleRentItem}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <View style={styles.buttonLoadingContainer}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.rentButtonText, { marginLeft: 10 }]}>Processing...</Text>
                </View>
              ) : (
                <>
                  <Icon name="comments" size={20} color="#fff" style={{ marginRight: 10 }} />
                  <Text style={styles.rentButtonText}>Contact Owner</Text>
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
  infoBannerBg: '#2a2a55',
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
  infoBannerBg: '#fffbf0',
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
  imageSection: {
    marginBottom: 20,
  },
  image: {
    width: width,
    height: width * 0.8,
    backgroundColor: theme.cardBackgroundAlt,
  },
  noImageContainer: {
    width: width,
    height: width * 0.8,
    backgroundColor: theme.cardBackgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: theme.borderColor,
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
    marginBottom: 16,
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
  sellerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.quickInfoBackground,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  sellerText: {
    fontSize: 14,
    color: theme.text,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
  priceSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  priceCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.quickInfoBackground,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  priceInfo: {
    marginLeft: 12,
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
    fontSize: 22,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    color: theme.accent,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  durationCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.quickInfoBackground,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  durationInfo: {
    marginLeft: 12,
    flex: 1,
  },
  durationLabel: {
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
  duration: {
    fontSize: 16,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    color: theme.text,
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
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
    marginBottom: 20,
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
  description: {
    fontSize: 15,
    lineHeight: 24,
    color: theme.textSecondary,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.infoBannerBg,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  infoBannerText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: theme.text,
    lineHeight: 20,
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
  rentButton: {
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
  rentButtonDisabled: {
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
  rentButtonText: {
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
});