import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useResearchTier } from '../contexts/ResearchTierContext';
import PricingModal from './PricingModal';

interface NavigationProps {
  onHomeClick?: () => void;
  showHome?: boolean;
}

export default function Navigation({ onHomeClick, showHome = false }: NavigationProps) {
  const { theme, toggleTheme } = useTheme();
  const { selectedTier, getTierInfo } = useResearchTier();
  const [showPricingModal, setShowPricingModal] = useState(false);

  const tierInfo = getTierInfo(selectedTier);

  return (
    <>
      <nav className="fixed right-4 flex items-center gap-2 z-50" style={{top: '6rem'}}>
        {/* Home Button */}
        {showHome && onHomeClick && (
          <button
            onClick={onHomeClick}
            className="p-3 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-lg hover:shadow-xl transition-all duration-200"
            aria-label="Go home"
          >
            <svg className="w-5 h-5 text-neutral-900 dark:text-neutral-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>
        )}

        {/* Pricing Button */}
        <button
          onClick={() => setShowPricingModal(true)}
          className="p-3 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-lg hover:shadow-xl transition-all duration-200 relative group"
          aria-label="View pricing"
          title={`Current tier: ${tierInfo.name} ($${tierInfo.price}/1000)`}
        >
          <svg className="w-5 h-5 text-neutral-900 dark:text-neutral-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {/* Tier indicator badge */}
          <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-[8px] font-bold px-1 rounded-full">
            {tierInfo.name.toUpperCase()}
          </div>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-3 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-lg hover:shadow-xl transition-all duration-200"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? (
            <svg className="w-5 h-5 text-neutral-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-neutral-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          )}
        </button>
      </nav>

      {/* Pricing Modal */}
      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
      />
    </>
  );
}
