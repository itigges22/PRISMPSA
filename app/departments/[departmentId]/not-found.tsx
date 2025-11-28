import { NotFoundContent } from '@/components/not-found-content'

export default function DepartmentNotFound() {
  return (
    <NotFoundContent
      title="Department Not Found"
      description="The department you're looking for doesn't exist or you don't have permission to view it."
      backLink="/departments"
      backLabel="Back to Departments"
      showHomeLink
    />
  )
}
