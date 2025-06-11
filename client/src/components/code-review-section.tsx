import { useState } from 'react';
import { useCodeReview } from '@/hooks/use-code-review';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  ChevronDown, 
  ChevronRight,
  ExternalLink,
  Play
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import CodeViewerWithReviews from './code-viewer-with-reviews';

interface CodeReviewSectionProps {
  projectId: string;
  contractName: string;
  functionName: string;
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

const severityIcons = {
  low: CheckCircle,
  medium: AlertTriangle,
  high: AlertTriangle,
  critical: XCircle
};

export default function CodeReviewSection({ projectId, contractName, functionName }: CodeReviewSectionProps) {
  const { data: review, isLoading, error } = useCodeReview(projectId, contractName, functionName);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isImplementing, setIsImplementing] = useState(false);
  const { toast } = useToast();

  // Debug logging
  console.log('CodeReviewSection props:', { projectId, contractName, functionName });
  console.log('CodeReviewSection state:', { review, isLoading, error });

  const handleImplementRecommendations = async () => {
    setIsImplementing(true);
    try {
      // This would trigger the implementation of recommendations
      // For now, we'll just show a toast message
      toast({
        title: "Implementation Started",
        description: "Code review recommendations are being implemented...",
      });
      
      // Here you would make an API call to implement the recommendations
      // await apiRequest('POST', `/api/implement-review/${projectId}/${contractName}/${functionName}`);
      
    } catch (error) {
      toast({
        title: "Implementation Failed",
        description: "Failed to implement review recommendations",
        variant: "destructive",
      });
    } finally {
      setIsImplementing(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-gray-900/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Code Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            <span className="ml-3 text-gray-400">Loading code review...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !review) {
    return (
      <Card className="bg-gray-900/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Code Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="border-yellow-500/30 bg-yellow-500/10">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            <AlertDescription className="text-yellow-300">
              No code review available for this action yet.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Calculate overall severity based on review content
  const overallSeverity = review.reviews?.length > 0 ? 
    review.reviews.reduce((highest, item) => {
      const severity = getSeverityFromDescription(item.description);
      const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
      return severityOrder[severity] > severityOrder[highest] ? severity : highest;
    }, 'low' as 'low' | 'medium' | 'high' | 'critical') : 'low';

  const SeverityIcon = severityIcons[overallSeverity];

  return (
    <Card className="bg-gray-900/50 border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Code Review
            <Badge className={severityColors[overallSeverity]}>
              <SeverityIcon className="h-3 w-3 mr-1" />
              {overallSeverity.toUpperCase()}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-gray-600 hover:bg-gray-800"
              asChild
            >
              <a 
                href={review.html_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                View File
              </a>
            </Button>
            <Button
              onClick={handleImplementRecommendations}
              disabled={isImplementing}
              className="bg-green-600 hover:bg-green-700"
              size="sm"
            >
              <Play className="h-3 w-3 mr-1" />
              {isImplementing ? 'Implementing...' : 'Implement Reviews'}
            </Button>
          </div>
        </div>
        <CardDescription className="text-gray-400">
          Automated security and quality analysis for {contractName}.{functionName}()
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Overall Assessment */}
        {review.overall_assessment && review.overall_assessment.length > 0 && (
          <div className="bg-gray-800/50 p-4 rounded-lg">
            <h4 className="font-medium text-white mb-2">Overall Assessment</h4>
            {review.overall_assessment.map((assessment, index) => (
              <p key={index} className="text-gray-300 text-sm mb-2 last:mb-0">{assessment}</p>
            ))}
          </div>
        )}

        {/* Review Items */}
        {review.reviews && review.reviews.length > 0 && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors">
              <span className="font-medium text-white flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
                Review Items ({review.reviews.length})
              </span>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </CollapsibleTrigger>
            
            <CollapsibleContent className="space-y-3 mt-3">
              <CodeViewerWithReviews 
                projectId={projectId}
                contractName={contractName}
                functionName={functionName}
                reviews={review.reviews}
              />
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* General Recommendations */}
        {review.recommendations && review.recommendations.length > 0 && (
          <div className="bg-green-900/20 p-4 rounded-lg border border-green-800/30">
            <h4 className="font-medium text-green-400 mb-3 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Recommendations
            </h4>
            <ul className="space-y-2">
              {review.recommendations.map((recommendation, index) => (
                <li key={index} className="text-green-300 text-sm flex items-start gap-2">
                  <span className="text-green-400 mt-1">•</span>
                  <span>{recommendation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* File Path */}
        <div className="text-xs text-gray-500 font-mono">
          Review file: {review.file_path}
        </div>
      </CardContent>
    </Card>
  );
}