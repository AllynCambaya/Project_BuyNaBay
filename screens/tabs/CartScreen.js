// screens/CartScreen.js
import { useEffect, useState } from "react";
import { Alert, FlatList, Text, TouchableOpacity, View } from "react-native";
import { supabase } from "../supabase/supabase"; // adjust path to your config

export default function CartScreen({ route }) {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Assume user email is passed from auth context or route params
  const userEmail = route?.params?.email; 

  // Fetch cart items for logged in user
  const fetchCart = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cart")
      .select("*")
      .eq("user_email", userEmail);

    if (error) {
      console.error(error);
    } else {
      setCartItems(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCart();
  }, []);

  // Remove item from cart
  const removeFromCart = async (id) => {
    const { error } = await supabase.from("cart").delete().eq("id", id);
    if (!error) {
      setCartItems(cartItems.filter((item) => item.id !== id));
    }
  };

  // Checkout
  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      Alert.alert("Cart Empty", "Please add items to your cart first.");
      return;
    }

    // Simulate order success + clear cart
    const { error } = await supabase
      .from("cart")
      .delete()
      .eq("user_email", userEmail);

    if (!error) {
      setCartItems([]);
      Alert.alert("Order Successful 🎉", "Thank you for shopping at BuyNaBay!");
    }
  };

  const renderItem = ({ item }) => (
    <View className="bg-white p-4 m-2 rounded-2xl shadow">
      <Text className="text-lg font-semibold">{item.item_name}</Text>
      <Text className="text-gray-500">₱{item.price}</Text>

      <TouchableOpacity
        className="bg-red-500 p-2 rounded-xl mt-2"
        onPress={() => removeFromCart(item.id)}
      >
        <Text className="text-white text-center">Remove</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View className="flex-1 bg-gray-100 p-3">
      <Text className="text-2xl font-bold mb-4 text-green-600">🛒 My Cart</Text>

      {loading ? (
        <Text>Loading...</Text>
      ) : cartItems.length === 0 ? (
        <Text className="text-center text-gray-500">Your cart is empty</Text>
      ) : (
        <FlatList
          data={cartItems}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
        />
      )}

      {cartItems.length > 0 && (
        <TouchableOpacity
          className="bg-green-600 p-4 rounded-2xl mt-4"
          onPress={handleCheckout}
        >
          <Text className="text-white text-center text-lg font-semibold">
            Checkout
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
