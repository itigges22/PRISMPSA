'use client'

import { SWRConfig } from 'swr'
import { ReactNode } from 'react'

// Global fetcher with error handling
const fetcher = async (url: string) => {
  const res = await fetch(url)

  // Handle non-OK responses
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.')
    // Attach extra info to the error object
    const info = await res.json().catch(() => ({ error: res.statusText }))
    Object.assign(error, { info, status: res.status })
    throw error
  }

  return res.json()
}

export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        // Dedupe requests within 2 seconds
        dedupingInterval: 2000,
        // Keep data fresh
        focusThrottleInterval: 5000,
        // Revalidate on focus (when user returns to tab)
        revalidateOnFocus: true,
        // Revalidate on reconnect
        revalidateOnReconnect: true,
        // Don't revalidate on mount if data is fresh
        revalidateIfStale: false,
        // Keep cache for 5 minutes
        errorRetryCount: 2,
        // Retry with exponential backoff
        errorRetryInterval: 5000,
        // Performance: Use cache immediately while revalidating in background
        suspense: false,
        // Enable SWR to automatically refetch when window regains focus
        revalidateOnMount: true,
      }}
    >
      {children}
    </SWRConfig>
  )
}
