import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Order } from '../types';
import { useAuth } from './useAuth';
import { useCachedState, hasCache } from '../lib/dataCache';
import { actingHeaders } from '../lib/actingTenant';
import { useToast } from './useToast';

export function useOrders() {
  const { tenantId, memberId } = useAuth();
  const toast = useToast();
  const cacheKey = tenantId ? `orders:${tenantId}` : null;
  const [orders, setOrders] = useCachedState<Order[]>(cacheKey, []);
  const [loading, setLoading] = useState(() => !hasCache(cacheKey));

  const mapRow = (order: any): Order => ({
    id: order.id,
    displayId: order.display_id,
    contactId: order.contact_id,
    customerName: order.customer_name,
    customerAddress: order.customer_address,
    customerPhone: order.customer_phone,
    productName: order.product_name,
    quantity: order.quantity,
    deliveryFee: order.delivery_fee == null ? 3 : parseFloat(order.delivery_fee) || 0,
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

  const fetchOrders = useCallback(async () => {
    if (!tenantId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.from('orders').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      setOrders((data || []).map(mapRow));
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [tenantId, setOrders, toast]);

  const createOrder = useCallback(
    async (orderData: {
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
          shopify_sync_status: 'pending',
        };
        if (typeof orderData.deliveryFee === 'number') insertPayload.delivery_fee = orderData.deliveryFee;
        const { data, error } = await supabase.from('orders').insert(insertPayload).select().single();
        if (error) throw error;
        supabase.functions
          .invoke('shopify-api', { body: { action: 'register_order', params: { order_id: data.id } }, headers: actingHeaders() })
          .catch(() => {});
        const newOrder = mapRow(data);
        setOrders((prev) => [newOrder, ...prev]);
        toast.success('Order created successfully');
        return newOrder;
      } catch {
        toast.error('Failed to create order');
        return null;
      }
    },
    [tenantId, memberId, setOrders, toast],
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: Order['status']) => {
      try {
        const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
        if (error) throw error;
        setOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status, updatedAt: new Date() } : order)));
        toast.success('Order status updated');
      } catch {
        toast.error('Failed to update order');
      }
    },
    [setOrders, toast],
  );

  const deleteOrder = useCallback(
    async (orderId: string) => {
      try {
        const { error } = await supabase.from('orders').delete().eq('id', orderId);
        if (error) throw error;
        setOrders((prev) => prev.filter((order) => order.id !== orderId));
        toast.success('Order deleted');
      } catch {
        toast.error('Failed to delete order');
      }
    },
    [setOrders, toast],
  );

  useEffect(() => {
    fetchOrders();
    const channel = supabase
      .channel('orders-changes-mobile')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        if ((payload.new as any)?.tenant_id !== tenantId) return;
        const row = mapRow(payload.new);
        setOrders((prev) => (prev.some((o) => o.id === row.id) ? prev : [row, ...prev]));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        if ((payload.new as any)?.tenant_id !== tenantId) return;
        const row = mapRow(payload.new);
        setOrders((prev) => prev.map((o) => (o.id === row.id ? row : o)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, (payload) => {
        const id = (payload.old as any)?.id;
        if (id) setOrders((prev) => prev.filter((o) => o.id !== id));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders, tenantId, setOrders]);

  return { orders, loading, createOrder, updateOrderStatus, deleteOrder, fetchOrders };
}
