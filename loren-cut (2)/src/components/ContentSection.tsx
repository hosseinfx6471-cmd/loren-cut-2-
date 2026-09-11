import React, { useState } from 'react';
import { ContentItem, ContentCategory } from '../types';
import { Folder, Image as ImageIcon, Video, BookOpen, GraduationCap, Scissors, Sparkles, Play, Tag, Clock } from 'lucide-react';

interface ContentSectionProps {
  items: ContentItem[];
}

export const ContentSection: React.FC<ContentSectionProps> = ({ items }) => {
  const [activeCategory, setActiveCategory] = useState<ContentCategory | 'all'>('all');
  const [selectedMedia, setSelectedMedia] = useState<ContentItem | null>(null);

  const categoryTabs: { id: ContentCategory | 'all'; label: string; folder: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'همه مطالب', folder: 'all', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'imageprompt', label: 'نمونه‌کارها و استایل', folder: 'imageprompt', icon: <Scissors className="w-4 h-4" /> },
    { id: 'imagecourse', label: 'دوره‌های آموزشی', folder: 'imagecourse', icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'imageservice', label: 'محیط و خدمات سالن', folder: 'imageservice', icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'imageblog', label: 'مطالب و مقالات', folder: 'imageblog', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'videos', label: 'ویدیوها', folder: 'videos', icon: <Video className="w-4 h-4" /> }
  ];

  const filteredItems = activeCategory === 'all'
    ? items
    : items.filter((item) => item.category === activeCategory);

  return (
    <section id="content-section" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-black/10">
      {/* Header */}
      <div className="text-center space-y-3 mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-[#c5a059] text-xs font-semibold shadow-sm">
          <Folder className="w-3.5 h-3.5" />
          <span>پوشه‌های اختصاصی مطالب Loren Cut</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-serif text-black">
          گالری نمونه‌کارها، دوره‌ها و ویدیوهای آموزشی
        </h2>
        <p className="text-gray-600 text-sm max-w-lg mx-auto">
          مطالب به صورت تفکیک‌شده در پوشه‌های منظم دسته‌بندی شده‌اند.
        </p>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
        {categoryTabs.map((tab) => {
          const isActive = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-sm ${
                isActive
                  ? 'bg-black text-white font-bold'
                  : 'glass text-gray-800 hover:bg-white hover:text-black border border-black/10'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono ${
                isActive ? 'bg-white/20 text-white' : 'bg-black/5 text-[#c5a059]'
              }`}>
                {tab.folder}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedMedia(item)}
            className="group rounded-2xl glass border border-black/10 hover:border-black/30 overflow-hidden transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col justify-between shadow-sm"
          >
            {/* Media Container */}
            <div className="relative aspect-video w-full bg-gray-100 overflow-hidden">
              {item.mediaType === 'video' ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <video
                    src={item.mediaUrl}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    muted
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/10 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                      <Play className="w-6 h-6 fill-current mr-0.5 text-[#c5a059]" />
                    </div>
                  </div>
                </div>
              ) : (
                <img
                  src={item.mediaUrl}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
              )}

              {/* Category Folder Badge */}
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-white/20 text-white text-[11px] font-mono font-bold flex items-center gap-1.5 dir-ltr shadow-sm">
                <Folder className="w-3 h-3 text-[#c5a059]" />
                <span>{item.folderPath}</span>
              </div>

              {/* Price tag if course */}
              {item.price && (
                <div className="absolute bottom-3 left-3 px-3 py-1 rounded-lg bg-[#c5a059] text-black font-extrabold text-xs shadow-md">
                  {item.price}
                </div>
              )}
            </div>

            {/* Content Details */}
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between text-[11px] text-gray-500 font-medium">
                <span className="text-[#c5a059] font-semibold flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  {item.category}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-gray-400" />
                  {item.createdAt}
                </span>
              </div>

              <h3 className="text-base font-bold text-black group-hover:text-[#c5a059] transition-colors line-clamp-1">
                {item.title}
              </h3>

              <p className="text-gray-600 text-xs leading-relaxed line-clamp-2">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {selectedMedia && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setSelectedMedia(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-white rounded-3xl border border-black/10 overflow-hidden p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black/10 pb-3">
              <div>
                <span className="text-xs text-[#c5a059] font-mono dir-ltr block">
                  📂 {selectedMedia.folderPath}
                </span>
                <h3 className="text-lg font-bold text-black">{selectedMedia.title}</h3>
              </div>
              <button
                onClick={() => setSelectedMedia(null)}
                className="px-3 py-1.5 rounded-xl bg-black text-white hover:bg-black/80 text-xs font-bold"
              >
                بستن (ESC)
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden bg-black max-h-[60vh] flex items-center justify-center">
              {selectedMedia.mediaType === 'video' ? (
                <video
                  src={selectedMedia.mediaUrl}
                  controls
                  autoPlay
                  className="max-h-[60vh] w-full object-contain"
                />
              ) : (
                <img
                  src={selectedMedia.mediaUrl}
                  alt={selectedMedia.title}
                  className="max-h-[60vh] w-full object-contain"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>

            <div className="text-sm text-gray-700 leading-relaxed pt-2">
              <p>{selectedMedia.description}</p>
              {selectedMedia.price && (
                <p className="mt-2 text-base font-bold text-black">
                  شهریه / هزینه: <span className="text-[#c5a059]">{selectedMedia.price}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
