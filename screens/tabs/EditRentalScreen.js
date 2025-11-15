// screens/EditRentalScreen.js
import { FontAwesome as Icon, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useColorScheme,
} from 'react-native';
import { supabase } from '../../supabase/supabaseClient';
import { fontFamily } from '../../theme/typography';

const { width } = Dimensions.get('window');

const CATEGORIES = [
  'Electronics',
  'Tools',
  'Party&Events',
  'Sports&outdoors',
  'Apparel',
  'Vehicles',
  'Other',
];

const CONDITIONS = ['new', 'used', 'refurbished'];

const RENTAL_DURATIONS = ['per hour', 'per day', 'per week', 'per month'];

export default function EditRentalScreen({ navigation, route }) {
  const { rentalItem } = route.params;
  const systemColorScheme = useColorScheme();
  const isDarkMode = systemColorScheme === 'dark';
  const theme = isDarkMode ? darkTheme : lightTheme;
  const styles = createStyles(theme);

  const [itemName, setItemName] = useState(rentalItem.product_name || '');
  const [description, setDescription] = useState(rentalItem.description || '');
  const [price, setPrice] = useState(rentalItem.price?.toString() || '');
  const [quantity, setQuantity] = useState(rentalItem.quantity?.toString() || '');
  const [category, setCategory] = useState(rentalItem.category || '');
  const [condition, setCondition] = useState(rentalItem.condition || '');
  const [rentalDuration, setRentalDuration] = useState(rentalItem.rental_duration || '');
  const [images, setImages] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Parse existing images
    const imageUrl = rentalItem.product_image_url || rentalItem.image;
    const imageUrls = imageUrl
      ? Array.isArray(imageUrl)
        ? imageUrl
        : (() => {
            try {
              return JSON.parse(imageUrl);
            } catch {
              return [imageUrl];
            }
          })()
      : [];
    setExistingImages(imageUrls);
  }, [rentalItem]);

  const pickImages = async () => {
    const totalImages = existingImages.length + images.length;
    if (totalImages >= 4) {
      Alert.alert('Limit Reached', 'You can only have up to 4 images per rental item.');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera roll permissions to select images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 4 - totalImages,
    });

    if (!result.canceled) {
      setImages([...images, ...result.assets]);
    }
  };

  const removeExistingImage = (index) => {
    const newExistingImages = [...existingImages];
    newExistingImages.splice(index, 1);
    setExistingImages(newExistingImages);
  };

  const removeNewImage = (index) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };

  const uploadNewImages = async () => {
    const uploadedUrls = [];
    
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const fileExt = image.uri.split('.').pop();
      const fileName = `rental-items/${rentalItem.id}_${Date.now()}_${i}.${fileExt}`;

      const formData = new FormData();
      formData.append('file', {
        uri: image.uri,
        type: `image/${fileExt}`,
        name: fileName,
      });

      const { data, error } = await supabase.storage
        .from('rental-images')
        .upload(fileName, formData, {
          contentType: `image/${fileExt}`,
          upsert: false,
        });

      if (error) {
        console.error('Upload error:', error);
        throw error;
      }

      const { data: publicUrlData } = supabase.storage
        .from('rental-images')
        .getPublicUrl(fileName);

      uploadedUrls.push(publicUrlData.publicUrl);
    }

    return uploadedUrls;
  };

  const handleUpdate = async () => {
    // Validation
    if (!itemName.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }
    if (!price.trim() || isNaN(parseFloat(price))) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }
    if (!quantity.trim() || isNaN(parseInt(quantity))) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }
    if (!category) {
      Alert.alert('Error', 'Please select a category');
      return;
    }
    if (!rentalDuration) {
      Alert.alert('Error', 'Please select a rental duration');
      return;
    }

    setLoading(true);

    try {
      // Upload new images if any
      let newImageUrls = [];
      if (images.length > 0) {
        newImageUrls = await uploadNewImages();
      }

      // Combine existing and new image URLs
      const allImageUrls = [...existingImages, ...newImageUrls];
      const imageUrl = allImageUrls.length > 0 ? allImageUrls[0] : null;

      // Update rental item in database
      const { error } = await supabase
        .from('rental_items')
        .update({
          item_name: itemName.trim(),
          description: description.trim(),
          price: parseFloat(price),
          quantity: parseInt(quantity),
          category,
          condition,
          rental_duration: rentalDuration,
          rental_item_image: imageUrl,
        })
        .eq('id', rentalItem.id);

      if (error) throw error;

      Alert.alert('Success', 'Rental item updated successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Error updating rental item:', error);
      Alert.alert('Error', error.message || 'Failed to update rental item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontFamily: fontFamily.bold }]}>
          Edit Rental Item
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Images Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: fontFamily.bold }]}>
            Item Images
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.imagesContainer}
          >
            {existingImages.map((uri, index) => (
              <View key={`existing-${index}`} style={styles.imageWrapper}>
                <Image source={{ uri }} style={styles.productImage} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => removeExistingImage(index)}
                >
                  <Icon name="times" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {images.map((image, index) => (
              <View key={`new-${index}`} style={styles.imageWrapper}>
                <Image source={{ uri: image.uri }} style={styles.productImage} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => removeNewImage(index)}
                >
                  <Icon name="times" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {existingImages.length + images.length < 4 && (
              <TouchableOpacity style={styles.addImageButton} onPress={pickImages}>
                <Icon name="plus" size={28} color={theme.accent} />
                <Text style={[styles.addImageText, { fontFamily: fontFamily.semiBold }]}>
                  Add Image
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* Item Name */}
        <View style={styles.section}>
          <Text style={[styles.label, { fontFamily: fontFamily.semiBold }]}>
            Item Name *
          </Text>
          <TextInput
            style={[styles.input, { fontFamily: fontFamily.regular }]}
            value={itemName}
            onChangeText={setItemName}
            placeholder="Enter item name"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={[styles.label, { fontFamily: fontFamily.semiBold }]}>
            Description
          </Text>
          <TextInput
            style={[styles.input, styles.textArea, { fontFamily: fontFamily.regular }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your rental item..."
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Price */}
        <View style={styles.section}>
          <Text style={[styles.label, { fontFamily: fontFamily.semiBold }]}>
            Rental Price (₱) *
          </Text>
          <TextInput
            style={[styles.input, { fontFamily: fontFamily.regular }]}
            value={price}
            onChangeText={setPrice}
            placeholder="0.00"
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Rental Duration */}
        <View style={styles.section}>
          <Text style={[styles.label, { fontFamily: fontFamily.semiBold }]}>
            Rental Duration *
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContainer}
          >
            {RENTAL_DURATIONS.map((duration) => (
              <TouchableOpacity
                key={duration}
                style={[
                  styles.chip,
                  rentalDuration === duration && styles.chipActive,
                ]}
                onPress={() => setRentalDuration(duration)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    rentalDuration === duration && styles.chipTextActive,
                    { fontFamily: rentalDuration === duration ? fontFamily.bold : fontFamily.medium },
                  ]}
                >
                  {duration}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Quantity */}
        <View style={styles.section}>
          <Text style={[styles.label, { fontFamily: fontFamily.semiBold }]}>
            Quantity *
          </Text>
          <TextInput
            style={[styles.input, { fontFamily: fontFamily.regular }]}
            value={quantity}
            onChangeText={setQuantity}
            placeholder="0"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
          />
        </View>

        {/* Category */}
        <View style={styles.section}>
          <Text style={[styles.label, { fontFamily: fontFamily.semiBold }]}>
            Category *
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContainer}
          >
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.chip,
                  category === cat && styles.chipActive,
                ]}
                onPress={() => setCategory(cat)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    category === cat && styles.chipTextActive,
                    { fontFamily: category === cat ? fontFamily.bold : fontFamily.medium },
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Condition */}
        <View style={styles.section}>
          <Text style={[styles.label, { fontFamily: fontFamily.semiBold }]}>
            Condition
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContainer}
          >
            {CONDITIONS.map((cond) => (
              <TouchableOpacity
                key={cond}
                style={[
                  styles.chip,
                  condition === cond && styles.chipActive,
                ]}
                onPress={() => setCondition(cond)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    condition === cond && styles.chipTextActive,
                    { fontFamily: condition === cond ? fontFamily.bold : fontFamily.medium },
                  ]}
                >
                  {cond}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Update Button */}
        <TouchableOpacity
          style={[styles.updateButton, loading && styles.updateButtonDisabled]}
          onPress={handleUpdate}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="check" size={18} color="#fff" />
              <Text style={[styles.updateButtonText, { fontFamily: fontFamily.bold }]}>
                Update Rental Item
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const darkTheme = {
  background: '#0f0f2e',
  cardBackground: '#1e1e3f',
  text: '#fff',
  textSecondary: '#bbb',
  accent: '#FDAD00',
  borderColor: '#2a2a4a',
};

const lightTheme = {
  background: '#f5f7fa',
  cardBackground: '#ffffff',
  text: '#1a1a2e',
  textSecondary: '#4a4a6a',
  accent: '#FDAD00',
  borderColor: '#e0e0ea',
};

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: Platform.OS === 'ios' ? 60 : 20,
      paddingBottom: 16,
      backgroundColor: theme.cardBackground,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderColor,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 20,
      color: theme.text,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      color: theme.text,
      marginBottom: 12,
    },
    label: {
      fontSize: 14,
      color: theme.text,
      marginBottom: 8,
    },
    input: {
      backgroundColor: theme.cardBackground,
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      color: theme.text,
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    imagesContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    imageWrapper: {
      position: 'relative',
    },
    productImage: {
      width: 120,
      height: 120,
      borderRadius: 12,
      backgroundColor: theme.cardBackground,
    },
    removeImageButton: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    addImageButton: {
      width: 120,
      height: 120,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.borderColor,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.cardBackground,
    },
    addImageText: {
      fontSize: 12,
      color: theme.accent,
      marginTop: 8,
    },
    chipsContainer: {
      flexDirection: 'row',
      gap: 10,
    },
    chip: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: theme.cardBackground,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    chipActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    chipText: {
      fontSize: 14,
      color: theme.text,
    },
    chipTextActive: {
      color: '#fff',
    },
    updateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
      paddingVertical: 16,
      borderRadius: 14,
      gap: 10,
      marginTop: 8,
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    updateButtonDisabled: {
      opacity: 0.6,
    },
    updateButtonText: {
      fontSize: 16,
      color: '#fff',
      letterSpacing: 0.3,
    },
  });