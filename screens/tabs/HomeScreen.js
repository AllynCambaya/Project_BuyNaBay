import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome';
import ProductCard from '../../components/ProductCard';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

const { width, height } = Dimensions.get('window');

const SALE_CATEGORIES = [
  'All',
  'Electronics',
  'Books',
  'Clothes',
  'Food',
  'Beauty & Care',
  'Toys & Games',
  'Automotive',
  'Sports',
  'Others'
];

const SORT_OPTIONS = [
  { label: 'Latest', value: 'latest', icon: 'clock-o' },
  { label: 'Price: Low to High', value: 'price_asc', icon: 'sort-amount-asc' },
  { label: 'Price: High to Low', value: 'price_desc', icon: 'sort-amount-desc' },
  { label: 'Name: A-Z', value: 'name_asc', icon: 'sort-alpha-asc' },
];

export default function HomeScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const currentUser = auth.currentUser;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('latest');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  // Automatically detect system theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const filterModalAnim = useRef(new Animated.Value(0)).current;

  // Get current theme colors based on system settings
  const theme = isDarkMode ? darkTheme : lightTheme;

  // Get safe area insets for better positioning
  const insets = useSafeAreaInsets();

  // Filter and sort products
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = products.filter(product => {
      const matchesSearch = product.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           product.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    // Sort products
    switch (sortBy) {
      case 'price_asc':
        filtered.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
        break;
      case 'price_desc':
        filtered.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
        break;
      case 'name_asc':
        filtered.sort((a, b) => a.product_name.localeCompare(b.product_name));
        break;
      case 'latest':
      default:
        // Already sorted by id descending from fetch
        break;
    }

    return filtered;
  }, [products, searchQuery, selectedCategory, sortBy]);

  const uniqueSellersCount = useMemo(() => {
    const sellerEmails = new Set(products.map(p => p.email));
    return sellerEmails.size;
  }, [products]);

  const uniqueCategoriesCount = useMemo(() => {
    const categories = new Set(products.map(p => p.category).filter(Boolean));
    return categories.size;
  }, [products]);

  // Initial animations
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
      Animated.timing(headerSlideAnim, {
        toValue: 0,
        duration: 700,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const fetchProducts = useCallback(async () => {
    if (!refreshing) setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_visible', true)
      .gt('quantity', 0)
      .order('id', { ascending: false });
    
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      const productsWithSellerNames = await Promise.all(
        data.map(async (product) => {
          const { data: sellerData, error: sellerError } = await supabase
            .from('users')
            .select('name, profile_photo')
            .eq('email', product.email)
            .single();

          if (sellerError) {
            console.error('Error fetching seller name:', sellerError.message);
          }

          return {
            ...product,
            seller_name: sellerData?.name || 'Unknown Seller',
            seller_avatar: sellerData?.profile_photo,
          };
        })
      );
      setProducts(productsWithSellerNames);
    }
    setLoading(false);
    setRefreshing(false);
  }, [refreshing]);

  const handleDelete = async (id) => {
    Alert.alert('Delete Product', 'Are you sure you want to delete this product?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('products').delete().eq('id', id);
          if (error) Alert.alert('Error', error.message);
          else {
            Alert.alert('Success', 'Product deleted successfully');
            fetchProducts();
          }
        },
      },
    ]);
  };

  const toggleFilterModal = () => {
    if (showFilterModal) {
      Animated.timing(filterModalAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowFilterModal(false));
    } else {
      setShowFilterModal(true);
      Animated.timing(filterModalAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleSortSelect = (value) => {
    setSortBy(value);
    toggleFilterModal();
  };

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);
  
  const styles = createStyles(theme, insets);

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
      </View>

      {/* Welcome Section */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>Welcome back,</Text>
        <Text style={styles.userName}>
          {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Shopper'}
        </Text>
        <Text style={styles.subtitle}>Discover amazing deals today</Text>
      </View>

      {/* Stats Section */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Icon name="shopping-bag" size={20} color={theme.accent} />
          </View>
          <Text style={styles.statValue}>{filteredAndSortedProducts.length}</Text>
          <Text style={styles.statLabel}>Products</Text>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Icon name="tags" size={20} color={theme.accent} />
          </View>
          <Text style={styles.statValue}>{uniqueCategoriesCount}</Text>
          <Text style={styles.statLabel}>Categories</Text>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Icon name="users" size={20} color={theme.accent} />
          </View>
          <Text style={styles.statValue}>{uniqueSellersCount}</Text>
          <Text style={styles.statLabel}>Sellers</Text>
        </View>
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

      {/* Section Header with Sort and View Mode */}
      <View style={styles.sectionHeaderContainer}>
        <View style={styles.sectionTitleContainer}>
          <Icon name="th-large" size={18} color={theme.text} />
          <Text style={styles.sectionTitle}> Products</Text>
          <View style={styles.productCountBadge}>
            <Text style={styles.productCountText}>
              {filteredAndSortedProducts.length}
            </Text>
          </View>
        </View>

        <View style={styles.controlsContainer}>
          {/* View Mode Toggle */}
          <View style={styles.viewModeContainer}>
            <TouchableOpacity
              style={[
                styles.viewModeButton,
                viewMode === 'grid' && styles.activeViewMode
              ]}
              onPress={() => setViewMode('grid')}
              activeOpacity={0.7}
            >
              <Icon 
                name="th" 
                size={16} 
                color={viewMode === 'grid' ? '#fff' : theme.textSecondary} 
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.viewModeButton,
                viewMode === 'list' && styles.activeViewMode
              ]}
              onPress={() => setViewMode('list')}
              activeOpacity={0.7}
            >
              <Icon 
                name="list" 
                size={16} 
                color={viewMode === 'list' ? '#fff' : theme.textSecondary} 
              />
            </TouchableOpacity>
          </View>

          {/* Filter Button */}
          <TouchableOpacity
            style={styles.sortButton}
            onPress={toggleFilterModal}
            activeOpacity={0.85}
          >
            <Icon name="filter" size={16} color="#fff" />
            <Text style={styles.sortButtonText}>Filter</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );

  const renderProduct = ({ item, index }) => {
    const animatedStyle = {
      opacity: fadeAnim,
      transform: [
        {
          translateY: slideAnim.interpolate({
            inputRange: [0, 50],
            outputRange: [0, 50],
          }),
        },
        { scale: scaleAnim },
      ],
    };

    return (
      <Animated.View style={animatedStyle}>
        <ProductCard
          product={item}
          canEdit={item.email === currentUser?.email}
          onEdit={() => navigation.navigate('EditProduct', { product: item })}
          onDelete={() => handleDelete(item.id)}
          onMessageSeller={() => {
            if (item.email !== currentUser?.email) {
              navigation.navigate('Messaging', {
                receiverId: item.email,
                receiverName: item.seller_name,
                productToSend: item,
              });
            }
          }}
          onPress={() => navigation.navigate('ProductDetails', { product: item })}
          viewMode={viewMode}
        />
      </Animated.View>
    );
  };

  const renderEmptyState = () => (
    <Animated.View
      style={[
        styles.emptyContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.emptyIconContainer}>
        <Icon name="inbox" size={64} color={theme.textSecondary} />
      </View>
      <Text style={styles.emptyTitle}>
        {searchQuery || selectedCategory !== 'All' ? 'No Results Found' : 'No Products Yet'}
      </Text>
      <Text style={styles.emptySubtext}>
        {searchQuery || selectedCategory !== 'All'
          ? 'Try adjusting your search or filters to find what you\'re looking for.'
          : 'Be the first to add a product and start selling!'}
      </Text>
      {(!searchQuery && selectedCategory === 'All') && (
        <TouchableOpacity
          style={styles.addProductButton}
          onPress={() => navigation.navigate('AddProduct')}
          activeOpacity={0.85}
        >
          <Icon name="plus" size={16} color="#fff" style={styles.buttonIcon} />
          <Text style={styles.addProductButtonText}>Add Product</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  // Filter & Sort Modal
  const renderFilterModal = () => {
    if (!showFilterModal) return null;

    return (
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={toggleFilterModal}
      >
        <Animated.View
          style={[
            styles.sortModalContainer,
            {
              opacity: filterModalAnim,
              transform: [
                {
                  translateY: filterModalAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
          // Prevent modal from closing when pressing inside it
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.sortModalHeader}>
            <Text style={styles.sortModalTitle}>Filter & Sort</Text>
            <TouchableOpacity onPress={toggleFilterModal} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="times" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Category Filter Section */}
          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>Filter by Category</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryChipContainer}
            >
                {SALE_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.filterChip,
                      selectedCategory === category && styles.activeFilterChip
                    ]}
                    onPress={() => setSelectedCategory(category)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.filterChipText,
                      selectedCategory === category && styles.activeFilterChipText
                    ]}>{category}</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>

          {/* Sort By Section */}
          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>Sort By</Text>
            {SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.sortOption,
                  sortBy === option.value && styles.activeSortOption,
                ]}
                onPress={() => setSortBy(option.value)}
                activeOpacity={0.7}
              >
                <View style={styles.sortOptionLeft}>
                  <Icon 
                    name={option.icon} 
                    size={18} 
                    color={sortBy === option.value ? theme.accent : theme.textSecondary} 
                  />
                  <Text
                    style={[
                      styles.sortOptionText,
                      sortBy === option.value && styles.activeSortOptionText,
                    ]}
                  >
                    {option.label}
                  </Text>
                </View>
                {sortBy === option.value && (
                  <Icon name="check" size={18} color={theme.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  // Full-screen loading overlay
  if (loading && !refreshing) {
    return (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
        translucent={false}
      />
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={filteredAndSortedProducts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderProduct}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          key={viewMode} // Force re-render when view mode changes
          numColumns={viewMode === 'grid' ? 2 : 1}
          columnWrapperStyle={viewMode === 'grid' ? styles.columnWrapper : null}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchProducts();
              }}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          }
        />
        {renderFilterModal()}
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
    listContent: {
      paddingBottom: 20,
    },
    columnWrapper: {
      justifyContent: 'space-between',
      paddingHorizontal: Math.max(width * 0.05, 20),
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
      paddingHorizontal: Math.max(width * 0.04, 16),
      paddingTop: insets.top > 20 ? insets.top : 20, // Use safe area insets
      paddingBottom: 20,
      zIndex: 1,
    },
    brandedLogoContainer: {
      position: 'absolute',
      top: insets.top > 20 ? insets.top : 20,
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
      top: insets.top > 20 ? insets.top : 20,
      right: Math.max(width * 0.04, 16),
      flexDirection: 'row',
      alignItems: 'center',
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
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 20,
      gap: 12,
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.cardBackground,
      borderRadius: 16,
      padding: Math.max(width * 0.03, 12),
      alignItems: 'center',
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
    statIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: `${theme.accent}20`,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 6,
    },
    statValue: {
      fontSize: Math.min(width * 0.045, 18),
      fontWeight: Platform.OS === 'android' ? '800' : '700',
      color: theme.text,
      marginTop: 4,
    },
    statLabel: {
      fontSize: Math.min(width * 0.028, 11),
      color: theme.textSecondary,
      marginTop: 2,
      fontWeight: Platform.OS === 'android' ? '500' : '400',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.inputBackground,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 4 : 2,
      marginBottom: 16,
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
    filterSection: {
      marginBottom: 16,
    },
    filterScrollContent: {
      paddingRight: Math.max(width * 0.04, 16),
      gap: 8,
    },
    filterChip: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: theme.cardBackground,
      borderWidth: 1,
      borderColor: theme.borderColor,
      marginRight: 8,
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
        },
        android: {
          elevation: 1,
        },
      }),
    },
    activeFilterChip: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
      ...Platform.select({
        ios: {
          shadowOpacity: 0.2,
          shadowRadius: 4,
        },
        android: {
          elevation: 3,
        },
      }),
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
      fontFamily: Platform.select({
        ios: 'Poppins-SemiBold',
        android: 'Poppins-Bold',
        default: 'Poppins-SemiBold',
      }),
    },
    sectionHeaderContainer: {
      marginBottom: 16,
    },
    sectionTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: Platform.OS === 'android' ? '800' : '700',
      color: theme.text,
      flex: 1,
    },
    productCountBadge: {
      backgroundColor: theme.accent,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      marginLeft: 8,
    },
    productCountText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: Platform.OS === 'android' ? '700' : '600',
    },
    controlsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    viewModeContainer: {
      flexDirection: 'row',
      backgroundColor: theme.cardBackground,
      borderRadius: 12,
      padding: 4,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    viewModeButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    },
    activeViewMode: {
      backgroundColor: theme.accent,
    },
    sortButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.accent,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      gap: 6,
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
    sortButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: Platform.OS === 'android' ? '700' : '600',
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 80,
      paddingHorizontal: 40,
    },
    emptyIconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: `${theme.accent}10`,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    emptyTitle: {
      fontSize: 24,
      fontWeight: Platform.OS === 'android' ? '800' : '700',
      color: theme.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubtext: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 24,
      fontWeight: Platform.OS === 'android' ? '500' : '400',
    },
    addProductButton: {
      flexDirection: 'row',
      backgroundColor: theme.accent,
      paddingVertical: Platform.OS === 'ios' ? 16 : 14,
      paddingHorizontal: 32,
      borderRadius: 25,
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: theme.accent,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    buttonIcon: {
      marginRight: 8,
    },
    addProductButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: Platform.OS === 'android' ? '800' : '700',
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
    },
    modalOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.overlayBackground,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    sortModalContainer: {
      backgroundColor: theme.modalBackground,
      borderRadius: 20,
      padding: 20,
      width: width * 0.85,
      maxWidth: 400,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.3,
          shadowRadius: 20,
        },
        android: {
          elevation: 10,
        },
      }),
    },
    sortModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderColor,
    },
    sortModalTitle: {
      fontSize: 20,
      fontWeight: Platform.OS === 'android' ? '800' : '700',
      color: theme.text,
    },
    sortOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      marginBottom: 8,
      backgroundColor: theme.cardBackgroundAlt,
    },
    activeSortOption: {
      backgroundColor: `${theme.accent}20`,
      borderWidth: 1,
      borderColor: theme.accent,
    },
    sortOptionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    sortOptionText: {
      fontSize: 15,
      color: theme.text,
      fontWeight: Platform.OS === 'android' ? '500' : '400',
    },
    activeSortOptionText: {
      fontWeight: Platform.OS === 'android' ? '700' : '600',
      color: theme.accent,
    },
    categoryChipContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    filterChip: {
      paddingHorizontal: 14,
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
    },
    activeFilterChipText: {
      color: '#fff',
      fontWeight: Platform.OS === 'android' ? '700' : '600',
    },
    modalSection: {
      marginBottom: 20,
    },
    modalSectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 12,
      paddingHorizontal: 8,
      fontFamily: Platform.select({
        ios: 'Poppins-SemiBold',
        android: 'Poppins-Bold',
        default: 'Poppins-SemiBold',
      }),
    },
  });