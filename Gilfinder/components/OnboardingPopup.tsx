'use client';

import { useState, useEffect } from 'react';

const ONBOARDING_KEY = 'onboarding_done';

interface OnboardingPage {
  icon: string;
  title: string;
  description: string;
}

const pages: OnboardingPage[] = [
  {
    icon: '🚗',
    title: '가는길에 시작하기',
    description: '출발지/도착지를 입력하면 경로를 검색해요',
  },
  {
    icon: '🔍',
    title: '카테고리로 검색',
    description: '주유소, 맛집, 카페 등 카테고리를 선택하면 경로 주변 장소를 찾아줘요',
  },
  {
    icon: '📍',
    title: '경유지 추가',
    description: '마음에 드는 장소를 경유지로 추가하고 내비로 바로 출발!',
  },
];

export default function OnboardingPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const isDone = localStorage.getItem(ONBOARDING_KEY);
    if (!isDone) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setIsOpen(false);
  };

  const handleNext = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1);
    } else {
      handleClose();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    setCurrentX(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    const diff = startX - currentX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentPage < pages.length - 1) {
        setCurrentPage(currentPage + 1);
      } else if (diff < 0 && currentPage > 0) {
        setCurrentPage(currentPage - 1);
      }
    }
    setIsDragging(false);
    setStartX(0);
    setCurrentX(0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setStartX(e.clientX);
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setCurrentX(e.clientX);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    const diff = startX - currentX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentPage < pages.length - 1) {
        setCurrentPage(currentPage + 1);
      } else if (diff < 0 && currentPage > 0) {
        setCurrentPage(currentPage - 1);
      }
    }
    setIsDragging(false);
    setStartX(0);
    setCurrentX(0);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 relative animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          aria-label="닫기"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="text-center pt-4 pb-6">
          <div className="text-6xl mb-4">{pages[currentPage].icon}</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{pages[currentPage].title}</h2>
          <p className="text-sm text-gray-600 leading-relaxed">{pages[currentPage].description}</p>
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-2 mb-6">
          {pages.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all ${
                index === currentPage
                  ? 'w-6 bg-blue-600'
                  : 'w-2 bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* Next button */}
        <button
          onClick={handleNext}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors active:scale-95"
        >
          {currentPage < pages.length - 1 ? '다음' : '시작하기'}
        </button>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slide-up {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }

        .animate-slide-up {
          animation: slide-up 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}
