import React from 'react';
import {
  Package,
  RefreshCw,
  Boxes,
} from 'lucide-react';
import { Order, OrderStatus, Product, StockMovementLog, Sheet3ProductEntry } from '../types';
import { StockManagerHome } from './StockManagerHome';
import { OrderCalendar } from './OrderCalendar';

interface DashboardHomeProps {
  orders: Order[];
  onNavigateToOrders: () => void;
  onOpenNewOrder: () => void;
  onSyncSheet: () => void;
  isSyncing: boolean;
  onSelectOrder: (order: Order) => void;
  onUpdateOrderStatus: (order: Order, newStatus: OrderStatus) => void;
  // Stock management & Cancel Return Approval
  products: Product[];
  onUpdateProductStock: (productId: string, newStock: number, reason?: StockMovementLog['reason'], orderId?: string) => void;
  onApproveCancelReturn: (order: Order, restock: boolean) => void;
  stockLogs: StockMovementLog[];
  onAddProduct?: (newProduct: Omit<Product, 'rowIndex'>) => void;
  sheet3Entries?: Sheet3ProductEntry[];
  onUpdateSheet3Entry?: (entry: Sheet3ProductEntry) => Promise<void> | void;
  onAddSheet3Entry?: (entry: Omit<Sheet3ProductEntry, 'rowIndex' | 'id'>) => Promise<void> | void;
  onRefreshSheet3?: () => void;
  isRefreshingSheet3?: boolean;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  orders,
  onOpenNewOrder,
  onSyncSheet,
  isSyncing,
  onSelectOrder,
  products,
  onUpdateProductStock,
  onApproveCancelReturn,
  stockLogs,
  onAddProduct,
  sheet3Entries,
  onUpdateSheet3Entry,
  onAddSheet3Entry,
  onRefreshSheet3,
  isRefreshingSheet3,
}) => {
  // The user's exact 6 products (Sheet 3 Columns A to F / Column H)
  const SIX_PRODUCTS_CONFIG = [
    {
      key: 'rose',
      name: 'Rose 599tk',
      cell: 'A3',
      matchKeys: ['rose', '599'],
      fallbackStock: 18,
    },
    {
      key: 'watch',
      name: 'Watch 599tk',
      cell: 'B3',
      matchKeys: ['watch', 'golden'],
      fallbackStock: 24,
    },
    {
      key: 'cutting',
      name: 'Cutting Dispancer',
      cell: 'C3',
      matchKeys: ['cutting', 'dispancer'],
      fallbackStock: 2,
    },
    {
      key: '990',
      name: 'Porbash Rose 990tk',
      cell: 'D3',
      matchKeys: ['990', 'probash 990', 'porbash rose 990'],
      fallbackStock: 15,
    },
    {
      key: '1350',
      name: 'Porbash Rose 1350tk',
      cell: 'E3',
      matchKeys: ['1350', 'probash 1350', 'porbash rose 1350'],
      fallbackStock: 8,
    },
    {
      key: 'doll',
      name: 'Doll and toys',
      cell: 'F3',
      matchKeys: ['doll', 'toy'],
      fallbackStock: 4,
    },
  ];

  const displayProducts = SIX_PRODUCTS_CONFIG.map((cfg) => {
    let stock = cfg.fallbackStock;
    if (sheet3Entries && sheet3Entries.length > 0) {
      const match = sheet3Entries.find((entry) => {
        const pName = (entry.productName || '').toLowerCase();
        return cfg.matchKeys.some((k) => pName.includes(k));
      });
      if (match && match.currentStock !== undefined && !isNaN(Number(match.currentStock))) {
        stock = Number(match.currentStock);
      }
    } else {
      const match = products.find((p) => {
        const pName = (p.name || '').toLowerCase();
        return cfg.matchKeys.some((k) => pName.includes(k));
      });
      if (match && match.stock !== undefined) {
        stock = match.stock;
      }
    }

    return {
      name: cfg.name,
      cell: cfg.cell,
      stock,
    };
  });

  return (
    <div className="space-y-4 sm:space-y-6 animate-fadeIn pb-20 sm:pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-3xl font-bold text-white tracking-tight">
            মাই ব্যবসা ড্যাশবোর্ড
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
            আজকের ব্যবসার সামগ্রিক বিক্রয়, পণ্য স্টক ও অর্ডার পরিসংখ্যান
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onSyncSheet}
            disabled={isSyncing}
            className="flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 py-2.5 rounded-xl bg-[#171b26] hover:bg-[#202636] border border-[#262f44] text-gray-200 text-xs sm:text-sm font-medium transition-all shadow-sm cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-pink-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'সিঙ্ক হচ্ছে...' : 'Sync Sheet'}</span>
          </button>
        </div>
      </div>

      {/* Top 6 Product Stock Cards Header */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <Boxes className="w-4 h-4 text-pink-400" />
          <span className="text-xs sm:text-sm font-bold text-white">
            পণ্য স্টক কার্ড (৬টি প্রোডাক্টের লাইভ স্টক - Sheet 3)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold font-mono">
            Sheet 3 Live Sync
          </span>
        </div>
      </div>

      {/* Exactly 6 Product Stock Cards (Pure Display, NO edit button here) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {displayProducts.map((prod, idx) => {
          const isLowStock = prod.stock > 0 && prod.stock <= 5;
          const isOutOfStock = prod.stock <= 0;

          return (
            <div
              key={`dash-prod-${idx}`}
              className={`bg-[#12151f] border rounded-2xl p-3 sm:p-3.5 relative overflow-hidden group transition-all flex flex-col justify-between ${
                isOutOfStock
                  ? 'border-rose-500/40 hover:border-rose-500/70'
                  : isLowStock
                  ? 'border-amber-500/40 hover:border-amber-500/70'
                  : 'border-[#1e2436] hover:border-pink-500/40'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-1">
                  <span
                    className="text-xs font-bold text-white tracking-tight line-clamp-1 group-hover:text-pink-300 transition-colors flex-1"
                    title={prod.name}
                  >
                    {prod.name}
                  </span>
                  <div className="w-6 h-6 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
                    <Package className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="mt-2 text-center sm:text-left">
                  <div className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-baseline justify-center sm:justify-start gap-1">
                    <span
                      className={
                        isOutOfStock
                          ? 'text-rose-400'
                          : isLowStock
                          ? 'text-amber-400'
                          : 'text-pink-500'
                      }
                    >
                      {prod.stock}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-gray-300">পিস</span>
                  </div>

                  <div className="flex items-center justify-center sm:justify-between mt-1 gap-1 flex-wrap sm:flex-nowrap">
                    <p
                      className={`text-[10px] font-semibold flex items-center justify-center gap-1 ${
                        isOutOfStock
                          ? 'text-rose-400'
                          : isLowStock
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      <span>
                        {isOutOfStock
                          ? 'স্টক শেষ'
                          : isLowStock
                          ? 'কম স্টক'
                          : 'মজুদ স্টক'}
                      </span>
                    </p>
                    <span className="text-[9px] font-mono text-gray-400 bg-[#161a26] px-1 rounded border border-[#22293d]">
                      {prod.cell}
                    </span>
                  </div>
                </div>
              </div>

              <div className="absolute -right-6 -bottom-6 w-16 h-16 bg-pink-500/5 rounded-full blur-xl pointer-events-none" />
            </div>
          );
        })}
      </div>

      {/* All Product Order Calendar (তারিখ অনুযায়ী কবে কয়টা অর্ডার) */}
      <OrderCalendar
        orders={orders}
        onSelectOrder={onSelectOrder}
      />

      {/* Stock Management & Cancel/Return Approval Section */}
      <div className="pt-2">
        <StockManagerHome
          products={products}
          orders={orders}
          onUpdateProductStock={onUpdateProductStock}
          onApproveCancelReturn={onApproveCancelReturn}
          stockLogs={stockLogs}
          onAddProduct={onAddProduct}
          sheet3Entries={sheet3Entries}
          onUpdateSheet3Entry={onUpdateSheet3Entry}
          onAddSheet3Entry={onAddSheet3Entry}
          onRefreshSheet3={onRefreshSheet3}
          isRefreshingSheet3={isRefreshingSheet3}
        />
      </div>
    </div>
  );
};
