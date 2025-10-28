import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

const { width, height } = Dimensions.get('window');

const SALE_CATEGORIES = ['All', 'Electronics', 'Books', 'Clothes', 'Food', 'Beauty and Personal Care', 'Toys and Games', 'Automotive', 'Sports', 'Others'];
const RENTAL_CATEGORIES = ['All', 'Electronics', 'Tools', 'Party&Events', 'Sports&outdoors', 'Apparel', 'Vehicles', 'Other'];


export default function ProfileScreen({ navigation, route }) {
  const loggedInUser = auth.currentUser;
  const viewingUserId = route.params?.userId;
  const isMyProfile = !viewingUserId || viewingUserId === loggedInUser.email;
  const profileUserEmail = isMyProfile ? loggedInUser.email : viewingUserId;

  const [name, setName] = useState(loggedInUser?.displayName || '');
  const [email, setEmail] = useState(loggedInUser?.email || '');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [studentId, setStudentId] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [saleProducts, setSaleProducts] = useState([]);
  const [rentalProducts, setRentalProducts] = useState([]);
  const [activeTab, setActiveTab] = useState('sale');
  const [refreshing, setRefreshing] = useState(false);
  const [verified, setVerified] = useState(false);
  const [joinedDate, setJoinedDate] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [quantityModalVisible, setQuantityModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');


  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  
 
  const theme = isDarkMode ? darkTheme : lightTheme;

  const filteredSaleProducts = useMemo(() => {
    return saleProducts.filter(product => {
      const matchesSearch = product.product_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [saleProducts, searchQuery, selectedCategory]);

  const filteredRentalProducts = useMemo(() => {
    return rentalProducts.filter(product => {
      const matchesSearch = product.product_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [rentalProducts, searchQuery, selectedCategory]);

  const fetchMyProducts = useCallback(async () => {
    if (!profileUserEmail) return;
    let transformedRentalData = [];
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
      
      transformedRentalData = rentalData?.map(item => ({
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
        owner_email: item.owner_email // Add this line
      })) || [];
      setRentalProducts(transformedRentalData);
    } catch (error) {
      console.error('Error fetching products:', error);
      Alert.alert('Error', 'Failed to load your products');
    }
  }, [profileUserEmail]);

  const handleToggleVisibility = async (product) => {
    try {
      const tableName = activeTab === 'sale' ? 'products' : 'rental_items';
      const idField = 'id';
      const currentVisibility = product.is_visible ?? true;
      
      const { error } = await supabase
        .from(tableName)
        .update({ is_visible: !currentVisibility })
        .eq(idField, product.id);

      if (error) throw error;
      await fetchMyProducts();
      Alert.alert(
        'Success', 
        `${activeTab === 'sale' ? 'Product' : 'Rental item'} is now ${!currentVisibility ? 'visible' : 'hidden'} in listings`
      );
    } catch (error) {
      console.error('Error updating visibility:', error);
      Alert.alert('Error', 'Failed to update visibility');
    }
  };

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
      Alert.alert('Error', `Failed to update ${activeTab === 'sale' ? 'product' : 'rental item'} quantity`);
    }
  };

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'sale' && styles.activeTab]}
        onPress={() => {
          setActiveTab('sale');
          setSelectedCategory('All');
          setSearchQuery('');
        }}
      >
        <Text style={[styles.tabText, activeTab === 'sale' && styles.activeTabText]}>
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
      >
        <Text style={[styles.tabText, activeTab === 'rent' && styles.activeTabText]}>
          For Rent
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderCategoryFilters = () => {
    const categories = activeTab === 'sale' ? SALE_CATEGORIES : RENTAL_CATEGORIES;
    if (categories.length <= 1) return null;

    return (
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
          {categories.map(category => (
            <TouchableOpacity
              key={category}
              style={[
                styles.filterChip,
                selectedCategory === category && styles.activeFilterChip
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[
                styles.filterChipText,
                selectedCategory === category && styles.activeFilterChipText
              ]}>{category}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderProduct = ({ item: product }) => {
    const isRental = activeTab === 'rent';
    let imageUrl = isRental ? product.image : product.product_image_url;
    if (typeof imageUrl === 'string' && imageUrl.startsWith('[')) {
      try {
        const images = JSON.parse(imageUrl);
        imageUrl = images[0];
      } catch (e) {
        console.log('Error parsing image URL:', e);
      }
    }

    const CardWrapper = isMyProfile ? View : TouchableOpacity;
    const cardProps = isMyProfile
      ? {}
      : {
          onPress: () => {
            if (isRental) {
              navigation.navigate('RentalDetails', { rentalItem: product });
            } else {
              navigation.navigate('ProductDetails', { product: product });
            }
          },
          activeOpacity: 0.85,
        };

    return (
      <CardWrapper style={styles.productCard} {...cardProps}>
        <Image source={{ uri: imageUrl }} style={styles.productImage} resizeMode="cover" />
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{product.product_name}</Text>

          <View style={styles.productMetaRow}>
            <View style={styles.priceContainer}>
              <Text style={styles.priceLabel}>Price</Text>
              <Text style={styles.productPrice}>
                <Text>₱{product.price}</Text>
                {isRental && product.rental_duration && (
                  <Text style={styles.rentalDuration}> /{product.rental_duration}</Text>
                )}
              </Text>
            </View>
            {isMyProfile && (
              <View style={styles.quantityContainer}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => handleQuantityChange(product, -1)}
                  disabled={product.quantity <= 0}
                >
                  <Icon name="minus" size={16} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.quantityText}>{product.quantity}</Text>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => handleQuantityChange(product, 1)}
                >
                  <Icon name="plus" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={[styles.categoryRow, { marginTop: 8 }]}>
            {product.category && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{product.category}</Text>
              </View>
            )}
            {product.condition && (
              <View style={styles.conditionBadge}>
                <Text style={styles.conditionText}>{product.condition}</Text>
              </View>
            )}
          </View>

          {isMyProfile ? (
            <View style={styles.availabilityContainer}>
              <Text style={styles.availabilityLabel}>Show in listings:</Text>
              <Switch
                value={product.is_visible ?? true}
                onValueChange={() => handleToggleVisibility(product)}
                trackColor={{ false: theme.buttonDisabled, true: theme.accent }}
                thumbColor="#fff"
              />
            </View>
          ) : (
            <TouchableOpacity
              style={styles.messageButton}
              onPress={(e) => {
                e.stopPropagation(); // Prevent card's onPress from firing
                navigation.navigate('Messaging', {
                  receiverId: isRental ? product.owner_email : product.email,
                  receiverName: name,
                  productToSend: product,
                });
              }}
            >
              <Ionicons name="chatbubble" size={14} color="#fff" />
              <Text style={styles.messageButtonText}>Message Seller</Text>
            </TouchableOpacity>
          )}
        </View>
      </CardWrapper>
    );
  };



  const handleUpdateQuantity = async (product, newQuantity) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ 
          quantity: newQuantity,
          is_available: newQuantity > 0 
        })
        .eq('id', product.id);

      if (error) throw error;
      
      setQuantityModalVisible(false);
      setEditingProduct(null);
      fetchMyProducts();
      Alert.alert('Success', 'Product quantity updated');
    } catch (error) {
      console.error('Error updating quantity:', error);
      Alert.alert('Error', 'Failed to update product quantity');
    }
  };

  useEffect(() => {
    fetchMyProducts();
  }, [fetchMyProducts]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;



  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(headerSlideAnim, {
        toValue: 0,
        duration: 700,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const fetchProfile = async () => {
    if (!profileUserEmail) return;

    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('name, phone_number, student_id, profile_photo, created_at')
        .eq('email', profileUserEmail)
        .maybeSingle();

      if (error) {
        console.log('Fetch error:', error.message);
        return;
      }

      setEmail(profileUserEmail);
      setName(data.name || '');
      setPhoneNumber(data.phone_number || '');
      setStudentId(data.student_id || '');
      setProfilePhoto(data.profile_photo || null);

      if (data.created_at) {
        const date = new Date(data.created_at);
        const formatted = `Joined ${date.toLocaleString('default', {
          month: 'long',
          year: 'numeric',
        })}`;
        setJoinedDate(formatted);
      }

      const { data: verificationData, error: verificationError } = await supabase
        .from('verifications')
        .select('status')
        .eq('email', profileUserEmail)
        .single();

      if (verificationError && verificationError.code !== 'PGRST116') {
        console.log('Verification fetch error:', verificationError.message);
      }

      setVerified(verificationData?.status === 'approved');
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setProfileLoading(false);
    }
  };



  useEffect(() => {
    fetchProfile();
    fetchMyProducts();
  }, [profileUserEmail, fetchMyProducts]);

  useEffect(() => {
    if (!profileUserEmail) return;

    const channel = supabase
      .channel(`verifications-${profileUserEmail}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'verifications', filter: `email=eq.${profileUserEmail}` },
        (payload) => {
          const status = payload.new?.status;
          setVerified(status === 'approved');
          fetchProfile();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileUserEmail]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProfile();
    await fetchMyProducts();
    setRefreshing(false);
  }, []);

  const handleGetVerified = () => navigation.navigate('GetVerified');

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
              await loggedInUser.signOut();
              navigation.replace('Login');
            } catch (error) {
              Alert.alert('Logout Error', error.message);
            }
          },
        },
      ]
    );
  };

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

  const getAvatarSource = () => {
    if (profilePhoto) return { uri: profilePhoto };
    return {
      uri: supabase.storage
        .from('profile-avatars')
        .getPublicUrl('default-avatar.jpg').data.publicUrl,
    };
  };

  const openImageModal = (imageUrls) => {
    if (!imageUrls || imageUrls.length === 0) return;
    const images = typeof imageUrls === 'string' ? [imageUrls] : imageUrls;
    setSelectedImages(images);
    setModalVisible(true);
  };



  const renderHeader = () => (
    <View style={styles.headerContentContainer}>
      {!isMyProfile && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
      )}
      <View style={styles.backgroundGradient} />
      <Animated.View 
        style={[
          styles.profileHeader, 
          {
            transform: [{ translateY: headerSlideAnim }],
            opacity: fadeAnim,
          }
        ]}
      >
        <TouchableOpacity onPress={isMyProfile ? handleImagePick : undefined} style={styles.avatarContainer} disabled={!isMyProfile}>
          <Image source={getAvatarSource()} style={styles.avatar} />
          {isMyProfile && (
            <View style={styles.cameraIconContainer}>
              <Icon name="camera" size={16} color="#fff" />
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.nameContainer}>
          <Text style={styles.userName}>{name || 'N/A'}</Text>
          {verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>

        {joinedDate ? (
          <View style={styles.joinedContainer}>
            <Icon name="calendar" size={12} color={theme.textSecondary} />
            <Text style={styles.joinedText}> {joinedDate}</Text>
          </View>
        ) : null}
      </Animated.View>

      <Animated.View
        style={[
          styles.infoSection,
          {
            transform: [{ translateY: slideAnim }],
            opacity: fadeAnim,
          }
        ]}
      >
        <View style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <Icon name="envelope" size={16} color={theme.accent} />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{email || 'N/A'}</Text>
          </View>
        </View>

        {verified && (
          <>
            <View style={styles.infoCard}>
              <View style={styles.infoIconContainer}>
                <Icon name="phone" size={16} color={theme.accent} />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Phone Number</Text>
                <Text style={styles.infoValue}>{phoneNumber || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoIconContainer}>
                <Icon name="id-card" size={16} color={theme.accent} />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Student ID</Text>
                <Text style={styles.infoValue}>{studentId || 'N/A'}</Text>
              </View>
            </View>
          </>
        )}

        {isMyProfile && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.verifyButton]}
              onPress={handleGetVerified}
              activeOpacity={0.85}
            >
              <Icon name="shield" size={16} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>Get Verified</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.logoutButton]}
              onPress={handleLogout}
              activeOpacity={0.85}
            >
              <Icon name="sign-out" size={16} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      <View style={styles.sectionHeader}>
        <Icon name="shopping-bag" size={20} color={theme.text} />
        <Text style={styles.sectionTitle}> My Products</Text>
        <View style={styles.productCountBadge}>
          <Text style={styles.productCountText}>
            {activeTab === 'sale' ? filteredSaleProducts.length : filteredRentalProducts.length}
          </Text>
        </View>
      </View>

      {renderTabs()}

      <View style={styles.searchContainer}>
        <Icon name="search" size={18} color={theme.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={`Search in your ${activeTab === 'sale' ? 'products' : 'rentals'}...`}
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearIcon}><Ionicons name="close-circle" size={20} color={theme.textSecondary} /></TouchableOpacity>
        )}
      </View>

      {renderCategoryFilters()}
    </View>
  );

  const styles = createStyles(theme);

  if (profileLoading) {
    return (
      <View style={styles.loadingOverlay}>
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
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={activeTab === 'sale' ? filteredSaleProducts : filteredRentalProducts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderProduct}
          ListHeaderComponent={renderHeader}
          // Sticky header to keep tabs and search bar visible
          stickyHeaderIndices={[0]}
          // The actual header is now part of the scroll view, so we don't need a separate component for it
          // but we need to wrap it to make it sticky
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="inbox" size={48} color={theme.textSecondary} />
              <Text style={styles.emptyTitle}>
                {searchQuery || selectedCategory !== 'All' ? 'No Results Found' : `No ${activeTab === 'sale' ? 'Products' : 'Rentals'} Yet`}
              </Text>
              <Text style={styles.emptySubtext}>
                {searchQuery || selectedCategory !== 'All'
                  ? `No items match your criteria`
                  : `Start ${activeTab === 'sale' ? 'selling' : 'renting'} by adding your first item`}
              </Text>
              {isMyProfile && (
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: theme.accent }]}
                  onPress={() => navigation.navigate(activeTab === 'sale' ? 'AddProduct' : 'RentItem')}
                >
                  <Icon name="plus" size={16} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.buttonText}>
                    Add {activeTab === 'sale' ? 'Product' : 'Rental Item'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />

        <Modal visible={modalVisible} transparent={true} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
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
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close-circle" size={40} color="#fff" />
              </TouchableOpacity>
              {selectedImages.length > 1 && (
                <View style={styles.imageIndicator}>
                  <Text style={styles.imageIndicatorText}>
                    Swipe to view all {selectedImages.length} images
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const darkTheme = {
  background: '#0f0f2e',
  gradientBackground: '#1b1b41',
  text: '#fff',
  textSecondary: '#bbb',
  textTertiary: '#ccc',
  cardBackground: '#1e1e3f',
  cardBackgroundAlt: '#252550',
  inputBackground: '#fff',
  inputText: '#333',
  inputIcon: '#666',
  placeholder: '#999',
  accent: '#FDAD00',
  accentSecondary: '#e8ecf1',
  buttonDisabled: '#4a4a6a',
  error: '#FF6B6B',
  success: '#4CAF50',
  verifyColor: '#fbc02d',
  logoutColor: '#d32f2f',
  divider: '#333',
  borderColor: '#2a2a4a',
  shadowColor: '#000',
};

const lightTheme = {
  background: '#f5f7fa',
  gradientBackground: '#e8ecf1',
  text: '#1a1a2e',
  textSecondary: '#4a4a6a',
  textTertiary: '#2c2c44',
  cardBackground: '#ffffff',
  cardBackgroundAlt: '#f9f9fc',
  inputBackground: '#ffffff',
  inputText: '#1a1a2e',
  inputIcon: '#7a7a9a',
  placeholder: '#9a9ab0',
  accent: '#f39c12',
  accentSecondary: '#e67e22',
  buttonDisabled: '#d0d0e0',
  error: '#e74c3c',
  success: '#27ae60',
  verifyColor: '#f39c12',
  logoutColor: '#e74c3c',
  divider: '#d0d0e0',
  borderColor: '#e0e0ea',
  shadowColor: '#000',
};

const createStyles = (theme) => StyleSheet.create({
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: theme.cardBackgroundAlt,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: theme.accent,
  },
  tabText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
  activeTabText: {
    color: '#fff',
    fontWeight: Platform.OS === 'android' ? '700' : '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: theme.text,
    fontSize: 15,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  clearIcon: {
    padding: 4,
  },
  filterContainer: {
    paddingBottom: 16,
  },
  filterScrollContent: {
    paddingHorizontal: 0,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  activeFilterChip: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  filterChipText: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
  activeFilterChipText: {
    color: '#fff',
    fontWeight: Platform.OS === 'android' ? '700' : '600',
  },
  productControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.borderColor,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackgroundAlt,
    borderRadius: 8,
    overflow: 'hidden',
  },
  quantityButton: {
    padding: 8,
    backgroundColor: theme.accent,
  },
  quantityText: {
    paddingHorizontal: 16,
    fontSize: 16,
    color: theme.text,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
  },
  availabilityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  availabilityLabel: {
    marginRight: 8,
    fontSize: 14,
    color: theme.textSecondary,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 16,
    alignSelf: 'flex-end',
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
  messageButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 6,
  },
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  listContent: {
    paddingBottom: 20,
  },
  productSectionContainer: {
    paddingHorizontal: Math.max(width * 0.05, 20),
    marginBottom: 16,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 220 : 240,
    backgroundColor: theme.gradientBackground,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    zIndex: 0,
  },
  headerContentContainer: {
    paddingHorizontal: Math.max(width * 0.05, 20),
    paddingTop: 20,
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 30,
    zIndex: 2,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: theme.accent,
    ...Platform.select({
      ios: {
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.accent,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.background,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  userName: {
    fontSize: Math.min(width * 0.065, 26),
    color: theme.text,
    fontWeight: Platform.OS === 'android' ? '900' : '800',
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  verifiedText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  joinedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  joinedText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  infoSection: {
    marginBottom: 30,
    zIndex: 1,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${theme.accent}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 2,
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  infoValue: {
    fontSize: 16,
    color: theme.text,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
  buttonContainer: {
    marginTop: 8,
  },
  button: {
    flexDirection: 'row',
    paddingVertical: Platform.OS === 'ios' ? 16 : 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  verifyButton: {
    backgroundColor: theme.verifyColor,
  },
  logoutButton: {
    backgroundColor: theme.logoutColor,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    color: theme.text,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
    flex: 1,
  },
  productCountBadge: {
    backgroundColor: theme.accent,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  productCountText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  productCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  productImage: {
    width: '100%',
    height: 200,
  },
  imageCountBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  imageCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
  productInfo: {
    padding: 16,
  },
  productName: {
    fontSize: 18,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    color: theme.text,
    marginBottom: 6,
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  productDesc: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  productMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  priceContainer: {
    backgroundColor: `${theme.accent}20`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  priceLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 2,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackgroundAlt,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  metaText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  productPrice: {
    fontSize: 18,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    color: theme.accent,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  rentalDuration: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productQuantity: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryBadge: {
    backgroundColor: `${theme.accentSecondary}20`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 12,
    color: theme.accentSecondary,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
  conditionBadge: {
    backgroundColor: `${theme.success}20`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  conditionText: {
    fontSize: 12,
    color: theme.success,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    color: theme.text,
    marginTop: 16,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  emptyText: {
    fontSize: 18,
    color: theme.textSecondary,
    marginTop: 16,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '80%',
    justifyContent: 'center',
  },
  modalImage: {
    width: width,
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    right: 20,
    zIndex: 10,
  },
  imageIndicator: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  imageIndicatorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  loadingText: {
    color: theme.text,
    marginTop: 16,
    fontSize: 16,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
});