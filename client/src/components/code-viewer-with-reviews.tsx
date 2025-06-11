import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, X, ChevronRight } from 'lucide-react';
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

function useActionCode(projectId: string, contractName: string, functionName: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/action-code', projectId, contractName, functionName],
    queryFn: async () => {
      const response = await fetch(`/api/action-code/${projectId}/${contractName}/${functionName}`);
      if (!response.ok) {
        throw new Error('Failed to fetch action code');
      }
      return response.text(); // The endpoint returns plain text, not JSON
    },
    enabled: !!(projectId && contractName && functionName)
  });
  
  return {
    data: data || '',
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

  // Debug logging
  console.log('CodeViewerWithReviews - reviews prop:', reviews);
  console.log('CodeViewerWithReviews - reviews length:', reviews?.length);
  console.log('CodeViewerWithReviews - code loaded:', !!code);


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

  console.log('reviewsByLine created:', reviewsByLine);
  console.log('Number of lines with reviews:', Object.keys(reviewsByLine).length);

  // Handle line clicks to toggle inline reviews
  const handleLineClick = (lineNumber: number) => {
    console.log('Line clicked:', lineNumber);
    console.log('Reviews by line:', reviewsByLine);
    console.log('Current expanded lines:', expandedLines);
    
    const hasReviews = reviewsByLine[lineNumber];
    if (hasReviews) {
      console.log('Reviews found for line:', hasReviews);
      const newExpandedLines = new Set(expandedLines);
      if (expandedLines.has(lineNumber)) {
        newExpandedLines.delete(lineNumber);
        console.log('Removing line from expanded');
      } else {
        newExpandedLines.add(lineNumber);
        console.log('Adding line to expanded');
      }
      setExpandedLines(newExpandedLines);
    } else {
      console.log('No reviews found for line:', lineNumber);
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

  // Custom style for syntax highlighter to match dark theme
  const customStyle = {
    ...vscDarkPlus,
    'pre[class*="language-"]': {
      ...vscDarkPlus['pre[class*="language-"]'],
      background: 'rgba(17, 24, 39, 0.5)',
      margin: 0,
    },
    'code[class*="language-"]': {
      ...vscDarkPlus['code[class*="language-"]'],
      background: 'transparent',
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Code viewer with positioned tooltips */}
      <div className="flex-1 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden relative">
        <SyntaxHighlighter
          language="typescript"
          style={customStyle}
          showLineNumbers={true}
          lineNumberContainerStyle={{
            float: 'left',
            paddingRight: '10px',
            backgroundColor: 'rgb(31, 41, 55)',
            borderRight: '1px solid rgb(75, 85, 99)',
            userSelect: 'none'
          }}
          lineNumberStyle={(lineNumber) => {
            const hasReviews = reviewsByLine[lineNumber];
            return {
              color: hasReviews ? getSeverityColor(hasReviews).includes('text-orange') ? '#fb923c' : 
                                  getSeverityColor(hasReviews).includes('text-blue') ? '#60a5fa' :
                                  getSeverityColor(hasReviews).includes('text-red') ? '#f87171' : '#6b7280' : '#6b7280',
              fontSize: '12px',
              minWidth: '3rem',
              textAlign: 'right',
              paddingRight: '1rem',
              fontWeight: hasReviews ? 'bold' : 'normal',
              cursor: hasReviews ? 'pointer' : 'default'
            };
          }}
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: 'rgba(17, 24, 39, 0.5)',
            fontSize: '14px',
            height: '100%',
            overflow: 'auto'
          }}
          wrapLines={true}
          lineProps={(lineNumber) => {
            const hasReviews = reviewsByLine[lineNumber];
            return {
              style: { 
                display: 'block',
                backgroundColor: hasReviews ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                cursor: hasReviews ? 'pointer' : 'default'
              },
              onClick: hasReviews ? () => handleLineClick(lineNumber) : undefined,
              title: hasReviews ? `${hasReviews.length} review(s) on line ${lineNumber} - Click to view` : ''
            };
          }}
        >
          {code}
        </SyntaxHighlighter>

        {/* Positioned review callouts */}
        {Array.from(expandedLines).map((lineNumber) => {
          const lineReviews = reviewsByLine[lineNumber];
          if (!lineReviews) return null;

          const lineHeight = 21;
          const topPosition = (lineNumber - 1) * lineHeight + 20;

          return (
            <div
              key={lineNumber}
              className="absolute left-20 z-20 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-w-lg w-96"
              style={{
                top: `${topPosition}px`
              }}
            >
              <div className="p-3 border-b border-gray-600 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={severityColors[getSeverityFromDescription(lineReviews[0].description)]}>
                    {getSeverityFromDescription(lineReviews[0].description).toUpperCase()}
                  </Badge>
                  <span className="text-xs text-gray-300">
                    Line {lineNumber} • {lineReviews[0].function_name}()
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleLineClick(lineNumber)}
                  className="h-5 w-5 p-0 text-gray-400 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              
              <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
                {lineReviews.map((review, reviewIndex) => (
                  <div key={reviewIndex} className="space-y-2">
                    <div className="text-xs text-gray-200 leading-relaxed">
                      {review.description}
                    </div>
                    {review.suggested_fix && (
                      <div className="bg-gray-900/50 border border-gray-700 rounded-md p-2">
                        <div className="text-xs text-green-400 font-medium mb-1">Fix:</div>
                        <div className="text-xs text-gray-300 leading-relaxed">
                          {review.suggested_fix}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Arrow pointing to the line */}
              <div 
                className="absolute left-0 top-4 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-gray-600"
                style={{ transform: 'translateX(-4px)' }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}