import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
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
  useColorScheme,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import ProductCard from '../../components/ProductCard';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

const { width, height } = Dimensions.get('window');

const SALE_CATEGORIES = ['All', 'Electronics', 'Books', 'Clothes', 'Food', 'Beauty and Personal Care', 'Toys and Games', 'Automotive', 'Sports', 'Others'];

export default function HomeScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const currentUser = auth.currentUser;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Automatically detect system theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  // Get current theme colors based on system settings
  const theme = isDarkMode ? darkTheme : lightTheme;

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.product_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

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
            .select('name')
            .eq('email', product.email)
            .single();

          if (sellerError) {
            console.error('Error fetching seller name:', sellerError.message);
          }

          return {
            ...product,
            seller_name: sellerData?.name || 'Unknown Seller',
          };
        })
      );
      setProducts(productsWithSellerNames);
    }
    setLoading(false);
    setRefreshing(false);
  }, [refreshing]);

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
              Alert.alert('Logout Failed', error.message);
            }
          },
        },
      ]
    );
  };

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

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const styles = createStyles(theme);

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
          {/* Optional: Add notification badge */}
          {/* <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>3</Text>
          </View> */}
        </TouchableOpacity>

        {/* Logout Button */}
        <TouchableOpacity
          onPress={handleLogout}
          style={[styles.actionButton, styles.logoutButton]}
          activeOpacity={0.85}
        >
          <Icon name="sign-out" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Welcome Section */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>Welcome back,</Text>
        <Text style={styles.userName}>{currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Shopper'}</Text>
        <Text style={styles.subtitle}>Discover amazing deals today</Text>
      </View>

      {/* Stats Section */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Icon name="shopping-bag" size={20} color={theme.accent} />
          <Text style={styles.statValue}>{filteredProducts.length}</Text>
          <Text style={styles.statLabel}>Products</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="tags" size={20} color={theme.accent} />
          <Text style={styles.statValue}>{uniqueCategoriesCount}</Text>
          <Text style={styles.statLabel}>Categories</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="users" size={20} color={theme.accent} />
          <Text style={styles.statValue}>{uniqueSellersCount}</Text>
          <Text style={styles.statLabel}>Sellers</Text>
        </View>
      </View>

      {/* Section Title */}
      <View style={styles.sectionTitleContainer}>
        <Icon name="th-large" size={18} color={theme.text} />
        <Text style={styles.sectionTitle}> All Products</Text>
        <View style={styles.productCountBadge}>
          <Text style={styles.productCountText}>
            {filteredProducts.length}
          </Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Icon name="search" size={18} color={theme.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearIcon}><Ionicons name="close-circle" size={20} color={theme.textSecondary} /></TouchableOpacity>
        )}
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
          {SALE_CATEGORIES.map(category => (
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
                receiverName: item.seller_name, // Pass seller name for a better UX
                productToSend: item, // Pass the product object
              });
            }
          }}
          onPress={() => navigation.navigate('ProductDetails', { product: item })}
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
      <Icon name="inbox" size={64} color={theme.textSecondary} />
      <Text style={styles.emptyTitle}>No Products Yet</Text>
      {searchQuery || selectedCategory !== 'All' ? (
        <Text style={styles.emptySubtext}>
          No products match your search criteria.
        </Text>
      ) : (
        <Text style={styles.emptySubtext}>
          Be the first to add a product and start selling!
        </Text>
      )}
      <TouchableOpacity
        style={styles.addProductButton}
        onPress={() => navigation.navigate('AddProduct')}
        activeOpacity={0.85}
      >
        <Icon name="plus" size={16} color="#fff" style={styles.buttonIcon} />
        <Text style={styles.addProductButtonText}>Add Product</Text>
      </TouchableOpacity>
    </Animated.View>
  );

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
          data={filteredProducts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderProduct}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
  accent: '#FDAD00',
  accentSecondary: '#e8ecf1',
  notificationColor: '#4CAF50',
  logoutColor: '#d32f2f',
  shadowColor: '#000',
  borderColor: '#2a2a4a',
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
  accent: '#f39c12',
  accentSecondary: '#e67e22',
  notificationColor: '#27ae60',
  logoutColor: '#e74c3c',
  shadowColor: '#000',
  borderColor: '#e0e0ea',
};

