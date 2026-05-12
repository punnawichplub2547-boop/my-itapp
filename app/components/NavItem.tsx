import React from 'react';

export default function NavItem({ icon, label, active = false, onClick, collapsed = false }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void, collapsed?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 overflow-hidden ${
        active 
          ? 'bg-white/15 text-white font-bold ring-1 ring-white/10 shadow-lg' 
          : 'text-white/60 hover:bg-white/5 hover:text-white'
      }`}
    >
      <span className="shrink-0 transition-transform group-hover:scale-110">{icon}</span>
      {!collapsed && <span className="text-sm truncate ">{label}</span>}
      {active && !collapsed && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"></div>}
    </button>
  );
}
