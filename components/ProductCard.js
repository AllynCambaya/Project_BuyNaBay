// components/ProductCard.js

import { useEffect, useState } from 'react';
import { Button, Text, View } from 'react-native';
import { supabase } from '../supabase/supabaseClient';

// Simple in-memory cache to avoid repeated network requests for the same email
const nameCache = {};

export default function ProductCard({ product, canEdit, onEdit, onDelete, onMessageSeller }) {
  const [sellerName, setSellerName] = useState('');

  useEffect(() => {
    let mounted = true;

    const fetchSellerName = async () => {
      if (!product?.email) return;

      // Use cached value when available
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

    return () => {
      mounted = false;
    };
  }, [product]);

  return (
    <View style={{ borderWidth: 1, borderRadius: 8, padding: 12, marginVertical: 8 }}>
      <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{product.name}</Text>
      <Text>{product.description}</Text>
      <Text style={{ color: 'gray', fontSize: 12 }}>Added by: {sellerName || product.email}</Text>

      {canEdit ? (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
          <Button title="Edit" onPress={onEdit} />
          <View style={{ width: 10 }} />
          <Button title="Delete" color="red" onPress={onDelete} />
        </View>
      ) : (
        <Button title="Message Seller" onPress={onMessageSeller} />
      )}
    </View>
  );
}