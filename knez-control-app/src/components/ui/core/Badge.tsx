import React from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  success: 'bg-green-900/30 text-green-400 border-green-900/50',
  warning: 'bg-amber-900/30 text-amber-400 border-amber-900/50',
  error: 'bg-red-900/30 text-red-400 border-red-900/50',
  info: 'bg-blue-900/30 text-blue-400 border-blue-900/50',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  className = '',
}) => {
  return (
    <span
      className={`
        px-2 py-0.5
        rounded
        text-xs
        font-medium
        border
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
};
