// screens/authentication/AdminPanel.js
import { useEffect, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabase/supabaseClient';

const AdminPanel = () => {
  const [verificationRequests, setVerificationRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_verification_codes')
        .select('*')
        .eq('status', 'pending');

      if (error) throw error;
      setVerificationRequests(data || []);
    } catch (err) {
      console.log('Error fetching requests:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (id) => {
    try {
      const { error } = await supabase
        .from('email_verification_codes')
        .update({ status: 'approved' })
        .eq('id', id);

      if (error) throw error;

      Alert.alert('Success', 'Verification approved.');
      fetchRequests();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleReject = async (id) => {
    try {
      const { error } = await supabase
        .from('email_verification_codes')
        .update({ status: 'rejected' })
        .eq('id', id);

      if (error) throw error;

      Alert.alert('Success', 'Verification rejected.');
      fetchRequests();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const renderRequest = ({ item }) => (
    <View style={styles.requestCard}>
      <Text style={styles.userText}>Email: {item.email}</Text>
      <Text style={styles.userText}>Phone: {item.phone_number}</Text>
      <Text style={styles.userText}>School ID: {item.school_id}</Text>
      <View style={styles.buttonRow}>
        <TouchableOpacity style={[styles.button, styles.approve]} onPress={() => handleApprove(item.id)}>
          <Text style={styles.buttonText}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.reject]} onPress={() => handleReject(item.id)}>
          <Text style={styles.buttonText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Admin Panel - Verification Requests</Text>
        {loading ? (
          <Text>Loading...</Text>
        ) : verificationRequests.length === 0 ? (
          <Text>No pending requests</Text>
        ) : (
          <FlatList
            data={verificationRequests}
            renderItem={renderRequest}
            keyExtractor={(item) => item.id.toString()}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f7fa',
    flexGrow: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'Poppins-Bold',
  },
  requestCard: {  
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 16,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  userText: {
    fontSize: 16,
    marginBottom: 8,
    fontFamily: 'Poppins-Regular',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    padding: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  approve: {
    backgroundColor: '#27ae60',
  },
  reject: {
    backgroundColor: '#e74c3c',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontFamily: 'Poppins-Bold',
  },
});

export default AdminPanel;