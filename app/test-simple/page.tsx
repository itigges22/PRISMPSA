'use client';

import { useState, useEffect } from 'react';

export default function TestSimplePage() {
  const [data, setData] = useState<{ message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setData({ message: 'Test data loaded successfully' });
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading test page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold mb-4">Test Simple Page</h1>
      <p className="text-gray-600">This is a simple test page to verify the basic setup works.</p>
      <pre className="mt-4 p-4 bg-gray-100 rounded">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
