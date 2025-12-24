'use client';

import { ReactNode } from 'react';

interface DashboardGridProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
}

const gapClasses = {
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-6',
};

const columnClasses = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 lg:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4',
};

export function DashboardGrid({
  children,
  columns = 2,
  gap = 'md',
}: DashboardGridProps) {
  return (
    <div className={`grid ${columnClasses[columns]} ${gapClasses[gap]}`}>
      {children}
    </div>
  );
}

// Section component for grouping related widgets
interface DashboardSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function DashboardSection({
  title,
  description,
  children,
  className = '',
}: DashboardSectionProps) {
  return (
    <section className={`space-y-4 ${className}`}>
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

// Summary stats row for top-level metrics
interface SummaryStatsProps {
  children: ReactNode;
}

export function SummaryStats({ children }: SummaryStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {children}
    </div>
  );
}

interface SummaryStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: ReactNode;
}

export function SummaryStatCard({
  title,
  value,
  subtitle,
  trend,
  icon,
}: SummaryStatCardProps) {
  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{title}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="mt-2">
        <span className="text-3xl font-bold">{value}</span>
        {trend && (
          <span
            className={`ml-2 text-sm ${
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {trend.isPositive ? '+' : ''}
            {trend.value}%
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
    </div>
  );
}
