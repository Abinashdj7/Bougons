'use client';

import { clsx } from 'clsx';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  ...props
}) {
  const base = 'inline-flex items-center justify-center font-semibold rounded-xl transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary:   'bg-primary-500 hover:bg-primary-600 text-white',
    secondary: 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200',
    danger:    'bg-red-500 hover:bg-red-600 text-white',
    ghost:     'hover:bg-gray-100 text-gray-700',
  };

  const sizes = {
    sm: 'py-2 px-4 text-sm',
    md: 'py-3 px-6 text-sm',
    lg: 'py-4 px-8 text-base',
  };

  return (
    <button
      disabled={disabled || loading}
      className={clsx(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : children}
    </button>
  );
}
