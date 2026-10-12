import type { Contact, Order } from '../types';
import { digitsOnly } from './utils';

function addPhoneKeys(keys: Set<string>, raw?: string | null) {
  const digits = digitsOnly(raw || '');
  if (!digits) return;
  keys.add(digits);
  const shortest = Math.min(9, digits.length);
  for (let len = 7; len <= shortest; len++) keys.add(digits.slice(-len));
}

function phoneOrdered(keys: Set<string>, raw?: string | null) {
  const digits = digitsOnly(raw || '');
  if (!digits) return false;
  if (keys.has(digits)) return true;
  if (digits.length >= 7 && keys.has(digits.slice(-Math.min(9, digits.length)))) return true;
  return false;
}

/** Contacts who messaged but never placed an order (website “No order yet”). */
export function contactsWithoutOrders(contacts: Contact[], orders: Order[]): Contact[] {
  const orderedIds = new Set<string>();
  const orderedPhones = new Set<string>();
  for (const order of orders) {
    if (order.contactId) orderedIds.add(order.contactId);
    addPhoneKeys(orderedPhones, order.customerPhone);
  }
  return contacts
    .filter((c) => !orderedIds.has(c.id) && !phoneOrdered(orderedPhones, c.phoneNumber))
    .sort((a, b) => {
      const ta = a.lastMessageTime ? a.lastMessageTime.getTime() : 0;
      const tb = b.lastMessageTime ? b.lastMessageTime.getTime() : 0;
      return tb - ta;
    });
}
