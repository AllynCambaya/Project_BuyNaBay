// screens/ProductDetailsScreen.js
import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

export default function ProductDetailsScreen({ route, navigation }) {
  const product = route?.params?.product;
  const user = auth.currentUser;
  const [adding, setAdding] = useState(false);
  const [sellerName, setSellerName] = useState('');

  // Parse image URLs from JSON if multiple images
  const imageUrls = product.product_image_url
    ? Array.isArray(product.product_image_url)
      ? product.product_image_url
      : (() => {
          try {
            return JSON.parse(product.product_image_url);
          } catch {
            return [product.product_image_url];
          }
        })()
    : [];

  // fetch seller name
  useEffect(() => {
    let mounted = true;
    const fetchName = async () => {
      if (!product?.email) return;
      const { data, error } = await supabase
        .from('users')
        .select('name')
        .eq('email', product.email)
        .single();
      if (!error && data?.name && mounted) setSellerName(data.name);
      if (error) console.log('Seller fetch error', error.message || error);
    };
    fetchName();
    return () => { mounted = false; };
  }, [product]);

  if (!product) {
    return (
      <View style={styles.centered}>
        <Text>No product specified.</Text>
      </View>
    );
  }

  const handleAddToCart = async () => {
    if (!user) {
      Alert.alert('Please login', 'You need to be logged in to add items to cart.');
      return;
    }
    if (user.email === product.email) {
      Alert.alert('Not Allowed', 'You cannot add your own product to the cart.');
      return;
    }

    setAdding(true);

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("name")
      .eq("email", user.email)
      .single();

    if (userError || !userData?.name) {
      setAdding(false);
      Alert.alert("Error", "Could not fetch your account name.");
      return;
    }

    const buyerName = userData.name;

    const { error } = await supabase.from("cart").insert([
      {
        name: buyerName,
        product_name: product.product_name,
        price: product.price,
        quantity: 1,
      },
    ]);

    setAdding(false);

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert("Added", "Product added to cart.");
      navigation.navigate("Tabs", { screen: "Cart" });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Display multiple images */}
      {imageUrls.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {imageUrls.map((uri, index) => (
            <Image
              key={index}
              source={{ uri }}
              style={styles.image}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={[styles.image, styles.noImage]}>
          <Text style={{ color: '#777' }}>No Image Available</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.title}>{product.product_name}</Text>
        <Text style={styles.price}>₱{product.price}</Text>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Category:</Text>
          <Text style={styles.value}>{product.category || 'N/A'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Condition:</Text>
          <Text style={styles.value}>{product.condition || 'N/A'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Quantity:</Text>
          <Text style={styles.value}>{product.quantity ?? 'N/A'}</Text>
        </View>

        <Text style={styles.sectionHeader}>Description</Text>
        <Text style={styles.desc}>{product.description}</Text>

        <View style={[styles.infoRow, { marginTop: 12 }]}>
          <Text style={styles.label}>Added by:</Text>
          <Text style={styles.value}>{sellerName || product.email}</Text>
        </View>
      </View>

      {user?.email !== product.email && (
        <TouchableOpacity
          style={[styles.button, adding && { backgroundColor: '#ccc' }]}
          onPress={handleAddToCart}
          disabled={adding}
        >
          <Text style={styles.buttonText}>{adding ? 'Adding...' : 'Add to Cart'}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, alignItems: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  image: { width: 280, height: 280, borderRadius: 12, marginRight: 10, backgroundColor: '#f0f0f0' },
  noImage: { justifyContent: 'center', alignItems: 'center' },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 6, color: '#222' },
  price: { fontSize: 20, fontWeight: '600', color: '#2e7d32', marginBottom: 12 },
  sectionHeader: { fontWeight: '700', fontSize: 16, marginTop: 12, marginBottom: 6, color: '#333' },
  desc: { fontSize: 15, lineHeight: 20, color: '#555' },
  infoRow: { flexDirection: 'row', marginBottom: 6 },
  label: { fontWeight: '600', marginRight: 6, color: '#444' },
  value: { color: '#555' },
  button: { backgroundColor: '#2e7d32', paddingVertical: 14, paddingHorizontal: 30, borderRadius: 10, elevation: 2, width: '90%', alignItems: 'center', marginBottom: 20 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
