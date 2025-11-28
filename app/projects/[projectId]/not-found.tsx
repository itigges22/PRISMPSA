import { NotFoundContent } from '@/components/not-found-content'

export default function ProjectNotFound() {
  return (
    <NotFoundContent
      title="Project Not Found"
      description="The project you're looking for doesn't exist or you don't have permission to view it."
      backLink="/projects"
      backLabel="Back to Projects"
      showHomeLink
    />
  )
}
