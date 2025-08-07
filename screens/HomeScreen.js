// screens/HomeScreen.js
import { signOut } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Button, FlatList, Text, View } from 'react-native';
import { auth, db } from '../firebase/firebaseConfig';

export default function HomeScreen({ navigation }) {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'products'), snapshot => {
      const productData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProducts(productData);
    });

    return unsubscribe;
  }, []);

  const handleLogout = () => {
    signOut(auth).then(() => {
      navigation.replace('Login');
    });
  };

  const renderItem = ({ item }) => (
    <View style={{ padding: 10, borderBottomWidth: 1 }}>
      <Text style={{ fontSize: 18 }}>{item.name}</Text>
      <Text style={{ color: 'gray' }}>Posted by: {item.sellerEmail}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 24, marginBottom: 10 }}>Product Listings</Text>
      <FlatList
        data={products}
        keyExtractor={item => item.id}
        renderItem={renderItem}
      />
      <View style={{ marginTop: 20 }}>
        <Button title="Add Product" onPress={() => navigation.navigate('AddProduct')} />
        <Button title="Logout" onPress={handleLogout} color="red" />
      </View>
    </View>
  );
}
