import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

export default function ProfileScreen({ navigation }) {
  const user = auth.currentUser;
  const [name, setName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [studentId, setStudentId] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [myProducts, setMyProducts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [verified, setVerified] = useState(false);
  const [joinedDate, setJoinedDate] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);

  const fetchProfile = async () => {
    if (!user?.uid) return;

    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('name, phone_number, student_id, profile_photo, created_at')
        .eq('id', user.uid)
        .single();

      if (error) {
        console.log('Fetch error:', error.message);
        return;
      }

      setName(data.name || '');
      setPhoneNumber(data.phone_number || '');
      setStudentId(data.student_id || '');
      setProfilePhoto(data.profile_photo || null);

      // Format joined date
      if (data.created_at) {
        const date = new Date(data.created_at);
        const formatted = `Joined ${date.toLocaleString('default', {
          month: 'long',
          year: 'numeric',
        })}`;
        setJoinedDate(formatted);
      }

      // Fetch verification status
      const { data: verificationData, error: verificationError } = await supabase
        .from('verifications')
        .select('status')
        .eq('email', user.email)
        .single();

      if (verificationError && verificationError.code !== 'PGRST116') {
        console.log('Verification fetch error:', verificationError.message);
      }

      setVerified(verificationData?.status === 'approved');
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchMyProducts = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('email', user.email)
      .order('id', { ascending: false });

    if (error) console.log('Fetch products error:', error.message);
    else setMyProducts(data);
  };

  useEffect(() => {
    fetchProfile();
    fetchMyProducts();
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProfile();
    await fetchMyProducts();
    setRefreshing(false);
  }, []);

  const handleGetVerified = () => navigation.navigate('GetVerified');

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigation.replace('Login');
    } catch (error) {
      Alert.alert('Logout Error', error.message);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const updates = { phone_number: phoneNumber, student_id: studentId };
    const { error } = await supabase.from('users').update(updates).eq('id', user.uid);
    setLoading(false);
    if (error) {
      Alert.alert('Error', 'Failed to update profile.');
    } else {
      Alert.alert('Success', 'Profile updated successfully.');
      setEditMode(false);
    }
  };

  const handleImagePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      const imageUri = result.assets[0].uri;
      const response = await fetch(imageUri);
      const arrayBuffer = await response.arrayBuffer();
      const fileExt = imageUri.split('.').pop();
      const fileName = `${user.uid}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('profile-avatars')
        .upload(fileName, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });
      if (uploadError) {
        Alert.alert('Upload Error', uploadError.message);
        return;
      }
      const { data } = supabase.storage.from('profile-avatars').getPublicUrl(fileName);
      const publicUrl = data.publicUrl;
      await supabase.from('users').update({ profile_photo: publicUrl }).eq('id', user.uid);
      setProfilePhoto(publicUrl);
      Alert.alert('Success', 'Profile photo updated!');
    }
  };

  const getAvatarSource = () => {
    if (profilePhoto) return { uri: profilePhoto };
    return {
      uri: supabase.storage
        .from('profile-avatars')
        .getPublicUrl('default-avatar.jpg').data.publicUrl,
    };
  };

  const openImageModal = (imageUrls) => {
    if (!imageUrls || imageUrls.length === 0) return;
    const images = typeof imageUrls === 'string' ? [imageUrls] : imageUrls;
    setSelectedImages(images);
    setModalVisible(true);
  };

  // 🧩 Product Card
  const renderProduct = ({ item }) => {
    let imageArray = [];
    if (item.product_image_url) {
      try {
        imageArray = JSON.parse(item.product_image_url);
      } catch {
        imageArray = [item.product_image_url];
      }
    }

    return (
      <View style={styles.productCard}>
        {imageArray.length > 0 && (
          <TouchableOpacity onPress={() => openImageModal(imageArray)}>
            <Image
              source={{ uri: imageArray[0] }}
              style={styles.productImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{item.product_name}</Text>
          <Text style={styles.productDesc}>{item.description}</Text>
          <Text style={styles.productMeta}>
            Qty: {item.quantity} | ₱{item.price}
          </Text>
          <Text style={styles.productMeta}>
            {item.category} • {item.condition}
          </Text>
        </View>
      </View>
    );
  };

  // 🧩 Profile Header
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={styles.title}>Profile</Text>

      {profileLoading ? (
        <ActivityIndicator size="large" color="#1976d2" />
      ) : (
        <>
          <TouchableOpacity onPress={handleImagePick}>
            <Image source={getAvatarSource()} style={styles.avatar} />
          </TouchableOpacity>
          <Text style={styles.changePhotoText}>Tap to change photo</Text>

          <View style={styles.nameContainer}>
            <Text style={styles.value}>{name || 'N/A'}</Text>
            {verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="white" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>

          {joinedDate ? <Text style={styles.joinedText}>{joinedDate}</Text> : null}

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

          <TouchableOpacity
            style={[styles.button, styles.verifyButton]}
            onPress={handleGetVerified}
          >
            <Text style={styles.buttonText}>Get Verified</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.logoutButton]}
            onPress={handleLogout}
          >
            <Text style={styles.buttonText}>Logout</Text>
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { marginTop: 30 }]}>
            My Products
          </Text>
        </>
      )}
    </View>
  );

  return (
    <>
      <FlatList
        data={myProducts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderProduct}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', marginTop: 10 }}>
            No products added yet.
          </Text>
        }
        contentContainerStyle={{ padding: 20 }}
      />

      {/* Modal for multiple images */}
      <Modal visible={modalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
            >
              {selectedImages.map((img, index) => (
                <Image
                  key={index}
                  source={{ uri: img }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Ionicons name="close-circle" size={32} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerContainer: { alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 10 },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#ccc',
  },
  changePhotoText: { fontSize: 14, color: '#555', marginBottom: 10 },
  nameContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  verifiedText: { color: '#fff', fontSize: 13, marginLeft: 4 },
  joinedText: { fontSize: 14, color: '#666', marginBottom: 10 },
  label: { fontSize: 18, color: '#555', marginTop: 10, alignSelf: 'flex-start' },
  value: {
    fontSize: 20,
    color: '#222',
    fontWeight: '600',
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  input: {
    fontSize: 18,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    width: '100%',
    backgroundColor: '#f9f9f9',
  },
  button: {
    marginTop: 18,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  editButton: { backgroundColor: '#1976d2' },
  saveButton: { backgroundColor: '#43a047' },
  verifyButton: { backgroundColor: '#fbc02d' },
  logoutButton: { backgroundColor: '#d32f2f' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', alignSelf: 'flex-start' },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 15,
    overflow: 'hidden',
    elevation: 2,
  },
  productImage: {
    width: '100%',
    height: 180,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  productInfo: { padding: 10 },
  productName: { fontSize: 18, fontWeight: 'bold', color: '#222' },
  productDesc: { fontSize: 14, color: '#555', marginVertical: 4 },
  productMeta: { fontSize: 13, color: '#777' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: { width: '100%', height: '70%' },
  modalImage: { width: 350, height: '100%', marginHorizontal: 5 },
  closeButton: { position: 'absolute', top: 30, right: 20 },
});
