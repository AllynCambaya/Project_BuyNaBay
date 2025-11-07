import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase/supabaseClient';
import { darkTheme, lightTheme } from '../../theme/theme';
import { fontFamily } from '../../theme/typography';

const { width } = Dimensions.get('window');

export default function AdminPanel({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ 
    pending: 0, 
    approved: 0, 
    rejected: 0, 
    totalUsers: 0, 
    reports: 0 
  });
  const [selectedStatus, setSelectedStatus] = useState('Pending');
  const [requests, setRequests] = useState([]);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [menuVisible, setMenuVisible] = useState(null);
  const [suspendModalVisible, setSuspendModalVisible] = useState(false);
  const [suspendDays, setSuspendDays] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;

  // Animation refs
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardSlideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerSlideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(cardSlideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const fetchStatsAndRequests = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      
      const { data: pending } = await supabase.from('verifications').select('*').eq('status', 'pending');
      const { data: approved } = await supabase.from('verifications').select('*').eq('status', 'approved');
      const { data: rejected } = await supabase.from('verifications').select('*').eq('status', 'rejected');
      const { data: usersData, count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact' });

      const { data: reportsData } = await supabase
        .from('reports')
        .select('id, reporter_name, reporter_student_id, reported_student_id, reported_name, reason, details, created_at')
        .order('created_at', { ascending: false });

      const { data: recentCheckouts } = await supabase
        .from('checkout_history')
        .select('*')
        .order('checkout_date', { ascending: false })
        .limit(5);

      setStats({
        pending: pending?.length || 0,
        approved: approved?.length || 0,
        rejected: rejected?.length || 0,
        totalUsers: totalUsers || 0,
        reports: reportsData?.length || 0,
      });

      const { data: allRequests } = await supabase
        .from('verifications')
        .select('id, email, phone_number, student_id, id_image, cor_image, status')
        .order('created_at', { ascending: false });

      setRequests(allRequests || []);
      setReports(reportsData || []);
      setUsers(usersData || []);
      setRecentActivity(recentCheckouts || []);
    } catch (err) {
      console.error('Error fetching admin data:', err.message);
      Alert.alert('Error', 'Failed to load admin data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  useEffect(() => {
    fetchStatsAndRequests();
  }, [fetchStatsAndRequests]);

  const handleAction = async (id, newStatus) => {
    try {
      const { data: verRecord, error: fetchErr } = await supabase
        .from('verifications')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      const { error } = await supabase.from('verifications').update({ status: newStatus }).eq('id', id);
      if (error) throw error;

      if (newStatus === 'approved' && verRecord?.email) {
        const updates = {};
        if (verRecord.phone_number) updates.phone_number = verRecord.phone_number;
        if (verRecord.student_id) updates.student_id = verRecord.student_id;

        if (Object.keys(updates).length > 0) {
          const { error: updateErr } = await supabase
            .from('users')
            .update(updates)
            .eq('email', verRecord.email);

          if (updateErr) {
            console.warn('Failed to update users row, attempting upsert:', updateErr.message || updateErr);
            try {
              await supabase.from('users').upsert({ email: verRecord.email, ...updates });
            } catch (upsertErr) {
              console.error('Upsert to users failed:', upsertErr);
            }
          }
        }
      }

      Alert.alert('Success', `Request has been ${newStatus}.`);
      fetchStatsAndRequests();
    } catch (err) {
      console.error('Error updating verification status:', err);
      Alert.alert('Error', 'Failed to update status.');
    }
  };

  const handleUserAction = async (userId, action) => {
    setMenuVisible(null);

    // Find the current user to check their status
    const currentUser = users.find(u => u.id === userId);
    const currentStatus = currentUser?.account_status || 'active';

    if (action === 'delete') {
      Alert.alert('Confirm Delete', 'Are you sure you want to delete this user?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('users').delete().eq('id', userId);
              if (error) throw error;
              Alert.alert('Success', 'User account deleted.');
              fetchStatsAndRequests();
            } catch (err) {
              console.error('Error deleting user:', err);
              Alert.alert('Error', 'Failed to delete user. Try again.');
            }
          },
        },
      ]);
      return;
    }

    if (action === 'freeze') {
      // Toggle freeze/unfreeze based on current status
      const newStatus = currentStatus === 'frozen' ? 'active' : 'frozen';
      const actionText = newStatus === 'frozen' ? 'freeze' : 'unfreeze';
      
      Alert.alert(
        `Confirm ${actionText.charAt(0).toUpperCase() + actionText.slice(1)}`,
        `Are you sure you want to ${actionText} this account?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: actionText.charAt(0).toUpperCase() + actionText.slice(1),
            onPress: async () => {
              try {
                const { error } = await supabase
                  .from('users')
                  .update({ account_status: newStatus })
                  .eq('id', userId);
                
                if (error) throw error;
                
                Alert.alert(
                  'Success',
                  `User account has been ${newStatus === 'frozen' ? 'frozen' : 'unfrozen'}.`
                );
                fetchStatsAndRequests();
              } catch (err) {
                console.error(`Error ${actionText}ing user:`, err);
                Alert.alert('Error', `Failed to ${actionText} user. Try again.`);
              }
            },
          },
        ]
      );
      return;
    }

    if (action === 'reset') {
      Alert.alert(
        'Confirm Password Reset',
        'Reset this user\'s password to default (password123)?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reset',
            onPress: async () => {
              try {
                const { error } = await supabase
                  .from('users')
                  .update({ password: 'password123' })
                  .eq('id', userId);
                
                if (error) throw error;
                
                Alert.alert('Success', 'Password reset to default (password123).');
              } catch (err) {
                console.error('Error resetting password:', err);
                Alert.alert('Error', 'Failed to reset password. Try again.');
              }
            },
          },
        ]
      );
      return;
    }

    if (action === 'suspend') {
      // Check if already suspended - if so, unsuspend
      if (currentStatus === 'suspended') {
        Alert.alert(
          'Confirm Unsuspend',
          'Are you sure you want to unsuspend this account?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Unsuspend',
              onPress: async () => {
                try {
                  const { error } = await supabase
                    .from('users')
                    .update({ 
                      account_status: 'active',
                      suspended_until: null 
                    })
                    .eq('id', userId);
                  
                  if (error) throw error;
                  
                  Alert.alert('Success', 'User account has been unsuspended.');
                  fetchStatsAndRequests();
                } catch (err) {
                  console.error('Error unsuspending user:', err);
                  Alert.alert('Error', 'Failed to unsuspend user. Try again.');
                }
              },
            },
          ]
        );
      } else {
        // Show suspend modal for new suspension
        setSelectedUserId(userId);
        setSuspendModalVisible(true);
      }
    }
  };

  const confirmSuspend = async () => {
    if (!suspendDays || isNaN(suspendDays) || parseInt(suspendDays) <= 0) {
      return Alert.alert('Error', 'Please enter a valid number of days.');
    }
    
    const untilDate = new Date();
    untilDate.setDate(untilDate.getDate() + parseInt(suspendDays));

    try {
      const { error } = await supabase
        .from('users')
        .update({ 
          account_status: 'suspended', 
          suspended_until: untilDate.toISOString() 
        })
        .eq('id', selectedUserId);

      if (error) throw error;

      Alert.alert('Success', `User suspended for ${suspendDays} days.`);
      setSuspendModalVisible(false);
      setSuspendDays('');
      setSelectedUserId(null);
      fetchStatsAndRequests();
    } catch (err) {
      console.error('Error suspending user:', err);
      Alert.alert('Error', 'Failed to suspend user. Try again.');
    }
  };

  const filterBySearch = (items, type) => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    
    if (type === 'users') {
      return items.filter(u => 
        u.email?.toLowerCase().includes(query) || 
        u.phone_number?.toLowerCase().includes(query) ||
        u.student_id?.toLowerCase().includes(query)
      );
    }
    
    if (type === 'reports') {
      return items.filter(r => 
        r.reported_name?.toLowerCase().includes(query) || 
        r.reporter_name?.toLowerCase().includes(query) ||
        r.reason?.toLowerCase().includes(query)
      );
    }
    
    return items.filter(r => 
      r.email?.toLowerCase().includes(query) || 
      r.student_id?.toLowerCase().includes(query) ||
      r.phone_number?.toLowerCase().includes(query)
    );
  };

  const styles = createStyles(theme, isDarkMode);

  const renderHeader = () => (
    <Animated.View
      style={[
        styles.headerContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: headerSlideAnim }],
        },
      ]}
    >
      <View style={styles.backgroundGradient}>
        <View style={styles.gradientOverlay} />
      </View>

      <View style={styles.topNavBar}>
        <View style={styles.brandedLogoContainer}>
          <View style={styles.logoWrapper}>
            <Image
              source={require('../../assets/images/OfficialBuyNaBay.png')}
              style={styles.brandedLogoImage}
              resizeMode="contain"
            />
          </View>
          <View>
            <Text style={[styles.brandedLogoText, { fontFamily: fontFamily.extraBold }]}>
              BuyNaBay
            </Text>
            <Text style={[styles.brandedSubtext, { fontFamily: fontFamily.medium }]}>
              Admin Dashboard
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <TouchableOpacity 
          style={[styles.statCard, selectedStatus === 'Pending' && styles.statCardActive]}
          onPress={() => setSelectedStatus('Pending')}
          activeOpacity={0.7}
        >
          <View style={styles.statIconContainer}>
            <View style={[styles.statIconCircle, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="time-outline" size={22} color="#F57C00" />
            </View>
            {stats.pending > 0 && (
              <Animated.View style={[styles.statPulse, { transform: [{ scale: pulseAnim }] }]} />
            )}
          </View>
          <Text style={[styles.statValue, { fontFamily: fontFamily.bold }]}>{stats.pending}</Text>
          <Text style={[styles.statLabel, { fontFamily: fontFamily.medium }]}>Pending</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.statCard, selectedStatus === 'Approved' && styles.statCardActive]}
          onPress={() => setSelectedStatus('Approved')}
          activeOpacity={0.7}
        >
          <View style={styles.statIconContainer}>
            <View style={[styles.statIconCircle, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="checkmark-circle-outline" size={22} color="#4CAF50" />
            </View>
          </View>
          <Text style={[styles.statValue, { fontFamily: fontFamily.bold }]}>{stats.approved}</Text>
          <Text style={[styles.statLabel, { fontFamily: fontFamily.medium }]}>Approved</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.statCard, selectedStatus === 'Rejected' && styles.statCardActive]}
          onPress={() => setSelectedStatus('Rejected')}
          activeOpacity={0.7}
        >
          <View style={styles.statIconContainer}>
            <View style={[styles.statIconCircle, { backgroundColor: '#FFEBEE' }]}>
              <Ionicons name="close-circle-outline" size={22} color="#F44336" />
            </View>
          </View>
          <Text style={[styles.statValue, { fontFamily: fontFamily.bold }]}>{stats.rejected}</Text>
          <Text style={[styles.statLabel, { fontFamily: fontFamily.medium }]}>Rejected</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.statCard, selectedStatus === 'users' && styles.statCardActive]}
          onPress={() => setSelectedStatus('users')}
          activeOpacity={0.7}
        >
          <View style={styles.statIconContainer}>
            <View style={[styles.statIconCircle, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="people-outline" size={22} color="#1976D2" />
            </View>
          </View>
          <Text style={[styles.statValue, { fontFamily: fontFamily.bold }]}>{stats.totalUsers}</Text>
          <Text style={[styles.statLabel, { fontFamily: fontFamily.medium }]}>Users</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.statCard, selectedStatus === 'reports' && styles.statCardActive]}
          onPress={() => setSelectedStatus('reports')}
          activeOpacity={0.7}
        >
          <View style={styles.statIconContainer}>
            <View style={[styles.statIconCircle, { backgroundColor: '#FFF8E1' }]}>
              <Ionicons name="flag-outline" size={22} color="#FBC02D" />
            </View>
            {stats.reports > 0 && (
              <Animated.View style={[styles.statPulse, { transform: [{ scale: pulseAnim }] }]} />
            )}
          </View>
          <Text style={[styles.statValue, { fontFamily: fontFamily.bold }]}>{stats.reports}</Text>
          <Text style={[styles.statLabel, { fontFamily: fontFamily.medium }]}>Reports</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={20} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { fontFamily: fontFamily.medium }]}
          placeholder={`Search ${selectedStatus === 'users' ? 'users' : selectedStatus === 'reports' ? 'reports' : 'requests'}...`}
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { fontFamily: fontFamily.bold }]}>
          {selectedStatus === 'users' ? 'User Management' : 
           selectedStatus === 'reports' ? 'User Reports' : 
           `${selectedStatus} Requests`}
        </Text>
        <Text style={[styles.sectionCount, { fontFamily: fontFamily.medium }]}>
          {selectedStatus === 'users' ? users.length : 
           selectedStatus === 'reports' ? reports.length : 
           requests.filter(r => r.status.toLowerCase() === selectedStatus.toLowerCase()).length} items
        </Text>
      </View>
    </View>
  );

  const renderRecentActivity = () => {
    if (recentActivity.length === 0) return null;

    return (
      <Animated.View
        style={[
          styles.activitySection,
          { opacity: fadeAnim, transform: [{ translateY: cardSlideAnim }] },
        ]}
      >
        <View style={styles.activityHeader}>
          <Text style={[styles.activityTitle, { fontFamily: fontFamily.bold }]}>
            Recent Activity
          </Text>
        </View>

        {recentActivity.map((activity, index) => (
          <Animated.View
            key={index}
            style={[
              styles.activityItem,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: cardSlideAnim.interpolate({
                      inputRange: [0, 30],
                      outputRange: [0, 30 + index * 5],
                    }),
                  },
                  { scale: scaleAnim },
                ],
              },
            ]}
          >
            <View style={styles.activityIcon}>
              <Ionicons name="cart-outline" size={18} color={theme.success} />
            </View>
            <View style={styles.activityDetails}>
              <Text style={[styles.activityText, { fontFamily: fontFamily.semiBold }]}>
                {activity.buyer_email}
              </Text>
              <Text style={[styles.activitySubtext, { fontFamily: fontFamily.regular }]}>
                Purchased {activity.product_name}
              </Text>
            </View>
            <Text style={[styles.activityPrice, { fontFamily: fontFamily.bold }]}>
              ₱{parseFloat(activity.price).toFixed(2)}
            </Text>
          </Animated.View>
        ))}
      </Animated.View>
    );
  };

  const renderUsers = () => {
    const filtered = filterBySearch(users, 'users');
    
    if (filtered.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
          </View>
          <Text style={[styles.emptyTitle, { fontFamily: fontFamily.bold }]}>
            {searchQuery ? 'No users found' : 'No users yet'}
          </Text>
          <Text style={[styles.emptySubtext, { fontFamily: fontFamily.medium }]}>
            {searchQuery ? 'Try adjusting your search' : 'Users will appear here once registered'}
          </Text>
        </View>
      );
    }

    return filtered.map((user) => {
      const userStatus = user.account_status || 'active';
      
      return (
        <Animated.View
          key={user.id}
          style={[
            styles.itemCard,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.itemCardHeader}>
            <View style={styles.userRow}>
              <View style={styles.userAvatarLarge}>
                <Ionicons name="person" size={24} color={theme.accent} />
              </View>
              <View style={styles.userInfo}>
                <Text style={[styles.itemTitle, { fontFamily: fontFamily.bold }]}>{user.email}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name="call-outline" size={12} color={theme.textSecondary} />
                  <Text style={[styles.metaText, { fontFamily: fontFamily.regular }]}>{user.phone_number || 'N/A'}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="card-outline" size={12} color={theme.textSecondary} />
                  <Text style={[styles.metaText, { fontFamily: fontFamily.regular }]}>{user.student_id || 'N/A'}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity 
              onPress={() => setMenuVisible(menuVisible === user.id ? null : user.id)}
              style={styles.menuIconButton}
              activeOpacity={0.7}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.statusRow}>
            <View style={[
              styles.statusChip,
              userStatus === 'frozen' && styles.statusChipFrozen,
              userStatus === 'suspended' && styles.statusChipSuspended,
              userStatus === 'active' && styles.statusChipActive,
            ]}>
              <Ionicons 
                name={userStatus === 'frozen' ? 'snow-outline' : 
                      userStatus === 'suspended' ? 'pause-circle-outline' : 
                      'checkmark-circle-outline'} 
                size={14} 
                color="#fff" 
              />
              <Text style={[styles.statusChipText, { fontFamily: fontFamily.bold }]}>
                {userStatus.charAt(0).toUpperCase() + userStatus.slice(1)}
              </Text>
            </View>
          </View>

          {menuVisible === user.id && (
            <View style={styles.actionMenu}>
              <TouchableOpacity 
                onPress={() => handleUserAction(user.id, 'freeze')}
                style={styles.actionMenuItem}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={userStatus === 'frozen' ? 'checkmark-circle-outline' : 'snow-outline'} 
                  size={18} 
                  color={theme.text} 
                />
                <Text style={[styles.actionMenuText, { fontFamily: fontFamily.semiBold }]}>
                  {userStatus === 'frozen' ? 'Unfreeze Account' : 'Freeze Account'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => handleUserAction(user.id, 'suspend')}
                style={styles.actionMenuItem}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={userStatus === 'suspended' ? 'play-circle-outline' : 'pause-circle-outline'} 
                  size={18} 
                  color={theme.text} 
                />
                <Text style={[styles.actionMenuText, { fontFamily: fontFamily.semiBold }]}>
                  {userStatus === 'suspended' ? 'Unsuspend Account' : 'Suspend Account'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => handleUserAction(user.id, 'reset')}
                style={styles.actionMenuItem}
                activeOpacity={0.7}
              >
                <Ionicons name="key-outline" size={18} color={theme.text} />
                <Text style={[styles.actionMenuText, { fontFamily: fontFamily.semiBold }]}>Reset Password</Text>
              </TouchableOpacity>
              <View style={styles.actionMenuDivider} />
              <TouchableOpacity 
                onPress={() => handleUserAction(user.id, 'delete')}
                style={styles.actionMenuItem}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={18} color={theme.error} />
                <Text style={[styles.actionMenuText, { color: theme.error, fontFamily: fontFamily.semiBold }]}>Delete User</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      );
    });
  };

  const renderReports = () => {
    const filtered = filterBySearch(reports, 'reports');
    
    if (filtered.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="flag-outline" size={48} color={theme.textSecondary} />
          </View>
          <Text style={[styles.emptyTitle, { fontFamily: fontFamily.bold }]}>
            {searchQuery ? 'No reports found' : 'No reports yet'}
          </Text>
          <Text style={[styles.emptySubtext, { fontFamily: fontFamily.medium }]}>
            {searchQuery ? 'Try adjusting your search' : 'User reports will appear here'}
          </Text>
        </View>
      );
    }

    return filtered.map((r) => (
      <Animated.View
        key={r.id}
        style={[
          styles.itemCard,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.reportBanner}>
          <Ionicons name="flag" size={16} color="#F57C00" />
          <Text style={[styles.reportBannerText, { fontFamily: fontFamily.bold }]}>Report #{r.id}</Text>
          <View style={styles.reportBadge}>
            <Text style={[styles.reportBadgeText, { fontFamily: fontFamily.bold }]}>{r.reason}</Text>
          </View>
        </View>

        <View style={styles.reportContent}>
          <View style={styles.reportSection}>
            <Text style={[styles.reportSectionLabel, { fontFamily: fontFamily.semiBold }]}>Reported User</Text>
            <View style={styles.reportUserRow}>
              <View style={styles.reportUserAvatar}>
                <Ionicons name="person-outline" size={16} color={theme.text} />
              </View>
              <View>
                <Text style={[styles.reportUserName, { fontFamily: fontFamily.semiBold }]}>{r.reported_name}</Text>
                <Text style={[styles.reportUserId, { fontFamily: fontFamily.regular }]}>ID: {r.reported_student_id || 'N/A'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.reportDivider} />

          <View style={styles.reportSection}>
            <Text style={[styles.reportSectionLabel, { fontFamily: fontFamily.semiBold }]}>Reported By</Text>
            <View style={styles.reportUserRow}>
              <View style={styles.reportUserAvatar}>
                <Ionicons name="person-outline" size={16} color={theme.text} />
              </View>
              <View>
                <Text style={[styles.reportUserName, { fontFamily: fontFamily.semiBold }]}>{r.reporter_name}</Text>
                <Text style={[styles.reportUserId, { fontFamily: fontFamily.regular }]}>ID: {r.reporter_student_id || 'N/A'}</Text>
              </View>
            </View>
          </View>

          {r.details && (
            <>
              <View style={styles.reportDivider} />
              <View style={styles.reportSection}>
                <Text style={[styles.reportSectionLabel, { fontFamily: fontFamily.semiBold }]}>Details</Text>
                <Text style={[styles.reportDetails, { fontFamily: fontFamily.regular }]}>{r.details}</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.reportFooter}>
          <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
          <Text style={[styles.reportTime, { fontFamily: fontFamily.regular }]}>{new Date(r.created_at).toLocaleString()}</Text>
        </View>
      </Animated.View>
    ));
  };

  const renderRequests = () => {
    const filtered = filterBySearch(
      requests.filter((r) => r.status.toLowerCase() === selectedStatus.toLowerCase()),
      'requests'
    );

    if (filtered.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="document-text-outline" size={48} color={theme.textSecondary} />
          </View>
          <Text style={[styles.emptyTitle, { fontFamily: fontFamily.bold }]}>
            {searchQuery ? 'No requests found' : `No ${selectedStatus.toLowerCase()} requests`}
          </Text>
          <Text style={[styles.emptySubtext, { fontFamily: fontFamily.medium }]}>
            {searchQuery ? 'Try adjusting your search' : 'Verification requests will appear here'}
          </Text>
        </View>
      );
    }

    return filtered.map((req) => (
      <Animated.View
        key={req.id}
        style={[
          styles.itemCard,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.requestHeader}>
          <View style={styles.requestInfo}>
            <Text style={[styles.itemTitle, { fontFamily: fontFamily.bold }]}>{req.email}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="call-outline" size={12} color={theme.textSecondary} />
              <Text style={[styles.metaText, { fontFamily: fontFamily.regular }]}>{req.phone_number}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="card-outline" size={12} color={theme.textSecondary} />
              <Text style={[styles.metaText, { fontFamily: fontFamily.regular }]}>{req.student_id}</Text>
            </View>
          </View>
          <View style={[styles.requestStatusChip,
            req.status === 'pending' && styles.requestStatusPending,
            req.status === 'approved' && styles.requestStatusApproved,
            req.status === 'rejected' && styles.requestStatusRejected,
          ]}>
            <Text style={[styles.requestStatusText, { fontFamily: fontFamily.bold }]}>{req.status}</Text>
          </View>
        </View>

        {(req.id_image || req.cor_image) && (
          <View style={styles.imagesGrid}>
            {req.id_image && (
              <View style={styles.imageBox}>
                <Image source={{ uri: req.id_image }} style={styles.verificationImg} />
                <View style={styles.imageTag}>
                  <Ionicons name="card-outline" size={12} color="#fff" />
                  <Text style={[styles.imageTagText, { fontFamily: fontFamily.semiBold }]}>ID Card</Text>
                </View>
              </View>
            )}
            {req.cor_image && (
              <View style={styles.imageBox}>
                <Image source={{ uri: req.cor_image }} style={styles.verificationImg} />
                <View style={styles.imageTag}>
                  <Ionicons name="document-text-outline" size={12} color="#fff" />
                  <Text style={[styles.imageTagText, { fontFamily: fontFamily.semiBold }]}>COR</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {req.status === 'pending' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => handleAction(req.id, 'approved')}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={[styles.actionBtnText, { fontFamily: fontFamily.bold }]}>Approve</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => handleAction(req.id, 'rejected')}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={18} color="#fff" />
              <Text style={[styles.actionBtnText, { fontFamily: fontFamily.bold }]}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    ));
  };

  const renderContent = () => {
    if (selectedStatus === 'users') return renderUsers();
    if (selectedStatus === 'reports') return renderReports();
    return renderRequests();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingScreen}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.loadingText, { fontFamily: fontFamily.semiBold }]}>Loading Dashboard...</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchStatsAndRequests();
              }}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          }
        >
          {renderHeader()}
          {renderSearchBar()}
          <View style={styles.mainContent}>
            {renderContent()}
          </View>
          {renderRecentActivity()}
        </ScrollView>

        <Modal visible={suspendModalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalIconCircle}>
                  <Ionicons name="pause-circle" size={24} color={theme.accent} />
                </View>
                <Text style={[styles.modalTitle, { fontFamily: fontFamily.extraBold }]}>Suspend User</Text>
              </View>
              
              <Text style={[styles.modalDescription, { fontFamily: fontFamily.regular }]}>
                Enter the number of days to suspend this user's account
              </Text>
              
              <View style={styles.modalInputContainer}>
                <Ionicons name="calendar-outline" size={20} color={theme.textSecondary} />
                <TextInput
                  style={[styles.modalTextInput, { fontFamily: fontFamily.medium }]}
                  keyboardType="numeric"
                  value={suspendDays}
                  onChangeText={setSuspendDays}
                  placeholder="Number of days"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity 
                  onPress={() => {
                    setSuspendModalVisible(false);
                    setSuspendDays('');
                  }}
                  style={[styles.modalBtn, styles.modalCancelBtn]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalCancelText, { fontFamily: fontFamily.bold }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={confirmSuspend}
                  style={[styles.modalBtn, styles.modalConfirmBtn]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalConfirmText, { fontFamily: fontFamily.bold }]}>Suspend</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const createStyles = (theme, isDarkMode) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollView: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: theme.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: theme.textSecondary,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 20,
    position: 'relative',
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 380 : 400,
    backgroundColor: theme.gradientBackground,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.08,
  },
  topNavBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  brandedLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(253, 173, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  brandedLogoImage: {
    width: 26,
    height: 26,
  },
  brandedLogoText: {
    fontSize: 18,
    color: theme.accent,
    letterSpacing: -0.4,
    lineHeight: 22,
  },
  brandedSubtext: {
    fontSize: 10,
    color: theme.textSecondary,
    letterSpacing: 0.2,
    marginTop: -1,
  },
  adminName: {
    fontSize: 28,
    color: '#fff',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: (width - 52) / 2,
    backgroundColor: theme.cardBackground,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: isDarkMode ? 'rgba(253, 173, 0, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  statCardActive: {
    backgroundColor: isDarkMode ? 'rgba(253, 173, 0, 0.15)' : 'rgba(253, 173, 0, 0.08)',
    borderColor: theme.accent,
    borderWidth: 2,
    ...Platform.select({
      ios: {
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  statIconContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  statIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statPulse: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F44336',
    borderWidth: 2,
    borderColor: '#fff',
  },
  statValue: {
    fontSize: 24,
    color: theme.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.borderColor,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: theme.text,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    color: theme.text,
  },
  sectionCount: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  mainContent: {
    paddingHorizontal: 20,
  },
  itemCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.borderColor,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  itemCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  userAvatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.cardBackgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 2,
    borderColor: theme.accent,
  },
  userInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    color: theme.text,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  metaText: {
    fontSize: 13,
    color: theme.textSecondary,
    marginLeft: 6,
  },
  menuIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.cardBackgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusRow: {
    marginTop: 8,
  },
  statusChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: theme.success,
    gap: 4,
  },
  statusChipActive: {
    backgroundColor: '#10b981',
  },
  statusChipFrozen: {
    backgroundColor: '#3b82f6',
  },
  statusChipSuspended: {
    backgroundColor: '#f59e0b',
  },
  statusChipText: {
    color: '#fff',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  actionMenu: {
    backgroundColor: theme.cardBackgroundAlt,
    borderRadius: 16,
    marginTop: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: theme.borderColor,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  actionMenuText: {
    marginLeft: 12,
    fontSize: 14,
    color: theme.text,
  },
  actionMenuDivider: {
    height: 1,
    backgroundColor: theme.borderColor,
    marginVertical: 4,
    marginHorizontal: 8,
  },
  reportBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
    gap: 8,
  },
  reportBannerText: {
    fontSize: 15,
    color: theme.warning,
    flex: 1,
  },
  reportBadge: {
    backgroundColor: theme.warning,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reportBadgeText: {
    color: '#fff',
    fontSize: 11,
  },
  reportContent: {
    gap: 12,
  },
  reportSection: {
    gap: 6,
  },
  reportSectionLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reportUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reportUserAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.cardBackgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportUserName: {
    fontSize: 15,
    color: theme.text,
  },
  reportUserId: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  reportDivider: {
    height: 1,
    backgroundColor: theme.borderColor,
  },
  reportDetails: {
    fontSize: 14,
    color: theme.text,
    lineHeight: 20,
  },
  reportFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.borderColor,
    gap: 6,
  },
  reportTime: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  requestInfo: {
    flex: 1,
  },
  requestStatusChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 12,
  },
  requestStatusPending: {
    backgroundColor: '#fef3c7',
  },
  requestStatusApproved: {
    backgroundColor: '#d1fae5',
  },
  requestStatusRejected: {
    backgroundColor: '#fee2e2',
  },
  requestStatusText: {
    fontSize: 12,
    textTransform: 'capitalize',
    color: '#1a1a2e',
  },
  imagesGrid: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 12,
  },
  imageBox: {
    flex: 1,
    position: 'relative',
  },
  verificationImg: {
    width: '100%',
    height: 160,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  imageTag: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  imageTagText: {
    color: '#fff',
    fontSize: 11,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  approveBtn: {
    backgroundColor: theme.success,
  },
  rejectBtn: {
    backgroundColor: theme.error,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 15,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.cardBackgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    color: theme.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  activitySection: {
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 20,
  },
  activityHeader: {
    marginBottom: 16,
  },
  activityTitle: {
    fontSize: 18,
    color: theme.text,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: isDarkMode ? 'rgba(253, 173, 0, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${theme.success}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityDetails: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: theme.text,
    marginBottom: 2,
  },
  activitySubtext: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  activityPrice: {
    fontSize: 15,
    color: theme.accent,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.modalOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.cardBackgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 22,
    color: theme.text,
  },
  modalDescription: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackgroundAlt,
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 24,
    gap: 10,
  },
  modalTextInput: {
    flex: 1,
    fontSize: 16,
    color: theme.text,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtn: {
    backgroundColor: theme.cardBackgroundAlt,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  modalConfirmBtn: {
    backgroundColor: theme.accent,
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
  modalCancelText: {
    color: theme.text,
    fontSize: 16,
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 16,
  },
});