import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

export default function RentalDetailsScreen({ route, navigation }) {
  const { rentalItem } = route.params;
  const [loading, setLoading] = useState(false);
  const currentUser = auth.currentUser;

  const handleRentItem = async () => {
    if (rentalItem.owner_email === currentUser?.email) {
      return; // Don't allow renting own item
    }
    
    setLoading(true);
    try {
      // Create a notification for the seller
      const { error: notificationError } = await supabase.from('notifications').insert({
        sender_id: currentUser?.email,
        receiver_id: rentalItem.owner_email,
        title: 'New Rental Request',
        message: `${currentUser?.email} wants to rent your ${rentalItem.item_name}!`,
        created_at: new Date().toISOString()
      });

      if (notificationError) throw notificationError;

      // Navigate to messaging screen after sending notification
      navigation.navigate('Messaging', { 
        receiverId: rentalItem.owner_email,
        receiverName: rentalItem.seller_name
      });
    } catch (err) {
      console.error('Error processing rental request:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Image */}
      {rentalItem.rental_item_image ? (
        <Image source={{ uri: rentalItem.rental_item_image }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Ionicons name="image-outline" size={60} color="#999" />
        </View>
      )}

      {/* Details */}
      <View style={styles.content}>
        <Text style={styles.title}>{rentalItem.item_name}</Text>
        <Text style={styles.seller}>Posted by: {rentalItem.seller_name}</Text>
        
        <View style={styles.priceContainer}>
          <Text style={styles.price}>₱{rentalItem.price}</Text>
          <Text style={styles.duration}> • {rentalItem.rental_duration}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Category:</Text>
          <Text style={styles.value}>{rentalItem.category}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Condition:</Text>
          <Text style={styles.value}>{rentalItem.condition}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Available Quantity:</Text>
          <Text style={styles.value}>{rentalItem.quantity}</Text>
        </View>

        <Text style={styles.descriptionLabel}>Description</Text>
        <Text style={styles.description}>{rentalItem.description}</Text>

        {/* Rent Item Button */}
        {currentUser?.email !== rentalItem.owner_email && (
          <TouchableOpacity 
            style={styles.rentButton}
            onPress={handleRentItem}
            disabled={loading}
          >
            <Ionicons name="cart-outline" size={20} color="#fff" />
            <Text style={styles.rentButtonText}>Rent Item</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  image: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
  },
  placeholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  duration: {
    fontSize: 18,
    color: '#666',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  label: {
    width: 120,
    fontSize: 16,
    color: '#666',
  },
  value: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  descriptionLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#444',
    lineHeight: 24,
  },
  seller: {
    fontSize: 15,
    color: '#1976d2',
    marginBottom: 12,
  },
  rentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2e7d32',
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
  },
  rentButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});