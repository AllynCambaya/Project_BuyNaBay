// screens/HomeScreen.js
import { signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, FlatList, View } from 'react-native';
import ProductCard from '../../components/ProductCard';
import { auth } from '../../firebase/firebaseConfig';
import { supabase } from '../../supabase/supabaseClient';

export default function HomeScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const currentUser = auth.currentUser;

  const fetchProducts = async () => {
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
  };

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
  }, []);

  if (loading && !refreshing) {
    return <ActivityIndicator style={{ marginTop: 30 }} />;
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Button title="Add Product" onPress={() => navigation.navigate('AddProduct')} />
      <Button title="Logout" onPress={handleLogout} color="tomato" />

      <FlatList
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
          />
        )}
      />
    </View>
  );
}
