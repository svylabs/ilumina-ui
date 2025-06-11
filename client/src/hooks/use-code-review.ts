import { useQuery } from '@tanstack/react-query';

interface CodeReview {
  reviews: Array<{
    line_number: number;
    description: string;
    function_name: string;
    suggested_fix: string;
  }>;
  overall_assessment: string[];
  file_path: string;
  html_url: string;
  last_modified: string;
}

export function useCodeReview(projectId: string | undefined, contractName: string, functionName: string) {
  return useQuery<CodeReview>({
    queryKey: ['/api/code-review', projectId, contractName, functionName],
    enabled: !!projectId && !!contractName && !!functionName,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}