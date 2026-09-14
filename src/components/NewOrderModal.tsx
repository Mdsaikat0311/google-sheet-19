import React, { useState, useEffect } from 'react';
import { X, Edit3, Calendar, Send, Loader2 } from 'lucide-react';
import { Order, OrderStatus } from '../types';

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (order: Order) => Promise<void>;
  isSubmitting: boolean;
}

// Column H (Variant) options - strictly Google Sheet Column H 6 products + No Sellect
const availableVariants = [
  'No Sellect',
  'Rose 599tk',
  'Doll and toys',
  'Watch 599tk',
  'Porbash Rose 990tk',
  'Porbash Rose 1350tk',
  'Cutting Dispancer',
];

// Column I (Source) options - verified from Google Sheet
const availableSources = [
  'Website',
  'Whatsapp',
  'Call Direct',
  'Messenger',
  'Tiktok',
  'Youtube',
  'FB Ads',
  'incomplete',
  'Pending',
];

// Column J (Status) options - verified from Google Sheet
const availableStatuses: OrderStatus[] = [
  'Procecing',
  'Hold',
  'Complete',
  'Cancel',
  'Pending',
  'In Review',
  'Partial',
];

/**
 * Format real-time Google Sheet timestamp (Column A format)
 * e.g., "9/14/2026 18:45:20" or "14/09/2026 18:45:20"
 */
