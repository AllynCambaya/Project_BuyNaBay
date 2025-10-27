import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

export default function ReportScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const reported_student_id = route?.params?.reported_student_id || '';
  const reported_name = route?.params?.reported_name || '';

  const currentUser = auth.currentUser;

  const [reporter_name, setReporterName] = useState(currentUser?.displayName || currentUser?.email || '');
  const [reporter_student_id, setReporterStudentId] = useState('');
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitReport = async () => {
    if (!reporter_name.trim() || !reporter_student_id.trim() || !reason.trim())
      return Alert.alert('Missing info', 'Please fill reporter name, student id and reason.');

    setSubmitting(true);
    try {
      const { error } = await supabase.from('reports').insert([
        {
          reporter_name: reporter_name.trim(),
          reporter_student_id: reporter_student_id.trim(),
          reported_student_id: reported_student_id || null,
          reported_name: reported_name || null,
          reason: reason.trim(),
          details: details.trim() || null,
        },
      ]);

      if (error) throw error;

      Alert.alert('Report submitted', 'Thank you. Your report has been submitted to the admins.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      console.error('Report submit error:', err.message || err);
      Alert.alert('Error', 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report User</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Your name</Text>
        <TextInput style={styles.input} value={reporter_name} onChangeText={setReporterName} placeholder="Your full name" />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Your student ID</Text>
        <TextInput style={styles.input} value={reporter_student_id} onChangeText={setReporterStudentId} placeholder="e.g. 123456" />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Reported student</Text>
        <TextInput style={[styles.input, { backgroundColor: '#f1f1f1' }]} value={reported_name} editable={false} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Reported student ID</Text>
        <TextInput style={[styles.input, { backgroundColor: '#f1f1f1' }]} value={reported_student_id} editable={false} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Reason</Text>
        <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholder="Short reason (e.g. harassment)" />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Details (optional)</Text>
        <TextInput
          style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
          value={details}
          onChangeText={setDetails}
          placeholder="Provide more context, screenshots, links or evidence"
          multiline
        />
      </View>

      <TouchableOpacity style={[styles.submitButton, submitting && { opacity: 0.6 }]} onPress={submitReport} disabled={submitting}>
        <Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Submit Report'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff', flexGrow: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: '700', marginLeft: 12 },
  field: { marginBottom: 12 },
  label: { fontSize: 14, color: '#333', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, backgroundColor: '#fff' },
  submitButton: { backgroundColor: '#D32F2F', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  submitText: { color: '#fff', fontWeight: '700' },
});
