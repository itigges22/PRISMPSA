import { NotFoundContent } from '@/components/not-found-content'

export default function AdminNotFound() {
  return (
    <NotFoundContent
      title="Admin Page Not Found"
      description="The admin page you're looking for doesn't exist."
      backLink="/admin"
      backLabel="Back to Admin"
      showHomeLink
    />
  )
}
