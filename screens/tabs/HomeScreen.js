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
  const [activeView, setActiveView] = useState('products'); // 'products' or 'rentals'

  const [userProfileImage, setUserProfileImage] = useState(null);
  // Automatically detect system theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;

  // Get current theme colors based on system settings
  const theme = isDarkMode ? darkTheme : lightTheme;

  // Get safe area insets for better positioning
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
  // Initial animations
  useEffect(() => {
    Animated.timing(headerSlideAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);
  
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
      {/* Background gradient effect */}
      <View style={styles.backgroundGradient} />

      {/* Branded logo - upper left */}
      <View style={styles.brandedLogoContainer}>
        <Image
          source={require('../../assets/images/OfficialBuyNaBay.png')}
          style={styles.brandedLogoImage}
          resizeMode="contain"
        />
        <Text style={styles.brandedLogoText}>BuyNaBay</Text>
      </View>

      {/* Action buttons - upper right */}
      <View style={styles.headerActionsContainer}>
        {/* Notifications Button */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Notifications')}
          style={[styles.actionButton, styles.notificationButton]}
          activeOpacity={0.85}
        >
          <Ionicons name="notifications-outline" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate("ProfileScreen")}>
          <Image
            source={userProfileImage ? { uri: userProfileImage } : require("../../assets/images/OfficialBuyNaBay.png")}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: theme.borderColor
            }}
          />
        </TouchableOpacity>
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
      <View style={styles.searchContainer}>
        <Icon name="search" size={18} color={theme.inputIcon} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor={theme.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity 
            onPress={() => setSearchQuery('')} 
            style={styles.clearButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={20} color={theme.inputIcon} />
          </TouchableOpacity>
        )}
      </View>

      {/* Segmented Control */}
      <View style={styles.segmentedControlContainer}>
        <TouchableOpacity
          style={[styles.segmentButton, activeView === 'products' && styles.segmentActive]}
          onPress={() => setActiveView('products')}
        >
          <Ionicons name="cube-outline" size={20} color={activeView === 'products' ? '#fff' : theme.text} />
          <Text style={[styles.segmentText, activeView === 'products' && styles.segmentTextActive]}>Products</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentButton, activeView === 'rentals' && styles.segmentActive]}
          onPress={() => setActiveView('rentals')}
        >
          <Ionicons name="home-outline" size={20} color={activeView === 'rentals' ? '#fff' : theme.text} />
          <Text style={[styles.segmentText, activeView === 'rentals' && styles.segmentTextActive]}>Rentals</Text>
        </TouchableOpacity>
      </View>
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
          <ProductScreen navigation={navigation} theme={theme} searchQuery={searchQuery} isVisible={activeView === 'products'} />
        ) : (
          <RentalScreen navigation={navigation} theme={theme} searchQuery={searchQuery} isVisible={activeView === 'rentals'} />
        )}
      </SafeAreaView>
    </>
  );
}

// Dark theme colors
const darkTheme = {
  background: '#0f0f2e',
  gradientBackground: '#1b1b41',
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

// Light theme colors
const lightTheme = {
  background: '#f5f7fa',
  gradientBackground: '#e8ecf1',
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
      height: height * 0.4, // Use a percentage of the screen height
      backgroundColor: theme.gradientBackground,
      borderBottomLeftRadius: 30,
      borderBottomRightRadius: 30,
      zIndex: 0,
    },
    headerContainer: {
      paddingHorizontal: Math.max(width * 0.05, 20),
      paddingTop: 20,
      paddingBottom: 20,
      zIndex: 1,
    },
    brandedLogoContainer: {
      position: 'absolute',
      top: 20,
      left: Math.max(width * 0.04, 16),
      flexDirection: 'row',
      alignItems: 'center',
      zIndex: 10,
    },
    brandedLogoImage: {
      width: 32,
      height: 32,
      marginRight: 8,
    },
    brandedLogoText: {
      fontSize: 18,
      fontWeight: Platform.OS === 'android' ? '900' : '800',
      color: theme.accentSecondary,
      letterSpacing: -0.5,
    },
    headerActionsContainer: {
      position: 'absolute',
      top: 20,
      right: Math.max(width * 0.04, 16),
      flexDirection: 'row',
      alignItems: 'center', // Changed
      gap: 12,
      zIndex: 10,
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
          shadowOpacity: 0.2,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    notificationButton: {
      backgroundColor: theme.notificationColor,
    },
    logoutButton: {
      backgroundColor: theme.logoutColor,
    },
    welcomeSection: {
      marginTop: 60,
      marginBottom: 24,
    },
    welcomeText: {
      fontSize: 16,
      color: theme.textSecondary,
      fontWeight: Platform.OS === 'android' ? '500' : '400',
      marginBottom: 4,
    },
    userName: {
      fontSize: Math.min(width * 0.075, 30),
      color: theme.text,
      fontWeight: Platform.OS === 'android' ? '900' : '800',
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: Platform.OS === 'android' ? '500' : '400',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.inputBackground,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 4 : 2,
      marginBottom: 20,
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
          elevation: 2,
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
      borderRadius: 12,
      padding: 4,
      marginHorizontal: Math.max(width * 0.05, 20),
      marginBottom: 16,
    },
    segmentButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    segmentActive: {
      backgroundColor: theme.accent,
    },
    segmentText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    segmentTextActive: {
      color: '#fff',
    },
  });