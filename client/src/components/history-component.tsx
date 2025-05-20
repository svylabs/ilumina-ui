import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  AlertCircle, 
  Clock, 
  Loader2, 
  RefreshCw 
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type HistoryLogEntry = {
  id: string;
  created_at: string;
  step: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  details?: string;
  metadata?: any;
  step_metadata?: any;
  executed_at?: string;
  user_prompt?: string;
};

// History Component to display submission history logs
export default function HistoryComponent({ submissionId }: { submissionId: string }) {
  const { toast } = useToast();
  const [historyLogs, setHistoryLogs] = useState<HistoryLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch history data from the API
  const fetchHistoryData = useCallback(async () => {
    if (!submissionId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching history data for submission: ${submissionId}`);
      const response = await fetch(`/api/submission-history/${submissionId}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`History API error (${response.status}): ${errorText}`);
        throw new Error(errorText || `Failed to fetch history (${response.status})`);
      }
      
      const data = await response.json();
      console.log("History API response:", data);
      
      if (data.success && data.history && Array.isArray(data.history)) {
        console.log(`Received ${data.history.length} history entries`);
        // Sort history logs by timestamp in descending order (newest first)
        const sortedHistory = [...data.history].sort((a, b) => {
          const dateA = new Date(a.executed_at || a.created_at);
          const dateB = new Date(b.executed_at || b.created_at);
          return dateB.getTime() - dateA.getTime();
        });
        
        setHistoryLogs(sortedHistory);
      } else {
        console.log("No history entries found or invalid format");
        setHistoryLogs([]);
      }
    } catch (err) {
      console.error("Error fetching history:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch history data");
      toast({
        title: "Failed to fetch history",
        description: err instanceof Error ? err.message : "An error occurred while fetching history data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [submissionId, toast]);
  
  // Fetch history data on component mount and when submissionId changes
  useEffect(() => {
    if (submissionId) {
      fetchHistoryData();
      
      // Auto-refresh if any log entry has 'in_progress' status
      const intervalId = setInterval(() => {
        if (historyLogs.some(log => log.status === "in_progress")) {
          fetchHistoryData();
        }
      }, 5000);
      
      return () => clearInterval(intervalId);
    }
  }, [fetchHistoryData, historyLogs, submissionId]);
  
  // Format step name for display
  const formatStepName = (step: string): string => {
    return step
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  
  // Format timestamp to human-readable format
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return format(date, "MMM d, yyyy h:mm a");
    } catch (e) {
      return timestamp;
    }
  };
  
  // Get status badge based on status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800 border-green-300">Completed</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">In Progress</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-800 border-red-300">Failed</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  // Render metadata based on step type
  const renderMetadata = (step: string, metadata: string | any) => {
    try {
      // Try to parse metadata as JSON if it's a string
      const metadataObj = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      
      return (
        <pre className="text-xs bg-gray-900 p-3 rounded overflow-auto max-h-64 text-gray-400">
          {JSON.stringify(metadataObj, null, 2)}
        </pre>
      );
    } catch (e) {
      // If parsing fails, just show as string
      return (
        <p className="text-sm text-gray-400 whitespace-pre-wrap">
          {typeof metadata === 'string' ? metadata : JSON.stringify(metadata)}
        </p>
      );
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-blue-400">Submission History</h2>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchHistoryData} 
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>
      
      {isLoading && historyLogs.length === 0 ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
        </div>
      ) : error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : historyLogs.length === 0 ? (
        <div className="text-center py-10 border border-gray-600 rounded">
          <Clock className="mx-auto h-12 w-12 text-gray-400 mb-2" />
          <h3 className="text-lg font-medium text-gray-300">No History Data</h3>
          <p className="text-sm text-gray-500">No history logs are available for this submission.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {historyLogs.map((log, index) => (
            <Card key={log.id || index} className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-md font-medium text-white">
                      {formatStepName(log.step)}
                    </CardTitle>
                    <CardDescription>
                      {formatTimestamp(log.executed_at || log.created_at)}
                    </CardDescription>
                  </div>
                  <div>{getStatusBadge(log.status)}</div>
                </div>
              </CardHeader>
              
              <CardContent>
                {log.user_prompt && (
                  <div className="mb-3">
                    <h4 className="text-sm font-medium text-gray-300 mb-1">User Prompt:</h4>
                    <p className="text-sm text-gray-400 whitespace-pre-wrap">
                      {log.user_prompt}
                    </p>
                  </div>
                )}
                
                {(log.step_metadata || log.metadata) && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-1">Metadata:</h4>
                    {renderMetadata(log.step, log.step_metadata || log.metadata)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}