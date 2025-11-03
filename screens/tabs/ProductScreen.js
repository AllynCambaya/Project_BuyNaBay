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
  const [viewMode, setViewMode] = useState('grid');

  // Enhanced animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const filterModalAnim = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  const styles = createStyles(theme);

  // Shimmer effect for loading states
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const filteredAndSortedProducts = useMemo(() => {
    let filtered = products.filter(product => {
      const matchesSearch = product.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           product.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

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
        break;
    }

    return filtered;
  }, [products, searchQuery, selectedCategory, sortBy]);

  useEffect(() => {
    if (isVisible) {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 50,
                friction: 9,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 50,
                friction: 8,
                useNativeDriver: true,
            }),
            Animated.timing(headerAnim, {
                toValue: 1,
                duration: 600,
                delay: 100,
                useNativeDriver: true,
            }),
        ]).start();
    } else {
        fadeAnim.setValue(0);
        slideAnim.setValue(50);
        scaleAnim.setValue(0.9);
        headerAnim.setValue(0);
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
      Animated.spring(filterModalAnim, {
        toValue: 0,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }).start(() => setShowFilterModal(false));
    } else {
      setShowFilterModal(true);
      Animated.spring(filterModalAnim, {
        toValue: 1,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }).start();
    }
  };

  useEffect(() => {
    if (isVisible) {
        fetchProducts();
    }
  }, [isVisible, fetchProducts]);

  const renderHeader = () => {
    const activeFiltersCount = (selectedCategory !== 'All' ? 1 : 0) + (sortBy !== 'latest' ? 1 : 0);
    
    return (
      <Animated.View 
        style={[
          styles.headerContainer,
          {
            opacity: headerAnim,
            transform: [{
              translateY: headerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-20, 0],
              }),
            }],
          }
        ]}
      >
        <View style={styles.headerTop}>
          <View style={styles.titleContainer}>
            <View style={styles.iconWrapper}>
              <Icon name="shopping-bag" size={22} color={theme.accent} />
            </View>
            <View style={styles.titleTextContainer}>
              <Text style={styles.headerTitle}>Marketplace</Text>
              <Text style={styles.headerSubtitle}>Discover amazing deals</Text>
            </View>
          </View>
          
          <View style={styles.statsContainer}>
            <View style={styles.statBadge}>
              <Text style={styles.statNumber}>{filteredAndSortedProducts.length}</Text>
              <Text style={styles.statLabel}>Items</Text>
            </View>
          </View>
        </View>

        <View style={styles.controlsRow}>
          <View style={styles.viewToggleContainer}>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'grid' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('grid')}
              activeOpacity={0.7}
            >
              <Icon 
                name="th" 
                size={15} 
                color={viewMode === 'grid' ? '#fff' : theme.textSecondary} 
              />
            </TouchableOpacity>
            <View style={styles.viewToggleDivider} />
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('list')}
              activeOpacity={0.7}
            >
              <Icon 
                name="list" 
                size={15} 
                color={viewMode === 'list' ? '#fff' : theme.textSecondary} 
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.filterBtn}
            onPress={toggleFilterModal}
            activeOpacity={0.85}
          >
            <Icon name="sliders" size={16} color="#fff" />
            <Text style={styles.filterBtnText}>Filters</Text>
            {activeFiltersCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {(selectedCategory !== 'All' || sortBy !== 'latest') && (
          <View style={styles.activeFiltersContainer}>
            {selectedCategory !== 'All' && (
              <View style={styles.activeFilterChip}>
                <Icon name="tag" size={11} color={theme.accent} />
                <Text style={styles.activeFilterText}>{selectedCategory}</Text>
                <TouchableOpacity 
                  onPress={() => setSelectedCategory('All')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon name="times-circle" size={14} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            )}
            {sortBy !== 'latest' && (
              <View style={styles.activeFilterChip}>
                <Icon name="sort" size={11} color={theme.accent} />
                <Text style={styles.activeFilterText}>
                  {SORT_OPTIONS.find(opt => opt.value === sortBy)?.label}
                </Text>
                <TouchableOpacity 
                  onPress={() => setSortBy('latest')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon name="times-circle" size={14} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </Animated.View>
    );
  };

  const renderProduct = ({ item, index }) => {
    const animatedStyle = {
      opacity: fadeAnim,
      transform: [
        {
          translateY: slideAnim.interpolate({
            inputRange: [0, 50],
            outputRange: [0, 50 * (1 + index * 0.1)],
          }),
        },
        { 
          scale: scaleAnim.interpolate({
            inputRange: [0.9, 1],
            outputRange: [0.9, 1],
          })
        },
      ],
    };

    return (
      <Animated.View style={[animatedStyle, { flex: viewMode === 'grid' ? 0.48 : 1 }]}>
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
          transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
        },
      ]}
    >
      <View style={styles.emptyIllustration}>
        <View style={styles.emptyCircle}>
          <Icon name="search" size={48} color={theme.accent} />
        </View>
        <View style={[styles.emptyCircleSmall, styles.emptyCircle1]} />
        <View style={[styles.emptyCircleSmall, styles.emptyCircle2]} />
      </View>
      
      <Text style={styles.emptyTitle}>
        {searchQuery || selectedCategory !== 'All' ? 'No Results Found' : 'No Products Yet'}
      </Text>
      <Text style={styles.emptySubtext}>
        {searchQuery || selectedCategory !== 'All'
          ? 'Try adjusting your filters or search terms\nto discover more items'
          : 'Be the first to list a product and\nstart your selling journey!'}
      </Text>
      
      {(!searchQuery && selectedCategory === 'All') && (
        <TouchableOpacity
          style={styles.emptyActionBtn}
          onPress={() => navigation.navigate('Add')}
          activeOpacity={0.85}
        >
          <View style={styles.emptyActionBtnGradient}>
            <Icon name="plus-circle" size={18} color="#fff" />
            <Text style={styles.emptyActionBtnText}>List Your First Item</Text>
          </View>
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  const renderFilterModal = () => {
    if (!showFilterModal) return null;

    const modalScale = filterModalAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.9, 1],
    });

    return (
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={toggleFilterModal}
      >
        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: filterModalAnim,
              transform: [
                { scale: modalScale },
                {
                  translateY: filterModalAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0],
                  }),
                },
              ],
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.modalHandle} />
          
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleContainer}>
              <Icon name="sliders" size={20} color={theme.accent} />
              <Text style={styles.modalTitle}>Filter & Sort</Text>
            </View>
            <TouchableOpacity 
              onPress={toggleFilterModal} 
              style={styles.modalCloseBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="times" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalScrollContent}
          >
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Category</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScrollContent}
              >
                {SALE_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryChip,
                      selectedCategory === category && styles.categoryChipActive
                    ]}
                    onPress={() => setSelectedCategory(category)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.categoryChipText,
                      selectedCategory === category && styles.categoryChipTextActive
                    ]}>
                      {category}
                    </Text>
                    {selectedCategory === category && (
                      <Icon name="check" size={12} color="#fff" style={{ marginLeft: 6 }} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.modalDivider} />

            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Sort By</Text>
              {SORT_OPTIONS.map((option, index) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.sortOptionItem,
                    sortBy === option.value && styles.sortOptionItemActive,
                    index === SORT_OPTIONS.length - 1 && { marginBottom: 0 }
                  ]}
                  onPress={() => setSortBy(option.value)}
                  activeOpacity={0.7}
                >
                  <View style={styles.sortOptionLeft}>
                    <View style={[
                      styles.sortOptionIconContainer,
                      sortBy === option.value && styles.sortOptionIconContainerActive
                    ]}>
                      <Icon 
                        name={option.icon} 
                        size={16} 
                        color={sortBy === option.value ? '#fff' : theme.textSecondary} 
                      />
                    </View>
                    <Text style={[
                      styles.sortOptionText,
                      sortBy === option.value && styles.sortOptionTextActive,
                    ]}>
                      {option.label}
                    </Text>
                  </View>
                  {sortBy === option.value && (
                    <View style={styles.sortOptionCheck}>
                      <Icon name="check-circle" size={20} color={theme.accent} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.modalResetBtn}
              onPress={() => {
                setSelectedCategory('All');
                setSortBy('latest');
              }}
              activeOpacity={0.7}
            >
              <Icon name="refresh" size={16} color={theme.textSecondary} />
              <Text style={styles.modalResetBtnText}>Reset</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.modalApplyBtn}
              onPress={toggleFilterModal}
              activeOpacity={0.85}
            >
              <Text style={styles.modalApplyBtnText}>Apply Filters</Text>
              <Icon name="arrow-right" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    const shimmerTranslate = shimmerAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [-width, width],
    });

    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <View style={styles.loadingIconContainer}>
            <Animated.View
              style={[
                styles.shimmerOverlay,
                { transform: [{ translateX: shimmerTranslate }] }
              ]}
            />
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
          <Text style={styles.loadingTitle}>Loading Marketplace</Text>
          <Text style={styles.loadingSubtext}>Fetching the latest products for you...</Text>
        </View>
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
        key={viewMode}
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
      paddingBottom: 24,
    },
    columnWrapper: {
      justifyContent: 'space-between',
      paddingHorizontal: Math.max(width * 0.04, 16),
      gap: 12,
    },
    
    // Enhanced Header Styles
    headerContainer: {
      paddingHorizontal: Math.max(width * 0.04, 16),
      paddingTop: 8,
      paddingBottom: 16,
      backgroundColor: theme.background,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    titleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    iconWrapper: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: `${theme.accent}15`,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    titleTextContainer: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: theme.text,
      letterSpacing: -0.5,
      marginBottom: 2,
    },
    headerSubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    statsContainer: {
      alignItems: 'flex-end',
    },
    statBadge: {
      backgroundColor: `${theme.accent}20`,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: `${theme.accent}30`,
      alignItems: 'center',
    },
    statNumber: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.accent,
      marginBottom: 2,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    
    // Controls Row
    controlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    viewToggleContainer: {
      flexDirection: 'row',
      backgroundColor: theme.cardBackground,
      borderRadius: 12,
      padding: 3,
      borderWidth: 1,
      borderColor: theme.borderColor,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    viewToggleBtn: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 9,
      minWidth: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewToggleBtnActive: {
      backgroundColor: theme.accent,
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    viewToggleDivider: {
      width: 1,
      height: 20,
      backgroundColor: theme.borderColor,
    },
    filterBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
      paddingVertical: 12,
      paddingHorizontal: 18,
      borderRadius: 12,
      gap: 8,
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    filterBtnText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    filterBadge: {
      backgroundColor: '#fff',
      width: 20,
      height: 20,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 4,
    },
    filterBadgeText: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: '800',
    },
    
    // Active Filters
    activeFiltersContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },
    activeFilterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.cardBackground,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      gap: 6,
      borderWidth: 1,
      borderColor: `${theme.accent}40`,
    },
    activeFilterText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.text,
    },
    
    // Empty State
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 80,
      paddingHorizontal: 32,
    },
    emptyIllustration: {
      position: 'relative',
      marginBottom: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyCircle: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: `${theme.accent}15`,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: `${theme.accent}25`,
    },
    emptyCircleSmall: {
      position: 'absolute',
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: `${theme.accent}20`,
      borderWidth: 1,
      borderColor: `${theme.accent}30`,
    },
    emptyCircle1: {
      top: 10,
      right: 15,
    },
    emptyCircle2: {
      bottom: 15,
      left: 10,
    },
    emptyTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 10,
      textAlign: 'center',
      letterSpacing: -0.5,
    },
    emptySubtext: {
      fontSize: 15,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      fontWeight: '500',
      marginBottom: 32,
    },
    emptyActionBtn: {
      borderRadius: 28,
      overflow: 'hidden',
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 8,
    },
    emptyActionBtnGradient: {
      backgroundColor: theme.accent,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 28,
      gap: 10,
    },
    emptyActionBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    
    // Enhanced Loading State
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
      paddingHorizontal: 32,
    },
    loadingContent: {
      alignItems: 'center',
    },
    loadingIconContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: `${theme.accent}15`,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: `${theme.accent}25`,
    },
    shimmerOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: `${theme.accent}20`,
      width: width * 0.5,
    },
    loadingTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 8,
      letterSpacing: -0.3,
    },
    loadingSubtext: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      fontWeight: '500',
      lineHeight: 20,
    },
    
    // Enhanced Modal Styles
    modalOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'flex-end',
      zIndex: 1000,
    },
    modalContainer: {
      backgroundColor: theme.modalBackground,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: 8,
      paddingBottom: 24,
      maxHeight: '85%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 10,
    },
    modalHandle: {
      width: 40,
      height: 5,
      backgroundColor: theme.borderColor,
      borderRadius: 3,
      alignSelf: 'center',
      marginBottom: 16,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderColor,
    },
    modalTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.text,
      letterSpacing: -0.5,
    },
    modalCloseBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.cardBackground,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    modalScrollContent: {
      paddingBottom: 16,
    },
    modalSection: {
      paddingHorizontal: 24,
      paddingVertical: 20,
    },
    modalSectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textSecondary,
      marginBottom: 14,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    modalDivider: {
      height: 1,
      backgroundColor: theme.borderColor,
      marginHorizontal: 24,
    },
    
    // Category Chips
    categoryScrollContent: {
      flexDirection: 'row',
      gap: 10,
      paddingRight: 24,
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: theme.cardBackground,
      borderWidth: 1.5,
      borderColor: theme.borderColor,
    },
    categoryChipActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    categoryChipText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    categoryChipTextActive: {
      color: '#fff',
      fontWeight: '700',
    },
    
    // Sort Options
    sortOptionItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 14,
      marginBottom: 10,
      backgroundColor: theme.cardBackground,
      borderWidth: 1.5,
      borderColor: theme.borderColor,
    },
    sortOptionItemActive: {
      backgroundColor: `${theme.accent}12`,
      borderColor: theme.accent,
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 2,
    },
    sortOptionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      flex: 1,
    },
    sortOptionIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: theme.cardBackgroundAlt,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sortOptionIconContainerActive: {
      backgroundColor: theme.accent,
    },
    sortOptionText: {
      fontSize: 15,
      color: theme.text,
      fontWeight: '500',
      flex: 1,
    },
    sortOptionTextActive: {
      fontWeight: '700',
      color: theme.text,
    },
    sortOptionCheck: {
      marginLeft: 12,
    },
    
    // Modal Footer
    modalFooter: {
      flexDirection: 'row',
      paddingHorizontal: 24,
      paddingTop: 20,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: theme.borderColor,
    },
    modalResetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 14,
      backgroundColor: theme.cardBackground,
      borderWidth: 1.5,
      borderColor: theme.borderColor,
      gap: 8,
      flex: 1,
    },
    modalResetBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    modalApplyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: 14,
      backgroundColor: theme.accent,
      gap: 10,
      flex: 2,
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    modalApplyBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
      letterSpacing: 0.3,
    },
  });