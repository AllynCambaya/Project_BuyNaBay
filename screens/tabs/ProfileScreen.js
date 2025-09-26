import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

export default function ProfileScreen({ navigation }) {
  const user = auth.currentUser;
  const [name, setName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [studentId, setStudentId] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profilePic, setProfilePic] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Fetch profile info from Supabase
  useEffect(() => {
    const fetchProfile = async () => {
      if (user?.uid) {
        const { data, error } = await supabase
          .from('users')
          .select('name, phone_number, student_id, profile_pic')
          .eq('id', user.uid)
          .single();

        if (error) {
          console.log('Fetch error:', error.message);
        }

        if (data) {
          if (data.name) setName(data.name);
          if (data.phone_number) setPhoneNumber(data.phone_number);
          if (data.student_id) setStudentId(data.student_id);
          if (data.profile_pic) setProfilePic(data.profile_pic);
        }
      }
    };
    fetchProfile();
  }, [user]);
  // Pick and upload profile picture
  const pickProfilePic = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setUploading(true);
      // Upload to Supabase Storage (bucket: 'profile-pics')
      const fileName = `${user.uid}_${Date.now()}.jpg`;
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const { data, error } = await supabase.storage
        .from('profile-pics')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });
      if (error) {
        Alert.alert('Upload Error', error.message);
        setUploading(false);
        return;
      }
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profile-pics')
        .getPublicUrl(fileName);
      const publicUrl = urlData?.publicUrl;
      // Save URL to user profile
      await supabase
        .from('users')
        .update({ profile_pic: publicUrl })
        .eq('id', user.uid);
      setProfilePic(publicUrl);
      setUploading(false);
      Alert.alert('Success', 'Profile picture updated!');
    }
  };

  // Save changes to Supabase
  const handleSave = async () => {
    setLoading(true);

    const updates = {
      phone_number: phoneNumber,
      student_id: studentId,
    };

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.uid);

    setLoading(false);

    if (error) {
      Alert.alert('Error', 'Failed to update profile.');
      console.log('Update error:', error.message);
    } else {
      Alert.alert('Success', 'Profile updated successfully.');
      setEditMode(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigation.replace('Login');
    } catch (error) {
      Alert.alert('Logout Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      {/* Profile Picture */}
      <TouchableOpacity onPress={pickProfilePic} disabled={uploading} style={styles.picContainer}>
        <Image
          source={profilePic ? { uri: profilePic } : require('../../assets/images/icon.png')}
          style={styles.profilePic}
        />
        <Text style={styles.picEdit}>{uploading ? 'Uploading...' : 'Edit Photo'}</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Name:</Text>
      <Text style={styles.value}>{name || 'N/A'}</Text>

      <Text style={styles.label}>Email:</Text>
      <Text style={styles.value}>{email || 'N/A'}</Text>

      <Text style={styles.label}>Phone Number:</Text>
      {editMode ? (
        <TextInput
          style={styles.input}
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          placeholder="Enter phone number"
          keyboardType="phone-pad"
        />
      ) : (
        <Text style={styles.value}>{phoneNumber || 'N/A'}</Text>
      )}

      <Text style={styles.label}>Student ID:</Text>
      {editMode ? (
        <TextInput
          style={styles.input}
          value={studentId}
          onChangeText={setStudentId}
          placeholder="Enter student ID"
        />
      ) : (
        <Text style={styles.value}>{studentId || 'N/A'}</Text>
      )}

      {/* Edit Profile & Save Buttons */}
      {editMode ? (
        <TouchableOpacity
          style={[styles.button, styles.saveButton]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.button, styles.editButton]}
          onPress={() => setEditMode(true)}
        >
          <Text style={styles.buttonText}>Edit Profile</Text>
        </TouchableOpacity>
      )}

      {/* Logout Button */}
      <TouchableOpacity
        style={[styles.button, styles.logoutButton]}
        onPress={handleLogout}
      >
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  label: {
    fontSize: 18,
    color: '#555',
    marginTop: 10,
  },
  value: {
    fontSize: 20,
    color: '#222',
    fontWeight: '600',
    marginBottom: 10,
  },
  input: {
    fontSize: 18,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    width: 220,
    backgroundColor: '#f9f9f9',
  },
  button: {
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#1976d2',
  },
  saveButton: {
    backgroundColor: '#43a047',
  },
  logoutButton: {
    backgroundColor: '#d32f2f',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  picContainer: {
    alignItems: 'center',
    marginBottom: 18,
  },
  profilePic: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#eee',
    marginBottom: 6,
  },
  picEdit: {
    color: '#1976d2',
    fontSize: 14,
    marginBottom: 8,
  },
});
