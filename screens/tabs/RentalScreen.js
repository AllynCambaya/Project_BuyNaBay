import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../supabase/supabaseClient';

export default function RentalScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) fetchRentals();
  }, [isFocused]);

  const fetchRentals = async () => {
    try {
      setLoading(true);
      // First get rental items
      const { data: rentalData, error: rentalError } = await supabase
        .from('rental_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (rentalError) throw rentalError;

      // Then fetch seller names for each rental item
      const itemsWithNames = await Promise.all(rentalData.map(async (item) => {
        const { data: userData } = await supabase
          .from('users')
          .select('name')
          .eq('email', item.owner_email)
          .single();
        
        return {
          ...item,
          seller_name: userData?.name || 'Unknown User'
        };
      }));
      
      setItems(itemsWithNames || []);
    } catch (err) {
      console.error('Error fetching rentals', err.message || err);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => navigation.navigate('RentalDetails', { rentalItem: item })}
    >
      {item.rental_item_image ? (
        <Image source={{ uri: item.rental_item_image }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.placeholder]}>
          <Ionicons name="image-outline" size={36} color="#999" />
        </View>
      )}

      <View style={styles.info}>
        <Text style={styles.title}>{item.item_name}</Text>
        <Text style={styles.seller}>Posted by: {item.seller_name}</Text>
        <Text style={styles.meta}>₱{item.price} • {item.rental_duration}</Text>
        <Text style={styles.meta}>{item.category} • {item.condition}</Text>
        <Text numberOfLines={2} style={styles.desc}>{item.description}</Text>
        <Text style={styles.stock}>Qty: {item.quantity || 0}</Text>
        
        <TouchableOpacity
          style={styles.messageButton}
          onPress={(e) => {
            e.stopPropagation();
            navigation.navigate('Messaging', { 
              receiverId: item.owner_email,
              receiverName: item.seller_name
            });
          }}
        >
          <Ionicons name="chatbubble-outline" size={16} color="#fff" />
          <Text style={styles.messageText}>Message Seller</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rentals</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('RentItemScreen')}>
          <Ionicons name="add-circle" size={26} color="#1976d2" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.empty}><Text>Loading...</Text></View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="layers-outline" size={48} color="#ccc" />
          <Text style={{ marginTop: 8 }}>No rental items yet</Text>
        </View>
      ) : (
        <FlatList data={items} keyExtractor={(i) => i.id?.toString() || Math.random().toString()} renderItem={renderItem} contentContainerStyle={{ padding: 12 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  addBtn: { padding: 4 },
  card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, elevation: 2 },
  thumbnail: { width: 100, height: 100, borderRadius: 8, marginRight: 12, backgroundColor: '#fafafa' },
  placeholder: { justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  seller: { fontSize: 13, color: '#1976d2', marginBottom: 4 },
  meta: { fontSize: 13, color: '#666' },
  desc: { marginTop: 6, color: '#444' },
  stock: { marginTop: 8, color: '#333', fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976d2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  messageText: {
    color: '#fff',
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
  },
});
