import type { Contact, Order } from '../types';
import { digitsOnly } from './utils';

const phoneMatches = (a?: string | null, b?: string | null) => {
  const da = digitsOnly(a || '');
  const db = digitsOnly(b || '');
  if (!da || !db) return false;
  return da === db || da.endsWith(db) || db.endsWith(da);
};

/** Contacts who messaged but never placed an order (website “No order yet”). */
export function contactsWithoutOrders(contacts: Contact[], orders: Order[]): Contact[] {
  return contacts
    .filter(
      (c) =>
        !orders.some(
          (o) =>
            (o.contactId && o.contactId === c.id) || phoneMatches(o.customerPhone, c.phoneNumber),
        ),
    )
    .sort((a, b) => {
      const ta = a.lastMessageTime ? a.lastMessageTime.getTime() : 0;
      const tb = b.lastMessageTime ? b.lastMessageTime.getTime() : 0;
      return tb - ta;
    });
}
