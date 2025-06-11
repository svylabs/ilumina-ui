import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, X, ChevronRight } from 'lucide-react';

interface Review {
  line_number: number;
  description: string;
  function_name: string;
  suggested_fix: string;
}

interface CodeViewerWithReviewsProps {
  projectId: string;
  contractName: string;
  functionName: string;
  reviews: Review[];
}

function useActionCode(projectId: string, contractName: string, functionName: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/action-code', projectId, contractName, functionName],
    enabled: !!(projectId && contractName && functionName)
  });
  
  return {
    data: data?.code || '',
    isLoading,
    error
  };
}

const getSeverityFromDescription = (description: string): 'low' | 'medium' | 'high' | 'critical' => {
  const lowerDesc = description.toLowerCase();
  if (lowerDesc.includes('critical') || lowerDesc.includes('security') || lowerDesc.includes('vulnerable')) {
    return 'critical';
  }
  if (lowerDesc.includes('error') || lowerDesc.includes('fail') || lowerDesc.includes('incorrect')) {
    return 'high';
  }
  if (lowerDesc.includes('should') || lowerDesc.includes('consider') || lowerDesc.includes('improve')) {
    return 'medium';
  }
  return 'low';
};

const severityColors = {
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30'
};

const severityLineColors = {
  low: 'text-blue-400 bg-blue-500/20',
  medium: 'text-yellow-400 bg-yellow-500/20',
  high: 'text-orange-400 bg-orange-500/20',
  critical: 'text-red-400 bg-red-500/20'
};

export default function CodeViewerWithReviews({ 
  projectId, 
  contractName, 
  functionName, 
  reviews 
}: CodeViewerWithReviewsProps) {
  const { data: code, isLoading, error } = useActionCode(projectId, contractName, functionName);
  const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        <span className="ml-3 text-gray-400">Loading code...</span>
      </div>
    );
  }

  if (error || !code) {
    return (
      <div className="text-center py-8 text-gray-400">
        Failed to load action code.
      </div>
    );
  }

  // Group reviews by line number
  const reviewsByLine = reviews.reduce((acc, review) => {
    if (!acc[review.line_number]) {
      acc[review.line_number] = [];
    }
    acc[review.line_number].push(review);
    return acc;
  }, {} as Record<number, Review[]>);

  // Handle line clicks to toggle inline reviews
  const handleLineClick = (lineNumber: number) => {
    const hasReviews = reviewsByLine[lineNumber];
    if (hasReviews) {
      const newExpandedLines = new Set(expandedLines);
      if (expandedLines.has(lineNumber)) {
        newExpandedLines.delete(lineNumber);
      } else {
        newExpandedLines.add(lineNumber);
      }
      setExpandedLines(newExpandedLines);
    }
  };

  const getSeverityColor = (lineReviews: Review[]): string => {
    const severity = lineReviews.reduce((highest, review) => {
      const reviewSeverity = getSeverityFromDescription(review.description);
      const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
      return severityOrder[reviewSeverity] > severityOrder[highest] ? reviewSeverity : highest;
    }, 'low' as 'low' | 'medium' | 'high' | 'critical');
    return severityLineColors[severity];
  };

  return (
    <div className="space-y-4">
      <div 
        className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden"
        style={{ 
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
        }}
      >
        {/* Render code with inline review overlays */}
        {code.split('\n').map((line, index) => {
          const lineNumber = index + 1;
          const hasReviews = reviewsByLine[lineNumber];
          const isExpanded = expandedLines.has(lineNumber);
          const lineReviews = reviewsByLine[lineNumber];
          
          return (
            <div key={lineNumber}>
              {/* Code line */}
              <div className="flex hover:bg-gray-800/30 transition-colors">
                {/* Line number */}
                <div className="flex-shrink-0 w-12 pr-2 text-right text-xs select-none bg-gray-800 border-r border-gray-600">
                  <button
                    className={`w-full text-right px-1 py-1 text-xs leading-5 hover:bg-gray-700 transition-colors ${
                      hasReviews 
                        ? `${getSeverityColor(hasReviews)} cursor-pointer font-medium` 
                        : 'text-gray-500'
                    }`}
                    onClick={() => hasReviews && handleLineClick(lineNumber)}
                    disabled={!hasReviews}
                    title={hasReviews ? `${hasReviews.length} review(s) - Click to toggle` : ''}
                  >
                    {lineNumber}
                  </button>
                </div>
                
                {/* Code content */}
                <div className="flex-1 bg-gray-900 px-4 py-1">
                  <pre 
                    className="text-sm leading-5 text-gray-100"
                    style={{ margin: 0, fontFamily: 'inherit' }}
                  >
                    <code>{line || ' '}</code>
                  </pre>
                </div>

                {/* Review indicator */}
                {hasReviews && (
                  <div className="flex-shrink-0 w-8 flex items-center justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-5 w-5 p-0 ${getSeverityColor(hasReviews)} hover:opacity-80`}
                      onClick={() => handleLineClick(lineNumber)}
                      title={`${hasReviews.length} review(s) on line ${lineNumber}`}
                    >
                      <MessageSquare className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Review overlay - appears directly below the line */}
              {isExpanded && lineReviews && (
                <div className="ml-12 mr-4 mt-1 mb-2">
                  <Card className="bg-gray-900 border-gray-600 shadow-2xl border-2">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge className={severityColors[getSeverityFromDescription(lineReviews[0].description)]}>
                            {getSeverityFromDescription(lineReviews[0].description).toUpperCase()}
                          </Badge>
                          <span className="text-sm text-gray-300">
                            Line {lineNumber} • {lineReviews[0].function_name}()
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleLineClick(lineNumber)}
                          className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {lineReviews.map((review, reviewIndex) => (
                          <div key={reviewIndex} className="space-y-2">
                            <div className="text-sm text-gray-200">
                              {review.description}
                            </div>
                            {review.suggested_fix && (
                              <div className="bg-gray-800/50 border border-gray-700 rounded-md p-3">
                                <div className="text-xs text-green-400 font-medium mb-1">Suggested Fix:</div>
                                <div className="text-sm text-gray-300">
                                  {review.suggested_fix}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Review summary */}
      {reviews.length > 0 && (
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>{reviews.length} review{reviews.length !== 1 ? 's' : ''} found</span>
          <div className="flex gap-2">
            {Object.entries(
              reviews.reduce((acc, review) => {
                const severity = getSeverityFromDescription(review.description);
                acc[severity] = (acc[severity] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([severity, count]) => (
              <Badge key={severity} className={severityColors[severity as keyof typeof severityColors]} variant="outline">
                {count} {severity}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}