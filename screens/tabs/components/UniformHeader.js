// screens/tabs/components/UniformHeader.js
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../../../firebase/firebaseConfig';
import { supabase } from '../../../supabase/supabaseClient';
import { darkTheme, lightTheme } from '../../../theme/theme';
import { fontFamily } from '../../../theme/typography';

const { width } = Dimensions.get('window');

export default function UniformHeader({ 
  title, 
  subtitle, 
  navigation,
  showProfile = true,
  showNotifications = false,
  onNotificationPress,
  profileImage: propProfileImage
}) {
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme, insets);

  const [userProfileImage, setUserProfileImage] = React.useState(null);
  const currentUser = auth.currentUser;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-50)).current;
  const notificationPulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fetch user profile image if not provided
    const fetchUserProfile = async () => {
      if (currentUser?.email && !propProfileImage) {
        const { data, error } = await supabase
          .from('users')
          .select('profile_photo')
          .eq('email', currentUser.email)
          .single();
        if (!error && data) {
          setUserProfileImage(data.profile_photo);
        }
      }
    };
    fetchUserProfile();
  }, [currentUser, propProfileImage]);

  useEffect(() => {
    // Animate header entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();

    // Notification pulse animation
    if (showNotifications) {
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
    }
  }, [showNotifications]);

  const displayProfileImage = propProfileImage || userProfileImage;

  return (
    <Animated.View
      style={[
        styles.headerContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Background Gradient */}
      <View style={styles.backgroundGradient}>
        <View style={styles.gradientOverlay} />
      </View>

      {/* Top Navigation Bar */}
      <View style={styles.topNavBar}>
        <View style={styles.brandedLogoContainer}>
          <View style={styles.logoWrapper}>
            <Image
              source={require('../../../assets/images/OfficialBuyNaBay.png')}
              style={styles.brandedLogoImage}
              resizeMode="contain"
            />
          </View>
          <View>
            <Text style={[styles.brandedLogoText, { fontFamily: fontFamily.extraBold }]}>
              BuyNaBay
            </Text>
            <Text style={[styles.brandedSubtext, { fontFamily: fontFamily.medium }]}>
              {subtitle || 'Campus Marketplace'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActionsContainer}>
          {showNotifications && (
            <TouchableOpacity
              onPress={onNotificationPress || (() => navigation?.navigate('Notifications'))}
              style={[styles.actionButton, styles.notificationButton]}
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
          )}

          {showProfile && (
            <TouchableOpacity
              onPress={() => navigation?.navigate('ProfileScreen')}
              activeOpacity={0.8}
            >
              <View style={styles.profileImageWrapper}>
                <Image
                  source={
                    displayProfileImage
                      ? { uri: displayProfileImage }
                      : require('../../../assets/images/OfficialBuyNaBay.png')
                  }
                  style={styles.profileImage}
                />
                <View style={styles.onlineIndicator} />
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Title Section (if title is provided) */}
      {title && (
        <View style={styles.titleSection}>
          <Text style={[styles.headerTitle, { fontFamily: fontFamily.bold }]}>
            {title}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const createStyles = (theme, insets) =>
  StyleSheet.create({
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
      alignItems: 'center',
      marginBottom: 12,
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
    notificationButton: {
      backgroundColor: theme.notificationColor || '#4CAF50',
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
    titleSection: {
      marginTop: 8,
    },
    headerTitle: {
      fontSize: 24,
      color: theme.text,
      letterSpacing: -0.5,
    },
  });