import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
import ProductCard from '../../components/ProductCard';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

export default function HomeScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const currentUser = auth.currentUser;

  const fetchProducts = useCallback(async () => {
    if (!refreshing) setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('id', { ascending: false });
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setProducts(data);
    }
    setLoading(false);
    setRefreshing(false);
  }, [refreshing]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.replace('Login');
    } catch (error) {
      Alert.alert('Logout Failed', error.message);
    }
  };

  const handleDelete = async (id) => {
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('products').delete().eq('id', id);
          if (error) Alert.alert('Error', error.message);
          else fetchProducts();
        },
      },
    ]);
  };

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  if (loading && !refreshing) {
    return <ActivityIndicator style={{ marginTop: 30 }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f9f9f9' }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: '#fff',
          elevation: 3, // for Android shadow
          shadowColor: '#000', // for iOS shadow
          shadowOpacity: 0.1,
          shadowRadius: 5,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#2e7d32' }}>
          BuyNaBay 🛍️
        </Text>

        <TouchableOpacity
          onPress={handleLogout}
          style={{
            padding: 6,
            borderRadius: 20,
            backgroundColor: '#957272ff',
            elevation: 2,
            shadowColor: '#000000ff',
            shadowOpacity: 0.1,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <Ionicons name="log-out-outline" size={28} color="tomato" />
        </TouchableOpacity>
      </View>

      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={products}
        keyExtractor={(item) => item.id.toString()}
        onRefresh={() => {
          setRefreshing(true);
          fetchProducts();
        }}
        refreshing={refreshing}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            canEdit={item.email === currentUser?.email}
            onEdit={() => navigation.navigate('EditProduct', { product: item })}
            onDelete={() => handleDelete(item.id)}
            onMessageSeller={() => {
              if (item.email !== currentUser?.email) {
                navigation.navigate('Messaging', { receiverId: item.email });
              }
            }}
            onPress={() => navigation.navigate('ProductDetails', { product: item })}
          />
        )}
      />
    </View>
  );
}
