// screens/tabs/LostAndFoundDetailsScreen.js
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

const getRelativeTime = (dateString) => {
  const now = new Date();
  const past = new Date(dateString);
  const diffInSeconds = Math.floor((now - past) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return past.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function LostAndFoundDetailsScreen({ route, navigation }) {
  const item = route?.params?.item;
  const user = auth.currentUser;
  const insets = useSafeAreaInsets(); 
  
  const [reporterName, setReporterName] = useState('');
  const [reporterAvatar, setReporterAvatar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [contacting, setContacting] = useState(false);
  const [reporting, setReporting] = useState(false);

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

  const imageUrls = item?.lost_and_found_url || item?.image_urls || [];

  useEffect(() => {
    let mounted = true;
    const fetchReporterInfo = async () => {
      if (!item?.user_email) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('name, profile_photo')
        .eq('email', item.user_email)
        .single();
      
      if (!error && data && mounted) {
        setReporterName(data.name || item.user_name || 'Anonymous');
        setReporterAvatar(data.profile_photo || item.user_avatar);
      } else if (mounted) {
        setReporterName(item.user_name || 'Anonymous');
        setReporterAvatar(item.user_avatar);
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
    
    fetchReporterInfo();
    return () => { mounted = false; };
  }, [item]);

  const handleContactReporter = () => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to contact the reporter.');
      navigation.navigate('Login');
      return;
    }

    if (user.email === item.user_email) {
      Alert.alert('Not Allowed', 'You cannot message yourself.');
      return;
    }

    setContacting(true);

    navigation.navigate('Messaging', {
      receiverId: item.user_email,
      receiverName: reporterName,
    });

    setTimeout(() => setContacting(false), 500);
  };

  const styles = createStyles(theme, isDarkMode);

  if (!item) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <View style={styles.errorIconWrapper}>
            <Ionicons name="alert-circle-outline" size={64} color={theme.textSecondary} />
          </View>
          <Text style={[styles.errorTitle, { fontFamily: fontFamily.bold }]}>
            Item Not Found
          </Text>
          <Text style={[styles.errorSubtitle, { fontFamily: fontFamily.medium }]}>
            This lost or found item may have been removed or doesn't exist.
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
          Loading item details...
        </Text>
      </View>
    );
  }

  const isLost = item.item_status === 'lost';

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
              {item.item_name}
            </Text>
          </View>

          <View style={styles.headerActions}>
            {user?.email !== item.user_email && (
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() =>
                  navigation.navigate('ReportScreen', {
                    reported_student_id: item.user_email,
                    reported_name: reporterName,
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
                      <Image source={{ uri }} style={styles.itemImage} resizeMode="cover" />
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
            {/* Item Info Card */}
            <View style={styles.contentCard}>
              {/* Status Badge */}
              <View style={[styles.statusBadge, isLost ? styles.lostBadge : styles.foundBadge]}>
                <Ionicons 
                  name={isLost ? 'sad-outline' : 'happy-outline'} 
                  size={14} 
                  color="#fff" 
                />
                <Text style={[styles.statusText, { fontFamily: fontFamily.bold }]}>
                  {isLost ? 'Lost Item' : 'Found Item'}
                </Text>
              </View>

              {/* Item Name */}
              <Text style={[styles.itemName, { fontFamily: fontFamily.extraBold }]}>
                {item.item_name}
              </Text>

              {/* Quick Info Row */}
              <View style={styles.quickInfoRow}>
                <View style={styles.quickInfoItem}>
                  <View style={[styles.quickInfoIcon, { backgroundColor: isLost ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)' }]}>
                    <Ionicons 
                      name="location" 
                      size={18} 
                      color={isLost ? theme.lost : theme.found} 
                    />
                  </View>
                  <View style={styles.quickInfoText}>
                    <Text style={[styles.quickInfoLabel, { fontFamily: fontFamily.medium }]}>
                      Location
                    </Text>
                    <Text style={[styles.quickInfoValue, { fontFamily: fontFamily.semiBold }]} numberOfLines={1}>
                      {item.location || 'Not specified'}
                    </Text>
                  </View>
                </View>

                <View style={styles.quickInfoItem}>
                  <View style={[styles.quickInfoIcon, { backgroundColor: isDarkMode ? 'rgba(253, 173, 0, 0.15)' : 'rgba(253, 173, 0, 0.1)' }]}>
                    <Ionicons name="time" size={18} color={theme.accent} />
                  </View>
                  <View style={styles.quickInfoText}>
                    <Text style={[styles.quickInfoLabel, { fontFamily: fontFamily.medium }]}>
                      Reported
                    </Text>
                    <Text style={[styles.quickInfoValue, { fontFamily: fontFamily.semiBold }]}>
                      {getRelativeTime(item.created_at)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Description Section */}
              {item.description && (
                <View style={styles.descriptionSection}>
                  <Text style={[styles.sectionTitle, { fontFamily: fontFamily.semiBold }]}>
                    Description
                  </Text>
                  <Text style={[styles.description, { fontFamily: fontFamily.regular }]}>
                    {item.description}
                  </Text>
                </View>
              )}

              {/* Reporter Section */}
              <View style={styles.reporterSection}>
                <Text style={[styles.sectionTitle, { fontFamily: fontFamily.semiBold }]}>
                  Reported By
                </Text>

                <View style={styles.reporterCard}>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('UserProfile', { userId: item.user_email })}
                    activeOpacity={0.8}
                    style={styles.reporterInfo}
                  >
                    {reporterAvatar ? (
                      <Image source={{ uri: reporterAvatar }} style={styles.reporterAvatar} />
                    ) : (
                      <View style={[styles.reporterAvatar, styles.avatarPlaceholder]}>
                        <Ionicons name="person" size={24} color={theme.textSecondary} />
                      </View>
                    )}

                    <View style={styles.reporterDetails}>
                      <Text style={[styles.reporterName, { fontFamily: fontFamily.semiBold }]}>
                        {reporterName}
                      </Text>
                      <Text style={[styles.reporterEmail, { fontFamily: fontFamily.medium }]} numberOfLines={1}>
                        {item.user_email || 'No email provided'}
                      </Text>
                    </View>

                    <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Additional Info */}
              {item.created_at && (
                <View style={styles.additionalInfo}>
                  <View style={styles.infoRow}>
                    <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
                    <Text style={[styles.infoText, { fontFamily: fontFamily.medium }]}>
                      Posted on {new Date(item.created_at).toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
                    <Text style={[styles.infoText, { fontFamily: fontFamily.medium }]}>
                      {new Date(item.created_at).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </Text>
                  </View>
                </View>
              )}

              {/* Help Banner */}
              <View style={styles.helpBanner}>
                <View style={styles.helpBannerIcon}>
                  <Ionicons 
                    name={isLost ? 'help-circle' : 'checkmark-circle'} 
                    size={24} 
                    color={isLost ? theme.lost : theme.found} 
                  />
                </View>
                <View style={styles.helpBannerContent}>
                  <Text style={[styles.helpBannerTitle, { fontFamily: fontFamily.semiBold }]}>
                    {isLost ? 'Found This Item?' : 'Is This Yours?'}
                  </Text>
                  <Text style={[styles.helpBannerText, { fontFamily: fontFamily.regular }]}>
                    {isLost 
                      ? 'Contact the reporter to help reunite them with their lost item.'
                      : 'If this item belongs to you, contact the finder to arrange pickup.'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Bottom Spacing */}
            <View style={{ height: 120 }} />
          </Animated.View>
        </Animated.ScrollView>

        {/* Fixed Bottom Bar with Action Button */}
        {user?.email !== item.user_email && (
          <View style={styles.bottomContainer}>
            <View style={styles.actionButtonsRow}>
              {/* Contact Reporter Button */}
              <TouchableOpacity
                style={[
                  styles.contactButton,
                  contacting && styles.contactButtonDisabled,
                ]}
                onPress={handleContactReporter}
                disabled={contacting}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={contacting ? ['#9CA3AF', '#6B7280'] : ['#FDAD00', '#FF9500']}
                  style={styles.contactButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {contacting ? (
                    <>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={[styles.contactButtonText, { fontFamily: fontFamily.bold, marginLeft: 10 }]}>
                        Opening...
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="chatbubble-ellipses" size={22} color="#fff" />
                      <Text style={[styles.contactButtonText, { fontFamily: fontFamily.bold }]}>
                        Contact Reporter
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Share Button */}
              <TouchableOpacity
                style={styles.iconActionButton}
                onPress={() => {
                  Alert.alert(
                    'Share Item',
                    `${item.item_name}\nStatus: ${isLost ? 'Lost' : 'Found'}\nLocation: ${item.location || 'Not specified'}`,
                    [{ text: 'OK' }]
                  );
                }}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={isDarkMode ? ['rgba(253, 173, 0, 0.2)', 'rgba(253, 173, 0, 0.1)'] : ['rgba(253, 173, 0, 0.15)', 'rgba(253, 173, 0, 0.08)']}
                  style={styles.iconButtonGradient}
                >
                  <Ionicons name="share-social" size={20} color={theme.accent} />
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
  itemImage: {
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
  statusBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 16,
    gap: 6,
  },
  lostBadge: {
    backgroundColor: theme.lost || '#EF4444',
  },
  foundBadge: {
    backgroundColor: theme.found || '#10B981',
  },
  statusText: {
    fontSize: 12,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemName: {
    fontSize: 28,
    color: theme.text,
    marginBottom: 24,
    lineHeight: 36,
  },

  // Quick Info Row
  quickInfoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
  },
  quickInfoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(42, 40, 86, 0.6)' : 'rgba(245, 245, 245, 1)',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.borderColor,
    gap: 10,
  },
  quickInfoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickInfoText: {
    flex: 1,
  },
  quickInfoLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickInfoValue: {
    fontSize: 14,
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

  // Reporter Section
  reporterSection: {
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: theme.borderColor,
    marginBottom: 20,
  },
  reporterCard: {
    backgroundColor: isDarkMode ? 'rgba(42, 40, 86, 0.6)' : 'rgba(245, 245, 245, 1)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  reporterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reporterAvatar: {
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
  reporterDetails: {
    flex: 1,
  },
  reporterName: {
    fontSize: 16,
    color: theme.text,
    marginBottom: 4,
  },
  reporterEmail: {
    fontSize: 14,
    color: theme.textSecondary,
  },

  // Additional Info
  additionalInfo: {
    marginBottom: 20,
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    color: theme.textSecondary,
  },

  // Help Banner
  helpBanner: {
    flexDirection: 'row',
    backgroundColor: isDarkMode ? 'rgba(253, 173, 0, 0.1)' : 'rgba(253, 173, 0, 0.08)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(253, 173, 0, 0.2)' : 'rgba(253, 173, 0, 0.15)',
    gap: 12,
  },
  helpBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDarkMode ? 'rgba(253, 173, 0, 0.15)' : 'rgba(253, 173, 0, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpBannerContent: {
    flex: 1,
  },
  helpBannerTitle: {
    fontSize: 14,
    color: theme.text,
    marginBottom: 4,
  },
  helpBannerText: {
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
  contactButton: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#FDAD00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  contactButtonDisabled: {
    shadowColor: theme.shadowColor,
    shadowOpacity: 0.2,
  },
  contactButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  contactButtonText: {
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