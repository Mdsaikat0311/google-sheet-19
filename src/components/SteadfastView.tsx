import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Truck,
  CheckSquare,
  Square,
  Search,
  RefreshCw,
  Send,
  ExternalLink,
  Phone,
  Copy,
  Check,
  Package,
  Layers,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Order, Product } from '../types';

interface SteadfastViewProps {
  orders: Order[];
  products?: Product[];
  onToggleSteadfast: (order: Order, action: 'No Sellect' | 'send to steadfast') => Promise<boolean> | void;
  onBatchSendToSteadfast: (orders: Order[]) => Promise<void>;
  onSyncSheet: (silent?: boolean) => void;
  isSyncing: boolean;
  onSelectOrder: (order: Order) => void;
  spreadsheetId?: string;
  orderSheetTab?: string;
}

/**
 * Helper to match an order against the product filter (ALL, 6 canonical products, NO_SELLECT)
 */
const matchesProductFilter = (order: Order, filter: string): boolean => {
  if (filter === 'ALL') return true;

  const isNoSellect =
    order.variant === 'No Sellect' ||
    !order.variant ||
    order.variant.trim() === '' ||
    order.product === 'No Sellect' ||
    order.steadfastStatus === 'No Sellect';

  if (filter === 'NO_SELLECT') {
    return isNoSellect;
  }

  const p = (order.product || '').toLowerCase();
  const v = (order.variant || '').toLowerCase();
  const f = filter.toLowerCase();

  if (f.includes('watch')) {
    return p.includes('watch') || v.includes('watch') || p.includes('golden') || v.includes('golden');
  }
  if (f.includes('rose 599') || (f.includes('rose') && f.includes('599'))) {
    return (
      (p.includes('rose') || v.includes('rose')) &&
      !p.includes('990') &&
      !v.includes('990') &&
      !p.includes('1350') &&
      !v.includes('1350')
    );
  }
  if (f.includes('990')) {
    return p.includes('990') || v.includes('990');
  }
  if (f.includes('1350')) {
    return p.includes('1350') || v.includes('1350');
  }
  if (f.includes('doll') || f.includes('toy')) {
    return p.includes('doll') || v.includes('doll') || p.includes('toy') || v.includes('toy');
  }
  if (f.includes('cutt') || f.includes('dispan') || f.includes('dispen')) {
    return (
      p.includes('cutt') ||
      v.includes('cutt') ||
      p.includes('dispan') ||
      v.includes('dispan') ||
      p.includes('dispen') ||
      v.includes('dispen')
    );
  }

  return p.includes(f) || v.includes(f);
};

/**
 * Helper to get a date key for today (YYYY-MM-DD), accounting for local & Bangladesh (UTC+6) timezones
 */
