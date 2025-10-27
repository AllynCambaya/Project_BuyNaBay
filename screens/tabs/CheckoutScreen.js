import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

export default function CheckoutScreen({ navigation }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = auth.currentUser;

  useEffect(() => {
    fetchCheckoutHistory();
  }, []);

  const fetchCheckoutHistory = async () => {
    if (!user?.email) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('checkout_history')
        .select('*')
        .eq('buyer_email', user.email)
        .order('checkout_date', { ascending: false });

      if (error) throw error;

      // Enrich with product images
      const enrichedData = await Promise.all(
        data.map(async (item) => {
          const { data: productData } = await supabase
            .from('products')
            .select('product_image_url')
            .eq('product_name', item.product_name)
            .maybeSingle();

          if (productData) {
            let images;
            try {
              images = JSON.parse(productData.product_image_url);
              if (!Array.isArray(images)) images = [productData.product_image_url];
            } catch {
              images = [productData.product_image_url];
            }
            return { ...item, product_image_urls: images };
          }
          return item;
        })
      );

      setHistory(enrichedData);
    } catch (err) {
      console.error('Error fetching checkout history:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => {
    const thumbnail = item.product_image_urls?.[0];
    const date = new Date(item.checkout_date).toLocaleDateString();
    const time = new Date(item.checkout_date).toLocaleTimeString();

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.date}>📅 {date} at {time}</Text>
        </View>

        <View style={styles.cardContent}>
          {thumbnail && (
            <Image source={{ uri: thumbnail }} style={styles.thumbnail} />
          )}
          <View style={styles.details}>
            <Text style={styles.productName}>{item.product_name}</Text>
            <Text style={styles.price}>₱{item.price}</Text>
            <Text style={styles.quantity}>Quantity: {item.quantity}</Text>
            <Text style={styles.seller}>Seller: {item.seller_name || 'Unknown'}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout History</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <Text>Loading...</Text>
        </View>
      ) : history.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="receipt-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No checkout history yet</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  date: {
    color: '#666',
    fontSize: 14,
  },
  cardContent: {
    padding: 12,
    flexDirection: 'row',
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  details: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  price: {
    fontSize: 15,
    color: '#2e7d32',
    fontWeight: '600',
    marginBottom: 4,
  },
  quantity: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  seller: {
    fontSize: 14,
    color: '#666',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    color: '#666',
    fontSize: 16,
  },
});