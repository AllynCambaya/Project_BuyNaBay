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
import LostAndFoundScreen from './LostAndFoundScreen';
import ProductScreen from './ProductScreen';
import RentalScreen from './RentalScreen';

const { width, height } = Dimensions.get('window');

const HEADER_MAX_HEIGHT = height * 0.18;
const HEADER_MIN_HEIGHT = Platform.OS === 'ios' ? 80 : 90;

export default function HomeScreen({ navigation }) {
  const currentUser = auth.currentUser;
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState('products');
  const [userProfileImage, setUserProfileImage] = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const searchScaleAnim = useRef(new Animated.Value(1)).current;
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();

  // Fetch profile
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

  const handleSegmentChange = (view) => setActiveView(view);
  const handleSearchFocus = () => setSearchFocused(true);
  const handleSearchBlur = () => setSearchFocused(false);

  const styles = createStyles(theme, insets);

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Top Bar */}
      <View style={styles.topNavBar}>
        <View style={styles.brandedLogoContainer}>
          <Image
            source={require('../../assets/images/OfficialBuyNaBay.png')}
            style={styles.brandedLogoImage}
            resizeMode="contain"
          />
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
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View
        style={styles.searchContainer}
      >
        <View style={styles.searchInputWrapper}>
          <Icon name="search" size={18} color={theme.inputIcon} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search in ${activeView.charAt(0).toUpperCase() + activeView.slice(1)}...`}
            placeholderTextColor={theme.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={theme.inputIcon} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Segments */}
      <View style={styles.segmentedControlContainer}>
        {['products', 'rentals', 'lostandfound'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.segmentButton, activeView === tab && styles.segmentActive]}
            onPress={() => handleSegmentChange(tab)}
            activeOpacity={0.8}
          >
            <View style={styles.segmentContent}>
              <Ionicons
                name={
                  tab === 'products'
                    ? activeView === tab
                      ? 'cube'
                      : 'cube-outline'
                    : tab === 'rentals'
                    ? activeView === tab
                      ? 'home'
                      : 'home-outline'
                    : activeView === tab
                    ? 'search'
                    : 'search-outline'
                }
                size={20}
                color={activeView === tab ? '#fff' : theme.text}
              />
              <Text
                style={[styles.segmentText, activeView === tab && styles.segmentTextActive]}
              >
                {tab === 'lostandfound'
                  ? 'Lost & Found'
                  : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
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
        <View style={{ flex: 1 }}>
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
            <LostAndFoundScreen navigation={navigation} showHeader={false} />
          )}
        </View>
      </View>
    </>
  );
}

// 🎨 Styles
const createStyles = (theme, insets) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    headerContainer: {
      zIndex: 100,
      backgroundColor: theme.gradientBackground,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      overflow: 'hidden',
    },
    topNavBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: insets.top + 10,
    },
    brandedLogoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    brandedLogoImage: {
      width: 32,
      height: 32,
    },
    brandedLogoText: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.accent,
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
    },
    notificationButton: {
      backgroundColor: theme.notificationColor,
    },
    notificationBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#fff',
    },
    profileImageWrapper: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: theme.accent,
      overflow: 'hidden',
    },
    profileImage: {
      width: '100%',
      height: '100%',
      borderRadius: 20,
    },
    searchContainer: {
      marginTop: 10,
      paddingHorizontal: 20,
    },
    searchInputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.inputBackground,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: Platform.OS === 'ios' ? 6 : 4,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: theme.text,
    },
    clearButton: {
      padding: 4,
    },
    segmentedControlContainer: {
      flexDirection: 'row',
      marginTop: 15,
      marginHorizontal: 20,
      backgroundColor: theme.cardBackground,
      borderRadius: 12,
      padding: 4,
    },
    segmentButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 10,
    },
    segmentActive: {
      backgroundColor: theme.accent,
    },
    segmentContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    segmentText: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: '600',
    },
    segmentTextActive: {
      color: '#fff',
      fontWeight: '700',
    },
  });
