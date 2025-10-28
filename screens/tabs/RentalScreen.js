import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { supabase } from '../../supabase/supabaseClient';

const { width, height } = Dimensions.get('window');

export default function RentalScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isFocused = useIsFocused();

  // Automatically detect system theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';

  // Get current theme colors based on system settings
  const theme = isDarkMode ? darkTheme : lightTheme;
  const styles = createStyles(theme);

  useEffect(() => {
    if (isFocused) fetchRentals();
  }, [isFocused]);

  const fetchRentals = async () => {
    try {
      if (!refreshing) setLoading(true);
      
      // First get rental items
      const { data: rentalData, error: rentalError } = await supabase
        .from('rental_items')
        .select(
          'id, owner_email, item_name, price, rental_duration, description, category, condition, quantity, rental_item_image, is_visible, created_at'
        )
        .eq('is_visible', true)
        .order('created_at', { ascending: false });

      if (rentalError) throw rentalError;

      // Then fetch seller names for each rental item
      const itemsWithNames = await Promise.all(
        rentalData.map(async (item) => {
          const { data: userData } = await supabase
            .from('users')
            .select('name')
            .eq('email', item.owner_email)
            .single();

          return {
            ...item,
            seller_name: userData?.name || 'Unknown User',
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

  const renderHeader = () => (
    <View style={styles.headerContainer}>
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

      {/* Add Button - upper right */}
      <TouchableOpacity
        onPress={() => navigation.navigate('RentItemScreen')}
        style={styles.addButton}
        activeOpacity={0.85}
      >
        <Ionicons name="add-circle" size={22} color="#fff" />
      </TouchableOpacity>

      {/* Welcome Section */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>Discover</Text>
        <Text style={styles.userName}>Rental Items</Text>
        <Text style={styles.subtitle}>Browse available items for rent</Text>
      </View>

      {/* Stats Section */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Icon name="cube" size={20} color={theme.accent} />
          <Text style={styles.statValue}>{items.length}</Text>
          <Text style={styles.statLabel}>Items</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="tags" size={20} color={theme.accent} />
          <Text style={styles.statValue}>
            {[...new Set(items.map((i) => i.category))].length}
          </Text>
          <Text style={styles.statLabel}>Categories</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="users" size={20} color={theme.accent} />
          <Text style={styles.statValue}>
            {[...new Set(items.map((i) => i.owner_email))].length}
          </Text>
          <Text style={styles.statLabel}>Sellers</Text>
        </View>
      </View>

      {/* Section Title */}
      {items.length > 0 && (
        <View style={styles.sectionTitleContainer}>
          <Icon name="th-list" size={18} color={theme.text} />
          <Text style={styles.sectionTitle}> Available Rentals</Text>
        </View>
      )}
    </View>
  );

  const renderItem = ({ item, index }) => {
    const thumbnail = item.rental_item_image || null;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('RentalDetails', { rentalItem: item })}
        activeOpacity={0.85}
      >
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.thumbnail} />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Icon name="image" size={40} color={theme.textSecondary} />
          </View>
        )}

        <View style={styles.cardContent}>
          <Text style={styles.itemName} numberOfLines={2}>
            {item.item_name}
          </Text>

          <View style={styles.sellerRow}>
            <Icon name="user" size={12} color={theme.accent} />
            <Text style={styles.sellerName} numberOfLines={1}>
              {' '}{item.seller_name}
            </Text>
          </View>

          <View style={styles.priceRow}>
            <View style={styles.priceContainer}>
              <Text style={styles.priceLabel}>Price</Text>
              <Text style={styles.price}>₱{item.price}</Text>
            </View>
            <View style={styles.durationContainer}>
              <Text style={styles.durationLabel}>Duration</Text>
              <Text style={styles.duration}>{item.rental_duration}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Icon name="tag" size={10} color={theme.textSecondary} />
              <Text style={styles.metaText}> {item.category}</Text>
            </View>
            <View style={styles.metaChip}>
              <Icon name="star" size={10} color={theme.textSecondary} />
              <Text style={styles.metaText}> {item.condition}</Text>
            </View>
          </View>

          {item.description && (
            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          <View style={styles.cardFooter}>
            <View style={styles.quantityContainer}>
              <Icon name="cubes" size={12} color={theme.textSecondary} />
              <Text style={styles.quantityText}> Qty: {item.quantity || 0}</Text>
            </View>

            <TouchableOpacity
              style={styles.messageButton}
              onPress={(e) => {
                e.stopPropagation();
                navigation.navigate('Messaging', {
                  receiverId: item.owner_email,
                  receiverName: item.seller_name,
                });
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="chatbubble" size={14} color="#fff" />
              <Text style={styles.messageText}>Message</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="cube" size={64} color={theme.textSecondary} />
      <Text style={styles.emptyTitle}>No Rental Items Available</Text>
      <Text style={styles.emptySubtext}>
        Be the first to list an item for rent!
      </Text>
      <TouchableOpacity
        style={styles.addItemButton}
        onPress={() => navigation.navigate('RentItemScreen')}
        activeOpacity={0.85}
      >
        <Icon name="plus" size={16} color="#fff" style={styles.buttonIcon} />
        <Text style={styles.addItemButtonText}>Add Rental Item</Text>
      </TouchableOpacity>
    </View>
  );

  // Full-screen loading overlay
  if (loading && !refreshing) {
    return (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Loading rental items...</Text>
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
          data={items}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
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
      </SafeAreaView>
    </>
  );
}

// Dark theme colors (matching CartScreen)
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
  success: '#4CAF50',
  shadowColor: '#000',
  borderColor: '#2a2a4a',
};

// Light theme colors (matching CartScreen)
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
  success: '#27ae60',
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
      height: Platform.OS === 'ios' ? 340 : 360,
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
    addButton: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 10 : 20,
      right: 20,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.success,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
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
    card: {
      backgroundColor: theme.cardBackground,
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 16,
      marginHorizontal: Math.max(width * 0.05, 20),
      borderWidth: 1,
      borderColor: theme.borderColor,
      ...Platform.select({
        ios: {
          shadowColor: theme.shadowColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 6,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    thumbnail: {
      width: '100%',
      height: 180,
      resizeMode: 'cover',
    },
    thumbnailPlaceholder: {
      width: '100%',
      height: 180,
      backgroundColor: theme.cardBackgroundAlt,
      justifyContent: 'center',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.borderColor,
    },
    cardContent: {
      padding: 16,
    },
    itemName: {
      fontSize: 18,
      fontWeight: Platform.OS === 'android' ? '700' : '600',
      color: theme.text,
      marginBottom: 8,
      fontFamily: Platform.select({
        ios: 'Poppins-SemiBold',
        android: 'Poppins-Bold',
        default: 'Poppins-SemiBold',
      }),
    },
    sellerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    sellerName: {
      fontSize: 14,
      color: theme.accent,
      fontWeight: Platform.OS === 'android' ? '600' : '500',
      flex: 1,
      fontFamily: Platform.select({
        ios: 'Poppins-Medium',
        android: 'Poppins-SemiBold',
        default: 'Poppins-Medium',
      }),
    },
    priceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    priceContainer: {
      flex: 1,
    },
    priceLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 4,
      fontWeight: Platform.OS === 'android' ? '500' : '400',
      fontFamily: Platform.select({
        ios: 'Poppins-Regular',
        android: 'Poppins-Medium',
        default: 'Poppins-Regular',
      }),
    },
    price: {
      fontSize: 20,
      fontWeight: Platform.OS === 'android' ? '800' : '700',
      color: theme.accent,
      fontFamily: Platform.select({
        ios: 'Poppins-Bold',
        android: 'Poppins-ExtraBold',
        default: 'Poppins-Bold',
      }),
    },
    durationContainer: {
      alignItems: 'flex-end',
    },
    durationLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 4,
      fontWeight: Platform.OS === 'android' ? '500' : '400',
      fontFamily: Platform.select({
        ios: 'Poppins-Regular',
        android: 'Poppins-Medium',
        default: 'Poppins-Regular',
      }),
    },
    duration: {
      fontSize: 14,
      fontWeight: Platform.OS === 'android' ? '700' : '600',
      color: theme.text,
      fontFamily: Platform.select({
        ios: 'Poppins-Medium',
        android: 'Poppins-SemiBold',
        default: 'Poppins-Medium',
      }),
    },
    metaRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
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
    description: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
      marginBottom: 12,
      fontFamily: Platform.select({
        ios: 'Poppins-Regular',
        android: 'Poppins-Medium',
        default: 'Poppins-Regular',
      }),
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
    },
    quantityContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    quantityText: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: Platform.OS === 'android' ? '600' : '500',
      fontFamily: Platform.select({
        ios: 'Poppins-Medium',
        android: 'Poppins-SemiBold',
        default: 'Poppins-Medium',
      }),
    },
    messageButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.accent,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 20,
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
    messageText: {
      color: '#fff',
      fontWeight: Platform.OS === 'android' ? '700' : '600',
      fontSize: 13,
      marginLeft: 6,
      fontFamily: Platform.select({
        ios: 'Poppins-SemiBold',
        android: 'Poppins-Bold',
        default: 'Poppins-SemiBold',
      }),
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
      paddingVertical: 60,
    },
    emptyTitle: {
      fontSize: 24,
      fontWeight: Platform.OS === 'android' ? '800' : '700',
      color: theme.text,
      marginTop: 20,
      marginBottom: 12,
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
      lineHeight: 24,
      marginBottom: 30,
      fontFamily: Platform.select({
        ios: 'Poppins-Regular',
        android: 'Poppins-Medium',
        default: 'Poppins-Regular',
      }),
    },
    addItemButton: {
      backgroundColor: theme.accent,
      paddingVertical: 14,
      paddingHorizontal: 32,
      borderRadius: 25,
      flexDirection: 'row',
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: theme.accent,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        },
        android: {
          elevation: 6,
        },
      }),
    },
    buttonIcon: {
      marginRight: 8,
    },
    addItemButtonText: {
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
      backgroundColor: theme.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: theme.textSecondary,
      fontFamily: Platform.select({
        ios: 'Poppins-Regular',
        android: 'Poppins-Medium',
        default: 'Poppins-Regular',
      }),
    },
  });