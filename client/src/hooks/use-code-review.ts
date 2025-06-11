import { useQuery } from '@tanstack/react-query';

interface CodeReview {
  function_name: string;
  contract_name: string;
  review_summary: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  issues: Array<{
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    line_number?: number;
    recommendation: string;
  }>;
  recommendations: string[];
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