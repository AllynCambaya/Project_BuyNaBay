import { FontAwesome as Icon, Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';
import { fontFamily } from '../../theme/typography';

const { width } = Dimensions.get('window');

const RENTAL_CATEGORIES = [
  'All', 
  'Electronics', 
  'Tools', 
  'Party & Events', 
  'Sports & Outdoors', 
  'Apparel', 
  'Vehicles', 
  'Other'
];

export default function RentalScreen({ navigation, theme, searchQuery, isVisible }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isFocused = useIsFocused();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const user = auth.currentUser;
  const [userStatus, setUserStatus] = useState('not_requested');

  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';

  // Enhanced animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  const styles = createStyles(theme);

  // Shimmer effect for loading
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

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.item_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, selectedCategory]);

  // Initial animations
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

  useEffect(() => {
    if (isFocused && isVisible) fetchRentals();
  }, [isFocused, isVisible]);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        if (!user?.email) {
          setUserStatus('not_requested');
          return;
        }
        const { data, error } = await supabase
          .from('users')
          .select('status')
          .eq('email', user.email)
          .single();
        if (error || !data) setUserStatus('not_requested');
        else setUserStatus(data.status || 'not_requested');
      } catch (e) {
        setUserStatus('not_requested');
      }
    };
    fetchStatus();
  }, [user]);
  
  const fetchRentals = async () => {
    try {
      if (!refreshing) setLoading(true);
      
      const { data: rentalData, error: rentalError } = await supabase
        .from('rental_items')
        .select(
          'id, owner_email, item_name, price, rental_duration, description, category, condition, quantity, rental_item_image, is_visible, created_at'
        )
        .eq('is_visible', true)
        .order('created_at', { ascending: false });

      if (rentalError) throw rentalError;

      const itemsWithNames = await Promise.all(
        rentalData.map(async (item) => {
          const { data: userData } = await supabase
            .from('users')
            .select('name, profile_photo')
            .eq('email', item.owner_email)
            .single();

          return {
            ...item,
            seller_name: userData?.name || 'Unknown User',
            seller_avatar: userData?.profile_photo,
          };
        })
      );

      setItems(itemsWithNames || []);
    } catch (err) {
      console.error('Error fetching rentals', err.message || err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const renderListHeader = () => {
    const activeFiltersCount = selectedCategory !== 'All' ? 1 : 0;

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
              <Icon name="clock-o" size={22} color={theme.accent} />
            </View>
            <View style={styles.titleTextContainer}>
              <Text style={[styles.headerTitle, { fontFamily: fontFamily.extraBold }]}>
                Campus Rentals
              </Text>
              <Text style={[styles.headerSubtitle, { fontFamily: fontFamily.medium }]}>
                Affordable temporary solutions
              </Text>
            </View>
          </View>
          
          <View style={styles.statsContainer}>
            <View style={styles.statBadge}>
              <Text style={[styles.statNumber, { fontFamily: fontFamily.extraBold }]}>
                {filteredItems.length}
              </Text>
              <Text style={[styles.statLabel, { fontFamily: fontFamily.semiBold }]}>
                Available
              </Text>
            </View>
          </View>
        </View>

        {filteredItems.length > 0 && (
          <View style={styles.categorySection}>
            <View style={styles.categorySectionHeader}>
              <Icon name="filter" size={14} color={theme.textSecondary} />
              <Text style={[styles.categorySectionTitle, { fontFamily: fontFamily.bold }]}>
                Categories
              </Text>
              {activeFiltersCount > 0 && (
                <View style={styles.activeFilterBadge}>
                  <Text style={[styles.activeFilterBadgeText, { fontFamily: fontFamily.extraBold }]}>
                    {activeFiltersCount}
                  </Text>
                </View>
              )}
            </View>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.categoryScrollContent}
            >
              {RENTAL_CATEGORIES.map((category) => (
                <Animated.View
                  key={category}
                  style={{
                    opacity: headerAnim,
                    transform: [{
                      translateY: headerAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    }],
                  }}
                >
                  <TouchableOpacity
                    style={[
                      styles.categoryChip,
                      selectedCategory === category && styles.categoryChipActive
                    ]}
                    onPress={() => setSelectedCategory(category)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.categoryChipText,
                      selectedCategory === category && styles.categoryChipTextActive,
                      { fontFamily: selectedCategory === category ? fontFamily.bold : fontFamily.semiBold }
                    ]}>
                      {category}
                    </Text>
                    {selectedCategory === category && (
                      <Icon name="check" size={11} color="#fff" style={{ marginLeft: 6 }} />
                    )}
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </ScrollView>
          </View>
        )}

        {selectedCategory !== 'All' && (
          <Animated.View 
            style={[
              styles.activeFilterContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              }
            ]}
          >
            <View style={styles.activeFilterChipInline}>
              <Icon name="tag" size={11} color={theme.accent} />
              <Text style={[styles.activeFilterTextInline, { fontFamily: fontFamily.semiBold }]}>
                {selectedCategory}
              </Text>
              <TouchableOpacity 
                onPress={() => setSelectedCategory('All')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.clearFilterBtn}
              >
                <Icon name="times-circle" size={14} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => setSelectedCategory('All')}
              style={styles.clearAllBtn}
            >
              <Text style={[styles.clearAllText, { fontFamily: fontFamily.bold }]}>
                Clear
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </Animated.View>
    );
  };

  const renderItem = ({ item, index }) => {
    const thumbnail = item.rental_item_image || null;
    const sellerAvatar = item.seller_avatar;

    const animatedStyle = {
      opacity: fadeAnim,
      transform: [
        {
          translateY: slideAnim.interpolate({
            inputRange: [0, 50],
            outputRange: [0, 50 * (1 + index * 0.08)],
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
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('RentalDetails', { rentalItem: item })}
          activeOpacity={0.85}
        >
          <View style={styles.cardImageContainer}>
            {thumbnail ? (
              <Image source={{ uri: thumbnail }} style={styles.thumbnail} />
            ) : (
              <View style={styles.thumbnailPlaceholder}>
                <Icon name="image" size={48} color={theme.textSecondary} />
              </View>
            )}
            
            <View style={styles.imageBadgeContainer}>
              <View style={styles.conditionBadge}>
                <Icon name="star" size={10} color="#fff" />
                <Text style={[styles.conditionBadgeText, { fontFamily: fontFamily.bold }]}>
                  {item.condition}
                </Text>
              </View>
            </View>

            {/* Messaging Button - matches ProductCard */}
            <TouchableOpacity
              style={styles.messageButton}
              onPress={(e) => {
                e.stopPropagation();
                if (userStatus === 'approved') {
                  navigation.navigate('Messaging', {
                    receiverId: item.owner_email,
                    receiverName: item.seller_name,
                    productToSend: { ...item, product_name: item.item_name },
                  });
                } else {
                  navigation.navigate('GetVerified');
                }
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.cardContent}>
            <Text style={[styles.itemName, { fontFamily: fontFamily.bold }]} numberOfLines={2}>
              {item.item_name}
            </Text>

            <View style={styles.sellerRow}>
              {sellerAvatar ? (
                <Image source={{ uri: sellerAvatar }} style={styles.sellerAvatar} />
              ) : (
                <View style={[styles.sellerAvatar, styles.avatarPlaceholder]}>
                  <Icon name="user" size={11} color={theme.textSecondary} />
                </View>
              )}
              <Text style={[styles.sellerName, { fontFamily: fontFamily.medium }]} numberOfLines={1}>
                {item.seller_name}
              </Text>
            </View>

            <View style={styles.priceRow}>
              <View style={styles.priceContainer}>
                <Text style={[styles.priceAmount, { fontFamily: fontFamily.extraBold }]}>
                  ₱{item.price}
                </Text>
                <Text style={[styles.priceLabel, { fontFamily: fontFamily.medium }]}>
                  per {item.rental_duration}
                </Text>
              </View>
              
              <View style={styles.quantityBadge}>
                <Icon name="cubes" size={11} color={theme.accent} />
                <Text style={[styles.quantityText, { fontFamily: fontFamily.bold }]}>
                  {item.quantity || 0}
                </Text>
              </View>
            </View>

            {item.description && (
              <Text style={[styles.description, { fontFamily: fontFamily.regular }]} numberOfLines={2}>
                {item.description}
              </Text>
            )}

            <View style={styles.cardFooter}>
              <View style={styles.categoryTag}>
                <Icon name="tag" size={10} color={theme.textSecondary} />
                <Text style={[styles.categoryTagText, { fontFamily: fontFamily.semiBold }]}>
                  {item.category}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
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
          <Icon name="clock-o" size={48} color={theme.accent} />
        </View>
        <View style={[styles.emptyCircleSmall, styles.emptyCircle1]} />
        <View style={[styles.emptyCircleSmall, styles.emptyCircle2]} />
        <View style={[styles.emptyCircleSmall, styles.emptyCircle3]} />
      </View>
      
      <Text style={[styles.emptyTitle, { fontFamily: fontFamily.extraBold }]}>
        {searchQuery || selectedCategory !== 'All' ? 'No Rentals Found' : 'No Rental Items Yet'}
      </Text>
      <Text style={[styles.emptySubtext, { fontFamily: fontFamily.medium }]}>
        {searchQuery || selectedCategory !== 'All'
          ? 'Try adjusting your filters or search terms\nto discover available rentals'
          : 'Be the first to list an item for rent\nand start earning!'}
      </Text>
      
      <TouchableOpacity
        style={styles.emptyActionBtn}
        onPress={() => navigation.navigate('Add')}
        activeOpacity={0.85}
      >
        <View style={styles.emptyActionBtnContent}>
          <Icon name="plus-circle" size={18} color="#fff" />
          <Text style={[styles.emptyActionBtnText, { fontFamily: fontFamily.bold }]}>
            List Rental Item
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

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
          <Text style={[styles.loadingTitle, { fontFamily: fontFamily.bold }]}>
            Loading Rentals
          </Text>
          <Text style={[styles.loadingSubtext, { fontFamily: fontFamily.medium }]}>
            Finding the best rental options for you...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        renderItem={renderItem}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchRentals();
            }}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
      />
    </View>
  );
}

const createStyles = (theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    listContent: {
      paddingBottom: 24,
    },
    
    // Enhanced Header Styles - SOLID BACKGROUND (matches ProductScreen)
    headerContainer: {
      paddingHorizontal: Math.max(width * 0.04, 16),
      paddingTop: 8,
      paddingBottom: 16,
      backgroundColor: theme.background, // SOLID - no opacity
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
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
      color: theme.text,
      letterSpacing: -0.5,
      marginBottom: 2,
    },
    headerSubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
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
      color: theme.accent,
      marginBottom: 2,
    },
    statLabel: {
      fontSize: 11,
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    
    // Category Section
    categorySection: {
      marginBottom: 12,
    },
    categorySectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
    },
    categorySectionTitle: {
      fontSize: 13,
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    activeFilterBadge: {
      backgroundColor: theme.accent,
      width: 18,
      height: 18,
      borderRadius: 9,
      justifyContent: 'center',
      alignItems: 'center',
    },
    activeFilterBadgeText: {
      color: '#fff',
      fontSize: 10,
    },
    categoryScrollContent: {
      flexDirection: 'row',
      gap: 10,
      paddingRight: 16,
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
      color: theme.text,
    },
    categoryChipTextActive: {
      color: '#fff',
    },
    
    // Active Filter Display
    activeFilterContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.cardBackground,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: `${theme.accent}40`,
    },
    activeFilterChipInline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    activeFilterTextInline: {
      fontSize: 14,
      color: theme.text,
      flex: 1,
    },
    clearFilterBtn: {
      padding: 4,
    },
    clearAllBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: `${theme.accent}20`,
      borderRadius: 8,
    },
    clearAllText: {
      fontSize: 12,
      color: theme.accent,
    },
    
    // Enhanced Card Styles (matches ProductCard hierarchy)
    card: {
      backgroundColor: theme.cardBackground,
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 16,
      marginHorizontal: Math.max(width * 0.04, 16),
      borderWidth: 1,
      borderColor: theme.borderColor,
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    cardImageContainer: {
      position: 'relative',
    },
    thumbnail: {
      width: '100%',
      height: 200,
      resizeMode: 'cover',
    },
    thumbnailPlaceholder: {
      width: '100%',
      height: 200,
      backgroundColor: theme.cardBackgroundAlt,
      justifyContent: 'center',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.borderColor,
    },
    imageBadgeContainer: {
      position: 'absolute',
      top: 12,
      left: 12,
    },
    conditionBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      gap: 5,
    },
    conditionBadgeText: {
      color: '#fff',
      fontSize: 11,
    },
    // Messaging Button (matches ProductCard position and style)
    messageButton: {
      position: 'absolute',
      top: 12,
      right: 12,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.accent,
      justifyContent: 'center',
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: theme.accent,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.4,
          shadowRadius: 6,
        },
        android: {
          elevation: 5,
        },
      }),
    },
    cardContent: {
      padding: 16,
    },
    itemName: {
      fontSize: 18,
      color: theme.text,
      marginBottom: 10,
      letterSpacing: -0.3,
      lineHeight: 24,
    },
    sellerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
      gap: 8,
    },
    sellerAvatar: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: `${theme.accent}30`,
    },
    avatarPlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.cardBackgroundAlt,
    },
    sellerName: {
      fontSize: 13,
      color: theme.textSecondary,
      flex: 1,
    },
    priceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: `${theme.accent}10`,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: `${theme.accent}20`,
    },
    priceContainer: {
      flex: 1,
    },
    priceAmount: {
      fontSize: 22,
      color: theme.accent,
      marginBottom: 2,
      letterSpacing: -0.5,
    },
    priceLabel: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    quantityBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.cardBackground,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      gap: 6,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    quantityText: {
      fontSize: 13,
      color: theme.text,
    },
    description: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
      marginBottom: 14,
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.borderColor,
    },
    categoryTag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.cardBackgroundAlt,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      gap: 6,
    },
    categoryTagText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    
    // Enhanced Empty State
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
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: `${theme.accent}20`,
      borderWidth: 1,
      borderColor: `${theme.accent}30`,
    },
    emptyCircle1: {
      top: 8,
      right: 12,
    },
    emptyCircle2: {
      bottom: 12,
      left: 8,
    },
    emptyCircle3: {
      top: 40,
      left: -5,
      width: 16,
      height: 16,
      borderRadius: 8,
    },
    emptyTitle: {
      fontSize: 26,
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
    emptyActionBtnContent: {
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
      color: theme.text,
      marginBottom: 8,
      letterSpacing: -0.3,
    },
    loadingSubtext: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
  });