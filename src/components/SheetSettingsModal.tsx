import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  Check,
  RefreshCw,
  Layers,
  ShieldCheck,
  LogOut,
  Code2,
  Copy,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { GoogleSignInButton } from './GoogleSignInButton';
import {
  COMPLETE_APPS_SCRIPT_CODE,
  getAppsScriptUrl,
  saveAppsScriptUrl,
} from '../services/sheets';

interface SheetSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  spreadsheetId: string;
  onUpdateSpreadsheetId: (id: string) => void;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  isAuthLoading: boolean;
  onSyncNow: () => void;
  isSyncing: boolean;
  onOpenAuthHelp?: () => void;
  selectedTab?: string;
  onUpdateSelectedTab?: (tab: string) => void;
}

export const SheetSettingsModal: React.FC<SheetSettingsModalProps> = ({
  isOpen,
  onClose,
  spreadsheetId,
  onUpdateSpreadsheetId,
  user,
  onSignIn,
  onSignOut,
  isAuthLoading,
  onSyncNow,
  isSyncing,
  onOpenAuthHelp,
  selectedTab = 'Sheet2',
  onUpdateSelectedTab,
}) => {
  const [inputVal, setInputVal] = useState(spreadsheetId);
  const [tabVal, setTabVal] = useState(selectedTab);
  const [scriptUrl, setScriptUrl] = useState(getAppsScriptUrl());
  const [showScriptCode, setShowScriptCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    setInputVal(spreadsheetId);
  }, [spreadsheetId]);

  useEffect(() => {
    setTabVal(selectedTab);
  }, [selectedTab]);

  useEffect(() => {
    setScriptUrl(getAppsScriptUrl());
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(COMPLETE_APPS_SCRIPT_CODE);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const handleSave = () => {
    onUpdateSpreadsheetId(inputVal.trim());
    if (onUpdateSelectedTab && tabVal.trim()) {
      onUpdateSelectedTab(tabVal.trim());
    }
    if (scriptUrl.trim()) {
      saveAppsScriptUrl(scriptUrl.trim());
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-[#121520] border border-[#22293d] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#1c2232] flex items-center justify-between bg-[#0e111a]">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">
              গুগল শিট কানেকশন ও সেটিংস
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1c2232] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Account Status */}
          <div className="p-4 rounded-xl bg-[#161a26] border border-[#232b3e] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-300">গুগল অ্যাকাউন্ট স্ট্যাটাস</span>
              {user ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  সংযুক্ত (Connected)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                  Local Preview Mode
                </span>
              )}
            </div>

            {user ? (
              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-gray-200 font-semibold">{user.displayName || 'Google User'}</p>
                  <p className="text-gray-500 text-[11px]">{user.email}</p>
                </div>
                <button
                  onClick={onSignOut}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors text-[11px] font-semibold"
                >
                  <LogOut className="w-3 h-3" />
                  লগআউট
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-gray-400 leading-relaxed text-[11px]">
                    গুগল শিটে সরাসরি অর্ডার আপডেট করতে গুগল সাইন-ইন করুন:
                  </p>
                  {onOpenAuthHelp && (
                    <button
                      onClick={onOpenAuthHelp}
                      className="text-pink-400 hover:text-pink-300 font-semibold text-[11px] underline underline-offset-2 shrink-0 ml-2"
                    >
                      লগইন সমস্যা?
                    </button>
                  )}
                </div>
                <GoogleSignInButton
                  user={user}
                  onSignIn={onSignIn}
                  onSignOut={onSignOut}
                  loading={isAuthLoading}
                />
                <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>পাবলিক শিট মোড সক্রিয়: সাইন-ইন ছাড়াও লাইভ শিট পড়া যাচ্ছে।</span>
                </div>
              </div>
            )}
          </div>

          {/* Spreadsheet ID Field */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Google Spreadsheet ID
            </label>
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="গুগল শিট আইডি বা লিংক..."
              className="w-full bg-[#181c29] border border-[#262f44] rounded-xl px-3.5 py-2 text-xs font-mono text-pink-400 focus:outline-none focus:border-pink-500"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              ডিফল্ট শিট: 1aHUCGINJ8rB29rXXckH7uMTwrk163v6aQFTfQ6ptr6M
            </p>
          </div>

          {/* Sheet Tab Selection (Worksheet Tab) */}
          <div className="bg-[#151926] border border-[#232b40] rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-pink-400" />
                <span>শিট ট্যাব নির্বাচন (Worksheet Tab)</span>
              </label>
              <span className="text-[10px] text-gray-400 font-mono">
                {tabVal}
              </span>
            </div>

            {/* Quick-select pills */}
            <div className="flex flex-wrap gap-1.5">
              {['Sheet2', 'Sheet1', 'Orders'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setTabVal(tab)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    tabVal.toLowerCase() === tab.toLowerCase()
                      ? 'bg-pink-600 text-white shadow-md shadow-pink-900/40 font-bold border border-pink-400'
                      : 'bg-[#1e2436] hover:bg-[#283149] text-gray-300 border border-[#2b3652]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Direct Input */}
            <input
              type="text"
              value={tabVal}
              onChange={(e) => setTabVal(e.target.value)}
              placeholder="ট্যাবের নাম লিখুন (যেমন: Sheet2 বা Sheet1)..."
              className="w-full bg-[#0f121a] border border-[#262f44] rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
            />
            <p className="text-[11px] text-gray-400">
              শুধুমাত্র এই সিলেক্ট করা ট্যাবের কাস্টমার অর্ডারগুলোই সিঙ্ক হবে।
            </p>
          </div>

          {/* Apps Script Web App Integration (Auto Sheet Write) */}
          <div className="bg-[#151926] border border-[#232b40] rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Google Apps Script ইন্টিগ্রেশন (শিট অটো-আপডেট)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowScriptCode(!showScriptCode)}
                className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>{showScriptCode ? 'কোড লুকান' : 'কোড দেখুন ও কপি করুন'}</span>
              </button>
            </div>

            <p className="text-[11px] text-gray-400 leading-relaxed">
              অ্যাপ থেকে গ্রাহকের নাম, ফোন, ঠিকানা, মূল্য (কলাম B, C, D, F) এবং স্ট্যাটাস ও ভ্যারিয়েন্ট এডিট করলে সরাসরি গুগল শিটে সেভ হওয়ার জন্য Apps Script Web App কাজ করে।
            </p>

            <div>
              <label className="text-[11px] text-gray-400 block mb-1">
                Apps Script Web App URL (ডিফল্ট প্রস্তুত আছে):
              </label>
              <input
                type="text"
                value={scriptUrl}
                onChange={(e) => setScriptUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full bg-[#0f121a] border border-[#262f44] rounded-lg px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Expandable Code Box */}
            {showScriptCode && (
              <div className="mt-3 p-3 bg-[#0d1017] border border-[#262f44] rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-300">
                    Sheet2 এর জন্য সম্পূর্ণ Apps Script কোড:
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-medium border border-amber-500/40 transition-colors"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">কপি হয়েছে!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>কোড কপি করুন</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="text-[10px] text-gray-400 space-y-1 bg-[#121622] p-2.5 rounded-lg border border-[#1f2738]">
                  <p className="font-semibold text-amber-300">কিভাবে যুক্ত করবেন (৩টি সহজ ধাপ):</p>
                  <p>১. আপনার গুগল শিটে যান ও মেনু থেকে <strong>Extensions &gt; Apps Script</strong>-এ ক্লিক করুন।</p>
                  <p>২. বিদ্যমান কোড মুছে দিয়ে উপরের <strong>"কোড কপি করুন"</strong> বাটন দিয়ে কোডটি পেস্ট করুন এবং Save করুন।</p>
                  <p>৩. উপরে <strong>Deploy &gt; New deployment</strong> এ গিয়ে Type: <strong>Web app</strong>, Who has access: <strong>Anyone</strong> দিয়ে <strong>Deploy</strong> করুন।</p>
                </div>

                <pre className="text-[10px] font-mono text-gray-400 bg-black/60 p-2.5 rounded-lg max-h-36 overflow-y-auto whitespace-pre">
                  {COMPLETE_APPS_SCRIPT_CODE}
                </pre>
              </div>
            )}
          </div>

          {/* Sync Trigger */}
          <div className="flex items-center justify-between pt-2 border-t border-[#1c2232]">
            <button
              onClick={() => {
                if (onUpdateSelectedTab && tabVal.trim()) {
                  onUpdateSelectedTab(tabVal.trim());
                }
                onSyncNow();
              }}
              disabled={isSyncing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1b202e] hover:bg-[#252c3f] border border-[#29334a] text-gray-300 font-medium transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-pink-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'সিঙ্ক হচ্ছে...' : 'এখনই শিট রিফ্রেশ করুন'}</span>
            </button>

            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold transition-colors"
            >
              সংরক্ষণ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
