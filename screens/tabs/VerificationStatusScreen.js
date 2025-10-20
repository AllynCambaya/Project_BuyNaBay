import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

export default function VerificationStatusScreen({ navigation }) {
  const user = auth.currentUser;
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(false);

  const fetchVerificationStatus = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // ✅ FIXED: fetch all records instead of forcing a single one
      const { data, error } = await supabase
        .from('verifications')
        .select('status, created_at')
        .eq('email', user.email)
        .order('created_at', { ascending: false });

      setLoading(false);

      if (error) {
        console.error('Supabase error:', error.message);
        Alert.alert('Error', 'Failed to fetch verification status.');
        return;
      }

      if (!data || data.length === 0) {
        Alert.alert(
          'No Verification Found',
          'You haven’t submitted a verification yet.'
        );
        navigation.goBack();
        return;
      }

      // ✅ Take the most recent verification record
      const latestStatus = data[0].status;
      setStatus(latestStatus);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Something went wrong while fetching status.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerificationStatus();
  }, []);

  const renderStatusBadge = () => {
    let color = '#FFD700', text = 'Pending Review';
    if (status === 'approved') { color = '#43a047'; text = 'Verified'; }
    else if (status === 'rejected') { color = '#d32f2f'; text = 'Rejected'; }
    return (
      <View style={[styles.badge, { backgroundColor: color + '33' }]}>
        <Text style={[styles.badgeText, { color }]}>{text}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Ionicons name="time-outline" size={70} color="#FBC02D" style={{ marginBottom: 15 }} />
      <Text style={styles.title}>
        {status === 'approved'
          ? 'Verification Complete'
          : status === 'rejected'
          ? 'Verification Rejected'
          : 'Verification Under Review'}
      </Text>
      {renderStatusBadge()}

      <Text style={styles.description}>
        {status === 'approved'
          ? 'Your profile has been successfully verified. You now have full access to the marketplace.'
          : status === 'rejected'
          ? 'Your verification request was rejected. Please check your details and try again.'
          : 'Our admin team is reviewing your student ID and COR images. This usually takes 1–2 business days. You’ll be notified once your profile is verified.'}
      </Text>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>What happens next?</Text>
        <Text style={styles.bullet}>• Admin reviews your uploaded documents</Text>
        <Text style={styles.bullet}>• Verification typically takes 1–2 business days</Text>
        <Text style={styles.bullet}>• You’ll be notified of the decision</Text>
        <Text style={styles.bullet}>• Once approved, you get full marketplace access</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.refreshButton} onPress={fetchVerificationStatus}>
          <Ionicons name="refresh" size={18} color="#0D47A1" />
          <Text style={styles.refreshText}>
            {loading ? 'Checking...' : 'Refresh Status'}
          </Text>
        </TouchableOpacity>

       <TouchableOpacity
  style={styles.browseButton}
  onPress={() => navigation.reset({
    index: 0,
    routes: [{ name: 'HomepageScreen' }],
  })}
>
          <Ionicons name="home-outline" size={18} color="#0D47A1" />
          <Text style={styles.refreshText}>Browse Products</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 25, backgroundColor: '#fff', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, color: '#0D47A1', textAlign: 'center' },
  badge: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, marginBottom: 15 },
  badgeText: { fontWeight: 'bold', fontSize: 16 },
  description: { textAlign: 'center', fontSize: 15, color: '#444', marginBottom: 20 },
  infoBox: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 10,
    width: '100%',
    marginBottom: 25,
  },
  infoTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 8, color: '#0D47A1' },
  bullet: { fontSize: 14, color: '#333', marginVertical: 2 },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    marginRight: 10,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  refreshText: { color: '#0D47A1', fontWeight: 'bold', marginLeft: 6 },
});
