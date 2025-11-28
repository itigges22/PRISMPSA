import { NotFoundContent } from '@/components/not-found-content'

export default function NotFound() {
  return (
    <NotFoundContent
      backLink="/welcome"
      backLabel="Back to Welcome"
    />
  )
}
