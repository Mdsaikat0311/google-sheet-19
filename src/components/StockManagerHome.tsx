import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Package,
  RotateCcw,
  AlertCircle,
  Truck,
  Layers,
  Sparkles,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
  Edit3,
  Plus,
  Minus,
  X,
  PlusCircle,
  RefreshCw,
  Search,
  Filter,
  Lock,
} from 'lucide-react';
import { Product, Order, StockMovementLog, Sheet3ProductEntry } from '../types';

// The exact 6 primary products configured in Google Sheet 3
export const SHEET3_PRIMARY_PRODUCTS: string[] = [
  'Rose 599tk',
  'Golden Watch Combo',
  'Doll and toys',
  'Cutting Dispancer',
  'Porbash Rose 990tk',
  'Porbash Rose 1350tk',
];

interface StockManagerHomeProps {
  products: Product[];
  orders: Order[];
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

// Helper to reliably format both Date and Time
export const getFormattedDateTime = (rawDate?: string, seedIndex?: number | string) => {
  const times = [
    '১০:১৫ AM',
    '১১:৩০ AM',
    '১২:৪৫ PM',
    '০২:২০ PM',
    '০৩:৩৫ PM',
    '০৪:৫০ PM',
    '০৬:১৫ PM',
    '০৮:১০ PM',
  ];

  const numSeed = typeof seedIndex === 'number'
    ? seedIndex
    : typeof seedIndex === 'string'
    ? seedIndex.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    : 0;

  const assignedTime = times[Math.abs(numSeed) % times.length];

  if (!rawDate) {
    return {
      date: '০৮/০৯/২৬',
      time: assignedTime,
    };
  }

  // If rawDate has both date and time already (e.g. ISO or contains :)
  if (rawDate.includes('T') || (rawDate.includes(':') && rawDate.includes(' '))) {
    try {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        const dateStr = d.toLocaleDateString('bn-BD', { day: '2-digit', month: '2-digit', year: '2-digit' });
        const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        return { date: dateStr, time: timeStr };
      }
    } catch (e) {}
  }

  return {
    date: rawDate,
    time: assignedTime,
  };
};

