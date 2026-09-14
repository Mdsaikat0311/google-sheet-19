import React from 'react';
import {
  Package,
  RefreshCw,
  Boxes,
} from 'lucide-react';
import { Order, OrderStatus, Product, StockMovementLog, Sheet3ProductEntry } from '../types';
import { INITIAL_DAILY_TREND } from '../data/initialOrders';
import { StockManagerHome } from './StockManagerHome';

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

      {/* দৈনিক অর্ডারের গ্রাফ (Full Width Graph) */}
      <div className="w-full bg-[#12151f] border border-[#1e2436] rounded-2xl p-4 sm:p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                দৈনিক অর্ডারের গ্রাফ
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                সপ্তাহের দিন অনুযায়ী মোট অর্ডারের পরিমাণ
              </p>
            </div>
            <span className="text-[11px] sm:text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20 font-medium">
              এই সপ্তাহ
            </span>
          </div>

          {/* Neon Bar Graph */}
          <div className="relative pt-4 sm:pt-6 pb-2">
            {/* Y Axis Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] sm:text-[11px] text-gray-600 pr-2">
              <div className="border-b border-gray-800/80 pb-0.5 flex justify-between">
                <span>80</span>
              </div>
              <div className="border-b border-gray-800/80 pb-0.5 flex justify-between">
                <span>60</span>
              </div>
              <div className="border-b border-gray-800/80 pb-0.5 flex justify-between">
                <span>40</span>
              </div>
              <div className="border-b border-gray-800/80 pb-0.5 flex justify-between">
                <span>20</span>
              </div>
              <div className="border-b border-gray-800/80 pb-0.5 flex justify-between">
                <span>0</span>
              </div>
            </div>

            {/* Bars container */}
            <div className="relative z-10 flex items-end justify-between h-44 sm:h-52 px-2 sm:px-6 pt-4">
              {INITIAL_DAILY_TREND.map((item, index) => {
                const maxVal = 80;
                const heightPercent = Math.min(100, Math.round((item.orders / maxVal) * 100));
                const isHighlight = index === 2 || index === 4;

                return (
                  <div
                    key={`trend-${item.day}-${index}`}
                    className="flex flex-col items-center flex-1 group cursor-pointer"
                  >
                    <div className="relative w-full flex flex-col items-center">
                      {/* Tooltip on hover */}
                      <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-pink-950/90 text-pink-300 text-[10px] px-1.5 py-0.5 rounded border border-pink-500/40 pointer-events-none whitespace-nowrap z-20">
                        {item.orders} টি
                      </div>

                      {/* Bar */}
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-5 sm:w-10 rounded-t-lg transition-all duration-300 group-hover:scale-y-105 ${
                          isHighlight
                            ? 'bg-gradient-to-t from-pink-700 via-rose-500 to-pink-400 shadow-lg shadow-pink-500/30 neon-pink-glow'
                            : 'bg-gradient-to-t from-gray-800 via-purple-900/60 to-purple-500/70'
                        }`}
                      />
                    </div>

                    {/* Day Label */}
                    <span className="text-[10px] sm:text-xs text-gray-400 font-medium mt-2">
                      {item.day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="pt-3 sm:pt-4 mt-3 sm:mt-4 border-t border-[#1c2232] flex items-center justify-between text-xs text-gray-400">
          <span>সর্বোচ্চ বিক্রি: <strong>বুধবার (৭৮ টি)</strong></span>
          <span className="text-pink-400 font-semibold">গড়: ৪৪ টি/দিন</span>
        </div>
      </div>

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
