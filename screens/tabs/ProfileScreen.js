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
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native';
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
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
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

  // Render Header with Custom App Header
  const renderHeader = () => (
    <View>
      {/* Custom App Header - Consistent Design */}
      <View style={styles.appHeader}>
        <View style={styles.headerLeft}>
          <Image 
            source={require('../../assets/images/OfficialBuyNaBay.png')} 
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        {!isMyProfile && (
          <TouchableOpacity 
            style={styles.backIconBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
        )}
      </View>

      {/* Profile Hero Section with Gradient */}
      <LinearGradient
        colors={isDarkMode ? ['#1a1a3e', '#0f0f2e'] : ['#f39c12', '#e67e22']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroGradient}
      >
        <Animated.View 
          style={[
            styles.profileSection,
            { 
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <TouchableOpacity 
            onPress={isMyProfile ? handleImagePick : undefined}
            disabled={!isMyProfile}
            activeOpacity={0.8}
          >
            <View style={styles.avatarWrapper}>
              <Image source={getAvatarSource()} style={styles.avatar} />
              {isMyProfile && (
                <View style={styles.cameraButton}>
                  <Ionicons name="camera" size={20} color="#fff" />
                </View>
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.nameRow}>
            <Text style={styles.profileName} numberOfLines={1}>
              {name || 'User'}
            </Text>
            {verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>
          
          {joinedDate && (
            <View style={styles.joinedRow}>
              <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.joinedText}>Joined {joinedDate}</Text>
            </View>
          )}
        </Animated.View>
      </LinearGradient>

      {/* Stats Cards - Modern Dashboard Style */}
      {isMyProfile && (
        <Animated.View 
          style={[
            styles.statsContainer,
            { 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.statCard}>
            <View style={styles.statIconWrapper}>
              <Ionicons name="cube-outline" size={24} color={theme.accent} />
            </View>
            <Text style={styles.statValue}>{stats.totalItems}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          
          <View style={styles.statCard}>
            <View style={styles.statIconWrapper}>
              <Ionicons name="checkmark-circle-outline" size={24} color="#4CAF50" />
            </View>
            <Text style={styles.statValue}>{stats.activeItems}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          
          <View style={styles.statCard}>
            <View style={styles.statIconWrapper}>
              <Ionicons name="cash-outline" size={24} color={theme.accent} />
            </View>
            <Text style={styles.statValue}>₱{stats.totalValue.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Value</Text>
          </View>
        </Animated.View>
      )}

      {/* Contact Info Section - Unified Card Design */}
      <Animated.View 
        style={[
          styles.contactSection,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <Text style={styles.sectionTitle}>Contact Information</Text>
        
        <View style={styles.contactCard}>
          <View style={styles.contactItem}>
            <View style={styles.contactIconWrapper}>
              <Ionicons name="mail" size={18} color={theme.accent} />
            </View>
            <View style={styles.contactContent}>
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={styles.contactValue} numberOfLines={1}>{email || 'N/A'}</Text>
            </View>
          </View>

          {verified && (
            <>
              <View style={styles.divider} />
              <View style={styles.contactItem}>
                <View style={styles.contactIconWrapper}>
                  <Ionicons name="call" size={18} color={theme.accent} />
                </View>
                <View style={styles.contactContent}>
                  <Text style={styles.contactLabel}>Phone</Text>
                  <Text style={styles.contactValue}>{phoneNumber || 'N/A'}</Text>
                </View>
              </View>

              <View style={styles.divider} />
              <View style={styles.contactItem}>
                <View style={styles.contactIconWrapper}>
                  <Ionicons name="card" size={18} color={theme.accent} />
                </View>
                <View style={styles.contactContent}>
                  <Text style={styles.contactLabel}>Student ID</Text>
                  <Text style={styles.contactValue}>{studentId || 'N/A'}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Action Buttons - Horizontal Layout */}
        {isMyProfile && (
          <View style={styles.actionButtonsRow}>
            {!verified && (
              <TouchableOpacity
                style={[styles.actionButton, styles.verifyButton]}
                onPress={() => navigation.navigate('GetVerified')}
                activeOpacity={0.8}
              >
                <Ionicons name="shield-checkmark" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Verify</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[styles.actionButton, styles.logoutButton, !verified && { flex: 1 }]}
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <Ionicons name="log-out" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* Listings Section Header */}
      <View style={styles.listingsHeader}>
        <Text style={styles.listingsTitle}>
          {isMyProfile ? 'My Listings' : `${name}'s Listings`}
        </Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{filteredProducts.length}</Text>
        </View>
      </View>

      {/* Tabs - Modern Toggle Style */}
      <View style={styles.tabsWrapper}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sale' && styles.activeTab]}
          onPress={() => {
            setActiveTab('sale');
            setSelectedCategory('All');
            setSearchQuery('');
          }}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="pricetag" 
            size={18} 
            color={activeTab === 'sale' ? '#fff' : theme.textSecondary} 
          />
          <Text style={[
            styles.tabText, 
            activeTab === 'sale' && styles.activeTabText
          ]}>
            For Sale
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'rent' && styles.activeTab]}
          onPress={() => {
            setActiveTab('rent');
            setSelectedCategory('All');
            setSearchQuery('');
          }}
          activeOpacity={0.7}
        >
          <Ionicons 
            name="time" 
            size={18} 
            color={activeTab === 'rent' ? '#fff' : theme.textSecondary} 
          />
          <Text style={[
            styles.tabText, 
            activeTab === 'rent' && styles.activeTabText
          ]}>
            For Rent
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={theme.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${activeTab === 'sale' ? 'products' : 'rentals'}...`}
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filters */}
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
        contentContainerStyle={styles.categoriesScroll}
        style={styles.categoriesWrapper}
      >
        {categories.map(category => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryChip,
              selectedCategory === category && styles.activeCategoryChip
            ]}
            onPress={() => setSelectedCategory(category)}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.categoryChipText,
              selectedCategory === category && styles.activeCategoryChipText
            ]}>
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  // Render Product Card - Modern Grid Layout
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
          styles.productCardWrapper,
          {
            opacity: fadeAnim,
            transform: [
              { 
                translateY: slideAnim.interpolate({
                  inputRange: [0, 30],
                  outputRange: [0, 30 + index * 5],
                })
              }
            ]
          }
        ]}
      >
        <CardWrapper style={styles.productCard} {...cardProps}>
          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: imageUrl }} 
              style={styles.productImage} 
              resizeMode="cover" 
            />
            {product.quantity === 0 && (
              <View style={styles.outOfStockBadge}>
                <Text style={styles.outOfStockText}>Out of Stock</Text>
              </View>
            )}
          </View>

          <View style={styles.productContent}>
            <Text style={styles.productName} numberOfLines={2}>
              {product.product_name}
            </Text>

            <View style={styles.priceRow}>
              <Text style={styles.price}>₱{product.price}</Text>
              {isRental && product.rental_duration && (
                <Text style={styles.duration}>/{product.rental_duration}</Text>
              )}
            </View>

            {(product.category || product.condition) && (
              <View style={styles.tagsRow}>
                {product.category && (
                  <View style={styles.tag}>
                    <Text style={styles.tagText} numberOfLines={1}>{product.category}</Text>
                  </View>
                )}
              </View>
            )}

            {isMyProfile ? (
              <View style={styles.controls}>
                <View style={styles.quantityControl}>
                  <TouchableOpacity
                    style={[styles.quantityBtn, product.quantity <= 0 && styles.quantityBtnDisabled]}
                    onPress={() => handleQuantityChange(product, -1)}
                    disabled={product.quantity <= 0}
                  >
                    <Ionicons name="remove" size={16} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.quantityText}>{product.quantity}</Text>
                  <TouchableOpacity
                    style={styles.quantityBtn}
                    onPress={() => handleQuantityChange(product, 1)}
                  >
                    <Ionicons name="add" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.visibilityBtn}
                  onPress={() => handleToggleVisibility(product)}
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
                style={styles.messageBtn}
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
                <Ionicons name="chatbubble" size={14} color="#fff" />
                <Text style={styles.messageBtnText}>Message</Text>
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
      <View style={styles.emptyIconWrapper}>
        <Ionicons 
          name={searchQuery || selectedCategory !== 'All' ? "search" : "cube-outline"} 
          size={64} 
          color={theme.textSecondary} 
        />
      </View>
      <Text style={styles.emptyTitle}>
        {searchQuery || selectedCategory !== 'All' 
          ? 'No Results Found' 
          : `No ${activeTab === 'sale' ? 'Products' : 'Rentals'} Yet`}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery || selectedCategory !== 'All'
          ? 'Try adjusting your search or filters'
          : `Start ${activeTab === 'sale' ? 'selling' : 'renting'} by adding your first item`}
      </Text>
      {isMyProfile && !searchQuery && selectedCategory === 'All' && (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate(activeTab === 'sale' ? 'AddProduct' : 'RentItem')}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={styles.addButtonText}>
            Add {activeTab === 'sale' ? 'Product' : 'Rental'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const styles = createStyles(theme);

  if (profileLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
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
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
        />

        {/* Image Modal */}
        <Modal visible={modalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setModalVisible(false)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.modalImageScroll}
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
              <View style={styles.imageCounter}>
                <Text style={styles.imageCounterText}>
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
  background: '#0f0f2e',
  cardBackground: '#1e1e3f',
  cardBackgroundAlt: '#252550',
  text: '#ffffff',
  textSecondary: '#a0a0bb',
  textTertiary: '#8080a0',
  accent: '#FDAD00',
  accentLight: '#FFD54F',
  success: '#4CAF50',
  error: '#FF6B6B',
  warning: '#FFA726',
  borderColor: '#2a2a4a',
  divider: '#333355',
  shadowColor: '#000000',
  switchOff: '#4a4a6a',
  overlay: 'rgba(0, 0, 0, 0.7)',
};

const lightTheme = {
  background: '#f5f7fa',
  cardBackground: '#ffffff',
  cardBackgroundAlt: '#f9f9fc',
  text: '#1a1a2e',
  textSecondary: '#6a6a8a',
  textTertiary: '#8a8aaa',
  accent: '#f39c12',
  accentLight: '#f7b731',
  success: '#27ae60',
  error: '#e74c3c',
  warning: '#f39c12',
  borderColor: '#e0e0ea',
  divider: '#d0d0e0',
  shadowColor: '#000000',
  switchOff: '#d0d0e0',
  overlay: 'rgba(0, 0, 0, 0.5)',
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
  },
  listContent: {
    paddingBottom: 24,
  },
  columnWrapper: {
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },

  // App Header - Consistent Design System
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 1,
    backgroundColor: theme.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 32,
    height: 32,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
    letterSpacing: 0.5,
  },
  backIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.cardBackgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Hero Section
  heroGradient: {
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  profileSection: {
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#ffffff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FDAD00',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  verifiedText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  joinedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  joinedText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },

  // Stats Section
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  statIconWrapper: {
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
  },

  // Contact Section
  contactSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 12,
  },
  contactCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${theme.accent}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactContent: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 2,
    fontWeight: '500',
  },
  contactValue: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: theme.divider,
    marginVertical: 12,
  },

  // Action Buttons
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  verifyButton: {
    backgroundColor: '#4CAF50',
  },
  logoutButton: {
    backgroundColor: '#e74c3c',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Listings Section
  listingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  listingsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  countBadge: {
    backgroundColor: theme.accent,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Tabs
  tabsWrapper: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: theme.cardBackgroundAlt,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  activeTab: {
    backgroundColor: theme.accent,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  activeTabText: {
    color: '#ffffff',
  },

  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.borderColor,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: theme.text,
  },

  // Categories
  categoriesWrapper: {
    marginBottom: 16,
  },
  categoriesScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  activeCategoryChip: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  activeCategoryChipText: {
    color: '#ffffff',
  },

  // Product Cards
  productCardWrapper: {
    width: CARD_WIDTH,
    marginBottom: 16,
  },
  productCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    overflow: 'hidden',
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
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: CARD_WIDTH * 1.1,
    backgroundColor: theme.cardBackgroundAlt,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  outOfStockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  outOfStockText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  productContent: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.accent,
  },
  duration: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tag: {
    backgroundColor: theme.cardBackgroundAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: '100%',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textSecondary,
  },

  // Controls
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackgroundAlt,
    borderRadius: 8,
    overflow: 'hidden',
  },
  quantityBtn: {
    width: 28,
    height: 28,
    backgroundColor: theme.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityBtnDisabled: {
    backgroundColor: theme.textSecondary,
    opacity: 0.5,
  },
  quantityText: {
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  visibilityBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.cardBackgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
    marginTop: 8,
  },
  messageBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.cardBackgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImageScroll: {
    alignItems: 'center',
  },
  modalImage: {
    width: width,
    height: height * 0.7,
  },
  imageCounter: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  imageCounterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
});