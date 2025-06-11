import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, X, ChevronRight, Plus, Save } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Review {
  line_number: number;
  description: string;
  function_name: string;
  suggested_fix: string;
  is_custom?: boolean;
  id?: string;
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
  const [showAddReview, setShowAddReview] = useState<number | null>(null);
  const [customReviews, setCustomReviews] = useState<Review[]>([]);
  const [newReview, setNewReview] = useState({
    line_number: 0,
    description: '',
    suggested_fix: '',
    function_name: ''
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Function to automatically infer method name from line content
  const inferFunctionName = (lineNumber: number, codeContent: string): string => {
    const lines = codeContent.split('\n');
    const currentLine = lines[lineNumber - 1]?.toLowerCase() || '';
    
    // Check for common patterns
    if (currentLine.includes('import') || currentLine.includes('require')) return 'import';
    if (currentLine.includes('constructor')) return 'constructor';
    if (currentLine.includes('initialize') || currentLine.includes('init')) return 'initialize';
    if (currentLine.includes('execute') || currentLine.includes('run')) return 'execute';
    if (currentLine.includes('validate') || currentLine.includes('check')) return 'validate';
    
    // Look for function declarations nearby
    for (let i = Math.max(0, lineNumber - 5); i < Math.min(lines.length, lineNumber + 5); i++) {
      const line = lines[i]?.toLowerCase() || '';
      if (line.includes('function ') || line.includes('def ') || line.includes('async ')) {
        const match = line.match(/(?:function|def|async)\s+(\w+)/);
        if (match) return match[1];
      }
    }
    
    return functionName; // Default to the current function name
  };

  // Load custom reviews from localStorage
  const loadCustomReviews = (): Review[] => {
    try {
      const stored = localStorage.getItem(`custom-reviews-${projectId}-${contractName}-${functionName}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  // Save custom reviews to localStorage
  const saveCustomReviews = (reviews: Review[]) => {
    localStorage.setItem(`custom-reviews-${projectId}-${contractName}-${functionName}`, JSON.stringify(reviews));
  };

  // Initialize custom reviews from localStorage on component mount
  useEffect(() => {
    setCustomReviews(loadCustomReviews());
  }, [projectId, contractName, functionName]);

  // Handle saving custom review locally
  const handleSaveCustomReview = () => {
    if (!newReview.description.trim()) {
      toast({
        title: "Error",
        description: "Please provide a description for the review.",
        variant: "destructive",
      });
      return;
    }

    const customReview: Review = {
      id: `custom-${Date.now()}`,
      line_number: newReview.line_number,
      description: newReview.description,
      suggested_fix: newReview.suggested_fix,
      function_name: newReview.function_name,
      is_custom: true
    };

    const updatedCustomReviews = [...customReviews, customReview];
    setCustomReviews(updatedCustomReviews);
    saveCustomReviews(updatedCustomReviews);

    toast({
      title: "Review Added",
      description: "Your custom review has been saved locally.",
    });

    setShowAddReview(null);
    setNewReview({
      line_number: 0,
      description: '',
      suggested_fix: '',
      function_name: ''
    });
  };

  // Handle adding a new review
  const handleAddReview = (lineNumber: number) => {
    const inferredFunction = inferFunctionName(lineNumber, code);
    setNewReview({
      line_number: lineNumber,
      description: '',
      suggested_fix: '',
      function_name: inferredFunction
    });
    setShowAddReview(lineNumber);
  };

  // Combine API reviews with custom reviews
  const allReviews = [...reviews, ...customReviews];

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

  // Group all reviews (API + custom) by line number
  const reviewsByLine = allReviews.reduce((acc, review) => {
    if (!acc[review.line_number]) {
      acc[review.line_number] = [];
    }
    acc[review.line_number].push(review);
    return acc;
  }, {} as Record<number, Review[]>);

  console.log('reviewsByLine created:', reviewsByLine);
  console.log('Number of lines with reviews:', Object.keys(reviewsByLine).length);

  // Handle line clicks to toggle inline reviews or show add review option
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
      // Show add review option for lines without reviews
      handleAddReview(lineNumber);
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
                cursor: 'pointer'
              },
              onClick: () => handleLineClick(lineNumber),
              title: hasReviews ? `${hasReviews.length} review(s) on line ${lineNumber} - Click to view` : `Click to add a review on line ${lineNumber}`
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

        {/* Add review form */}
        {showAddReview && (
          <div
            className="absolute left-20 z-20 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-w-lg w-96"
            style={{
              top: `${(showAddReview - 1) * 21 + 20}px`
            }}
          >
            <div className="p-3 border-b border-gray-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-300">
                  Add Review • Line {showAddReview} • {newReview.function_name}()
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddReview(null)}
                className="h-5 w-5 p-0 text-gray-400 hover:text-white"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            
            <div className="p-3 space-y-3">
              <div>
                <textarea
                  placeholder="Describe the issue or concern..."
                  value={newReview.description}
                  onChange={(e) => setNewReview(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded-md p-2 text-xs text-gray-200 placeholder-gray-500 resize-none"
                  rows={3}
                />
              </div>
              
              <div>
                <textarea
                  placeholder="Suggested fix (optional)..."
                  value={newReview.suggested_fix}
                  onChange={(e) => setNewReview(prev => ({ ...prev, suggested_fix: e.target.value }))}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded-md p-2 text-xs text-gray-200 placeholder-gray-500 resize-none"
                  rows={2}
                />
              </div>
              
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveCustomReview}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                >
                  Add Review
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddReview(null)}
                  className="flex-1 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>

            {/* Arrow pointing to the line */}
            <div 
              className="absolute left-0 top-4 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-gray-600"
              style={{ transform: 'translateX(-4px)' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}