// screens/tabs/ProfileScreen.js
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { signOut } from 'firebase/auth';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';
import { darkTheme, lightTheme } from '../../theme/theme';
import { fontFamily } from '../../theme/typography';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const SALE_CATEGORIES = ['All', 'Electronics', 'Books', 'Clothes', 'Food', 'Beauty and Personal Care', 'Toys and Games', 'Automotive', 'Sports', 'Others'];
const RENTAL_CATEGORIES = ['All', 'Electronics', 'Tools', 'Party&Events', 'Sports&outdoors', 'Apparel', 'Vehicles', 'Other'];

export default function ProfileScreen({ navigation, route }) {
  const loggedInUser = auth.currentUser;
  const viewingUserId = route.params?.userId;
  const isMyProfile = !viewingUserId || viewingUserId === loggedInUser.email;
  const profileUserEmail = isMyProfile ? loggedInUser.email : viewingUserId;

  // Profile State
  const [name, setName] = useState(loggedInUser?.displayName || '');
  const [email, setEmail] = useState(loggedInUser?.email || '');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [studentId, setStudentId] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [joinedDate, setJoinedDate] = useState('');
  
  // Products State
  const [saleProducts, setSaleProducts] = useState([]);
  const [rentalProducts, setRentalProducts] = useState([]);
  const [activeTab, setActiveTab] = useState('sale');
  const [refreshing, setRefreshing] = useState(false);
  
  // UI State
  const [selectedImages, setSelectedImages] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  // Animations
  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Header opacity based on scroll
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

  // Image scale animation
  const imageScale = scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.2, 1],
    extrapolate: 'clamp',
  });

  // Computed Stats
  const stats = useMemo(() => {
    const currentProducts = activeTab === 'sale' ? saleProducts : rentalProducts;
    const totalItems = currentProducts.length;
    const activeItems = currentProducts.filter(p => (p.is_visible ?? true) && p.quantity > 0).length;
    const totalValue = currentProducts.reduce((sum, p) => sum + (parseFloat(p.price) * p.quantity || 0), 0);
    
    return { totalItems, activeItems, totalValue };
  }, [saleProducts, rentalProducts, activeTab]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    const products = activeTab === 'sale' ? saleProducts : rentalProducts;
    return products.filter(product => {
      const matchesSearch = product.product_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [saleProducts, rentalProducts, activeTab, searchQuery, selectedCategory]);

  // Fetch Products
  const fetchMyProducts = useCallback(async () => {
    if (!profileUserEmail) return;
    
    try {
      const { data: saleData, error: saleError } = await supabase
        .from('products')
        .select('*')
        .eq('email', profileUserEmail)
        .order('created_at', { ascending: false });

      if (saleError) throw saleError;
      setSaleProducts(saleData || []);
      
      const { data: rentalData, error: rentalError } = await supabase
        .from('rental_items')
        .select('*')
        .eq('owner_email', profileUserEmail)
        .order('id', { ascending: false });

      if (rentalError) throw rentalError;
      
      const transformedRentalData = rentalData?.map(item => ({
        id: item.id,
        product_name: item.item_name,
        description: item.description,
        product_image_url: item.rental_item_image,
        image: item.rental_item_image,
        quantity: item.quantity,
        price: item.price,
        category: item.category,
        condition: item.condition,
        rental_duration: item.rental_duration,
        is_visible: item.is_visible ?? true,
        owner_email: item.owner_email,
      })) || [];
      
      setRentalProducts(transformedRentalData);
    } catch (error) {
      console.error('Error fetching products:', error);
      Alert.alert('Error', 'Failed to load products');
    }
  }, [profileUserEmail]);

  // Fetch Profile
  const fetchProfile = useCallback(async () => {
    if (!profileUserEmail) return;

    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('name, phone_number, student_id, profile_photo, created_at')
        .eq('email', profileUserEmail)
        .maybeSingle();

      if (error) throw error;

      setEmail(profileUserEmail);
      setName(data?.name || '');
      setPhoneNumber(data?.phone_number || '');
      setStudentId(data?.student_id || '');
      setProfilePhoto(data?.profile_photo || null);

      if (data?.created_at) {
        const date = new Date(data.created_at);
        setJoinedDate(date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
      }

      const { data: verificationData } = await supabase
        .from('verifications')
        .select('status')
        .eq('email', profileUserEmail)
        .single();

      setVerified(verificationData?.status === 'approved');
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setProfileLoading(false);
    }
  }, [profileUserEmail]);

  // Toggle Visibility
  const handleToggleVisibility = async (product) => {
    try {
      const tableName = activeTab === 'sale' ? 'products' : 'rental_items';
      const currentVisibility = product.is_visible ?? true;
      
      const { error } = await supabase
        .from(tableName)
        .update({ is_visible: !currentVisibility })
        .eq('id', product.id);

      if (error) throw error;
      
      await fetchMyProducts();
      Alert.alert('Success', `Item is now ${!currentVisibility ? 'visible' : 'hidden'}`);
    } catch (error) {
      console.error('Error updating visibility:', error);
      Alert.alert('Error', 'Failed to update visibility');
    }
  };

  // Update Quantity
  const handleQuantityChange = async (product, change) => {
    const newQuantity = Math.max(0, product.quantity + change);
    
    try {
      const tableName = activeTab === 'sale' ? 'products' : 'rental_items';
      const { error } = await supabase
        .from(tableName)
        .update({ 
          quantity: newQuantity,
          is_visible: newQuantity > 0 && product.is_visible
        })
        .eq('id', product.id);

      if (error) throw error;
      await fetchMyProducts();
    } catch (error) {
      console.error('Error updating quantity:', error);
      Alert.alert('Error', 'Failed to update quantity');
    }
  };

  // Image Picker
  const handleImagePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      const imageUri = result.assets[0].uri;
      const response = await fetch(imageUri);
      const arrayBuffer = await response.arrayBuffer();
      const fileExt = imageUri.split('.').pop();
      const fileName = `${loggedInUser.uid}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('profile-avatars')
        .upload(fileName, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });
        
      if (uploadError) {
        Alert.alert('Upload Error', uploadError.message);
        return;
      }
      
      const { data } = supabase.storage.from('profile-avatars').getPublicUrl(fileName);
      const publicUrl = data.publicUrl;
      
      await supabase.from('users').update({ profile_photo: publicUrl }).eq('id', loggedInUser.uid);
      setProfilePhoto(publicUrl);
      Alert.alert('Success', 'Profile photo updated!');
    }
  };

  // Logout
  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              navigation.replace('Login');
            } catch (error) {
              Alert.alert('Logout Error', error.message);
            }
          },
        },
      ]
    );
  };

  // Refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchProfile(), fetchMyProducts()]);
    setRefreshing(false);
  }, [fetchProfile, fetchMyProducts]);

  // Initialize animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
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
  }, []);

  // Fetch data on mount
  useEffect(() => {
    fetchProfile();
    fetchMyProducts();
  }, [fetchProfile, fetchMyProducts]);

  // Subscribe to verification updates
  useEffect(() => {
    if (!profileUserEmail) return;

    const channel = supabase
      .channel(`verifications-${profileUserEmail}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'verifications', 
          filter: `email=eq.${profileUserEmail}` 
        },
        (payload) => {
          setVerified(payload.new?.status === 'approved');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileUserEmail]);

  const getAvatarSource = () => {
    if (profilePhoto) return { uri: profilePhoto };
    return {
      uri: supabase.storage
        .from('profile-avatars')
        .getPublicUrl('default-avatar.jpg').data.publicUrl,
    };
  };

  const parseImageUrl = (imageUrl) => {
    if (typeof imageUrl === 'string' && imageUrl.startsWith('[')) {
      try {
        const images = JSON.parse(imageUrl);
        return images[0];
      } catch (e) {
        return imageUrl;
      }
    }
    return imageUrl;
  };

  // Render Header
  const renderHeader = () => (
    <View>
      {/* Collapsible Top Bar */}
      <Animated.View 
        style={[
          styles.collapsibleHeader,
          {
            opacity: headerOpacity,
            transform: [{ translateY: headerTranslate }],
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        
        <View style={styles.logoContainer}>
          <View style={styles.logoIconWrapper}>
            <Image
              source={require('../../assets/images/OfficialBuyNaBay.png')}
              style={styles.logoIcon}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.logoText, { fontFamily: fontFamily.extraBold }]}>
            BuyNaBay
          </Text>
        </View>
        
        <View style={styles.headerSpacer} />
      </Animated.View>

      {/* Hero Section with Gradient */}
      <View style={styles.heroWrapper}>
        <LinearGradient
          colors={isDarkMode 
            ? ['#1F1D47', '#141332', theme.background] 
            : ['#FDAD00', '#FF9500', '#FF8000']
          }
          style={styles.heroGradient}
        >
          <Animated.View 
            style={[
              styles.heroContent,
              { 
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }, { translateY: slideAnim }]
              }
            ]}
          >
            {/* Avatar Section */}
            <TouchableOpacity 
              onPress={isMyProfile ? handleImagePick : undefined}
              disabled={!isMyProfile}
              activeOpacity={0.85}
              style={styles.avatarSection}
            >
              <View style={[styles.avatarRing, { borderColor: isDarkMode ? '#FDAD00' : '#FFFFFF' }]}>
                <Image source={getAvatarSource()} style={styles.avatarImage} />
                {isMyProfile && (
                  <View style={styles.editBadge}>
                    <LinearGradient
                      colors={['#FDAD00', '#FF9500']}
                      style={styles.editBadgeGradient}
                    >
                      <Ionicons name="camera" size={16} color="#fff" />
                    </LinearGradient>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            {/* Name & Verification */}
            <View style={styles.identityRow}>
              <Text style={[styles.displayName, { fontFamily: fontFamily.extraBold }]} numberOfLines={1}>
                {name || 'User'}
              </Text>
              {verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                </View>
              )}
            </View>

            {/* Joined Date */}
            {joinedDate && (
              <View style={styles.joinedBadge}>
                <Ionicons name="calendar-outline" size={14} color={isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.9)'} />
                <Text style={[styles.joinedText, { fontFamily: fontFamily.medium }]}>
                  Member since {joinedDate}
                </Text>
              </View>
            )}
          </Animated.View>
        </LinearGradient>

        {/* Wave Decoration */}
        <View style={styles.waveContainer}>
          <View style={[styles.wave, { backgroundColor: theme.background }]} />
        </View>
      </View>

      {/* Stats Dashboard */}
      {isMyProfile && (
        <Animated.View 
          style={[
            styles.statsContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          <View style={[styles.statCard, { backgroundColor: theme.cardBackground }]}>
            <View style={[styles.statIconCircle, { backgroundColor: isDarkMode ? 'rgba(253, 173, 0, 0.15)' : 'rgba(253, 173, 0, 0.1)' }]}>
              <Ionicons name="cube-outline" size={24} color={theme.accent} />
            </View>
            <Text style={[styles.statValue, { fontFamily: fontFamily.bold, color: theme.text }]}>{stats.totalItems}</Text>
            <Text style={[styles.statLabel, { fontFamily: fontFamily.medium, color: theme.textSecondary }]}>Total Items</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: theme.cardBackground }]}>
            <View style={[styles.statIconCircle, { backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.15)' : 'rgba(76, 175, 80, 0.1)' }]}>
              <Ionicons name="eye-outline" size={24} color="#4CAF50" />
            </View>
            <Text style={[styles.statValue, { fontFamily: fontFamily.bold, color: theme.text }]}>{stats.activeItems}</Text>
            <Text style={[styles.statLabel, { fontFamily: fontFamily.medium, color: theme.textSecondary }]}>Active</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: theme.cardBackground }]}>
            <View style={[styles.statIconCircle, { backgroundColor: isDarkMode ? 'rgba(253, 173, 0, 0.15)' : 'rgba(253, 173, 0, 0.1)' }]}>
              <Ionicons name="wallet-outline" size={24} color={theme.accent} />
            </View>
            <Text style={[styles.statValue, { fontFamily: fontFamily.bold, color: theme.text }]}>₱{stats.totalValue.toFixed(0)}</Text>
            <Text style={[styles.statLabel, { fontFamily: fontFamily.medium, color: theme.textSecondary }]}>Value</Text>
          </View>
        </Animated.View>
      )}

      {/* Contact Info Card */}
      <Animated.View 
        style={[
          styles.infoSection,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}
      >
        <Text style={[styles.sectionTitle, { fontFamily: fontFamily.bold }]}>Contact Information</Text>
        
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={[styles.iconCircle, { backgroundColor: `${theme.accent}15` }]}>
              <Ionicons name="mail" size={20} color={theme.accent} />
            </View>
            <View style={styles.infoTextBlock}>
              <Text style={[styles.infoLabel, { fontFamily: fontFamily.semiBold }]}>Email</Text>
              <Text style={[styles.infoText, { fontFamily: fontFamily.medium }]} numberOfLines={1}>{email || 'N/A'}</Text>
            </View>
          </View>

          {verified && (
            <>
              <View style={styles.dividerLine} />
              <View style={styles.infoRow}>
                <View style={[styles.iconCircle, { backgroundColor: `${theme.accent}15` }]}>
                  <Ionicons name="call" size={20} color={theme.accent} />
                </View>
                <View style={styles.infoTextBlock}>
                  <Text style={[styles.infoLabel, { fontFamily: fontFamily.semiBold }]}>Phone</Text>
                  <Text style={[styles.infoText, { fontFamily: fontFamily.medium }]}>{phoneNumber || 'Not set'}</Text>
                </View>
              </View>

              <View style={styles.dividerLine} />
              <View style={styles.infoRow}>
                <View style={[styles.iconCircle, { backgroundColor: `${theme.accent}15` }]}>
                  <Ionicons name="card" size={20} color={theme.accent} />
                </View>
                <View style={styles.infoTextBlock}>
                  <Text style={[styles.infoLabel, { fontFamily: fontFamily.semiBold }]}>Student ID</Text>
                  <Text style={[styles.infoText, { fontFamily: fontFamily.medium }]}>{studentId || 'Not set'}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Action Buttons */}
        {isMyProfile && (
          <View style={styles.actionRow}>
            {!verified && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => navigation.navigate('GetVerified')}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#4CAF50', '#45A049']}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="shield-checkmark" size={18} color="#fff" />
                  <Text style={[styles.buttonLabel, { fontFamily: fontFamily.bold }]}>Get Verified</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[styles.secondaryButton, !verified && styles.secondaryButtonFull]}
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <Ionicons name="log-out-outline" size={18} color="#FF6B6B" />
              <Text style={[styles.secondaryButtonLabel, { fontFamily: fontFamily.bold }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* Listings Header */}
      <View style={styles.listingsSection}>
        <View>
          <Text style={[styles.listingsTitle, { fontFamily: fontFamily.bold }]}>
            {isMyProfile ? 'My Listings' : `${name}'s Items`}
          </Text>
          <Text style={[styles.listingsCount, { fontFamily: fontFamily.medium }]}>
            {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'}
          </Text>
        </View>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabWrapper}>
        <View style={styles.tabSelector}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'sale' && styles.tabActive]}
            onPress={() => {
              setActiveTab('sale');
              setSelectedCategory('All');
              setSearchQuery('');
            }}
            activeOpacity={0.7}
          >
            {activeTab === 'sale' && (
              <LinearGradient
                colors={['#FDAD00', '#FF9500']}
                style={styles.tabGradient}
              />
            )}
            <Ionicons 
              name="pricetag" 
              size={16} 
              color={activeTab === 'sale' ? '#fff' : theme.textSecondary} 
            />
            <Text style={[
              styles.tabText, 
              activeTab === 'sale' && styles.tabTextActive,
              { fontFamily: activeTab === 'sale' ? fontFamily.bold : fontFamily.semiBold }
            ]}>
              For Sale
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'rent' && styles.tabActive]}
            onPress={() => {
              setActiveTab('rent');
              setSelectedCategory('All');
              setSearchQuery('');
            }}
            activeOpacity={0.7}
          >
            {activeTab === 'rent' && (
              <LinearGradient
                colors={['#FDAD00', '#FF9500']}
                style={styles.tabGradient}
              />
            )}
            <Ionicons 
              name="time" 
              size={16} 
              color={activeTab === 'rent' ? '#fff' : theme.textSecondary} 
            />
            <Text style={[
              styles.tabText, 
              activeTab === 'rent' && styles.tabTextActive,
              { fontFamily: activeTab === 'rent' ? fontFamily.bold : fontFamily.semiBold }
            ]}>
              For Rent
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { fontFamily: fontFamily.medium }]}
            placeholder={`Search ${activeTab === 'sale' ? 'products' : 'rentals'}...`}
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Pills */}
      {renderCategoryFilters()}
    </View>
  );

  // Category Filters
  const renderCategoryFilters = () => {
    const categories = activeTab === 'sale' ? SALE_CATEGORIES : RENTAL_CATEGORIES;
    
    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryContent}
        style={styles.categoryScroll}
      >
        {categories.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryPill, selectedCategory === cat && styles.categoryPillActive]}
            onPress={() => setSelectedCategory(cat)}
            activeOpacity={0.7}
          >
            {selectedCategory === cat ? (
              <LinearGradient colors={['#FDAD00', '#FF9500']} style={styles.categoryPillGradient}>
                <Text style={[styles.categoryPillTextActive, { fontFamily: fontFamily.bold }]}>{cat}</Text>
              </LinearGradient>
            ) : (
              <Text style={[styles.categoryPillText, { fontFamily: fontFamily.semiBold }]}>{cat}</Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  // Product Card
  const renderProduct = ({ item: product, index }) => {
    const isRental = activeTab === 'rent';
    const imageUrl = parseImageUrl(isRental ? product.image : product.product_image_url);

    const CardWrapper = isMyProfile ? View : TouchableOpacity;
    const cardProps = isMyProfile ? {} : {
      onPress: () => {
        if (isRental) {
          navigation.navigate('RentalDetails', { rentalItem: product });
        } else {
          navigation.navigate('ProductDetails', { product });
        }
      },
      activeOpacity: 0.9,
    };

    return (
      <Animated.View
        style={[
          styles.cardWrapper,
          { opacity: fadeAnim, transform: [{ translateY: Animated.add(slideAnim, new Animated.Value(index * 3)) }] }
        ]}
      >
        <CardWrapper style={styles.productCard} {...cardProps}>
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUrl }} style={styles.productImage} resizeMode="cover" />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.3)']} style={styles.imageGradient} />
            {product.quantity === 0 && (
              <View style={styles.stockLabel}>
                <Text style={[styles.stockLabelText, { fontFamily: fontFamily.bold }]}>Out of Stock</Text>
              </View>
            )}
          </View>

          <View style={styles.cardContent}>
            <Text style={[styles.productName, { fontFamily: fontFamily.semiBold }]} numberOfLines={2}>
              {product.product_name}
            </Text>

            <View style={styles.priceRow}>
              <Text style={[styles.price, { fontFamily: fontFamily.bold }]}>₱{product.price}</Text>
              {isRental && product.rental_duration && (
                <Text style={[styles.duration, { fontFamily: fontFamily.medium }]}>/{product.rental_duration}</Text>
              )}
            </View>

            {product.category && (
              <View style={styles.categoryTag}>
                <Text style={[styles.categoryTagText, { fontFamily: fontFamily.semiBold }]} numberOfLines={1}>
                  {product.category}
                </Text>
              </View>
            )}

            {isMyProfile ? (
              <View style={styles.controls}>
                <View style={styles.quantityControl}>
                  <TouchableOpacity
                    style={[styles.qtyButton, product.quantity <= 0 && styles.qtyButtonDisabled]}
                    onPress={() => handleQuantityChange(product, -1)}
                    disabled={product.quantity <= 0}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="remove" size={14} color="#fff" />
                  </TouchableOpacity>
                  <Text style={[styles.qtyText, { fontFamily: fontFamily.bold }]}>{product.quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyButton}
                    onPress={() => handleQuantityChange(product, 1)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.visibilityToggle}
                  onPress={() => handleToggleVisibility(product)}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={product.is_visible ? "eye" : "eye-off"} 
                    size={18} 
                    color={product.is_visible ? theme.accent : theme.textSecondary} 
                  />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.messageButton}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  navigation.navigate('Messaging', {
                    receiverId: isRental ? product.owner_email : product.email,
                    receiverName: name,
                    productToSend: product,
                  });
                }}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#FDAD00', '#FF9500']}
                  style={styles.messageGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="chatbubble-ellipses" size={14} color="#fff" />
                  <Text style={[styles.messageText, { fontFamily: fontFamily.bold }]}>Message</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </CardWrapper>
      </Animated.View>
    );
  };

  // Empty State
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrapper}>
        <Ionicons 
          name={searchQuery || selectedCategory !== 'All' ? "search-outline" : "cube-outline"} 
          size={56} 
          color={theme.textSecondary} 
        />
      </View>
      <Text style={[styles.emptyTitle, { fontFamily: fontFamily.bold }]}>
        {searchQuery || selectedCategory !== 'All' ? 'No Results Found' : `No ${activeTab === 'sale' ? 'Products' : 'Rentals'} Yet`}
      </Text>
      <Text style={[styles.emptySubtitle, { fontFamily: fontFamily.medium }]}>
        {searchQuery || selectedCategory !== 'All'
          ? 'Try adjusting your search or filters'
          : `Start ${activeTab === 'sale' ? 'selling' : 'renting'} items today`}
      </Text>
      {isMyProfile && !searchQuery && selectedCategory === 'All' && (
        <TouchableOpacity
          style={styles.emptyAction}
          onPress={() => navigation.navigate(activeTab === 'sale' ? 'AddProduct' : 'RentItem')}
          activeOpacity={0.8}
        >
          <LinearGradient colors={['#FDAD00', '#FF9500']} style={styles.emptyActionGradient}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={[styles.emptyActionText, { fontFamily: fontFamily.bold }]}>
              Add {activeTab === 'sale' ? 'Product' : 'Rental'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );

  const styles = createStyles(theme, isDarkMode);

  if (profileLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loadingText, { fontFamily: fontFamily.semiBold }]}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
        translucent={false}
      />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.FlatList
          data={filteredProducts}
          keyExtractor={(item) => `${activeTab}-${item.id}`}
          renderItem={renderProduct}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        />

        {/* Image Modal */}
        <Modal visible={modalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setModalVisible(false)}
              activeOpacity={0.8}
            >
              <View style={styles.closeIcon}>
                <Ionicons name="close" size={28} color="#fff" />
              </View>
            </TouchableOpacity>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
            >
              {selectedImages.map((img, index) => (
                <Image
                  key={index}
                  source={{ uri: img }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
              ))}
            </ScrollView>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.text,
  },
  listContent: {
    paddingBottom: 32,
  },
  columnWrapper: {
    paddingHorizontal: 16,
    justifyContent: 'space-between',
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
  backButton: {
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
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: isDarkMode ? 'rgba(253, 173, 0, 0.15)' : 'rgba(253, 173, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIcon: {
    width: 22,
    height: 22,
  },
  logoText: {
    fontSize: 16,
    color: theme.accent,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 40,
  },

  // Hero Section
  heroWrapper: {
    position: 'relative',
    marginBottom: -24,
  },
  heroGradient: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 20,
  },
  heroContent: {
    alignItems: 'center',
  },
  avatarSection: {
    marginBottom: 16,
  },
  avatarRing: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  editBadgeGradient: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  displayName: {
    fontSize: 28,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  verifiedBadge: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  joinedText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  waveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 32,
  },
  wave: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 32,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },

  // Stats Container 
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: -16,
    marginBottom: 24,
    gap: 12,
    zIndex: 2,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  statIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 20,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },

  // Info Section 
  infoSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    color: theme.text,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.borderColor,
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
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
  infoText: {
    fontSize: 16,
    color: theme.text,
  },
  dividerLine: {
    height: 1,
    backgroundColor: theme.borderColor,
    marginVertical: 16,
    opacity: 0.5,
  },

  // Action Buttons 
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  buttonLabel: {
    fontSize: 15,
    color: '#FFFFFF',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: theme.cardBackground,
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },
  secondaryButtonFull: {
    flex: 1,
  },
  secondaryButtonLabel: {
    fontSize: 15,
    color: '#FF6B6B',
  },

  // Listings Section
  listingsSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  listingsTitle: {
    fontSize: 22,
    color: theme.text,
    marginBottom: 4,
  },
  listingsCount: {
    fontSize: 14,
    color: theme.textSecondary,
  },

  // Tab Wrapper 
  tabWrapper: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: isDarkMode ? 'rgba(42, 40, 86, 0.6)' : 'rgba(245, 245, 245, 1)',
    borderRadius: 14,
    padding: 4,
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
    position: 'relative',
  },
  tabActive: {
    zIndex: 1,
  },
  tabGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
  },
  tabText: {
    fontSize: 14,
    color: theme.textSecondary,
    zIndex: 1,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },

  // Search Bar 
  searchWrapper: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(42, 40, 86, 0.6)' : 'rgba(255, 255, 255, 1)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.borderColor,
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: theme.text,
  },

  // Category Pills
  categoryScroll: {
    marginBottom: 20,
  },
  categoryContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  categoryPill: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: isDarkMode ? 'rgba(42, 40, 86, 0.6)' : 'rgba(245, 245, 245, 1)',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(253, 173, 0, 0.2)' : 'rgba(0, 0, 0, 0.08)',
  },
  categoryPillActive: {
    borderColor: 'transparent',
  },
  categoryPillGradient: {
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  categoryPillText: {
    fontSize: 13,
    color: theme.textSecondary,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  categoryPillTextActive: {
    fontSize: 13,
    color: '#FFFFFF',
  },

  // Product Cards 
  cardWrapper: {
    width: CARD_WIDTH,
    marginBottom: 16,
  },
  productCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(253, 173, 0, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    shadowColor: theme.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  imageContainer: {
    width: '100%',
    height: CARD_WIDTH * 1.1,
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
    height: 60,
  },
  stockLabel: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  stockLabelText: {
    fontSize: 11,
    color: '#FFFFFF',
  },
  cardContent: {
    padding: 14,
  },
  productName: {
    fontSize: 15,
    color: theme.text,
    marginBottom: 8,
    lineHeight: 20,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  price: {
    fontSize: 20,
    color: theme.accent,
  },
  duration: {
    fontSize: 13,
    color: theme.textSecondary,
    marginLeft: 4,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: isDarkMode ? 'rgba(253, 173, 0, 0.15)' : 'rgba(253, 173, 0, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
  },
  categoryTagText: {
    fontSize: 11,
    color: isDarkMode ? theme.accent : '#FF9500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Controls
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: isDarkMode ? 'rgba(253, 173, 0, 0.1)' : 'rgba(0, 0, 0, 0.05)',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDarkMode ? 'rgba(42, 40, 86, 0.6)' : 'rgba(245, 245, 245, 1)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  qtyButton: {
    width: 32,
    height: 32,
    backgroundColor: theme.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyButtonDisabled: {
    backgroundColor: theme.textSecondary,
    opacity: 0.4,
  },
  qtyText: {
    paddingHorizontal: 14,
    fontSize: 15,
    color: theme.text,
  },
  visibilityToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDarkMode ? 'rgba(42, 40, 86, 0.6)' : 'rgba(245, 245, 245, 1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  messageGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 6,
  },
  messageText: {
    fontSize: 13,
    color: '#FFFFFF',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyIconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: isDarkMode ? 'rgba(42, 40, 86, 0.6)' : 'rgba(245, 245, 245, 1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 3,
    borderColor: isDarkMode ? 'rgba(253, 173, 0, 0.2)' : 'rgba(0, 0, 0, 0.08)',
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 22,
    color: theme.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  emptyAction: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#FDAD00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  emptyActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyActionText: {
    fontSize: 16,
    color: '#FFFFFF',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 60, 
    right: 20,
    zIndex: 10,
  },
  closeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width,
    height: width * 1.5,
  },
});