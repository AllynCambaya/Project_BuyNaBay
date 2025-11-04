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
  FlatList,
  Image,
  Modal,
  Platform,
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

const { width, height } = Dimensions.get('window');
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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;

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
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 600,
        delay: 200,
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
      {/* Elevated App Header */}
      <Animated.View style={[styles.appHeader, { opacity: headerOpacity }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerRight} />
      </Animated.View>

      {/* Premium Hero Section */}
      <LinearGradient
        colors={isDarkMode 
          ? ['#1F1D47', '#141332', '#0A0A1E'] 
          : ['#FDAD00', '#FF9500', '#FF8000']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroSection}
      >
        <Animated.View 
          style={[
            styles.heroContent,
            { 
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { translateY: slideAnim }
              ]
            }
          ]}
        >
          {/* Avatar with Glow Effect */}
          <TouchableOpacity 
            onPress={isMyProfile ? handleImagePick : undefined}
            disabled={!isMyProfile}
            activeOpacity={0.85}
            style={styles.avatarTouchable}
          >
            <View style={styles.avatarContainer}>
              <View style={[styles.avatarGlow, isDarkMode && styles.avatarGlowDark]}>
                <Image source={getAvatarSource()} style={styles.avatar} />
              </View>
              {isMyProfile && (
                <LinearGradient
                  colors={['#FDAD00', '#FF9500']}
                  style={styles.editAvatarButton}
                >
                  <Ionicons name="camera" size={18} color="#fff" />
                </LinearGradient>
              )}
            </View>
          </TouchableOpacity>

          {/* Name & Badge */}
          <View style={styles.nameContainer}>
            <Text style={styles.userName} numberOfLines={1}>
              {name || 'User'}
            </Text>
            {verified && (
              <LinearGradient
                colors={['#4CAF50', '#45A049']}
                style={styles.verifiedBadge}
              >
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
              </LinearGradient>
            )}
          </View>

          {/* Join Date */}
          {joinedDate && (
            <View style={styles.joinedContainer}>
              <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.8)" />
              <Text style={styles.joinedText}>Member since {joinedDate}</Text>
            </View>
          )}
        </Animated.View>

        {/* Decorative Wave Pattern */}
        <View style={styles.wavePattern}>
          <View style={[styles.wave, styles.wave1]} />
          <View style={[styles.wave, styles.wave2]} />
        </View>
      </LinearGradient>

      {/* Stats Dashboard */}
      {isMyProfile && (
        <Animated.View 
          style={[
            styles.statsWrapper,
            { 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <LinearGradient
                colors={isDarkMode ? ['#2A2856', '#1F1D47'] : ['#FFF5E6', '#FFFFFF']}
                style={styles.statGradient}
              >
                <View style={[styles.statIcon, { backgroundColor: `${theme.primary}15` }]}>
                  <Ionicons name="cube-outline" size={22} color={theme.primary} />
                </View>
                <Text style={styles.statNumber}>{stats.totalItems}</Text>
                <Text style={styles.statLabel}>Total Items</Text>
              </LinearGradient>
            </View>

            <View style={styles.statBox}>
              <LinearGradient
                colors={isDarkMode ? ['#2A2856', '#1F1D47'] : ['#E8F5E9', '#FFFFFF']}
                style={styles.statGradient}
              >
                <View style={[styles.statIcon, { backgroundColor: '#4CAF5015' }]}>
                  <Ionicons name="eye-outline" size={22} color="#4CAF50" />
                </View>
                <Text style={styles.statNumber}>{stats.activeItems}</Text>
                <Text style={styles.statLabel}>Active</Text>
              </LinearGradient>
            </View>

            <View style={styles.statBox}>
              <LinearGradient
                colors={isDarkMode ? ['#2A2856', '#1F1D47'] : ['#FFF5E6', '#FFFFFF']}
                style={styles.statGradient}
              >
                <View style={[styles.statIcon, { backgroundColor: `${theme.primary}15` }]}>
                  <Ionicons name="wallet-outline" size={22} color={theme.primary} />
                </View>
                <Text style={styles.statNumber}>₱{stats.totalValue.toFixed(0)}</Text>
                <Text style={styles.statLabel}>Total Value</Text>
              </LinearGradient>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Contact Information Card */}
      <Animated.View 
        style={[
          styles.infoSection,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <Text style={styles.sectionHeader}>Contact Information</Text>
        
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={[styles.infoIconWrapper, { backgroundColor: `${theme.primary}15` }]}>
              <Ionicons name="mail" size={20} color={theme.primary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email Address</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{email || 'N/A'}</Text>
            </View>
          </View>

          {verified && (
            <>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <View style={[styles.infoIconWrapper, { backgroundColor: `${theme.primary}15` }]}>
                  <Ionicons name="call" size={20} color={theme.primary} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Phone Number</Text>
                  <Text style={styles.infoValue}>{phoneNumber || 'Not provided'}</Text>
                </View>
              </View>

              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <View style={[styles.infoIconWrapper, { backgroundColor: `${theme.primary}15` }]}>
                  <Ionicons name="card" size={20} color={theme.primary} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Student ID</Text>
                  <Text style={styles.infoValue}>{studentId || 'Not provided'}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Action Buttons */}
        {isMyProfile && (
          <View style={styles.actionButtons}>
            {!verified && (
              <TouchableOpacity
                style={styles.verifyButton}
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
                  <Text style={styles.buttonText}>Get Verified</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[styles.logoutButton, !verified && styles.logoutButtonFull]}
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <View style={styles.logoutGradient}>
                <Ionicons name="log-out-outline" size={18} color="#FF6B6B" />
                <Text style={styles.logoutText}>Logout</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* Listings Header */}
      <View style={styles.listingsHeader}>
        <View>
          <Text style={styles.listingsTitle}>
            {isMyProfile ? 'My Listings' : `${name}'s Listings`}
          </Text>
          <Text style={styles.listingsSubtitle}>{filteredProducts.length} items</Text>
        </View>
      </View>

      {/* Premium Tab Selector */}
      <View style={styles.tabContainer}>
        <View style={styles.tabSelector}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'sale' && styles.tabButtonActive]}
            onPress={() => {
              setActiveTab('sale');
              setSelectedCategory('All');
              setSearchQuery('');
            }}
            activeOpacity={0.7}
          >
            {activeTab === 'sale' && (
              <LinearGradient
                colors={isDarkMode ? ['#FDAD00', '#FF9500'] : ['#FDAD00', '#FF9500']}
                style={styles.tabActiveGradient}
              />
            )}
            <Ionicons 
              name="pricetag" 
              size={18} 
              color={activeTab === 'sale' ? '#fff' : theme.textSecondary} 
            />
            <Text style={[
              styles.tabLabel, 
              activeTab === 'sale' && styles.tabLabelActive
            ]}>
              For Sale
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'rent' && styles.tabButtonActive]}
            onPress={() => {
              setActiveTab('rent');
              setSelectedCategory('All');
              setSearchQuery('');
            }}
            activeOpacity={0.7}
          >
            {activeTab === 'rent' && (
              <LinearGradient
                colors={isDarkMode ? ['#FDAD00', '#FF9500'] : ['#FDAD00', '#FF9500']}
                style={styles.tabActiveGradient}
              />
            )}
            <Ionicons 
              name="time" 
              size={18} 
              color={activeTab === 'rent' ? '#fff' : theme.textSecondary} 
            />
            <Text style={[
              styles.tabLabel, 
              activeTab === 'rent' && styles.tabLabelActive
            ]}>
              For Rent
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Enhanced Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={theme.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search ${activeTab === 'sale' ? 'products' : 'rentals'}...`}
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity 
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Pills */}
      {renderCategoryFilters()}
    </View>
  );

  // Render Category Filters
  const renderCategoryFilters = () => {
    const categories = activeTab === 'sale' ? SALE_CATEGORIES : RENTAL_CATEGORIES;
    
    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScrollContent}
        style={styles.categoryScroll}
      >
        {categories.map(category => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryPill,
              selectedCategory === category && styles.categoryPillActive
            ]}
            onPress={() => setSelectedCategory(category)}
            activeOpacity={0.7}
          >
            {selectedCategory === category ? (
              <LinearGradient
                colors={isDarkMode ? ['#FDAD00', '#FF9500'] : ['#FDAD00', '#FF9500']}
                style={styles.categoryPillGradient}
              >
                <Text style={styles.categoryPillTextActive}>{category}</Text>
              </LinearGradient>
            ) : (
              <Text style={styles.categoryPillText}>{category}</Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  // Render Product Card
  const renderProduct = ({ item: product, index }) => {
    const isRental = activeTab === 'rent';
    const imageUrl = parseImageUrl(isRental ? product.image : product.product_image_url);

    const CardWrapper = isMyProfile ? View : TouchableOpacity;
    const cardProps = isMyProfile
      ? {}
      : {
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
          styles.productWrapper,
          {
            opacity: fadeAnim,
            transform: [
              { 
                translateY: Animated.add(
                  slideAnim,
                  new Animated.Value(index * 3)
                )
              }
            ]
          }
        ]}
      >
        <CardWrapper style={styles.productCard} {...cardProps}>
          {/* Image Section */}
          <View style={styles.productImageWrapper}>
            <Image 
              source={{ uri: imageUrl }} 
              style={styles.productImage} 
              resizeMode="cover" 
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.4)']}
              style={styles.imageOverlay}
            />
            
            {product.quantity === 0 && (
              <View style={styles.stockBadge}>
                <Text style={styles.stockBadgeText}>Out of Stock</Text>
              </View>
            )}
          </View>

          {/* Content Section */}
          <View style={styles.productDetails}>
            <Text style={styles.productTitle} numberOfLines={2}>
              {product.product_name}
            </Text>

            <View style={styles.priceContainer}>
              <Text style={styles.productPrice}>₱{product.price}</Text>
              {isRental && product.rental_duration && (
                <Text style={styles.priceDuration}>/{product.rental_duration}</Text>
              )}
            </View>

            {product.category && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText} numberOfLines={1}>
                  {product.category}
                </Text>
              </View>
            )}

            {/* Controls */}
            {isMyProfile ? (
              <View style={styles.productControls}>
                <View style={styles.quantityController}>
                  <TouchableOpacity
                    style={[styles.quantityButton, product.quantity <= 0 && styles.quantityButtonDisabled]}
                    onPress={() => handleQuantityChange(product, -1)}
                    disabled={product.quantity <= 0}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="remove" size={14} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.quantityValue}>{product.quantity}</Text>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => handleQuantityChange(product, 1)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.visibilityButton}
                  onPress={() => handleToggleVisibility(product)}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={product.is_visible ? "eye" : "eye-off"} 
                    size={18} 
                    color={product.is_visible ? theme.primary : theme.textSecondary} 
                  />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.contactButton}
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
                    style={styles.contactGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons name="chatbubble-ellipses" size={14} color="#fff" />
                    <Text style={styles.contactText}>Message</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </CardWrapper>
        </Animated.View>
      );
    };
  
    // Render Empty State
    const renderEmptyState = () => (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconCircle}>
          <Ionicons 
            name={searchQuery || selectedCategory !== 'All' ? "search-outline" : "cube-outline"} 
            size={48} 
            color={theme.textSecondary} 
          />
        </View>
        <Text style={styles.emptyTitle}>
          {searchQuery || selectedCategory !== 'All' 
            ? 'No Results Found' 
            : `No ${activeTab === 'sale' ? 'Products' : 'Rentals'} Yet`}
        </Text>
        <Text style={styles.emptyDescription}>
          {searchQuery || selectedCategory !== 'All'
            ? 'Try different keywords or filters'
            : `Start ${activeTab === 'sale' ? 'selling' : 'renting'} your items today`}
        </Text>
        {isMyProfile && !searchQuery && selectedCategory === 'All' && (
          <TouchableOpacity
            style={styles.emptyActionButton}
            onPress={() => navigation.navigate(activeTab === 'sale' ? 'AddProduct' : 'RentItem')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#FDAD00', '#FF9500']}
              style={styles.emptyActionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.emptyActionText}>
                Add {activeTab === 'sale' ? 'Product' : 'Rental'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    );
  
    const styles = createStyles(theme);
  
    if (profileLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
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
        <SafeAreaView style={styles.container}>
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => `${activeTab}-${item.id}`}
            renderItem={renderProduct}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={renderEmptyState}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh}
                tintColor={theme.primary}
                colors={[theme.primary]}
              />
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
          />
  
          {/* Image Modal */}
          <Modal visible={modalVisible} transparent animationType="fade">
            <View style={styles.modalContainer}>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.8}
              >
                <View style={styles.modalCloseButton}>
                  <Ionicons name="close" size={28} color="#fff" />
                </View>
              </TouchableOpacity>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.modalScroll}
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
              {selectedImages.length > 1 && (
                <View style={styles.modalIndicator}>
                  <Text style={styles.modalIndicatorText}>
                    Swipe to see all {selectedImages.length} images
                  </Text>
                </View>
              )}
            </View>
          </Modal>
        </SafeAreaView>
      </>
    );
  }
  
  // Theme Definitions
  const darkTheme = {
    background: '#0A0A1E',
    cardBackground: '#1F1D47',
    cardBackgroundAlt: '#2A2856',
    text: '#FFFFFF',
    textSecondary: '#A8A6C7',
    textTertiary: '#8E8CB3',
    primary: '#FDAD00',
    primaryDark: '#FF9500',
    success: '#4CAF50',
    error: '#FF6B6B',
    warning: '#FFA726',
    borderColor: '#2A2856',
    divider: '#2A2856',
    shadowColor: '#000000',
    overlay: 'rgba(0, 0, 0, 0.85)',
  };
  
  const lightTheme = {
    background: '#F8F9FC',
    cardBackground: '#FFFFFF',
    cardBackgroundAlt: '#F5F7FA',
    text: '#1A1A2E',
    textSecondary: '#6B6B8A',
    textTertiary: '#9494B8',
    primary: '#FDAD00',
    primaryDark: '#FF9500',
    success: '#4CAF50',
    error: '#FF6B6B',
    warning: '#FFA726',
    borderColor: '#E8E8F0',
    divider: '#E8E8F0',
    shadowColor: '#000000',
    overlay: 'rgba(0, 0, 0, 0.6)',
  };
  
  const createStyles = (theme) => StyleSheet.create({
    container: {
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
      fontWeight: '600',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    listContent: {
      paddingBottom: 32,
    },
    columnWrapper: {
      paddingHorizontal: 16,
      justifyContent: 'space-between',
    },
  
    // App Header
    appHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: theme.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderColor,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.cardBackground,
      justifyContent: 'center',
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: 0.3,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    headerRight: {
      width: 40,
    },
  
    // Hero Section
    heroSection: {
      paddingTop: 40,
      paddingBottom: 48,
      paddingHorizontal: 20,
      position: 'relative',
      overflow: 'hidden',
    },
    heroContent: {
      alignItems: 'center',
      zIndex: 2,
    },
    avatarTouchable: {
      marginBottom: 16,
    },
    avatarContainer: {
      position: 'relative',
    },
    avatarGlow: {
      width: 110,
      height: 110,
      borderRadius: 55,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: '#FDAD00',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.4,
          shadowRadius: 16,
        },
        android: {
          elevation: 12,
        },
      }),
    },
    avatarGlowDark: {
      backgroundColor: 'rgba(253, 173, 0, 0.1)',
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 4,
      borderColor: '#FFFFFF',
    },
    editAvatarButton: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: '#FFFFFF',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    nameContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    userName: {
      fontSize: 28,
      fontWeight: '700',
      color: '#FFFFFF',
      textAlign: 'center',
      letterSpacing: 0.5,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    verifiedBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      justifyContent: 'center',
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: '#4CAF50',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    joinedContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    joinedText: {
      fontSize: 13,
      color: 'rgba(255, 255, 255, 0.9)',
      fontWeight: '600',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    wavePattern: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 60,
    },
    wave: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 30,
      backgroundColor: theme.background,
    },
    wave1: {
      borderTopLeftRadius: 50,
      borderTopRightRadius: 50,
      opacity: 0.5,
    },
    wave2: {
      borderTopLeftRadius: 100,
      borderTopRightRadius: 100,
      height: 40,
    },
  
    // Stats Section
    statsWrapper: {
      marginTop: -28,
      paddingHorizontal: 20,
      marginBottom: 24,
      zIndex: 3,
    },
    statsGrid: {
      flexDirection: 'row',
      gap: 12,
    },
    statBox: {
      flex: 1,
    },
    statGradient: {
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    statIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    statNumber: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 4,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    statLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: '600',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
  
    // Info Section
    infoSection: {
      paddingHorizontal: 20,
      marginBottom: 24,
    },
    sectionHeader: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 12,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    infoCard: {
      backgroundColor: theme.cardBackground,
      borderRadius: 20,
      padding: 20,
      marginBottom: 16,
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    infoIconWrapper: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    infoContent: {
      flex: 1,
    },
    infoLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 4,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    infoValue: {
      fontSize: 16,
      color: theme.text,
      fontWeight: '600',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    infoDivider: {
      height: 1,
      backgroundColor: theme.divider,
      marginVertical: 16,
    },
  
    // Action Buttons
    actionButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    verifyButton: {
      flex: 1,
      borderRadius: 16,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#4CAF50',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    buttonGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      gap: 8,
    },
    buttonText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    logoutButton: {
      flex: 1,
      borderRadius: 16,
      backgroundColor: theme.cardBackground,
      borderWidth: 2,
      borderColor: '#FF6B6B',
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    logoutButtonFull: {
      flex: 1,
    },
    logoutGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      gap: 8,
    },
    logoutText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FF6B6B',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
  
    // Listings Header
    listingsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    listingsTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 4,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    listingsSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: '600',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
  
    // Tab Container
    tabContainer: {
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    tabSelector: {
      flexDirection: 'row',
      backgroundColor: theme.cardBackgroundAlt,
      borderRadius: 16,
      padding: 4,
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    tabButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 12,
      gap: 6,
      position: 'relative',
    },
    tabButtonActive: {
      zIndex: 1,
    },
    tabActiveGradient: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 12,
    },
    tabLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.textSecondary,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
      zIndex: 1,
    },
    tabLabelActive: {
      color: '#FFFFFF',
    },
  
    // Search Bar
    searchContainer: {
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.cardBackground,
      borderRadius: 16,
      paddingHorizontal: 16,
      height: 52,
      borderWidth: 1,
      borderColor: theme.borderColor,
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
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
      fontSize: 15,
      color: theme.text,
      fontWeight: '500',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    clearButton: {
      padding: 4,
    },
  
    // Category Pills
    categoryScroll: {
      marginBottom: 20,
    },
    categoryScrollContent: {
      paddingHorizontal: 20,
      gap: 10,
    },
    categoryPill: {
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: theme.cardBackground,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    categoryPillActive: {
      borderColor: 'transparent',
    },
    categoryPillGradient: {
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    categoryPillText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textSecondary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    categoryPillTextActive: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
  
    // Product Cards
    productWrapper: {
      width: CARD_WIDTH,
      marginBottom: 16,
    },
    productCard: {
      backgroundColor: theme.cardBackground,
      borderRadius: 20,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    productImageWrapper: {
      position: 'relative',
      width: '100%',
      height: CARD_WIDTH * 1.1,
      backgroundColor: theme.cardBackgroundAlt,
    },
    productImage: {
      width: '100%',
      height: '100%',
    },
    imageOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 60,
    },
    stockBadge: {
      position: 'absolute',
      top: 12,
      right: 12,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backdropFilter: 'blur(10px)',
    },
    stockBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#FFFFFF',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    productDetails: {
      padding: 14,
    },
    productTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
      lineHeight: 20,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    priceContainer: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginBottom: 8,
    },
    productPrice: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.primary,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    priceDuration: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
      marginLeft: 4,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    categoryBadge: {
      alignSelf: 'flex-start',
      backgroundColor: theme.cardBackgroundAlt,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      marginBottom: 12,
    },
    categoryBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
  
    // Product Controls
    productControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.divider,
    },
    quantityController: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.cardBackgroundAlt,
      borderRadius: 12,
      overflow: 'hidden',
    },
    quantityButton: {
      width: 32,
      height: 32,
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    quantityButtonDisabled: {
      backgroundColor: theme.textSecondary,
      opacity: 0.4,
    },
    quantityValue: {
      paddingHorizontal: 14,
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    visibilityButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.cardBackgroundAlt,
      justifyContent: 'center',
      alignItems: 'center',
    },
    contactButton: {
      borderRadius: 12,
      overflow: 'hidden',
      marginTop: 4,
    },
    contactGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
      gap: 6,
    },
    contactText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FFFFFF',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
  
    // Empty State
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 80,
      paddingHorizontal: 32,
    },
    emptyIconCircle: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: theme.cardBackgroundAlt,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
      borderWidth: 3,
      borderColor: theme.borderColor,
      borderStyle: 'dashed',
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 8,
      textAlign: 'center',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    emptyDescription: {
      fontSize: 15,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 32,
      lineHeight: 22,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    emptyActionButton: {
      borderRadius: 16,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: theme.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
        },
        android: {
          elevation: 6,
        },
      }),
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
      fontWeight: '700',
      color: '#FFFFFF',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
  
    // Modal
    modalContainer: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalClose: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 60 : 40,
      right: 20,
      zIndex: 10,
    },
    modalCloseButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      backdropFilter: 'blur(10px)',
    },
    modalScroll: {
      alignItems: 'center',
    },
    modalImage: {
      width: width,
      height: height * 0.7,
    },
    modalIndicator: {
      position: 'absolute',
      bottom: Platform.OS === 'ios' ? 60 : 40,
      alignSelf: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 24,
      backdropFilter: 'blur(10px)',
    },
    modalIndicatorText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FFFFFF',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
  });