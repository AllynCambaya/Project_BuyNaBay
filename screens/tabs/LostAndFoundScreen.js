import { Ionicons } from '@expo/vector-icons';
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
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';
import { darkTheme, lightTheme } from '../../theme/theme';

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

export default function LostAndFoundScreen({ navigation, showHeader = true }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'lost', 'found'
  const [userStatus, setUserStatus] = useState('not_requested');
  const isFocused = useIsFocused();

  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchUserStatus = async () => {
    const user = auth.currentUser;
    if (!user?.email) {
      setUserStatus('not_requested');
      return;
    }
    const { data } = await supabase.from('users').select('status').eq('email', user.email).single();
    setUserStatus(data?.status || 'not_requested');
  };

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
      setItems(data);
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
    setLoading(false);
    setRefreshing(false);
  }, [refreshing]);

  useEffect(() => {
    if (isFocused) {
      fetchUserStatus();
      fetchItems();
    }
  }, [isFocused, fetchItems]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchItems();
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesFilter = filter === 'all' || item.item_status === filter;
      const matchesSearch =
        item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [items, searchQuery, filter]);

  const handleAddItem = () => {
    if (userStatus === 'approved') {
      navigation.navigate('AddLostItem');
    } else if (userStatus === 'pending') {
      navigation.navigate('VerificationStatus');
    } else {
      navigation.navigate('NotVerified');
    }
  };

  const styles = createStyles(theme);

  const renderHeader = () => (
    <>{showHeader && <View style={styles.headerContainer}>
      <View style={styles.headerTopRow}>
        <TouchableOpacity onPress={() => navigation.navigate('Tabs', { screen: 'Home' })} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lost & Found</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={theme.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search for an item..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      <View style={styles.filterContainer}>
        {['all', 'lost', 'found'].map(status => (
          <TouchableOpacity
            key={status}
            style={[styles.filterChip, filter === status && styles.filterChipActive]}
            onPress={() => setFilter(status)}
          >
            <Text style={[styles.filterText, filter === status && styles.filterTextActive]}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>}</>
  );

  const renderItem = ({ item }) => {
    // support the new column name `lost_and_found_url` (array of urls)
    const imageUrl = item.lost_and_found_url?.[0] || item.image_urls?.[0];
    return (
      <Animated.View style={[styles.itemCard, { opacity: fadeAnim }]}>
        {imageUrl ? (
          <TouchableOpacity onPress={() => navigation.navigate('LostAndFoundDetails', { item })} activeOpacity={0.9}>
            <Image source={{ uri: imageUrl }} style={styles.itemImage} />
          </TouchableOpacity>
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={40} color={theme.textSecondary} />
          </View>
        )}
        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemName} numberOfLines={2}>{item.item_name}</Text>
            <View style={[styles.statusBadge, item.item_status === 'lost' ? styles.lostBadge : styles.foundBadge]}>
              <Text style={styles.statusText}>{item.item_status}</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.location || 'Location not specified'}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
            <Text style={styles.metaText}>{getRelativeTime(item.created_at)}</Text>
          </View>
          <View style={styles.userRow}>
            <Image source={{ uri: item.user_avatar || 'https://placekitten.com/50/50' }} style={styles.userAvatar} />
            <Text style={styles.userName}>{item.user_name || 'Anonymous'}</Text>
          </View>
          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => navigation.navigate('Messaging', { receiverId: item.user_email, receiverName: item.user_name })}
          >
            <Text style={styles.contactButtonText}>Contact Reporter</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="sad-outline" size={64} color={theme.textSecondary} />
      <Text style={styles.emptyTitle}>No Items Found</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery ? 'Try a different search term.' : 'There are no lost or found items yet.'}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Loading Items...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
      />
      <TouchableOpacity style={styles.fab} onPress={handleAddItem}>
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    centered: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 10,
      color: theme.textSecondary,
      fontSize: 16,
    },
    headerContainer: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderColor,
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    backButton: {
      padding: 5,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: theme.text,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.cardBackground,
      borderRadius: 12,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      height: 44,
      color: theme.text,
      fontSize: 16,
    },
    filterContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: 16,
    },
    filterChip: {
      paddingVertical: 8,
      paddingHorizontal: 20,
      borderRadius: 20,
      backgroundColor: theme.cardBackground,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    filterChipActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    filterText: {
      color: theme.textSecondary,
      fontWeight: '600',
    },
    filterTextActive: {
      color: '#fff',
    },
    listContent: {
      paddingBottom: 80,
    },
    itemCard: {
      backgroundColor: theme.cardBackground,
      marginHorizontal: 20,
      marginTop: 20,
      borderRadius: 16,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    itemImage: {
      width: '100%',
      height: 200,
    },
    imagePlaceholder: {
      width: '100%',
      height: 200,
      backgroundColor: theme.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    itemContent: {
      padding: 16,
    },
    itemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    itemName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
      flex: 1,
      marginRight: 8,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    lostBadge: {
      backgroundColor: theme.lost,
    },
    foundBadge: {
      backgroundColor: theme.found,
    },
    statusText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: 'bold',
      textTransform: 'uppercase',
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    metaText: {
      marginLeft: 8,
      color: theme.textSecondary,
      fontSize: 14,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.borderColor,
    },
    userAvatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
      marginRight: 8,
    },
    userName: {
      color: theme.text,
      fontWeight: '600',
    },
    contactButton: {
      marginTop: 16,
      backgroundColor: theme.accent,
      padding: 12,
      borderRadius: 12,
      alignItems: 'center',
    },
    contactButtonText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 16,
    },
    fab: {
      position: 'absolute',
      bottom: 30,
      right: 30,
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: theme.accent,
      justifyContent: 'center',
      alignItems: 'center',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
      marginTop: 50,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: theme.text,
      marginTop: 16,
    },
    emptySubtitle: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 8,
    },
  });
}