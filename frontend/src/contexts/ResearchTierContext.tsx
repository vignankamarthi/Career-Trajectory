/**
 * RESEARCH TIER CONTEXT
 * Global state management for user's selected research tier
 * Persists to localStorage
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ResearchTier = 'lite' | 'base' | 'core' | 'core2x' | 'pro' | 'ultra' | 'ultra2x' | 'ultra4x' | 'ultra8x';

interface TierInfo {
  id: ResearchTier;
  name: string;
  price: number;
  description: string;
  icon: string;
}

export const RESEARCH_TIERS: TierInfo[] = [
  {
    id: 'lite',
    name: 'Lite',
    price: 5.00,
    description: 'Basic information retrieval',
    icon: ''
  },
  {
    id: 'base',
    name: 'Base',
    price: 10.00,
    description: 'Reliable standard enrichments',
    icon: ''
  },
  {
    id: 'core',
    name: 'Core',
    price: 25.00,
    description: 'Cross-referenced, moderately complex outputs',
    icon: ''
  },
  {
    id: 'core2x',
    name: 'Core2x',
    price: 50.00,
    description: 'High complexity cross referenced outputs',
    icon: ''
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 100.00,
    description: 'Exploratory web research',
    icon: ''
  },
  {
    id: 'ultra',
    name: 'Ultra',
    price: 300.00,
    description: 'Extensive deep research',
    icon: ''
  },
  {
    id: 'ultra2x',
    name: 'Ultra2x',
    price: 600.00,
    description: 'Advanced deep research with 2x compute',
    icon: ''
  },
  {
    id: 'ultra4x',
    name: 'Ultra4x',
    price: 1200.00,
    description: 'Advanced deep research with 4x compute',
    icon: ''
  },
  {
    id: 'ultra8x',
    name: 'Ultra8x',
    price: 2400.00,
    description: 'Advanced deep research with 8x compute',
    icon: ''
  }
];

interface ResearchTierContextType {
  selectedTier: ResearchTier;
  setSelectedTier: (tier: ResearchTier) => void;
  getTierInfo: (tier: ResearchTier) => TierInfo;
}

const ResearchTierContext = createContext<ResearchTierContextType | undefined>(undefined);

const STORAGE_KEY = 'career-trajectory-research-tier';

export function ResearchTierProvider({ children }: { children: ReactNode }) {
  const [selectedTier, setSelectedTierState] = useState<ResearchTier>(() => {
    // Load from localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored as ResearchTier) || 'pro'; // Default to 'pro'
  });

  const setSelectedTier = (tier: ResearchTier) => {
    setSelectedTierState(tier);
    localStorage.setItem(STORAGE_KEY, tier);
  };

  const getTierInfo = (tier: ResearchTier): TierInfo => {
    return RESEARCH_TIERS.find(t => t.id === tier) || RESEARCH_TIERS[4]; // Fallback to Pro
  };

  return (
    <ResearchTierContext.Provider value={{ selectedTier, setSelectedTier, getTierInfo }}>
      {children}
    </ResearchTierContext.Provider>
  );
}

export function useResearchTier() {
  const context = useContext(ResearchTierContext);
  if (!context) {
    throw new Error('useResearchTier must be used within ResearchTierProvider');
  }
  return context;
}
