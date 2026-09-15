// Helper to ensure clean rate percentage format e.g. 100.0% or 0.0%
const cleanRate = (rate?: string) => {
  if (!rate || rate.trim() === '' || rate === '0') return '0.0%';
  const trimmed = rate.trim();
  return trimmed.endsWith('%') ? trimmed : `${trimmed}%`;
};

// Helper for consistent source colors across charts
const getSourceColor = (sourceName: string, index = 0): string => {
  const norm = sourceName.toLowerCase().trim();
  if (norm.includes('web')) return '#3b82f6';
  if (norm.includes('mess') || norm.includes('face') || norm.includes('fb')) return '#8b5cf6';
  if (norm.includes('what') || norm.includes('wa')) return '#10b981';
  if (norm.includes('tik')) return '#ec4899';
  if (norm.includes('call') || norm.includes('phone') || norm.includes('direct')) return '#f59e0b';
  if (norm.includes('you') || norm.includes('yt')) return '#dc2626';
  if (norm.includes('incom')) return '#ef4444';
  if (norm.includes('land') || norm.includes('funnel')) return '#06b6d4';
  if (norm.includes('insta') || norm.includes('ig')) return '#f43f5e';

  const palette = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#f97316', '#a855f7'];
  return palette[index % palette.length];
};

import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  RotateCcw,
  Hourglass,
  Ban,
  Calendar,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  Layers,
  ShoppingBag,
  ExternalLink,
  Search,
  CheckCircle2,
  Phone,
  Globe,
  MessageCircle,
  Video,
  Share2,
  Package,
  Clock,
  Filter,
  ArrowUpRight,
  ArrowLeft,
  Sparkles,
  PieChart,
} from 'lucide-react';
import { Order, Sheet1ProductReport, ProductReportSource } from '../types';
import { fetchSheet1Reports, DEFAULT_SPREADSHEET_ID } from '../services/sheets';

