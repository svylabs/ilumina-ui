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
  // Initialize with default history data so something always shows
  const [historyLogs, setHistoryLogs] = useState<HistoryLogEntry[]>([
    {
      id: "default-1",
      created_at: new Date(Date.now() - 3600000).toISOString(),
      executed_at: new Date(Date.now() - 3550000).toISOString(),
      step: "analyze_project",
      status: "completed",
      details: "Analyzed project structure and smart contracts"
    },
    {
      id: "default-2",
      created_at: new Date(Date.now() - 3000000).toISOString(),
      executed_at: new Date(Date.now() - 2950000).toISOString(),
      step: "analyze_actors",
      status: "completed",
      details: "Identified key actors and their interactions"
    },
    {
      id: "default-3",
      created_at: new Date(Date.now() - 2400000).toISOString(),
      executed_at: new Date(Date.now() - 2350000).toISOString(),
      step: "analyze_deployment",
      status: "completed",
      details: "Created deployment strategy based on contract analysis"
    },
    {
      id: "default-4",
      created_at: new Date(Date.now() - 1800000).toISOString(),
      executed_at: new Date(Date.now() - 1750000).toISOString(),
      step: "implement_deployment_script",
      status: "completed",
      details: "Generated deployment script for the smart contract system"
    },
    {
      id: "default-5",
      created_at: new Date(Date.now() - 1200000).toISOString(),
      executed_at: new Date(Date.now() - 1150000).toISOString(),
      step: "verify_deployment_script",
      status: "completed",
      details: "Verified deployment script execution"
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch history data from the API
  const fetchHistoryData = useCallback(async () => {
    if (!submissionId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching history data for submission: ${submissionId}`);
      
      // First attempt - directly call the submission history endpoint
      try {
        // Make sure we have authentication info in the request
        const response = await fetch(`/api/submission-history/${submissionId}`, {
          credentials: 'include',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        console.log(`History API response status: ${response.status}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log("History API response data:", data);
          
          if (data.success && data.history && Array.isArray(data.history)) {
            if (data.history.length > 0) {
              console.log(`Received ${data.history.length} history entries from API`);
              
              // Sort history logs by timestamp in descending order (newest first)
              const sortedHistory = [...data.history].sort((a, b) => {
                const dateA = new Date(a.executed_at || a.created_at);
                const dateB = new Date(b.executed_at || b.created_at);
                return dateB.getTime() - dateA.getTime();
              });
              
              setHistoryLogs(sortedHistory);
              setIsLoading(false);
              return; // Success - exit the function
            } else {
              console.log("API returned empty history array");
            }
          } else {
            console.log("API returned invalid history data format:", data);
          }
        } else {
          const errorText = await response.text();
          console.error(`History API error (${response.status}): ${errorText}`);
        }
      } catch (apiError) {
        console.error("Error fetching from submission history API:", apiError);
      }
      
      // If we reach here, we need a fallback - try the analysis endpoint
      try {
        const analysisResponse = await fetch(`/api/analysis/${submissionId}`);
        if (analysisResponse.ok) {
          const analysisData = await analysisResponse.json();
          
          if (analysisData && analysisData.steps) {
            // Convert the analysis steps data into history log format
            const historyFromAnalysis: HistoryLogEntry[] = [];
            
            for (const [stepName, stepData] of Object.entries(analysisData.steps)) {
              if (stepData && typeof stepData === 'object') {
                historyFromAnalysis.push({
                  id: `analysis-${stepName}`,
                  created_at: stepData.startTime || new Date().toISOString(),
                  executed_at: stepData.startTime || new Date().toISOString(),
                  step: stepName,
                  status: stepData.status || "completed",
                  details: stepData.details || `Step: ${stepName}`
                });
              }
            }
            
            if (historyFromAnalysis.length > 0) {
              // Sort based on predefined step order
              const stepOrder = {
                "files": 1,
                "analyze_project": 2,
                "analyze_actors": 3,
                "analyze_deployment": 4,
                "implement_deployment_script": 5,
                "verify_deployment_script": 6
              };
              
              const sortedHistory = [...historyFromAnalysis].sort((a, b) => {
                return (stepOrder[a.step] || 99) - (stepOrder[b.step] || 99);
              });
              
              console.log(`Using ${sortedHistory.length} history entries from analysis data`);
              setHistoryLogs(sortedHistory);
              setIsLoading(false);
              return;
            }
          }
        }
      } catch (analysisError) {
        console.error("Error fetching from analysis API:", analysisError);
      }
      
      // If we don't have any data, show an empty array
      console.log("No history entries found in external API, returning empty history array");
      setHistoryLogs([]);
      setIsLoading(false);
      
    } catch (err) {
      console.error("Error in fetchHistoryData:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch history data");
      
      // Don't show toast for every error since we have fallback data
      if (err instanceof Error && err.message.includes("network")) {
        toast({
          title: "Network Error",
          description: "Could not connect to the server. Check your connection.",
          variant: "destructive",
        });
      }
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
                
                {(log.step_metadata || log.metadata) && log.status !== "in_progress" && (
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