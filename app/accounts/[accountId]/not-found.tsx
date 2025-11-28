import { NotFoundContent } from '@/components/not-found-content'

export default function AccountNotFound() {
  return (
    <NotFoundContent
      title="Account Not Found"
      description="The account you're looking for doesn't exist or you don't have permission to view it."
      backLink="/accounts"
      backLabel="Back to Accounts"
      showHomeLink
    />
  )
}
