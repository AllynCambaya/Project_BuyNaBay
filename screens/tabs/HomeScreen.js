import { FontAwesome as Icon, Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';
import { darkTheme, lightTheme } from '../../theme/theme';
import { fontFamily } from '../../theme/typography';
import LostAndFoundScreen from './LostAndFoundScreen';
import ProductScreen from './ProductScreen';
import RentalScreen from './RentalScreen';

const { width, height } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const currentUser = auth.currentUser;
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState('products');
  const [userProfileImage, setUserProfileImage] = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);
  
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();

  // Animation refs
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;
  const searchScaleAnim = useRef(new Animated.Value(1)).current;
  const segmentSlideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const notificationPulseAnim = useRef(new Animated.Value(1)).current;

  // Fetch user profile
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

  // Initial entrance animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerSlideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(segmentSlideAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // Subtle notification pulse animation
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

  // Search focus animation
  useEffect(() => {
    Animated.spring(searchScaleAnim, {
      toValue: searchFocused ? 1.02 : 1,
      tension: 100,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, [searchFocused]);

  const handleSegmentChange = (view) => {
    Animated.sequence([
      Animated.timing(segmentSlideAnim, {
        toValue: 0.97,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(segmentSlideAnim, {
        toValue: 1,
        tension: 120,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
    setActiveView(view);
  };

  const handleSearchFocus = () => setSearchFocused(true);
  const handleSearchBlur = () => setSearchFocused(false);

  const styles = createStyles(theme, insets);

  const getSegmentLabel = (tab) => {
    if (tab === 'lostandfound') return 'Lost & Found';
    return tab.charAt(0).toUpperCase() + tab.slice(1);
  };

  const getSegmentIcon = (tab, isActive) => {
    if (tab === 'products') return isActive ? 'cube' : 'cube-outline';
    if (tab === 'rentals') return isActive ? 'home' : 'home-outline';
    return isActive ? 'search' : 'search-outline';
  };

  // Get adaptive notification button color
  const getNotificationButtonColor = () => {
    return isDarkMode ? theme.notificationColor : '#4CAF50';
  };

  const renderHeader = () => (
    <Animated.View
      style={[
        styles.headerContainer,
        {
          transform: [{ translateY: headerSlideAnim }],
          opacity: fadeAnim,
        },
      ]}
    >
      {/* Gradient Background */}
      <View style={styles.backgroundGradient}>
        <View style={styles.gradientOverlay} />
      </View>

      {/* Top Navigation Bar */}
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
              Campus Marketplace
            </Text>
          </View>
        </View>

        <View style={styles.headerActionsContainer}>
          {/* Enhanced Notification Button with Visibility */}
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

      {/* Search Bar */}
      <Animated.View
        style={[
          styles.searchContainer,
          {
            transform: [{ scale: searchScaleAnim }],
          },
        ]}
      >
        <View style={styles.searchInputWrapper}>
          <Icon name="search" size={16} color={theme.inputIcon} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { fontFamily: fontFamily.medium }]}
            placeholder={`Search ${getSegmentLabel(activeView).toLowerCase()}...`}
            placeholderTextColor={theme.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={18} color={theme.inputIcon} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Segmented Control */}
      <Animated.View
        style={[
          styles.segmentedControlContainer,
          {
            transform: [{ scale: segmentSlideAnim }],
          },
        ]}
      >
        {['products', 'rentals', 'lostandfound'].map((tab) => {
          const isActive = activeView === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.segmentButton, isActive && styles.segmentActive]}
              onPress={() => handleSegmentChange(tab)}
              activeOpacity={0.8}
            >
              <View style={styles.segmentContent}>
                <Ionicons
                  name={getSegmentIcon(tab, isActive)}
                  size={16}
                  color={isActive ? '#fff' : theme.text}
                />
                <Text 
                  style={[
                    styles.segmentText, 
                    isActive && styles.segmentTextActive,
                    { fontFamily: isActive ? fontFamily.bold : fontFamily.semiBold }
                  ]}
                >
                  {getSegmentLabel(tab)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    </Animated.View>
  );

  return (
    <>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
        translucent={false}
      />
      <View style={styles.safeArea}>
        {renderHeader()}
        <View style={styles.contentContainer}>
          {activeView === 'products' && (
            <ProductScreen
              navigation={navigation}
              theme={theme}
              searchQuery={searchQuery}
              isVisible={activeView === 'products'}
            />
          )}
          {activeView === 'rentals' && (
            <RentalScreen
              navigation={navigation}
              theme={theme}
              searchQuery={searchQuery}
              isVisible={activeView === 'rentals'}
            />
          )}
          {activeView === 'lostandfound' && (
            <LostAndFoundScreen 
              navigation={navigation} 
              showHeader={false}
            />
          )}
        </View>
      </View>
    </>
  );
}

const createStyles = (theme, insets) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
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
    headerContainer: {
      paddingHorizontal: 20,
      paddingTop: insets.top + 12,
      paddingBottom: 16,
      zIndex: 1,
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
      ...Platform.select({
        ios: {
          shadowColor: theme.accent,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
        },
        android: {
          elevation: 2,
        },
      }),
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
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
        },
        android: {
          elevation: 5,
        },
      }),
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
      ...Platform.select({
        ios: {
          shadowColor: '#FF3B30',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.5,
          shadowRadius: 3,
        },
        android: {
          elevation: 3,
        },
      }),
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
      ...Platform.select({
        ios: {
          shadowColor: theme.accent,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        },
        android: {
          elevation: 3,
        },
      }),
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
    searchContainer: {
      marginBottom: 12,
    },
    searchInputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.inputBackground,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 10 : 9,
      borderWidth: 1.5,
      borderColor: theme.borderColor,
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    searchIcon: {
      marginRight: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
    },
    clearButton: {
      padding: 4,
    },
    segmentedControlContainer: {
      flexDirection: 'row',
      backgroundColor: theme.cardBackground,
      borderRadius: 12,
      padding: 4,
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    segmentButton: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 9,
      justifyContent: 'center',
      alignItems: 'center',
    },
    segmentActive: {
      backgroundColor: theme.accent,
      ...Platform.select({
        ios: {
          shadowColor: theme.accent,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    segmentContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    segmentText: {
      fontSize: 12,
      color: theme.textSecondary,
      letterSpacing: 0.2,
    },
    segmentTextActive: {
      color: '#fff',
    },
    contentContainer: {
      flex: 1,
    },
  });