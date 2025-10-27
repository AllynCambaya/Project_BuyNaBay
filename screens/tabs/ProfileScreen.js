<<<<<<< Updated upstream
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
=======
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
>>>>>>> Stashed changes
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

const { width, height } = Dimensions.get('window');

export default function ProfileScreen({ navigation }) {
  const user = auth.currentUser;
  const [name, setName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [studentId, setStudentId] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);

  // User's products and refreshing state
  const [myProducts, setMyProducts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Automatically detect system theme
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;

  // Get current theme colors based on system settings
  const theme = isDarkMode ? darkTheme : lightTheme;

  // Initial animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(headerSlideAnim, {
        toValue: 0,
        duration: 700,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const fetchProfile = async () => {
    if (user?.uid) {
      const { data, error } = await supabase
        .from('users')
        .select('name, phone_number, student_id')
        .eq('id', user.uid)
        .single();

      if (error) console.log('Fetch error:', error.message);

      if (data) {
        if (data.name) setName(data.name);
        if (data.phone_number) setPhoneNumber(data.phone_number);
        if (data.student_id) setStudentId(data.student_id);
      }
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
    await fetchMyProducts();
    setRefreshing(false);
  }, []);

  // Save changes to Supabase
  const handleSave = async () => {
    setLoading(true);
    const updates = { phone_number: phoneNumber, student_id: studentId };
    const { error } = await supabase.from('users').update(updates).eq('id', user.uid);
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
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await auth.signOut();
              navigation.replace('Login');
            } catch (error) {
              Alert.alert('Logout Error', error.message);
            }
          },
        },
      ]
    );
  };