interface ReportsViewProps {
  spreadsheetId?: string;
  orders?: Order[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  spreadsheetId = DEFAULT_SPREADSHEET_ID,
  orders = [],
}) => {
  const [sheetProducts, setSheetProducts] = useState<Sheet1ProductReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Selected product ID for full dedicated source detail page (when card is clicked)
  const [selectedDetailProductId, setSelectedDetailProductId] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'products' | 'sources'>('products');
  
  // Date Filtering State: 'all', 'today', 'yesterday', 'last7days', 'last30days', 'lastmonth', 'custom', or specific date
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);

  // Load Sheet 1 Report Data (supports background real-time sync)
  const loadSheet1Data = async (isManual: boolean = false, isBackground: boolean = false) => {
    if (isManual) setRefreshing(true);
    else if (!isBackground) setLoading(true);

    try {
      const result = await fetchSheet1Reports(spreadsheetId);
      if (result.products && result.products.length > 0) {
        setSheetProducts(result.products);
        setLastUpdated(
          new Date().toLocaleTimeString('bn-BD', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
      }
    } catch (err) {
      console.error('Failed to load Sheet 1 reports:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSheet1Data();
    // Real-time automatic polling every 15 seconds to sync Google Sheet 1
    const interval = setInterval(() => {
      loadSheet1Data(false, true);
    }, 15000);
    return () => clearInterval(interval);
  }, [spreadsheetId]);

  // Extract all distinct dates from orders
  const availableDates = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.date && o.date.trim()) {
        set.add(o.date.trim());
      }
    });
    return Array.from(set);
  }, [orders]);

  // Helper to parse dates from sheet (e.g. DD/MM/YY, DD/MM/YYYY, YYYY-MM-DD)
  const parseSheetDate = (str?: string): Date | null => {
    if (!str) return null;
    const s = str.trim();
    if (!s) return null;

    // YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      const y = parseInt(isoMatch[1], 10);
      const m = parseInt(isoMatch[2], 10) - 1;
      const d = parseInt(isoMatch[3], 10);
      const dt = new Date(y, m, d);
      if (!isNaN(dt.getTime())) return dt;
    }

    // DD/MM/YY or DD/MM/YYYY or DD-MM-YY or DD-MM-YYYY
    const dmyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
    if (dmyMatch) {
      const d = parseInt(dmyMatch[1], 10);
      const m = parseInt(dmyMatch[2], 10) - 1;
      let y = parseInt(dmyMatch[3], 10);
      if (y < 100) y += 2000;
      const dt = new Date(y, m, d);
      if (!isNaN(dt.getTime())) return dt;
    }

    const fallback = new Date(s);
    if (!isNaN(fallback.getTime())) return fallback;
    return null;
  };

  // Normalize and match date filter (supports All Time, Today, Yesterday, Last 7 Days, Last 30 Days, Last Month, Custom Date Range, and specific Sheet dates)
  const matchesDate = (orderDateStr?: string): boolean => {
    if (dateFilter === 'all') return true;
    if (!orderDateStr) return false;
    const cleanDate = orderDateStr.trim();

    // Direct match with specific sheet date string (e.g. '08/09/26')
    if (cleanDate === dateFilter) return true;

    const orderDate = parseSheetDate(cleanDate);
    if (!orderDate) {
      if (dateFilter === 'custom') {
        if (customStartDate && cleanDate.includes(customStartDate)) return true;
        if (customEndDate && cleanDate.includes(customEndDate)) return true;
      }
      return false;
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (dateFilter === 'today') {
      if (orderDate >= todayStart && orderDate <= todayEnd) return true;
      const d = String(now.getDate()).padStart(2, '0');
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const y = String(now.getFullYear()).slice(-2);
      const todayStr = `${d}/${m}/${y}`;
      return cleanDate === todayStr || cleanDate.includes(todayStr);
    }

    if (dateFilter === 'yesterday') {
      const yestStart = new Date(todayStart);
      yestStart.setDate(yestStart.getDate() - 1);
      const yestEnd = new Date(todayEnd);
      yestEnd.setDate(yestEnd.getDate() - 1);
      if (orderDate >= yestStart && orderDate <= yestEnd) return true;
      const yDate = new Date(now);
      yDate.setDate(yDate.getDate() - 1);
      const d = String(yDate.getDate()).padStart(2, '0');
      const m = String(yDate.getMonth() + 1).padStart(2, '0');
      const y = String(yDate.getFullYear()).slice(-2);
      const yesterdayStr = `${d}/${m}/${y}`;
      return cleanDate === yesterdayStr || cleanDate.includes(yesterdayStr);
    }

    if (dateFilter === 'last7days') {
      const start = new Date(todayStart);
      start.setDate(start.getDate() - 6);
      return orderDate >= start && orderDate <= todayEnd;
    }

    if (dateFilter === 'last30days') {
      const start = new Date(todayStart);
      start.setDate(start.getDate() - 29);
      return orderDate >= start && orderDate <= todayEnd;
    }

    if (dateFilter === 'lastmonth') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return orderDate >= start && orderDate <= end;
    }

    if (dateFilter === 'custom') {
      const cStart = customStartDate ? parseSheetDate(customStartDate) : null;
      const cEnd = customEndDate ? parseSheetDate(customEndDate) : null;

      if (cStart && cEnd) {
        const start = new Date(cStart.getFullYear(), cStart.getMonth(), cStart.getDate(), 0, 0, 0, 0);
        const end = new Date(cEnd.getFullYear(), cEnd.getMonth(), cEnd.getDate(), 23, 59, 59, 999);
        return orderDate >= start && orderDate <= end;
      } else if (cStart) {
        const start = new Date(cStart.getFullYear(), cStart.getMonth(), cStart.getDate(), 0, 0, 0, 0);
        return orderDate >= start;
      } else if (cEnd) {
        const end = new Date(cEnd.getFullYear(), cEnd.getMonth(), cEnd.getDate(), 23, 59, 59, 999);
        return orderDate <= end;
      }
      return true;
    }

    return cleanDate === dateFilter;
  };

  // Filtered orders matching selected date
  const dateFilteredOrders = useMemo(() => {
    if (dateFilter === 'all') return orders;
    return orders.filter((o) => matchesDate(o.date));
  }, [orders, dateFilter, customStartDate, customEndDate, availableDates]);

  // Order status helper functions
  const isConfirmed = (status?: string) => {
    const s = (status || '').toLowerCase();
    return (
      s.includes('confirm') ||
      s.includes('complete') ||
      s.includes('deliv') ||
      s.includes('proc') ||
      s.includes('প্রসেসিং') ||
      s.includes('কমপ্লিট')
    );
  };

  const isDelivered = (status?: string, courierStatus?: string) => {
    const s = (status || '').toLowerCase();
    const c = (courierStatus || '').toLowerCase();
    return s.includes('deliv') || c === 'delivered' || s.includes('ডেলিভার্ড');
  };

  const isPending = (status?: string, courierStatus?: string) => {
    const s = (status || '').toLowerCase();
    const c = (courierStatus || '').toLowerCase();
    return (
      s.includes('pend') ||
      s.includes('hold') ||
      c === 'in_review' ||
      c === 'pending' ||
      s.includes('পেন্ডিং') ||
      s.includes('হোল্ড')
    );
  };

  const isCancelled = (status?: string, courierStatus?: string) => {
    const s = (status || '').toLowerCase();
    const c = (courierStatus || '').toLowerCase();
    return (
      s.includes('cancel') ||
      c === 'cancelled' ||
      s.includes('বাতিল') ||
      s.includes('ক্যান্সেল')
    );
  };

  const isPartial = (status?: string, courierStatus?: string) => {
    const s = (status || '').toLowerCase();
    const c = (courierStatus || '').toLowerCase();
    return s.includes('part') || c === 'partial_delivered';
  };

  // The 6 canonical products from Sheet2 Column H toggle button & Sheet 1
  const SHEET2_TOGGLE_PRODUCTS = [
    'Rose 599tk',
    'Doll and toys',
    'Watch 599tk',
    'Porbash Rose 990tk',
    'Porbash Rose 1350tk',
    'Cutting Dispancer',
  ] as const;

  // Helper to match an order to a product name
  const matchesProductName = (order: Order, prodName: string): boolean => {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const pNorm = normalize(prodName);
    const vNorm = normalize(order.variant || '');

    // Priority 1: Match with Column H (variant toggle button) from Sheet 2
    if (vNorm && vNorm !== 'nosellect') {
      if (vNorm === pNorm) return true;
      if (pNorm.includes('599') && !vNorm.includes('599')) return false;
      if (pNorm.includes('990') && !vNorm.includes('990')) return false;
      if (pNorm.includes('1350') && !vNorm.includes('1350')) return false;
      return vNorm.includes(pNorm) || pNorm.includes(vNorm);
    }

    // Priority 2: Fallback to order.product only if Column H was not selected
    const oNorm = normalize(order.product || '');
    if (oNorm && oNorm !== 'nosellect') {
      if (oNorm === pNorm) return true;
      if (pNorm.includes('599') && !oNorm.includes('599')) return false;
      if (pNorm.includes('990') && !oNorm.includes('990')) return false;
      if (pNorm.includes('1350') && !oNorm.includes('1350')) return false;
      if (pNorm.includes('doll') && oNorm.includes('doll')) return true;
      if (pNorm.includes('dispancer') && oNorm.includes('dispancer')) return true;
    }
    return false;
  };

  // Master unified products list: STRICTLY AND ONLY the 6 products from Sheet 2 Column H & Sheet 1
  const unifiedProducts = useMemo(() => {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    return SHEET2_TOGGLE_PRODUCTS.map((prodName, idx) => {
      const pNorm = normalize(prodName);
      // Find matching real-time report from Sheet 1
      const sheetReport = sheetProducts.find((sp) => {
        const spNorm = normalize(sp.productName);
        return (
          spNorm === pNorm ||
          (pNorm.includes('599') && spNorm.includes('599') && pNorm.slice(0, 4) === spNorm.slice(0, 4)) ||
          (pNorm.includes('990') && spNorm.includes('990')) ||
          (pNorm.includes('1350') && spNorm.includes('1350')) ||
          (pNorm.includes('doll') && spNorm.includes('doll')) ||
          (pNorm.includes('dispancer') && spNorm.includes('dispancer'))
        );
      });

      return {
        id: sheetReport ? sheetReport.id : `SHEET2-PROD-${idx + 1}`,
        productName: prodName,
        rawHeader: sheetReport ? sheetReport.rawHeader : prodName,
        sheetReport,
      };
    });
  }, [sheetProducts]);

  // Aggregate stats across all products according to selected date
  const aggregatedStats = useMemo(() => {
    // If a specific date is chosen, calculate directly from dateFilteredOrders
    if (dateFilter !== 'all') {
      let filtered = dateFilteredOrders;
      if (selectedProduct !== 'all') {
        filtered = filtered.filter((o) => matchesProductName(o, selectedProduct));
      }

      const totalLead = filtered.length;
      const totalConfirm = filtered.filter((o) => isConfirmed(o.status)).length;
      const totalDelivery = filtered.filter((o) => isDelivered(o.status, o.courierStatus)).length;
      const totalPending = filtered.filter((o) => isPending(o.status, o.courierStatus)).length;
      const totalPartial = filtered.filter((o) => isPartial(o.status, o.courierStatus)).length;
      const totalCancel = filtered.filter((o) => isCancelled(o.status, o.courierStatus)).length;
      const totalQuantity = filtered.reduce((sum, o) => sum + (o.quantity || 1), 0);
      const totalAmount = filtered.reduce((sum, o) => sum + (o.amount || o.total || 0), 0);

      return {
        totalLead,
        totalConfirm,
        confirmRate: totalLead > 0 ? `${((totalConfirm / totalLead) * 100).toFixed(1)}%` : '0%',
        totalDelivery,
        deliveryRate: totalConfirm > 0 ? `${((totalDelivery / totalConfirm) * 100).toFixed(1)}%` : '0%',
        totalPending,
        pendingRate: totalLead > 0 ? `${((totalPending / totalLead) * 100).toFixed(1)}%` : '0%',
        totalPartial,
        partialRate: totalLead > 0 ? `${((totalPartial / totalLead) * 100).toFixed(1)}%` : '0%',
        totalQuantity,
        totalCancel,
        cancelRate: totalLead > 0 ? `${((totalCancel / totalLead) * 100).toFixed(1)}%` : '0%',
        totalAmount,
      };
    }

    // When date is 'all'
    if (sheetProducts.length > 0) {
      if (selectedProduct !== 'all') {
        const p = sheetProducts.find((item) => item.productName === selectedProduct);
        if (p) {
          const matchingOrders = orders.filter((o) => matchesProductName(o, selectedProduct));
          const totalAmount = matchingOrders.reduce((sum, o) => sum + (o.amount || o.total || 0), 0);
          return {
            totalLead: p.overall.lead || matchingOrders.length,
            totalConfirm: p.overall.confirm,
            confirmRate: p.overall.confirmRate,
            totalDelivery: p.overall.delivery,
            deliveryRate: p.overall.deliveryRate,
            totalPending: p.overall.pending,
            pendingRate: p.overall.pendingRate || (p.overall.lead > 0 ? `${((p.overall.pending / p.overall.lead) * 100).toFixed(1)}%` : '0%'),
            totalPartial: p.overall.partial,
            partialRate: p.overall.partialRate || (p.overall.lead > 0 ? `${((p.overall.partial / p.overall.lead) * 100).toFixed(1)}%` : '0%'),
            totalQuantity: p.overall.quantity,
            totalCancel: p.overall.cancel,
            cancelRate: p.overall.cancelRate,
            totalAmount,
          };
        }
      }

      const lead = sheetProducts.reduce((sum, p) => sum + p.overall.lead, 0);
      const confirm = sheetProducts.reduce((sum, p) => sum + p.overall.confirm, 0);
      const delivery = sheetProducts.reduce((sum, p) => sum + p.overall.delivery, 0);
      const pending = sheetProducts.reduce((sum, p) => sum + p.overall.pending, 0);
      const partial = sheetProducts.reduce((sum, p) => sum + p.overall.partial, 0);
      const quantity = sheetProducts.reduce((sum, p) => sum + p.overall.quantity, 0);
      const cancel = sheetProducts.reduce((sum, p) => sum + p.overall.cancel, 0);
      const totalAmount = orders.reduce((sum, o) => sum + (o.amount || o.total || 0), 0);

      return {
        totalLead: lead,
        totalConfirm: confirm,
        confirmRate: lead > 0 ? `${((confirm / lead) * 100).toFixed(1)}%` : '0%',
        totalDelivery: delivery,
        deliveryRate: confirm > 0 ? `${((delivery / confirm) * 100).toFixed(1)}%` : '0%',
        totalPending: pending,
        pendingRate: lead > 0 ? `${((pending / lead) * 100).toFixed(1)}%` : '0%',
        totalPartial: partial,
        partialRate: lead > 0 ? `${((partial / lead) * 100).toFixed(1)}%` : '0%',
        totalQuantity: quantity,
        totalCancel: cancel,
        cancelRate: confirm > 0 ? `${((cancel / confirm) * 100).toFixed(1)}%` : '0%',
        totalAmount,
      };
    }

    // Fallback directly from orders if Sheet 1 not yet loaded
    const totalLead = orders.length;
    const totalConfirm = orders.filter((o) => isConfirmed(o.status)).length;
    const totalDelivery = orders.filter((o) => isDelivered(o.status, o.courierStatus)).length;
    const totalPending = orders.filter((o) => isPending(o.status, o.courierStatus)).length;
    const totalPartial = orders.filter((o) => isPartial(o.status, o.courierStatus)).length;
    const totalCancel = orders.filter((o) => isCancelled(o.status, o.courierStatus)).length;
    const totalQuantity = orders.reduce((sum, o) => sum + (o.quantity || 1), 0);
    const totalAmount = orders.reduce((sum, o) => sum + (o.amount || o.total || 0), 0);

    return {
      totalLead,
      totalConfirm,
      confirmRate: totalLead > 0 ? `${((totalConfirm / totalLead) * 100).toFixed(1)}%` : '0%',
      totalDelivery,
      deliveryRate: totalConfirm > 0 ? `${((totalDelivery / totalConfirm) * 100).toFixed(1)}%` : '0%',
      totalPending,
      pendingRate: totalLead > 0 ? `${((totalPending / totalLead) * 100).toFixed(1)}%` : '0%',
      totalPartial,
      partialRate: totalLead > 0 ? `${((totalPartial / totalLead) * 100).toFixed(1)}%` : '0%',
      totalQuantity,
      totalCancel,
      cancelRate: totalLead > 0 ? `${((totalCancel / totalLead) * 100).toFixed(1)}%` : '0%',
      totalAmount,
    };
  }, [sheetProducts, selectedProduct, dateFilter, dateFilteredOrders, orders]);

  // Filtered products list based on search and pill filter
  const filteredProducts = useMemo(() => {
    return unifiedProducts.filter((p) => {
      const matchesSearch =
        p.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.sheetReport &&
          p.sheetReport.sources.some((s) => s.source.toLowerCase().includes(searchTerm.toLowerCase())));
      const matchesFilter = selectedProduct === 'all' || p.productName === selectedProduct;
      return matchesSearch && matchesFilter;
    });
  }, [unifiedProducts, searchTerm, selectedProduct]);

  // Aggregate sources across all products for Sources tab
  const sourceAnalytics = useMemo(() => {
    const colors: { [key: string]: string } = {
      Website: '#3b82f6',
      Messenger: '#8b5cf6',
      Whatsapp: '#10b981',
      Tiktok: '#ec4899',
      'Call Direct': '#f59e0b',
      INCOMPLETE: '#ef4444',
      Youtube: '#dc2626',
    };

    if (dateFilter !== 'all') {
      const sourceMap: {
        [key: string]: {
          name: string;
          lead: number;
          confirm: number;
          delivery: number;
          partial: number;
          pending: number;
          quantity: number;
          cancel: number;
        };
      } = {};

      dateFilteredOrders.forEach((o) => {
        const cleanName = o.source && o.source.trim() ? o.source.trim() : 'Website';
        if (!sourceMap[cleanName]) {
          sourceMap[cleanName] = {
            name: cleanName,
            lead: 0,
            confirm: 0,
            delivery: 0,
            partial: 0,
            pending: 0,
            quantity: 0,
            cancel: 0,
          };
        }
        sourceMap[cleanName].lead += 1;
        if (isConfirmed(o.status)) sourceMap[cleanName].confirm += 1;
        if (isDelivered(o.status, o.courierStatus)) sourceMap[cleanName].delivery += 1;
        if (isPartial(o.status, o.courierStatus)) sourceMap[cleanName].partial += 1;
        if (isPending(o.status, o.courierStatus)) sourceMap[cleanName].pending += 1;
        sourceMap[cleanName].quantity += o.quantity || 1;
        if (isCancelled(o.status, o.courierStatus)) sourceMap[cleanName].cancel += 1;
      });

      const list = Object.values(sourceMap);
      const totalLead = list.reduce((sum, item) => sum + item.lead, 0);

      return list.map((item) => ({
        ...item,
        percentage: totalLead > 0 ? Math.round((item.lead / totalLead) * 100) : 0,
        color: colors[item.name] || '#6b7280',
      }));
    }

    const sourceMap: {
      [key: string]: {
        name: string;
        lead: number;
        confirm: number;
        delivery: number;
        partial: number;
        pending: number;
        quantity: number;
        cancel: number;
      };
    } = {};

    sheetProducts.forEach((p) => {
      p.sources.forEach((s) => {
        const cleanName = s.sourceName || 'Unknown';
        if (!sourceMap[cleanName]) {
          sourceMap[cleanName] = {
            name: cleanName,
            lead: 0,
            confirm: 0,
            delivery: 0,
            partial: 0,
            pending: 0,
            quantity: 0,
            cancel: 0,
          };
        }
        sourceMap[cleanName].lead += s.lead;
        sourceMap[cleanName].confirm += s.confirm;
        sourceMap[cleanName].delivery += s.delivery;
        sourceMap[cleanName].partial += s.partial;
        sourceMap[cleanName].pending += s.pending;
        sourceMap[cleanName].quantity += s.quantity;
        sourceMap[cleanName].cancel += s.cancel;
      });
    });

    const list = Object.values(sourceMap);
    const totalLead = list.reduce((sum, item) => sum + item.lead, 0);

    return list.map((item) => ({
      ...item,
      percentage: totalLead > 0 ? Math.round((item.lead / totalLead) * 100) : 0,
      color: colors[item.name] || '#6b7280',
    }));
  }, [sheetProducts, dateFilter, dateFilteredOrders]);

  // Source Icon Helper
  const getSourceIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('website')) return <Globe className="w-4 h-4 text-blue-400 shrink-0" />;
    if (n.includes('messenger')) return <MessageCircle className="w-4 h-4 text-purple-400 shrink-0" />;
    if (n.includes('whatsapp') || n.includes('what')) return <Phone className="w-4 h-4 text-emerald-400 shrink-0" />;
    if (n.includes('tiktok')) return <Video className="w-4 h-4 text-pink-400 shrink-0" />;
    if (n.includes('call') || n.includes('phone')) return <Phone className="w-4 h-4 text-amber-400 shrink-0" />;
    if (n.includes('youtube') || n.includes('you')) return <Video className="w-4 h-4 text-rose-400 shrink-0" />;
    return <Share2 className="w-4 h-4 text-gray-400 shrink-0" />;
  };

  // Selected product detail object
  const selectedProductDetail = useMemo(() => {
    if (!selectedDetailProductId) return null;
    return unifiedProducts.find((p) => p.id === selectedDetailProductId) || null;
  }, [selectedDetailProductId, unifiedProducts]);

  // Compute analytics for a given product
  const getProductAnalytics = (prod: {
    id: string;
    productName: string;
    rawHeader: string;
    sheetReport?: Sheet1ProductReport;
  }) => {
    // Orders matching this product under the selected date filter
    const relatedDateOrders = dateFilteredOrders.filter((o) =>
      matchesProductName(o, prod.productName)
    );

    // Orders matching this product across all dates
    const allRelatedOrders = orders.filter((o) =>
      matchesProductName(o, prod.productName)
    );

    // Compute stats
    let prodStats = {
      lead: 0,
      confirm: 0,
      confirmRate: '0.0%',
      delivery: 0,
      deliveryRate: '0.0%',
      pending: 0,
      pendingRate: '0.0%',
      partial: 0,
      partialRate: '0.0%',
      quantity: 0,
      cancel: 0,
      cancelRate: '0.0%',
      amount: 0,
    };

    if (dateFilter !== 'all') {
      const lead = relatedDateOrders.length;
      const confirm = relatedDateOrders.filter((o) => isConfirmed(o.status)).length;
      const delivery = relatedDateOrders.filter((o) => isDelivered(o.status, o.courierStatus)).length;
      const pending = relatedDateOrders.filter((o) => isPending(o.status, o.courierStatus)).length;
      const partial = relatedDateOrders.filter((o) => isPartial(o.status, o.courierStatus)).length;
      const cancel = relatedDateOrders.filter((o) => isCancelled(o.status, o.courierStatus)).length;
      const quantity = relatedDateOrders.reduce((sum, o) => sum + (o.quantity || 1), 0);
      const amount = relatedDateOrders.reduce((sum, o) => sum + (o.amount || o.total || 0), 0);

      prodStats = {
        lead,
        confirm,
        confirmRate: lead > 0 ? `${((confirm / lead) * 100).toFixed(1)}%` : '0.0%',
        delivery,
        deliveryRate: confirm > 0 ? `${((delivery / confirm) * 100).toFixed(1)}%` : '0.0%',
        pending,
        pendingRate: lead > 0 ? `${((pending / lead) * 100).toFixed(1)}%` : '0.0%',
        partial,
        partialRate: lead > 0 ? `${((partial / lead) * 100).toFixed(1)}%` : '0.0%',
        quantity,
        cancel,
        cancelRate: lead > 0 ? `${((cancel / lead) * 100).toFixed(1)}%` : '0.0%',
        amount,
      };
    } else if (prod.sheetReport) {
      const lead = prod.sheetReport.overall.lead || allRelatedOrders.length;
      const confirm = prod.sheetReport.overall.confirm;
      const delivery = prod.sheetReport.overall.delivery;
      const pending = prod.sheetReport.overall.pending;
      const partial = prod.sheetReport.overall.partial;
      const quantity = prod.sheetReport.overall.quantity || allRelatedOrders.reduce((sum, o) => sum + (o.quantity || 1), 0);
      const cancel = prod.sheetReport.overall.cancel;
      const amount = allRelatedOrders.reduce((sum, o) => sum + (o.amount || o.total || 0), 0);

      prodStats = {
        lead,
        confirm,
        confirmRate: prod.sheetReport.overall.confirmRate || (lead > 0 ? `${((confirm / lead) * 100).toFixed(1)}%` : '0.0%'),
        delivery,
        deliveryRate: prod.sheetReport.overall.deliveryRate || (confirm > 0 ? `${((delivery / confirm) * 100).toFixed(1)}%` : '0.0%'),
        pending,
        pendingRate: prod.sheetReport.overall.pendingRate || (lead > 0 ? `${((pending / lead) * 100).toFixed(1)}%` : '0.0%'),
        partial,
        partialRate: prod.sheetReport.overall.partialRate || (lead > 0 ? `${((partial / lead) * 100).toFixed(1)}%` : '0.0%'),
        quantity,
        cancel,
        cancelRate: prod.sheetReport.overall.cancelRate || (lead > 0 ? `${((cancel / lead) * 100).toFixed(1)}%` : '0.0%'),
        amount,
      };
    } else {
      const lead = allRelatedOrders.length;
      const confirm = allRelatedOrders.filter((o) => isConfirmed(o.status)).length;
      const delivery = allRelatedOrders.filter((o) => isDelivered(o.status, o.courierStatus)).length;
      const pending = allRelatedOrders.filter((o) => isPending(o.status, o.courierStatus)).length;
      const partial = allRelatedOrders.filter((o) => isPartial(o.status, o.courierStatus)).length;
      const cancel = allRelatedOrders.filter((o) => isCancelled(o.status, o.courierStatus)).length;
      const quantity = allRelatedOrders.reduce((sum, o) => sum + (o.quantity || 1), 0);
      const amount = allRelatedOrders.reduce((sum, o) => sum + (o.amount || o.total || 0), 0);

      prodStats = {
        lead,
        confirm,
        confirmRate: lead > 0 ? `${((confirm / lead) * 100).toFixed(1)}%` : '0.0%',
        delivery,
        deliveryRate: confirm > 0 ? `${((delivery / confirm) * 100).toFixed(1)}%` : '0.0%',
        pending,
        pendingRate: lead > 0 ? `${((pending / lead) * 100).toFixed(1)}%` : '0.0%',
        partial,
        partialRate: lead > 0 ? `${((partial / lead) * 100).toFixed(1)}%` : '0.0%',
        quantity,
        cancel,
        cancelRate: lead > 0 ? `${((cancel / lead) * 100).toFixed(1)}%` : '0.0%',
        amount,
      };
    }

    // Per-source stats
    const sourcesList: {
      name: string;
      lead: number;
      confirm: number;
      confirmRate: string;
      delivery: number;
      deliveryRate: string;
      cancel: number;
      cancelRate: string;
      pending: number;
      pendingRate: string;
      partial: number;
      partialRate: string;
      quantity: number;
      amount: number;
      sharePercent: string;
    }[] = [];

    if (dateFilter !== 'all' || !prod.sheetReport) {
      const activeOrders = dateFilter !== 'all' ? relatedDateOrders : allRelatedOrders;
      const map: Record<string, Order[]> = {};
      activeOrders.forEach((o) => {
        const src = (o.source && o.source.trim()) ? o.source.trim() : 'Website';
        if (!map[src]) map[src] = [];
        map[src].push(o);
      });

      if (prod.sheetReport) {
        prod.sheetReport.sources.forEach((s) => {
          if (!map[s.sourceName]) map[s.sourceName] = [];
        });
      }

      const totalSourceLeads = activeOrders.length || 1;

      Object.entries(map).forEach(([srcName, ords]) => {
        const sLead = ords.length;
        const sConfirm = ords.filter((o) => isConfirmed(o.status)).length;
        const sDel = ords.filter((o) => isDelivered(o.status, o.courierStatus)).length;
        const sCan = ords.filter((o) => isCancelled(o.status, o.courierStatus)).length;
        const sPen = ords.filter((o) => isPending(o.status, o.courierStatus)).length;
        const sPart = ords.filter((o) => isPartial(o.status, o.courierStatus)).length;
        const sQty = ords.reduce((sum, o) => sum + (o.quantity || 1), 0);
        const sAmt = ords.reduce((sum, o) => sum + (o.amount || o.total || 0), 0);

        sourcesList.push({
          name: srcName,
          lead: sLead,
          confirm: sConfirm,
          confirmRate: sLead > 0 ? `${((sConfirm / sLead) * 100).toFixed(1)}%` : '0.0%',
          delivery: sDel,
          deliveryRate: sConfirm > 0 ? `${((sDel / sConfirm) * 100).toFixed(1)}%` : '0.0%',
          cancel: sCan,
          cancelRate: sLead > 0 ? `${((sCan / sLead) * 100).toFixed(1)}%` : '0.0%',
          pending: sPen,
          pendingRate: sLead > 0 ? `${((sPen / sLead) * 100).toFixed(1)}%` : '0.0%',
          partial: sPart,
          partialRate: sLead > 0 ? `${((sPart / sLead) * 100).toFixed(1)}%` : '0.0%',
          quantity: sQty,
          amount: sAmt,
          sharePercent: `${Math.round((sLead / totalSourceLeads) * 100)}%`,
        });
      });
    } else {
      prod.sheetReport.sources.forEach((s) => {
        const sOrders = allRelatedOrders.filter(
          (o) => (o.source || '').toLowerCase().trim() === s.sourceName.toLowerCase().trim()
        );
        const sAmt = sOrders.reduce((sum, o) => sum + (o.amount || o.total || 0), 0);

        sourcesList.push({
          name: s.sourceName,
          lead: s.lead,
          confirm: s.confirm,
          confirmRate: s.confirmRate || (s.lead > 0 ? `${((s.confirm / s.lead) * 100).toFixed(1)}%` : '0.0%'),
          delivery: s.delivery,
          deliveryRate: s.deliveryRate || (s.confirm > 0 ? `${((s.delivery / s.confirm) * 100).toFixed(1)}%` : '0.0%'),
          cancel: s.cancel,
          cancelRate: s.cancelRate || (s.lead > 0 ? `${((s.cancel / s.lead) * 100).toFixed(1)}%` : '0.0%'),
          pending: s.pending,
          pendingRate: s.pendingRate || (s.lead > 0 ? `${((s.pending / s.lead) * 100).toFixed(1)}%` : '0.0%'),
          partial: s.partial,
          partialRate: s.partialRate || (s.lead > 0 ? `${((s.partial / s.lead) * 100).toFixed(1)}%` : '0.0%'),
          quantity: s.quantity,
          amount: sAmt,
          sharePercent: s.sharePercent,
        });
      });
    }

    sourcesList.sort((a, b) => b.lead - a.lead);

    return {
      relatedDateOrders,
      allRelatedOrders,
      prodStats,
      sourcesList,
    };
  };

  // Real-time calculation of total orders and order distribution per product from sheet
  const productOrderDistribution = useMemo(() => {
    const items = unifiedProducts.map((prod) => {
      const { prodStats } = getProductAnalytics(prod);
      const orderCount = prodStats.lead || 0;
      return {
        id: prod.id,
        name: prod.productName,
        orderCount,
      };
    });

    const sumOrders = items.reduce((sum, it) => sum + it.orderCount, 0);

    let totalOrders = 0;
    if (dateFilter !== 'all') {
      totalOrders = dateFilteredOrders.length > 0 ? dateFilteredOrders.length : sumOrders;
    } else {
      totalOrders = sumOrders > 0 ? sumOrders : (aggregatedStats.totalLead || orders.length);
    }

    const effectiveTotal = totalOrders > 0 ? totalOrders : 1;

    const breakdown = items.map((it) => {
      const pct = totalOrders > 0 ? ((it.orderCount / effectiveTotal) * 100).toFixed(1) : '0.0';
      return {
        ...it,
        percentage: `${pct}%`,
        percentNum: totalOrders > 0 ? Math.min(100, (it.orderCount / effectiveTotal) * 100) : 0,
      };
    });

    breakdown.sort((a, b) => b.orderCount - a.orderCount);

    return {
      totalOrders,
      breakdown,
    };
  }, [unifiedProducts, dateFilteredOrders, orders, dateFilter, sheetProducts, aggregatedStats]);

  // Get readable label for current date filter
  const getDateFilterLabel = () => {
    if (dateFilter === 'all') return 'সব সময় (All Time)';
    if (dateFilter === 'today') return 'আজ (Today)';
    if (dateFilter === 'yesterday') return 'গতকাল (Yesterday)';
    if (dateFilter === 'last7days') return 'গত ৭ দিন (Last 7 Days)';
    if (dateFilter === 'last30days') return 'গত ৩০ দিন (Last 30 Days)';
    if (dateFilter === 'lastmonth') return 'গত মাস (Last Month)';
    if (dateFilter === 'custom') {
      if (customStartDate && customEndDate) return `${customStartDate} থেকে ${customEndDate}`;
      if (customStartDate) return `${customStartDate} থেকে`;
      if (customEndDate) return `${customEndDate} পর্যন্ত`;
      return 'কাস্টম তারিখ সীমা';
    }
    return `তারিখ: ${dateFilter}`;
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-20">
      {/* Top Action Bar: Realtime Refresh & Date Select */}
      <div className="flex items-center justify-between sm:justify-end gap-2.5 bg-[#12151f] border border-[#1e2436] p-3 sm:p-4 rounded-xl shadow-lg">
        {/* Refresh Button */}
        <button
          onClick={() => loadSheet1Data(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1a2030] hover:bg-[#232c42] border border-[#2d3852] text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
          title="শীট ১ থেকে পুনরায় ডেটা রিফ্রেশ করুন"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-pink-400 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'রিফ্রেশ হচ্ছে...' : 'রিয়েলটাইম রিফ্রেশ'}</span>
        </button>

        {/* Date Range & Specific Date Dropdown */}
        <div className="relative">
            <button
              onClick={() => setIsDateMenuOpen(!isDateMenuOpen)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#161a26] hover:bg-[#1f2536] border border-pink-500/30 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <Calendar className="w-3.5 h-3.5 text-pink-400" />
              <span>{getDateFilterLabel()}</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>

            {isDateMenuOpen && (
              <>
                {/* Backdrop to close when clicking outside */}
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsDateMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-[#161a26] border border-[#273046] rounded-2xl shadow-2xl p-2.5 z-40 animate-fadeIn space-y-2">
                  <div className="px-2 py-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-[#20273a] flex items-center justify-between">
                    <span>তারিখ নির্বাচন করুন (Date Filter)</span>
                    <span className="text-[10px] text-pink-400 font-mono">লাইভ ডাটা</span>
                  </div>

                  {/* Preset Options requested: ALL TIME, TODAY, YESTERDAY, LAST 7 DAYS, LAST 30 DAYS, LAST MONTH */}
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => {
                        setDateFilter('all');
                        setIsDateMenuOpen(false);
                      }}
                      className={`text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all ${
                        dateFilter === 'all'
                          ? 'bg-pink-600/20 text-pink-400 font-bold border border-pink-500/30'
                          : 'text-gray-300 hover:bg-[#20273a]'
                      }`}
                    >
                      <span>সব সময় (All Time)</span>
                      <span className="text-[10px] text-gray-500 font-mono">{orders.length}</span>
                    </button>

                    <button
                      onClick={() => {
                        setDateFilter('today');
                        setIsDateMenuOpen(false);
                      }}
                      className={`text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all ${
                        dateFilter === 'today'
                          ? 'bg-pink-600/20 text-pink-400 font-bold border border-pink-500/30'
                          : 'text-gray-300 hover:bg-[#20273a]'
                      }`}
                    >
                      <span>আজ (Today)</span>
                      <span className="text-[10px] text-emerald-400 font-mono">●</span>
                    </button>

                    <button
                      onClick={() => {
                        setDateFilter('yesterday');
                        setIsDateMenuOpen(false);
                      }}
                      className={`text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all ${
                        dateFilter === 'yesterday'
                          ? 'bg-pink-600/20 text-pink-400 font-bold border border-pink-500/30'
                          : 'text-gray-300 hover:bg-[#20273a]'
                      }`}
                    >
                      <span>গতকাল (Yesterday)</span>
                    </button>

                    <button
                      onClick={() => {
                        setDateFilter('last7days');
                        setIsDateMenuOpen(false);
                      }}
                      className={`text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all ${
                        dateFilter === 'last7days'
                          ? 'bg-pink-600/20 text-pink-400 font-bold border border-pink-500/30'
                          : 'text-gray-300 hover:bg-[#20273a]'
                      }`}
                    >
                      <span>গত ৭ দিন (7 Days)</span>
                    </button>

                    <button
                      onClick={() => {
                        setDateFilter('last30days');
                        setIsDateMenuOpen(false);
                      }}
                      className={`text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all ${
                        dateFilter === 'last30days'
                          ? 'bg-pink-600/20 text-pink-400 font-bold border border-pink-500/30'
                          : 'text-gray-300 hover:bg-[#20273a]'
                      }`}
                    >
                      <span>গত ৩০ দিন (30 Days)</span>
                    </button>

                    <button
                      onClick={() => {
                        setDateFilter('lastmonth');
                        setIsDateMenuOpen(false);
                      }}
                      className={`text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all ${
                        dateFilter === 'lastmonth'
                          ? 'bg-pink-600/20 text-pink-400 font-bold border border-pink-500/30'
                          : 'text-gray-300 hover:bg-[#20273a]'
                      }`}
                    >
                      <span>গত মাস (Last Month)</span>
                    </button>
                  </div>

                  {/* Manually Select Date from Date to Date (কাস্টম তারিখ সীমা) */}
                  <div className="px-2 pt-2 border-t border-[#20273a] space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">
                      তারিখ থেকে তারিখ (Date Range):
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[9px] text-gray-400 block mb-0.5">শুরু (From):</span>
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="w-full bg-[#10131c] border border-[#273046] rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-pink-500"
                        />
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-400 block mb-0.5">শেষ (To):</span>
                        <input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="w-full bg-[#10131c] border border-[#273046] rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-pink-500"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (customStartDate || customEndDate) {
                          setDateFilter('custom');
                          setIsDateMenuOpen(false);
                        }
                      }}
                      disabled={!customStartDate && !customEndDate}
                      className="w-full py-1.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow"
                    >
                      ফিল্টার প্রয়োগ করুন
                    </button>
                  </div>

                  {/* Dates From Sheet */}
                  {availableDates.length > 0 && (
                    <div className="pt-1.5 border-t border-[#20273a]">
                      <div className="px-2 py-0.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                        শীট থেকে নির্দিষ্ট তারিখ:
                      </div>
                      <div className="max-h-28 overflow-y-auto space-y-0.5 mt-1 pr-1">
                        {availableDates.map((dt, dtIdx) => {
                          const count = orders.filter((o) => o.date?.trim() === dt).length;
                          return (
                            <button
                              key={`dt-${dt}-${dtIdx}`}
                              onClick={() => {
                                setDateFilter(dt);
                                setIsDateMenuOpen(false);
                              }}
                              className={`w-full text-left px-2 py-1 rounded-lg text-xs flex items-center justify-between hover:bg-[#20273a] transition-colors ${
                                dateFilter === dt ? 'text-pink-400 font-bold bg-pink-500/10' : 'text-gray-300'
                              }`}
                            >
                              <span>{dt}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1e2434] text-purple-300 font-mono">
                                {count} টি
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

      {/* 6 Main KPI Cards: Confirm | Delivery | Pending | Partial | Quantity | Cancel */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-wide">
              📊 পারফরম্যান্স সামারি ডাটা বক্স ({getDateFilterLabel()})
            </span>
            {dateFilter !== 'all' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                ফিল্টার সক্রিয়
              </span>
            )}
          </div>
          {dateFilter !== 'all' && (
            <button
              onClick={() => setDateFilter('all')}
              className="text-xs text-pink-400 hover:text-pink-300 underline font-medium"
            >
              সব তারিখের ডাটা দেখুন
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          {/* 1. Confirm */}
          <div className="bg-[#12151f] border border-[#1e2436] rounded-2xl p-3 sm:p-4 relative overflow-hidden group hover:border-pink-500/40 transition-all shadow-md">
            <div className="flex items-center justify-between text-xs font-medium text-gray-400">
              <span className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-pink-500 shrink-0" />
                Confirm
              </span>
              <div className="w-7 h-7 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black text-pink-400 tracking-tight font-mono">
                {aggregatedStats.totalConfirm} <span className="text-xs font-semibold text-gray-400">টি</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-1 truncate">
                রেট: <strong className="text-pink-300">{cleanRate(aggregatedStats.confirmRate)}</strong>
              </div>
            </div>
          </div>

          {/* 2. Delivery */}
          <div className="bg-[#12151f] border border-[#1e2436] rounded-2xl p-3 sm:p-4 relative overflow-hidden group hover:border-emerald-500/40 transition-all shadow-md">
            <div className="flex items-center justify-between text-xs font-medium text-gray-400">
              <span className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                Delivery
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <Truck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight font-mono">
                {aggregatedStats.totalDelivery} <span className="text-xs font-semibold text-gray-400">টি</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-1 truncate">
                সাকসেস: <strong className="text-emerald-300">{cleanRate(aggregatedStats.deliveryRate)}</strong>
              </div>
            </div>
          </div>

          {/* 3. Pending */}
          <div className="bg-[#12151f] border border-[#1e2436] rounded-2xl p-3 sm:p-4 relative overflow-hidden group hover:border-amber-500/40 transition-all shadow-md">
            <div className="flex items-center justify-between text-xs font-medium text-gray-400">
              <span className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                Pending
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight font-mono">
                {aggregatedStats.totalPending} <span className="text-xs font-semibold text-gray-400">টি</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-1 truncate">
                পেন্ডিং: <strong className="text-amber-300">{cleanRate(aggregatedStats.pendingRate)}</strong>
              </div>
            </div>
          </div>

          {/* 4. Partial */}
          <div className="bg-[#12151f] border border-[#1e2436] rounded-2xl p-3 sm:p-4 relative overflow-hidden group hover:border-orange-500/40 transition-all shadow-md">
            <div className="flex items-center justify-between text-xs font-medium text-gray-400">
              <span className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                Partial
              </span>
              <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black text-orange-400 tracking-tight font-mono">
                {aggregatedStats.totalPartial} <span className="text-xs font-semibold text-gray-400">টি</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-1 truncate">
                পার্শিয়াল: <strong className="text-orange-300">{cleanRate(aggregatedStats.partialRate)}</strong>
              </div>
            </div>
          </div>

          {/* 5. Quantity */}
          <div className="bg-[#12151f] border border-[#1e2436] rounded-2xl p-3 sm:p-4 relative overflow-hidden group hover:border-cyan-500/40 transition-all shadow-md">
            <div className="flex items-center justify-between text-xs font-medium text-gray-400">
              <span className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                Quantity
              </span>
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-300 shrink-0">
                <Package className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black text-cyan-300 tracking-tight font-mono">
                {aggregatedStats.totalQuantity} <span className="text-xs font-semibold text-gray-400">পিস</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-1 truncate">
                আইটেম: <strong className="text-cyan-200">মোট পিস</strong>
              </div>
            </div>
          </div>

          {/* 6. Cancel */}
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3 sm:p-4 relative overflow-hidden group hover:border-rose-400/50 transition-all shadow-md">
            <div className="flex items-center justify-between text-xs font-medium text-rose-300">
              <span className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                Cancel
              </span>
              <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-300 shrink-0">
                <Ban className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black text-rose-300 tracking-tight font-mono">
                {aggregatedStats.totalCancel} <span className="text-xs font-semibold text-rose-200">টি</span>
              </div>
              <div className="text-[11px] text-gray-300 mt-1 truncate">
                ক্যান্সেল: <strong className="text-rose-200">{cleanRate(aggregatedStats.cancelRate)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Filter Pills & Search Bar */}
      <div className="bg-[#12151f] border border-[#1e2436] p-3.5 sm:p-4 rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1.5 bg-[#0e1017] p-1 rounded-xl border border-[#1e2436]">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'products'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              প্রোডাক্ট কার্ড বক্স ({filteredProducts.length})
            </button>
            <button
              onClick={() => setActiveTab('sources')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'sources'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              সামগ্রিক সোর্স এনালিটিক্স
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="প্রোডাক্ট বা সোর্স খুঁজুন..."
              className="w-full bg-[#161a26] border border-[#242c40] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Main Tab View 1: প্রতিটা প্রোডাক্ট এর জন্য আলাদা কার্ড বক্স ও সোর্স ডাটা পেজ */}
      {activeTab === 'products' && (
        selectedDetailProductId && selectedProductDetail ? (
          /* ========================================================
             NEW PAGE: সোর্স ডাটা পেজ (কার্ডে ক্লিক করলেই এই পেজ ওপেন হবে)
             ======================================================== */
          (() => {
            const { relatedDateOrders, prodStats, sourcesList } = getProductAnalytics(selectedProductDetail);

            return (
              <div className="space-y-4">
                {/* Dedicated Page Header with Back Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#12151f] border border-[#1e2436] p-3 sm:p-4 rounded-xl shadow-lg">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedDetailProductId(null)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a2133] hover:bg-pink-600 border border-[#27324c] hover:border-pink-500 text-white text-xs font-bold shadow-sm transition-all group"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                      <span>← সব প্রোডাক্টে ফিরে যান</span>
                    </button>
                    <div className="h-5 w-px bg-[#262f44]" />
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-600/20 via-purple-600/20 to-blue-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400 font-bold text-xs shadow-inner">
                        {selectedProductDetail.productName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                          {selectedProductDetail.productName}
                        </h3>
                        <p className="text-[10px] text-gray-400">
                          সোর্স ডাটা ও সেলস পারফরম্যান্স বিস্তারিত বিবরণ
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] px-2.5 py-1 rounded-lg bg-pink-500/15 text-pink-300 border border-pink-500/30 font-semibold font-mono">
                      {getDateFilterLabel()}
                    </span>
                    <button
                      onClick={() => loadSheet1Data(true)}
                      disabled={refreshing}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1a2030] hover:bg-[#232c42] border border-[#2d3852] text-white text-[11px] font-semibold shadow-sm transition-all disabled:opacity-50"
                      title="শীট ১ থেকে পুনরায় ডেটা রিফ্রেশ করুন"
                    >
                      <RefreshCw className={`w-3 h-3 text-pink-400 ${refreshing ? 'animate-spin' : ''}`} />
                      <span>{refreshing ? 'রিফ্রেশ হচ্ছে...' : 'রিয়েলটাইম রিফ্রেশ'}</span>
                    </button>
                  </div>
                </div>

                {/* Product Overall Summary 7-Box Performance */}
                <div className="bg-[#12151f] border border-[#1e2436] rounded-xl p-3 sm:p-3.5 shadow-md space-y-2">
                  <div className="text-[11px] font-bold text-gray-300 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-purple-400" />
                      {selectedProductDetail.productName} এর সামগ্রিক পারফরম্যান্স ({getDateFilterLabel()}):
                    </span>
                    {prodStats.amount > 0 && (
                      <span className="text-emerald-400 font-mono text-[11px] font-semibold">
                        মোট বিক্রয়: ৳{prodStats.amount.toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2">
                    {/* 1. Confirm */}
                    <div className="bg-[#141824] border border-[#20283c] rounded-lg py-1 px-1.5 text-center flex flex-col justify-center min-h-[42px]">
                      <span className="text-[10px] text-gray-400 font-medium block truncate">Confirm</span>
                      <span className="text-xs sm:text-[13px] font-bold text-pink-400 mt-0.5 font-mono whitespace-nowrap">
                        {prodStats.confirm} <span className="text-[10px] font-normal text-pink-300/80">({cleanRate(prodStats.confirmRate)})</span>
                      </span>
                    </div>

                    {/* 2. Delivery */}
                    <div className="bg-[#141824] border border-[#20283c] rounded-lg py-1 px-1.5 text-center flex flex-col justify-center min-h-[42px]">
                      <span className="text-[10px] text-gray-400 font-medium block truncate">Delivery</span>
                      <span className="text-xs sm:text-[13px] font-bold text-emerald-400 mt-0.5 font-mono whitespace-nowrap">
                        {prodStats.delivery} <span className="text-[10px] font-normal text-emerald-300/80">({cleanRate(prodStats.deliveryRate)})</span>
                      </span>
                    </div>

                    {/* 3. Pending */}
                    <div className="bg-[#141824] border border-[#20283c] rounded-lg py-1 px-1.5 text-center flex flex-col justify-center min-h-[42px]">
                      <span className="text-[10px] text-gray-400 font-medium block truncate">Pending</span>
                      <span className="text-xs sm:text-[13px] font-bold text-amber-400 mt-0.5 font-mono whitespace-nowrap">
                        {prodStats.pending} <span className="text-[10px] font-normal text-amber-300/80">({cleanRate(prodStats.pendingRate)})</span>
                      </span>
                    </div>

                    {/* 4. Partial */}
                    <div className="bg-[#141824] border border-[#20283c] rounded-lg py-1 px-1.5 text-center flex flex-col justify-center min-h-[42px]">
                      <span className="text-[10px] text-gray-400 font-medium block truncate">Partial</span>
                      <span className="text-xs sm:text-[13px] font-bold text-orange-400 mt-0.5 font-mono whitespace-nowrap">
                        {prodStats.partial} <span className="text-[10px] font-normal text-orange-300/80">({cleanRate(prodStats.partialRate)})</span>
                      </span>
                    </div>

                    {/* 5. Quantity */}
                    <div className="bg-[#141824] border border-[#20283c] rounded-lg py-1 px-1.5 text-center flex flex-col justify-center min-h-[42px]">
                      <span className="text-[10px] text-gray-400 font-medium block truncate">Quantity</span>
                      <span className="text-xs sm:text-[13px] font-bold text-cyan-300 mt-0.5 font-mono">{prodStats.quantity}</span>
                    </div>

                    {/* 6. Cancel */}
                    <div className="bg-rose-500/20 border border-rose-500/40 rounded-lg py-1 px-1.5 text-center flex flex-col justify-center min-h-[42px]">
                      <span className="text-[10px] text-rose-300 font-medium block truncate">Cancel</span>
                      <span className="text-xs sm:text-[13px] font-bold text-rose-300 mt-0.5 font-mono whitespace-nowrap">
                        {prodStats.cancel} <span className="text-[10px] font-normal text-rose-200">({cleanRate(prodStats.cancelRate)})</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* INDIVIDUAL SOURCE DATA BOXES (প্রত্যেকটা সোর্সের জন্য আলাদা আলাদা চিকন ডাটা বক্স) */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-1 border-b border-[#1e2436]">
                    <div className="flex items-center gap-1.5">
                      <Share2 className="w-3.5 h-3.5 text-pink-400" />
                      <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                        সোর্স ভিত্তিক আলাদা আলাদা ডাটা ({selectedProductDetail.productName}):
                      </h4>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">
                      মোট {sourcesList.length} টি সোর্স থেকে প্রাপ্ত ডাটা
                    </span>
                  </div>

                  {sourcesList.length === 0 ? (
                    <div className="p-6 text-center text-gray-500 text-xs bg-[#10131d] border border-[#1b2234] rounded-xl">
                      সিলেক্টেড ডেটে এই প্রোডাক্টের কোনো সোর্স ডাটা পাওয়া যায়নি।
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5">
                      {sourcesList.map((src, srcIdx) => (
                        <div
                          key={srcIdx}
                          className="bg-[#121622] border border-[#20293d] hover:border-pink-500/40 rounded-xl p-2.5 sm:p-3 transition-all shadow-sm space-y-2"
                        >
                          {/* Source Header */}
                          <div className="flex items-center justify-between pb-1.5 border-b border-[#1a2133]">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-md bg-[#1a2133] border border-[#2a3754] flex items-center justify-center">
                                {getSourceIcon(src.name)}
                              </div>
                              <div className="flex items-center gap-2">
                                <h6 className="text-xs sm:text-sm font-bold text-white">
                                  {src.name}
                                </h6>
                                <span className="text-[10px] text-gray-400 font-mono">
                                  • শেয়ার: {src.sharePercent} {src.amount > 0 && `• ৳${src.amount.toLocaleString()}`}
                                </span>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/15 text-pink-300 border border-pink-500/30 font-mono">
                              {src.lead} Leads
                            </span>
                          </div>

                          {/* 6 Sleek Source Metric Boxes */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2">
                            {/* 1. Confirm */}
                            <div className="bg-[#0b0e16] border border-[#1a2236] rounded-lg py-1 px-1.5 text-center flex flex-col justify-center min-h-[40px]">
                              <span className="text-[10px] text-gray-400 font-medium block truncate">Confirm</span>
                              <span className="text-xs sm:text-[13px] font-bold text-pink-400 mt-0.5 font-mono whitespace-nowrap">
                                {src.confirm} <span className="text-[10px] font-normal text-pink-300/80">({cleanRate(src.confirmRate)})</span>
                              </span>
                            </div>

                            {/* 2. Delivery */}
                            <div className="bg-[#0b0e16] border border-[#1a2236] rounded-lg py-1 px-1.5 text-center flex flex-col justify-center min-h-[40px]">
                              <span className="text-[10px] text-gray-400 font-medium block truncate">Delivery</span>
                              <span className="text-xs sm:text-[13px] font-bold text-emerald-400 mt-0.5 font-mono whitespace-nowrap">
                                {src.delivery} <span className="text-[10px] font-normal text-emerald-300/80">({cleanRate(src.deliveryRate)})</span>
                              </span>
                            </div>

                            {/* 3. Pending */}
                            <div className="bg-[#0b0e16] border border-[#1a2236] rounded-lg py-1 px-1.5 text-center flex flex-col justify-center min-h-[40px]">
                              <span className="text-[10px] text-gray-400 font-medium block truncate">Pending</span>
                              <span className="text-xs sm:text-[13px] font-bold text-amber-400 mt-0.5 font-mono whitespace-nowrap">
                                {src.pending} <span className="text-[10px] font-normal text-amber-300/80">({cleanRate(src.pendingRate)})</span>
                              </span>
                            </div>

                            {/* 4. Partial */}
                            <div className="bg-[#0b0e16] border border-[#1a2236] rounded-lg py-1 px-1.5 text-center flex flex-col justify-center min-h-[40px]">
                              <span className="text-[10px] text-gray-400 font-medium block truncate">Partial</span>
                              <span className="text-xs sm:text-[13px] font-bold text-orange-400 mt-0.5 font-mono whitespace-nowrap">
                                {src.partial} <span className="text-[10px] font-normal text-orange-300/80">({cleanRate(src.partialRate)})</span>
                              </span>
                            </div>

                            {/* 5. Quantity */}
                            <div className="bg-[#0b0e16] border border-[#1a2236] rounded-lg py-1 px-1.5 text-center flex flex-col justify-center min-h-[40px]">
                              <span className="text-[10px] text-gray-400 font-medium block truncate">Quantity</span>
                              <span className="text-xs sm:text-[13px] font-bold text-cyan-300 mt-0.5 font-mono">{src.quantity}</span>
                            </div>

                            {/* 6. Cancel */}
                            <div className="bg-rose-500/20 border border-rose-500/40 rounded-lg py-1 px-1.5 text-center flex flex-col justify-center min-h-[40px]">
                              <span className="text-[10px] text-rose-300 font-medium block truncate">Cancel</span>
                              <span className="text-xs sm:text-[13px] font-bold text-rose-300 mt-0.5 font-mono whitespace-nowrap">
                                {src.cancel} <span className="text-[10px] font-normal text-rose-200">({cleanRate(src.cancelRate)})</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Related Live Orders List from Sheet 2 */}
                <div className="bg-[#12151f] border border-[#1e2436] rounded-xl p-3 sm:p-4 shadow-md space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h6 className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-purple-400" />
                      {selectedProductDetail.productName} এর রিলেটেড লাইভ অর্ডার ({relatedDateOrders.length} টি)
                    </h6>
                    <span className="text-[10px] text-gray-400 font-mono">
                      তারিখ: {getDateFilterLabel()}
                    </span>
                  </div>

                  {relatedDateOrders.length === 0 ? (
                    <div className="bg-[#0d1017] border border-[#1f2638] rounded-lg p-3 text-center text-gray-500 text-xs">
                      সিলেক্টেড ডেটে এই প্রোডাক্টের সাথে মিলে যাওয়া কোনো লাইভ অর্ডার Sheet 2 তে নেই।
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-[#1f2638] bg-[#0d1017]">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-[#1c2336] bg-[#141926] text-gray-400">
                            <th className="py-2 px-2.5 font-semibold">ইনভয়েস</th>
                            <th className="py-2 px-2.5 font-semibold">গ্রাহক</th>
                            <th className="py-2 px-2.5 font-semibold">ফোন</th>
                            <th className="py-2 px-2.5 font-semibold">ঠিকানা</th>
                            <th className="py-2 px-2.5 font-semibold">সোর্স</th>
                            <th className="py-2 px-2.5 font-semibold">মূল্য</th>
                            <th className="py-2 px-2.5 font-semibold">স্ট্যাটাস</th>
                            <th className="py-2 px-2.5 font-semibold">তারিখ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#181f2f]">
                          {relatedDateOrders.slice(0, 15).map((o, oIdx) => (
                            <tr key={oIdx} className="hover:bg-[#131722] transition-colors">
                              <td className="py-2 px-2.5 font-mono text-pink-400 font-bold">
                                #{o.id}
                              </td>
                              <td className="py-2 px-2.5 font-medium text-white">
                                {o.customerName}
                              </td>
                              <td className="py-2 px-2.5 text-gray-300 font-mono text-[11px]">
                                {o.customerPhone || '—'}
                              </td>
                              <td className="py-2 px-2.5 text-gray-400 truncate max-w-[130px] text-[11px]">
                                {o.customerAddress || '—'}
                              </td>
                              <td className="py-2 px-2.5 text-gray-300 font-semibold text-[11px]">
                                {o.source}
                              </td>
                              <td className="py-2 px-2.5 text-emerald-400 font-mono font-semibold">
                                ৳{o.amount || o.total}
                              </td>
                              <td className="py-2 px-2.5">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                  {o.status}
                                </span>
                              </td>
                              <td className="py-2 px-2.5 text-[10px] text-gray-400 font-mono">
                                {o.date || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Bottom Back Button */}
                <div className="flex justify-center pt-1">
                  <button
                    onClick={() => setSelectedDetailProductId(null)}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#1a2133] hover:bg-pink-600 border border-[#27324c] hover:border-pink-500 text-white text-xs sm:text-sm font-bold shadow-md transition-all group"
                  >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    <span>← সব প্রোডাক্টের তালিকায় ফিরে যান</span>
                  </button>
                </div>
              </div>
            );
          })()
        ) : (
          /* ========================================================
             PRODUCT CARDS LIST (৭টি চিকন বক্স সহ স্লিম ও কমপ্যাক্ট কার্ড)
             ======================================================== */
          <div className="space-y-4">
            {/* Real-time Total Orders & Per-Product Order Share Card */}
            <div className="bg-[#12151f] border border-[#1e2436] rounded-xl p-3.5 sm:p-4 shadow-lg space-y-3">
              {/* Card Top: Total Orders & Date Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-[#1c2233]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight flex items-center gap-2">
                      <span>মোট অর্ডার ও প্রোডাক্ট ভিত্তিক অর্ডার সামারি</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/20 font-mono">
                        Live Sheet Sync
                      </span>
                    </h3>
                    <p className="text-[10px] text-gray-400">
                      গুগল শিট থেকে রিয়েলটাইমে মোট অর্ডার এবং প্রতিটি প্রোডাক্টের অর্ডার ও শতাংশ
                    </p>
                  </div>
                </div>

                {/* Total Orders Counter Box */}
                <div className="flex items-center gap-2.5 bg-[#151926] border border-[#212a40] px-3.5 py-1.5 rounded-xl self-start sm:self-auto">
                  <span className="text-[11px] text-gray-400 font-medium">মোট অর্ডার:</span>
                  <span className="text-sm sm:text-base font-bold text-pink-400 font-mono">
                    {productOrderDistribution.totalOrders} টি
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono hidden sm:inline">
                    ({getDateFilterLabel()})
                  </span>
                </div>
              </div>

              {/* Product Breakdown Grid: কোন প্রোডাক্ট এ কয়টা অর্ডার এসেছে এবং পার্সেন্টেজ */}
              {productOrderDistribution.breakdown.length === 0 ? (
                <div className="text-center py-3 text-xs text-gray-500">
                  কোনো প্রোডাক্টের অর্ডার ডাটা পাওয়া যায়নি।
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-2.5">
                  {productOrderDistribution.breakdown.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedDetailProductId(item.id)}
                      className="bg-[#141824] hover:bg-[#181d2c] border border-[#20283c] hover:border-pink-500/40 rounded-xl p-2.5 sm:p-3 transition-all cursor-pointer group shadow-sm flex flex-col justify-between space-y-2"
                      title="বিস্তারিত সোর্স ডাটা দেখতে ক্লিক করুন"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-pink-600/20 to-purple-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400 font-bold text-[10px] shrink-0">
                            {item.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-xs font-bold text-white group-hover:text-pink-300 transition-colors truncate" title={item.name}>
                            {item.name}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-pink-400 font-mono px-2 py-0.5 rounded-md bg-pink-500/10 border border-pink-500/20 shrink-0">
                          {item.percentage}
                        </span>
                      </div>

                      {/* Orders Count and Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 mb-1">
                          <span className="text-gray-400 text-[10px]">অর্ডার সংখ্যা:</span>
                          <span className="font-bold text-white text-xs">
                            {item.orderCount} টি ({item.percentage})
                          </span>
                        </div>
                        <div className="w-full bg-[#1e2536] rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-pink-500 to-purple-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(item.percentNum > 0 ? 4 : 0, item.percentNum)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                <Package className="w-4 h-4 text-purple-400" />
                প্রোডাক্ট ভিত্তিক আলাদা কার্ড বক্স ({filteredProducts.length} টি)
              </h3>
              <span className="text-[11px] text-pink-400 font-medium hidden sm:inline-block">
                💡 যে কোনো কার্ডে ক্লিক করলে সোর্স ডাটা পেজ দেখতে পাবেন
              </span>
            </div>

            {loading ? (
              <div className="bg-[#12151f] border border-[#1e2436] rounded-xl p-10 text-center">
                <RefreshCw className="w-7 h-7 text-purple-400 animate-spin mx-auto mb-2" />
                <p className="text-xs text-gray-300 font-medium">প্রোডাক্ট ও শিট রিপোর্ট ডাটা লোড হচ্ছে...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="bg-[#12151f] border border-[#1e2436] rounded-xl p-6 text-center text-gray-400 text-xs">
                কোনো প্রোডাক্ট পাওয়া যায়নি।
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {filteredProducts.map((prod) => {
                  const { prodStats, sourcesList } = getProductAnalytics(prod);

                  // Extract active sources with orders
                  const activeSources = sourcesList
                    .filter((s) => s.lead > 0)
                    .map((s, sIdx) => ({
                      ...s,
                      color: getSourceColor(s.name, sIdx),
                    }));

                  const totalOrders = prodStats.lead || activeSources.reduce((sum, s) => sum + s.lead, 0);

                  const displaySources = activeSources.length > 0
                    ? activeSources
                    : totalOrders > 0
                    ? [{ name: 'Website', lead: totalOrders, color: '#3b82f6', sharePercent: '100%' }]
                    : [];

                  return (
                    <div
                      key={prod.id}
                      onClick={() => setSelectedDetailProductId(prod.id)}
                      className="bg-[#12151f] border border-[#1e2436] hover:border-pink-500/60 rounded-xl p-2.5 sm:p-3 transition-all shadow-md hover:shadow-xl hover:shadow-pink-500/10 cursor-pointer group space-y-2.5"
                    >
                      {/* কার্ড হেডার: মিনিমাল ও কমপ্যাক্ট, কোনো ছোট বাটন ছাড়া */}
                      <div className="flex items-center justify-between gap-2 border-b border-[#1c2232] pb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-600/20 via-purple-600/20 to-blue-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400 font-bold text-xs shadow-inner flex-shrink-0 group-hover:scale-105 transition-transform">
                            {prod.productName.slice(0, 2).toUpperCase()}
                          </div>
                          <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight group-hover:text-pink-300 transition-colors truncate">
                            {prod.productName}
                          </h4>
                          <span className="text-[10px] text-gray-400 hidden sm:inline-block font-mono">
                            • {getDateFilterLabel()}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-400 text-[11px] font-semibold group-hover:bg-pink-500 group-hover:text-white transition-all flex-shrink-0">
                          <span>সোর্স ডাটা</span>
                          <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>

                      {/* সোর্স ভিত্তিক অর্ডার রাউন্ড চার্ট ও ব্রেকডাউন (Source Orders Round Chart) */}
                      <div className="bg-[#0b0e17] border border-[#192032] rounded-xl p-2.5 flex flex-col sm:flex-row items-center gap-3">
                        {/* Round Donut Chart */}
                        <div className="relative w-20 h-20 sm:w-22 sm:h-22 shrink-0 flex items-center justify-center">
                          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                            {/* Background Track */}
                            <circle
                              cx="50"
                              cy="50"
                              r="38"
                              stroke="#181f2f"
                              strokeWidth="12"
                              fill="transparent"
                            />
                            {/* Source Slices */}
                            {(() => {
                              if (totalOrders === 0 || displaySources.length === 0) return null;
                              let accumulatedPercent = 0;
                              const circumference = 2 * Math.PI * 38; // ~238.76
                              return displaySources.map((s, idx) => {
                                const percent = (s.lead / totalOrders) * 100;
                                const dashLength = (percent / 100) * circumference;
                                const dashOffset = -((accumulatedPercent / 100) * circumference);
                                accumulatedPercent += percent;
                                return (
                                  <circle
                                    key={idx}
                                    cx="50"
                                    cy="50"
                                    r="38"
                                    stroke={s.color}
                                    strokeWidth="12"
                                    strokeDasharray={`${dashLength} ${circumference}`}
                                    strokeDashoffset={`${dashOffset}`}
                                    fill="transparent"
                                    className="transition-all duration-700"
                                  />
                                );
                              });
                            })()}
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                            <span className="text-xs sm:text-sm font-black text-white font-mono leading-none">
                              {totalOrders}
                            </span>
                            <span className="text-[9px] text-gray-400 font-medium mt-0.5 leading-none">
                              অর্ডার
                            </span>
                          </div>
                        </div>

                        {/* Source breakdown legend & order counts */}
                        <div className="flex-1 w-full min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-semibold text-gray-300 flex items-center gap-1.5">
                              <PieChart className="w-3.5 h-3.5 text-pink-400" />
                              <span>সোর্স অনুযায়ী অর্ডার (রাউন্ড চার্ট)</span>
                            </span>
                            <span className="text-[10px] text-pink-400 font-mono font-medium">
                              মোট {totalOrders} টি
                            </span>
                          </div>

                          {displaySources.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                              {displaySources.map((s, idx) => {
                                const percent = totalOrders > 0 ? Math.round((s.lead / totalOrders) * 100) : 0;
                                return (
                                  <div
                                    key={idx}
                                    className="bg-[#121624] border border-[#1d2538] hover:border-pink-500/30 rounded-lg px-2 py-1 flex items-center justify-between gap-1.5 text-[11px] min-w-0 transition-colors"
                                    title={`${s.name}: ${s.lead}টি অর্ডার (${percent}%)`}
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                                      <span
                                        className="w-2 h-2 rounded-full shrink-0 shadow-xs"
                                        style={{ backgroundColor: s.color }}
                                      />
                                      <span className="text-gray-300 truncate font-medium text-[10.5px]">
                                        {s.name}
                                      </span>
                                    </div>
                                    <span className="font-mono font-bold text-white shrink-0 text-[10.5px]">
                                      {s.lead} <span className="text-[9px] text-gray-400 font-normal">({percent}%)</span>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-[11px] text-gray-400 italic py-1 bg-[#121624] rounded-lg px-2.5 text-center border border-[#1d2538]">
                              এই প্রোডাক্টে নির্বাচিত সময়ে কোনো সোর্স অর্ডার পাওয়া যায়নি।
                            </div>
                          )}
                        </div>
                      </div>

                      {/* কার্ডের ৬টি চিকন ডাটা বক্স (Confirm | Delivery | Pending | Partial | Quantity | Cancel) */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2">
                        {/* 1. Confirm */}
                        <div className="bg-[#141824] border border-[#20283c] group-hover:border-pink-500/30 rounded-lg py-1 px-1.5 text-center flex flex-col justify-center transition-all min-h-[42px]">
                          <span className="text-[10px] text-gray-400 font-medium block truncate">Confirm</span>
                          <span className="text-xs sm:text-[13px] font-bold text-pink-400 mt-0.5 font-mono whitespace-nowrap">
                            {prodStats.confirm} <span className="text-[10px] font-normal text-pink-300/80">({cleanRate(prodStats.confirmRate)})</span>
                          </span>
                        </div>

                        {/* 2. Delivery */}
                        <div className="bg-[#141824] border border-[#20283c] group-hover:border-emerald-500/30 rounded-lg py-1 px-1.5 text-center flex flex-col justify-center transition-all min-h-[42px]">
                          <span className="text-[10px] text-gray-400 font-medium block truncate">Delivery</span>
                          <span className="text-xs sm:text-[13px] font-bold text-emerald-400 mt-0.5 font-mono whitespace-nowrap">
                            {prodStats.delivery} <span className="text-[10px] font-normal text-emerald-300/80">({cleanRate(prodStats.deliveryRate)})</span>
                          </span>
                        </div>

                        {/* 3. Pending */}
                        <div className="bg-[#141824] border border-[#20283c] group-hover:border-amber-500/30 rounded-lg py-1 px-1.5 text-center flex flex-col justify-center transition-all min-h-[42px]">
                          <span className="text-[10px] text-gray-400 font-medium block truncate">Pending</span>
                          <span className="text-xs sm:text-[13px] font-bold text-amber-400 mt-0.5 font-mono whitespace-nowrap">
                            {prodStats.pending} <span className="text-[10px] font-normal text-amber-300/80">({cleanRate(prodStats.pendingRate)})</span>
                          </span>
                        </div>

                        {/* 4. Partial */}
                        <div className="bg-[#141824] border border-[#20283c] group-hover:border-orange-500/30 rounded-lg py-1 px-1.5 text-center flex flex-col justify-center transition-all min-h-[42px]">
                          <span className="text-[10px] text-gray-400 font-medium block truncate">Partial</span>
                          <span className="text-xs sm:text-[13px] font-bold text-orange-400 mt-0.5 font-mono whitespace-nowrap">
                            {prodStats.partial} <span className="text-[10px] font-normal text-orange-300/80">({cleanRate(prodStats.partialRate)})</span>
                          </span>
                        </div>

                        {/* 5. Quantity */}
                        <div className="bg-[#141824] border border-[#20283c] group-hover:border-cyan-500/30 rounded-lg py-1 px-1.5 text-center flex flex-col justify-center transition-all min-h-[42px]">
                          <span className="text-[10px] text-gray-400 font-medium block truncate">Quantity</span>
                          <span className="text-xs sm:text-[13px] font-bold text-cyan-300 mt-0.5 font-mono">
                            {prodStats.quantity}
                          </span>
                        </div>

                        {/* 6. Cancel */}
                        <div className="bg-rose-500/20 border border-rose-500/40 group-hover:border-rose-400/60 rounded-lg py-1 px-1.5 text-center flex flex-col justify-center transition-all min-h-[42px]">
                          <span className="text-[10px] text-rose-300 font-medium block truncate">Cancel</span>
                          <span className="text-xs sm:text-[13px] font-bold text-rose-300 mt-0.5 font-mono whitespace-nowrap">
                            {prodStats.cancel} <span className="text-[10px] font-normal text-rose-200">({cleanRate(prodStats.cancelRate)})</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )
      )}

      {/* Main Tab View 2: Sales Source Analytics & Comparison Chart */}
      {activeTab === 'sources' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Source Matrix */}
          <div className="lg:col-span-7 bg-[#12151f] border border-[#1e2436] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-pink-500" />
                সেলস সোর্স অনুযায়ী সামগ্রিক পারফরম্যান্স
              </h3>
              <span className="text-xs text-gray-400">Sheet 1 থেকে চ্যানেল পরিসংখ্যান</span>
            </div>

            <div className="space-y-3">
              {sourceAnalytics.map((src, i) => (
                <div
                  key={i}
                  className="bg-[#0e1119] border border-[#1e2436] rounded-xl p-3.5 hover:border-[#2d3852] transition-all"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: src.color }}
                      />
                      <span className="text-xs font-bold text-white">{src.name}</span>
                      <span className="text-[10px] px-2 py-0.2 rounded-full bg-[#171c2a] text-pink-300 border border-pink-500/20 font-mono">
                        {src.percentage}% শেয়ার
                      </span>
                    </div>
                    <div className="text-xs font-bold text-gray-200">
                      লিড: <strong className="text-white">{src.lead}</strong> টি
                    </div>
                  </div>

                  {/* Metrics Bar for this source */}
                  <div className="grid grid-cols-4 gap-2 text-[11px] text-gray-400 pt-2 border-t border-[#181d2c]">
                    <div>
                      কনফার্ম:{' '}
                      <span className="text-purple-300 font-bold">{src.confirm}</span>
                    </div>
                    <div>
                      ডেলিভারি:{' '}
                      <span className="text-emerald-400 font-bold">{src.delivery}</span>
                    </div>
                    <div>
                      কোয়ান্টিটি:{' '}
                      <span className="text-blue-300 font-bold">{src.quantity}</span>
                    </div>
                    <div className="bg-rose-500/20 border border-rose-500/30 rounded px-1.5 py-0.5">
                      <span className="text-rose-300">ক্যান্সেল: </span>
                      <span className="text-rose-200 font-bold">{src.cancel}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: SVG Donut Chart for Sources */}
          <div className="lg:col-span-5 bg-[#12151f] border border-[#1e2436] rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                সোর্স শেয়ার পাই-চার্ট (Sheet 1)
              </h3>

              <div className="flex flex-col items-center justify-center py-4">
                <div className="relative w-44 h-44">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      stroke="#1a2030"
                      strokeWidth="14"
                      fill="transparent"
                    />
                    {(() => {
                      let accumulatedPercent = 0;
                      return sourceAnalytics.map((s, idx) => {
                        const dashLength = s.percentage * 2.387;
                        const dashOffset = -(accumulatedPercent * 2.387);
                        accumulatedPercent += s.percentage;
                        return (
                          <circle
                            key={idx}
                            cx="50"
                            cy="50"
                            r="38"
                            stroke={s.color}
                            strokeWidth="14"
                            strokeDasharray={`${dashLength} 300`}
                            strokeDashoffset={`${dashOffset}`}
                            fill="transparent"
                            className="transition-all duration-1000"
                          />
                        );
                      });
                    })()}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-white">
                      {aggregatedStats.totalLead}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">মোট লিড</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Donut Legend */}
            <div className="space-y-2 pt-4 border-t border-[#1c2232] text-xs">
              {sourceAnalytics.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-gray-300">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.name}</span>
                  </div>
                  <span className="font-mono text-gray-400">
                    {item.percentage}% ({item.lead} টি)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
