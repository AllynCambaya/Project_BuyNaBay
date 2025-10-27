import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../supabase/supabaseClient';

const nameCache = {};

export default function ProductCard({ product, canEdit, onEdit, onDelete, onMessageSeller, onPress }) {
  const [sellerName, setSellerName] = useState('');

  useEffect(() => {
    let mounted = true;

    const fetchSellerName = async () => {
      if (!product?.email) return;
      if (nameCache[product.email]) {
        setSellerName(nameCache[product.email]);
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('name')
        .eq('email', product.email)
        .single();

      if (error) {
        console.log('Failed fetching seller name:', error.message || error);
        if (mounted) setSellerName(product.email);
        return;
      }

      const name = data?.name || product.email;
      nameCache[product.email] = name;
      if (mounted) setSellerName(name);
    };

    fetchSellerName();
    return () => { mounted = false; };
  }, [product]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <View style={{
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginVertical: 8,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 3
      }}>
        {/* Product Info */}
        <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 4 }}>{product.product_name}</Text>
        <Text style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: 16 }}>₱{product.price}</Text>
        <Text style={{ marginVertical: 6, color: '#444' }}>{product.description}</Text>
        <Text style={{ color: 'gray', fontSize: 12 }}>Added by: {sellerName || product.email}</Text>

        {/* Buttons */}
        {canEdit ? (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
            <TouchableOpacity
              style={{ backgroundColor: '#1976d2', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 6, marginRight: 8 }}
              onPress={onEdit}
            >
              <Text style={{ color: 'white', fontWeight: '600' }}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ backgroundColor: 'tomato', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 6 }}
              onPress={onDelete}
            >
              <Text style={{ color: 'white', fontWeight: '600' }}>Delete</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={{ backgroundColor: '#2e7d32', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, marginTop: 12, alignSelf: 'flex-start' }}
            onPress={onMessageSeller}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>Message Seller</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}
