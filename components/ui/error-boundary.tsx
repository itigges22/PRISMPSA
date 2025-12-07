'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { logger, componentError } from '@/lib/debug-logger';
import { toast } from 'sonner';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  component?: string;
  showRetry?: boolean;
  showHome?: boolean;
  showDebug?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      retryCount: 0,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { component, onError } = this.props;
    
    // Log the error
    componentError(component || 'Unknown', error, {
      component: component || 'Unknown',
      action: 'error_boundary',
      retryCount: this.state.retryCount,
    });

    // Log detailed error information
    logger.error('Error boundary caught error', {
      component: component || 'Unknown',
      action: 'error_boundary',
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    const { retryCount } = this.state;
    
    if (retryCount < this.maxRetries) {
      logger.info('Retrying after error', {
        component: this.props.component || 'Unknown',
        action: 'error_boundary_retry',
        retryCount: retryCount + 1,
      });

      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: retryCount + 1,
      });
    } else {
      logger.warn('Max retries exceeded', {
        component: this.props.component || 'Unknown',
        action: 'error_boundary_max_retries',
        retryCount,
      });
    }
  };

  handleGoHome = () => {
    logger.info('User navigated home from error boundary', {
      component: this.props.component || 'Unknown',
      action: 'error_boundary_home',
    });
    
    window.location.href = '/';
  };

  handleReload = () => {
    logger.info('User reloaded page from error boundary', {
      component: this.props.component || 'Unknown',
      action: 'error_boundary_reload',
    });
    
    window.location.reload();
  };

  handleDebug = () => {
    const { error, errorInfo } = this.state;
    
    logger.debug('User requested debug info', {
      component: this.props.component || 'Unknown',
      action: 'error_boundary_debug',
      error: error?.message,
    });

    // Copy debug info to clipboard
    const debugInfo = {
      error: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2))
      .then(() => {
        toast.success('Debug information copied to clipboard');
      })
      .catch(() => {
        console.log('Debug information:', debugInfo);
        toast.info('Debug information logged to console');
      });
  };

  render() {
    const { hasError, error, retryCount } = this.state;
    const { children, fallback, showRetry = true, showHome = true, showDebug = true } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      const canRetry = showRetry && retryCount < this.maxRetries;
      const isMaxRetries = retryCount >= this.maxRetries;

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 bg-red-100 rounded-full w-fit">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl text-red-600">
                Something went wrong
              </CardTitle>
              <CardDescription className="text-lg">
                An unexpected error occurred in the {this.props.component || 'application'}.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Error details for development */}
              {process.env.NODE_ENV === 'development' && error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-medium text-red-800 mb-2">Error Details:</h4>
                  <p className="text-sm text-red-700 font-mono">{error.message}</p>
                  {error.stack && (
                    <details className="mt-2">
                      <summary className="text-sm text-red-600 cursor-pointer">Stack Trace</summary>
                      <pre className="text-xs text-red-600 mt-2 overflow-auto max-h-32">
                        {error.stack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Retry count info */}
              {isMaxRetries && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    Maximum retry attempts ({this.maxRetries}) exceeded. 
                    Please try refreshing the page or contact support.
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 justify-center">
                {canRetry && (
                  <Button onClick={this.handleRetry} className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Try Again ({this.maxRetries - retryCount} left)
                  </Button>
                )}
                
                <Button 
                  onClick={this.handleReload} 
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reload Page
                </Button>
                
                {showHome && (
                  <Button 
                    onClick={this.handleGoHome} 
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Home className="h-4 w-4" />
                    Go Home
                  </Button>
                )}
                
                {showDebug && process.env.NODE_ENV === 'development' && (
                  <Button 
                    onClick={this.handleDebug} 
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Bug className="h-4 w-4" />
                    Copy Debug Info
                  </Button>
                )}
              </div>

              {/* Help text */}
              <div className="text-center text-sm text-muted-foreground">
                <p>
                  If this problem persists, please contact support with the error details above.
                </p>
                {process.env.NODE_ENV === 'development' && (
                  <p className="mt-2 text-xs">
                    Development mode: Error details are shown above for debugging.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return children;
  }
}

// Convenience wrapper for functional components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Specialized error boundaries for common use cases
export function OrgChartErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary 
      component="OrgChart"
      fallback={
        <div className="h-96 flex items-center justify-center bg-muted/20 rounded-lg">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Failed to load organization chart. Please try refreshing the page.
            </p>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export function RoleManagementErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary 
      component="RoleManagement"
      fallback={
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Role Management Error
              </CardTitle>
              <CardDescription>
                There was an error loading the role management interface.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => window.location.reload()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reload Page
              </Button>
            </CardContent>
          </Card>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export function HierarchyViewErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary 
      component="HierarchyView"
      fallback={
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">
            Failed to load role hierarchy. Please try again.
          </p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export default ErrorBoundary;
