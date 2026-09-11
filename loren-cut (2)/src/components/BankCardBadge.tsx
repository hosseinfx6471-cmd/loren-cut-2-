import React, { useState } from 'react';
import { CreditCard, Copy, Check, ShieldCheck } from 'lucide-react';

interface BankCardBadgeProps {
  cardNumber: string;
  cardHolder: string;
  bankName?: string;
  depositAmount?: string;
}

export const BankCardBadge: React.FC<BankCardBadgeProps> = ({
  cardNumber,
  cardHolder,
  depositAmount
}) => {
  const [copied, setCopied] = useState(false);

  const formatCardNumber = (num?: string) => {
    if (!num) return '';
    return String(num).replace(/\D/g, '').replace(/(\d{4})/g, '$1 ').trim();
  };

  const handleCopy = () => {
    if (!cardNumber) return;
    navigator.clipboard.writeText(cardNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#121212] p-5 sm:p-6 border border-white/10 text-white shadow-xl group transition-all duration-300">
      {/* Background Subtle Gold Accent */}
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#c5a059]/10 blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-white/10 border border-white/10 text-[#c5a059]">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs text-[#c5a059] font-medium">اطلاعات کارت جهت واریز بیعانه</h4>
            <p className="text-xs text-gray-300 font-medium">کارت به کارت آنلاین</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-500/30 font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>تایید شده سالن</span>
        </div>
      </div>

      {/* Card Number Display */}
      <div className="my-4 p-3.5 sm:p-4 rounded-xl bg-white/10 border border-white/10 flex items-center justify-between dir-ltr">
        <span className="font-mono text-base sm:text-xl font-bold tracking-widest text-[#c5a059] dir-ltr">
          {formatCardNumber(cardNumber || '6219861929212669')}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
            copied
              ? 'bg-[#c5a059] text-black font-bold'
              : 'bg-white/15 hover:bg-[#c5a059] text-white hover:text-black border border-white/20'
          }`}
          title="کپی شماره کارت"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>کپی شد!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>کپی کارت</span>
            </>
          )}
        </button>
      </div>

      {/* Account Holder & Deposit Amount */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-3 text-sm border-t border-white/10 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xs font-medium">به نام صاحب حساب:</span>
          <span className="font-bold text-[#c5a059] text-sm sm:text-base tracking-wide">{cardHolder || 'محمدمهدی سبزوار'}</span>
        </div>
        {depositAmount && (
          <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 px-3 py-1.5 rounded-xl text-xs">
            <span className="text-amber-200 font-medium">مبلغ بیعانه واریزی:</span>
            <span className="font-extrabold text-amber-300 text-sm sm:text-base">{depositAmount}</span>
          </div>
        )}
      </div>
    </div>
  );
};
