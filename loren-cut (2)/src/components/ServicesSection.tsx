import React from 'react';
import { ServiceItem } from '../types';
import { Scissors, Clock, Sparkles, CheckCircle2, ArrowLeft } from 'lucide-react';

interface ServicesSectionProps {
  services: ServiceItem[];
  onSelectService: (service: ServiceItem) => void;
  depositAmount?: string;
}

export const ServicesSection: React.FC<ServicesSectionProps> = ({
  services,
  onSelectService,
  depositAmount
}) => {
  return (
    <section id="services" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Section Header */}
      <div className="text-center space-y-3 mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-[#c5a059] text-xs font-semibold shadow-sm">
          <Scissors className="w-3.5 h-3.5" />
          <span>خدمات تخصصی Loren Cut</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-serif text-black">
          خدمت اصلی سالن (اصلاح سر)
        </h2>
        <p className="text-gray-600 text-sm max-w-xl mx-auto">
          اصلاح و کوتاهی تخصصی موی سر با بهداشتی‌ترین تجهیزات و کیفیت عالی توسط محمدمهدی سبزوار.
        </p>
      </div>

      {/* Services Grid */}
      <div className="max-w-xl mx-auto">
        {services.map((service) => (
          <div
            key={service.id}
            className={`relative rounded-2xl glass p-6 transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1 shadow-sm ${
              service.popular
                ? 'border-2 border-black/80 shadow-md'
                : 'border border-black/10 hover:border-black/30'
            }`}
          >
            {/* Popular Badge */}
            {service.popular && (
              <div className="absolute -top-3 left-6 px-3 py-0.5 rounded-full bg-[#c5a059] text-black font-bold text-xs flex items-center gap-1 shadow-sm">
                <Sparkles className="w-3 h-3" />
                <span>محبوب‌ترین</span>
              </div>
            )}

            <div>
              {/* Title and Duration */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="text-lg font-bold text-black group-hover:text-[#c5a059] transition-colors">
                  {service.title}
                </h3>
                <div className="flex items-center gap-1 text-xs text-black bg-white/90 px-2.5 py-1 rounded-lg border border-black/10 whitespace-nowrap font-medium">
                  <Clock className="w-3 h-3 text-[#c5a059]" />
                  <span>{service.duration}</span>
                </div>
              </div>

              {/* Description */}
              <p className="text-gray-600 text-xs sm:text-sm leading-relaxed mb-6">
                {service.description}
              </p>
            </div>

            {/* Price and Action Button */}
            <div className="pt-4 border-t border-black/10 flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-500 font-medium">هزینه کامل:</span>
                  <span className="text-base font-extrabold text-black">
                    {service.price}
                  </span>
                </div>
                {depositAmount && (
                  <div className="text-xs font-bold text-emerald-800 mt-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 inline-block">
                    مبلغ بیعانه آنلاین: <span className="font-black text-emerald-900">{depositAmount}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => onSelectService(service)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl btn-dark text-xs font-bold transition-all duration-200 shadow-sm cursor-pointer"
              >
                <span>انتخاب و رزرو</span>
                <ArrowLeft className="w-3.5 h-3.5 text-[#c5a059]" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
