import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

export default function GetVerifiedScreen({ navigation }) {
  const user = auth.currentUser;
  const [studentId, setStudentId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [idImage, setIdImage] = useState(null);
  const [corImage, setCorImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [rejected, setRejected] = useState(false);

  useEffect(() => {
    const checkPreviousStatus = async () => {
      if (!user?.email) return;

      const { data, error } = await supabase
        .from('verifications')
        .select('status')
        .eq('email', user.email)
        .maybeSingle();

      if (!error && data?.status === 'rejected') {
        setRejected(true);
      }
    };

    checkPreviousStatus();
  }, []);

  const pickImage = async (type) => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      const imageUri = result.assets[0].uri;
      if (type === 'id') setIdImage(imageUri);
      else setCorImage(imageUri);
    }
  };

  const uploadFile = async (uri, bucketName, filePath) => {
    try {
      const arrayBuffer = await fetch(uri).then((res) => res.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
      return urlData.publicUrl;
    } catch (err) {
      throw new Error(`Upload failed for ${bucketName}: ${err.message}`);
    }
  };

  const handleSubmit = async () => {
    if (!studentId || !phoneNumber || !idImage || !corImage) {
      Alert.alert('Missing Fields', 'Please fill out all fields and upload both images.');
      return;
    }

    setUploading(true);

    try {
      // ✅ Step 1: Check if a request already exists
      const { data: existingRequest, error: checkError } = await supabase
        .from('verifications')
        .select('id, status')
        .eq('email', user.email)
        .maybeSingle();

      if (checkError) throw checkError;

      // ✅ Step 2: Handle based on current status
      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          Alert.alert('Already Submitted', 'Your verification is still pending. Please wait for approval.');
          setUploading(false);
          return;
        }

        if (existingRequest.status === 'approved') {
          Alert.alert('Already Verified', 'Your account is already verified.');
          setUploading(false);
          return;
        }

        if (existingRequest.status === 'rejected') {
          // Delete the old rejected request to allow re-submission
          await supabase.from('verifications').delete().eq('id', existingRequest.id);
        }
      }

      // ✅ Step 3: Upload files to Supabase storage
      const idUrl = await uploadFile(idImage, 'student-ids', `${user.uid}-id.jpg`);
      const corUrl = await uploadFile(corImage, 'cor-images', `${user.uid}-cor.jpg`);

      // ✅ Step 4: Insert new verification record
      const { error: insertError } = await supabase.from('verifications').insert([
        {
          user_id: user.uid,
          email: user.email,
          phone_number: phoneNumber,
          student_id: studentId,
          id_image: idUrl,
          cor_image: corUrl,
          status: 'pending',
        },
      ]);

      if (insertError) throw insertError;

      Alert.alert('Submitted', 'Your new verification request has been submitted!');
      navigation.replace('VerificationStatus');
    } catch (err) {
      console.error('Error submitting verification request:', err.message);
      Alert.alert('Error', err.message || 'Something went wrong. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* ✅ Banner for rejected users */}
      {rejected && (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Verification Rejected</Text>
          <Text style={styles.bannerText}>
            Your previous verification was rejected. Please review your details and resubmit your request below.
          </Text>
        </View>
      )}

      <Text style={styles.title}>Get Verified</Text>
      <TextInput
        style={styles.input}
        placeholder="Student ID Number"
        value={studentId}
        onChangeText={setStudentId}
      />
      <TextInput
        style={styles.input}
        placeholder="Phone Number"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        keyboardType="phone-pad"
      />

      <TouchableOpacity style={styles.uploadButton} onPress={() => pickImage('id')}>
        <Text style={styles.uploadText}>
          {idImage ? 'Change Student ID Image' : 'Upload Student ID Image'}
        </Text>
      </TouchableOpacity>
      {idImage && <Image source={{ uri: idImage }} style={styles.preview} />}

      <TouchableOpacity style={styles.uploadButton} onPress={() => pickImage('cor')}>
        <Text style={styles.uploadText}>
          {corImage ? 'Change COR Image' : 'Upload COR Image'}
        </Text>
      </TouchableOpacity>
      {corImage && <Image source={{ uri: corImage }} style={styles.preview} />}

      <TouchableOpacity
        style={[styles.submitButton, uploading && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={uploading}
      >
        <Text style={styles.submitText}>
          {uploading ? 'Submitting...' : 'Submit Verification'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 20, color: '#0D47A1' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
  },
  uploadButton: {
    backgroundColor: '#1976d2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  uploadText: { color: '#fff', fontWeight: 'bold' },
  preview: { width: '100%', height: 180, borderRadius: 8, marginVertical: 10 },
  submitButton: {
    backgroundColor: '#43a047',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // ✅ Banner styling
  banner: {
    backgroundColor: '#ffebee',
    borderLeftWidth: 5,
    borderLeftColor: '#d32f2f',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  bannerTitle: {
    fontWeight: 'bold',
    color: '#b71c1c',
    fontSize: 16,
    marginBottom: 5,
  },
  bannerText: {
    color: '#333',
    fontSize: 14,
  },
});
