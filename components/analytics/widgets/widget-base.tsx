'use client';

import { ReactNode, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Download,
  RefreshCw,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type DateRange = '7d' | '30d' | '90d' | 'ytd' | 'all';

interface WidgetBaseProps {
  title: string;
  description?: string;
  children: ReactNode;
  isLoading?: boolean;
  error?: Error | null;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  showDateRange?: boolean;
  onExport?: (format: 'csv' | 'png') => void;
  onRefresh?: () => void;
  className?: string;
  fullWidth?: boolean;
  minHeight?: string;
}

const dateRangeLabels: Record<DateRange, string> = {
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  '90d': 'Last 90 Days',
  'ytd': 'Year to Date',
  'all': 'All Time',
};

export function WidgetBase({
  title,
  description,
  children,
  isLoading = false,
  error = null,
  dateRange = '30d',
  onDateRangeChange,
  showDateRange = true,
  onExport,
  onRefresh,
  className = '',
  fullWidth = false,
  minHeight = '300px',
}: WidgetBaseProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleExport = (format: 'csv' | 'png') => {
    if (onExport) {
      onExport(format);
    }
  };

  if (error) {
    return (
      <Card className={`${className} ${fullWidth ? 'col-span-full' : ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
          {description && (
            <CardDescription className="text-red-500">{error.message}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div
            className="flex items-center justify-center text-muted-foreground"
            style={{ minHeight }}
          >
            Unable to load widget data
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={`${className} ${fullWidth ? 'col-span-full' : ''} ${
        isFullscreen ? 'fixed inset-4 z-50 overflow-auto' : ''
      }`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-base font-medium">{title}</CardTitle>
            {description && !isCollapsed && (
              <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Date Range Selector */}
            {showDateRange && onDateRangeChange && !isCollapsed && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    {dateRangeLabels[dateRange]}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {Object.entries(dateRangeLabels).map(([value, label]) => (
                    <DropdownMenuItem
                      key={value}
                      onClick={() => onDateRangeChange(value as DateRange)}
                      className={dateRange === value ? 'bg-accent' : ''}
                    >
                      {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Refresh Button */}
            {onRefresh && !isCollapsed && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={onRefresh}
                title="Refresh"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}

            {/* Export Menu */}
            {onExport && !isCollapsed && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Export">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('csv')}>
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('png')}>
                    Export as PNG
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Fullscreen Toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </Button>

            {/* Collapse Toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setIsCollapsed(!isCollapsed)}
              title={isCollapsed ? 'Expand' : 'Collapse'}
            >
              {isCollapsed ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent>
          {isLoading ? (
            <div style={{ minHeight }}>
              <Skeleton className="w-full h-full" style={{ minHeight }} />
            </div>
          ) : (
            <div style={{ minHeight }}>{children}</div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// Stat card for displaying key metrics within widgets
interface StatCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: ReactNode;
}

export function StatCard({ label, value, change, changeLabel, icon }: StatCardProps) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="mt-1">
        <span className="text-2xl font-semibold">{value}</span>
        {change !== undefined && (
          <span
            className={`ml-2 text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}
          >
            {isPositive ? '+' : ''}
            {change}%{changeLabel && ` ${changeLabel}`}
          </span>
        )}
      </div>
    </div>
  );
}

// Empty state component for widgets with no data
interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
}

export function WidgetEmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center p-4">
      {icon && <div className="text-muted-foreground mb-3">{icon}</div>}
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
  );
}
