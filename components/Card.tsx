import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, title, className = '' }) => {
  return (
    <div className={`bg-zinc-900/40 backdrop-blur-md rounded-2xl border border-white/5 shadow-2xl overflow-hidden ${className}`}>
      {title && (
        <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02]">
          <h3 className="font-semibold text-zinc-200">{title}</h3>
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
};