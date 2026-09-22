export interface Order {
  id: string;
  displayId: number;
  contactId: string | null;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  productName: string;
  quantity: number;
  deliveryFee: number;
  totalPrice?: number | null;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  shopifyOrderId?: string | null;
  financialStatus?: string | null;
  fulfillmentStatus?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  trackingCompany?: string | null;
  shopifySyncedAt?: Date | null;
}
