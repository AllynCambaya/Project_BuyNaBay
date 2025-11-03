import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    FlatList,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import ProductCard from '../../components/ProductCard';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

const { width } = Dimensions.get('window');

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

export default function ProductScreen({ navigation, theme, searchQuery, isVisible }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const currentUser = auth.currentUser;
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('latest');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const filterModalAnim = useRef(new Animated.Value(0)).current;

  const styles = createStyles(theme);

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

  // Initial animations
  useEffect(() => {
    if (isVisible) {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 50,
                friction: 8,
                useNativeDriver: true,
            }),
        ]).start();
    } else {
        fadeAnim.setValue(0);
        slideAnim.setValue(50);
        scaleAnim.setValue(0.9);
    }
  }, [isVisible]);

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

  useEffect(() => {
    if (isVisible) {
        fetchProducts();
    }
  }, [isVisible, fetchProducts]);

  const renderHeader = () => (
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
          onPress={() => navigation.navigate('Add')}
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
    <View style={styles.container}>
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
    </View>
  );
}

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
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
    sectionHeaderContainer: {
      marginBottom: 16,
      paddingHorizontal: Math.max(width * 0.05, 20),
    },
    sectionTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
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
      fontWeight: '700',
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
    },
    sortButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
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
      fontWeight: '700',
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
      fontWeight: '400',
    },
    addProductButton: {
      flexDirection: 'row',
      backgroundColor: theme.accent,
      paddingVertical: 14,
      paddingHorizontal: 32,
      borderRadius: 25,
      alignItems: 'center',
    },
    buttonIcon: {
      marginRight: 8,
    },
    addProductButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
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
      fontWeight: '500',
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
      fontWeight: '700',
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
      fontWeight: '400',
    },
    activeSortOptionText: {
      fontWeight: '600',
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
      fontWeight: '500',
    },
    activeFilterChipText: {
      color: '#fff',
      fontWeight: '600',
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
    },
  });