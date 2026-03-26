/**
 * Icon Showcase - View all K_OS icons
 */
import { useState } from 'react';
import { ICONS, Icon, type IconCategory } from '@/utils/iconRegistry';

export function IconShowcase() {
  const [selectedCategory, setSelectedCategory] = useState<IconCategory>('modeling');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = Object.keys(ICONS) as IconCategory[];
  const currentIcons = ICONS[selectedCategory];
  
  const filteredIcons = currentIcons.filter(icon =>
    icon.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-slate-900 text-white">
      {/* Sidebar */}
      <div className="w-64 bg-slate-800 border-r border-slate-700 p-4">
        <h2 className="text-xl font-bold mb-4">Categories</h2>
        <div className="space-y-1">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`w-full text-left px-3 py-2 rounded transition-colors ${
                selectedCategory === category
                  ? 'bg-purple-600 text-white'
                  : 'hover:bg-slate-700 text-slate-300'
              }`}
            >
              {category.replace('_', ' ')}
              <span className="float-right text-xs opacity-60">
                {ICONS[category].length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-8 overflow-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">K_OS Icon Library</h1>
          <p className="text-slate-400">
            {Object.values(ICONS).flat().length} icons across {categories.length} categories
          </p>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search icons..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-md px-4 py-2 mb-6 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-purple-500"
        />

        {/* Icon grid */}
        <div className="grid grid-cols-6 gap-4">
          {filteredIcons.map(iconName => (
            <div
              key={iconName}
              className="flex flex-col items-center p-4 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer group"
              title={iconName}
            >
              <Icon
                category={selectedCategory}
                name={iconName}
                size={48}
                className="mb-2 group-hover:scale-110 transition-transform"
              />
              <span className="text-xs text-center text-slate-400 group-hover:text-white">
                {iconName.replace(/_/g, ' ')}
              </span>
            </div>
          ))}
        </div>

        {filteredIcons.length === 0 && (
          <div className="text-center text-slate-500 mt-12">
            No icons found matching "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
}
