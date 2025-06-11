import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, MessageSquare, ExternalLink } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

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

function useActionCode(projectId: string, contractName: string, functionName: string) {
  return useQuery({
    queryKey: ['/api/action-code', projectId, contractName, functionName],
    queryFn: async () => {
      const response = await fetch(`/api/action-code/${projectId}/${contractName}/${functionName}`);
      if (!response.ok) {
        throw new Error('Failed to fetch action code');
      }
      return response.text();
    },
    enabled: !!projectId && !!contractName && !!functionName
  });
}

export default function CodeViewerWithReviews({ 
  projectId, 
  contractName, 
  functionName, 
  reviews 
}: CodeViewerWithReviewsProps) {
  const { data: code, isLoading, error } = useActionCode(projectId, contractName, functionName);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set());

  if (isLoading) {
    return (
      <div className="animate-pulse bg-gray-800/30 h-64 rounded-lg flex items-center justify-center">
        <span className="text-gray-400">Loading simulation code...</span>
      </div>
    );
  }

  if (error || !code) {
    return (
      <Card className="bg-gray-800/30 border-gray-700">
        <CardContent className="p-4 text-center">
          <AlertTriangle className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
          <p className="text-gray-400">Unable to load simulation code</p>
        </CardContent>
      </Card>
    );
  }

  // Create a map of line numbers to reviews for quick lookup
  const reviewsByLine = reviews.reduce((acc, review) => {
    if (!acc[review.line_number]) {
      acc[review.line_number] = [];
    }
    acc[review.line_number].push(review);
    return acc;
  }, {} as Record<number, Review[]>);

  // Debug logging
  console.log('Reviews data:', reviews);
  console.log('Reviews by line:', reviewsByLine);
  console.log('Expanded lines:', Array.from(expandedLines));
  
  // Also log when overlay rendering happens
  console.log('Total expanded lines to render:', expandedLines.size);

  // Handle line clicks to toggle inline reviews
  const handleLineClick = (lineNumber: number) => {
    console.log('Line clicked:', lineNumber);
    const hasReviews = reviewsByLine[lineNumber];
    console.log('Has reviews:', hasReviews);
    if (hasReviews) {
      const newExpandedLines = new Set(expandedLines);
      if (expandedLines.has(lineNumber)) {
        newExpandedLines.delete(lineNumber);
        console.log('Closing overlay for line:', lineNumber);
      } else {
        newExpandedLines.add(lineNumber);
        console.log('Opening overlay for line:', lineNumber);
      }
      setExpandedLines(newExpandedLines);
      console.log('Expanded lines:', Array.from(newExpandedLines));
    }
  };

  // Custom line renderer for SyntaxHighlighter
  const lineProps = (lineNumber: number) => {
    const hasReviews = reviewsByLine[lineNumber];
    if (hasReviews) {
      const severity = hasReviews.reduce((highest, review) => {
        const reviewSeverity = getSeverityFromDescription(review.description);
        const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
        return severityOrder[reviewSeverity] > severityOrder[highest] ? reviewSeverity : highest;
      }, 'low' as 'low' | 'medium' | 'high' | 'critical');

      return {
        style: {
          backgroundColor: severity === 'critical' ? 'rgba(239, 68, 68, 0.1)' :
                          severity === 'high' ? 'rgba(245, 101, 101, 0.1)' :
                          severity === 'medium' ? 'rgba(251, 191, 36, 0.1)' :
                          'rgba(59, 130, 246, 0.1)',
          borderLeft: `4px solid ${
            severity === 'critical' ? '#dc2626' :
            severity === 'high' ? '#ea580c' :
            severity === 'medium' ? '#d97706' :
            '#2563eb'
          }`,
          paddingLeft: '8px',
          cursor: 'pointer'
        },
        'data-line-number': lineNumber,
        className: 'review-line'
      };
    }
    return {};
  };

  return (
    <div className="space-y-4">
      {/* Code Display */}
      <div 
        className="relative"
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const lineElement = target.closest('span[data-line-number]') || target.closest('.review-line');
          if (lineElement) {
            const lineNumber = parseInt(lineElement.getAttribute('data-line-number') || '0');
            if (lineNumber > 0) {
              handleLineClick(lineNumber);
            }
          }
        }}
      >
        <SyntaxHighlighter
          language="javascript"
          style={vscDarkPlus}
          showLineNumbers={true}
          lineNumberStyle={{ 
            color: '#6b7280', 
            fontSize: '12px',
            paddingRight: '16px',
            minWidth: '40px'
          }}
          customStyle={{
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            fontSize: '14px',
            lineHeight: '1.5'
          }}
          lineProps={lineProps}
        >
          {code}
        </SyntaxHighlighter>

        {/* Review Overlays - positioned above the code */}
        {Array.from(expandedLines).map(lineNumber => {
          const lineReviews = reviewsByLine[lineNumber];
          if (!lineReviews) {
            console.log('No reviews found for expanded line:', lineNumber);
            return null;
          }

          console.log('Rendering overlay for line:', lineNumber, 'with reviews:', lineReviews);

          const severity = lineReviews.reduce((highest, review) => {
            const reviewSeverity = getSeverityFromDescription(review.description);
            const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
            return severityOrder[reviewSeverity] > severityOrder[highest] ? reviewSeverity : highest;
          }, 'low' as 'low' | 'medium' | 'high' | 'critical');

          return (
            <div
              key={lineNumber}
              className="absolute left-4 right-4 z-50 pointer-events-auto"
              style={{ 
                top: `${(lineNumber - 1) * 21 + 40}px`,
                maxWidth: 'calc(100% - 2rem)'
              }}
            >
              <Card className="bg-gray-900/98 border-gray-600 shadow-2xl border-2">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge className={severityColors[severity]}>
                        {severity.toUpperCase()}
                      </Badge>
                      <span className="text-sm text-gray-300">
                        Line {lineNumber} • {lineReviews[0].function_name}()
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLineClick(lineNumber);
                      }}
                      className="text-gray-400 hover:text-white h-6 w-6 p-0"
                    >
                      ×
                    </Button>
                  </div>
                  
                  {lineReviews.map((review, index) => (
                    <div key={index} className="space-y-3 mb-4 last:mb-0">
                      <div>
                        <h4 className="text-sm font-medium text-white mb-1">Issue</h4>
                        <p className="text-sm text-gray-300">{review.description}</p>
                      </div>
                      
                      <div className="bg-blue-900/30 p-3 rounded border-l-2 border-blue-500">
                        <h4 className="text-sm font-medium text-blue-400 mb-1">Suggested Fix</h4>
                        <p className="text-sm text-blue-300">{review.suggested_fix}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          );
        })}

        {/* Review indicators on the right */}
        <div className="absolute top-4 right-4 space-y-1">
          {Object.entries(reviewsByLine).map(([lineNumber, lineReviews]) => {
            const severity = lineReviews.reduce((highest, review) => {
              const reviewSeverity = getSeverityFromDescription(review.description);
              const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
              return severityOrder[reviewSeverity] > severityOrder[highest] ? reviewSeverity : highest;
            }, 'low' as 'low' | 'medium' | 'high' | 'critical');

            const isExpanded = expandedLines.has(parseInt(lineNumber));

            return (
              <Button
                key={lineNumber}
                variant="ghost"
                size="sm"
                className={`h-6 px-2 text-xs ${severityColors[severity]} hover:opacity-80 ${isExpanded ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => handleLineClick(parseInt(lineNumber))}
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                L{lineNumber}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Selected Review Details */}
      {selectedReview && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Badge className={severityColors[getSeverityFromDescription(selectedReview.description)]}>
                  {getSeverityFromDescription(selectedReview.description).toUpperCase()}
                </Badge>
                <span className="text-sm text-gray-300">
                  Line {selectedReview.line_number} • {selectedReview.function_name}()
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedReview(null)}
                className="text-gray-400 hover:text-white"
              >
                ×
              </Button>
            </div>
            
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium text-white mb-1">Issue</h4>
                <p className="text-sm text-gray-300">{selectedReview.description}</p>
              </div>
              
              <div className="bg-blue-900/30 p-3 rounded border-l-2 border-blue-500">
                <h4 className="text-sm font-medium text-blue-400 mb-1">Suggested Fix</h4>
                <p className="text-sm text-blue-300">{selectedReview.suggested_fix}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <div className="text-xs text-gray-500 flex items-center justify-between">
        <span>
          {reviews.length} review{reviews.length !== 1 ? 's' : ''} found • 
          Click highlighted lines for details
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-white h-6 px-2"
          asChild
        >
          <a 
            href={`https://github.com/search?q=repo%3A${projectId}+${contractName}+${functionName}&type=code`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            View on GitHub
          </a>
        </Button>
      </div>
    </div>
  );
}