const createStyles = (theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    listContent: {
      paddingBottom: 20,
    },
    backgroundGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: Platform.OS === 'ios' ? 280 : 300,
      backgroundColor: theme.gradientBackground,
      borderBottomLeftRadius: 30,
      borderBottomRightRadius: 30,
      zIndex: 0,
    },
    headerContainer: {
      paddingHorizontal: Math.max(width * 0.05, 20),
      paddingTop: Platform.OS === 'ios' ? 10 : 20,
      paddingBottom: 20,
      zIndex: 1,
    },
    brandedLogoContainer: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 10 : 20,
      left: 20,
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
      fontFamily: Platform.select({
        ios: 'Poppins-Bold',
        android: 'Poppins-ExtraBold',
        default: 'Poppins-Bold',
      }),
      letterSpacing: -0.5,
    },
    headerActionsContainer: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 10 : 20,
      right: 20,
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
    notificationBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      backgroundColor: '#FF3B30',
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: theme.background,
    },
    notificationBadgeText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: Platform.OS === 'android' ? '700' : '600',
      fontFamily: Platform.select({
        ios: 'Poppins-SemiBold',
        android: 'Poppins-Bold',
        default: 'Poppins-SemiBold',
      }),
    },
    welcomeSection: {
      marginTop: 70,
      marginBottom: 24,
    },
    welcomeText: {
      fontSize: 16,
      color: theme.textSecondary,
      fontWeight: Platform.OS === 'android' ? '500' : '400',
      fontFamily: Platform.select({
        ios: 'Poppins-Regular',
        android: 'Poppins-Medium',
        default: 'Poppins-Regular',
      }),
      marginBottom: 4,
    },
    userName: {
      fontSize: Math.min(width * 0.08, 32),
      color: theme.text,
      fontWeight: Platform.OS === 'android' ? '900' : '800',
      fontFamily: Platform.select({
        ios: 'Poppins-ExtraBold',
        android: 'Poppins-Black',
        default: 'Poppins-ExtraBold',
      }),
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: Platform.OS === 'android' ? '500' : '400',
      fontFamily: Platform.select({
        ios: 'Poppins-Regular',
        android: 'Poppins-Medium',
        default: 'Poppins-Regular',
      }),
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 24,
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
          shadowRadius: 4,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    statValue: {
      fontSize: 20,
      fontWeight: Platform.OS === 'android' ? '800' : '700',
      color: theme.text,
      marginTop: 8,
      fontFamily: Platform.select({
        ios: 'Poppins-Bold',
        android: 'Poppins-ExtraBold',
        default: 'Poppins-Bold',
      }),
    },
    statLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
      fontWeight: Platform.OS === 'android' ? '500' : '400',
      fontFamily: Platform.select({
        ios: 'Poppins-Regular',
        android: 'Poppins-Medium',
        default: 'Poppins-Regular',
      }),
    },
    sectionTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      marginTop: 8,
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
    fontWeight: '600',
  },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 80,
      paddingHorizontal: 40,
    },
    emptyTitle: {
      fontSize: 24,
      fontWeight: Platform.OS === 'android' ? '800' : '700',
      color: theme.text,
      marginTop: 20,
      marginBottom: 8,
      fontFamily: Platform.select({
        ios: 'Poppins-Bold',
        android: 'Poppins-ExtraBold',
        default: 'Poppins-Bold',
      }),
    },
    emptySubtext: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 24,
      fontWeight: Platform.OS === 'android' ? '500' : '400',
      fontFamily: Platform.select({
        ios: 'Poppins-Regular',
        android: 'Poppins-Medium',
        default: 'Poppins-Regular',
      }),
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
      fontFamily: Platform.select({
        ios: 'Poppins-Bold',
        android: 'Poppins-ExtraBold',
        default: 'Poppins-Bold',
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
    fontWeight: '500',
  },
  activeFilterChipText: {
    color: '#fff',
    fontWeight: '700',
    },
  });