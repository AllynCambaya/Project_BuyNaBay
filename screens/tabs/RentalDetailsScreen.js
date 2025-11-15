// screens/tabs/RentalDetailsScreen.js
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

const { width } = Dimensions.get('window');

export default function RentalDetailsScreen({ route, navigation }) {
  const rentalItem = route?.params?.rentalItem;
  const user = auth.currentUser;
  const insets = useSafeAreaInsets(); 
  
  const [sellerName, setSellerName] = useState('');
  const [sellerAvatar, setSellerAvatar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [contacting, setContacting] = useState(false);
  const [userStatus, setUserStatus] = useState('not_requested');

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

  const imageUrls = rentalItem?.rental_item_image
    ? Array.isArray(rentalItem.rental_item_image)
      ? rentalItem.rental_item_image
      : (() => {
          try {
            return JSON.parse(rentalItem.rental_item_image);
          } catch {
            return [rentalItem.rental_item_image];
          }
        })()
    : [];

  useEffect(() => {
    let mounted = true;
    
    const fetchData = async () => {
      if (!rentalItem?.owner_email) {
        setLoading(false);
        return;
      }

      const { data: sellerData, error: sellerError } = await supabase
        .from('users')
        .select('name, profile_photo')
        .eq('email', rentalItem.owner_email)
        .single();
      
      if (!sellerError && sellerData && mounted) {
        setSellerName(sellerData.name || 'Renter');
        setSellerAvatar(sellerData.profile_photo);
      }

      if (user?.email) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('status')
          .eq('email', user.email)
          .single();
        
        if (!userError && userData && mounted) {
          setUserStatus(userData.status || 'not_requested');
        }
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
    };
    
    fetchData();
    return () => { mounted = false; };
  }, [rentalItem, user]);

  const handleContactOwner = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to contact the owner.');
      navigation.navigate('Login');
      return;
    }

    if (user.email === rentalItem.owner_email) {
      Alert.alert('Not Allowed', 'You cannot message yourself.');
      return;
    }

    if (userStatus !== 'approved') {
      navigation.navigate('GetVerified');
      return;
    }

    setContacting(true);
    
    try {
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          sender_id: user.email,
          receiver_id: rentalItem.owner_email,
          title: 'New Rental Inquiry',
          message: `${user.email} is interested in renting your ${rentalItem.item_name}!`,
          created_at: new Date().toISOString()
        });

      if (notificationError) {
        console.error('Notification error:', notificationError);
      }

      navigation.navigate('Messaging', {
        receiverId: rentalItem.owner_email,
        receiverName: sellerName,
        productToSend: { ...rentalItem, product_name: rentalItem.item_name },
      });
    } catch (err) {
      console.error('Error contacting owner:', err);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setContacting(false);
    }
  };

  const styles = createStyles(theme, isDarkMode);

  if (!rentalItem) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <View style={styles.errorIconWrapper}>
            <Ionicons name="alert-circle-outline" size={64} color={theme.textSecondary} />
          </View>
          <Text style={[styles.errorTitle, { fontFamily: fontFamily.bold }]}>
            Rental Not Found
          </Text>
          <Text style={[styles.errorSubtitle, { fontFamily: fontFamily.medium }]}>
            This rental item may have been removed or doesn't exist.
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
          Loading rental details...
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
              {rentalItem.item_name}
            </Text>
          </View>

          <View style={styles.headerActions}>
            {user?.email !== rentalItem.owner_email && (
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() =>
                  navigation.navigate('ReportScreen', {
                    reported_student_id: rentalItem.owner_email,
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
            {/* Rental Info Card */}
            <View style={styles.contentCard}>
              {/* Category Badge */}
              {rentalItem.category && (
                <View style={styles.categoryBadge}>
                  <Text style={[styles.categoryText, { fontFamily: fontFamily.semiBold }]}>
                    {rentalItem.category}
                  </Text>
                </View>
              )}

              {/* Rental Item Name */}
              <Text style={[styles.productName, { fontFamily: fontFamily.extraBold }]}>
                {rentalItem.item_name}
              </Text>

              {/* Price and Duration Row */}
              <View style={styles.priceRow}>
                <View style={styles.priceContainer}>
                  <Text style={[styles.priceLabel, { fontFamily: fontFamily.medium }]}>
                    Rental Rate
                  </Text>
                  <View style={styles.priceWithDuration}>
                    <Text style={[styles.price, { fontFamily: fontFamily.bold }]}>
                      ₱{parseFloat(rentalItem.price).toFixed(2)}
                    </Text>
                    <Text style={[styles.durationText, { fontFamily: fontFamily.medium }]}>
                      / {rentalItem.rental_duration}
                    </Text>
                  </View>
                </View>

                <View style={styles.stockContainer}>
                  <View style={[
                    styles.stockBadge, 
                    { backgroundColor: rentalItem.quantity > 0 ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)' }
                  ]}>
                    <Ionicons
                      name={rentalItem.quantity > 0 ? 'checkmark-circle' : 'close-circle'}
                      size={16}
                      color={rentalItem.quantity > 0 ? '#4CAF50' : '#F44336'}
                    />
                    <Text style={[
                      styles.stockText,
                      { 
                        fontFamily: fontFamily.semiBold,
                        color: rentalItem.quantity > 0 ? '#4CAF50' : '#F44336'
                      }
                    ]}>
                      {rentalItem.quantity > 0 ? `${rentalItem.quantity} available` : 'Not available'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Quick Info Grid */}
              <View style={styles.infoGrid}>
                {rentalItem.condition && (
                  <View style={styles.infoItem}>
                    <View style={[
                      styles.infoIconCircle, 
                      { backgroundColor: isDarkMode ? 'rgba(253, 173, 0, 0.15)' : 'rgba(253, 173, 0, 0.1)' }
                    ]}>
                      <Ionicons name="star" size={18} color={theme.accent} />
                    </View>
                    <View style={styles.infoTextBlock}>
                      <Text style={[styles.infoLabel, { fontFamily: fontFamily.medium }]}>
                        Condition
                      </Text>
                      <Text style={[styles.infoValue, { fontFamily: fontFamily.semiBold }]}>
                        {rentalItem.condition}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.infoItem}>
                  <View style={[
                    styles.infoIconCircle, 
                    { backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.15)' : 'rgba(76, 175, 80, 0.1)' }
                  ]}>
                    <Ionicons name="time" size={18} color="#4CAF50" />
                  </View>
                  <View style={styles.infoTextBlock}>
                    <Text style={[styles.infoLabel, { fontFamily: fontFamily.medium }]}>
                      Rental Period
                    </Text>
                    <Text style={[styles.infoValue, { fontFamily: fontFamily.semiBold }]}>
                      {rentalItem.rental_duration}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Description Section */}
              {rentalItem.description && (
                <View style={styles.descriptionSection}>
                  <Text style={[styles.sectionTitle, { fontFamily: fontFamily.semiBold }]}>
                    Description
                  </Text>
                  <Text style={[styles.description, { fontFamily: fontFamily.regular }]}>
                    {rentalItem.description}
                  </Text>
                </View>
              )}

              {/* Owner Section */}
              <View style={styles.sellerSection}>
                <Text style={[styles.sectionTitle, { fontFamily: fontFamily.semiBold }]}>
                  Owner Information
                </Text>

                <View style={styles.sellerCard}>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('UserProfile', { userId: rentalItem.owner_email })}
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
                        {rentalItem.owner_email}
                      </Text>
                    </View>

                    <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Info Banner */}
              <View style={styles.infoBanner}>
                <View style={styles.infoBannerIcon}>
                  <Ionicons name="information-circle" size={24} color={theme.accent} />
                </View>
                <View style={styles.infoBannerContent}>
                  <Text style={[styles.infoBannerTitle, { fontFamily: fontFamily.semiBold }]}>
                    Rental Terms
                  </Text>
                  <Text style={[styles.infoBannerText, { fontFamily: fontFamily.regular }]}>
                    Contact the owner to arrange pickup, rental duration, and payment terms.
                  </Text>
                </View>
              </View>
            </View>

            {/* Bottom Spacing */}
            <View style={{ height: 120 }} />
          </Animated.View>
        </Animated.ScrollView>

        {/* Fixed Bottom Bar with Action Buttons */}
        {user?.email !== rentalItem.owner_email && (
          <View style={styles.bottomContainer}>
            <View style={styles.actionButtonsRow}>
              {/* Contact Owner Button - Takes full width */}
              <TouchableOpacity
                style={[
                  styles.addToCartButton,
                  contacting && styles.addToCartButtonDisabled,
                ]}
                onPress={handleContactOwner}
                disabled={contacting}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={contacting ? ['#9CA3AF', '#6B7280'] : ['#FDAD00', '#FF9500']}
                  style={styles.addToCartButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {contacting ? (
                    <>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={[styles.addToCartButtonText, { fontFamily: fontFamily.bold, marginLeft: 10 }]}>
                        Connecting...
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="chatbubble-ellipses" size={22} color="#fff" />
                      <Text style={[styles.addToCartButtonText, { fontFamily: fontFamily.bold }]}>
                        Contact Owner
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Quick Info Button */}
              <TouchableOpacity
                style={styles.iconActionButton}
                onPress={() => {
                  Alert.alert(
                    'Rental Information',
                    `Rate: ₱${rentalItem.price} per ${rentalItem.rental_duration}\nAvailable: ${rentalItem.quantity}\nCondition: ${rentalItem.condition}`,
                    [{ text: 'OK' }]
                  );
                }}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={isDarkMode ? ['rgba(253, 173, 0, 0.2)', 'rgba(253, 173, 0, 0.1)'] : ['rgba(253, 173, 0, 0.15)', 'rgba(253, 173, 0, 0.08)']}
                  style={styles.iconButtonGradient}
                >
                  <Ionicons name="information" size={20} color={theme.accent} />
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
  priceWithDuration: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  price: {
    fontSize: 32,
    color: theme.accent,
  },
  durationText: {
    fontSize: 16,
    color: theme.textSecondary,
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
    gap: 12,
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
    marginBottom: 20,
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

  // Info Banner
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: isDarkMode ? 'rgba(253, 173, 0, 0.1)' : 'rgba(253, 173, 0, 0.08)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(253, 173, 0, 0.2)' : 'rgba(253, 173, 0, 0.15)',
    gap: 12,
  },
  infoBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDarkMode ? 'rgba(253, 173, 0, 0.15)' : 'rgba(253, 173, 0, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBannerContent: {
    flex: 1,
  },
  infoBannerTitle: {
    fontSize: 14,
    color: theme.text,
    marginBottom: 4,
  },
  infoBannerText: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 20,
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