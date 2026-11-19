import React from 'react';
import { MessageSquareHeart, Camera, Brain, BookHeart, Sliders } from 'lucide-react';

interface BottomTabBarProps {
  activeView: 'chat' | 'gallery' | 'memory' | 'diary' | 'customizer';
  onSelectView: (view: 'chat' | 'gallery' | 'memory' | 'diary' | 'customizer') => void;
  activeTokens: number;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeView,
  onSelectView,
  activeTokens,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0d0f17]/95 backdrop-blur-md border-t border-slate-800/80 pb-safe">
      <div className="grid grid-cols-5 items-center h-14">
        
        {/* Tab 1: Chat */}
        <button
          onClick={() => onSelectView('chat')}
          className={`flex flex-col items-center justify-center h-full transition min-h-[44px] ${
            activeView === 'chat' ? 'text-rose-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquareHeart className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-1">Chat</span>
        </button>

        {/* Tab 2: Gallery */}
        <button
          onClick={() => onSelectView('gallery')}
          className={`flex flex-col items-center justify-center h-full transition min-h-[44px] ${
            activeView === 'gallery' ? 'text-rose-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Camera className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-1">Selfies</span>
        </button>

        {/* Tab 3: Memory */}
        <button
          onClick={() => onSelectView('memory')}
          className={`flex flex-col items-center justify-center h-full transition min-h-[44px] relative ${
            activeView === 'memory' ? 'text-rose-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Brain className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-1">Mémoire</span>
        </button>

        {/* Tab 4: Diary */}
        <button
          onClick={() => onSelectView('diary')}
          className={`flex flex-col items-center justify-center h-full transition min-h-[44px] ${
            activeView === 'diary' ? 'text-rose-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookHeart className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-1">Journal</span>
        </button>

        {/* Tab 5: Customizer */}
        <button
          onClick={() => onSelectView('customizer')}
          className={`flex flex-col items-center justify-center h-full transition min-h-[44px] ${
            activeView === 'customizer' ? 'text-rose-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-1">Profil</span>
        </button>

      </div>
    </nav>
  );
};
