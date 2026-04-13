'use client';
import { useRouter } from 'next/navigation';
import { getCategoryLabel, getModeLabel } from '@/lib/utils';

const MODES = ['fixed_price', 'sealed_bid', 'hybrid', 'request_only'];

interface ItemFiltersProps {
  categories: string[];
  selectedCategory?: string;
  selectedMode?: string;
  tenantSlug: string;
  eventSlug: string;
}

export function ItemFilters({ categories, selectedCategory, selectedMode, tenantSlug, eventSlug }: ItemFiltersProps) {
  const router = useRouter();
  const base = `/${tenantSlug}/${eventSlug}/sponsor`;

  function setFilter(key: string, value: string | undefined) {
    const params = new URLSearchParams();
    if (key !== 'category' && selectedCategory) params.set('category', selectedCategory);
    if (key !== 'mode' && selectedMode) params.set('mode', selectedMode);
    if (value) params.set(key, value);
    router.push(`${base}?${params.toString()}`);
  }

  const activeStyle = {
    borderLeft: '2px solid #4361ee',
    background: 'rgba(67,97,238,0.08)',
    color: '#7b93f8',
    paddingLeft: '14px',
  };

  const inactiveStyle = {
    borderLeft: '2px solid transparent',
    paddingLeft: '14px',
    color: 'rgba(255,255,255,0.35)',
  };

  return (
    <div className="space-y-8">
      {/* Category filter */}
      <div>
        <h3
          className="font-mono text-[10px] tracking-[0.35em] uppercase mb-4"
          style={{ color: 'rgba(255,255,255,0.25)' }}
        >
          Category
        </h3>
        <div className="space-y-0.5">
          <button
            onClick={() => setFilter('category', undefined)}
            className="w-full text-left py-2.5 text-sm font-sans transition-all duration-150 hover:text-white"
            style={!selectedCategory ? activeStyle : inactiveStyle}
          >
            All Categories
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter('category', cat)}
              className="w-full text-left py-2.5 text-sm font-sans transition-all duration-150 hover:text-white"
              style={selectedCategory === cat ? activeStyle : inactiveStyle}
            >
              {getCategoryLabel(cat)}
            </button>
          ))}
        </div>
      </div>

      {/* Mode filter */}
      <div>
        <h3
          className="font-mono text-[10px] tracking-[0.35em] uppercase mb-4"
          style={{ color: 'rgba(255,255,255,0.25)' }}
        >
          Purchase Type
        </h3>
        <div className="space-y-0.5">
          <button
            onClick={() => setFilter('mode', undefined)}
            className="w-full text-left py-2.5 text-sm font-sans transition-all duration-150 hover:text-white"
            style={!selectedMode ? activeStyle : inactiveStyle}
          >
            All Types
          </button>
          {MODES.map(mode => (
            <button
              key={mode}
              onClick={() => setFilter('mode', mode)}
              className="w-full text-left py-2.5 text-sm font-sans transition-all duration-150 hover:text-white"
              style={selectedMode === mode ? activeStyle : inactiveStyle}
            >
              {getModeLabel(mode)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
