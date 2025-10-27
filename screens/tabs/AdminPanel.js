import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
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
import { supabase } from '../../supabase/supabaseClient';

const { width, height } = Dimensions.get('window');

export default function AdminPanel() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, totalUsers: 0, reports: 0 });
  const [selectedStatus, setSelectedStatus] = useState('Pending');
  const [requests, setRequests] = useState([]);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [menuVisible, setMenuVisible] = useState(null);
  const [suspendModalVisible, setSuspendModalVisible] = useState(false);
  const [suspendDays, setSuspendDays] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);

  // Automatically detect system theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';

  // Get current theme colors based on system settings
  const theme = isDarkMode ? darkTheme : lightTheme;
  const styles = createStyles(theme);

  const fetchStatsAndRequests = async () => {
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
    } catch (err) {
      console.error('Error fetching admin data:', err.message);
      Alert.alert('Error', 'Failed to load admin data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatsAndRequests();
  }, []);

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
          const { data: updatedUsers, error: updateErr } = await supabase
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

    if (action === 'delete') {
      Alert.alert('Confirm Delete', 'Are you sure you want to delete this user?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('users').delete().eq('id', userId);
            Alert.alert('Deleted', 'User account deleted.');
            fetchStatsAndRequests();
          },
        },
      ]);
      return;
    }

    if (action === 'freeze') {
      await supabase.from('users').update({ account_status: 'frozen' }).eq('id', userId);
      Alert.alert('Frozen', 'User account has been frozen.');
      fetchStatsAndRequests();
    }

    if (action === 'reset') {
      await supabase.from('users').update({ password: 'password123' }).eq('id', userId);
      Alert.alert('Reset', 'Password reset to default (password123).');
    }

    if (action === 'suspend') {
      setSelectedUserId(userId);
      setSuspendModalVisible(true);
    }
  };

  const confirmSuspend = async () => {
    if (!suspendDays) return Alert.alert('Error', 'Please enter number of days.');
    const untilDate = new Date();
    untilDate.setDate(untilDate.getDate() + parseInt(suspendDays));

    await supabase
      .from('users')
      .update({ account_status: 'suspended', suspended_until: untilDate.toISOString() })
      .eq('id', selectedUserId);

    Alert.alert('Suspended', `User suspended for ${suspendDays} days.`);
    setSuspendModalVisible(false);
    setSuspendDays('');
    fetchStatsAndRequests();
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Background gradient effect */}
      <View style={styles.backgroundGradient} />

      {/* Branded logo - upper left */}
      <View style={styles.brandedLogoContainer}>
        <View style={styles.adminIconCircle}>
          <Ionicons name="shield-checkmark" size={24} color={theme.accent} />
        </View>
        <Text style={styles.brandedLogoText}>Admin Panel</Text>
      </View>

      {/* Welcome Section */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>Administration</Text>
        <Text style={styles.userName}>Management Dashboard</Text>
        <Text style={styles.subtitle}>Manage users and verification requests</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <TouchableOpacity 
          style={[styles.statCard, selectedStatus === 'Pending' && styles.statCardSelected]}
          onPress={() => setSelectedStatus('Pending')}
          activeOpacity={0.85}
        >
          <Ionicons name="time" size={24} color="#FBC02D" />
          <Text style={styles.statValue}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.statCard, selectedStatus === 'Approved' && styles.statCardSelected]}
          onPress={() => setSelectedStatus('Approved')}
          activeOpacity={0.85}
        >
          <Ionicons name="checkmark-circle" size={24} color="#388E3C" />
          <Text style={styles.statValue}>{stats.approved}</Text>
          <Text style={styles.statLabel}>Approved</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.statCard, selectedStatus === 'Rejected' && styles.statCardSelected]}
          onPress={() => setSelectedStatus('Rejected')}
          activeOpacity={0.85}
        >
          <Ionicons name="close-circle" size={24} color="#D32F2F" />
          <Text style={styles.statValue}>{stats.rejected}</Text>
          <Text style={styles.statLabel}>Rejected</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.statCard, selectedStatus === 'users' && styles.statCardSelected]}
          onPress={() => setSelectedStatus('users')}
          activeOpacity={0.85}
        >
          <Ionicons name="people" size={24} color="#1976d2" />
          <Text style={styles.statValue}>{stats.totalUsers}</Text>
          <Text style={styles.statLabel}>Users</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.statCard, selectedStatus === 'reports' && styles.statCardSelected]}
          onPress={() => setSelectedStatus('reports')}
          activeOpacity={0.85}
        >
          <Ionicons name="warning" size={24} color="#F57C00" />
          <Text style={styles.statValue}>{stats.reports}</Text>
          <Text style={styles.statLabel}>Reports</Text>
        </TouchableOpacity>
      </View>

      {/* Section Title */}
      <View style={styles.sectionTitleContainer}>
        <Icon 
          name={selectedStatus === 'users' ? 'users' : selectedStatus === 'reports' ? 'warning' : 'clipboard'} 
          size={18} 
          color={theme.text} 
        />
        <Text style={styles.sectionTitle}>
          {' '}{selectedStatus === 'users'
            ? 'User Management'
            : selectedStatus === 'reports'
            ? 'User Reports'
            : `${selectedStatus} Requests`}
        </Text>
      </View>
    </View>
  );

  const renderUsers = () => {
    if (users.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Icon name="users" size={64} color={theme.textSecondary} />
          <Text style={styles.emptyTitle}>No Users Found</Text>
          <Text style={styles.emptySubtext}>Users will appear here once registered</Text>
        </View>
      );
    }

    return users.map((user) => (
      <View key={user.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.userInfoContainer}>
            <View style={styles.userAvatar}>
              <Icon name="user" size={20} color={theme.accent} />
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.cardTitle}>{user.email}</Text>
              <View style={styles.userMetaRow}>
                <Icon name="phone" size={12} color={theme.textSecondary} />
                <Text style={styles.cardSubtext}> {user.phone_number || 'N/A'}</Text>
              </View>
              <View style={styles.statusBadgeContainer}>
                <View style={[
                  styles.statusBadge,
                  user.account_status === 'frozen' && styles.statusFrozen,
                  user.account_status === 'suspended' && styles.statusSuspended,
                ]}>
                  <Text style={styles.statusText}>
                    {user.account_status || 'Active'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          <TouchableOpacity 
            onPress={() => setMenuVisible(menuVisible === user.id ? null : user.id)}
            style={styles.menuButton}
            activeOpacity={0.85}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>

        {menuVisible === user.id && (
          <View style={styles.menu}>
            <TouchableOpacity 
              onPress={() => handleUserAction(user.id, 'freeze')}
              style={styles.menuItem}
              activeOpacity={0.85}
            >
              <Icon name="snowflake-o" size={14} color={theme.text} />
              <Text style={styles.menuItemText}>Freeze Account</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => handleUserAction(user.id, 'suspend')}
              style={styles.menuItem}
              activeOpacity={0.85}
            >
              <Icon name="pause-circle" size={14} color={theme.text} />
              <Text style={styles.menuItemText}>Suspend Account</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => handleUserAction(user.id, 'reset')}
              style={styles.menuItem}
              activeOpacity={0.85}
            >
              <Icon name="key" size={14} color={theme.text} />
              <Text style={styles.menuItemText}>Reset Password</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity 
              onPress={() => handleUserAction(user.id, 'delete')}
              style={styles.menuItem}
              activeOpacity={0.85}
            >
              <Icon name="trash" size={14} color={theme.error} />
              <Text style={[styles.menuItemText, { color: theme.error }]}>Delete User</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    ));
  };

  const renderReports = () => {
    if (reports.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Icon name="warning" size={64} color={theme.textSecondary} />
          <Text style={styles.emptyTitle}>No Reports Found</Text>
          <Text style={styles.emptySubtext}>User reports will appear here</Text>
        </View>
      );
    }

    return reports.map((r) => (
      <View key={r.id} style={styles.card}>
        <View style={styles.reportHeader}>
          <Icon name="warning" size={16} color="#F57C00" />
          <Text style={styles.reportHeaderText}>User Report</Text>
        </View>
        
        <View style={styles.reportSection}>
          <Text style={styles.reportLabel}>Reported User:</Text>
          <Text style={styles.cardTitle}>{r.reported_name}</Text>
          <Text style={styles.cardSubtext}>ID: {r.reported_student_id || 'N/A'}</Text>
        </View>

        <View style={styles.reportSection}>
          <Text style={styles.reportLabel}>Reported By:</Text>
          <Text style={styles.reportText}>{r.reporter_name}</Text>
          <Text style={styles.cardSubtext}>ID: {r.reporter_student_id || 'N/A'}</Text>
        </View>

        <View style={styles.reportSection}>
          <Text style={styles.reportLabel}>Reason:</Text>
          <Text style={styles.reportReason}>{r.reason}</Text>
        </View>

        {r.details ? (
          <View style={styles.reportSection}>
            <Text style={styles.reportLabel}>Details:</Text>
            <Text style={styles.reportDetails}>{r.details}</Text>
          </View>
        ) : null}

        <View style={styles.reportFooter}>
          <Icon name="clock-o" size={12} color={theme.textSecondary} />
          <Text style={styles.reportDate}> {new Date(r.created_at).toLocaleString()}</Text>
        </View>
      </View>
    ));
  };

  const renderRequests = () => {
    const filtered = selectedStatus
      ? requests.filter((r) => r.status.toLowerCase() === selectedStatus.toLowerCase())
      : requests;

    if (filtered.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Icon name="clipboard" size={64} color={theme.textSecondary} />
          <Text style={styles.emptyTitle}>No {selectedStatus} Requests</Text>
          <Text style={styles.emptySubtext}>Verification requests will appear here</Text>
        </View>
      );
    }

    return filtered.map((req) => (
      <View key={req.id} style={styles.card}>
        <View style={styles.requestHeader}>
          <View>
            <Text style={styles.cardTitle}>{req.email}</Text>
            <View style={styles.requestMetaRow}>
              <Icon name="phone" size={12} color={theme.textSecondary} />
              <Text style={styles.cardSubtext}> {req.phone_number}</Text>
            </View>
            <View style={styles.requestMetaRow}>
              <Icon name="id-card" size={12} color={theme.textSecondary} />
              <Text style={styles.cardSubtext}> {req.student_id}</Text>
            </View>
          </View>
          <View style={[
            styles.statusBadge,
            req.status === 'pending' && styles.statusPending,
            req.status === 'approved' && styles.statusApproved,
            req.status === 'rejected' && styles.statusRejected,
          ]}>
            <Text style={styles.statusText}>{req.status}</Text>
          </View>
        </View>

        {(req.id_image || req.cor_image) && (
          <View style={styles.imageContainer}>
            {req.id_image && (
              <View style={styles.imageWrapper}>
                <Image source={{ uri: req.id_image }} style={styles.verificationImage} />
                <Text style={styles.imageLabel}>ID</Text>
              </View>
            )}
            {req.cor_image && (
              <View style={styles.imageWrapper}>
                <Image source={{ uri: req.cor_image }} style={styles.verificationImage} />
                <Text style={styles.imageLabel}>COR</Text>
              </View>
            )}
          </View>
        )}

        {req.status === 'pending' && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleAction(req.id, 'approved')}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.actionText}>Approve</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleAction(req.id, 'rejected')}
              activeOpacity={0.85}
            >
              <Ionicons name="close-circle" size={18} color="#fff" />
              <Text style={styles.actionText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    ));
  };

  const renderContent = () => {
    if (selectedStatus === 'users') return renderUsers();
    if (selectedStatus === 'reports') return renderReports();
    return renderRequests();
  };

  // Full-screen loading overlay
  if (loading && !refreshing) {
    return (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Loading admin panel...</Text>
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
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
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
          <View style={styles.contentBox}>
            {renderContent()}
          </View>
        </ScrollView>

        {/* Suspend Modal */}
        <Modal visible={suspendModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Icon name="pause-circle" size={24} color={theme.accent} />
                <Text style={styles.modalTitle}>Suspend User</Text>
              </View>
              
              <Text style={styles.modalLabel}>Suspension Duration (days)</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={suspendDays}
                onChangeText={setSuspendDays}
                placeholder="Enter number of days"
                placeholderTextColor={theme.textSecondary}
              />
              
              <View style={styles.modalActions}>
                <TouchableOpacity 
                  onPress={() => setSuspendModalVisible(false)}
                  style={[styles.modalButton, styles.modalCancelButton]}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={confirmSuspend}
                  style={[styles.modalButton, styles.modalConfirmButton]}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalConfirmText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  success: '#4CAF50',
  error: '#d32f2f',
  warning: '#F57C00',
  shadowColor: '#000',
  borderColor: '#2a2a4a',
  modalBackground: '#1e1e3f',
  modalOverlay: 'rgba(0, 0, 0, 0.7)',
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
  success: '#27ae60',
  error: '#e74c3c',
  warning: '#f39c12',
  shadowColor: '#000',
  borderColor: '#e0e0ea',
  modalBackground: '#ffffff',
  modalOverlay: 'rgba(0, 0, 0, 0.5)',
};

const createStyles = (theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 450 : 470,
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  adminIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
  brandedLogoText: {
    fontSize: 20,
    fontWeight: Platform.OS === 'android' ? '900' : '800',
    color: theme.text,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
    letterSpacing: -0.5,
  },
  welcomeSection: {
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
    fontSize: Math.min(width * 0.07, 28),
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
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    width: '47%',
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.borderColor,
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
  statCardSelected: {
    borderColor: theme.accent,
    backgroundColor: theme.cardBackgroundAlt,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  statValue: {
    fontSize: 24,
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
    fontSize: 18,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    color: theme.text,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  contentBox: {
    paddingHorizontal: Math.max(width * 0.05, 20),
    paddingTop: 10,
  },
  card: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.cardBackgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: theme.accent,
  },
  userDetails: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    color: theme.text,
    marginBottom: 4,
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  cardSubtext: {
    fontSize: 13,
    color: theme.textSecondary,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  userMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusBadgeContainer: {
    marginTop: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: theme.success,
  },
  statusPending: {
    backgroundColor: '#FBC02D',
  },
  statusApproved: {
    backgroundColor: '#4CAF50',
  },
  statusRejected: {
    backgroundColor: '#D32F2F',
  },
  statusFrozen: {
    backgroundColor: '#42A5F5',
  },
  statusSuspended: {
    backgroundColor: '#FF9800',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    textTransform: 'capitalize',
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.cardBackgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menu: {
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.borderColor,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    marginLeft: 12,
    fontSize: 14,
    color: theme.text,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
  menuDivider: {
    height: 1,
    backgroundColor: theme.borderColor,
    marginHorizontal: 16,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor,
  },
  reportHeaderText: {
    fontSize: 16,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    color: theme.warning,
    marginLeft: 8,
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  reportSection: {
    marginBottom: 12,
  },
  reportLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 4,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
  reportText: {
    fontSize: 14,
    color: theme.text,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  reportReason: {
    fontSize: 15,
    color: theme.text,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
  reportDetails: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  reportFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.borderColor,
  },
  reportDate: {
    fontSize: 12,
    color: theme.textSecondary,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  requestMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  imageContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 12,
    gap: 12,
  },
  imageWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  verificationImage: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.borderColor,
    resizeMode: 'cover',
  },
  imageLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 6,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  approveButton: {
    backgroundColor: theme.success,
  },
  rejectButton: {
    backgroundColor: theme.error,
  },
  actionText: {
    color: '#fff',
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    fontSize: 14,
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
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
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
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.modalOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: theme.modalBackground,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    color: theme.text,
    marginLeft: 12,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  modalLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 8,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
  modalInput: {
    backgroundColor: theme.cardBackgroundAlt,
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.text,
    marginBottom: 20,
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    backgroundColor: theme.cardBackgroundAlt,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  modalConfirmButton: {
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
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
});