export type OrderStatus = 
  | 'Delivered'
  | 'Complete'
  | 'Processing'
  | 'Procecing'
  | 'Pending'
  | 'Hold'
  | 'Cancelled'
  | 'Cancel'
  | 'In Review'
  | 'in_review'
  | 'Partial Delivered'
  | 'partial_delivered'
  | 'Partial'
  | 'Select Action'
  | (string & {});

export type CourierStatus = 
  | 'delivered'
  | 'pending'
  | 'partial_delivered'
  | 'cancelled'
  | 'in_review'
  | 'processing';

export interface Order {
  id: string; // Invoice ID / Order # (e.g. INV-1001, #1025)
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  product: string; // Column E: e.g. "Golden Watch Combo"
  variant?: string; // Column H: e.g. "No Sellect", "Rose 599tk", "Doll and toys"
  source: string; // Column I: e.g. "Website", "Whatsapp", "Call Direct"
  amount: number; // Column D: Total COD amount in BDT
  total: number; // Alias for amount
  quantity: number;
  status: OrderStatus;
  trackingCode?: string; // e.g. 290917655
  courierStatus?: CourierStatus | string;
  steadfastStatus?: string; // 'send to steadfast' or 'Sent (ID: 8821)'
  date: string;
  rawDate?: string; // Exact Column A text from Google Sheet (e.g. "9/9/2026 19:50:48")
  notes?: string;
  image?: string; // Optional custom or sheet-specified product image URL
  rowIndex?: number; // 1-based row in Google Sheet
  totalSpend?: number;
  items?: OrderItem[];
  returnApproved?: boolean;
  returnRestocked?: boolean;
  returnApprovedDate?: string;
}

export interface Sheet3ProductEntry {
  id: string;
  rowIndex: number;
  date: string;
  productName: string;
  source: string;
  stockIn: number | '';
  stockOut: number | '';
  currentStock: number;
  currentPrice: number | '';
}

export interface StockMovementLog {
  id: string;
  productId: string;
  productName: string;
  change: number; // e.g. +1, -1, +10
  newStock: number;
  reason: 'return_approved' | 'order_placed' | 'manual_update' | 'restock' | 'damage';
  orderId?: string;
  date: string;
  timestamp: number;
}

export interface CustomerSummary {
  name: string;
  phone: string;
  address: string;
  totalOrders: number;
  avgOrderValue: number;
  lastOrder: string;
  status: 'Active' | 'Inactive';
}

export interface DailyTrendItem {
  day: string; // 'শনি', 'রবি', 'সোম', etc.
  orders: number;
  delivered: number;
}

export interface SalesSourceItem {
  source: string;
  percentage: number;
  count: number;
  color: string;
}

export interface Product {
  id: string; // SKU or row id
  name: string;
  category: string;
  regularPrice: number;
  salePrice?: number;
  stock: number;
  status: 'publish' | 'draft' | 'out_of_stock';
  description: string;
  image: string;
  featured?: boolean;
  rowIndex: number; // 1-based index in the sheet for pinpoint updates
}

export interface OrderItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface ProductReportSource {
  source: string; // e.g. "Website (50.0%)", "Messenger (12.5%)"
  sourceName: string; // e.g. "Website", "Messenger"
  sharePercent: string; // e.g. "50.0%"
  lead: number;
  confirm: number;
  confirmRate: string;
  delivery: number;
  deliveryRate: string;
  pending: number;
  pendingRate: string;
  partial: number;
  partialRate: string;
  quantity: number;
  cancel: number;
  cancelRate: string;
}

export interface Sheet1ProductReport {
  id: string;
  productName: string; // e.g. "Rose 599tk", "Watch 599tk", "Doll and toys"
  rawHeader: string;
  overall: {
    lead: number;
    confirm: number;
    confirmRate: string;
    delivery: number;
    deliveryRate: string;
    pending: number;
    pendingRate: string;
    partial: number;
    partialRate: string;
    quantity: number;
    cancel: number;
    cancelRate: string;
  };
  sources: ProductReportSource[];
}

export interface SheetMeta {
  spreadsheetId: string;
  title: string;
  productsSheetTitle: string;
  ordersSheetTitle: string;
}
