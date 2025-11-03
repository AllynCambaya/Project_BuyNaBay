import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';
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
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;
  const searchScaleAnim = useRef(new Animated.Value(1)).current;
  const segmentSlideAnim = useRef(new Animated.Value(0)).current;

  const theme = isDarkMode ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (currentUser?.email) {
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
  }, [currentUser]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerSlideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(segmentSlideAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    Animated.spring(searchScaleAnim, {
      toValue: searchFocused ? 1.02 : 1,
      tension: 100,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, [searchFocused]);

  const handleSearchFocus = () => setSearchFocused(true);
  const handleSearchBlur = () => setSearchFocused(false);

  const handleSegmentChange = (view) => {
    Animated.sequence([
      Animated.timing(segmentSlideAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(segmentSlideAnim, {
        toValue: 1,
        tension: 100,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
    setActiveView(view);
  };

  const styles = createStyles(theme, insets);

  const renderHeader = () => (
    <Animated.View
      style={[
        styles.headerContainer,
        {
          transform: [{ translateY: headerSlideAnim }]
        },
      ]}
    >
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
          <Text style={styles.brandedLogoText}>BuyNaBay</Text>
        </View>

        <View style={styles.headerActionsContainer}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            style={[styles.actionButton, styles.notificationButton]}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={22} color="#fff" />
            <View style={styles.notificationBadge} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => navigation.navigate("ProfileScreen")}
            activeOpacity={0.8}
          >
            <View style={styles.profileImageWrapper}>
              <Image
                source={userProfileImage ? { uri: userProfileImage } : require("../../assets/images/OfficialBuyNaBay.png")}
                style={styles.profileImage}
              />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Welcome Section */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>Welcome back,</Text>
        <Text style={styles.userName}>
          {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Shopper'}
        </Text>
        <Text style={styles.subtitle}>Discover amazing deals today</Text>
      </View>

      {/* Search Bar */}
      <Animated.View 
        style={[
          styles.searchContainer,
          {
            transform: [{ scale: searchScaleAnim }]
          }
        ]}
      >
        <View style={styles.searchInputWrapper}>
          <Icon name="search" size={18} color={theme.inputIcon} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search ${activeView === 'products' ? 'products' : 'rentals'}...`}
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
              <Ionicons name="close-circle" size={20} color={theme.inputIcon} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Segmented Control */}
      <Animated.View 
        style={[
          styles.segmentedControlContainer,
          {
            transform: [{ scale: segmentSlideAnim }]
          }
        ]}
      >
        <TouchableOpacity
          style={[styles.segmentButton, activeView === 'products' && styles.segmentActive]}
          onPress={() => handleSegmentChange('products')}
          activeOpacity={0.8}
        >
          <View style={styles.segmentContent}>
            <Ionicons 
              name={activeView === 'products' ? 'cube' : 'cube-outline'} 
              size={20} 
              color={activeView === 'products' ? '#fff' : theme.text} 
            />
            <Text style={[styles.segmentText, activeView === 'products' && styles.segmentTextActive]}>
              Products
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentButton, activeView === 'rentals' && styles.segmentActive]}
          onPress={() => handleSegmentChange('rentals')}
          activeOpacity={0.8}
        >
          <View style={styles.segmentContent}>
            <Ionicons 
              name={activeView === 'rentals' ? 'home' : 'home-outline'} 
              size={20} 
              color={activeView === 'rentals' ? '#fff' : theme.text} 
            />
            <Text style={[styles.segmentText, activeView === 'rentals' && styles.segmentTextActive]}>
              Rentals
            </Text>
          </View>
        </TouchableOpacity>
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
      <SafeAreaView style={styles.safeArea}>
        {renderHeader()}
        {activeView === 'products' ? (
          <ProductScreen 
            navigation={navigation} 
            theme={theme} 
            searchQuery={searchQuery} 
            isVisible={activeView === 'products'} 
          />
        ) : (
          <RentalScreen 
            navigation={navigation} 
            theme={theme} 
            searchQuery={searchQuery} 
            isVisible={activeView === 'rentals'} 
          />
        )}
      </SafeAreaView>
    </>
  );
}

const darkTheme = {
  background: '#0f0f2e',
  gradientBackground: '#1b1b41',
  gradientStart: '#1b1b41',
  gradientEnd: '#0f0f2e',
  text: '#fff',
  textSecondary: '#bbb',
  textTertiary: '#ccc',
  cardBackground: '#1e1e3f',
  cardBackgroundAlt: '#252550',
  inputBackground: '#252550',
  inputIcon: '#888',
  placeholder: '#666',
  accent: '#FDAD00',
  accentSecondary: '#e8ecf1',
  notificationColor: '#4CAF50',
  logoutColor: '#d32f2f',
  shadowColor: '#000',
  borderColor: '#2a2a4a',
  modalBackground: '#1e1e3f',
  overlayBackground: 'rgba(0, 0, 0, 0.7)',
};

const lightTheme = {
  background: '#f5f7fa',
  gradientBackground: '#e8ecf1',
  gradientStart: '#e8ecf1',
  gradientEnd: '#f5f7fa',
  text: '#1a1a2e',
  textSecondary: '#4a4a6a',
  textTertiary: '#2c2c44',
  cardBackground: '#ffffff',
  cardBackgroundAlt: '#f9f9fc',
  inputBackground: '#ffffff',
  inputIcon: '#7a7a9a',
  placeholder: '#9a9ab0',
  accent: '#f39c12',
  accentSecondary: '#e67e22',
  notificationColor: '#27ae60',
  logoutColor: '#e74c3c',
  shadowColor: '#000',
  borderColor: '#e0e0ea',
  modalBackground: '#ffffff',
  overlayBackground: 'rgba(0, 0, 0, 0.5)',
};

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
      height: height * 0.45,
      backgroundColor: theme.gradientBackground,
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
      overflow: 'hidden',
    },
    gradientOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.1,
    },
    headerContainer: {
      paddingHorizontal: Math.max(width * 0.05, 20),
      paddingTop: 16,
      paddingBottom: 24,
      zIndex: 1,
    },
    topNavBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 28,
      zIndex: 10,
    },
    brandedLogoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    logoWrapper: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 10,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
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
      fontSize: 20,
      fontWeight: Platform.OS === 'android' ? '900' : '800',
      color: theme.accentSecondary,
      letterSpacing: -0.5,
    },
    headerActionsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    actionButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
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
    notificationButton: {
      backgroundColor: theme.notificationColor,
      position: 'relative',
    },
    notificationBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#fff',
      borderWidth: 1.5,
      borderColor: theme.notificationColor,
    },
    profileImageWrapper: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 2,
      borderColor: theme.accent,
      padding: 2,
      backgroundColor: theme.cardBackground,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 6,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    profileImage: {
      width: '100%',
      height: '100%',
      borderRadius: 19,
    },
    welcomeSection: {
      marginBottom: 24,
    },
    welcomeText: {
      fontSize: 15,
      color: theme.textSecondary,
      fontWeight: Platform.OS === 'android' ? '500' : '400',
      marginBottom: 4,
      letterSpacing: 0.3,
    },
    userName: {
      fontSize: Math.min(width * 0.08, 32),
      color: theme.text,
      fontWeight: Platform.OS === 'android' ? '900' : '800',
      marginBottom: 6,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: Platform.OS === 'android' ? '500' : '400',
      opacity: 0.9,
    },
    searchContainer: {
      marginBottom: 20,
    },
    searchInputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.inputBackground,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: Platform.OS === 'ios' ? 4 : 2,
      borderWidth: 1.5,
      borderColor: theme.borderColor,
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.12,
          shadowRadius: 6,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    searchIcon: {
      marginRight: 12,
    },
    searchInput: {
      flex: 1,
      paddingVertical: Platform.OS === 'ios' ? 14 : 12,
      fontSize: 15,
      color: theme.text,
      fontWeight: Platform.OS === 'android' ? '500' : '400',
    },
    clearButton: {
      padding: 4,
    },
    segmentedControlContainer: {
      flexDirection: 'row',
      backgroundColor: theme.cardBackground,
      borderRadius: 14,
      padding: 5,
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    segmentButton: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    segmentActive: {
      backgroundColor: theme.accent,
      ...Platform.select({
        ios: {
          shadowColor: theme.accent,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    segmentContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    segmentText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.textSecondary,
      letterSpacing: 0.2,
    },
    segmentTextActive: {
      color: '#fff',
      fontWeight: '700',
    },
  });