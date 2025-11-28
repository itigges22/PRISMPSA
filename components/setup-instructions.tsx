'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function SetupInstructions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>🚨 Database Setup Required</CardTitle>
        <CardDescription>
          The database schema needs to be set up before you can create accounts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <h4 className="font-medium text-yellow-800 mb-2">⚠️ Action Required</h4>
            <p className="text-sm text-yellow-700">
              You need to run the database schema SQL script in your Supabase Cloud SQL Editor.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Steps to Fix:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>
                Go to your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Supabase Dashboard
                </a>
              </li>
              <li>Navigate to your project</li>
              <li>Go to the <strong>SQL Editor</strong> tab</li>
              <li>Copy and paste the complete SQL schema script I provided earlier</li>
              <li>Click <strong>Run</strong> to execute the script</li>
              <li>Refresh this page and try creating an account again</li>
            </ol>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h4 className="font-medium text-blue-800 mb-2">💡 What This Does</h4>
            <p className="text-sm text-blue-700">
              The SQL script creates all the necessary tables (user_profiles, departments, roles, etc.) 
              and sets up the proper Row Level Security (RLS) policies for your PSA platform.
            </p>
          </div>

          <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
            <h4 className="font-medium text-gray-800 mb-2">🔍 Need the SQL Script?</h4>
            <p className="text-sm text-gray-700">
              The complete SQL script was provided in my previous response. It includes:
            </p>
            <ul className="text-sm text-gray-600 mt-2 list-disc list-inside">
              <li>All required tables (departments, roles, user_profiles, accounts, projects, tasks, etc.)</li>
              <li>Proper foreign key relationships</li>
              <li>Row Level Security (RLS) policies</li>
              <li>Initial data seeding (departments and roles)</li>
              <li>Indexes for performance</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}