import { Order } from '@/types/order';
import { formatDistanceToNow } from 'date-fns';
import { Package, Clock, CheckCircle, XCircle, Loader2, Trash2, MapPin, Phone, User, CreditCard, Truck, ExternalLink, Printer } from 'lucide-react';
import { printInvoice } from '@/lib/printInvoice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface OrdersListProps {
  orders: Order[];
  onUpdateStatus: (orderId: string, status: Order['status']) => void;
  onDeleteOrder: (orderId: string) => void;
}

const statusConfig = {
  pending: { label: 'Pending', icon: Clock, color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  processing: { label: 'Processing', icon: Loader2, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'bg-red-500/10 text-red-600 border-red-500/20' },
};

export function OrdersList({ orders, onUpdateStatus, onDeleteOrder }: OrdersListProps) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
        <Package className="h-16 w-16 mb-4 opacity-50" />
        <p className="text-lg font-medium">No orders yet</p>
        <p className="text-sm">Orders will appear here when customers place them</p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-2">
      {orders.map((order) => {
        const StatusIcon = statusConfig[order.status].icon;
        return (
          <div
            key={order.id}
            className="rounded-lg border bg-card p-3 shadow-sm transition-colors hover:bg-accent/30"
          >
            {/* Top row: ID + Status + Delete */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  #{order.displayId}
                </span>
                <Badge variant="outline" className={`${statusConfig[order.status].color} text-[11px] px-1.5 py-0`}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig[order.status].label}
                </Badge>
                {order.shopifyOrderId && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 border-primary/30 bg-primary/5 text-primary">
                    <Package className="h-3 w-3" />
                    Synced from Shopify
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Print invoice"
                  onClick={() => printInvoice({
                    id: order.displayId ? String(order.displayId) : order.id,
                    created_at: order.createdAt.toISOString(),
                    customer_name: order.customerName,
                    customer_phone: order.customerPhone,
                    delivery_address: order.customerAddress,
                    delivery_fee: order.deliveryFee,
                    currency: 'USD',
                    total: (order.totalPrice ?? 0) + (order.deliveryFee ?? 0),
                    items: [{ id: order.id, name: (order.productName ?? '').replace(/^\s*\d+\s*[×x]\s*/i, ''), qty: order.quantity, unit_price: order.totalPrice ?? 0 }],
                  })}
                >
                  <Printer className="h-3.5 w-3.5" />
                </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Order</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this order? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDeleteOrder(order.id)}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              </div>
            </div>

            {/* Product info - prominent */}
            <div className="mb-2 rounded-md bg-muted/50 px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-semibold text-foreground">{order.productName}</span>
                  <span className="text-xs text-muted-foreground ml-1">× {order.quantity}</span>
                </div>
                <div className="flex flex-col items-end text-right">
                  {order.totalPrice != null && (
                    <span className="text-sm font-bold text-foreground">${order.totalPrice.toFixed(2)}</span>
                  )}
                  {order.deliveryFee > 0 && (
                    <span className="text-[11px] text-muted-foreground">+${order.deliveryFee.toFixed(2)} delivery</span>
                  )}
                </div>
              </div>
            </div>

            {/* Customer details - compact grid with icons */}
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <User className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                <span className="truncate">{order.customerName}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                <span className="truncate">{order.customerPhone}</span>
              </div>
              <div className="flex items-start gap-1.5">
                <MapPin className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground/70" />
                <span className="line-clamp-2">{order.customerAddress}</span>
              </div>
            </div>

            {/* Live Shopify status */}
            {(order.financialStatus || order.fulfillmentStatus || order.trackingNumber) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {order.financialStatus && (
                  <Badge variant="outline" className="text-[11px] px-1.5 py-0 gap-1">
                    <CreditCard className="h-3 w-3" />
                    {order.financialStatus}
                  </Badge>
                )}
                {order.fulfillmentStatus && (
                  <Badge variant="outline" className="text-[11px] px-1.5 py-0 gap-1">
                    <Truck className="h-3 w-3" />
                    {order.fulfillmentStatus}
                  </Badge>
                )}
                {order.trackingNumber && (
                  order.trackingUrl ? (
                    <a
                      href={order.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {order.trackingCompany ? `${order.trackingCompany}: ` : ''}{order.trackingNumber}
                    </a>
                  ) : (
                    <Badge variant="outline" className="text-[11px] px-1.5 py-0">
                      {order.trackingCompany ? `${order.trackingCompany}: ` : ''}{order.trackingNumber}
                    </Badge>
                  )
                )}
              </div>
            )}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
              <span className="text-[11px] text-muted-foreground">
                {formatDistanceToNow(order.createdAt, { addSuffix: true })}
              </span>
              {order.shopifyOrderId ? (
                <span className="text-[11px] text-muted-foreground italic">
                  Status managed by Shopify
                </span>
              ) : (
                <Select
                  value={order.status}
                  onValueChange={(value) => onUpdateStatus(order.id, value as Order['status'])}
                >
                  <SelectTrigger className="h-7 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