const getRealTimeSheetDate = (): string => {
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const y = now.getFullYear();
  const hh = now.getHours();
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${m}/${d}/${y} ${hh}:${mm}:${ss}`;
};

export const NewOrderModal: React.FC<NewOrderModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const [invoiceId, setInvoiceId] = useState('');
  const [orderDateTime, setOrderDateTime] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [price, setPrice] = useState<number>(599);
  const [quantity, setQuantity] = useState<number>(1);
  const [variant, setVariant] = useState('Rose 599tk');
  const [source, setSource] = useState('Website');
  const [status, setStatus] = useState<OrderStatus>('Pending');

  // Auto-populate real-time date/time and invoice ID when modal opens
  useEffect(() => {
    if (isOpen) {
      setInvoiceId(`INV-${Math.floor(1000 + Math.random() * 9000)}`);
      setOrderDateTime(getRealTimeSheetDate());
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setPrice(599);
      setQuantity(1);
      setVariant('Rose 599tk');
      setSource('Website');
      setStatus('Pending');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert('অনুগ্রহ করে গ্রাহকের নাম লিখুন');
      return;
    }

    const currentSheetDate = orderDateTime.trim() || getRealTimeSheetDate();

    const newOrder: Order = {
      id: invoiceId || `INV-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || '01700000000',
      customerAddress: customerAddress.trim() || 'ঢাকা',
      product: variant !== 'No Sellect' ? variant : 'Rose 599tk',
      variant: variant,
      source: source,
      amount: Number(price) || 599,
      total: Number(price) || 599,
      quantity: Math.max(1, Number(quantity) || 1),
      status: status,
      trackingCode: `29${Math.floor(1000000 + Math.random() * 9000000)}`,
      courierStatus: 'pending',
      steadfastStatus: 'No Sellect',
      date: currentSheetDate,
      rawDate: currentSheetDate,
    };

    await onSubmit(newOrder);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#14151e] border border-[#2c3044] rounded-2xl w-full max-w-lg shadow-2xl p-4 sm:p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Identical to Order Card Edit Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-[#232636] sticky -top-4 bg-[#14151e] z-10 -mt-1 pt-1">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Edit3 className="w-4 h-4 sm:w-5 sm:h-5 text-pink-400" />
              নতুন অর্ডার তৈরি করুন (শিটে সেভ হবে)
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              অর্ডার #{invoiceId} • লাইভ শিট অটো-সিঙ্ক
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#202434] transition-colors cursor-pointer active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form - Matching Order Card Edit Fields + Real-time Auto-selected Date */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Real-time Date & Time (Column A) - Auto Selected Like Google Sheet */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-pink-400" />
                <span>তারিখ ও সময় (Column A):</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                রিয়েলটাইম অটো সিলেক্ট
              </span>
            </label>
            <input
              type="text"
              value={orderDateTime}
              onChange={(e) => setOrderDateTime(e.target.value)}
              placeholder="M/D/YYYY HH:mm:ss"
              required
              className="w-full bg-[#1b1e2c] border border-[#2f354e] rounded-lg px-3 py-2 text-base sm:text-sm text-pink-300 focus:outline-none focus:border-pink-500 font-mono"
            />
          </div>

          {/* Customer Name (Col F) */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              গ্রাহকের নাম (Column F):
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="গ্রাহকের নাম লিখুন"
              required
              className="w-full bg-[#1b1e2c] border border-[#2f354e] rounded-lg px-3 py-2 text-base sm:text-sm text-white focus:outline-none focus:border-pink-500"
            />
          </div>

          {/* Customer Phone (Col C) */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              ফোন নম্বর (Column C):
            </label>
            <input
              type="text"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="01XXXXXXXXX"
              required
              className="w-full bg-[#1b1e2c] border border-[#2f354e] rounded-lg px-3 py-2 text-base sm:text-sm text-white focus:outline-none focus:border-pink-500 font-mono"
            />
          </div>

          {/* Customer Address (Col B) */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              ডেলিভারি ঠিকানা (Column B):
            </label>
            <textarea
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              placeholder="সম্পূর্ণ ডেলিভারি ঠিকানা..."
              rows={2}
              required
              className="w-full bg-[#1b1e2c] border border-[#2f354e] rounded-lg px-3 py-2 text-base sm:text-sm text-white focus:outline-none focus:border-pink-500 resize-none"
            />
          </div>

          {/* Grid: Price (Col D) & Quantity (Col N) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                মোট মূল্য / COD (Col D):
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                min={0}
                className="w-full bg-[#1b1e2c] border border-[#2f354e] rounded-lg px-3 py-2 text-base sm:text-sm text-white focus:outline-none focus:border-pink-500 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                অর্ডার পরিমাণ (Col N):
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                min={1}
                className="w-full bg-[#1b1e2c] border border-[#2f354e] rounded-lg px-3 py-2 text-base sm:text-sm text-white focus:outline-none focus:border-pink-500 font-mono font-bold"
              />
            </div>
          </div>

          {/* Grid: Variant (Col H) & Source (Col I) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                ভ্যারিয়েন্ট (Column H):
              </label>
              <select
                value={variant}
                onChange={(e) => {
                  const newV = e.target.value;
                  setVariant(newV);
                  if (newV === 'Porbash Rose 990tk') setPrice(990);
                  else if (newV === 'Porbash Rose 1350tk') setPrice(1350);
                  else if (newV === 'Rose 599tk' || newV === 'Watch 599tk') setPrice(599);
                }}
                className="w-full bg-[#1b1e2c] border border-[#2f354e] rounded-lg px-3 py-2 text-base sm:text-sm text-white focus:outline-none focus:border-pink-500"
              >
                {availableVariants.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                অর্ডার সোর্স (Column I):
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full bg-[#1b1e2c] border border-[#2f354e] rounded-lg px-3 py-2 text-base sm:text-sm text-white focus:outline-none focus:border-pink-500"
              >
                {availableSources.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status (Col J) */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">
              অর্ডার স্ট্যাটাস (Column J):
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as OrderStatus)}
              className="w-full bg-[#1b1e2c] border border-[#2f354e] rounded-lg px-3 py-2 text-base sm:text-sm text-white focus:outline-none focus:border-pink-500 font-semibold"
            >
              {availableStatuses.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#232636]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 sm:px-4 py-2 rounded-lg bg-[#202434] hover:bg-[#2a3044] text-gray-300 text-xs font-semibold transition-colors cursor-pointer active:scale-95"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 sm:px-5 py-2 rounded-lg bg-gradient-to-r from-pink-600 via-rose-600 to-pink-500 hover:from-pink-500 hover:to-rose-500 text-white text-xs font-bold shadow-lg shadow-pink-600/30 flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer disabled:opacity-50 active:scale-95 ml-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>সেভ হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>শিটে সেভ করুন</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