<<<<<<< Updated upstream
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

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

      {editMode ? (
        <TouchableOpacity
          style={[styles.button, styles.saveButton]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.button, styles.editButton]}
          onPress={() => setEditMode(true)}
        >
          <Text style={styles.buttonText}>Edit Profile</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={[styles.button, styles.logoutButton]} onPress={handleLogout}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>

      {/* User's Products List with pull-to-refresh */}
      <Text style={[styles.sectionTitle, { marginTop: 30 }]}>My Products</Text>
      <FlatList
        data={myProducts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.productCard}>
            <Text style={styles.productName}>{item.product_name}</Text>
            <Text>{item.description}</Text>
            <Text>Qty: {item.quantity} | ₱{item.price}</Text>
            <Text>Category: {item.category} | Condition: {item.condition}</Text>
          </View>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text>No products added yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 20 },
  label: { fontSize: 18, color: '#555', marginTop: 10 },
  value: { fontSize: 20, color: '#222', fontWeight: '600', marginBottom: 10 },
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
  button: { marginTop: 18, paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8, alignItems: 'center' },
  editButton: { backgroundColor: '#1976d2' },
  saveButton: { backgroundColor: '#43a047' },
  logoutButton: { backgroundColor: '#d32f2f' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  productCard: { padding: 12, borderWidth: 1, borderRadius: 8, marginBottom: 10, backgroundColor: '#f9f9f9' },
  productName: { fontSize: 18, fontWeight: 'bold' },
});
=======
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
      <Animated.View 
        style={[
          styles.productCard,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
          }
        ]}
      >
        {imageArray.length > 0 && (
          <TouchableOpacity onPress={() => openImageModal(imageArray)}>
            <Image
              source={{ uri: imageArray[0] }}
              style={styles.productImage}
              resizeMode="cover"
            />
            {imageArray.length > 1 && (
              <View style={styles.imageCountBadge}>
                <Icon name="images" size={12} color="#fff" />
                <Text style={styles.imageCountText}>{imageArray.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>{item.product_name}</Text>
          <Text style={styles.productDesc} numberOfLines={2}>{item.description}</Text>
          <View style={styles.productMetaRow}>
            <View style={styles.priceContainer}>
              <Text style={styles.productPrice}>₱{item.price}</Text>
            </View>
            <View style={styles.quantityContainer}>
              <Icon name="cube" size={12} color={theme.textSecondary} />
              <Text style={styles.productQuantity}> {item.quantity}</Text>
            </View>
          </View>
          <View style={styles.categoryRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
            <View style={styles.conditionBadge}>
              <Text style={styles.conditionText}>{item.condition}</Text>
            </View>
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContentContainer}>
      {/* Background gradient effect */}
      <View style={styles.backgroundGradient} />
      
      {/* Animated header */}
      <Animated.View 
        style={[
          styles.profileHeader, 
          {
            transform: [{ translateY: headerSlideAnim }],
            opacity: fadeAnim,
          }
        ]}
      >
        <TouchableOpacity onPress={handleImagePick} style={styles.avatarContainer}>
          <Image source={getAvatarSource()} style={styles.avatar} />
          <View style={styles.cameraIconContainer}>
            <Icon name="camera" size={16} color="#fff" />
          </View>
        </TouchableOpacity>

        <View style={styles.nameContainer}>
          <Text style={styles.userName}>{name || 'N/A'}</Text>
          {verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>

        {joinedDate ? (
          <View style={styles.joinedContainer}>
            <Icon name="calendar" size={12} color={theme.textSecondary} />
            <Text style={styles.joinedText}> {joinedDate}</Text>
          </View>
        ) : null}
      </Animated.View>

      {/* Animated info cards */}
      <Animated.View
        style={[
          styles.infoSection,
          {
            transform: [{ translateY: slideAnim }],
            opacity: fadeAnim,
          }
        ]}
      >
        {/* Email Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <Icon name="envelope" size={16} color={theme.accent} />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{email || 'N/A'}</Text>
          </View>
        </View>

        {/* Phone number and student ID are only shown after verification */}
        {verified && (
          <>
            <View style={styles.infoCard}>
              <View style={styles.infoIconContainer}>
                <Icon name="phone" size={16} color={theme.accent} />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Phone Number</Text>
                <Text style={styles.infoValue}>{phoneNumber || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoIconContainer}>
                <Icon name="id-card" size={16} color={theme.accent} />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Student ID</Text>
                <Text style={styles.infoValue}>{studentId || 'N/A'}</Text>
              </View>
            </View>
          </>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.verifyButton]}
            onPress={handleGetVerified}
            activeOpacity={0.85}
          >
            <Icon name="shield" size={16} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Get Verified</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.logoutButton]}
            onPress={handleLogout}
            activeOpacity={0.85}
          >
            <Icon name="sign-out" size={16} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Products Section Header */}
      <View style={styles.sectionHeader}>
        <Icon name="shopping-bag" size={20} color={theme.text} />
        <Text style={styles.sectionTitle}> My Products</Text>
        <View style={styles.productCountBadge}>
          <Text style={styles.productCountText}>{myProducts.length}</Text>
        </View>
      </View>
    </View>
  );

  const styles = createStyles(theme);

  // Full-screen loading overlay
  if (profileLoading) {
    return (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"} 
        backgroundColor={theme.background}
        translucent={false}
      />
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={myProducts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderProduct}
          ListHeaderComponent={renderHeader}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="inbox" size={48} color={theme.textSecondary} />
              <Text style={styles.emptyText}>No products added yet</Text>
              <Text style={styles.emptySubtext}>Start selling by adding your first product</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
                <Ionicons name="close-circle" size={40} color="#fff" />
              </TouchableOpacity>
              {selectedImages.length > 1 && (
                <View style={styles.imageIndicator}>
                  <Text style={styles.imageIndicatorText}>
                    Swipe to view all {selectedImages.length} images
                  </Text>
                </View>
              )}
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
  inputBackground: '#fff',
  inputText: '#333',
  inputIcon: '#666',
  placeholder: '#999',
  accent: '#FDAD00',
  accentSecondary: '#e8ecf1',
  buttonDisabled: '#4a4a6a',
  error: '#FF6B6B',
  success: '#4CAF50',
  verifyColor: '#fbc02d',
  logoutColor: '#d32f2f',
  divider: '#333',
  borderColor: '#2a2a4a',
  shadowColor: '#000',
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
  inputBackground: '#ffffff',
  inputText: '#1a1a2e',
  inputIcon: '#7a7a9a',
  placeholder: '#9a9ab0',
  accent: '#f39c12',
  accentSecondary: '#e67e22',
  buttonDisabled: '#d0d0e0',
  error: '#e74c3c',
  success: '#27ae60',
  verifyColor: '#f39c12',
  logoutColor: '#e74c3c',
  divider: '#d0d0e0',
  borderColor: '#e0e0ea',
  shadowColor: '#000',
};

const createStyles = (theme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  listContent: {
    paddingBottom: 20,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 220 : 240,
    backgroundColor: theme.gradientBackground,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    zIndex: 0,
  },
  headerContentContainer: {
    paddingHorizontal: Math.max(width * 0.05, 20),
    paddingTop: 20,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 30,
    zIndex: 2,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: theme.accent,
    ...Platform.select({
      ios: {
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.accent,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.background,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  userName: {
    fontSize: Math.min(width * 0.065, 26),
    color: theme.text,
    fontWeight: Platform.OS === 'android' ? '900' : '800',
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  verifiedText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  joinedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  joinedText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  infoSection: {
    marginBottom: 30,
    zIndex: 1,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
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
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${theme.accent}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 2,
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  infoValue: {
    fontSize: 16,
    color: theme.text,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
  buttonContainer: {
    marginTop: 8,
  },
  button: {
    flexDirection: 'row',
    paddingVertical: Platform.OS === 'ios' ? 16 : 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  verifyButton: {
    backgroundColor: theme.verifyColor,
  },
  logoutButton: {
    backgroundColor: theme.logoutColor,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    color: theme.text,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
    flex: 1,
  },
  productCountBadge: {
    backgroundColor: theme.accent,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  productCountText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  productCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
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
  productImage: {
    width: '100%',
    height: 200,
  },
  imageCountBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  imageCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
  productInfo: {
    padding: 16,
  },
  productName: {
    fontSize: 18,
    fontWeight: Platform.OS === 'android' ? '700' : '600',
    color: theme.text,
    marginBottom: 6,
    fontFamily: Platform.select({
      ios: 'Poppins-SemiBold',
      android: 'Poppins-Bold',
      default: 'Poppins-SemiBold',
    }),
  },
  productDesc: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  productMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  priceContainer: {
    backgroundColor: `${theme.accent}20`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: Platform.OS === 'android' ? '800' : '700',
    color: theme.accent,
    fontFamily: Platform.select({
      ios: 'Poppins-Bold',
      android: 'Poppins-ExtraBold',
      default: 'Poppins-Bold',
    }),
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productQuantity: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryBadge: {
    backgroundColor: `${theme.accentSecondary}20`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 12,
    color: theme.accentSecondary,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
  conditionBadge: {
    backgroundColor: `${theme.success}20`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  conditionText: {
    fontSize: 12,
    color: theme.success,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: theme.textSecondary,
    marginTop: 16,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '80%',
    justifyContent: 'center',
  },
  modalImage: {
    width: width,
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    right: 20,
    zIndex: 10,
  },
  imageIndicator: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  imageIndicatorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: Platform.OS === 'android' ? '500' : '400',
    fontFamily: Platform.select({
      ios: 'Poppins-Regular',
      android: 'Poppins-Medium',
      default: 'Poppins-Regular',
    }),
  },
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  loadingText: {
    color: theme.text,
    marginTop: 16,
    fontSize: 16,
    fontWeight: Platform.OS === 'android' ? '600' : '500',
    fontFamily: Platform.select({
      ios: 'Poppins-Medium',
      android: 'Poppins-SemiBold',
      default: 'Poppins-Medium',
    }),
  },
});
>>>>>>> Stashed changes
