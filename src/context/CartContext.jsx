import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'play-store-cart-v1';
const CartContext = createContext(null);

function readStoredCart() {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function makeItemKey(productId, selections) {
  const optionKey = Object.entries(selections || {}).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => `${name}:${value}`).join('|');
  return `${productId}|${optionKey}`;
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(readStoredCart);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (product, selections = {}, quantity = 1, selectedImage, variant = null) => {
    const key = makeItemKey(product.id, selections);
    const maxStock = product.inventoryManaged ? Math.max(0, Number(variant?.stock ?? product.stock ?? 0)) : null;
    if (maxStock === 0) return;
    setItems((current) => {
      const existing = current.find((item) => item.key === key);
      if (existing) return current.map((item) => item.key === key ? { ...item, quantity: maxStock == null ? item.quantity + quantity : Math.min(maxStock, item.quantity + quantity) } : item);
      const optionDelta = (product.options || []).reduce((sum, option) => {
        const selected = option.values.find((value) => value.label === selections[option.name]);
        return sum + Number(selected?.priceDelta || 0);
      }, 0);
      return [...current, {
        key,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        image: selectedImage || product.image,
        price: product.price + optionDelta,
        selections,
        quantity: maxStock == null ? quantity : Math.min(maxStock, quantity),
        variantId: variant?.id || '',
        maxStock,
      }];
    });
  };

  const updateQuantity = (key, quantity) => setItems((current) => quantity < 1 ? current.filter((item) => item.key !== key) : current.map((item) => item.key === key ? { ...item, quantity: item.maxStock == null ? quantity : Math.min(item.maxStock, quantity) } : item));
  const removeItem = (key) => setItems((current) => current.filter((item) => item.key !== key));
  const clearCart = () => setItems([]);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const value = useMemo(() => ({ items, addItem, updateQuantity, removeItem, clearCart, itemCount, subtotal }), [items, itemCount, subtotal]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside CartProvider');
  return value;
}
