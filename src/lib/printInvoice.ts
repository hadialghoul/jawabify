import { Share, Platform } from 'react-native';
import type { Order } from '../types';

/** Build a printable / shareable invoice body for a Jawabify order. */
export function buildOrderInvoiceText(order: Order, businessName = 'Jawabify'): string {
  const ref = order.displayId ? String(order.displayId) : order.id.slice(0, 8).toUpperCase();
  const when = order.createdAt.toLocaleString();
  const lines = [
    businessName,
    `Order #${ref}`,
    when,
    '',
    order.customerName || 'Walk-in',
    order.customerPhone || '',
    order.customerAddress ? `Address: ${order.customerAddress}` : '',
    '',
    `${order.productName} × ${order.quantity}`,
    order.deliveryFee > 0 ? `Delivery: ${order.deliveryFee.toFixed(2)}` : '',
    order.totalPrice != null ? `Total: ${Number(order.totalPrice).toFixed(2)}` : '',
    `Status: ${order.status}`,
    '',
    'Thank you!',
  ].filter((l) => l !== undefined);

  return lines.join('\n');
}

/** Share / print an order invoice (uses the system share sheet — works on Expo Go). */
export async function printOrderInvoice(order: Order, businessName = 'Jawabify'): Promise<void> {
  const message = buildOrderInvoiceText(order, businessName);
  await Share.share({
    title: `Order #${order.displayId}`,
    message,
    ...(Platform.OS === 'ios' ? { url: undefined } : {}),
  });
}
