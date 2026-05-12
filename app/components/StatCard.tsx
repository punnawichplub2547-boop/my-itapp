import React from 'react';

export default function StatCard({ label, value, icon, border }: { label: string, value: string, icon: React.ReactNode, border: string }) {
  const borderColorClass = border === 'primary' ? 'border-l-primary' : 
                         border === 'warning' ? 'border-l-warning' : 
                         border === 'success' ? 'border-l-success' : 
                         border === 'error' ? 'border-l-error' : `border-l-[${border}]`;

  return (
    <div className={`bg-white p-4 rounded-xl border border-outline-variant shadow-sm border-l-4 ${borderColorClass} hover:shadow-md transition-all`}>
      <p className="text-[10px] font-bold text-secondary uppercase tracking-widest flex justify-between items-center mb-2">
        {label}
        <span className="scale-75 opacity-70">{icon}</span>
      </p>
      <h3 className="text-2xl font-bold text-primary leading-none">{value}</h3>
    </div>
  );
}
