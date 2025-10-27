import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../supabase/supabaseClient';

export default function AdminPanel() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, totalUsers: 0, reports: 0 });
  const [selectedStatus, setSelectedStatus] = useState('Pending');
  const [requests, setRequests] = useState([]);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [menuVisible, setMenuVisible] = useState(null);
  const [suspendModalVisible, setSuspendModalVisible] = useState(false);
  const [suspendDays, setSuspendDays] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);

  const fetchStatsAndRequests = async () => {
    try {
      setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatsAndRequests();
  }, []);

  const handleAction = async (id, newStatus) => {
    try {
      // Read the verification record first so we can copy fields into users when approved
      const { data: verRecord, error: fetchErr } = await supabase
        .from('verifications')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      const { error } = await supabase.from('verifications').update({ status: newStatus }).eq('id', id);
      if (error) throw error;

      // If approved, copy phone_number and student_id into the users table for that email
      if (newStatus === 'approved' && verRecord?.email) {
        const updates = {};
        if (verRecord.phone_number) updates.phone_number = verRecord.phone_number;
        if (verRecord.student_id) updates.student_id = verRecord.student_id;

        if (Object.keys(updates).length > 0) {
          // Try updating existing user row by email
          const { data: updatedUsers, error: updateErr } = await supabase
            .from('users')
            .update(updates)
            .eq('email', verRecord.email);

          if (updateErr) {
            console.warn('Failed to update users row, attempting upsert:', updateErr.message || updateErr);
            // As a fallback try upsert (useful if users row doesn't exist or different primary key)
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

  const renderRequests = () => {
    if (selectedStatus === 'users') {
      if (users.length === 0) return <Text>No users found.</Text>;
      return users.map((user) => (
        <View key={user.id} style={styles.requestCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={styles.requestEmail}>{user.email}</Text>
              <Text>📞 {user.phone_number || 'N/A'}</Text>
              <Text>Status: {user.account_status || 'Active'}</Text>
            </View>
            <TouchableOpacity onPress={() => setMenuVisible(menuVisible === user.id ? null : user.id)}>
              <Ionicons name="ellipsis-vertical" size={20} color="#444" />
            </TouchableOpacity>
          </View>

          {menuVisible === user.id && (
            <View style={styles.menu}>
              <TouchableOpacity onPress={() => handleUserAction(user.id, 'freeze')}>
                <Text style={styles.menuItem}>Freeze</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleUserAction(user.id, 'suspend')}>
                <Text style={styles.menuItem}>Suspend</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleUserAction(user.id, 'reset')}>
                <Text style={styles.menuItem}>Reset Password</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleUserAction(user.id, 'delete')}>
                <Text style={[styles.menuItem, { color: 'red' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ));
    }

    if (selectedStatus === 'reports') {
      if (reports.length === 0) return <Text>No reports found.</Text>;

      return reports.map((r) => (
        <View key={r.id} style={styles.requestCard}>
          <Text style={styles.requestEmail}>Reported: {r.reported_name} ({r.reported_student_id || 'N/A'})</Text>
          <Text>Reporter: {r.reporter_name} ({r.reporter_student_id || 'N/A'})</Text>
          <Text>Reason: {r.reason}</Text>
          {r.details ? <Text>Details: {r.details}</Text> : null}
          <Text style={{ marginTop: 6, color: '#666' }}>Reported at: {new Date(r.created_at).toLocaleString()}</Text>
        </View>
      ));
    }

    const filtered = selectedStatus
      ? requests.filter((r) => r.status.toLowerCase() === selectedStatus.toLowerCase())
      : requests;

    if (filtered.length === 0) return <Text>No {selectedStatus} requests found.</Text>;

    return filtered.map((req) => (
      <View key={req.id} style={styles.requestCard}>
        <Text style={styles.requestEmail}>{req.email}</Text>
        <Text>📞 {req.phone_number}</Text>
        <Text>🎓 Student ID: {req.student_id}</Text>
        <Text>Status: {req.status}</Text>

        <View style={styles.imageRow}>
          {req.id_image && <Image source={{ uri: req.id_image }} style={styles.image} />}
          {req.cor_image && <Image source={{ uri: req.cor_image }} style={styles.image} />}
        </View>

        {req.status === 'pending' && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#43a047' }]}
              onPress={() => handleAction(req.id, 'approved')}
            >
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.actionText}>Approve</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#d32f2f' }]}
              onPress={() => handleAction(req.id, 'rejected')}
            >
              <Ionicons name="close-circle" size={18} color="#fff" />
              <Text style={styles.actionText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    ));
  };

  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
      </View>
    );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name="shield-checkmark" size={32} color="#1976d2" />
        </View>
        <Text style={styles.title}>Admin Panel</Text>
        <Text style={styles.subtitle}>Manage users and verification requests</Text>
      </View>

      <View style={styles.cardContainer}>
        <TouchableOpacity style={[styles.card, { backgroundColor: '#FFF9C4' }]} onPress={() => setSelectedStatus('pending')}>
          <Ionicons name="time" size={24} color="#FBC02D" />
          <Text style={styles.cardCount}>{stats.pending}</Text>
          <Text style={styles.cardLabel}>Pending</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.card, { backgroundColor: '#C8E6C9' }]} onPress={() => setSelectedStatus('approved')}>
          <Ionicons name="checkmark-circle" size={24} color="#388E3C" />
          <Text style={styles.cardCount}>{stats.approved}</Text>
          <Text style={styles.cardLabel}>Approved</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.card, { backgroundColor: '#FFCDD2' }]} onPress={() => setSelectedStatus('rejected')}>
          <Ionicons name="close-circle" size={24} color="#D32F2F" />
          <Text style={styles.cardCount}>{stats.rejected}</Text>
          <Text style={styles.cardLabel}>Rejected</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.card, { backgroundColor: '#BBDEFB' }]} onPress={() => setSelectedStatus('users')}>
          <Ionicons name="people" size={24} color="#1976d2" />
          <Text style={styles.cardCount}>{stats.totalUsers}</Text>
          <Text style={styles.cardLabel}>Total Users</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.card, { backgroundColor: '#FFE0B2' }]} onPress={() => setSelectedStatus('reports')}>
          <Ionicons name="warning" size={24} color="#F57C00" />
          <Text style={styles.cardCount}>{stats.reports}</Text>
          <Text style={styles.cardLabel}>Reports</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.contentBox}>
        <Text style={styles.sectionTitle}>
          {selectedStatus === 'users'
            ? 'USER MANAGEMENT'
            : selectedStatus === 'reports'
            ? 'REPORTS'
            : `${selectedStatus.toUpperCase()} REQUESTS`}
        </Text>
        {renderRequests()}
      </View>

      {/* Suspend modal */}
      <Modal visible={suspendModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalBox}>
            <Text style={{ fontWeight: 'bold', fontSize: 16 }}>Suspend for how many days?</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={suspendDays}
              onChangeText={setSuspendDays}
              placeholder="Enter days"
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity onPress={() => setSuspendModalVisible(false)}>
                <Text style={{ color: 'gray' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmSuspend}>
                <Text style={{ color: '#1976d2', fontWeight: 'bold' }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#f5f8ff', paddingHorizontal: 16 },
  header: { alignItems: 'center', marginVertical: 30 },
  iconCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#E3F2FD', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#0D47A1' },
  subtitle: { color: '#666', fontSize: 14, textAlign: 'center' },
  cardContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginVertical: 10 },
  card: { width: '47%', borderRadius: 16, padding: 20, marginVertical: 8, alignItems: 'center', elevation: 2 },
  cardCount: { fontSize: 22, fontWeight: 'bold', marginVertical: 6 },
  cardLabel: { fontSize: 14, color: '#444' },
  contentBox: { marginTop: 15, backgroundColor: '#fff', borderRadius: 12, padding: 20, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#0D47A1', marginBottom: 10 },
  requestCard: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 15, marginVertical: 8, backgroundColor: '#fafafa' },
  requestEmail: { fontWeight: 'bold', color: '#0D47A1', marginBottom: 5 },
  imageRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  image: { width: 120, height: 120, borderRadius: 8, borderWidth: 1, borderColor: '#ccc' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 15 },
  actionButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  actionText: { color: '#fff', fontWeight: 'bold', marginLeft: 5 },
  menu: { backgroundColor: '#fff', borderRadius: 8, elevation: 3, marginTop: 5, padding: 8 },
  menuItem: { paddingVertical: 6, fontSize: 14 },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalBox: { width: '80%', backgroundColor: '#fff', padding: 20, borderRadius: 10 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8, marginVertical: 10 },
});