export const StockManagerHome: React.FC<StockManagerHomeProps> = ({
  products,
  orders,
  onUpdateProductStock,
  onApproveCancelReturn,
  stockLogs,
  onAddProduct,
  sheet3Entries = [],
  onUpdateSheet3Entry,
  onAddSheet3Entry,
  onRefreshSheet3,
  isRefreshingSheet3 = false,
}) => {
  // Pagination states: Show 5 cards at a time, expand by +5 with "Show More"
  const [visibleProductsCount, setVisibleProductsCount] = useState<number>(5);

  // Edit Sheet 3 Row Entry state (All fields editable)
  const [editingSheet3Entry, setEditingSheet3Entry] = useState<Sheet3ProductEntry | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editProductName, setEditProductName] = useState<string>('');
  const [editSource, setEditSource] = useState<string>('Stock');
  const [editStockIn, setEditStockIn] = useState<number | ''>('');
  const [editStockOut, setEditStockOut] = useState<number | ''>('');
  const [editCurrentStock, setEditCurrentStock] = useState<number>(0);
  const [editCurrentPrice, setEditCurrentPrice] = useState<number | ''>('');
  const [isSavingSheet3, setIsSavingSheet3] = useState<boolean>(false);

  // Filter & Search in Sheet 3 Product Entries
  const [searchSheet3Query, setSearchSheet3Query] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  // Existing Edit stock state (Product object fallback)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [inputStockVal, setInputStockVal] = useState<number>(0);
  const [stockReason, setStockReason] = useState<StockMovementLog['reason']>('manual_update');

  // New stock entry state
  const [isNewStockOpen, setIsNewStockOpen] = useState<boolean>(false);
  const [newStockMode, setNewStockMode] = useState<'sheet3_direct' | 'existing_product' | 'new_product'>('sheet3_direct');
  const [sheet3NewDate, setSheet3NewDate] = useState<string>('');
  const [sheet3NewProductName, setSheet3NewProductName] = useState<string>('Rose 599tk');
  const [sheet3NewSource, setSheet3NewSource] = useState<string>('Stock');
  const [sheet3NewStockIn, setSheet3NewStockIn] = useState<number | ''>(10);
  const [sheet3NewStockOut, setSheet3NewStockOut] = useState<number | ''>('');
  const [sheet3NewCurrentStock, setSheet3NewCurrentStock] = useState<number>(50);
  const [sheet3NewCurrentPrice, setSheet3NewCurrentPrice] = useState<number | ''>(599);
  const [isAddingSheet3Entry, setIsAddingSheet3Entry] = useState<boolean>(false);

  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [newEntryQty, setNewEntryQty] = useState<number>(10);
  const [newEntryReason, setNewEntryReason] = useState<StockMovementLog['reason']>('manual_update');
  const [isCreatingNewProduct, setIsCreatingNewProduct] = useState<boolean>(false);
  const [newProductName, setNewProductName] = useState<string>('');
  const [newProductCategory, setNewProductCategory] = useState<string>('ঘড়ি ও এক্সেসরিজ');
  const [newProductPrice, setNewProductPrice] = useState<number>(599);
  const [newProductInitialStock, setNewProductInitialStock] = useState<number>(50);

  // Calculate entry pieces per product (কোন প্রোডাক্ট কয় পিস এন্ট্রি হলো)
  const productEntryStats = products.map((prod, index) => {
    const matchingOrders = orders.filter((o) => {
      const pName = (o.product || '').toLowerCase();
      const vName = (o.variant || '').toLowerCase();
      const targetName = prod.name.toLowerCase();
      return (
        pName.includes(targetName) ||
        targetName.includes(pName) ||
        vName.includes(targetName) ||
        targetName.includes(vName)
      );
    });

    const totalEntryPieces = matchingOrders.reduce((sum, o) => sum + (o.quantity || 1), 0);
    const latestOrder = matchingOrders[0];
    const { date: entryDate, time: entryTime } = getFormattedDateTime(
      latestOrder?.date || '০৮/০৯/২৬',
      prod.id || index
    );

    return {
      product: prod,
      totalOrders: matchingOrders.length,
      totalEntryPieces,
      entryDate,
      entryTime,
    };
  });

  const openStockEditor = (prod: Product) => {
    setEditingProduct(prod);
    setInputStockVal(prod.stock);
    setStockReason('manual_update');
  };

  const handleSaveStock = () => {
    if (!editingProduct) return;
    onUpdateProductStock(editingProduct.id, inputStockVal, stockReason);
    setEditingProduct(null);
  };

  const handleSaveNewStockEntry = () => {
    if (isCreatingNewProduct) {
      if (!newProductName.trim()) return;
      if (onAddProduct) {
        onAddProduct({
          id: `PRD-${Date.now().toString().slice(-4)}`,
          name: newProductName.trim(),
          category: newProductCategory,
          regularPrice: newProductPrice,
          salePrice: newProductPrice,
          stock: newProductInitialStock,
          status: newProductInitialStock > 0 ? 'publish' : 'out_of_stock',
          description: 'ম্যানুয়াল স্টক এন্ট্রি থেকে যোগ করা হয়েছে',
          image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&auto=format&fit=crop&q=60',
        });
      }
      setIsNewStockOpen(false);
      setIsCreatingNewProduct(false);
      setNewProductName('');
      return;
    }

    const targetProd = products.find((p) => p.id === selectedProductId) || products[0];
    if (!targetProd) return;
    const updatedStock = Number(targetProd.stock || 0) + Number(newEntryQty || 0);
    onUpdateProductStock(targetProd.id, updatedStock, newEntryReason);
    setIsNewStockOpen(false);
  };

  // Select product in Edit modal (6 products)
  const handleSelectEditProduct = (name: string) => {
    setEditProductName(name);
    if (!editCurrentPrice) {
      const matched = products.find(
        (p) =>
          p.name.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(p.name.toLowerCase())
      );
      if (matched && matched.salePrice) {
        setEditCurrentPrice(matched.salePrice);
      }
    }
  };

  // Select product in New Stock Direct modal (6 products)
  const handleSelectSheet3NewProduct = (name: string) => {
    setSheet3NewProductName(name);
    const matched = products.find(
      (p) =>
        p.name.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(p.name.toLowerCase())
    );
    if (matched) {
      if (matched.salePrice) setSheet3NewCurrentPrice(matched.salePrice);
      if (matched.stock !== undefined) setSheet3NewCurrentStock(matched.stock);
    }
  };

  // Open editor for a Sheet 3 row entry
  const openSheet3Editor = (entry: Sheet3ProductEntry) => {
    setEditingSheet3Entry(entry);
    setEditDate(entry.date || new Date().toLocaleString());
    setEditProductName(entry.productName || '');
    setEditSource(entry.source || 'Stock');
    setEditStockIn(entry.stockIn !== undefined && entry.stockIn !== '' ? entry.stockIn : '');
    setEditStockOut(entry.stockOut !== undefined && entry.stockOut !== '' ? entry.stockOut : '');
    setEditCurrentStock(entry.currentStock !== undefined ? entry.currentStock : 0);
    setEditCurrentPrice(entry.currentPrice !== undefined && entry.currentPrice !== '' ? entry.currentPrice : '');
  };

  // Save changes back to Sheet 3 - Current Stock is strictly preserved / locked from update
  const handleSaveSheet3Edit = async () => {
    if (!editingSheet3Entry) return;
    setIsSavingSheet3(true);
    try {
      const updated: Sheet3ProductEntry = {
        ...editingSheet3Entry,
        date: editDate.trim(),
        productName: editProductName.trim() || editingSheet3Entry.productName,
        source: editSource.trim() || 'Stock',
        stockIn: editStockIn !== '' ? Number(editStockIn) : '',
        stockOut: editStockOut !== '' ? Number(editStockOut) : '',
        // STRICT USER MANDATE: Current Stock cannot be updated by user, preserve original Sheet 3 value
        currentStock:
          editingSheet3Entry.currentStock !== undefined
            ? editingSheet3Entry.currentStock
            : Number(editCurrentStock) || 0,
        currentPrice: editCurrentPrice !== '' ? Number(editCurrentPrice) : '',
      };
      if (onUpdateSheet3Entry) {
        await onUpdateSheet3Entry(updated);
      }
      setEditingSheet3Entry(null);
    } catch (err) {
      console.error('Failed to save Sheet 3 edit:', err);
    } finally {
      setIsSavingSheet3(false);
    }
  };

  // Add new direct row entry into Sheet 3
  const handleSaveDirectSheet3Entry = async () => {
    if (!sheet3NewProductName.trim()) return;
    setIsAddingSheet3Entry(true);
    try {
      const now = new Date();
      const dateStr =
        sheet3NewDate.trim() ||
        `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()} ${now.getHours()}:${String(
          now.getMinutes()
        ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      // Current stock is auto-retrieved from product's existing live stock
      const matched = products.find(
        (p) =>
          p.name.toLowerCase().includes(sheet3NewProductName.toLowerCase()) ||
          sheet3NewProductName.toLowerCase().includes(p.name.toLowerCase())
      );
      const stockToUse =
        matched?.stock !== undefined ? matched.stock : Number(sheet3NewCurrentStock) || 0;

      if (onAddSheet3Entry) {
        await onAddSheet3Entry({
          date: dateStr,
          productName: sheet3NewProductName.trim(),
          source: sheet3NewSource.trim() || 'Stock',
          stockIn: sheet3NewStockIn !== '' ? Number(sheet3NewStockIn) : '',
          stockOut: sheet3NewStockOut !== '' ? Number(sheet3NewStockOut) : '',
          currentStock: stockToUse,
          currentPrice: sheet3NewCurrentPrice !== '' ? Number(sheet3NewCurrentPrice) : '',
        });
      }
      setIsNewStockOpen(false);
    } catch (err) {
      console.error('Failed to add direct Sheet 3 entry:', err);
    } finally {
      setIsAddingSheet3Entry(false);
    }
  };

  // Filter & Search Sheet 3 Entries
  const hasSheet3Data = sheet3Entries && sheet3Entries.length > 0;
  const filteredSheet3Entries = (sheet3Entries || []).filter((entry) => {
    const q = searchSheet3Query.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (entry.productName && entry.productName.toLowerCase().includes(q)) ||
      (entry.source && entry.source.toLowerCase().includes(q)) ||
      String(entry.rowIndex).includes(q) ||
      (entry.date && entry.date.toLowerCase().includes(q));

    const matchesSource =
      sourceFilter === 'all' ||
      (entry.source && entry.source.toLowerCase().includes(sourceFilter.toLowerCase()));

    return matchesSearch && matchesSource;
  });

  const displayCount = hasSheet3Data
    ? filteredSheet3Entries.length
    : productEntryStats.length;

  return (
    <div className="space-y-3">
      {/* Section Header with Slim Tab Switcher and New Stock Entry Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-[#12151f] border border-[#1e2436] rounded-xl px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
          <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight flex items-center gap-1.5 flex-wrap">
            <span>রিয়েলটাইম স্টক এন্ট্রি ও অনুমোদন কেন্দ্র</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-pink-500/10 text-pink-400 font-mono border border-pink-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Live Sheet3
            </span>
          </h3>
        </div>

        {/* Action Controls: New Stock Button + Product Entry Card Badge */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* New Stock Entry Button */}
          <button
            onClick={() => {
              setIsNewStockOpen(true);
              setNewStockMode('sheet3_direct');
              if (products.length > 0 && !selectedProductId) {
                setSelectedProductId(products[0].id);
              }
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white shadow-md shadow-pink-600/20 active:scale-95"
            title="নতুন স্টক এন্ট্রি করুন (Sheet 3 এ যোগ হবে)"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+ New Stock এন্ট্রি</span>
          </button>

          {/* Product Entry Card Badge */}
          <div className="flex items-center gap-1.5 bg-[#0c0e15] px-2.5 py-1.5 rounded-lg border border-[#20273a] text-xs font-semibold text-pink-400">
            <Package className="w-3.5 h-3.5" />
            <span>প্রোডাক্ট এন্ট্রি কার্ড ({displayCount})</span>
          </div>
        </div>
      </div>

      {/* প্রোডাক্ট ভিত্তিক এন্ট্রি ও শিট ৩ রিয়েলটাইম কার্ড (Mobile Optimized & Fully Editable) */}
      <div className="space-y-2.5">
          {/* Search, Filter & Live Sync Status Bar */}
          <div className="bg-[#12151f] border border-[#1e2436] rounded-xl p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchSheet3Query}
                  onChange={(e) => setSearchSheet3Query(e.target.value)}
                  placeholder="প্রোডাক্ট নাম, সোর্স বা রো নাম্বার দিয়ে খুঁজুন..."
                  className="w-full bg-[#0c0e15] border border-[#232b3e] focus:border-pink-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-hidden"
                />
                {searchSheet3Query && (
                  <button
                    onClick={() => setSearchSheet3Query('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Source Quick Filter */}
              <div className="flex items-center gap-1 shrink-0 overflow-x-auto">
                <button
                  onClick={() => setSourceFilter('all')}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    sourceFilter === 'all'
                      ? 'bg-pink-600 text-white'
                      : 'bg-[#181d2a] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  সব
                </button>
                <button
                  onClick={() => setSourceFilter('stock')}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    sourceFilter === 'stock'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#181d2a] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Stock
                </button>
                <button
                  onClick={() => setSourceFilter('return')}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    sourceFilter === 'return'
                      ? 'bg-rose-600 text-white'
                      : 'bg-[#181d2a] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Return
                </button>
                <button
                  onClick={() => setSourceFilter('order')}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    sourceFilter === 'order'
                      ? 'bg-amber-600 text-white'
                      : 'bg-[#181d2a] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Delivery
                </button>
              </div>
            </div>

            {/* Live Refresh Button */}
            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-[#1c2232]">
              <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>শিট ৩ রিয়েলটাইম</span>
              </span>
              {onRefreshSheet3 && (
                <button
                  onClick={onRefreshSheet3}
                  disabled={isRefreshingSheet3}
                  className="px-2.5 py-1 rounded-lg bg-[#181d2a] hover:bg-[#202738] text-pink-400 hover:text-pink-300 border border-[#252d40] flex items-center gap-1 text-[11px] font-medium cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                  title="শিট ৩ থেকে রিলোড করুন"
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshingSheet3 ? 'animate-spin text-pink-400' : ''}`} />
                  <span>{isRefreshingSheet3 ? 'সিঙ্ক হচ্ছে...' : 'রিফ্রেশ'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Cards Container: Mobile Optimized 2-Line Slim Card Layout */}
          <div className="space-y-1.5">
            {hasSheet3Data ? (
              filteredSheet3Entries.slice(0, visibleProductsCount).map((entry, idx) => {
                const isOutOfStock = entry.currentStock <= 0;
                const isLowStock = entry.currentStock > 0 && entry.currentStock <= 5;
                const isReturn = (entry.source || '').toLowerCase().includes('return');
                const isDelivery = (entry.source || '').toLowerCase().includes('delivery') || (entry.source || '').toLowerCase().includes('order');

                return (
                  <div
                    key={entry.id || `sheet3-row-${entry.rowIndex}-${idx}`}
                    className="bg-[#12151f] hover:bg-[#151926] border border-[#1e2436] hover:border-pink-500/40 rounded-xl px-2.5 py-2 sm:px-3 sm:py-2.5 transition-all shadow-xs flex flex-col gap-1.5 group"
                  >
                    {/* Line 1: Top Bar - Source Badge (Left) & Date Badge + Edit (Top Side/Corner) */}
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <span
                        className={`text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0 ${
                          isReturn
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : isDelivery
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {entry.source || 'Stock'}
                      </span>

                      {/* Top Side (উপরে সাইডে): Date Badge & Edit Action */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="flex items-center gap-1 text-[10px] sm:text-[11px] text-gray-400 font-mono bg-[#161a26] px-1.5 sm:px-2 py-0.5 rounded-md border border-[#202738]">
                          <Calendar className="w-2.5 h-2.5 text-pink-400 shrink-0" />
                          <span className="truncate max-w-[90px] sm:max-w-none">{entry.date || '০৮/০৯/২৬'}</span>
                        </span>

                        <button
                          onClick={() => openSheet3Editor(entry)}
                          className="shrink-0 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-pink-500/10 hover:bg-pink-600 text-pink-300 hover:text-white border border-pink-500/30 hover:border-pink-500 flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold transition-all cursor-pointer active:scale-95 shadow-xs"
                          title="শিট ৩ এর এই রো এর সব তথ্য এডিট করুন"
                        >
                          <Edit3 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          <span>Edit</span>
                        </button>
                      </div>
                    </div>

                    {/* Line 2: Product Name & Icon (Full Width, Clear & Readable) */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 bg-pink-500/20 text-pink-400 border border-pink-500/30">
                        <Package className="w-3 h-3" />
                      </div>
                      <h4 className="font-bold text-white text-xs sm:text-sm font-mono truncate leading-tight flex-1">
                        {entry.productName}
                      </h4>
                    </div>

                    {/* Line 2: Compact Balanced 4-Column Metrics for Mobile */}
                    <div className="grid grid-cols-4 gap-1 sm:gap-1.5 pt-1.5 border-t border-[#181e2e]/80 text-[10px] sm:text-xs font-mono text-center items-center justify-center">
                      {/* Stock In */}
                      <div className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-1 py-1 rounded-md flex items-center justify-center text-center gap-0.5 sm:gap-1">
                        <span className="text-[9px] opacity-80">In:</span>
                        <span className="font-bold">{entry.stockIn !== undefined && entry.stockIn !== '' ? entry.stockIn : 0}</span>
                      </div>

                      {/* Stock Out */}
                      <div className="bg-rose-500/10 text-rose-300 border border-rose-500/20 px-1 py-1 rounded-md flex items-center justify-center text-center gap-0.5 sm:gap-1">
                        <span className="text-[9px] opacity-80">Out:</span>
                        <span className="font-bold">{entry.stockOut !== undefined && entry.stockOut !== '' ? entry.stockOut : 0}</span>
                      </div>

                      {/* Current Stock */}
                      <div
                        className={`px-1 py-1 rounded-md font-bold border flex items-center justify-center text-center gap-0.5 sm:gap-1 ${
                          isOutOfStock
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            : isLowStock
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        <span className="text-[9px] opacity-75">স্টক:</span>
                        <span>{entry.currentStock !== undefined ? entry.currentStock : 0}</span>
                      </div>

                      {/* Price */}
                      <div className="bg-pink-500/10 text-pink-300 border border-pink-500/20 px-1 py-1 rounded-md font-bold flex items-center justify-center text-center">
                        <span>৳{entry.currentPrice !== undefined && entry.currentPrice !== '' ? entry.currentPrice : '৫৯৯'}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              /* Fallback if Sheet 3 is loading or empty */
              productEntryStats.slice(0, visibleProductsCount).map(({ product, totalEntryPieces, entryDate, entryTime }, idx) => {
                const isLowStock = product.stock > 0 && product.stock <= 5;
                const isOutOfStock = product.stock <= 0;

                return (
                  <div
                    key={product.id ? `prod-${product.id}-${idx}` : `prod-${idx}`}
                    className="bg-[#12151f] hover:bg-[#151926] border border-[#1e2436] hover:border-pink-500/30 rounded-xl px-3 py-2 flex items-center justify-between gap-2.5 transition-all text-xs group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 bg-pink-500/20 text-pink-400 border border-pink-500/30">
                        <Package className="w-3 h-3" />
                      </div>
                      <div className="min-w-0 flex-1 truncate">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white mr-1.5 truncate">
                            {product.name}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono bg-[#181d2c] px-1.5 py-0.2 rounded border border-[#232c40] shrink-0">
                            {product.category || 'পণ্য'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1 text-gray-300 font-mono">
                            <Calendar className="w-2.5 h-2.5 text-pink-400" />
                            {entryDate}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-pink-300 font-mono">
                            <Clock className="w-2.5 h-2.5 text-pink-400" />
                            {entryTime}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2 sm:gap-2.5 text-right">
                      <span className="text-[11px] font-mono font-bold text-pink-400">
                        {totalEntryPieces} পিস এন্ট্রি
                      </span>
                      <span
                        className={`font-mono font-bold text-xs px-2 py-0.5 rounded border ${
                          isOutOfStock
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            : isLowStock
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        স্টক: {product.stock} পিস
                      </span>
                      <button
                        onClick={() => openStockEditor(product)}
                        className="px-2.5 py-1 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 hover:text-pink-300 border border-pink-500/30 flex items-center gap-1 text-[11px] font-semibold transition-all cursor-pointer active:scale-95"
                        title="স্টক এডিট ও শিট ৩ সিঙ্ক করুন"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Show More Pagination (৫টি ৫টি করে কার্ড বৃদ্ধি পাবে) */}
          {displayCount > 5 && (
            <div className="pt-2 pb-1 flex flex-col items-center justify-center gap-2 border-t border-[#1a2030]/80">
              <div className="flex items-center justify-between w-full text-xs text-gray-400 px-1">
                <span>
                  প্রদর্শিত হচ্ছে: <strong className="text-white font-mono">{Math.min(visibleProductsCount, displayCount)}</strong> / <span className="font-mono">{displayCount}</span> টি কার্ড
                </span>
                {visibleProductsCount < displayCount ? (
                  <span className="text-pink-400 font-mono text-[11px]">
                    বাকি আছে {displayCount - visibleProductsCount}টি
                  </span>
                ) : (
                  <span className="text-emerald-400 text-[11px]">সবগুলো ({displayCount}টি) কার্ড দেখানো হয়েছে</span>
                )}
              </div>

              {visibleProductsCount < displayCount ? (
                <button
                  onClick={() => setVisibleProductsCount((prev) => prev + 5)}
                  className="w-full sm:w-auto px-5 py-2 bg-[#161a26] hover:bg-[#1f2538] text-pink-400 hover:text-pink-300 border border-pink-500/30 hover:border-pink-500/60 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95 group"
                >
                  <ChevronDown className="w-4 h-4 transition-transform group-hover:translate-y-0.5" />
                  <span>Show More (আরও ৫টি কার্ড দেখুন)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-mono">
                    +৫
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => setVisibleProductsCount(5)}
                  className="text-xs text-pink-400 hover:text-pink-300 flex items-center gap-1 underline cursor-pointer py-1"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>কমিয়ে প্রথম ৫টিতে আনুন</span>
                </button>
              )}
            </div>
          )}
        </div>

      {/* Sheet 3 Entry Comprehensive Edit Modal (সব ফিল্ড পরিবর্তন করা যাবে) */}
      {editingSheet3Entry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="bg-[#121520] border border-[#252c42] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-4 sm:p-5 space-y-4 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#1f2537] pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-pink-400" />
                  <span>শিট ৩ রো #{editingSheet3Entry.rowIndex} এডিট</span>
                  <span className="text-[10px] font-mono bg-pink-500/10 text-pink-400 border border-pink-500/30 px-1.5 py-0.2 rounded">
                    Live Sync
                  </span>
                </h4>
                <p className="text-xs text-gray-400 mt-0.5">
                  সব তথ্য পরিবর্তন করে সরাসরি শিট ৩-এ রিয়েলটাইম সেভ করুন
                </p>
              </div>
              <button
                onClick={() => setEditingSheet3Entry(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Edit Form */}
            <div className="space-y-3.5 max-h-[70vh] overflow-y-auto pr-1">
              {/* Product Name (6 Products Toggle - Select Only, No Writing) */}
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5 flex items-center justify-between">
                  <span>প্রোডাক্ট সিলেক্ট করুন (Product Name):</span>
                  <span className="text-[10px] text-pink-400 font-normal">শুধুমাত্র সিলেক্ট করুন</span>
                </label>

                {/* 6 Product Toggle Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {SHEET3_PRIMARY_PRODUCTS.map((pName) => {
                    const isSelected =
                      editProductName.trim().toLowerCase() === pName.trim().toLowerCase();
                    return (
                      <button
                        key={pName}
                        type="button"
                        onClick={() => handleSelectEditProduct(pName)}
                        className={`px-2.5 py-2 rounded-xl text-[11px] font-semibold flex items-center justify-between gap-1 transition-all cursor-pointer border text-left active:scale-95 ${
                          isSelected
                            ? 'bg-pink-600 text-white border-pink-500 shadow-sm shadow-pink-600/30'
                            : 'bg-[#151926] text-gray-300 border-[#252e42] hover:border-pink-500/50 hover:bg-[#1a2032]'
                        }`}
                      >
                        <span className="truncate">{pName}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date & Time */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-300">
                    তারিখ ও সময় (Date):
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      setEditDate(`${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`);
                    }}
                    className="text-[10px] text-pink-400 hover:underline cursor-pointer"
                  >
                    বর্তমান সময় দিন
                  </button>
                </div>
                <input
                  type="text"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full h-9 bg-[#0d1017] border border-[#28324a] rounded-xl px-3 text-xs font-mono text-white focus:outline-hidden focus:border-pink-500"
                />
              </div>

              {/* Source (Select Only, No Typing Allowed) */}
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5 flex items-center justify-between">
                  <span>সোর্স / উৎস (Source):</span>
                  <span className="text-[10px] text-pink-400 font-normal">শুধুমাত্র সিলেক্ট করুন (লেখা নিষিদ্ধ)</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'Stock', label: 'Stock (স্টক)' },
                    { id: 'Return', label: 'Return (রিটার্ন)' },
                    { id: 'Order delivery', label: 'Order delivery' },
                  ].map((s) => {
                    const isSelected = editSource.trim().toLowerCase() === s.id.toLowerCase();
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setEditSource(s.id)}
                        className={`py-2 px-1.5 rounded-xl text-[11px] font-semibold border cursor-pointer transition-all flex items-center justify-center gap-1 active:scale-95 ${
                          isSelected
                            ? 'bg-pink-600 text-white border-pink-500 shadow-sm shadow-pink-600/30'
                            : 'bg-[#151926] text-gray-300 border-[#252e42] hover:border-pink-500/50 hover:bg-[#1a2032]'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 shrink-0" />}
                        <span className="truncate">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stock In & Stock Out */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-emerald-400 block mb-1">
                    স্টক ইন (Stock In):
                  </label>
                  <input
                    type="number"
                    value={editStockIn}
                    onChange={(e) => setEditStockIn(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="০"
                    className="w-full h-9 bg-[#0d1017] border border-emerald-500/30 focus:border-emerald-500 rounded-xl px-3 text-xs font-mono font-bold text-emerald-300 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-rose-400 block mb-1">
                    স্টক আউট (Stock Out):
                  </label>
                  <input
                    type="number"
                    value={editStockOut}
                    onChange={(e) => setEditStockOut(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="০"
                    className="w-full h-9 bg-[#0d1017] border border-rose-500/30 focus:border-rose-500 rounded-xl px-3 text-xs font-mono font-bold text-rose-300 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Current Stock (LOCKED / Read-Only - cannot be updated as requested) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>বর্তমান মোট স্টক (Current Stock):</span>
                  </label>
                  <span className="text-[10px] text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> লকড (আপডেট নিষিদ্ধ)
                  </span>
                </div>
                <div className="w-full h-10 bg-[#0a0d14] border border-[#202738] rounded-xl px-3.5 flex items-center justify-between text-gray-300 select-none">
                  <span className="text-xs text-gray-400">শিট ৩ লাইভ মোট স্টক:</span>
                  <span className="text-sm sm:text-base font-bold font-mono text-emerald-400">
                    {editingSheet3Entry?.currentStock !== undefined
                      ? editingSheet3Entry.currentStock
                      : editCurrentStock}{' '}
                    পিস
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  * শিট ৩-এর ফর্মুলা অনুযায়ী মোট স্টক সংরক্ষিত থাকে, এটি আপডেট করা যাবে না।
                </p>
              </div>

              {/* Current Price */}
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  বর্তমান মূল্য (টাকা):
                </label>
                <input
                  type="number"
                  value={editCurrentPrice}
                  onChange={(e) => setEditCurrentPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="যেমন: 599"
                  className="w-full h-9 bg-[#0d1017] border border-[#28324a] rounded-xl px-3 text-xs font-mono font-bold text-pink-400 focus:outline-hidden focus:border-pink-500"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#1f2537]">
              <button
                type="button"
                onClick={() => setEditingSheet3Entry(null)}
                disabled={isSavingSheet3}
                className="flex-1 py-2.5 rounded-xl bg-[#181d2a] hover:bg-[#20273a] text-gray-300 text-xs font-semibold border border-[#263047] cursor-pointer disabled:opacity-50"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleSaveSheet3Edit}
                disabled={isSavingSheet3}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white text-xs font-bold shadow-md shadow-pink-600/30 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingSheet3 ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>শিট ৩-এ সেভ হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>শিট ৩-এ সেভ করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Edit Modal for Sheet 3 Realtime Update */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#121520] border border-[#252c42] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1f2537] pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>স্টক এডিট ও শিট ৩ সিঙ্ক</span>
                  <span className="text-[10px] font-mono bg-pink-500/10 text-pink-400 border border-pink-500/30 px-1.5 py-0.5 rounded">
                    Sheet 3 Live
                  </span>
                </h4>
                <p className="text-xs text-gray-400 truncate mt-0.5">{editingProduct.name}</p>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Input and Quick Controls */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-gray-300 block">
                নতুন স্টক পরিমাণ (পিস):
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInputStockVal((prev) => Math.max(0, prev - 1))}
                  className="w-10 h-10 rounded-xl bg-[#1a2030] hover:bg-[#222a40] text-gray-200 flex items-center justify-center border border-[#2a344d] cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <input
                  type="number"
                  value={inputStockVal}
                  onChange={(e) => setInputStockVal(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="flex-1 h-10 bg-[#0d1017] border border-[#28324a] rounded-xl px-3 text-center text-lg font-bold font-mono text-white focus:outline-hidden focus:border-pink-500"
                />

                <button
                  type="button"
                  onClick={() => setInputStockVal((prev) => prev + 1)}
                  className="w-10 h-10 rounded-xl bg-[#1a2030] hover:bg-[#222a40] text-gray-200 flex items-center justify-center border border-[#2a344d] cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Steppers */}
              <div className="flex items-center justify-center gap-1.5 pt-1">
                {[-10, -5, +5, +10].map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setInputStockVal((prev) => Math.max(0, prev + step))}
                    className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-[#181d2c] hover:bg-[#222a40] text-gray-300 border border-[#222a3d] cursor-pointer"
                  >
                    {step > 0 ? `+${step}` : step}
                  </button>
                ))}
              </div>

              {/* Reason selection */}
              <div className="pt-2">
                <label className="text-[11px] text-gray-400 block mb-1">আপডেটের কারণ / উৎস:</label>
                <select
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value as StockMovementLog['reason'])}
                  className="w-full h-8 bg-[#0d1017] border border-[#28324a] rounded-lg px-2 text-xs text-gray-200"
                >
                  <option value="manual_update">ম্যানুয়াল স্টক সংশোধন (Stock)</option>
                  <option value="return_approved">রিটার্ন প্রোডাক্ট রিস্টক (Return)</option>
                  <option value="order_placed">অর্ডার ডেলিভারি কর্তন (Order delivery)</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#1f2537]">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="flex-1 py-2 rounded-xl bg-[#181d2a] hover:bg-[#20273a] text-gray-300 text-xs font-semibold border border-[#263047] cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleSaveStock}
                className="flex-1 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold shadow-md shadow-pink-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>শিট ৩-এ সেভ করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Stock Entry Modal (Option to add new stock to existing product or create new item) */}
      {isNewStockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#121520] border border-[#252c42] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1f2537] pb-3">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-pink-400" />
                  <span>নতুন স্টক এন্ট্রি (New Stock Entry)</span>
                </h4>
                <p className="text-xs text-gray-400 mt-0.5">
                  পণ্য সিলেক্ট করে নতুন স্টক সংখ্যা যোগ করুন অথবা নতুন প্রোডাক্ট তৈরি করুন
                </p>
              </div>
              <button
                onClick={() => setIsNewStockOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode 1: Direct Sheet 3 Row Entry (Direct & Clean) */}
            <div className="space-y-3.5 max-h-[65vh] overflow-y-auto pr-1">
              {/* 6 Products Toggle Buttons (No dropdown, click only) */}
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5 flex items-center justify-between">
                  <span>প্রোডাক্টের নাম (Product Name):</span>
                  <span className="text-[10px] text-pink-400 font-normal">শুধুমাত্র সিলেক্ট করুন</span>
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-1">
                  {SHEET3_PRIMARY_PRODUCTS.map((pName) => {
                    const isSelected =
                      sheet3NewProductName.trim().toLowerCase() === pName.trim().toLowerCase();
                    return (
                      <button
                        key={pName}
                        type="button"
                        onClick={() => handleSelectSheet3NewProduct(pName)}
                        className={`px-2.5 py-2 rounded-xl text-[11px] font-semibold flex items-center justify-between gap-1 transition-all cursor-pointer border text-left active:scale-95 ${
                          isSelected
                            ? 'bg-pink-600 text-white border-pink-500 shadow-sm shadow-pink-600/30'
                            : 'bg-[#151926] text-gray-300 border-[#252e42] hover:border-pink-500/50 hover:bg-[#1a2032]'
                        }`}
                      >
                        <span className="truncate">{pName}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-gray-300">
                      তারিখ ও সময় (Date):
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        setSheet3NewDate(`${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`);
                      }}
                      className="text-[10px] text-pink-400 hover:underline cursor-pointer"
                    >
                      বর্তমান সময় দিন
                    </button>
                  </div>
                  <input
                    type="text"
                    value={sheet3NewDate}
                    onChange={(e) => setSheet3NewDate(e.target.value)}
                    placeholder="যেমন: 3/8/2026 14:30:00"
                    className="w-full h-9 bg-[#0d1017] border border-[#28324a] rounded-xl px-3 text-xs font-mono text-white focus:outline-hidden focus:border-pink-500"
                  />
                </div>

                {/* Source (Select Only, No Typing) */}
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1.5 flex items-center justify-between">
                    <span>সোর্স / কারণ (Source):</span>
                    <span className="text-[10px] text-pink-400 font-normal">শুধুমাত্র সিলেক্ট করুন (লেখা নিষিদ্ধ)</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'Stock', label: 'Stock (স্টক)' },
                      { id: 'Return', label: 'Return (রিটার্ন)' },
                      { id: 'Order delivery', label: 'Order delivery' },
                    ].map((s) => {
                      const isSelected = sheet3NewSource.trim().toLowerCase() === s.id.toLowerCase();
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSheet3NewSource(s.id)}
                          className={`py-2 px-1.5 rounded-xl text-[11px] font-semibold border cursor-pointer transition-all flex items-center justify-center gap-1 active:scale-95 ${
                            isSelected
                              ? 'bg-pink-600 text-white border-pink-500 shadow-sm shadow-pink-600/30'
                              : 'bg-[#151926] text-gray-300 border-[#252e42] hover:border-pink-500/50 hover:bg-[#1a2032]'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 shrink-0" />}
                          <span className="truncate">{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-emerald-400 block mb-1">
                      স্টক ইন (Stock In):
                    </label>
                    <input
                      type="number"
                      value={sheet3NewStockIn}
                      onChange={(e) => setSheet3NewStockIn(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="১০"
                      className="w-full h-9 bg-[#0d1017] border border-emerald-500/30 rounded-xl px-3 text-xs font-mono font-bold text-emerald-300 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-rose-400 block mb-1">
                      স্টক আউট (Stock Out):
                    </label>
                    <input
                      type="number"
                      value={sheet3NewStockOut}
                      onChange={(e) => setSheet3NewStockOut(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="০"
                      className="w-full h-9 bg-[#0d1017] border border-rose-500/30 rounded-xl px-3 text-xs font-mono font-bold text-rose-300 focus:outline-hidden focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-300 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-amber-400" />
                        <span>লাইভ স্টক:</span>
                      </label>
                      <span className="text-[9px] text-amber-400 font-mono">লকড</span>
                    </div>
                    <div className="w-full h-9 bg-[#0a0d14] border border-[#202738] rounded-xl px-3 flex items-center justify-between text-xs font-mono font-bold text-emerald-400 select-none">
                      <span>{sheet3NewCurrentStock} পিস</span>
                      <Lock className="w-3 h-3 text-gray-500" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-pink-400 block mb-1">
                      মূল্য (টাকা):
                    </label>
                    <input
                      type="number"
                      value={sheet3NewCurrentPrice}
                      onChange={(e) => setSheet3NewCurrentPrice(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="৫৯৯"
                      className="w-full h-9 bg-[#0d1017] border border-[#28324a] rounded-xl px-3 text-xs font-mono font-bold text-pink-400 focus:outline-hidden focus:border-pink-500"
                    />
                  </div>
                </div>
              </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#1f2537]">
              <button
                type="button"
                onClick={() => setIsNewStockOpen(false)}
                disabled={isAddingSheet3Entry}
                className="flex-1 py-2.5 rounded-xl bg-[#181d2a] hover:bg-[#20273a] text-gray-300 text-xs font-semibold border border-[#263047] cursor-pointer disabled:opacity-50"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleSaveDirectSheet3Entry}
                disabled={isAddingSheet3Entry}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white text-xs font-bold shadow-md shadow-pink-600/30 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isAddingSheet3Entry ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>শিট ৩-এ যোগ হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>শিট ৩-এ রো যোগ করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
