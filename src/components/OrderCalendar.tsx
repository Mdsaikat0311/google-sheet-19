import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  X,
  Clock,
  LayoutGrid,
  ListFilter,
} from 'lucide-react';
import { Order } from '../types';
import { parseAnyDateToTimestamp } from '../utils/dateGrouping';

interface OrderCalendarProps {
  orders: Order[];
  onSelectDate?: (dateStr: string) => void;
  onSelectOrder?: (order: Order) => void;
}

export const OrderCalendar: React.FC<OrderCalendarProps> = ({
  orders,
  onSelectDate,
  onSelectOrder,
}) => {
  // Calendar month/year navigation state
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [productFilter, setProductFilter] = useState<string>('ALL');
  // View mode toggle for mobile: 'grid' (Calendar Grid) or 'agenda' (Compact Date List)
  const [viewMode, setViewMode] = useState<'grid' | 'agenda'>('grid');

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    const dayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate()
    ).padStart(2, '0')}`;
    setSelectedDayKey(dayKey);
  };

  // Distinct products from orders for filtering
  const availableProducts = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      const p = (o.variant && o.variant !== 'No Sellect' ? o.variant : o.product) || '';
      if (p.trim()) set.add(p.trim());
    });
    return Array.from(set);
  }, [orders]);

  // Map orders by YYYY-MM-DD
  const { dateOrderMap, totalOrdersCount, activeDateList } = useMemo(() => {
    const map = new Map<string, { count: number; totalAmount: number; orders: Order[]; productBreakdown: Record<string, number>; dateObj: Date }>();
    let totalCount = 0;

    orders.forEach((order) => {
      // Check product filter
      const prodName = (order.variant && order.variant !== 'No Sellect' ? order.variant : order.product) || '';
      if (productFilter !== 'ALL') {
        const match =
          prodName.toLowerCase().includes(productFilter.toLowerCase()) ||
          productFilter.toLowerCase().includes(prodName.toLowerCase());
        if (!match) return;
      }

      const raw = order.rawDate || order.date;
      const { dateObj } = parseAnyDateToTimestamp(raw);
      if (!dateObj || isNaN(dateObj.getTime())) return;

      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${d}`;

      totalCount++;

      const existing = map.get(key) || {
        count: 0,
        totalAmount: 0,
        orders: [],
        productBreakdown: {},
        dateObj,
      };

      existing.count += 1;
      existing.totalAmount += Number(order.amount || order.total || 0);
      existing.orders.push(order);

      const pKey = prodName || 'Unknown';
      existing.productBreakdown[pKey] = (existing.productBreakdown[pKey] || 0) + 1;

      map.set(key, existing);
    });

    // Sorted active date list for agenda view
    const sortedList = Array.from(map.entries()).sort((a, b) => {
      return b[1].dateObj.getTime() - a[1].dateObj.getTime();
    });

    return { dateOrderMap: map, totalOrdersCount: totalCount, activeDateList: sortedList };
  }, [orders, productFilter]);

  // Calendar grid math
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0 - 11

  const monthNamesBn = [
    'জানুয়ারি',
    'ফেব্রুয়ারি',
    'মার্চ',
    'এপ্রিল',
    'মে',
    'জুন',
    'জুলাই',
    'আগস্ট',
    'সেপ্টেম্বর',
    'অক্টোবর',
    'নভেম্বর',
    'ডিসেম্বর',
  ];

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon ...
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // English weekday headers (Sun, Mon, Tue, Wed, Thu, Fri, Sat)
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekDaysShort = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Current today key
  const todayObj = new Date();
  const todayKey = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(
    todayObj.getDate()
  ).padStart(2, '0')}`;

  // Currently selected date details
  const selectedDetails = selectedDayKey ? dateOrderMap.get(selectedDayKey) : null;

  // Month-wise min and max order statistics for dynamic color grading & peak order display
  const monthStats = useMemo(() => {
    let minCount = Infinity;
    let maxCount = 0;
    let hasOrders = false;
    let peakDays: number[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const monthStr = String(month + 1).padStart(2, '0');
      const key = `${year}-${monthStr}-${dayStr}`;
      const dayData = dateOrderMap.get(key);
      const count = dayData?.count || 0;
      if (count > 0) {
        hasOrders = true;
        if (count < minCount) minCount = count;
        if (count > maxCount) {
          maxCount = count;
          peakDays = [day];
        } else if (count === maxCount) {
          peakDays.push(day);
        }
      }
    }

    return {
      minCount: hasOrders ? minCount : 0,
      maxCount: hasOrders ? maxCount : 0,
      hasOrders,
      peakDays,
    };
  }, [dateOrderMap, daysInMonth, month, year]);

  // Color grading helper: red (lowest sell) -> coral -> orange -> amber -> lime -> green -> deep green (highest sell)
  const getMonthColorGrade = (count: number) => {
    if (count <= 0) {
      return {
        badgeClass: 'text-gray-600',
        cellClass: 'bg-[#0d1017]/70 border-[#1a1f2e]/60',
        label: 'কোনো অর্ডার নেই',
      };
    }

    if (!monthStats.hasOrders || monthStats.maxCount <= monthStats.minCount) {
      return {
        badgeClass: 'bg-emerald-600/25 text-emerald-200 border border-emerald-500/50 shadow-xs',
        cellClass: 'bg-[#101a15] hover:bg-[#14221b] border-emerald-500/30 hover:border-emerald-500/50',
        label: 'অর্ডার যুক্ত দিন',
      };
    }

    // Relative ratio from 0.0 (lowest in month) to 1.0 (highest in month)
    const ratio = (count - monthStats.minCount) / (monthStats.maxCount - monthStats.minCount);

    if (ratio <= 0.05) {
      // 0: সর্বনিম্ন সেল (Red)
      return {
        badgeClass: 'bg-red-500/25 text-red-200 border border-red-500/50 shadow-xs shadow-red-950/40',
        cellClass: 'bg-[#1a1013] hover:bg-[#201418] border-red-500/35 hover:border-red-400',
        label: 'সর্বনিম্ন সেল (লাল)',
      };
    } else if (ratio <= 0.22) {
      // 1: লো-সেল (Rose / Red-Orange)
      return {
        badgeClass: 'bg-rose-500/25 text-rose-200 border border-rose-500/45',
        cellClass: 'bg-[#1a1218] hover:bg-[#20161f] border-rose-500/30 hover:border-rose-400',
        label: 'কম সেল',
      };
    } else if (ratio <= 0.42) {
      // 2: মিডল-লো সেল (Orange)
      return {
        badgeClass: 'bg-orange-500/25 text-orange-200 border border-orange-500/45',
        cellClass: 'bg-[#1b1510] hover:bg-[#211a14] border-orange-500/30 hover:border-orange-400',
        label: 'মাঝারি কম সেল',
      };
    } else if (ratio <= 0.62) {
      // 3: মিডল সেল (Amber / Yellow)
      return {
        badgeClass: 'bg-amber-500/25 text-amber-200 border border-amber-500/45',
        cellClass: 'bg-[#191710] hover:bg-[#201d14] border-amber-500/30 hover:border-amber-400',
        label: 'মাঝারি সেল',
      };
    } else if (ratio <= 0.82) {
      // 4: মিডল-হাই সেল (Lime / Light Green)
      return {
        badgeClass: 'bg-lime-500/25 text-lime-200 border border-lime-500/50',
        cellClass: 'bg-[#131a12] hover:bg-[#182117] border-lime-500/30 hover:border-lime-400',
        label: 'ভালো সেল',
      };
    } else if (ratio < 0.98) {
      // 5: হাই সেল (Emerald)
      return {
        badgeClass: 'bg-emerald-500/30 text-emerald-200 border border-emerald-500/50 shadow-xs',
        cellClass: 'bg-[#101b15] hover:bg-[#14231b] border-emerald-500/35 hover:border-emerald-400',
        label: 'অনেক ভালো সেল',
      };
    } else {
      // 6: সর্বোচ্চ সেল (Deep Green / গাঢ় সবুজ)
      return {
        badgeClass: 'bg-gradient-to-r from-emerald-600 to-green-600 text-white font-black border border-emerald-400/70 shadow-sm shadow-emerald-500/40',
        cellClass: 'bg-[#0e2117] hover:bg-[#12281c] border-emerald-500/50 hover:border-emerald-300 ring-1 ring-emerald-500/30',
        label: 'সর্বোচ্চ সেল (গাঢ় সবুজ)',
      };
    }
  };

  return (
    <div className="w-full bg-[#12151f] border border-[#1e2436] rounded-2xl p-2.5 sm:p-5 shadow-lg space-y-3 sm:space-y-4">
      {/* Calendar Header: Optimized for Mobile Screen */}
      <div className="flex flex-col gap-2 sm:gap-3 pb-2.5 sm:pb-3 border-b border-[#1c2232]">
        {/* Row 1: Title + View Switcher */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-tr from-pink-600/30 to-purple-600/30 border border-pink-500/40 flex items-center justify-center text-pink-400 shrink-0">
              <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-base font-bold text-white tracking-tight flex items-center gap-2 flex-wrap">
                <span>অর্ডার ক্যালেন্ডার</span>
                {monthStats.hasOrders ? (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gradient-to-r from-emerald-600/30 via-emerald-500/20 to-teal-500/25 border border-emerald-400/60 text-emerald-200 shadow-md shadow-emerald-950/60"
                    title={`এই মাসের সর্বোচ্চ সেল: ${monthStats.maxCount} টি অর্ডার`}
                  >
                    <span className="text-[10px] sm:text-xs font-semibold text-emerald-400">সর্বোচ্চ সেল:</span>
                    <span className="text-sm sm:text-lg md:text-xl font-black text-white font-mono bg-emerald-700/60 px-2.5 py-0.5 rounded-lg border border-emerald-400/60 leading-none shadow-xs">
                      {monthStats.maxCount} টি
                    </span>
                  </span>
                ) : (
                  <span className="text-[11px] sm:text-xs bg-[#161a27] text-gray-400 border border-[#262f47] px-2 py-0.5 rounded-lg font-medium">
                    অর্ডার নেই
                  </span>
                )}
              </h3>
              <p className="text-[10px] sm:text-xs text-gray-400 hidden xs:block truncate">
                তারিখ অনুযায়ী কবে কয়টা অর্ডার
              </p>
            </div>
          </div>

          {/* View Mode Toggle (Grid vs List for Mobile) */}
          <div className="flex items-center bg-[#0c0e15] border border-[#232b3e] rounded-lg p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-2 py-1 rounded text-[10px] sm:text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                viewMode === 'grid'
                  ? 'bg-pink-600 text-white shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="ক্যালেন্ডার গ্রিড"
            >
              <LayoutGrid className="w-3 h-3" />
              <span className="hidden xs:inline">গ্রিড</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('agenda')}
              className={`px-2 py-1 rounded text-[10px] sm:text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                viewMode === 'agenda'
                  ? 'bg-pink-600 text-white shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="তারিখ তালিকা ভিউ"
            >
              <ListFilter className="w-3 h-3" />
              <span className="hidden xs:inline">তালিকা</span>
            </button>
          </div>
        </div>

        {/* Row 2: Controls Toolbar (Product Filter + Month Navigator + Today Button) - strictly 1 line on mobile */}
        <div className="flex items-center justify-between gap-1 sm:gap-2 flex-nowrap w-full overflow-hidden">
          {/* Product Filter Selector */}
          <div className="flex items-center gap-1 bg-[#0c0e15] border border-[#232b3e] hover:border-pink-500/40 rounded-lg px-1.5 sm:px-2 py-1 text-[11px] sm:text-xs flex-1 min-w-0">
            <Filter className="w-3 h-3 text-pink-400 shrink-0" />
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="bg-transparent text-[10px] sm:text-xs text-white font-semibold focus:outline-hidden cursor-pointer w-full truncate"
              title="প্রোডাক্ট ফিল্টার"
            >
              <option value="ALL" className="bg-[#12151f] text-gray-200">
                সকল প্রোডাক্ট
              </option>
              {availableProducts.map((p) => (
                <option key={p} value={p} className="bg-[#12151f] text-white">
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Month Navigator + Today */}
          <div className="flex items-center gap-1 shrink-0">
            <div className="flex items-center gap-0.5 bg-[#0c0e15] border border-[#232b3e] rounded-lg p-0.5">
              <button
                onClick={prevMonth}
                className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer"
                title="আগের মাস"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <span className="text-[10px] sm:text-xs font-bold text-white px-1 sm:px-1.5 min-w-[72px] sm:min-w-[95px] text-center font-mono truncate">
                {monthNamesBn[month]} {year}
              </span>

              <button
                onClick={nextMonth}
                className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer"
                title="পরের মাস"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={goToToday}
              className="px-1.5 sm:px-2 py-1 rounded-lg bg-[#181d2a] hover:bg-[#222a3d] text-pink-400 border border-pink-500/20 text-[10px] sm:text-[11px] font-bold cursor-pointer transition-colors shrink-0"
              title="আজকের দিনে যান"
            >
              আজ
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: Mobile-Optimized Responsive Calendar Grid */}
      {viewMode === 'grid' && (
        <div className="space-y-1">
          {/* Weekday Labels (English: Sun, Mon, Tue, Wed, Thu, Fri, Sat) */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center">
            {weekDays.map((day, i) => (
              <div
                key={day}
                className={`py-1 text-[11px] sm:text-xs font-bold rounded-md uppercase tracking-wider ${
                  i === 5 ? 'text-rose-400 bg-rose-500/10' : i === 0 ? 'text-amber-400 bg-amber-500/5' : 'text-gray-300 bg-[#0e1017]'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid: Fluid height for mobile, clean badge styling */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {/* Empty cells before month begins */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="h-12 sm:h-16 bg-[#0c0e14]/40 rounded-lg sm:rounded-xl border border-transparent opacity-20"
              />
            ))}

            {/* Days of Month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dayStr = String(dayNum).padStart(2, '0');
              const monthStr = String(month + 1).padStart(2, '0');
              const key = `${year}-${monthStr}-${dayStr}`;

              const dayData = dateOrderMap.get(key);
              const count = dayData?.count || 0;
              const hasOrders = count > 0;
              const isToday = key === todayKey;
              const isSelected = key === selectedDayKey;
              const grading = getMonthColorGrade(count);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelectedDayKey(isSelected ? null : key);
                    if (onSelectDate) onSelectDate(key);
                  }}
                  className={`h-12 sm:h-16 p-1 sm:p-1.5 rounded-lg sm:rounded-xl border flex flex-col justify-between transition-all cursor-pointer text-left relative overflow-hidden active:scale-95 ${
                    isSelected
                      ? 'bg-pink-600/25 border-pink-500 shadow-md shadow-pink-600/30 ring-2 ring-pink-500/50'
                      : isToday
                      ? 'bg-[#181d2c] border-pink-500/70 shadow-xs ring-1 ring-pink-500/40'
                      : hasOrders
                      ? `${grading.cellClass}`
                      : 'bg-[#0d1017]/70 border-[#1a1f2e]/60'
                  }`}
                >
                  {/* Top: Day Number + Today Indicator */}
                  <div className="flex items-center justify-between w-full leading-none">
                    <span
                      className={`text-[11px] sm:text-xs font-bold font-mono ${
                        isToday
                          ? 'text-pink-400 font-extrabold'
                          : hasOrders
                          ? 'text-white'
                          : 'text-gray-500'
                      }`}
                    >
                      {dayNum}
                    </span>

                    {isToday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0" />
                    )}
                  </div>

                  {/* Bottom: Order Indicator / Count Badge with Month-wise Color Grading */}
                  <div className="w-full mt-auto">
                    {hasOrders ? (
                      <div
                        className={`w-full text-center py-0.5 px-0.5 rounded text-[9px] sm:text-[10px] font-bold leading-tight truncate transition-colors ${grading.badgeClass}`}
                        title={`${dayNum} তারিখে ${count} টি অর্ডার (${grading.label})`}
                      >
                        <span className="xs:hidden">{count}</span>
                        <span className="hidden xs:inline">{count} অর্ডার</span>
                      </div>
                    ) : (
                      <div className="w-full text-center text-gray-700 text-[9px] sm:text-[10px] leading-none py-0.5">
                        •
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: Mobile Agenda List View (তারিখ অনুযায়ী সিরিয়াল লিস্ট) */}
      {viewMode === 'agenda' && (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {activeDateList.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs bg-[#0c0e15] rounded-xl border border-[#1e2436]">
              কোনো অর্ডারের তারিখ পাওয়া যায়নি
            </div>
          ) : (
            activeDateList.map(([dateKey, dayData]) => {
              const isSelected = selectedDayKey === dateKey;
              const isToday = dateKey === todayKey;
              const grading = getMonthColorGrade(dayData.count);

              return (
                <div
                  key={dateKey}
                  onClick={() => setSelectedDayKey(isSelected ? null : dateKey)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-pink-600/20 border-pink-500'
                      : isToday
                      ? 'bg-[#181d2a] border-pink-500/50'
                      : 'bg-[#121622] hover:bg-[#181d2a] border-[#222a3d]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex flex-col items-center justify-center font-mono shrink-0">
                      <span className="text-xs font-bold text-pink-400 leading-none">
                        {dateKey.split('-')[2]}
                      </span>
                      <span className="text-[8px] text-gray-400 uppercase leading-none mt-0.5">
                        {dateKey.split('-')[1]}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white font-mono">{dateKey}</span>
                        {isToday && (
                          <span className="text-[9px] bg-pink-500 text-white font-bold px-1 rounded">
                            আজ
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-1 rounded-md text-[11px] font-bold font-mono border transition-colors ${grading.badgeClass}`}>
                      {dayData.count} টি অর্ডার
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Selected Date Details Drawer / Bottom Sheet */}
      {selectedDayKey && (
        <div className="bg-[#0b0d14] border border-pink-500/30 rounded-xl p-3 sm:p-4 space-y-2.5 animate-fadeIn">
          {/* Header of Drawer */}
          <div className="flex items-center justify-between border-b border-[#1c2232] pb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-md bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 flex-wrap truncate">
                  <span>{selectedDayKey}</span>
                  <span className="text-[10px] font-bold text-pink-400 bg-pink-500/10 px-1.5 py-0.2 rounded border border-pink-500/20">
                    {selectedDetails?.count || 0} টি অর্ডার
                  </span>
                </h4>
              </div>
            </div>

            <button
              onClick={() => setSelectedDayKey(null)}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
              title="বন্ধ করুন"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Product Breakdown on this Date */}
          {selectedDetails && (
            <div className="space-y-2">
              <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400 flex items-center gap-1">
                <Layers className="w-3 h-3 text-pink-400" />
                <span>প্রোডাক্ট ভিত্তিক বিক্রয়:</span>
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {Object.entries(selectedDetails.productBreakdown).map(([pName, pCount]) => (
                  <div
                    key={pName}
                    className="bg-[#141824] border border-[#232b3e] rounded-lg p-1.5 sm:p-2 flex items-center justify-between gap-1 text-[11px] sm:text-xs"
                  >
                    <span className="text-gray-300 truncate font-medium" title={pName}>
                      {pName}
                    </span>
                    <span className="text-pink-400 font-bold font-mono shrink-0 bg-pink-500/10 px-1 py-0.2 rounded text-[10px]">
                      {pCount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
