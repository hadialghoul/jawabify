import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Order } from '@/types/order';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useCachedState, hasCache } from '@/lib/dataCache';
import { actingHeaders } from '@/lib/actingTenant';

export function useOrders() {
  const { tenantId, memberId } = useAuth();
  const cacheKey = tenantId ? `orders:${tenantId}` : null;
  const [orders, setOrders] = useCachedState<Order[]>(cacheKey, []);
  const [loading, setLoading] = useState(() => !hasCache(cacheKey));

  const fetchOrders = useCallback(async () => {
    if (!tenantId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(500);



      if (error) throw error;

      const mappedOrders: Order[] = (data || []).map((order: any) => ({
        id: order.id,
        displayId: order.display_id,
        contactId: order.contact_id,
        customerName: order.customer_name,
        customerAddress: order.customer_address,
        customerPhone: order.customer_phone,
        productName: order.product_name,
        quantity: order.quantity,
        deliveryFee: order.delivery_fee == null ? 3 : (parseFloat(order.delivery_fee) || 0),
        totalPrice: order.total_price == null ? null : parseFloat(order.total_price),
        status: order.status as Order['status'],
        createdAt: new Date(order.created_at),
        updatedAt: new Date(order.updated_at),
        shopifyOrderId: order.shopify_order_id ?? null,
        financialStatus: order.financial_status ?? null,
        fulfillmentStatus: order.fulfillment_status ?? null,
        trackingNumber: order.tracking_number ?? null,
        trackingUrl: order.tracking_url ?? null,
        trackingCompany: order.tracking_company ?? null,
        shopifySyncedAt: order.shopify_synced_at ? new Date(order.shopify_synced_at) : null,
      }));

      setOrders(mappedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [tenantId, cacheKey, setOrders]);


  const createOrder = useCallback(async (orderData: {
    contactId?: string;
    customerName: string;
    customerAddress: string;
    customerPhone: string;
    productName: string;
    quantity: number;
    deliveryFee?: number;
  }) => {
    try {
      const insertPayload: any = {
        contact_id: orderData.contactId || null,
        customer_name: orderData.customerName,
        customer_address: orderData.customerAddress,
        customer_phone: orderData.customerPhone,
        product_name: orderData.productName,
        quantity: orderData.quantity,
        status: 'pending',
        tenant_id: tenantId,
        created_by_member_id: memberId,
      };
      if (typeof orderData.deliveryFee === 'number') {
        insertPayload.delivery_fee = orderData.deliveryFee;
      }
      // Queue the order for Shopify registration. 'pending' makes the retry
      // worker pick it up if the immediate push below fails or never runs.
      insertPayload.shopify_sync_status = 'pending';
      const { data, error } = await supabase
        .from('orders')
        .insert(insertPayload)
        .select()
        .single();


      if (error) throw error;

      // Push to the connected Shopify store right away (no-op when the tenant
      // has no Shopify connection — the row simply stays queued).
      supabase.functions
        .invoke('shopify-api', {
          body: { action: 'register_order', params: { order_id: data.id } },
          headers: actingHeaders(),
        })
        .then(({ data: res, error: fnErr }) => {
          if (fnErr) return;
          if (res?.synced) toast.success('Order sent to Shopify');
          else if (res?.kind === 'unmatched') {
            toast.warning('Order saved, but no matching Shopify product was found');
          }
        })
        .catch(() => {});

      const newOrder: Order = {
        id: data.id,
        displayId: (data as any).display_id,
        contactId: data.contact_id,
        customerName: data.customer_name,
        customerAddress: data.customer_address,
        customerPhone: data.customer_phone,
        productName: data.product_name,
        quantity: data.quantity,
        deliveryFee: (data as any).delivery_fee == null ? 3 : (parseFloat((data as any).delivery_fee) || 0),
        status: data.status as Order['status'],
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };

      setOrders((prev) => [newOrder, ...prev]);
      toast.success('Order created successfully');
      return newOrder;
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Failed to create order');
      return null;
    }
  }, []);

  const updateOrderStatus = useCallback(async (orderId: string, status: Order['status']) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, status, updatedAt: new Date() } : order
        )
      );
      toast.success('Order status updated');
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order');
    }
  }, []);

  const deleteOrder = useCallback(async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (error) throw error;

      setOrders((prev) => prev.filter((order) => order.id !== orderId));
      toast.success('Order deleted');
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('Failed to delete order');
    }
  }, []);

  const mapRow = (order: any): Order => ({
    id: order.id,
    displayId: order.display_id,
    contactId: order.contact_id,
    customerName: order.customer_name,
    customerAddress: order.customer_address,
    customerPhone: order.customer_phone,
    productName: order.product_name,
    quantity: order.quantity,
    deliveryFee: order.delivery_fee == null ? 3 : (parseFloat(order.delivery_fee) || 0),
    totalPrice: order.total_price == null ? null : parseFloat(order.total_price),
    status: order.status as Order['status'],
    createdAt: new Date(order.created_at),
    updatedAt: new Date(order.updated_at),
    shopifyOrderId: order.shopify_order_id ?? null,
    financialStatus: order.financial_status ?? null,
    fulfillmentStatus: order.fulfillment_status ?? null,
    trackingNumber: order.tracking_number ?? null,
    trackingUrl: order.tracking_url ?? null,
    trackingCompany: order.tracking_company ?? null,
    shopifySyncedAt: order.shopify_synced_at ? new Date(order.shopify_synced_at) : null,
  });

  useEffect(() => {
    fetchOrders();

    // Subscribe to realtime changes — patch local state instead of refetching
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          if ((payload.new as any)?.tenant_id !== tenantId) return;
          const row = mapRow(payload.new);
          setOrders((prev) => (prev.some((o) => o.id === row.id) ? prev : [row, ...prev]));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          if ((payload.new as any)?.tenant_id !== tenantId) return;
          const row = mapRow(payload.new);
          setOrders((prev) => prev.map((o) => (o.id === row.id ? row : o)));
        }
      )

      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'orders' },
        (payload) => {
          const id = (payload.old as any)?.id;
          if (id) setOrders((prev) => prev.filter((o) => o.id !== id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  return {
    orders,
    loading,
    createOrder,
    updateOrderStatus,
    deleteOrder,
    fetchOrders,
  };
}