export const getTodayKey = (): string => {
  const now = new Date();
  const bdDate = new Date(now.getTime() + (6 * 60 + now.getTimezoneOffset()) * 60000);
  const y = bdDate.getFullYear();
  const m = String(bdDate.getMonth() + 1).padStart(2, '0');
  const d = String(bdDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Checks whether an order's date string matches today's date
 */
export const isDateToday = (dateStr?: string): boolean => {
  if (!dateStr || dateStr.trim() === '') return false;
  const s = dateStr.trim();

  const now = new Date();
  const bdDate = new Date(now.getTime() + (6 * 60 + now.getTimezoneOffset()) * 60000);
  const datesToCheck = [now, bdDate];

  for (const dt of datesToCheck) {
    const yr = dt.getFullYear();
    const mo = dt.getMonth() + 1;
    const dy = dt.getDate();

    // Format 1: DD/MM/YY or DD/MM/YYYY or MM/DD/YY or MM/DD/YYYY
    const slashMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if (slashMatch) {
      const p1 = parseInt(slashMatch[1], 10);
      const p2 = parseInt(slashMatch[2], 10);
      const yrRaw = parseInt(slashMatch[3], 10);
      const fullY = yrRaw < 100 ? 2000 + yrRaw : yrRaw;

      if (fullY === yr) {
        if ((p1 === dy && p2 === mo) || (p1 === mo && p2 === dy)) {
          return true;
        }
      }
    }

    // Format 2: YYYY-MM-DD
    const isoMatch = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
    if (isoMatch) {
      const fullY = parseInt(isoMatch[1], 10);
      const moVal = parseInt(isoMatch[2], 10);
      const dyVal = parseInt(isoMatch[3], 10);
      if (fullY === yr && moVal === mo && dyVal === dy) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Helper to check if Column K has a valid 9-digit tracking code.
 * Steadfast courier tracking codes are 9 numeric digits (e.g. 290917655, 291304021).
 * User requirement: "colum k a 9 digid code"
 */
export const has9DigitTrackingCode = (tracking?: string | null): boolean => {
  if (!tracking) return false;
  const cleaned = String(tracking).trim().replace(/\D/g, '');
  return cleaned.length === 9 || (cleaned.length >= 8 && cleaned.length <= 10);
};

/**
 * Helper to check if Column L has an active courier delivery status.
 * Matches user requirements: "colum l inreview, pending, cancel, partial delivery, ba approval pendig ba ,,, ashob order deluivery status"
 */
export const hasValidCourierStatus = (courierStatus?: string | null): boolean => {
  if (!courierStatus) return false;
  const s = String(courierStatus).toLowerCase().trim();
  if (
    !s ||
    s === 'no sellect' ||
    s === 'no_sellect' ||
    s === 'no select' ||
    s === 'no_select' ||
    s === '-' ||
    s === '--' ||
    s === 'n/a' ||
    s === 'na' ||
    s === 'null' ||
    s === 'undefined' ||
    s === 'none' ||
    s.includes('send to steadfast') ||
    s === 'sent' ||
    s === 'send'
  ) {
    return false;
  }
  return (
    s.includes('inre') ||
    s.includes('review') ||
    s.includes('pending') ||
    s.includes('cancel') ||
    s.includes('partial') ||
    s.includes('approval') ||
    s.includes('deliver') ||
    s.includes('transit') ||
    s.includes('process') ||
    s.includes('hold') ||
    s.includes('complete') ||
    s.includes('return') ||
    s.length >= 3
  );
};

/**
 * Helper to check if Column L status is specifically 'inreview' / 'in_review' / 'in review'.
 * User requirement: "l colum a sodo inreview thakbe segolo b today entry tab a listed hobe"
 */
export const isInReviewCourierStatus = (courierStatus?: string | null): boolean => {
  if (!courierStatus) return false;
  const s = String(courierStatus).toLowerCase().trim().replace(/[\s\-_]/g, '');
  return s.includes('inreview') || s.includes('inreiw') || s.includes('review');
};

/**
 * Checks if an order has BOTH 9-digit tracking and courier status
 */
export const hasTrackingAndStatusMatch = (order: Order): boolean => {
  return has9DigitTrackingCode(order.trackingCode) && hasValidCourierStatus(order.courierStatus);
};

/**
 * Checks if an order is eligible according to user instructions:
 * 1. Ready for Delivery: 9-digit tracking (Column K) AND courier delivery status (Column L - inreview or other) must BOTH match together.
 *    If only 1 matches or neither matches, the order automatically stays in Ready for Delivery ("2 tai match hole hobe, akta match hole hobe na").
 * 2. Today Entry: Both match, Column K HAS 9-digit tracking code AND Column L has ONLY inreview ("sodo inreview thakbe")
 * 3. Excluded: Both match, but courier status is other delivery status (e.g. delivered, cancelled, partial delivery, etc.)
 */
export const checkSteadfastEligibility = (order: Order) => {
  const has9DigitTracking = has9DigitTrackingCode(order.trackingCode);
  const hasCourierStatus = hasValidCourierStatus(order.courierStatus);
  const isInReview = isInReviewCourierStatus(order.courierStatus);

  // Both 9-digit tracking code and courier status must match together:
  // "9 digit and couriar status golo 2 tai match hole hobe ,, akta match hole hobe na"
  const isKLMatched = has9DigitTracking && hasCourierStatus;

  // Ready for Delivery: Automatically stays here if BOTH are not matched together
  const isEligible = !isKLMatched;

  // Today Entry: 9-digit tracking in Column K AND Column L has inreview
  const isTodayEntry = has9DigitTracking && isInReview;

  const mStatus = String(order.steadfastStatus || '').toLowerCase().trim();
  const isSentM = mStatus.includes('send to steadfast') || mStatus.includes('sent');

  let excludeReason = '';
  if (isEligible) {
    if (!has9DigitTracking && !hasCourierStatus) {
      excludeReason = 'Ready for Delivery (K ও L ফাঁকা)';
    } else if (has9DigitTracking && !hasCourierStatus) {
      excludeReason = 'Ready for Delivery (L কুরিয়ার স্ট্যাটাস অপেক্ষারত)';
    } else {
      excludeReason = 'Ready for Delivery (K ট্র্যাকিং কোড অপেক্ষারত)';
    }
  } else if (isTodayEntry) {
    excludeReason = `Today Entry (K: ${order.trackingCode}, L: ${order.courierStatus})`;
  } else {
    excludeReason = `Excluded / হিস্ট্রি (K: ${order.trackingCode || 'নেই'}, L: ${order.courierStatus || 'নেই'})`;
  }

  return {
    isEligible,
    has9DigitTracking,
    hasCourierStatus,
    isInReview,
    isTodayEntry,
    isKLMatched,
    isSentM,
    excludeReason,
  };
};

export const SteadfastView: React.FC<SteadfastViewProps> = ({
  orders,
  products = [],
  onToggleSteadfast,
  onBatchSendToSteadfast,
  onSyncSheet,
  isSyncing,
  onSelectOrder,
  spreadsheetId,
  orderSheetTab = 'Sheet2',
}) => {
  // Active sub-tab: 'unentered' (ready for entry) vs 'today_entry' (entered today) vs 'excluded' (all sent/excluded)
  const [activeSubTab, setActiveSubTab] = useState<'unentered' | 'today_entry' | 'excluded' | 'all'>('unentered');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('ALL');
  const [isProductToggleOpen, setIsProductToggleOpen] = useState(false);
  const productToggleRef = useRef<HTMLDivElement>(null);

  // Close product toggle on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (productToggleRef.current && !productToggleRef.current.contains(e.target as Node)) {
        setIsProductToggleOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keep stable ref to onSyncSheet to prevent infinite re-render loops
  const onSyncSheetRef = useRef(onSyncSheet);
  useEffect(() => {
    onSyncSheetRef.current = onSyncSheet;
  }, [onSyncSheet]);

  // Real-time sheet read: silently sync with Google Sheet every 15 seconds and on window focus
  useEffect(() => {
    // Initial silent sync on mount
    onSyncSheetRef.current(true);

    const interval = setInterval(() => {
      onSyncSheetRef.current(true);
    }, 15000);

    const onFocus = () => {
      onSyncSheetRef.current(true);
    };
    const onVisibilityChange = () => {
      if (!document.hidden) {
        onSyncSheetRef.current(true);
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // Multi-selection state
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  // Batch sending loading state
  const [isSendingBatch, setIsSendingBatch] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  // Track order IDs entered TODAY (persisted per day in localStorage)
  const [todaySentOrderIds, setTodaySentOrderIds] = useState<Set<string>>(() => {
    try {
      const todayKey = getTodayKey();
      const saved = localStorage.getItem(`steadfast_today_sent_${todayKey}`);
      if (saved) {
        return new Set(JSON.parse(saved));
      }
      const fallback = localStorage.getItem('steadfast_today_sent_ids');
      if (fallback) {
        return new Set(JSON.parse(fallback));
      }
    } catch {}
    return new Set();
  });

  // Save entered order IDs to localStorage for today
  const recordSentOrders = (ids: string[]) => {
    setTodaySentOrderIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      try {
        const todayKey = getTodayKey();
        localStorage.setItem(`steadfast_today_sent_${todayKey}`, JSON.stringify(Array.from(next)));
        localStorage.setItem('steadfast_today_sent_ids', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const removeSentOrders = (ids: string[]) => {
    setTodaySentOrderIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      try {
        const todayKey = getTodayKey();
        localStorage.setItem(`steadfast_today_sent_${todayKey}`, JSON.stringify(Array.from(next)));
        localStorage.setItem('steadfast_today_sent_ids', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  // 6 canonical products + All Product + No Sellect for the toggle
  const productFilterTabs = useMemo(() => {
    return [
      { id: 'ALL', label: 'All Product', icon: '📦' },
      { id: 'Rose 599tk', label: 'Rose 599tk', icon: '🌹' },
      { id: 'Doll and toys', label: 'Doll and toys', icon: '🧸' },
      { id: 'Watch 599tk', label: 'Watch 599tk', icon: '⌚' },
      { id: 'Cutting Dispancer', label: 'Cutting Dispancer', icon: '✂️' },
      { id: 'Porbash Rose 990tk', label: 'Porbash Rose 990tk', icon: '🌸' },
      { id: 'Porbash Rose 1350tk', label: 'Porbash Rose 1350tk', icon: '🌺' },
      { id: 'NO_SELLECT', label: 'No Sellect', icon: '⚠️' },
    ];
  }, []);

  // Compute eligibility for every order
  const evaluatedOrders = useMemo(() => {
    return orders.map((order) => ({
      order,
      eligibility: checkSteadfastEligibility(order),
    }));
  }, [orders]);

  // Helper to check if Column M is 'send to steadfast'
  const isColumnMSent = (o: Order) => {
    const m = String(o.steadfastStatus || '').toLowerCase().trim();
    return m.includes('send to steadfast') || m === 'sent' || todaySentOrderIds.has(o.id);
  };

  // 1. Ready for Delivery list (unentered):
  // User instruction:
  // "ready for delivery tab a 9 digit number and inreview and courial baki status golo jodi match na hoy,,, tokhoni auto matic akhane thakbe,,, 9 digit and couriar status golo 2 tai match hole hobe ,, akta match hole hobe na"
  // Order remains in Ready for Delivery UNLESS BOTH 9-digit tracking (Column K) and courier status (Column L) match together.
  const unenteredOrders = useMemo(() => {
    return evaluatedOrders.filter((item) => item.eligibility.isEligible);
  }, [evaluatedOrders]);

  // 2. Today Entry list:
  // User instruction:
  // "akhan theke stadfast send hole j golote 9 digid code and l colum a sodo inreview thakbe segolo b today entry tab a listed hobe ,, and agolo realtime sheet read kore update hote thakbe"
  // Listed IF AND ONLY IF: Column K has 9-digit tracking code AND Column L has ONLY inreview
  const todayEntryOrders = useMemo(() => {
    return evaluatedOrders.filter((item) => item.eligibility.isTodayEntry);
  }, [evaluatedOrders]);

  // 3. Excluded orders:
  // Orders with tracking code or delivery status, but not in Today Entry (e.g. delivered, partial delivery, cancelled, etc.)
  const excludedOrders = useMemo(() => {
    return evaluatedOrders.filter(
      (item) => !item.eligibility.isEligible && !item.eligibility.isTodayEntry
    );
  }, [evaluatedOrders]);

  // Current base list depending on sub-tab
  const baseList = useMemo(() => {
    if (activeSubTab === 'unentered') return unenteredOrders;
    if (activeSubTab === 'today_entry') return todayEntryOrders;
    if (activeSubTab === 'excluded') return excludedOrders;
    return evaluatedOrders;
  }, [activeSubTab, unenteredOrders, todayEntryOrders, excludedOrders, evaluatedOrders]);

  // Dynamic order counts for each option in the toggle (All Product, 6 products, No Sellect)
  const productCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: baseList.length,
      NO_SELLECT: 0,
    };
    productFilterTabs.forEach((tab) => {
      if (tab.id !== 'ALL' && tab.id !== 'NO_SELLECT') {
        counts[tab.id] = 0;
      }
    });

    baseList.forEach(({ order }) => {
      if (matchesProductFilter(order, 'NO_SELLECT')) {
        counts.NO_SELLECT++;
      }
      productFilterTabs.forEach((tab) => {
        if (tab.id !== 'ALL' && tab.id !== 'NO_SELLECT') {
          if (matchesProductFilter(order, tab.id)) {
            counts[tab.id] = (counts[tab.id] || 0) + 1;
          }
        }
      });
    });

    return counts;
  }, [baseList, productFilterTabs]);

  // Apply search and product/variant filter
  const filteredList = useMemo(() => {
    return baseList.filter(({ order }) => {
      // 1. Product Filter Toggle
      if (!matchesProductFilter(order, selectedProductFilter)) {
        return false;
      }

      // 2. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (order.customerName || '').toLowerCase().includes(q);
        const matchesPhone = (order.customerPhone || '').toLowerCase().includes(q);
        const matchesId = (order.id || '').toLowerCase().includes(q);
        const matchesAddress = (order.customerAddress || '').toLowerCase().includes(q);
        const matchesProduct = (order.product || '').toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesId && !matchesAddress && !matchesProduct) {
          return false;
        }
      }

      return true;
    });
  }, [baseList, selectedProductFilter, searchQuery]);

  // Handle Select All / Deselect All
  const isAllSelected = useMemo(() => {
    if (filteredList.length === 0) return false;
    return filteredList.every(({ order }) => selectedOrderIds.has(order.id));
  }, [filteredList, selectedOrderIds]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      const next = new Set(selectedOrderIds);
      filteredList.forEach(({ order }) => next.delete(order.id));
      setSelectedOrderIds(next);
    } else {
      const next = new Set(selectedOrderIds);
      filteredList.forEach(({ order }) => next.add(order.id));
      setSelectedOrderIds(next);
    }
  };

  const toggleSelectOrder = (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    const next = new Set(selectedOrderIds);
    if (next.has(orderId)) {
      next.delete(orderId);
    } else {
      next.add(orderId);
    }
    setSelectedOrderIds(next);
  };

  // Handle single send or undo
  const handleSingleSend = async (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    const isAlreadySent = isColumnMSent(order);

    if (isAlreadySent) {
      removeSentOrders([order.id]);
      await onToggleSteadfast(order, 'No Sellect');
    } else {
      recordSentOrders([order.id]);
      await onToggleSteadfast(order, 'send to steadfast');
    }
  };

  // Handle Batch Send to Steadfast (Updates Column M)
  const handleBatchSend = async () => {
    const toSend = orders.filter((o) => selectedOrderIds.has(o.id));
    if (toSend.length === 0) return;

    setIsSendingBatch(true);
    try {
      recordSentOrders(toSend.map((o) => o.id));
      await onBatchSendToSteadfast(toSend);
      setSelectedOrderIds(new Set());
    } finally {
      setIsSendingBatch(false);
    }
  };

  const handleCopyPhone = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  // Calculations for summary metrics
  const selectedOrdersCount = selectedOrderIds.size;
  const selectedTotalCod = useMemo(() => {
    return orders
      .filter((o) => selectedOrderIds.has(o.id))
      .reduce((sum, o) => sum + (o.amount || o.total || 0), 0);
  }, [orders, selectedOrderIds]);

  return (
    <div className="space-y-3.5 pb-28 md:pb-20 max-w-4xl mx-auto font-sans animate-fadeIn">
      {/* 1. Top 2 Summary Cards: No. 1 Ready for Delivery & Today Entry */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
        {/* Card 1: Ready for Delivery */}
        <div
          onClick={() => setActiveSubTab('unentered')}
          className={`p-3 sm:p-4 rounded-xl border transition-all cursor-pointer select-none relative overflow-hidden ${
            activeSubTab === 'unentered'
              ? 'bg-[#152e35] border-[#235863] shadow-md shadow-teal-950/40 ring-1 ring-[#7de3e0]/40'
              : 'bg-[#141419] hover:bg-[#181822] border-[#24242e]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] sm:text-xs font-medium text-gray-300">
              Ready for Delivery
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-[#7de3e0] shrink-0">
              <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {unenteredOrders.length}
            </span>
            <span className="text-[10px] sm:text-xs text-[#7de3e0] font-medium">অর্ডার রেডি</span>
          </div>
          {activeSubTab === 'unentered' && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#7de3e0] rounded-t-full" />
          )}
        </div>

        {/* Card 2: Today Entry */}
        <div
          onClick={() => setActiveSubTab('today_entry')}
          className={`p-3 sm:p-4 rounded-xl border transition-all cursor-pointer select-none relative overflow-hidden ${
            activeSubTab === 'today_entry'
              ? 'bg-[#251838] border-[#58237e] shadow-md shadow-purple-950/40 ring-1 ring-purple-500/40'
              : 'bg-[#141419] hover:bg-[#181822] border-[#24242e]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] sm:text-xs font-medium text-gray-300">
              Today Entry
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {todayEntryOrders.length}
            </span>
            <span className="text-[10px] sm:text-xs text-purple-400 font-medium">আজ এন্ট্রি</span>
          </div>
          {activeSubTab === 'today_entry' && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500 rounded-t-full" />
          )}
        </div>
      </div>

      {/* 2. Header Toolbar matching Orders page style */}
      <div className="bg-[#141419] border-b border-[#24242c] -mx-3 sm:-mx-6 px-4 sm:px-6 py-3.5 sticky top-0 z-20 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Steadfast
            </h1>
            <span className="text-[10px] sm:text-xs font-mono px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-300 border border-purple-700/50">
              {unenteredOrders.length} Ready
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onSyncSheet(false)}
              disabled={isSyncing}
              className="p-1.5 text-gray-300 hover:text-white transition-colors"
              title="Sync Google Sheet"
            >
              {isSyncing ? (
                <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
            </button>

            {/* Bulk Send Button in Header */}
            <button
              onClick={handleBatchSend}
              disabled={selectedOrdersCount === 0 || isSendingBatch}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg bg-gradient-to-r from-purple-600 via-pink-600 to-purple-500 hover:from-purple-500 hover:to-pink-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-purple-600/30 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              {isSendingBatch ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                  <span>সেন্ড হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>M কলামে Send {selectedOrdersCount > 0 ? `(${selectedOrdersCount})` : ''}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-3 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by #order, name, phone, product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1b1b22] border border-[#2f2f3a] rounded-lg pl-9 pr-8 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* 2. PRODUCT SELECT TOGGLE (ALL PRODUCT -> 6 PRODUCTS & NO SELLECT TOGGLE) */}
        <div ref={productToggleRef} className="mt-3 relative">
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="product-select-toggle-btn"
              onClick={() => setIsProductToggleOpen((prev) => !prev)}
              className={`flex-1 flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-all cursor-pointer shadow-sm group ${
                isProductToggleOpen
                  ? 'bg-[#1c1c2a] border-purple-500/70 ring-1 ring-purple-500/40'
                  : 'bg-[#171722] hover:bg-[#1e1e2c] border-[#2b2b3a]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-sm shrink-0">
                  {selectedProductFilter === 'ALL'
                    ? '📦'
                    : selectedProductFilter === 'NO_SELLECT'
                    ? '⚠️'
                    : '🏷️'}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                    Product Select Toggle
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-purple-300 transition-colors flex items-center gap-1.5">
                    <span>
                      {selectedProductFilter === 'ALL'
                        ? 'All Product'
                        : selectedProductFilter === 'NO_SELLECT'
                        ? 'No Sellect'
                        : selectedProductFilter}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#242436] text-purple-300 border border-[#37374e]">
                  {productCounts[selectedProductFilter] ?? filteredList.length} Orders
                </span>
                <span className="text-[11px] font-medium text-gray-400 hidden sm:inline">
                  {isProductToggleOpen ? 'টগল বন্ধ' : 'টগল করুন'}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                    isProductToggleOpen ? 'rotate-180 text-purple-400' : ''
                  }`}
                />
              </div>
            </button>
          </div>

          {/* Expanded Toggle Menu with All Product + 6 Products + No Sellect */}
          {isProductToggleOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 z-30 bg-[#14141d] border border-[#2c2c3e] rounded-xl shadow-2xl p-2.5 animate-fadeIn backdrop-blur-md">
              <div className="px-2 py-1 text-[11px] font-semibold text-gray-400 border-b border-[#222230] mb-2 flex items-center justify-between">
                <span>টগল থেকে প্রোডাক্ট সিলেক্ট করুন:</span>
                <span className="text-purple-400 text-[10px]">All + ৬টি প্রোডাক্ট + No Sellect</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto pr-1">
                {productFilterTabs.map((tab) => {
                  const isSelected = selectedProductFilter === tab.id;
                  const count = productCounts[tab.id] ?? 0;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setSelectedProductFilter(tab.id);
                        setIsProductToggleOpen(false);
                      }}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-left ${
                        isSelected
                          ? 'bg-[#231b46] text-[#d8b4fe] border border-[#6b21a8] shadow-sm'
                          : 'bg-[#1a1a24] hover:bg-[#222230] text-gray-300 border border-[#272736]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm shrink-0">{tab.icon}</span>
                        <span className="truncate">{tab.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                            isSelected
                              ? 'bg-purple-600 text-white font-bold'
                              : 'bg-[#252535] text-gray-400'
                          }`}
                        >
                          {count}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-purple-400 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sub Header: Entry Status Tab + Select All - Mobile Optimized */}
        <div className="mt-2.5 pt-2 border-t border-[#23242c] space-y-2 text-xs">
          {/* Mobile Optimized Segmented Tabs with Touch Targets */}
          <div className="grid grid-cols-2 p-1 bg-[#151520] rounded-xl border border-[#272738] gap-1">
            <button
              type="button"
              id="subtab-ready-btn"
              onClick={() => setActiveSubTab('unentered')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'unentered'
                  ? 'bg-[#152e35] text-[#7de3e0] border border-[#235863] shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1b1b28]'
              }`}
            >
              <Truck className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Ready for Delivery</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full shrink-0 ${
                  activeSubTab === 'unentered'
                    ? 'bg-[#235863] text-white font-bold'
                    : 'bg-[#20202e] text-gray-400'
                }`}
              >
                {unenteredOrders.length}
              </span>
            </button>

            <button
              type="button"
              id="subtab-today-entry-btn"
              onClick={() => setActiveSubTab('today_entry')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'today_entry'
                  ? 'bg-[#251838] text-purple-300 border border-[#58237e] shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1b1b28]'
              }`}
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
              <span className="truncate">Today Entry</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full shrink-0 ${
                  activeSubTab === 'today_entry'
                    ? 'bg-[#58237e] text-white font-bold'
                    : 'bg-[#20202e] text-gray-400'
                }`}
              >
                {todayEntryOrders.length}
              </span>
            </button>
          </div>

          {/* Select All & Order Count Row */}
          <div className="flex items-center justify-between px-0.5">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1b1b26] hover:bg-[#232332] text-gray-200 border border-[#2d2d3e] font-medium transition-colors cursor-pointer text-xs active:scale-95"
            >
              {isAllSelected ? (
                <CheckSquare className="w-3.5 h-3.5 text-purple-400" />
              ) : (
                <Square className="w-3.5 h-3.5 text-gray-400" />
              )}
              <span>{isAllSelected ? 'সব আনসিলেক্ট' : 'সব সিলেক্ট'}</span>
            </button>

            <div className="text-gray-400 font-mono text-[11px] flex items-center gap-1">
              <span>প্রদর্শিত:</span>
              <span className="text-white font-semibold">{filteredList.length}</span>
              <span>অর্ডার</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Orders List: Sleek, compact slim cards matching Orders page */}
      <div className="space-y-1.5 sm:space-y-2">
        {filteredList.length === 0 ? (
          <div className="py-14 px-4 text-center bg-[#141418] rounded-xl border border-[#23242c]">
            <Package className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-300">কোনো অর্ডার পাওয়া যায়নি</p>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              {activeSubTab === 'unentered'
                ? 'স্টেডফাস্টে পাঠানোর মতো কোনো অর্ডার নেই।'
                : activeSubTab === 'today_entry'
                ? 'আজকে এখনো কোনো অর্ডার স্টেডফাস্টে এন্ট্রি করা হয়নি। রেডি অর্ডার থেকে সিলেক্ট করে M কলামে Send করলে তা এখানে যুক্ত হবে।'
                : 'ভিন্ন প্রোডাক্ট টগল নির্বাচন করুন।'}
            </p>
            {activeSubTab === 'today_entry' && (
              <button
                type="button"
                onClick={() => setActiveSubTab('unentered')}
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-[#7de3e0] border border-teal-500/30 text-xs font-semibold transition-all cursor-pointer"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Ready for Delivery দেখুন</span>
              </button>
            )}
          </div>
        ) : (
          filteredList.map(({ order, eligibility }, index) => {
            const isSelected = selectedOrderIds.has(order.id);
            const displayAmount = order.total || order.amount || 599;
            const isAlreadySent = isColumnMSent(order);
            const hasKLMatch = eligibility.isKLMatched;
            const isTodayTab = activeSubTab === 'today_entry';

            // Check if order.id is a duplicate of Column K tracking code (e.g. #290917655)
            const isTrackingCodeId = Boolean(
              order.trackingCode && (
                order.id === order.trackingCode ||
                order.id.replace(/^#/, '').trim() === String(order.trackingCode).trim() ||
                order.id.startsWith(String(order.trackingCode).trim()) ||
                (/^\d{8,12}/.test(order.id.replace(/^#/, '').trim()) && has9DigitTrackingCode(order.id))
              )
            );

            return (
              <div
                key={order.id || `order-${index}`}
                onClick={() => onSelectOrder(order)}
                className={`bg-[#141419] hover:bg-[#181822] active:bg-[#1c1c28] border rounded-xl p-3 sm:px-4 sm:py-3 shadow-xs transition-all cursor-pointer select-none group relative ${
                  isSelected
                    ? 'border-purple-500/70 bg-[#171725]'
                    : 'border-[#232430] hover:border-[#383a4c]'
                }`}
              >
                {/* Line 1: Checkbox + Customer Name (on Today Entry) OR Order # & Row # on Left, Badges on Right */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                    {/* Touch-friendly Checkbox */}
                    <div
                      onClick={(e) => toggleSelectOrder(e, order.id)}
                      className="p-1.5 -m-1 cursor-pointer shrink-0 flex items-center justify-center active:scale-90 transition-transform"
                      title={isSelected ? 'আনসিলেক্ট' : 'সিলেক্ট করুন'}
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-purple-600 border-purple-500 text-white shadow-xs'
                            : 'border-gray-600 hover:border-purple-400 bg-[#1a1e2d]'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>

                    {/* In Today Entry tab: Customer Name placed on upper line */}
                    {isTodayTab ? (
                      <span className="text-sm font-bold text-white tracking-tight truncate shrink min-w-0 max-w-[150px] sm:max-w-[220px]">
                        {order.customerName || 'গ্রাহকের নাম নেই'}
                      </span>
                    ) : (
                      <>
                        {/* Show Order ID only if it's NOT a duplicate of Column K tracking code */}
                        {!isTrackingCodeId && (
                          <span className="text-xs font-mono font-bold text-gray-400 group-hover:text-purple-400 shrink-0">
                            {order.id.startsWith('#') ? order.id : `#${order.id}`}
                          </span>
                        )}
                        {order.rowIndex && (
                          <span className="text-[10px] text-gray-400 font-mono bg-[#1b1c24] px-1.5 py-0.5 rounded border border-[#262835] shrink-0 font-medium">
                            Row #{order.rowIndex}
                          </span>
                        )}
                        {order.customerPhone && (
                          <div className="hidden sm:flex items-center gap-1 text-[11px] text-gray-400 font-mono">
                            <span>• {order.customerPhone}</span>
                            <button
                              onClick={(e) => handleCopyPhone(e, order.customerPhone!)}
                              className="hover:text-white"
                              title="কপি করুন"
                            >
                              <Copy className="w-3 h-3 text-gray-500" />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Right side: Tracking & Status badges + M Column Send Button (Visible ONLY when order is selected) */}
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {order.trackingCode && has9DigitTrackingCode(order.trackingCode) && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-950/70 text-[#7de3e0] border border-[#235863] shrink-0 font-semibold" title="K কলাম: ৯ সংখ্যার ট্র্যাকিং কোড">
                        K: {String(order.trackingCode).trim()}
                      </span>
                    )}
                    {order.courierStatus && hasValidCourierStatus(order.courierStatus) && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-950/70 text-purple-300 border border-purple-800/40 shrink-0" title="L কলাম: কুরিয়ার স্ট্যাটাস">
                        L: {String(order.courierStatus).trim()}
                      </span>
                    )}
                    {!isTodayTab && isAlreadySent && !hasKLMatch && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40 hidden sm:inline-block shrink-0" title="M কলামে Send করা হয়েছে, K ও L আপডেটের অপেক্ষায়">
                        K, L অপেক্ষারত
                      </span>
                    )}
                    {/* Hide M: Sent in Today Entry tab per user request */}
                    {!isTodayTab && isAlreadySent && !isSelected && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 shrink-0" title="স্টেডফাস্টে M কলামে পাঠানো হয়েছে">
                        <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                        <span>M: Sent</span>
                      </span>
                    )}
                    {isSelected && (
                      <button
                        type="button"
                        onClick={(e) => handleSingleSend(e, order)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border transition-all cursor-pointer active:scale-95 animate-fadeIn ${
                          isAlreadySent
                            ? 'bg-[#12281e] text-emerald-300 border-emerald-600/70 shadow-sm hover:bg-[#183528]'
                            : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-purple-500 shadow-sm hover:from-purple-500 hover:to-pink-500'
                        }`}
                        title={
                          isAlreadySent
                            ? "স্টেডফাস্ট বাতিল করে M কলামে 'No Sellect' করতে ক্লিক করুন"
                            : "গুগল শিটের M কলামে 'send to steadfast' পাঠান"
                        }
                      >
                        {isAlreadySent ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                            <span>M: Sent</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3 h-3" />
                            <span>M: Send</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Line 2: Variant (H) & Source (I) on Left, Price on Right */}
                <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-gray-400 font-medium flex-1 min-w-0 pr-1">
                    {!isTodayTab && (
                      <>
                        <span className="text-sm sm:text-base font-bold text-white tracking-tight truncate shrink-0 max-w-[120px] sm:max-w-[180px]">
                          {order.customerName || 'গ্রাহকের নাম নেই'}
                        </span>
                        <span className="text-gray-600 shrink-0">•</span>
                      </>
                    )}
                    
                    {/* Column H (Variant) from Sheet */}
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-950/70 text-purple-300 border border-purple-800/40 shrink-0 truncate max-w-[110px] sm:max-w-none font-semibold"
                      title="H কলাম: ভ্যারিয়েন্ট / প্রোডাক্ট সিলেক্ট"
                    >
                      H: {order.variant || 'No Sellect'}
                    </span>

                    {/* Column I (Source) from Sheet */}
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950/70 text-sky-300 border border-sky-800/40 shrink-0 font-semibold"
                      title="I কলাম: অর্ডার সোর্স"
                    >
                      I: {order.source || 'Website'}
                    </span>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-bold font-mono text-white tracking-tight">
                      {displayAmount}.00BDT
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors shrink-0" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. Mobile Sticky Bottom Floating Action Bar */}
      {selectedOrdersCount > 0 && (
        <div className="sm:hidden fixed bottom-16 left-3 right-3 z-40 bg-gradient-to-r from-[#171929] via-[#1d1b33] to-[#171929] border border-purple-500/50 rounded-2xl p-3 shadow-2xl shadow-purple-950/90 flex items-center justify-between gap-3 animate-slideUp">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <span className="w-2 h-2 rounded-full bg-pink-400 animate-ping" />
              <span>{selectedOrdersCount} টি সিলেক্টেড</span>
            </div>
            <p className="text-[11px] text-purple-300 font-mono">
              মোট: ৳ {selectedTotalCod.toLocaleString()} BDT
            </p>
          </div>

          <button
            onClick={handleBatchSend}
            disabled={isSendingBatch}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold shadow-lg shadow-purple-600/40 active:scale-95 disabled:opacity-50"
          >
            {isSendingBatch ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>সেন্ড হচ্ছে...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>M কলামে Send</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

