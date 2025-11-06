import { FontAwesome as Icon, Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
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
  StyleSheet,
  Text,
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

const getRelativeTime = (dateString) => {
  const now = new Date();
  const past = new Date(dateString);
  const diffInSeconds = Math.floor((now - past) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return past.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function LostAndFoundScreen({ navigation, theme, searchQuery, isVisible }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('lost'); // 'lost' or 'found'
  const isFocused = useIsFocused();
  const currentUser = auth.currentUser;

  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const activeTheme = theme || (isDarkMode ? darkTheme : lightTheme);

  // Enhanced animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  const styles = createStyles(activeTheme);

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

  // Initial animations
  useEffect(() => {
    if (isVisible || isFocused) {
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
  }, [isVisible, isFocused]);

  const fetchItems = useCallback(async () => {
    if (!refreshing) setLoading(true);
    const { data, error } = await supabase
      .from('lost_and_found_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      Alert.alert('Error', 'Could not fetch items.');
      console.error(error);
    } else {
      setItems(data || []);
    }
    setLoading(false);
    setRefreshing(false);
  }, [refreshing]);

  useEffect(() => {
    if (isFocused || isVisible) {
      fetchItems();
    }
  }, [isFocused, isVisible, fetchItems]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchItems();
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesFilter = item.item_status === filter;
      const matchesSearch =
        item.item_name?.toLowerCase().includes(searchQuery?.toLowerCase() || '') ||
        item.description?.toLowerCase().includes(searchQuery?.toLowerCase() || '') ||
        item.location?.toLowerCase().includes(searchQuery?.toLowerCase() || '');
      return matchesFilter && matchesSearch;
    });
  }, [items, searchQuery, filter]);

  const renderHeader = () => {
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
              <Icon name="search" size={22} color={activeTheme.accent} />
            </View>
            <View style={styles.titleTextContainer}>
              <Text style={[styles.headerTitle, { fontFamily: fontFamily.extraBold }]}>
                Lost & Found
              </Text>
              <Text style={[styles.headerSubtitle, { fontFamily: fontFamily.medium }]}>
                Helping you find what matters
              </Text>
            </View>
          </View>
          
          <View style={styles.statsContainer}>
            <View style={styles.statBadge}>
              <Text style={[styles.statNumber, { fontFamily: fontFamily.extraBold }]}>
                {filteredItems.length}
              </Text>
              <Text style={[styles.statLabel, { fontFamily: fontFamily.semiBold }]}>
                Items
              </Text>
            </View>
          </View>
        </View>

        {/* Status Filter */}
        <View style={styles.statusFilterContainer}>
          {['lost', 'found'].map(status => (
            <TouchableOpacity
              key={status}
              style={[
                styles.statusChip,
                filter === status && styles.statusChipActive
              ]}
              onPress={() => setFilter(status)}
              activeOpacity={0.7}
            >
              <Icon 
                name={status === 'lost' ? 'frown-o' : 'smile-o'} 
                size={14} 
                color={filter === status ? '#fff' : activeTheme.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text style={[
                styles.statusChipText,
                filter === status && styles.statusChipTextActive,
                { fontFamily: filter === status ? fontFamily.bold : fontFamily.semiBold }
              ]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
              {filter === status && (
                <Icon name="check" size={11} color="#fff" style={{ marginLeft: 6 }} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    );
  };

  const renderItem = ({ item, index }) => {
    const imageUrl = item.lost_and_found_url?.[0] || item.image_urls?.[0];
    
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
          onPress={() => navigation.navigate('LostAndFoundDetails', { item })}
          activeOpacity={0.85}
        >
          <View style={styles.cardImageContainer}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.cardImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Icon name="image" size={48} color={activeTheme.textSecondary} />
              </View>
            )}
            
            {/* Status Badge */}
            <View style={styles.imageBadgeContainer}>
              <View style={[
                styles.statusBadge,
                item.item_status === 'lost' ? styles.lostBadge : styles.foundBadge
              ]}>
                <Icon 
                  name={item.item_status === 'lost' ? 'frown-o' : 'smile-o'} 
                  size={11} 
                  color="#fff" 
                />
                <Text style={[styles.statusBadgeText, { fontFamily: fontFamily.bold }]}>
                  {item.item_status === 'lost' ? 'Lost' : 'Found'}
                </Text>
              </View>
            </View>

            {/* Message Button */}
            <TouchableOpacity
              style={styles.messageButton}
              onPress={(e) => {
                e.stopPropagation();
                navigation.navigate('Messaging', {
                  receiverId: item.user_email,
                  receiverName: item.user_name || 'User',
                });
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

            {/* User Info */}
            <View style={styles.userRow}>
              <Image 
                source={{ uri: item.user_avatar || 'https://ui-avatars.com/api/?name=' + (item.user_name || 'User') }} 
                style={styles.userAvatar} 
              />
              <Text style={[styles.userName, { fontFamily: fontFamily.medium }]} numberOfLines={1}>
                {item.user_name || 'Anonymous'}
              </Text>
            </View>

            {/* Location & Time */}
            <View style={styles.metaContainer}>
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={14} color={activeTheme.textSecondary} />
                <Text style={[styles.metaText, { fontFamily: fontFamily.medium }]} numberOfLines={1}>
                  {item.location || 'Location not specified'}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={14} color={activeTheme.textSecondary} />
                <Text style={[styles.metaText, { fontFamily: fontFamily.medium }]}>
                  {getRelativeTime(item.created_at)}
                </Text>
              </View>
            </View>

            {/* Description */}
            {item.description && (
              <Text style={[styles.description, { fontFamily: fontFamily.regular }]} numberOfLines={2}>
                {item.description}
              </Text>
            )}

            {/* Footer with Category */}
            <View style={styles.cardFooter}>
              <View style={styles.timeTag}>
                <Icon name="clock-o" size={10} color={activeTheme.textSecondary} />
                <Text style={[styles.timeTagText, { fontFamily: fontFamily.semiBold }]}>
                  {getRelativeTime(item.created_at)}
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
          <Icon name="search" size={48} color={activeTheme.accent} />
        </View>
        <View style={[styles.emptyCircleSmall, styles.emptyCircle1]} />
        <View style={[styles.emptyCircleSmall, styles.emptyCircle2]} />
        <View style={[styles.emptyCircleSmall, styles.emptyCircle3]} />
      </View>
      
      <Text style={[styles.emptyTitle, { fontFamily: fontFamily.extraBold }]}>
        {searchQuery ? 'No Items Found' : `No ${filter.charAt(0).toUpperCase() + filter.slice(1)} Items Yet`}
      </Text>
      <Text style={[styles.emptySubtext, { fontFamily: fontFamily.medium }]}>
        {searchQuery
          ? 'Try adjusting your search terms\nto discover more items'
          : `Be the first to report a ${filter} item\nand help the community!`}
      </Text>
      
      {!searchQuery && (
        <TouchableOpacity
          style={styles.emptyActionBtn}
          onPress={() => navigation.navigate('Add')}
          activeOpacity={0.85}
        >
          <View style={styles.emptyActionBtnContent}>
            <Icon name="plus-circle" size={18} color="#fff" />
            <Text style={[styles.emptyActionBtnText, { fontFamily: fontFamily.bold }]}>
              Report an Item
            </Text>
          </View>
        </TouchableOpacity>
      )}
    </Animated.View>
  );

  if (loading && !refreshing) {
    const shimmerTranslate = shimmerAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [-width, width],
    });

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingContent}>
            <View style={styles.loadingIconContainer}>
              <Animated.View
                style={[
                  styles.shimmerOverlay,
                  { transform: [{ translateX: shimmerTranslate }] }
                ]}
              />
              <ActivityIndicator size="large" color={activeTheme.accent} />
            </View>
            <Text style={[styles.loadingTitle, { fontFamily: fontFamily.bold }]}>
              Loading Items
            </Text>
            <Text style={[styles.loadingSubtext, { fontFamily: fontFamily.medium }]}>
              Fetching lost and found items...
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={item => item.id?.toString() || Math.random().toString()}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={activeTheme.accent}
            colors={[activeTheme.accent]}
          />
        }
      />
    </SafeAreaView>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    listContent: {
      paddingBottom: 24,
    },
    
    // Enhanced Header - SOLID BACKGROUND
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
    
    // Status Filter
    statusFilterContainer: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },
    statusChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: theme.cardBackground,
      borderWidth: 1.5,
      borderColor: theme.borderColor,
    },
    statusChipActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    statusChipText: {
      fontSize: 14,
      color: theme.text,
    },
    statusChipTextActive: {
      color: '#fff',
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
    
    // Active Filters Display
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
    activeFiltersRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      flex: 1,
    },
    activeFilterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.cardBackgroundAlt || theme.background,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 16,
      gap: 6,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    activeFilterText: {
      fontSize: 12,
      color: theme.text,
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
    
    // Card Styles
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
          shadowColor: theme.shadowColor || '#000',
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
    cardImage: {
      width: '100%',
      height: 200,
      resizeMode: 'cover',
    },
    imagePlaceholder: {
      width: '100%',
      height: 200,
      backgroundColor: theme.cardBackgroundAlt || theme.background,
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
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      gap: 5,
    },
    lostBadge: {
      backgroundColor: theme.lost || '#EF4444',
    },
    foundBadge: {
      backgroundColor: theme.found || '#10B981',
    },
    statusBadgeText: {
      color: '#fff',
      fontSize: 11,
      textTransform: 'uppercase',
    },
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
      marginBottom: 12,
      letterSpacing: -0.3,
      lineHeight: 24,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
    },
    userAvatar: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: `${theme.accent}30`,
    },
    userName: {
      fontSize: 13,
      color: theme.textSecondary,
      flex: 1,
    },
    metaContainer: {
      marginBottom: 12,
      gap: 6,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    metaText: {
      fontSize: 13,
      color: theme.textSecondary,
      flex: 1,
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
      backgroundColor: theme.cardBackgroundAlt || theme.background,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      gap: 6,
    },
    categoryTagText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    timeTag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.cardBackgroundAlt || theme.background,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      gap: 6,
    },
    timeTagText: {
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
}