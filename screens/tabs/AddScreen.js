// screens/tabs/AddScreen.js
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';
import { darkTheme, lightTheme } from '../../theme/theme';
import { fontFamily } from '../../theme/typography';

const { width } = Dimensions.get('window');

export default function AddScreen() {
  const navigation = useNavigation();
  const currentUser = auth.currentUser;
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();

  const [userProfileImage, setUserProfileImage] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleProduct = useRef(new Animated.Value(1)).current;
  const scaleRental = useRef(new Animated.Value(1)).current;
  const scaleLostItem = useRef(new Animated.Value(1)).current;
  const notificationPulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (currentUser?.email) {
        const { data, error } = await supabase
          .from('users')
          .select('profile_photo')
          .eq('email', currentUser.email)
          .single();
        if (!error && data) setUserProfileImage(data.profile_photo);
      }
    };
    fetchUserProfile();
  }, [currentUser]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerSlideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
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
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(notificationPulseAnim, {
          toValue: 1.15,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(notificationPulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handlePressIn = (scaleValue) => {
    Animated.spring(scaleValue, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = (scaleValue) => {
    Animated.spring(scaleValue, {
      toValue: 1,
      friction: 7,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const getNotificationButtonColor = () => {
    return isDarkMode ? theme.notificationColor : '#4CAF50';
  };

  const styles = createStyles(theme, insets);

  return (
    <View style={styles.safeArea}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
        translucent={false}
      />

      {/* Header Section */}
      <Animated.View 
        style={[
          styles.headerContainer,
          {
            transform: [{ translateY: headerSlideAnim }],
            opacity: fadeAnim,
          }
        ]}
      >
        <View style={styles.backgroundGradient}>
          <View style={styles.gradientOverlay} />
        </View>

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
                Create Listing
              </Text>
            </View>
          </View>

          <View style={styles.headerActionsContainer}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Notifications')}
              style={[styles.actionButton, styles.notificationButton, { backgroundColor: getNotificationButtonColor() }]}
              activeOpacity={0.7}
            >
              <Animated.View style={{ transform: [{ scale: notificationPulseAnim }] }}>
                <Ionicons 
                  name="notifications-outline" 
                  size={22} 
                  color="#fff"
                />
              </Animated.View>
              <Animated.View 
                style={[
                  styles.notificationBadge,
                  { transform: [{ scale: notificationPulseAnim }] }
                ]} 
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('ProfileScreen')}
              activeOpacity={0.8}
            >
              <View style={styles.profileImageWrapper}>
                <Image
                  source={
                    userProfileImage
                      ? { uri: userProfileImage }
                      : require('../../assets/images/OfficialBuyNaBay.png')
                  }
                  style={styles.profileImage}
                />
                <View style={styles.onlineIndicator} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* Introduction Card */}
          <View style={styles.introCard}>
            <View style={styles.introIconContainer}>
              <Ionicons name="sparkles" size={32} color={theme.accent} />
            </View>
            <Text style={[styles.introTitle, { fontFamily: fontFamily.bold }]}>
              What would you like to add?
            </Text>
            <Text style={[styles.introDescription, { fontFamily: fontFamily.regular }]}>
              Choose the type of listing you want to create and reach the BuyNaBay community
            </Text>
          </View>

          {/* Options List */}
          <View style={styles.optionsContainer}>
            <Animated.View style={{ transform: [{ scale: scaleProduct }] }}>
              <TouchableOpacity
                style={styles.optionCard}
                onPress={() => navigation.navigate('AddProductScreen')}
                onPressIn={() => handlePressIn(scaleProduct)}
                onPressOut={() => handlePressOut(scaleProduct)}
                activeOpacity={1}
              >
                <View style={[styles.optionIconWrapper, { backgroundColor: `${theme.accent}15` }]}>
                  <Ionicons name="pricetag" size={28} color={theme.accent} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={[styles.optionTitle, { fontFamily: fontFamily.bold }]}>
                    Sell a Product
                  </Text>
                  <Text style={[styles.optionDescription, { fontFamily: fontFamily.regular }]}>
                    List items for sale and connect with interested buyers
                  </Text>
                </View>
                <View style={styles.arrowContainer}>
                  <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                </View>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={{ transform: [{ scale: scaleRental }] }}>
              <TouchableOpacity
                style={styles.optionCard}
                onPress={() => navigation.navigate('AddRentalScreen')}
                onPressIn={() => handlePressIn(scaleRental)}
                onPressOut={() => handlePressOut(scaleRental)}
                activeOpacity={1}
              >
                <View style={[styles.optionIconWrapper, { backgroundColor: `${theme.accent}15` }]}>
                  <Ionicons name="time" size={28} color={theme.accent} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={[styles.optionTitle, { fontFamily: fontFamily.bold }]}>
                    List for Rent
                  </Text>
                  <Text style={[styles.optionDescription, { fontFamily: fontFamily.regular }]}>
                    Offer items or spaces for temporary use and earn income
                  </Text>
                </View>
                <View style={styles.arrowContainer}>
                  <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                </View>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={{ transform: [{ scale: scaleLostItem }] }}>
              <TouchableOpacity
                style={styles.optionCard}
                onPress={() => navigation.navigate('AddLostItem')}
                onPressIn={() => handlePressIn(scaleLostItem)}
                onPressOut={() => handlePressOut(scaleLostItem)}
                activeOpacity={1}
              >
                <View style={[styles.optionIconWrapper, { backgroundColor: `${theme.accent}15` }]}>
                  <Ionicons name="search" size={28} color={theme.accent} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={[styles.optionTitle, { fontFamily: fontFamily.bold }]}>
                    Report Lost Item
                  </Text>
                  <Text style={[styles.optionDescription, { fontFamily: fontFamily.regular }]}>
                    Help reunite lost items with their owners
                  </Text>
                </View>
                <View style={styles.arrowContainer}>
                  <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                </View>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Info Banner */}
          <Animated.View
            style={[
              styles.infoBanner,
              { opacity: fadeAnim }
            ]}
          >
            <View style={styles.infoBannerIconContainer}>
              <Ionicons name="information-circle" size={20} color={theme.accent} />
            </View>
            <Text style={[styles.infoBannerText, { fontFamily: fontFamily.medium }]}>
              All listings are visible to verified BuyNaBay users in your area
            </Text>
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme, insets) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  headerContainer: {
    paddingTop: insets.top + 10,
    paddingHorizontal: 20,
    paddingBottom: 16,
    zIndex: 1,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
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
    gap: 15
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  notificationButton: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  introCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.borderColor || theme.border,
    shadowColor: theme.shadowColor || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  introIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${theme.accent}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 20,
    color: theme.text,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  introDescription: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  optionCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.borderColor || theme.border,
    shadowColor: theme.shadowColor || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  optionIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    color: theme.text,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  optionDescription: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
  },
  arrowContainer: {
    marginLeft: 8,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.borderColor || theme.border,
    shadowColor: theme.shadowColor || '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  infoBannerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${theme.accent}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
  },
});