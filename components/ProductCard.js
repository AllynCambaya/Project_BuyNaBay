// components/ProductCard.js

import { Button, Text, View } from 'react-native';

export default function ProductCard({ product, canEdit, onEdit, onDelete }) {
  return (
    <View style={{ borderWidth: 1, borderRadius: 8, padding: 12, marginVertical: 8 }}>
      <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{product.name}</Text>
      <Text>{product.description}</Text>
      <Text style={{ color: 'gray', fontSize: 12 }}>Added by: {product.email}</Text>

      {canEdit && (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
          <Button title="Edit" onPress={onEdit} />
          <View style={{ width: 10 }} />
          <Button title="Delete" color="red" onPress={onDelete} />
        </View>
      )}
    </View>
  );
}