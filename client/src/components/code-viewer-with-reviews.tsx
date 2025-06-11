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
      {/* Code viewer with overlay buttons */}
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
              fontWeight: hasReviews ? 'bold' : 'normal'
            };
          }}
          customStyle={{
            margin: 0,
            padding: '1rem',
            paddingLeft: '4rem',
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
                backgroundColor: hasReviews ? 'rgba(59, 130, 246, 0.1)' : 'transparent'
              },
              title: hasReviews ? `${hasReviews.length} review(s) on line ${lineNumber}` : ''
            };
          }}
        >
          {code}
        </SyntaxHighlighter>
        
        {/* Clickable review indicators overlay */}
        <div className="absolute left-0 top-0 h-full pointer-events-none">
          {Object.entries(reviewsByLine).map(([lineNumberStr, lineReviews]) => {
            const lineNumber = parseInt(lineNumberStr);
            const lineHeight = 20; // Approximate line height
            const topPosition = (lineNumber - 1) * lineHeight + 16; // Offset for padding
            
            return (
              <button
                key={lineNumber}
                className="absolute left-1 w-6 h-5 pointer-events-auto rounded text-xs font-bold hover:opacity-80 transition-opacity"
                style={{
                  top: `${topPosition}px`,
                  backgroundColor: getSeverityColor(lineReviews).includes('text-orange') ? '#fb923c' : 
                                   getSeverityColor(lineReviews).includes('text-blue') ? '#60a5fa' :
                                   getSeverityColor(lineReviews).includes('text-red') ? '#f87171' : '#60a5fa',
                  color: 'white'
                }}
                onClick={() => handleLineClick(lineNumber)}
                title={`${lineReviews.length} review(s) on line ${lineNumber} - Click to view`}
              >
                {lineReviews.length}
              </button>
            );
          })}
        </div>
      </div>

      {/* Review overlays below the code */}
      {expandedLines.size > 0 && (
        <div className="mt-4 space-y-3">
          {Array.from(expandedLines).map((lineNumber) => {
            const lineReviews = reviewsByLine[lineNumber];
            if (!lineReviews) return null;

            return (
              <Card key={lineNumber} className="bg-gray-900 border-gray-600 shadow-lg">
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
            );
          })}
        </div>
      )}
    </div>
  );
}