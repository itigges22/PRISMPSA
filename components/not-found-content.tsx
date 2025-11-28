import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Home, ArrowLeft } from 'lucide-react'

interface NotFoundContentProps {
  title?: string
  description?: string
  backLink: string
  backLabel: string
  showHomeLink?: boolean
}

export function NotFoundContent({
  title = "Page Not Found",
  description = "The page you're looking for doesn't exist or has been moved.",
  backLink,
  backLabel,
  showHomeLink = false
}: NotFoundContentProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-12 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          {title}
        </h1>

        <p className="text-gray-600 mb-8 leading-relaxed">
          {description}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg" className="px-8">
            <Link href={backLink} className="flex items-center justify-center gap-2">
              <ArrowLeft className="w-5 h-5" />
              {backLabel}
            </Link>
          </Button>

          {showHomeLink && (
            <Button asChild size="lg" variant="outline" className="px-8">
              <Link href="/welcome" className="flex items-center justify-center gap-2">
                <Home className="w-5 h-5" />
                Home
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
