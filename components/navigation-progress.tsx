'use client';

import { useEffect, useState, useCallback, createContext, useContext, ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// Context for navigation loading state
interface NavigationContextType {
  isNavigating: boolean;
  startNavigation: () => void;
  endNavigation: () => void;
}

const NavigationContext = createContext<NavigationContextType>({
  isNavigating: false,
  startNavigation: () => {},
  endNavigation: () => {},
});

export function useNavigation() {
  return useContext(NavigationContext);
}

// Provider component
export function NavigationProvider({ children }: { children: ReactNode }) {
  const [isNavigating, setIsNavigating] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const startNavigation = useCallback(() => {
    setIsNavigating(true);
  }, []);

  const endNavigation = useCallback(() => {
    setIsNavigating(false);
  }, []);

  // End navigation when route changes
  useEffect(() => {
    setIsNavigating(false);
  }, [pathname, searchParams]);

  // Intercept clicks on links to start loading
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');

      if (anchor) {
        const href = anchor.getAttribute('href');
        const isExternal = anchor.target === '_blank' || anchor.rel?.includes('external');
        const isDownload = anchor.hasAttribute('download');
        const isHashLink = href?.startsWith('#');
        const isSameOrigin = href?.startsWith('/') || href?.startsWith(window.location.origin);

        // Only trigger for internal navigation links
        if (href && !isExternal && !isDownload && !isHashLink && isSameOrigin) {
          // Check if it's actually navigating to a different page
          const url = new URL(href, window.location.origin);
          if (url.pathname !== pathname) {
            setIsNavigating(true);
          }
        }
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [pathname]);

  return (
    <NavigationContext.Provider value={{ isNavigating, startNavigation, endNavigation }}>
      {children}
    </NavigationContext.Provider>
  );
}

// Progress bar component
export function NavigationProgress() {
  const { isNavigating } = useNavigation();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let timeout: NodeJS.Timeout;

    if (isNavigating) {
      setVisible(true);
      setProgress(0);

      // Animate progress
      interval = setInterval(() => {
        setProgress(prev => {
          // Quick start, slow down as we approach 90%
          if (prev < 30) return prev + 8;
          if (prev < 60) return prev + 4;
          if (prev < 85) return prev + 1;
          return prev + 0.2;
        });
      }, 50);
    } else {
      // Complete the progress bar
      setProgress(100);
      timeout = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
    }

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isNavigating]);

  if (!visible) return null;

  return (
    <>
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-[9999] h-1 bg-transparent pointer-events-none">
        <div
          className="h-full bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 shadow-lg shadow-blue-500/30 transition-all duration-150 ease-out"
          style={{
            width: `${progress}%`,
            opacity: progress === 100 ? 0 : 1,
            transition: progress === 100 ? 'opacity 0.3s ease-out, width 0.15s ease-out' : 'width 0.15s ease-out'
          }}
        />
      </div>

      {/* Spinner overlay for longer loads */}
      {progress > 50 && progress < 100 && (
        <div className="fixed inset-0 z-[9998] bg-black/5 backdrop-blur-[1px] pointer-events-none flex items-center justify-center opacity-0 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl px-6 py-4 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">Loading...</span>
          </div>
        </div>
      )}
    </>
  );
}

// Combined export for easy use
export function NavigationProgressProvider({ children }: { children: ReactNode }) {
  return (
    <NavigationProvider>
      <NavigationProgress />
      {children}
    </NavigationProvider>
  );
}
