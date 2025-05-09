import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle, AlertCircle, Check, Loader2, CheckCircle2, XCircle, CircleDot, Download, ChevronRight, ChevronDown, RefreshCw, FileCode, Users, Box, Laptop, PlayCircle, Code, FileEdit, Eye, MessageSquare, Wand, FileText, Code2, Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format, addMinutes, formatDistanceToNow } from "date-fns";
import SectionChat from "@/components/section-chat";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState, useCallback, useRef } from "react";
import GitHubCodeViewer from "@/components/github-code-viewer";
import TestEnvironmentChat from "@/components/test-environment-chat";
import ChatAssistant from "@/components/chat-assistant";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

// Simulation run type definition
type SimulationRun = {
  id: string;
  status: "success" | "error";
  date: string;
  logUrl: string | null;
  summary?: {
    totalTests: number;
    passed: number;
    failed: number;
  };
  // Additional fields for expanded details section
  log?: string;
  return_code?: number;
  stderr?: string;
  stdout?: string;
};

// Component for Simulations tab
interface SimulationsComponentProps {
  analysis?: AnalysisResponse;
  deploymentVerified?: boolean;
}

function SimulationsComponent({ analysis, deploymentVerified = false }: SimulationsComponentProps) {
  const { id: submissionId } = useParams();
  
  // State for simulation runs
  const [simulationRuns, setSimulationRuns] = useState<SimulationRun[]>([]);
  const [isRunningSimulation, setIsRunningSimulation] = useState(false);
  const [progress, setProgress] = useState(0);
  const [simulationMessage, setSimulationMessage] = useState<string | null>(null);
  const [simStatus, setSimStatus] = useState<{
    canRun: boolean;
    message: string;
    plan?: string;
    runsUsed?: number;
    runsLimit?: number | string;
    earlyAccess?: boolean;
  } | null>(null);
  const [showUpgradeMessage, setShowUpgradeMessage] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Fetch simulation runs and status on component mount
  useEffect(() => {
    if (!user || !submissionId) return;
    
    const fetchData = async () => {
      try {
        // Fetch simulation status
        const statusResponse = await fetch('/api/can-run-simulation');
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          
          // Check if deployment was verified to enable early access
          if (deploymentVerified && !statusData.canRun) {
            console.log("Deployment verified, enabling early access to simulations");
            setSimStatus({
              ...statusData,
              canRun: true,
              earlyAccess: true,
              message: "Early access enabled through deployment verification"
            });
            setShowUpgradeMessage(false);
          } else {
            setSimStatus(statusData);
            setShowUpgradeMessage(!statusData.canRun);
          }
        } else if (statusResponse.status === 401) {
          setSimStatus({
            canRun: false,
            message: "Please login to run simulations"
          });
        }
        
        // Fetch existing simulation runs
        const runsResponse = await fetch(`/api/simulation-runs/${submissionId}`);
        if (runsResponse.ok) {
          const responseData = await runsResponse.json();
          console.log("Received simulation runs:", responseData);
          
          // Check if the response has a 'simulation_runs' property (from external API)
          const runsData = responseData.simulation_runs || responseData || [];
          
          // Convert API data to our SimulationRun type
          const formattedRuns: SimulationRun[] = runsData.map((run: any) => {
            // Check if the response data is already in our expected format
            if (run.id && run.status) {
              return run;
            }
            
            // Handle data from external API
            if (run.simulation_id || run.run_id || run.id) {
              // Log the raw run data to debug
              console.log("Processing run data:", run);
              
              const status = run.status === "SUCCESS" ? "success" : 
                             run.status === "success" ? "success" :
                             run.status === "FAILURE" ? "error" : 
                             run.status === "failure" ? "error" :
                             run.status === "error" ? "error" :
                             run.status?.toLowerCase() || "error";
              
              return {
                id: run.simulation_id || run.run_id || run.id,
                status: status as 'success' | 'error',
                date: run.created_at || run.date || new Date().toISOString(),
                logUrl: run.log_url || run.logUrl || null,
                // Include all available fields for the expanded details section
                log: run.log || null,
                return_code: run.return_code || 0,
                stderr: run.stderr || null,
                stdout: run.stdout || null,
                summary: run.summary || {
                  totalTests: run.total_tests || 0,
                  passed: run.passed_tests || 0,
                  failed: run.failed_tests || (run.total_tests || 0) - (run.passed_tests || 0) || 0
                }
              };
            }
            
            // Fallback for old format
            return {
              id: run.runId || run.id || `sim-${Math.random().toString(36).substring(7)}`,
              status: (run.status === "failure" ? "error" : run.status) as 'success' | 'error',
              date: run.date || new Date().toISOString(),
              logUrl: run.logUrl || null,
              log: run.log || null,
              return_code: run.return_code || 0,
              stderr: run.stderr || null,
              stdout: run.stdout || null,
              summary: run.summary || {
                totalTests: 0,
                passed: 0,
                failed: 0
              }
            };
          });
          
          setSimulationRuns(formattedRuns);
        }
      } catch (error) {
        console.error('Error fetching simulation data:', error);
        toast({
          title: "Error",
          description: "Could not load simulation data. Please try again.",
          variant: "destructive"
        });
      }
    };
    
    fetchData();
  }, [user, submissionId, toast, deploymentVerified]);
  
  // Helper function to check if deployment is completed
  const checkDeploymentCompletion = async (submissionId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/check-deployment-complete/${submissionId}`);
      if (!response.ok) {
        return false;
      }
      const data = await response.json();
      return data?.isCompleted || false;
    } catch (error) {
      console.error("Error checking deployment completion:", error);
      return false;
    }
  };
  
  // Generate a new simulation ID
  const generateSimId = () => {
    return `sim-${String(Math.floor(Math.random() * 900) + 100)}`;
  };
  
  // Start a new simulation
  const startSimulation = async () => {
    if (isRunningSimulation || !simStatus?.canRun || !submissionId) return;
    
    try {
      setIsRunningSimulation(true);
      setProgress(0);
      
      // Extract the UUID submission ID from analysis data
      // The analysis data contains the UUID format submission ID which is needed by the external API
      const uuidSubmissionId = analysis?.submissionId || 
                              analysis?.steps?.files?.jsonData?.submission_id || 
                              submissionId;
      
      console.log("Using submission UUID for simulation:", uuidSubmissionId);
      
      // Show progress animation
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 95) {
            // Cap at 95% until we get confirmation
            return 95;
          }
          return prev + 5;
        });
      }, 300);
      
      // Call the new API endpoint to trigger the simulation
      const response = await fetch('/api/run-simulation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          submissionId: uuidSubmissionId // Send the UUID format submission ID
        })
      });
      
      if (!response.ok) {
        try {
          const errorData = await response.json();
          console.error('Error data from server:', errorData);
          // Show detailed error information
          throw new Error(errorData.message || errorData.error || errorData.details || `Failed to start simulation (${response.status})`);
        } catch (parseError) {
          // If we can't parse the JSON, just use the status
          console.error('Error parsing error response:', parseError);
          throw new Error(`Failed to start simulation. Server returned status ${response.status}`);
        }
      }
      
      // Complete the progress bar
      setProgress(100);
      
      // Show a success toast notification
      toast({
        title: "Success",
        description: "Simulation has been started successfully",
        variant: "default"
      });
      
      // Display a clear success message to the user
      setSimulationMessage("Simulation started successfully. Results will appear in the list below shortly.");
      
      // Set a timeout to refresh the simulation runs
      setTimeout(async () => {
        try {
          // Refresh the simulation runs list
          const runsResponse = await fetch(`/api/simulation-runs/${submissionId}`);
          if (runsResponse.ok) {
            const responseData = await runsResponse.json();
            console.log("Received simulation runs:", responseData);
            
            // Check if the response has a 'simulation_runs' property (from external API)
            const runsData = responseData.simulation_runs || responseData || [];
            
            // Convert API data to our SimulationRun type
            const formattedRuns: SimulationRun[] = runsData.map((run: any) => {
              // Check if the response data is already in our expected format
              if (run.id && run.status) {
                return run;
              }
              
              // Handle data from external API
              if (run.simulation_id || run.run_id || run.id) {
                // Log the raw run data to debug
                console.log("Processing run data (from simulation):", run);
                
                const status = run.status === "SUCCESS" ? "success" : 
                            run.status === "success" ? "success" :
                            run.status === "FAILURE" ? "error" : 
                            run.status === "failure" ? "error" :
                            run.status === "ERROR" ? "error" :
                            run.status === "error" ? "error" :
                            run.status?.toLowerCase() || "error";
                
                return {
                  id: run.simulation_id || run.run_id || run.id,
                  status: status as 'success' | 'error',
                  date: run.created_at || run.date || new Date().toISOString(),
                  logUrl: run.log_url || run.logUrl || null,
                  log: run.log || null,
                  stderr: run.stderr || null,
                  stdout: run.stdout || null,
                  return_code: run.return_code || 0,
                  summary: run.summary || {
                    totalTests: run.total_tests || 0,
                    passed: run.passed_tests || 0,
                    failed: run.failed_tests || (run.total_tests || 0) - (run.passed_tests || 0) || 0
                  }
                };
              }
              
              // Fallback for old format
              return {
                id: run.runId || run.id || `sim-${Math.random().toString(36).substring(7)}`,
                status: (run.status === 'failure' ? 'error' : run.status) as 'success' | 'error',
                date: run.date || new Date().toISOString(),
                logUrl: run.logUrl || null,
                log: run.log || null,
                stderr: run.stderr || null,
                stdout: run.stdout || null,
                return_code: run.return_code || 0,
                summary: run.summary || {
                  totalTests: 0,
                  passed: 0,
                  failed: 0
                }
              };
            });
            
            setSimulationRuns(formattedRuns);
          }
          
          // Update simulation status with new counts
          const statusResponse = await fetch('/api/can-run-simulation');
          if (statusResponse.ok) {
            const newStatus = await statusResponse.json();
            setSimStatus(newStatus);
            setShowUpgradeMessage(!newStatus.canRun);
          }
          
          setIsRunningSimulation(false);
          clearInterval(interval);
        } catch (error) {
          console.error('Error completing simulation:', error);
          toast({
            title: "Error",
            description: "Failed to complete simulation. Please try again.",
            variant: "destructive"
          });
          setIsRunningSimulation(false);
          clearInterval(interval);
        }
      }, 8000); // 8 seconds total simulation time
    } catch (error) {
      console.error('Error starting simulation:', error);
      toast({
        title: "Error",
        description: "Failed to start simulation. Please try again.",
        variant: "destructive"
      });
      setIsRunningSimulation(false);
    }
  };
  
  return (
    <div className="text-white">
      <div className="space-y-6">
        {simStatus?.earlyAccess && (
          <div className="p-4 bg-yellow-900/50 border border-yellow-700 rounded-md mb-4 text-sm">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" />
              <span className="font-semibold text-yellow-300">Early Access Enabled</span>
            </div>
            <p className="text-gray-300 mt-1">
              You have early access to simulations because you've completed the deployment verification step.
            </p>
          </div>
        )}
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h3 className="text-xl font-semibold text-blue-400">Simulations</h3>
            {simStatus && (
              <p className="text-sm text-gray-400 mt-1">
                {simStatus.canRun 
                  ? "You have unlimited simulation runs available."
                  : simStatus.message
                }
              </p>
            )}
          </div>
          <div className="flex gap-3 items-center">
            {showUpgradeMessage && (
              <Link href="/pricing" className="text-sm text-yellow-400 hover:text-yellow-300 underline">
                Upgrade Plan
              </Link>
            )}
            <button
              onClick={startSimulation}
              disabled={isRunningSimulation || !simStatus?.canRun}
              className={`px-4 py-2 rounded-md font-medium ${
                isRunningSimulation || !simStatus?.canRun
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isRunningSimulation ? 'Running...' : 'Run Simulation'}
            </button>
          </div>
        </div>
        
        {isRunningSimulation && (
          <div className="bg-gray-900 p-4 rounded-md">
            <div className="flex items-center">
              <div className="w-4 h-4 rounded-full bg-blue-500 animate-pulse mr-2"></div>
              <span className="text-blue-400 font-medium">Simulation request sent. Processing on server...</span>
            </div>
          </div>
        )}
        
        {simulationMessage && !isRunningSimulation && (
          <div className="bg-green-900/50 border border-green-700 p-4 rounded-md mb-4">
            <div className="flex items-center gap-2 mb-1">
              <Check className="h-5 w-5 text-green-400" />
              <span className="font-medium text-green-300">Success</span>
            </div>
            <p className="text-gray-300 text-sm">{simulationMessage}</p>
          </div>
        )}
        
        {simulationRuns.length > 0 ? (
          <div className="bg-gray-900 rounded-md">
            <div className="border-b border-gray-800 p-4">
              <div className="hidden md:grid md:grid-cols-12 text-sm text-gray-400 font-medium">
                <div className="col-span-1">#</div>
                <div className="col-span-3">Run ID</div>
                <div className="col-span-3">Status</div>
                <div className="col-span-4">Date</div>
                <div className="col-span-1">Log</div>
              </div>
            </div>
            
            <div className="divide-y divide-gray-800">
              {simulationRuns.map((run, index) => {
                return (
                  <SimulationRunItem 
                    key={run.id} 
                    run={run} 
                    index={index} 
                    number={simulationRuns.length - index} // Count from n to 1
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-gray-900 rounded-md">
            <div className="text-gray-300 mb-4">
              No simulation runs available yet. Click the button above to start a simulation.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Separate component for each simulation run to properly manage state
function SimulationRunItem({ run, index, number }: { run: SimulationRun, index: number, number: number }) {
  // State to track if details section is expanded
  const [isExpanded, setIsExpanded] = useState(false);
  // State to track if log viewer is shown
  const [showLogViewer, setShowLogViewer] = useState(false);
  // State to hold log content
  const [logContent, setLogContent] = useState<string | null>(null);
  // State to track log loading state
  const [isLoadingLog, setIsLoadingLog] = useState(false);
  // State to track log viewing error
  const [logError, setLogError] = useState<string | null>(null);
  
  // Toggle details when clicking on the row
  const toggleDetails = () => {
    setIsExpanded(!isExpanded);
  };
  
  // State to track pagination for large logs
  const [logChunkSize] = useState(100 * 1024); // 100KB chunks
  const [logOffset, setLogOffset] = useState(0);
  const [hasMoreLogData, setHasMoreLogData] = useState(true);
  
  // Load and show log content
  const viewLogContent = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row toggle
    
    // If log viewer is already open, just close it
    if (showLogViewer) {
      setShowLogViewer(false);
      return;
    }
    
    // Check if log URL exists
    if (!run.logUrl) {
      setShowLogViewer(true);
      setLogError("No log URL available for this simulation run.");
      setHasMoreLogData(false);
      setIsLoadingLog(false);
      return;
    }
    
    // Reset log state if reopening
    if (!showLogViewer) {
      setLogContent("");
      setLogOffset(0);
      setHasMoreLogData(true);
    }
    
    // Start loading
    setIsLoadingLog(true);
    setLogError(null);
    setShowLogViewer(true);
    
    // Load first chunk
    loadNextLogChunk();
  };
  
  // Load the next chunk of log data
  const loadNextLogChunk = async () => {
    if (!run.logUrl || !hasMoreLogData) return;
    
    try {
      setIsLoadingLog(true);
      
      // Calculate range for next chunk
      const rangeStart = logOffset;
      const rangeEnd = logOffset + logChunkSize - 1;
      
      // Direct fetch from Google Cloud Storage
      console.log(`Fetching log range: bytes=${rangeStart}-${rangeEnd} from ${run.logUrl}`);
      
      let response;
      
      try {
        // Try fetch with no-cors mode first, but this will only work for downloading, not for displaying
        // For display purposes, we'll use a fallback approach if needed
        if (run.logUrl) {
          console.log(`Fetching log from: ${run.logUrl}`);
          
          // For logs that are publicly accessible, we can try with regular CORS mode first
          try {
            response = await fetch(run.logUrl, {
              headers: {
                'Range': `bytes=${rangeStart}-${rangeEnd}`,
                'Accept': 'text/plain, application/octet-stream, text/html'
              },
              mode: 'cors',
            });
            console.log('Standard fetch response status:', response.status);
          } catch (corsErr) {
            console.warn('CORS fetch failed, falling back to no-cors mode:', corsErr);
            
            // If direct fetch fails, we'll try no-cors mode, but this won't give us access to the response data
            // We'll just use this to check if the URL is accessible at all
            const noCorsFetch = await fetch(run.logUrl, { 
              mode: 'no-cors',
            });
            
            console.log('No-CORS fetch completed');
            
            // For displaying the log content, we'll need to provide alternative content
            setLogContent("The log file can be downloaded but cannot be displayed directly due to CORS restrictions.\n\nClick the Download button to save the log file and view it locally.");
            setHasMoreLogData(false);
            setIsLoadingLog(false);
            
            // Return early since we can't display the content directly
            return;
          }
        } else {
          throw new Error("No log URL available");
        }
      } catch (err) {
        console.error('Log fetch error:', err);
        throw new Error(`Failed to fetch logs: ${err instanceof Error ? err.message : String(err)}`);
      }
      
      // Check for partial content success (206) or regular success (200)
      if (response.status !== 206 && response.status !== 200) {
        // For error responses, try to extract more detailed error info if available
        try {
          const contentType = response.headers.get('Content-Type') || '';
          if (contentType.includes('application/json')) {
            // Try to parse as JSON error
            const errorData = await response.json();
            throw new Error(errorData.error || errorData.details || `Error fetching log: ${response.status} ${response.statusText}`);
          } else {
            // Try to get error text
            const errorText = await response.text();
            if (errorText && errorText.length < 200) {
              throw new Error(`Error fetching log: ${errorText}`);
            } else {
              throw new Error(`Error fetching log: ${response.status} ${response.statusText}`);
            }
          }
        } catch (parseError) {
          // If parsing the error fails, use the original error
          throw new Error(`Error fetching log: ${response.status} ${response.statusText}`);
        }
      }
      
      // Get content length if available
      const contentRange = response.headers.get('Content-Range');
      const contentLength = response.headers.get('Content-Length');
      
      // Parse content range to determine if there's more data
      if (contentRange) {
        // Format: "bytes start-end/total"
        const total = parseInt(contentRange.split('/')[1]);
        const end = parseInt(contentRange.split('-')[1].split('/')[0]);
        
        // If we've reached the end of the content
        if (end + 1 >= total) {
          setHasMoreLogData(false);
        } else {
          // Update offset for next chunk
          setLogOffset(end + 1);
          setHasMoreLogData(true);
        }
      } else if (contentLength) {
        // If no Content-Range but has Content-Length, check if we got less than requested
        const length = parseInt(contentLength);
        if (length < logChunkSize) {
          setHasMoreLogData(false);
        } else {
          // Update offset for next chunk
          setLogOffset(logOffset + length);
          setHasMoreLogData(true);
        }
      } else {
        // No way to tell if there's more, assume we're done
        setHasMoreLogData(false);
      }
      
      // Check content type for HTML
      const contentType = response.headers.get('Content-Type') || '';
      let chunk;
      
      if (contentType.includes('html')) {
        console.log('Received HTML response, extracting text content');
        // For HTML content, extract text from the pre tag or body
        const html = await response.text();
        
        // Simple HTML parsing to extract content from <pre> tags if present
        const preMatch = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(html);
        if (preMatch && preMatch[1]) {
          // Use the contents of the pre tag
          chunk = preMatch[1];
        } else {
          // If no pre tag found, strip all HTML tags
          chunk = html.replace(/<[^>]*>/g, '');
        }
      } else {
        // For regular text content
        chunk = await response.text();
      }
      
      // Append new chunk to existing content
      setLogContent(prev => prev + chunk);
    } catch (error) {
      console.error("Error fetching log content:", error);
      setLogError(error instanceof Error ? error.message : "Failed to load log content");
      setHasMoreLogData(false);
    } finally {
      setIsLoadingLog(false);
    }
  };
  
  return (
    <div className="hover:bg-gray-800/50 transition-colors cursor-pointer" onClick={toggleDetails}>
      <div className="p-4">
        <div className="flex flex-col md:grid md:grid-cols-12 items-start md:items-center gap-2 md:gap-0">
          <div className="md:col-span-1 font-medium text-gray-300">
            <div className="md:hidden text-xs text-gray-400 mb-1">#</div>
            {number}
          </div>
          <div className="md:col-span-3 font-mono text-white">
            <div className="md:hidden text-xs text-gray-400 mb-1">Run ID</div>
            <div className="truncate max-w-[200px]">{run.id}</div>
          </div>
          <div className="md:col-span-3">
            <div className="md:hidden text-xs text-gray-400 mb-1">Status</div>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
              ${run.status === 'success' 
                ? 'bg-green-900/50 text-green-300' 
                : run.status === 'in_progress'
                  ? 'bg-blue-900/50 text-blue-300'
                  : 'bg-red-900/50 text-red-300'
              }`}
            >
              {run.status === 'success' 
                ? '✓ Success' 
                : run.status === 'in_progress'
                  ? '⟳ Running'
                  : '✗ Failed'}
            </span>
          </div>
          <div className="md:col-span-4 text-gray-300">
            <div className="md:hidden text-xs text-gray-400 mb-1">Date</div>
            {typeof run.date === 'string' && run.date.includes('GMT')
              ? new Date(run.date.replace('GMT', '+0000')).toLocaleString()
              : new Date(run.date).toLocaleString()}
          </div>
          <div className="md:col-span-1 flex flex-wrap gap-2 md:space-x-2" onClick={(e) => e.stopPropagation()}>
            {run.logUrl && (
              <div className="flex space-x-1">
                <button 
                  onClick={viewLogContent}
                  className="text-xs px-2 py-1 inline-flex items-center rounded border border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  <span className="mr-1">📝</span> Log
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(run.logUrl, '_blank');
                  }}
                  title="Open log in new tab"
                  className="text-xs px-2 py-1 inline-flex items-center rounded border border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                  Open
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Log viewer section */}
      {showLogViewer && (
        <div className="px-4 pb-4 pt-0 bg-gray-900/30 border-t border-gray-800" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-medium text-blue-400">Simulation Log</h4>
            <div className="flex space-x-2">
              {logContent && (
                <div className="flex space-x-1">
                  {/* Download from memory (will work if we could fetch the content) */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      // Create a blob from the log content
                      const blob = new Blob([logContent], { type: 'text/plain' });
                      // Create a URL for the blob
                      const url = URL.createObjectURL(blob);
                      // Create a temporary anchor element
                      const a = document.createElement('a');
                      a.href = url;
                      // Generate a filename with the simulation ID and date
                      const filename = `simulation-${run.id.substring(0, 8)}-${new Date().toISOString().split('T')[0]}.log`;
                      a.download = filename;
                      // Trigger the download
                      document.body.appendChild(a);
                      a.click();
                      // Clean up
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    className="text-xs px-2 py-1 rounded bg-blue-900/50 text-blue-300 hover:bg-blue-800 hover:text-blue-200 flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Download
                  </button>
                  
                  {/* Direct download (will work even with CORS issues) */}
                  {run.logUrl && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Open in new tab to download directly (bypasses CORS)
                        window.open(run.logUrl, '_blank');
                      }}
                      title="Download directly from source"
                      className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 flex items-center"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"></path>
                        <line x1="16" y1="5" x2="22" y2="5"></line>
                        <line x1="22" y1="10" x2="16" y2="10"></line>
                        <line x1="22" y1="15" x2="16" y2="15"></line>
                      </svg>
                      Source
                    </button>
                  )}
                </div>
              )}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLogViewer(false);
                }}
                className="text-xs px-2 py-1 rounded text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              >
                Close
              </button>
            </div>
          </div>
          
          <div className="bg-black rounded border border-gray-800 h-96">
            {isLoadingLog && (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            )}
            
            {logError && (
              <div className="text-red-400 p-4 text-sm">
                <p className="font-medium mb-1">Error loading log:</p>
                <p className="font-mono">{logError}</p>
              </div>
            )}
            
            {logContent && (
              <div className="flex flex-col h-full">
                <div className="text-xs text-gray-300 font-mono whitespace-pre-wrap p-4 flex-grow overflow-y-auto">
                  {/* Apply syntax highlighting for common log patterns */}
                  {logContent.split('\n').map((line, index) => {
                    // Highlight error and warning lines
                    if (line.match(/error|Error|ERROR|exception|Exception|EXCEPTION|failed|Failed|FAILED/i)) {
                      return <div key={index} className="text-red-400">{line}</div>;
                    } 
                    // Highlight warning lines
                    else if (line.match(/warning|Warning|WARN|warn/i)) {
                      return <div key={index} className="text-yellow-400">{line}</div>;
                    }
                    // Highlight success lines
                    else if (line.match(/success|Success|SUCCESS|completed|Completed|deployed|Deployed/i)) {
                      return <div key={index} className="text-green-400">{line}</div>;
                    }
                    // Highlight info lines
                    else if (line.match(/info|Info|INFO|note|Note|NOTE/i)) {
                      return <div key={index} className="text-blue-400">{line}</div>;
                    }
                    // Highlight addresses, contract names, and hashes
                    else if (line.match(/0x[a-fA-F0-9]{40}|0x[a-fA-F0-9]{64}/)) {
                      // Using a temporary element to process the line with React elements
                      const parts = [];
                      const regex = /(0x[a-fA-F0-9]{40,64})/g;
                      let lastIndex = 0;
                      let match;
                      
                      // Find all matches and build parts array with highlighted addresses
                      while ((match = regex.exec(line)) !== null) {
                        // Add text before match
                        if (match.index > lastIndex) {
                          parts.push(line.substring(lastIndex, match.index));
                        }
                        // Add highlighted match
                        parts.push(<span key={`addr-${match.index}`} className="text-purple-400">{match[0]}</span>);
                        lastIndex = match.index + match[0].length;
                      }
                      
                      // Add any remaining text after the last match
                      if (lastIndex < line.length) {
                        parts.push(line.substring(lastIndex));
                      }
                      
                      return <div key={index}>{parts}</div>;
                    }
                    // Default formatting
                    else {
                      return <div key={index}>{line}</div>;
                    }
                  })}
                </div>
                
                {hasMoreLogData && (
                  <div className="border-t border-gray-800 p-2 flex justify-center">
                    <button 
                      onClick={loadNextLogChunk}
                      disabled={isLoadingLog}
                      className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded flex items-center"
                    >
                      {isLoadingLog ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b border-white mr-2"></div>
                          Loading...
                        </>
                      ) : (
                        <>Load More</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Expandable details section */}
      {isExpanded && !showLogViewer && (
        <div className="px-4 pb-4 pt-0 bg-gray-900/50 border-t border-gray-800">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Run metadata */}
            <div className="bg-gray-800/50 p-3 rounded-md md:col-span-2">
              <h4 className="text-sm font-medium text-blue-400 mb-2">Run Details</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-gray-300">
                  <span>Simulation ID:</span>
                  <span className="font-mono truncate max-w-[180px]">{run.id}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Return Code:</span>
                  <span className="font-mono">{run.return_code || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Created:</span>
                  <span>
                    {typeof run.date === 'string' && run.date.includes('GMT')
                      ? new Date(run.date.replace('GMT', '+0000')).toLocaleString()
                      : new Date(run.date).toLocaleString()}
                  </span>
                </div>
                {run.status === 'error' && run.log && (
                  <div className="mt-2">
                    <div className="text-xs text-red-300 font-medium mb-1">Error Message:</div>
                    <div className="text-xs bg-red-900/30 p-2 rounded border border-red-900 text-gray-200 font-mono whitespace-pre-wrap max-h-20 overflow-y-auto">
                      {run.log.length > 300 ? run.log.substring(0, 300) + '...' : run.log}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* If there's stdout or stderr, show a collapsed version */}
            {(run.stdout || run.stderr) && (
              <div className="bg-gray-800/50 p-3 rounded-md md:col-span-2">
                <h4 className="text-sm font-medium text-blue-400 mb-2">Console Output</h4>
                
                {run.stdout && (
                  <div className="mb-2">
                    <div className="text-xs text-green-300 font-medium mb-1">Standard Output:</div>
                    <div className="text-xs bg-gray-900 p-2 rounded border border-gray-700 text-gray-300 font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
                      {run.stdout.length > 500 ? run.stdout.substring(0, 500) + '...' : run.stdout}
                    </div>
                  </div>
                )}
                
                {run.stderr && (
                  <div>
                    <div className="text-xs text-yellow-300 font-medium mb-1">Standard Error:</div>
                    <div className="text-xs bg-gray-900 p-2 rounded border border-gray-700 text-gray-300 font-mono whitespace-pre-wrap max-h-24 overflow-y-auto">
                      {run.stderr.length > 500 ? run.stderr.substring(0, 500) + '...' : run.stderr}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type StepStatus = "pending" | "in_progress" | "completed" | "failed";

type AnalysisStep = {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
  link?: string;
  linkText?: string;
  details?: string | null;
  startTime?: string;
  output?: string;
};

type AnalysisStepStatus = {
  status: StepStatus;
  details: string | null;
  startTime: string | null;
  jsonData?: any; // Match server-side type definition
};

type CompletedStep = {
  step: string;
  updatedAt: string;
};

type AnalysisResponse = {
  status: string;
  steps: Record<string, AnalysisStepStatus>;
  completedSteps?: CompletedStep[];
  submissionId?: string; // Added to match the API response
};

// Helper function to check if deployment verification is completed
function isDeploymentVerificationCompleted(completedSteps?: CompletedStep[]): boolean {
  if (!completedSteps || completedSteps.length === 0) return false;
  
  // Check if verify_deployment_script is in the completed steps
  return completedSteps.some(step => 
    step.step === 'verify_deployment_script' || step.step === 'verify_deployment'
  );
}

// Updated analysis steps with new sequence
const analysisSteps: AnalysisStep[] = [
  {
    id: "files",
    title: "Analyze Project",
    description: "Analyzing repository structure and identifying smart contract files",
    status: "pending",
    output: `// Project Analysis Results
Found 3 Solidity files:
- contracts/Token.sol
- contracts/DEX.sol
- contracts/Staking.sol

Found ERC-20 implementation
Found DEX implementation with Uniswap V2 compatibility
Found staking contract with time-locked rewards

Dependencies:
- @openzeppelin/contracts: 4.8.0
- @uniswap/v2-periphery: 1.1.0-beta.0

Compiler version: 0.8.17
`
  },
  {
    id: "actors",
    title: "Analyze Actors",
    description: "Identifying potential actors and their interactions with the contracts",
    status: "pending",
    output: `// Actor Analysis Results
Detected 5 potential actors:
1. TokenOwner - Contract deployer with admin privileges
2. LiquidityProvider - Adds token/ETH pairs to DEX
3. Trader - Swaps tokens via DEX functions
4. Staker - Stakes tokens for rewards
5. Attacker - Potential malicious actor testing security

Actor Interactions:
- TokenOwner can mint new tokens and update allowances
- LiquidityProvider adds/removes liquidity from trading pairs
- Trader can execute swaps between token pairs
- Staker can deposit tokens and claim rewards
- Attacker attempts price manipulation via flashloans

Security Analysis:
- Missing slippage protection in swap functions
- Centralized admin control for token minting
- Time lock functionality present in staking contract
`
  },
  {
    id: "deployment",
    title: "Deployment Instructions",
    description: "Transaction sequence for local network setup",
    status: "pending",
    output: `// Deployment Instructions
Transaction sequence for local network setup:

1. Deploy Token Contract
   - Constructor params: "Token Name", "SYM", 18 (decimals)
   - Gas: ~2,500,000
   - Transaction: TokenOwner deploys Token.sol
   - Result: Token contract deployed successfully

2. Deploy Staking Contract
   - Constructor params: Token address (from step 1)
   - Gas: ~3,200,000
   - Transaction: TokenOwner deploys Staking.sol with Token address
   - Result: Staking contract deployed successfully

3. Deploy DEX Contract
   - Constructor params: Token address (from step 1), Fee rate (0.3%)
   - Gas: ~4,100,000
   - Transaction: TokenOwner deploys DEX.sol with Token address
   - Result: DEX contract deployed successfully

4. Configure Token Permissions
   - Gas: ~50,000
   - Transaction: TokenOwner calls token.setMinter(DEX contract from step 3, true)
   - Result: DEX can now mint reward tokens

5. Initialize Trading Parameters
   - Gas: ~150,000
   - Transaction: TokenOwner calls dex.setFeeRate(300) // 0.3%
   - Result: DEX fee rate configured

Network Options:
- Ethereum Mainnet
- Polygon PoS Chain (recommended for lower fees)
- Local Hardhat Network (for testing)
`
  },
  {
    id: "test_setup",
    title: "Simulation Setup",
    description: "Configuring and implementing the simulation environment",
    status: "pending",
    output: `// Test Environment Setup
Setting up Hardhat environment...
Compiling contracts with solc 0.8.17...
Compilation successful

Configuring simulation environment:
- Virtual network with 10 accounts
- Each account funded with 1000 ETH
- Gas price set to 1 gwei
- Block time: 12 seconds
- Actor wallets configured with test funds
- Test trading pairs initialized
- Automated test scenarios prepared

Dependency versions:
- ethers.js: 5.7.2
- hardhat: 2.12.3
- @nomiclabs/hardhat-ethers: 2.2.1

Agent Configuration:
- TokenOwner: Account 0
- LiquidityProvider: Accounts 1-3
- Traders: Accounts 4-7
- Stakers: Accounts 8-9
- Attackers: Accounts 3,7 (dual role)

All test accounts configured with appropriate initial balances
`
  },
  // No extra curly brace needed here
  {
    id: "simulations",
    title: "Run Simulation",
    description: "Running test simulations with identified actors",
    status: "pending",
    link: "/results",
    linkText: "View Detailed Results",
    output: `// Simulation Results
Running 4 test scenarios...

✓ Basic Trading Scenario
  - Tokens minted successfully
  - Trading functions working as expected
  - Price impact calculations correct

✓ Liquidity Provision Scenario
  - Liquidity added successfully
  - LP tokens minted at correct ratio
  - Removing liquidity returns correct amounts

✓ Staking Rewards Scenario
  - Staking mechanism works correctly
  - Rewards calculated properly based on time
  - Withdrawal functionality verified

✗ Attack Simulation Scenario
  - VULNERABILITY FOUND: Price manipulation possible through flash loans
  - VULNERABILITY FOUND: Missing slippage protection in swap functions
  - RECOMMENDATION: Implement price oracle and slippage protection
  - RECOMMENDATION: Add time-weighted average price (TWAP) mechanism

Overall security score: 78/100
Recommendations generated and available in full report.
`
  }
];

function StepStatus({ status, startTime }: { status: StepStatus; startTime?: string | null }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-6 w-6 text-green-500" />;
    case "failed":
      return <XCircle className="h-6 w-6 text-red-500" />;
    case "in_progress":
      return (
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          {startTime && (
            <span className="text-sm text-muted-foreground">
              running for {formatDistanceToNow(new Date(startTime))}
            </span>
          )}
        </div>
      );
    default:
      return <CircleDot className="h-6 w-6 text-gray-300" />;
  }
}

// DeploymentInstructionsSection component for displaying deployment instructions
function DeploymentInstructionsSection({ submissionId, analysis }: { submissionId: string; analysis: AnalysisResponse }) {
  const [isLoading, setIsLoading] = useState(true);
  const [deploymentData, setDeploymentData] = useState<any>(null);
  const [deploymentScript, setDeploymentScript] = useState<any>(null);
  const [verificationData, setVerificationData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [submissionDetails, setSubmissionDetails] = useState<any>(null);
  const [isShowingDetails, setIsShowingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<"steps" | "script" | "verification">("steps");
  const [isLoadingScript, setIsLoadingScript] = useState(false);
  const [isLoadingVerification, setIsLoadingVerification] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  // completedSteps are accessed directly from analysis response, no need for a separate state
  const { toast } = useToast();

  // Function to fetch submission details for troubleshooting
  const fetchSubmissionDetails = async () => {
    try {
      console.log(`Fetching submission details for ${submissionId}`);
      const detailsResponse = await fetch(`/api/submission-details/${submissionId}`);
      if (detailsResponse.ok) {
        const details = await detailsResponse.json();
        console.log("Submission details received:", details);
        
        // The API returns the data in the 'data' field
        if (details && details.data) {
          setSubmissionDetails(details.data);
          // Always set showing details to true
          setIsShowingDetails(true);
          
          // Debug log to help track down step_metadata structure
          if (details.data.step_metadata) {
            console.log("Step metadata available:", Object.keys(details.data.step_metadata));
            
            // Specifically log implement_deployment_script details
            if (details.data.step_metadata.implement_deployment_script) {
              console.log("Implementation error details:", details.data.step_metadata.implement_deployment_script);
            }
          }
          
          // Check for older format with submissionData.<step>.log
          if (details.data.deployment_implementation?.log) {
            console.log("Found legacy format deployment_implementation.log:", 
                       details.data.deployment_implementation.log);
          }
          
          // Check for general message
          if (details.data.message) {
            console.log("Found general message:", details.data.message);
          }
          
          // Don't show toast for successful log loading since the UI displays the error automatically
        } else {
          console.error("Submission details data format unexpected:", details);
          toast({
            title: "Error loading logs",
            description: "Could not retrieve error details from the server",
            variant: "destructive"
          });
        }
      } else {
        console.error("Failed to fetch submission details");
        toast({
          title: "Error loading logs",
          description: "Server returned an error when fetching error logs",
          variant: "destructive"
        });
      }
    } catch (detailsErr) {
      console.error("Error fetching submission details:", detailsErr);
      toast({
        title: "Error loading logs",
        description: "An error occurred while retrieving error details",
        variant: "destructive"
      });
    }
  };

  // Function to fetch deployment script
  const fetchDeploymentScript = async () => {
    if (deploymentScript) return; // Don't fetch again if we already have it
    
    setIsLoadingScript(true);
    setScriptError(null);
    
    try {
      console.log(`Fetching deployment script for submission ${submissionId}`);
      const response = await fetch(`/api/deployment-script/${submissionId}`);
      
      if (!response.ok) {
        let errorMessage = `Failed to fetch deployment script: ${response.status}`;
        try {
          const errorText = await response.text();
          try {
            // Try to parse it as JSON first
            const errorData = JSON.parse(errorText);
            if (errorData.error) {
              errorMessage = errorData.error;
            }
          } catch (jsonErr) {
            // If it's not valid JSON, show the raw error message but limit its length
            if (errorText.length > 100) {
              errorMessage = `${errorText.substring(0, 100)}... (truncated)`;
            } else {
              errorMessage = errorText;
            }
          }
        } catch (textErr) {
          // If we can't get the response text
          console.error("Could not read error response:", textErr);
        }
        throw new Error(errorMessage);
      }
      
      let data;
      try {
        const responseText = await response.text();
        try {
          data = JSON.parse(responseText);
        } catch (jsonErr) {
          console.error("Invalid JSON in response:", responseText.substring(0, 500));
          throw new Error(`Invalid JSON response: ${jsonErr.message}`);
        }
      } catch (textErr) {
        console.error("Could not read response text:", textErr);
        throw new Error(`Failed to read response: ${textErr.message}`);
      }
      
      console.log("Successfully received deployment script:", data);
      setDeploymentScript(data);
    } catch (err) {
      console.error("Error fetching deployment script:", err);
      setScriptError(err instanceof Error ? err.message : "Failed to fetch deployment script");
    } finally {
      setIsLoadingScript(false);
    }
  };

  // Function to fetch verification data
  const fetchVerificationData = async () => {
    // Allow re-fetching verification data even if we already have it
    // This ensures we get the latest data and proper timestamps
    
    setIsLoadingVerification(true);
    setVerificationError(null);
    
    try {
      console.log(`Fetching verification data for submission ${submissionId}`);
      const response = await fetch(`/api/verify-deployment/${submissionId}`);
      
      if (!response.ok) {
        let errorMessage = `Failed to fetch verification data: ${response.status}`;
        try {
          const errorText = await response.text();
          try {
            // Try to parse it as JSON first
            const errorData = JSON.parse(errorText);
            if (errorData.error) {
              errorMessage = errorData.error;
            }
          } catch (jsonErr) {
            // If it's not valid JSON, show the raw error message but limit its length
            if (errorText.length > 100) {
              errorMessage = `${errorText.substring(0, 100)}... (truncated)`;
            } else {
              errorMessage = errorText;
            }
          }
        } catch (textErr) {
          // If we can't get the response text
          console.error("Could not read error response:", textErr);
        }
        throw new Error(errorMessage);
      }
      
      let data;
      try {
        const responseText = await response.text();
        try {
          data = JSON.parse(responseText);
        } catch (jsonErr) {
          console.error("Invalid JSON in response:", responseText.substring(0, 500));
          throw new Error(`Invalid JSON response: ${jsonErr.message}`);
        }
      } catch (textErr) {
        console.error("Could not read response text:", textErr);
        throw new Error(`Failed to read response: ${textErr.message}`);
      }
      
      console.log("Successfully received verification data:", data);
      // Use getStepTimestamp to get the actual timestamp from completedSteps
      const verificationTimestamp = getStepTimestamp('verify_deployment');
      if (verificationTimestamp) {
        // If we have a real timestamp from the completedSteps, use it
        data.timestamp = verificationTimestamp;
      }
      setVerificationData(data);
    } catch (err) {
      console.error("Error fetching verification data:", err);
      setVerificationError(err instanceof Error ? err.message : "Failed to fetch verification data");
    } finally {
      setIsLoadingVerification(false);
    }
  };

  // Get a specific step timestamp from analysis.completedSteps
  const getStepTimestamp = (stepType: string) => {
    // Get completedSteps directly from the analysis response
    if (!analysis?.completedSteps || analysis.completedSteps.length === 0) return null;
    
    // Find the matching step
    const matchingStep = analysis.completedSteps.find(step => {
      // For deployment-related steps, we have different step names to check
      if (stepType === 'deployment_instructions') {
        return step.step === 'deployment_instructions' || step.step === 'analyze_deployment';
      } else if (stepType === 'deployment_implementation') {
        return step.step === 'deployment_implementation' || step.step === 'implement_deployment_script';
      } else if (stepType === 'verify_deployment') {
        return step.step === 'verify_deployment' || step.step === 'verify_deployment_script';
      }
      return step.step === stepType;
    });

    return matchingStep ? matchingStep.updatedAt : null;
  };

  // Get a specific step status from analysis.completedSteps
  const getStepStatus = (stepType: string): string | null => {
    // Get completedSteps directly from the analysis response
    if (!analysis?.completedSteps || analysis.completedSteps.length === 0) return null;
    
    // Find the matching step
    const matchingStep = analysis.completedSteps.find(step => {
      // For deployment-related steps, we have different step names to check
      if (stepType === 'deployment_instructions') {
        return step.step === 'deployment_instructions' || step.step === 'analyze_deployment';
      } else if (stepType === 'deployment_implementation') {
        return step.step === 'deployment_implementation' || step.step === 'implement_deployment_script';
      } else if (stepType === 'verify_deployment') {
        return step.step === 'verify_deployment' || step.step === 'verify_deployment_script';
      }
      return step.step === stepType;
    });

    return matchingStep && matchingStep.status ? matchingStep.status : null;
  };

  // Use completedSteps directly from the analysis response
  // No need for a separate API call since it's already included in the analysis response
  
  // Combine all data fetching in a single effect
  useEffect(() => {
    const fetchAllDeploymentData = async () => {
      try {
        console.log(`Fetching deployment instructions for submission ${submissionId}`);
        const response = await fetch(`/api/fetch-deployment-instructions/${submissionId}`);
        if (!response.ok) {
          // Try to get more detailed error information
          let errorText = `Failed to fetch deployment instructions: ${response.status}`;
          try {
            const errorData = await response.json();
            if (errorData.error) {
              errorText = errorData.error;
              
              // If the error is from the external API, add more context
              if (errorData.submissionId) {
                errorText += ` (Using submission ID: ${errorData.submissionId})`;
              }
            }
          } catch (e) {
            // If the error response couldn't be parsed
          }
          
          throw new Error(errorText);
        }
        
        const data = await response.json();
        console.log("Successfully received deployment instructions:", data);
        setDeploymentData(data);
        
        // No need to fetch completed steps separately - they're already in the analysis response
        
        // Preload deployment script and verification data
        console.log("Preloading script and verification data...");
        // Fetch deployment script in parallel
        fetchDeploymentScript();
        
        // Fetch verification data in parallel
        fetchVerificationData();
        
        // Automatically fetch submission details to show any available error logs
        await fetchSubmissionDetails();
      } catch (err) {
        console.error("Error fetching deployment instructions:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch deployment instructions");
        
        // Automatically fetch submission details for troubleshooting when there's an error
        try {
          await fetchSubmissionDetails();
        } catch (submissionErr) {
          console.error("Could not fetch submission details:", submissionErr);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllDeploymentData();
  }, [submissionId, analysis]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-blue-500">Loading deployment instructions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-900 p-4 rounded-md">
        <h3 className="text-red-400 font-medium">Error Loading Deployment Instructions</h3>
        <p className="text-gray-300 mt-2">{error}</p>
        
        {/* Show detailed error logs from submission details API if available */}
        {submissionDetails && (
          <div className="mt-4 p-3 bg-black/40 border border-gray-800 rounded-md">
            <div className="flex items-center justify-between">
              <h4 className="text-red-400 text-sm font-medium">Error Logs</h4>
              <button 
                onClick={() => setIsShowingDetails(!isShowingDetails)}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                {isShowingDetails ? 'Hide Details' : 'Show Details'}
              </button>
            </div>
            
            {isShowingDetails && (
              <div className="mt-2">
                {/* Show step_metadata logs if available */}
                {submissionDetails.step_metadata && (
                  <>
                    {/* Show deployment_instructions (analyze_deployment) logs if available */}
                    {submissionDetails.step_metadata.analyze_deployment?.message && (
                      <div className="mb-3">
                        <h5 className="text-yellow-400 text-xs font-medium mb-1">Deployment Instructions Logs:</h5>
                        <pre className="bg-black/50 p-2 rounded text-gray-400 text-xs overflow-auto max-h-32">
                          {submissionDetails.step_metadata.analyze_deployment.message}
                        </pre>
                      </div>
                    )}
                    
                    {/* Show deployment_implementation (implement_deployment_script) logs if available */}
                    {submissionDetails.step_metadata.implement_deployment_script?.message && (
                      <div className="mb-3">
                        <h5 className="text-yellow-400 text-xs font-medium mb-1">Deployment Script Implementation Logs:</h5>
                        <pre className="bg-black/50 p-2 rounded text-gray-400 text-xs overflow-auto max-h-32">
                          {submissionDetails.step_metadata.implement_deployment_script.message}
                        </pre>
                        {submissionDetails.step_metadata.implement_deployment_script.error && (
                          <div className="mt-2 p-2 rounded bg-red-900/30 border border-red-800">
                            <h6 className="text-red-400 text-xs font-medium mb-1">Error:</h6>
                            <pre className="text-red-300 text-xs overflow-auto max-h-24">
                              {submissionDetails.step_metadata.implement_deployment_script.error}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Show verify_deployment (verify_deployment_script) logs if available */}
                    {submissionDetails.step_metadata.verify_deployment_script?.message && (
                      <div className="mb-3">
                        <h5 className="text-yellow-400 text-xs font-medium mb-1">Verification Logs:</h5>
                        <pre className="bg-black/50 p-2 rounded text-gray-400 text-xs overflow-auto max-h-32">
                          {submissionDetails.step_metadata.verify_deployment_script.message}
                        </pre>
                      </div>
                    )}
                  </>
                )}
                
                {/* Show completed steps data to help troubleshoot */}
                {submissionDetails.completed_steps && submissionDetails.completed_steps.length > 0 && (
                  <div className="mb-3">
                    <h5 className="text-yellow-400 text-xs font-medium mb-1">Completed Steps Status:</h5>
                    <pre className="bg-black/50 p-2 rounded text-gray-400 text-xs overflow-auto max-h-32">
                      {JSON.stringify(submissionDetails.completed_steps, null, 2)}
                    </pre>
                  </div>
                )}
                
                {/* Show general error message if no specific logs are available */}
                {(!submissionDetails.step_metadata || (
                  !submissionDetails.step_metadata.analyze_deployment?.message &&
                  !submissionDetails.step_metadata.implement_deployment_script?.message &&
                  !submissionDetails.step_metadata.verify_deployment_script?.message &&
                  (!submissionDetails.completed_steps || submissionDetails.completed_steps.length === 0)
                )) && (
                  <p className="text-gray-400 text-xs">
                    No detailed error logs available. This could be a network error or the analysis service may be unavailable.
                    <button 
                      className="block mt-2 text-blue-400 hover:text-blue-300 text-xs underline"
                      onClick={() => console.log('Full submission details:', submissionDetails)}
                    >
                      Show full submission data in console
                    </button>
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        
        <div className="mt-4 p-3 bg-black/40 border border-gray-700 rounded-md">
          <h4 className="text-yellow-400 text-sm font-medium">Troubleshooting Help</h4>
          <ul className="text-gray-400 mt-2 text-sm list-disc pl-5 space-y-1">
            <li>Make sure the deployment analysis step has been completed</li>
            <li>This could be a temporary issue with the external analysis service</li>
            <li>The submission ID may not match any data in the external service</li>
          </ul>
          <p className="text-gray-400 mt-3 text-sm">
            Try running the deployment analysis step first by clicking on the "Analyze Deployment" button in the steps list, then refresh this page.
          </p>
        </div>
        
        <div className="mt-4 flex space-x-4">
          <button 
            onClick={() => window.location.reload()}
            className="px-3 py-1 text-sm bg-blue-900/50 hover:bg-blue-900/80 border border-blue-700 rounded text-blue-200"
          >
            Refresh Page
          </button>
          <button 
            onClick={() => {
              // Fetch submission details with error logs
              fetchSubmissionDetails();
            }}
            className="px-3 py-1 text-sm bg-yellow-900/50 hover:bg-yellow-900/80 border border-yellow-700 rounded text-yellow-200"
          >
            Check Error Logs
          </button>
          <button 
            onClick={() => {
              // This would normally trigger the deployment analysis
              // For now, just show an info message
              alert("To run deployment analysis, go to the steps list and click 'Analyze Deployment'");
            }}
            className="px-3 py-1 text-sm bg-green-900/50 hover:bg-green-900/80 border border-green-700 rounded text-green-200"
          >
            Run Deployment Analysis
          </button>
        </div>
      </div>
    );
  }

  if (!deploymentData) {
    return <p>No deployment data available. Please try refreshing or regenerating the instructions.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 p-4 rounded-md">
        <h3 className="text-xl font-semibold text-blue-400">{deploymentData.title || "Deployment Instructions"}</h3>
        <p className="text-gray-400 mt-3 text-sm">{deploymentData.description || "Follow these steps to deploy the smart contracts to your local development network."}</p>
      </div>
      
      {/* Deployment process status boxes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Deployment instructions box */}
        <div 
          className={`border p-3 rounded cursor-pointer ${activeTab === "steps" ? "border-blue-500 bg-blue-900/20" : "border-gray-700 bg-gray-900/30 hover:bg-gray-800/30"}`}
          onClick={() => setActiveTab("steps")}
        >
          <div className="flex items-center">
            <div className="rounded-full w-8 h-8 flex items-center justify-center mr-3 bg-blue-900/50 text-blue-300">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h4 className="font-medium text-blue-300">Deployment Instructions</h4>
              <p className="text-xs text-gray-400">
                {getStepTimestamp('deployment_instructions') ? 
                  `Generated at ${format(new Date(getStepTimestamp('deployment_instructions') || new Date()), "MMM dd, h:mm a")}` : 
                  `Generated at ${format(new Date(deploymentData.createdAt || new Date()), "MMM dd, h:mm a")}`
                }
              </p>
            </div>
            <div className="ml-auto">
              <Badge variant="outline" className="bg-green-900/30 text-green-300 border-green-700">
                Complete
              </Badge>
            </div>
          </div>
        </div>
        
        {/* Deployment implementation script box */}
        <div 
          className={`border p-3 rounded cursor-pointer ${activeTab === "script" ? "border-blue-500 bg-blue-900/20" : "border-gray-700 bg-gray-900/30 hover:bg-gray-800/30"}`}
          onClick={() => {
            setActiveTab("script");
            if (!deploymentScript && !scriptError) {
              fetchDeploymentScript();
            }
          }}
        >
          <div className="flex items-center">
            <div className="rounded-full w-8 h-8 flex items-center justify-center mr-3 bg-blue-900/50 text-blue-300">
              <Code className="h-4 w-4" />
            </div>
            <div>
              <h4 className="font-medium text-blue-300">Implemented Script</h4>
              <p className="text-xs text-gray-400">
                {isLoadingScript ? 
                  "Loading script..." :
                  deploymentScript ? 
                    `Updated at ${format(new Date(deploymentScript.updatedAt || getStepTimestamp('deployment_implementation') || new Date()), "MMM dd, h:mm a")}` :
                    getStepTimestamp('deployment_implementation') ?
                      `Updated at ${format(new Date(getStepTimestamp('deployment_implementation') || new Date()), "MMM dd, h:mm a")}` :
                      "Script not yet available"}
              </p>
            </div>
            <div className="ml-auto">
              {isLoadingScript ? (
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              ) : (() => {
                // First check if we have status directly from the deploymentScript object
                if (deploymentScript && deploymentScript.status) {
                  return (
                    <Badge variant={deploymentScript.status === "error" || deploymentScript.status === "failed" ? "destructive" : "outline"} 
                      className={deploymentScript.status === "error" || deploymentScript.status === "failed" ? 
                        "bg-red-900/30 text-red-300 border-red-700" : 
                        "bg-green-900/30 text-green-300 border-green-700"}
                    >
                      {deploymentScript.status === "error" || deploymentScript.status === "failed" ? "Failed" : "Success"}
                    </Badge>
                  );
                }
                
                // Next check if we have status from the completedSteps in analysis
                const stepStatus = getStepStatus('deployment_implementation');
                if (stepStatus) {
                  return (
                    <Badge variant={stepStatus === "error" || stepStatus === "failed" ? "destructive" : "outline"} 
                      className={stepStatus === "error" || stepStatus === "failed" ? 
                        "bg-red-900/30 text-red-300 border-red-700" : 
                        "bg-green-900/30 text-green-300 border-green-700"}
                    >
                      {stepStatus === "error" || stepStatus === "failed" ? "Failed" : "Success"}
                    </Badge>
                  );
                }
                
                // Default to pending
                return (
                  <Badge variant="outline" className="bg-yellow-900/30 text-yellow-300 border-yellow-700">
                    Pending
                  </Badge>
                );
              })()}
            </div>
          </div>
        </div>
        
        {/* Verification results box */}
        <div 
          className={`border p-3 rounded cursor-pointer ${activeTab === "verification" ? "border-blue-500 bg-blue-900/20" : "border-gray-700 bg-gray-900/30 hover:bg-gray-800/30"}`}
          onClick={() => {
            setActiveTab("verification");
            // Always fetch the latest verification data and update timestamps
            fetchVerificationData();
          }}
        >
          <div className="flex items-center">
            <div className="rounded-full w-8 h-8 flex items-center justify-center mr-3 bg-blue-900/50 text-blue-300">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <h4 className="font-medium text-blue-300">Verification Results</h4>
              <p className="text-xs text-gray-400">
                {isLoadingVerification ? 
                  "Loading verification..." :
                  verificationData ? 
                    `Verified at ${format(new Date(verificationData.timestamp || getStepTimestamp('verify_deployment') || new Date()), "MMM dd, h:mm a")}` :
                    getStepTimestamp('verify_deployment') ?
                      `Verified at ${format(new Date(getStepTimestamp('verify_deployment') || new Date()), "MMM dd, h:mm a")}` :
                      "Loading verification..."}
              </p>
            </div>
            <div className="ml-auto">
              {isLoadingVerification ? (
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              ) : (() => {
                // First check if we have status directly from the verificationData object
                if (verificationData && verificationData.status) {
                  return (
                    <Badge variant={verificationData.status === "failed" || verificationData.status === "error" ? "destructive" : 
                           verificationData.status === "pending" ? "outline" : "outline"} 
                      className={verificationData.status === "failed" || verificationData.status === "error" ? 
                        "bg-red-900/30 text-red-300 border-red-700" : 
                        verificationData.status === "pending" ?
                        "bg-yellow-900/30 text-yellow-300 border-yellow-700" :
                        "bg-green-900/30 text-green-300 border-green-700"}
                    >
                      {verificationData.status === "failed" || verificationData.status === "error" ? "Failed" : 
                       verificationData.status === "pending" ? "Pending" : "Success"}
                    </Badge>
                  );
                }
                
                // Next check if we have status from the completedSteps in analysis
                const stepStatus = getStepStatus('verify_deployment');
                if (stepStatus) {
                  return (
                    <Badge variant={stepStatus === "error" || stepStatus === "failed" ? "destructive" : "outline"} 
                      className={stepStatus === "error" || stepStatus === "failed" ? 
                        "bg-red-900/30 text-red-300 border-red-700" : 
                        "bg-green-900/30 text-green-300 border-green-700"}
                    >
                      {stepStatus === "error" || stepStatus === "failed" ? "Failed" : "Success"}
                    </Badge>
                  );
                }
                
                // Default to pending
                return (
                  <Badge variant="outline" className="bg-yellow-900/30 text-yellow-300 border-yellow-700">
                    Pending
                  </Badge>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
      
      {/* Tab content */}
      <div className="mt-6">
        {/* Deployment steps tab */}
        {activeTab === "steps" && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-green-400">Deployment Steps</h3>
            <div className="space-y-3">
              {(deploymentData.deploymentSteps || []).map((step: any, index: number) => (
                <div key={index} className="border border-gray-700 p-4 rounded-md bg-black/30 relative">
                  <div className="absolute -top-3 -left-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                    Step {index + 1}
                  </div>
                  <h4 className="text-blue-300 font-medium mb-2">{step.name}</h4>
                  <div className="grid grid-cols-12 gap-2 text-xs mb-2">
                    <div className="col-span-3 text-gray-400">Contract:</div>
                    <div className="col-span-9 text-green-300 font-mono">{step.contract}</div>
                    
                    {step.function && (
                      <>
                        <div className="col-span-3 text-gray-400">Function:</div>
                        <div className="col-span-9 text-green-300 font-mono">{step.function}</div>
                      </>
                    )}
                    
                    <div className="col-span-3 text-gray-400">Reference:</div>
                    <div className="col-span-9 text-green-300 font-mono">{step.reference}</div>
                    
                    <div className="col-span-3 text-gray-400">Gas Estimate:</div>
                    <div className="col-span-9 text-yellow-300 font-mono">{step.gas}</div>
                  </div>
                  
                  {Object.keys(step.params || {}).length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-gray-400">Parameters:</div>
                      <div className="grid grid-cols-1 gap-1 mt-1 bg-gray-800/50 p-2 rounded">
                        {Object.entries(step.params).map(([key, value]: [string, any], i: number) => (
                          <div key={i} className="text-sm">
                            <span className="text-gray-500">{key}: </span>
                            <span className="text-green-300">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-3">
                    <div className="text-xs text-gray-400">Transaction Code:</div>
                    <div className="text-sm font-mono text-cyan-300 bg-gray-800 p-2 rounded mt-1 overflow-x-auto">
                      {step.tx}
                    </div>
                  </div>
                  
                  <div className="mt-2">
                    <div className="text-xs text-gray-400">Expected Result:</div>
                    <div className="text-sm text-blue-300 mt-1">{step.result}</div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Add a helpful note for the deployment sequence */}
            <div className="bg-yellow-950/30 border border-yellow-900/50 rounded p-4 mt-6">
              <h4 className="text-yellow-400 text-sm font-medium flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Important Note
              </h4>
              <p className="text-gray-300 mt-2 text-sm">
                The deployment steps should be executed in sequence. Each step may reference contracts deployed in previous steps.
                Make sure to save the deployment addresses after each contract deployment for use in subsequent steps.
              </p>
            </div>
          </div>
        )}
        
        {/* Deployment script tab */}
        {activeTab === "script" && (
          <div className="space-y-4">
            {/* Display error message from submission details if exists */}
            {submissionDetails?.message && (
              <div className="bg-red-900/30 border border-red-800 rounded-md p-4 mb-4">
                <h3 className="text-red-400 font-medium flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Error in Deployment Script
                </h3>
                <pre className="text-sm text-white/80 mt-2 overflow-x-auto whitespace-pre-wrap">
                  {submissionDetails.message}
                </pre>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-green-400">Deployment Script</h3>
              {deploymentScript && (
                <Button 
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    // Copy script to clipboard
                    navigator.clipboard.writeText(deploymentScript.content);
                    // Show toast
                    toast({
                      title: "Copied to clipboard",
                      description: "The deployment script has been copied to your clipboard.",
                      duration: 3000,
                    });
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  Copy Code
                </Button>
              )}
            </div>
            
            {isLoadingScript ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <span className="ml-2 text-blue-500">Loading deployment script...</span>
              </div>
            ) : scriptError ? (
              <div className="bg-red-900/30 border border-red-900 p-4 rounded-md">
                <h3 className="text-red-400 font-medium">Error Loading Deployment Script</h3>
                <p className="text-gray-300 mt-2">{scriptError}</p>
                <button 
                  onClick={fetchDeploymentScript}
                  className="mt-3 px-3 py-1 text-sm bg-blue-900/50 hover:bg-blue-900/80 border border-blue-700 rounded text-blue-200"
                >
                  Retry
                </button>
              </div>
            ) : deploymentScript ? (
              <div className="rounded-md border border-gray-700 overflow-hidden">
                <div className="bg-gray-800 px-4 py-2 text-xs font-medium text-gray-400 border-b border-gray-700 flex justify-between items-center">
                  <div className="flex items-center">
                    <FileCode className="h-4 w-4 mr-2" />
                    <span>{deploymentScript.filename}</span>
                  </div>
                  <span className="text-xs">
                    {deploymentScript.repo}/{deploymentScript.path}
                  </span>
                </div>
                <pre className="p-4 text-sm font-mono bg-gray-900 text-green-300 overflow-x-auto">
                  {/* Split content by newlines and add line numbers */}
                  {deploymentScript.content.split('\n').map((line, index) => (
                    <div key={index} className="flex">
                      <span className="text-gray-500 w-10 inline-block text-right pr-2 select-none">{index + 1}</span>
                      <span className="flex-1">{line}</span>
                    </div>
                  ))}
                </pre>
              </div>
            ) : (
              <div className="bg-gray-900/50 border border-gray-700 p-6 rounded-md text-center">
                <p className="text-gray-400 mb-4">Deployment script not loaded yet</p>
                <Button 
                  variant="outline" 
                  onClick={fetchDeploymentScript}
                  className="bg-blue-900/20 border-blue-700 text-blue-300 hover:bg-blue-900/40"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Load Script
                </Button>
              </div>
            )}
            
            {/* Display error logs if available */}
            {submissionDetails && submissionDetails.message && getStepStatus('deployment_implementation') === 'error' && (
              <div className="bg-red-900/20 border border-red-900/50 rounded-md p-4 mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-red-400 text-sm font-medium">Deployment Script Implementation Error</h4>
                  <Badge variant="destructive" className="bg-red-900/30 text-red-300 border-red-800">
                    Failed
                  </Badge>
                </div>
                <pre className="p-3 text-xs font-mono bg-black/50 text-red-300 overflow-x-auto rounded border border-red-900/30 mt-2">
                  {submissionDetails.message.split('\n').map((line, index) => (
                    <div key={index} className="flex">
                      <span className="text-gray-500 w-10 inline-block text-right pr-2 select-none">{index + 1}</span>
                      <span className="flex-1">{line}</span>
                    </div>
                  ))}
                </pre>
              </div>
            )}
            
            {/* Display step metadata if available */}
            {submissionDetails && submissionDetails.step_metadata && submissionDetails.step_metadata.implement_deployment_script && 
             (submissionDetails.step_metadata.implement_deployment_script.message || submissionDetails.step_metadata.implement_deployment_script.error) && (
              <div className="bg-red-900/20 border border-red-900/50 rounded-md p-4 mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-red-400 text-sm font-medium">Deployment Script Implementation Error Details</h4>
                </div>
                
                {submissionDetails.step_metadata.implement_deployment_script.message && (
                  <div className="mb-3">
                    <h5 className="text-gray-300 text-xs font-medium mb-1">Log:</h5>
                    <pre className="p-3 text-xs font-mono bg-black/50 text-gray-300 overflow-x-auto rounded border border-gray-800 mt-1">
                      {submissionDetails.step_metadata.implement_deployment_script.message.split('\n').map((line, index) => (
                        <div key={index} className="flex">
                          <span className="text-gray-500 w-10 inline-block text-right pr-2 select-none">{index + 1}</span>
                          <span className="flex-1">{line}</span>
                        </div>
                      ))}
                    </pre>
                  </div>
                )}
                
                {submissionDetails.step_metadata.implement_deployment_script.error && (
                  <div>
                    <h5 className="text-red-400 text-xs font-medium mb-1">Error:</h5>
                    <pre className="p-3 text-xs font-mono bg-black/50 text-red-300 overflow-x-auto rounded border border-red-900/30 mt-1">
                      {submissionDetails.step_metadata.implement_deployment_script.error.split('\n').map((line, index) => (
                        <div key={index} className="flex">
                          <span className="text-gray-500 w-10 inline-block text-right pr-2 select-none">{index + 1}</span>
                          <span className="flex-1">{line}</span>
                        </div>
                      ))}
                    </pre>
                  </div>
                )}
              </div>
            )}
            
            {deploymentScript && (
              <div className="bg-gray-950 border border-gray-800 rounded p-4 mt-4">
                <h4 className="text-blue-400 text-sm font-medium">How to Use This Script</h4>
                <ul className="mt-2 text-sm text-gray-300 space-y-2 list-disc pl-5">
                  <li>This script is generated automatically based on the deployment instructions</li>
                  <li>It's compatible with Hardhat deployment environments</li>
                  <li>The script handles deployment of all contracts in the correct sequence</li>
                  <li>Copy this to your project's deployment scripts directory</li>
                  <li>Run with <code className="text-green-300 bg-black/30 px-1 rounded">npx hardhat run scripts/deploy.ts --network [network]</code></li>
                </ul>
              </div>
            )}
          </div>
        )}
        
        {/* Verification results tab */}
        {activeTab === "verification" && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-green-400">Deployment Verification</h3>
            
            {isLoadingVerification ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <span className="ml-2 text-blue-500">Loading verification results...</span>
              </div>
            ) : verificationError ? (
              <div className="bg-red-900/30 border border-red-900 p-4 rounded-md">
                <h3 className="text-red-400 font-medium">Error Loading Verification Results</h3>
                <p className="text-gray-300 mt-2">{verificationError}</p>
                <button 
                  onClick={fetchVerificationData}
                  className="mt-3 px-3 py-1 text-sm bg-blue-900/50 hover:bg-blue-900/80 border border-blue-700 rounded text-blue-200"
                >
                  Retry
                </button>
              </div>
            ) : verificationData ? (
              <div className="space-y-4">
                <div className="bg-gray-900 border border-gray-700 rounded-md overflow-hidden">
                  <div className="bg-gray-800 p-3 border-b border-gray-700 flex justify-between items-center">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-300">Verification Status</span>
                    </div>
                    <Badge variant={verificationData.status === "completed" ? "outline" : "destructive"} 
                      className={verificationData.status === "completed" ? 
                        "bg-green-900/30 text-green-300 border-green-700" : 
                        "bg-red-900/30 text-red-300 border-red-700"}
                    >
                      {verificationData.status === "completed" ? "Success" : "Failed"}
                    </Badge>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-gray-300">{verificationData.details}</p>
                    
                    <div className="mt-4">
                      <h4 className="text-xs text-gray-400 mb-2">Verification Logs:</h4>
                      <div className="bg-black/40 border border-gray-800 rounded p-3 font-mono text-xs">
                        {verificationData.logs.map((log: string, index: number) => {
                          // Style different log levels differently
                          let textColor = "text-gray-300";
                          if (log.includes("[SUCCESS]")) textColor = "text-green-400";
                          if (log.includes("[ERROR]")) textColor = "text-red-400";
                          if (log.includes("[INFO]")) textColor = "text-blue-400";
                          
                          return (
                            <div key={index} className="flex py-0.5">
                              <span className="text-gray-500 w-10 inline-block text-right pr-2 select-none">{index + 1}</span>
                              <span className={`flex-1 ${textColor}`}>{log}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                
                {verificationData.status === "completed" ? (
                  <div className="bg-green-900/20 border border-green-900/50 rounded p-4">
                    <h4 className="text-green-400 text-sm font-medium flex items-center">
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                      Verification Passed
                    </h4>
                    <p className="text-gray-300 mt-2 text-sm">
                      The deployment script has been verified and is ready for use. You can proceed to the next step.
                    </p>
                  </div>
                ) : (
                  <div className="bg-red-900/20 border border-red-900/50 rounded p-4">
                    <h4 className="text-red-400 text-sm font-medium flex items-center">
                      <AlertTriangle className="h-5 w-5 mr-2" />
                      Verification Failed
                    </h4>
                    <p className="text-gray-300 mt-2 text-sm">
                      The deployment script verification has failed. Please review the logs above for details on what needs to be corrected.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-900/50 border border-gray-700 p-6 rounded-md text-center">
                <p className="text-gray-400 mb-4">Verification results not loaded yet</p>
                <Button 
                  variant="outline" 
                  onClick={fetchVerificationData}
                  className="bg-blue-900/20 border-blue-700 text-blue-300 hover:bg-blue-900/40"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Load Results
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Function to check if deployment instructions are completed
const checkDeploymentCompletion = async (submissionId: string): Promise<boolean> => {
  try {
    console.log("Checking deployment completion for:", submissionId);
    const response = await fetch(`/api/deployment-status/${submissionId}`);
    
    if (!response.ok) {
      console.error("Error checking deployment status:", response.status);
      return false;
    }
    
    const data = await response.json();
    console.log("Deployment status check result:", data);
    
    return data?.isCompleted === true;
  } catch (error) {
    console.error("Error in checkDeploymentCompletion:", error);
    return false;
  }
};

export default function AnalysisPage() {
  const { id } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const isFreeUser = user?.plan === 'free';
  const [selectedStep, setSelectedStep] = useState<string>("files");
  const [activeSubstep, setActiveSubstep] = useState<string>("");
  const [openChats, setOpenChats] = useState<Record<string, boolean>>({});
  const [deploymentInput, setDeploymentInput] = useState<string>("");
  const [isGeneratingDeployment, setIsGeneratingDeployment] = useState(false);
  const [generatedDeployment, setGeneratedDeployment] = useState<any>(null);
  const [isDeploymentLoading, setIsDeploymentLoading] = useState<boolean>(false);
  const [isAnalysisInProgress, setIsAnalysisInProgress] = useState(false);
  const [refreshIntervalId, setRefreshIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [simRepo, setSimRepo] = useState<{owner: string, repo: string, branch: string} | null>(null);
  const [simRepoError, setSimRepoError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  

  const { data: project } = useQuery<{
    id: number;
    name: string;
    githubUrl: string;
    userId: number;
    teamId: number | null;
    createdAt: string;
    isDeleted: boolean;
  }>({
    queryKey: [`/api/project/${id}`],
    enabled: !!id
  });
  
  // Log project data when it changes
  useEffect(() => {
    if (project) {
      console.log("Project data received:", project);
    }
  }, [project]);

  const { data: analysis, isLoading, refetch } = useQuery<AnalysisResponse>({
    queryKey: [`/api/analysis/${id}`],
    // Removed auto-refresh interval to prevent constant page refreshing
    refetchInterval: false,
  });

  // Set the selected step to the current in-progress step or the first completed one
  // No tab initialization needed
  useEffect(() => {
    // Code content is always visible now
  }, []);

  // No scroll effect needed
  useEffect(() => {
    // No scrolling when step changes
  }, [selectedStep]);
  
  // Clean up the refresh interval when component unmounts
  useEffect(() => {
    return () => {
      if (refreshIntervalId) {
        clearInterval(refreshIntervalId);
      }
    };
  }, [refreshIntervalId]);

  // This effect only runs once on initial load and whenever analysis changes,
  // and only sets the selected step if not manually selected by the user
  const userSelectedRef = useRef(false);
  
  // Store the submission ID whenever analysis data is updated
  useEffect(() => {
    console.log("Analysis data received:", analysis);
    
    if (analysis?.submissionId) {
      console.log(`Found submission ID in analysis data: ${analysis.submissionId}`);
      
      if (analysis.submissionId !== submissionId) {
        console.log(`Setting submission ID from analysis data: ${analysis.submissionId}`);
        setSubmissionId(analysis.submissionId);
      } else {
        console.log(`Submission ID already set to: ${submissionId}`);
      }
    } else {
      console.log("No submission ID found in analysis data");
    }
  }, [analysis, submissionId]);
  
  // Fetch simulation repository details when the user is viewing the test_setup step
  useEffect(() => {
    const fetchSimulationRepo = async () => {
      if (id && selectedStep === 'test_setup') {
        try {
          setSimRepo(null);
          setSimRepoError(null);
          
          const response = await fetch(`/api/simulation-repo/${id}`);
          if (!response.ok) {
            const errorData = await response.json();
            console.error('Failed to fetch simulation repo:', errorData);
            setSimRepoError(errorData.error || 'Failed to retrieve simulation repository information');
            return;
          }
          
          const data = await response.json();
          console.log('Simulation repository data:', data);
          
          if (!data.owner || !data.repo) {
            setSimRepoError('Invalid simulation repository data received');
            return;
          }
          
          setSimRepo({
            owner: data.owner,
            repo: data.repo,
            branch: data.branch || 'main'
          });
        } catch (error) {
          console.error('Error fetching simulation repository:', error);
          setSimRepoError('An error occurred while retrieving the simulation repository');
        }
      }
    };
    
    fetchSimulationRepo();
  }, [id, selectedStep]);

  useEffect(() => {
    if (analysis && analysis.steps) {
      // Reset user selection on each analysis update for testing
      // userSelectedRef.current = false;
      
      // Only auto-select a step if the user hasn't manually selected one yet
      if (!userSelectedRef.current) {
        // Special case: If the first step (files/analyze_project) is completed, 
        // automatically show the simulation environment (test_setup)
        const isFirstStepCompleted = isStepActuallyCompleted("files");
        
        if (isFirstStepCompleted) {
          console.log("First step is completed, showing simulation environment");
          setSelectedStep("test_setup");
          return;
        }
        
        // Standard logic for other cases
        // Find any step that should be "in_progress" according to our logic
        for (const step of analysisSteps) {
          const status = getStepStatus(step.id);
          if (status === "in_progress") {
            setSelectedStep(step.id);
            return;
          }
        }
        
        // Fallback: find any step that's explicitly marked as in_progress from the API
        const entries = Object.entries(analysis.steps) as [string, AnalysisStepStatus][];
        const inProgressStep = entries.find(
          ([_, step]) => step.status === "in_progress"
        );
        
        if (inProgressStep) {
          setSelectedStep(inProgressStep[0]);
        } else {
          // Find the last completed step
          const completedSteps = entries.filter(
            ([_, step]) => step.status === "completed"
          );
          
          const lastCompletedStep = completedSteps.length > 0 ? completedSteps[completedSteps.length - 1] : null;
            
          if (lastCompletedStep) {
            setSelectedStep(lastCompletedStep[0]);
          }
        }
      }
    }
  }, [analysis]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Analysis Not Found</h2>
          <p className="text-muted-foreground">The requested analysis could not be found.</p>
          <Button asChild>
            <Link href="/">Return Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Map UI step IDs to API step names
  const getApiStepName = (stepId: string): string => {
    return stepId === "files" ? "analyze_project" :
      stepId === "actors" ? "analyze_actors" :
      stepId === "test_setup" ? "simulation_setup" :
      stepId === "deployment" ? "analyze_deployment" : // API uses analyze_deployment instead of deployment_instructions
      stepId === "simulations" ? "run_simulation" : "";
  };
  
  // Map API step names to UI step IDs (inverse of getApiStepName)
  const getUiStepId = (apiStepName: string): string => {
    return apiStepName === "analyze_project" ? "files" :
      apiStepName === "analyze_actors" ? "actors" :
      apiStepName === "simulation_setup" ? "test_setup" :
      (apiStepName === "analyze_deployment" || apiStepName === "deployment_instructions") ? "deployment" :
      apiStepName === "run_simulation" ? "simulations" : "";
  };
  
  // Get timestamp for completed step from API data
  const getCompletedStepTimestamp = (stepId: string): string | null => {
    // First convert the UI stepId to API step name
    const apiStepName = getApiStepName(stepId);
    
    // Look for this step in the steps data
    const completedStep = 
      analysis.completedSteps?.find(step => step.step === apiStepName);
    
    return completedStep?.updatedAt || null;
  };
  
  // Check if a step is actually completed based on the API status
  const isStepActuallyCompleted = (stepId: string): boolean => {
    if (!analysis?.completedSteps) return false;
    
    // Get the corresponding step name used in the API
    const apiStepName = getApiStepName(stepId);
    
    // Check if this step is in the completed_steps array
    return analysis.completedSteps.some(step => step.step === apiStepName);
  };
  
  // Function to explicitly check if a deployment step is completed using our enhanced endpoint
  const checkDeploymentCompletion = async (submissionId: string): Promise<boolean> => {
    try {
      if (!submissionId) return false;
      
      console.log(`Checking deployment completion for submission ${submissionId}`);
      // Check the dedicated status endpoint that checks multiple sources
      const response = await fetch(`/api/deployment-status/${submissionId}`);
      
      if (!response.ok) {
        console.error(`Error checking deployment status: ${response.status}`);
        return false;
      }
      
      const data = await response.json();
      console.log(`Deployment status check result:`, data);
      
      // The improved endpoint considers it completed if any of the checks (DB or API) pass
      return data.isCompleted === true;
    } catch (error) {
      console.error("Error checking deployment completion:", error);
      return false;
    }
  };
  
  const getStepStatus = (stepId: string): StepStatus => {
    // Special case for simulations step - if deployment is verified, mark it as completed
    if (stepId === "simulations" && isDeploymentVerificationCompleted(analysis.completedSteps)) {
      return "completed";
    }
    
    // ONLY use the completedSteps array to determine if a step is completed
    if (isStepActuallyCompleted(stepId)) {
      return "completed";
    }
    
    // Check if the step is explicitly marked as in_progress from the API
    if (analysis.steps[stepId]?.status === "in_progress") {
      return "in_progress";
    }
    
    // Check if the step is explicitly marked as failed from the API
    if (analysis.steps[stepId]?.status === "failed") {
      return "failed";
    }
    
    // Determine the next step that should be "in progress"
    // First, determine the index of the current step in our analysis steps array
    const stepIndex = analysisSteps.findIndex(step => step.id === stepId);
    if (stepIndex >= 0) {
      // Count how many steps are completed so far
      const completedCount = analysis.completedSteps?.length || 0;
      
      // If this step's index matches the completed count, it should be the next in progress
      // This assumes steps must be completed in sequential order
      if (stepIndex === completedCount) {
        return "in_progress";
      }
    }
    
    // Default to pending for any other case
    return "pending";
  };

  const getStepDetails = (stepId: string): string | null => {
    return analysis.steps[stepId]?.details || null;
  };

  const calculateProgress = (): number => {
    const totalSteps = analysisSteps.length;
    // Use completedSteps array for counting
    const completedStepsCount = analysis.completedSteps?.length || 0;
    return Math.round((completedStepsCount / totalSteps) * 100);
  };

  // Find the selected step object
  const currentStep = analysisSteps.find(step => step.id === selectedStep) || analysisSteps[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted p-6 pt-28">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <Link href="/projects">
              <Button variant="outline" className="gap-2 mb-2">
                <ChevronRight className="h-4 w-4 rotate-180" />
                Back to Projects
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <svg className="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">{project?.name || "Project"} Simulation</h1>
                {project?.githubUrl && (
                  <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 mt-1 text-sm flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1">
                      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                    </svg>
                    {(() => {
                      try {
                        // For display purposes only - format the GitHub URL nicely
                        return new URL(project.githubUrl).pathname.substring(1);
                      } catch (e) {
                        // If URL parsing fails, fallback to the raw URL
                        console.error("Error parsing GitHub URL:", e);
                        return project.githubUrl;
                      }
                    })()}
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {/* Right side content if needed */}
          </div>
        </div>

        {/* Project Details section removed - info moved to page title */}

        {/* Compact Steps Bar */}
        <div className="flex flex-wrap justify-center mb-6">
          {analysisSteps.map((step, index) => (
            <div 
              key={step.id}
              onClick={(e) => {
                e.preventDefault();
                // Mark that user has manually selected a step
                userSelectedRef.current = true;
                // Change the selected step - no scrolling needed
                setSelectedStep(step.id);
              }}
              className={`flex items-center px-4 py-2 cursor-pointer border-b-2 ${
                selectedStep === step.id 
                  ? 'border-primary text-primary' 
                  : getStepStatus(step.id) === "completed"
                    ? 'border-green-500 text-green-500'
                    : getStepStatus(step.id) === "in_progress"
                      ? 'border-blue-500 text-blue-500' 
                      : 'border-gray-500 text-gray-500'
              }`}
            >
              {step.id === "files" && <FileCode className="h-5 w-5 mr-2" />}
              {step.id === "actors" && <Users className="h-5 w-5 mr-2" />}
              {step.id === "deployment" && <Box className="h-5 w-5 mr-2" />}
              {step.id === "test_setup" && <Laptop className="h-5 w-5 mr-2" />}
              {step.id === "simulations" && <PlayCircle className="h-5 w-5 mr-2" />}
              <span className="font-medium">{step.title}</span>
              <div className="ml-2">
                <StepStatus 
                  status={getStepStatus(step.id)} 
                  startTime={analysis.steps[step.id]?.startTime}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Main content with output */}
          <div className="w-full">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center justify-between w-full">
                    <span>
                      {currentStep.id === "files" ? "Project Summary" : 
                       currentStep.id === "actors" ? "Actor Summary" :
                       currentStep.id === "deployment" ? "Deployment Instructions" :
                       currentStep.id === "test_setup" ? "Simulation Setup" :
                       currentStep.id === "simulations" ? "Simulation Runs" :
                       currentStep.id}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        className="flex items-center"
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Refresh
                      </Button>
                      
                      {/* Refine button removed */}
                      
                      {/* Chat interface for refining removed */}
                    </div>
                  </div>
                  {currentStep.link && getStepStatus(currentStep.id) === "completed" && currentStep.id !== "simulations" && (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <Link href={currentStep.link}>
                        {currentStep.linkText}
                      </Link>
                    </Button>
                  )}
                </CardTitle>
                <CardDescription>
                  {(() => {
                  // Get the latest completed step and its timestamp 
                  const getLastCompletedStepInfo = () => {
                    if (!analysis?.completedSteps || analysis.completedSteps.length === 0) return null;
                    
                    // Sort by updatedAt timestamp to find the most recent
                    const sortedSteps = [...analysis.completedSteps].sort((a, b) => {
                      const dateA = new Date(a.updatedAt);
                      const dateB = new Date(b.updatedAt);
                      return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
                    });
                    
                    const latestStep = sortedSteps[0];
                    if (!latestStep) return null;
                    
                    // Convert API step name to UI step name
                    const uiStepName = 
                      latestStep.step === "project_summary" ? "files" :
                      latestStep.step === "actors_summary" ? "actors" :
                      latestStep.step === "analyze_deployment" || latestStep.step === "deployment_instructions" ? "deployment" :
                      latestStep.step === "simulation_setup" ? "test_setup" :
                      latestStep.step === "run_simulation" ? "simulations" : latestStep.step;
                      
                    // Find the matching step definition to get its display name
                    const stepDefinition = analysisSteps.find(s => s.id === uiStepName);
                    const stepDisplayName = stepDefinition?.title || uiStepName;
                    
                    return {
                      stepName: stepDisplayName,
                      timestamp: latestStep.updatedAt
                    };
                  };

                  // Determine the status text based on step status and data availability
                  const stepStatus = getStepStatus(currentStep.id);
                  
                  // Special case for test_setup when simRepo is available
                  if (currentStep.id === "test_setup" && simRepo) {
                    const lastStepInfo = getLastCompletedStepInfo();
                    if (lastStepInfo) {
                      try {
                        const dateObj = new Date(lastStepInfo.timestamp);
                        if (!isNaN(dateObj.getTime())) {
                          return `Latest step: ${lastStepInfo.stepName} (${format(dateObj, 'MMM d, h:mm a')})`;
                        } else {
                          return `Latest step: ${lastStepInfo.stepName}`;
                        }
                      } catch (e) {
                        console.error("Error formatting timestamp:", e);
                        return `Latest step: ${lastStepInfo.stepName}`;
                      }
                    }
                    return "Environment ready";
                  } else if (stepStatus === "in_progress") {
                    // Special case for deployment instructions
                    if (currentStep.id === "deployment") {
                      if (isAnalysisInProgress) {
                        return "Analysis in progress...";
                      } else {
                        return "Waiting for user input";
                      }
                    }
                    return "Analysis in progress...";
                  } else if (stepStatus === "failed") {
                    return "Analysis failed";
                  } else if (stepStatus === "completed") {
                    // Get the timestamp from the completed_steps array if available
                    const timestamp = getCompletedStepTimestamp(currentStep.id);
                    
                    if (timestamp) {
                      try {
                        // Parse and format the timestamp from the API
                        // Ensure we have a valid string before creating a Date object
                        const dateStr = String(timestamp);
                        const dateObj = new Date(dateStr);
                        if (!isNaN(dateObj.getTime())) {
                          return `Last analyzed: ${format(dateObj, 'MMM d, yyyy h:mm a')}`;
                        } else {
                          return `Last analyzed: ${dateStr}`;
                        }
                      } catch (e) {
                        console.error("Error formatting timestamp:", e, timestamp);
                        return `Last analyzed: ${String(timestamp)}`;
                      }
                    }
                    
                    // Fallback to using startTime if no timestamp in completed_steps
                    if (analysis.steps[currentStep.id]?.startTime) {
                      try {
                        // Ensure we have a valid string before creating a Date object
                        const startTime = String(analysis.steps[currentStep.id].startTime || "");
                        const dateObj = new Date(startTime);
                        if (!isNaN(dateObj.getTime())) {
                          return `Last analyzed: ${format(dateObj, 'MMM d, yyyy h:mm a')}`;
                        } else {
                          return `Last analyzed: ${startTime}`;
                        }
                      } catch (e) {
                        return `Last analyzed: ${String(analysis.steps[currentStep.id].startTime || "")}`;
                      }
                    } 
                    
                    // If no timestamp available at all
                    // Special case for simulations step
                    if (currentStep.id === "simulations" && isDeploymentVerificationCompleted(analysis.completedSteps)) {
                      return "Ready to run simulations";
                    }
                    
                    return "Analysis complete";
                  }
                  
                  // Default state for pending
                  return "Ready for analysis";
                })()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md bg-black/90 p-4">
                  {/* Special case for test_setup - show it regardless of status if simRepo is available */}
                  {currentStep.id === "test_setup" && simRepo ? (
                    <div className="text-white font-mono">
                      <div className="space-y-6">
                        {/* Test Environment with file viewer */}
                        <div className="mb-8">
                          <h3 className="text-xl font-semibold text-blue-400 mb-4">Test Environment</h3>
                          
                          {/* Network info panel */}
                          <div className="bg-gray-900 p-4 rounded-md mb-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <span className="text-gray-400">Runtime:</span>
                                <p className="text-white">Hardhat</p>
                              </div>
                              <div>
                                <span className="text-gray-400">Network:</span>
                                <p className="text-cyan-300">Local Hardhat</p>
                              </div>
                              <div>
                                <span className="text-gray-400">Chain ID:</span>
                                <p className="text-white">31337</p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Code Viewer */}
                          <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 mb-6">
                            <h4 className="text-lg font-medium text-blue-400 mb-3">Simulation Code</h4>
                            <div className="w-full overflow-hidden">
                              <GitHubCodeViewer 
                                owner={simRepo.owner}
                                repo={simRepo.repo}
                                branch={simRepo.branch}
                                path=""
                                showBreadcrumb={true}
                              />
                            </div>
                          </div>
                          
                          {/* Implementation Steps Section */}
                          <div className="space-y-4" id="implementation-steps">
                            <h3 className="text-xl font-semibold text-blue-400">Actor Implementations</h3>
                            
                            {/* Get actors data from API */}
                            {(() => {
                              let actorsData = { actors: [] };
                              try {
                                const actorsStep = analysis?.steps?.actors;
                                if (actorsStep?.jsonData) {
                                  if (typeof actorsStep.jsonData.actors_summary === 'string') {
                                    try {
                                      actorsData = JSON.parse(actorsStep.jsonData.actors_summary);
                                      console.log("Parsed actors data:", actorsData);
                                    } catch (e) {
                                      console.error("Failed to parse actors_summary:", e);
                                    }
                                  } else {
                                    actorsData = actorsStep.jsonData;
                                  }
                                }
                              } catch (e) {
                                console.error("Failed to parse actors data:", e);
                              }
                              
                              return (
                                <div className="space-y-4">
                                  {/* Actor Implementations Section */}
                                  <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                                    <p className="text-gray-300 mb-4">Create actor implementations based on the identified roles</p>
                                    
                                    {/* Dynamic Actor List */}
                                    <div className="space-y-4">
                                      {actorsData.actors && actorsData.actors.length > 0 ? (
                                        actorsData.actors.map((actor: any, index: number) => (
                                          <Collapsible key={index} className="bg-gray-800 rounded-md">
                                            <CollapsibleTrigger className="w-full p-4 flex items-center justify-between">
                                              <div>
                                                <h4 className="text-white text-left font-medium">{actor.name}</h4>
                                                <p className="text-gray-400 text-sm text-left">{actor.summary}</p>
                                              </div>
                                              <ChevronDown className="h-5 w-5 text-gray-500 shrink-0" />
                                            </CollapsibleTrigger>
                                            <CollapsibleContent className="px-4 pb-4">
                                              <div className="space-y-4">
                                                <div className="text-sm text-gray-300">
                                                  <p className="mb-2">{actor.summary}</p>
                                                </div>
                                                
                                                <div className="space-y-3">
                                                  <h5 className="text-sm font-medium text-blue-300">Actions</h5>
                                                  {actor.actions && actor.actions.map((action: any, i: number) => (
                                                    <Collapsible key={i} className="bg-gray-700/50 rounded-md">
                                                      <CollapsibleTrigger className="w-full p-3 flex items-center justify-between">
                                                        <div>
                                                          <h6 className="text-white text-left text-sm font-medium">{action.name}</h6>
                                                          <p className="text-gray-400 text-xs text-left">{action.summary}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                          <span className="text-xs bg-blue-900 px-2 py-1 rounded-full text-blue-200">
                                                            {action.contract_name}
                                                          </span>
                                                          <Button size="sm" variant="outline" className="h-7 text-xs">
                                                            Modify
                                                          </Button>
                                                        </div>
                                                      </CollapsibleTrigger>
                                                      <CollapsibleContent className="p-3 mt-2 bg-gray-700/30 rounded-md">
                                                        <div className="space-y-3">
                                                          <div>
                                                            <h5 className="text-sm font-medium text-blue-300 mb-2">Implementation</h5>
                                                            
                                                            <Tabs defaultValue="summary">
                                                              <TabsList className="bg-gray-800/90 h-8">
                                                                <TabsTrigger value="summary" className="h-7 text-xs px-3">
                                                                  <FileText className="h-3.5 w-3.5 mr-1" />
                                                                  Summary
                                                                </TabsTrigger>
                                                                <TabsTrigger value="code" className="h-7 text-xs px-3">
                                                                  <Code2 className="h-3.5 w-3.5 mr-1" />
                                                                  Code
                                                                </TabsTrigger>
                                                                <TabsTrigger value="preview" className="h-7 text-xs px-3">
                                                                  <FileEdit className="h-3.5 w-3.5 mr-1" />
                                                                  Preview Changes
                                                                </TabsTrigger>
                                                              </TabsList>
                                                              
                                                              <TabsContent value="summary" className="mt-0">
                                                                <div className="bg-black/40 p-3 rounded text-xs">
                                                                  <p className="text-green-400 mb-2">
                                                                    This action will call the <span className="font-bold">{action.function_name}</span> function on the <span className="font-bold">{action.contract_name}</span> contract.
                                                                  </p>
                                                                  
                                                                  <div className="text-white/80 space-y-2">
                                                                    <p>Contract interaction: {action.contract_name}</p>
                                                                    <p>Function: {action.function_name}</p>
                                                                    <p>Actor: {actor.name}</p>
                                                                    <p>Parameters will be passed according to the function specification</p>
                                                                  </div>
                                                                </div>
                                                              </TabsContent>
                                                              
                                                              <TabsContent value="code" className="mt-0">
                                                                <div className="bg-black/40 p-3 rounded text-xs">
                                                                  <pre className="whitespace-pre-wrap text-green-300 font-mono text-xs">{`
// Implementation for ${action.name}
// Contract: ${action.contract_name}
// Function: ${action.function_name}

async function execute() {
  // Setup required parameters
  const ${action.contract_name.toLowerCase()} = await ethers.getContractAt("${action.contract_name}", "${action.contract_name.toLowerCase()}Address");
  
  // Execute the transaction
  const tx = await ${action.contract_name.toLowerCase()}.${action.function_name.split('(')[0]}(
    // Parameters will depend on the specific function
  );
  
  // Wait for confirmation
  await tx.wait();
  
  // Log the result
  console.log("${action.name} executed successfully");
}
`}</pre>
                                                                </div>
                                                              </TabsContent>
                                                              
                                                              <TabsContent value="preview" className="mt-0">
                                                                <div className="bg-black/40 p-3 rounded text-xs">
                                                                  <div className="flex items-center justify-between mb-2">
                                                                    <div className="text-gray-300 text-xs">Modified implementation code:</div>
                                                                    <div className="flex gap-2">
                                                                      <Button size="sm" variant="outline" className="h-6 text-xs">
                                                                        Reject Changes
                                                                      </Button>
                                                                      <Button size="sm" variant="default" className="h-6 text-xs">
                                                                        Accept Changes
                                                                      </Button>
                                                                    </div>
                                                                  </div>
                                                                  <div className="border border-gray-700 rounded-md overflow-hidden">
                                                                    <div className="bg-red-950/30 p-2 text-red-300 font-mono text-xs line-through">{`async function execute() {
  // Setup required parameters
  const ${action.contract_name.toLowerCase()} = await ethers.getContractAt("${action.contract_name}", "${action.contract_name.toLowerCase()}Address");`}</div>
                                                                    <div className="bg-green-950/30 p-2 text-green-300 font-mono text-xs">{`async function execute() {
  // Setup required parameters with provider and signer
  const signer = await ethers.getSigner();
  const ${action.contract_name.toLowerCase()} = await ethers.getContractAt("${action.contract_name}", "${action.contract_name.toLowerCase()}Address", signer);`}</div>
                                                                  </div>
                                                                </div>
                                                              </TabsContent>
                                                            </Tabs>
                                                          </div>
                                                          
                                                          <div>
                                                            <h5 className="text-sm font-medium text-yellow-300 mb-2">Validation Rules</h5>
                                                            <Tabs defaultValue="summary">
                                                              <TabsList className="bg-gray-800/90 h-8">
                                                                <TabsTrigger value="summary" className="h-7 text-xs px-3">
                                                                  <FileText className="h-3.5 w-3.5 mr-1" />
                                                                  Rules
                                                                </TabsTrigger>
                                                                <TabsTrigger value="code" className="h-7 text-xs px-3">
                                                                  <Code2 className="h-3.5 w-3.5 mr-1" />
                                                                  Validation Code
                                                                </TabsTrigger>
                                                                <TabsTrigger value="preview" className="h-7 text-xs px-3">
                                                                  <FileEdit className="h-3.5 w-3.5 mr-1" />
                                                                  Preview Changes
                                                                </TabsTrigger>
                                                              </TabsList>
                                                              
                                                              <TabsContent value="summary" className="mt-0">
                                                                <div className="bg-black/40 p-3 rounded text-xs">
                                                                  <ul className="list-disc pl-5 text-yellow-400 space-y-1">
                                                                    <li>All required parameters must be provided and valid</li>
                                                                    <li>Actor must have appropriate permissions/role</li>
                                                                    <li>Actor must have sufficient balance if operations involve transfers</li>
                                                                    <li>Contract state must allow this operation</li>
                                                                    <li>Gas estimation must be within reasonable limits</li>
                                                                  </ul>
                                                                </div>
                                                              </TabsContent>
                                                              
                                                              <TabsContent value="code" className="mt-0">
                                                                <div className="bg-black/40 p-3 rounded text-xs">
                                                                  <pre className="whitespace-pre-wrap text-yellow-300 font-mono text-xs">{`
// Validation for ${action.name}
// Contract: ${action.contract_name}
// Function: ${action.function_name}

async function validate(params) {
  // Check actor permissions
  const actor = await ethers.getSigner();
  const ${action.contract_name.toLowerCase()} = await ethers.getContractAt("${action.contract_name}", "${action.contract_name.toLowerCase()}Address");
  
  // Verify actor has required permissions
  const hasPermission = true; // Replace with actual permission check
  
  // Check parameters are valid
  const parametersValid = true; // Replace with actual validation
  
  // Verify gas estimates
  const gasEstimate = await ${action.contract_name.toLowerCase()}.estimateGas.${action.function_name.split('(')[0]}();
  const gasWithinLimits = gasEstimate.lt(ethers.utils.parseUnits("5", "gwei"));
  
  return {
    valid: hasPermission && parametersValid && gasWithinLimits,
    errors: []
  };
}
`}</pre>
                                                                </div>
                                                              </TabsContent>
                                                              
                                                              <TabsContent value="preview" className="mt-0">
                                                                <div className="bg-black/40 p-3 rounded text-xs">
                                                                  <div className="text-yellow-300 mb-2">Enhanced validation with additional safety checks:</div>
                                                                  <pre className="whitespace-pre-wrap text-gray-300 font-mono text-xs">{`
// Additional checks added:
// 1. Verify contract state
// 2. Check for reentrancy vulnerabilities
// 3. Validate input bounds

async function enhancedValidate(params) {
  // Include existing validations...
  
  // Additional safety checks 
  const contractState = await checkContractState();
  const reentrancyProtected = await validateReentrancyProtection();
  
  return {
    valid: hasPermission && parametersValid && gasWithinLimits && 
           contractState.valid && reentrancyProtected,
    errors: [...basicValidation.errors, ...contractState.errors]
  };
}
`}</pre>
                                                                </div>
                                                              </TabsContent>
                                                            </Tabs>
                                                          </div>
                                                        </div>
                                                      </CollapsibleContent>
                                                    </Collapsible>
                                                  ))}
                                                </div>
                                              </div>
                                            </CollapsibleContent>
                                          </Collapsible>
                                        ))
                                      ) : (
                                        <div className="text-center p-6 bg-gray-800/50 rounded-lg">
                                          <p className="text-gray-400">No actors available. Please ensure the analysis has completed successfully.</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : getStepStatus(currentStep.id) === "in_progress" ? (
                    <div>
                      {currentStep.id === "deployment" ? (
                        <div className="space-y-6 text-white">
                          <div className="bg-gray-900/80 p-6 rounded-lg border border-gray-800">
                            <p className="text-gray-300 mb-6">
                              The contracts will be deployed to a local network, describe the specific deployment sequence and any contract calls that are necessary to complete the full deployment.
                            </p>
                            
                            <Textarea 
                              placeholder="Example: I want to deploy these contracts to a local Hardhat network for testing. 
The deployment should initialize the contracts with test values and set me as the admin."
                              className="min-h-[200px] mb-4 bg-black/50 border-gray-700 focus:border-blue-500"
                              value={deploymentInput}
                              onChange={(e) => setDeploymentInput(e.target.value)}
                            />
                            
                            <div className="flex justify-end gap-3">
                              <Button 
                                variant="outline" 
                                type="button"
                                onClick={() => {
                                  if (deploymentInput.trim().length === 0) {
                                    toast({
                                      title: "Input Required",
                                      description: "Please describe how you want to deploy these contracts",
                                      variant: "destructive"
                                    });
                                    return;
                                  }
                                  
                                  setIsGeneratingDeployment(true);
                                  setIsAnalysisInProgress(true);
                                  
                                  // Set up 10-second interval refresh until analysis is available
                                  if (refreshIntervalId) {
                                    clearInterval(refreshIntervalId);
                                  }
                                  
                                  // Function to handle the deployment analysis request
                                  const handleDeploymentRequest = (sid: string) => {
                                    console.log("Handling deployment with submission ID:", sid);
                                    
                                    const submissionData = {
                                      submission_id: sid,
                                      user_prompt: deploymentInput
                                    };
                                    
                                    console.log("Sending deployment analysis request with data:", submissionData);
                                    
                                    // Make the request to the API
                                    fetch('/api/analyze-deployment', {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json'
                                      },
                                      body: JSON.stringify(submissionData)
                                    })
                                    .then(res => {
                                      if (!res.ok) {
                                        throw new Error(`Failed to start analysis: ${res.status}`);
                                      }
                                      return res.json();
                                    })
                                    .then(async (data) => {
                                      console.log("Deployment analysis started:", data);
                                      
                                      // Get the submission ID from the analysis data
                                      const subId = data.submissionId;
                                      
                                      // Check immediately if deployment is already completed
                                      try {
                                        const isCompleted = await checkDeploymentCompletion(subId);
                                        
                                        if (isCompleted) {
                                          console.log("Deployment already completed, fetching results directly");
                                          const deploymentRes = await fetch(`/api/fetch-deployment-instructions/${subId}`);
                                          if (deploymentRes.ok) {
                                            const deploymentData = await deploymentRes.json();
                                            setGeneratedDeployment(deploymentData);
                                            setIsGeneratingDeployment(false);
                                            setIsAnalysisInProgress(false);
                                            // Refresh the analysis data to update UI
                                            refetch();
                                            return; // Exit early if we already have results
                                          }
                                        }
                                      } catch (error) {
                                        console.error("Error checking immediate deployment completion:", error);
                                      }
                                      
                                      // If not completed immediately, start polling
                                      const intervalId = setInterval(() => {
                                        // Check if the deployment is marked as completed in our database
                                        fetch(`/api/deployment-status/${subId}`)
                                          .then(res => res.ok ? res.json() : null)
                                          .then(statusData => {
                                            if (statusData?.isCompleted) {
                                              console.log("Deployment step is completed:", statusData);
                                              // Deployment is completed, now fetch the actual instructions
                                              fetch(`/api/fetch-deployment-instructions/${subId}`)
                                                .then(res => res.ok ? res.json() : null)
                                                .then(instructionsData => {
                                                  if (instructionsData) {
                                                    console.log("Fetched deployment instructions successfully:", instructionsData);
                                                    setGeneratedDeployment(instructionsData);
                                                    clearInterval(intervalId);
                                                    setRefreshIntervalId(null);
                                                    setIsGeneratingDeployment(false);
                                                    setIsAnalysisInProgress(false);
                                                    
                                                    // Also refresh main analysis data
                                                    refetch();
                                                    return;
                                                  }
                                                })
                                                .catch(err => console.error("Error fetching instructions:", err));
                                            }
                                          })
                                          .catch(err => console.error("Error checking deployment status:", err));
                                        
                                        // Also check main analysis endpoint for completion status as fallback
                                        refetch().then((result) => {
                                          // Check if deployment instructions are available in the analysis data
                                          if (result.data?.steps?.deployment?.jsonData || 
                                              (result.data?.completedSteps && 
                                               result.data.completedSteps.some(
                                                 step => step.step === getApiStepName("deployment")
                                               ))
                                          ) {
                                            // If we have data in our main analysis endpoint, use that
                                            clearInterval(intervalId);
                                            setRefreshIntervalId(null);
                                            setIsGeneratingDeployment(false);
                                            setIsAnalysisInProgress(false);
                                            
                                            // Update the generated deployment if it's in the result
                                            if (result.data?.steps?.deployment?.jsonData) {
                                              setGeneratedDeployment(result.data.steps.deployment.jsonData);
                                            }
                                            return;
                                          }
                                          
                                          // If not in main data, try the dedicated deployment instructions endpoint
                                          fetch(`/api/fetch-deployment-instructions/${subId}`)
                                            .then(res => {
                                              if (!res.ok) {
                                                if (res.status === 404) {
                                                  // 404 is expected if instructions aren't ready yet
                                                  console.log("Deployment instructions not ready yet, continuing to poll...");
                                                  return null;
                                                }
                                                throw new Error(`Failed to fetch deployment instructions: ${res.status}`);
                                              }
                                              return res.json();
                                            })
                                            .then(data => {
                                              if (data) {
                                                // We have deployment instructions from the dedicated endpoint
                                                console.log("Received deployment instructions:", data);
                                                setGeneratedDeployment(data);
                                                clearInterval(intervalId);
                                                setRefreshIntervalId(null);
                                                setIsGeneratingDeployment(false);
                                                setIsAnalysisInProgress(false);
                                                
                                                // Refresh the main analysis data to update the UI
                                                refetch();
                                              }
                                            })
                                            .catch(error => {
                                              console.error("Error fetching deployment instructions:", error);
                                            });
                                        });
                                      }, 10000);
                                      
                                      setRefreshIntervalId(intervalId);
                                    })
                                    .catch(error => {
                                      console.error("Error starting deployment analysis:", error);
                                      
                                      // Provide a more helpful error message based on the issue
                                      let errorMessage = error.message;
                                      
                                      // If the error contains specific keywords about submission IDs
                                      if (errorMessage.includes("submission_id") || 
                                          errorMessage.includes("submission ID") ||
                                          errorMessage.includes("No submissions found")) {
                                        errorMessage = "No submission found for this project. Make sure you've run the initial project analysis first.";
                                      }
                                      
                                      toast({
                                        title: "Analysis Error",
                                        description: errorMessage,
                                        variant: "destructive"
                                      });
                                      setIsGeneratingDeployment(false);
                                      setIsAnalysisInProgress(false);
                                    });
                                  };
                                  
                                  // Check if we have a submission ID
                                  if (submissionId) {
                                    console.log("Using existing submission ID:", submissionId);
                                    handleDeploymentRequest(submissionId);
                                  } else if (id) {
                                    // Try to get submission ID from project ID
                                    console.log("No submission ID, trying to look it up from project ID:", id);
                                    fetch(`/api/project-submission/${id}`)
                                      .then(res => res.ok ? res.json() : null)
                                      .then(data => {
                                        if (data?.submissionId) {
                                          console.log("Found submission ID from project:", data.submissionId);
                                          setSubmissionId(data.submissionId);
                                          handleDeploymentRequest(data.submissionId);
                                        } else {
                                          console.error("Could not find submission ID from project");
                                          toast({
                                            title: "Error",
                                            description: "Could not find submission ID. Please refresh and try again.",
                                            variant: "destructive"
                                          });
                                          setIsGeneratingDeployment(false);
                                          setIsAnalysisInProgress(false);
                                        }
                                      })
                                      .catch(error => {
                                        console.error("Error getting submission ID:", error);
                                        toast({
                                          title: "Error",
                                          description: "Failed to get submission ID. Please refresh and try again.",
                                          variant: "destructive"
                                        });
                                        setIsGeneratingDeployment(false);
                                        setIsAnalysisInProgress(false);
                                      });
                                  } else {
                                    console.error("No project ID available to look up submission");
                                    toast({
                                      title: "Error",
                                      description: "Cannot find project ID. Please refresh the page.",
                                      variant: "destructive"
                                    });
                                    setIsGeneratingDeployment(false);
                                    setIsAnalysisInProgress(false);
                                  }
                                }}
                                disabled={isGeneratingDeployment}
                              >
                                {isGeneratingDeployment ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <Wand className="h-4 w-4 mr-2" />
                                    Generate
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <p className="ml-2 text-primary">Processing...</p>
                        </div>
                      )}
                    </div>
                  ) : getStepStatus(currentStep.id) === "completed" ? (
                    <div>
                      {currentStep.id === "files" && getStepStatus(currentStep.id) === "completed" ? (
                        <div className="text-white font-mono">
                          {(() => {
                            try {
                              // First try to use the jsonData field directly from the API
                              const stepData = analysis?.steps[currentStep.id];
                              
                              // Fall back to parsing the details field if jsonData is not available
                              let projectData;
                              let projectSummaryObj;
                              
                              if (stepData?.jsonData) {
                                projectData = stepData.jsonData;
                                // Check if this is the new format with project_summary as a string
                                if (projectData.project_summary && typeof projectData.project_summary === 'string') {
                                  try {
                                    console.log("Raw project_summary:", projectData.project_summary);
                                    projectSummaryObj = JSON.parse(projectData.project_summary);
                                    console.log("Parsed project summary:", projectSummaryObj);
                                  } catch (e) {
                                    console.error("Failed to parse project_summary:", e);
                                  }
                                } else if (projectData.projectSummary) {
                                  // Direct access for some formats
                                  projectSummaryObj = projectData;
                                }
                              } else {
                                const details = getStepDetails(currentStep.id);
                                if (!details) return <p>No details available</p>;
                                projectData = JSON.parse(details);
                              }
                              
                              // Use the parsed project summary object if available
                              const displayData = projectSummaryObj || projectData;
                              
                              return (
                                <div className="space-y-6">
                                  <div className="bg-gray-900 p-4 rounded-md">
                                    <div className="flex justify-between items-start mb-4">
                                      <div>
                                        <h3 className="text-xl font-semibold text-blue-400">
                                          {displayData.projectName || displayData.name || project?.name || "Project"}
                                        </h3>
                                        <p className="text-gray-300 mt-1">
                                          {displayData.projectSummary || displayData.summary || "No summary available"}
                                        </p>
                                      </div>
                                      <div className="bg-gray-800 px-3 py-2 rounded-md text-sm">
                                        <div className="flex gap-2 items-center">
                                          <span className="text-gray-400">Environment:</span>
                                          <span className="text-green-400">
                                            {displayData.devEnvironment || displayData.dev_tool || "N/A"}
                                          </span>
                                        </div>
                                        <div className="flex gap-2 items-center mt-1">
                                          <span className="text-gray-400">Type:</span>
                                          <span className="text-cyan-300">
                                            {displayData.type || displayData.compiler ? `v${displayData.compiler}` : "N/A"}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-green-400">Smart Contracts</h3>
                                    <div className="space-y-3">
                                      {(() => {
                                        let contractsToRender = [];
                                        
                                        // Check if using new format with project_summary
                                        if (projectSummaryObj && projectSummaryObj.contracts) {
                                          contractsToRender = projectSummaryObj.contracts;
                                        } 
                                        // Check old format
                                        else if (displayData.contracts) {
                                          contractsToRender = displayData.contracts;
                                        }
                                        
                                        return contractsToRender.map((contract: any, index: number) => (
                                          <div key={index} className="bg-gray-900 p-3 rounded-md">
                                            <div className="flex justify-between items-start">
                                              <h4 className="font-medium text-yellow-300">{contract.name}</h4>
                                            </div>
                                            <p className="text-sm text-gray-300 mt-1">{contract.summary}</p>
                                            <div className="mt-2 text-xs text-gray-400">
                                              <span className="mr-2">Type:</span>
                                              <span className="text-green-300">{contract.type || "Contract"}</span>
                                            </div>
                                            {contract.path && (
                                              <div className="mt-1 text-xs text-gray-400">
                                                <span className="mr-2">Path:</span>
                                                <span className="text-cyan-300">{contract.path}</span>
                                              </div>
                                            )}
                                            <div className="mt-3 flex flex-wrap gap-2">
                                              {contract.interfaces && contract.interfaces.length > 0 && (
                                                <div>
                                                  <span className="text-xs text-gray-400">Interfaces: </span>
                                                  <div className="inline-flex flex-wrap gap-1 ml-1">
                                                    {contract.interfaces.map((iface: string, i: number) => (
                                                      <span key={i} className="text-xs bg-blue-900 px-2 py-0.5 rounded-full text-blue-300">{iface}</span>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}
                                              {contract.libraries && contract.libraries.length > 0 && (
                                                <div className="ml-3">
                                                  <span className="text-xs text-gray-400">Libraries: </span>
                                                  <div className="inline-flex flex-wrap gap-1 ml-1">
                                                    {contract.libraries.map((lib: string, i: number) => (
                                                      <span key={i} className="text-xs bg-purple-900 px-2 py-0.5 rounded-full text-purple-300">{lib}</span>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}
                                              {contract.functions && contract.functions.length > 0 && (
                                                <div className="mt-2 w-full">
                                                  <span className="text-xs text-gray-400 block mb-1">Functions: </span>
                                                  <div className="grid grid-cols-1 gap-1">
                                                    {contract.functions.map((func: any, i: number) => (
                                                      <div key={i} className="text-xs bg-gray-800 p-2 rounded">
                                                        <span className="text-yellow-300">{func.name}</span>
                                                        <p className="text-gray-300 mt-1">{func.summary}</p>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        ))
                                      })()}
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <h3 className="text-lg font-semibold text-green-400 mb-3">Environment Details</h3>
                                    <div className="bg-gray-900 p-3 rounded-md">
                                      {(() => {
                                        // Use project_summary if available
                                        if (projectSummaryObj) {
                                          return (
                                            <div>
                                              <div className="mb-3">
                                                <span className="text-gray-400">Project Type: </span>
                                                <span className="text-cyan-300">{projectSummaryObj.type || "N/A"}</span>
                                              </div>
                                              <div className="mb-3">
                                                <span className="text-gray-400">Development Tool: </span>
                                                <span className="text-green-400">{projectSummaryObj.dev_tool || "N/A"}</span>
                                              </div>
                                            </div>
                                          );
                                        } 
                                        // Fall back to old format dependencies
                                        else if (displayData.dependencies) {
                                          return (
                                            <div className="grid grid-cols-2 gap-2">
                                              {Object.entries(displayData.dependencies).map(([name, version]: [string, unknown], index: number) => (
                                                <div key={name} className="flex justify-between text-sm">
                                                  <span className="text-blue-300">{name}</span>
                                                  <span className="text-gray-400">{version as string}</span>
                                                </div>
                                              ))}
                                            </div>
                                          );
                                        }
                                        return <p className="text-sm text-gray-400">No environment details available</p>;
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              );
                            } catch (e) {
                              return (
                                <pre className="text-sm text-green-400 whitespace-pre-wrap">
                                  {getStepDetails(currentStep.id) || currentStep.output || "No output available"}
                                </pre>
                              );
                            }
                          })()}
                        </div>
                      ) : currentStep.id === "test_setup" ? (
                        <div className="text-white font-mono">
                          {(() => {
                            try {
                              // First try to use the jsonData field directly from the API
                              const stepData = analysis?.steps[currentStep.id];
                              
                              // Fall back to parsing the details field if jsonData is not available
                              let testSetupData;
                              if (stepData?.jsonData) {
                                testSetupData = stepData.jsonData;
                              } else {
                                const details = getStepDetails(currentStep.id);
                                // Create default data if details aren't available
                                if (!details) {
                                  testSetupData = {
                                    testEnvironment: "Hardhat",
                                    networkSettings: {
                                      name: "Local Hardhat",
                                      chainId: "31337"
                                    },
                                    substeps: []
                                  };
                                } else {
                                  try {
                                    testSetupData = JSON.parse(details);
                                  } catch (e) {
                                    console.error("Failed to parse test setup data:", e);
                                    testSetupData = {
                                      testEnvironment: "Hardhat",
                                      networkSettings: {
                                        name: "Local Hardhat",
                                        chainId: "31337"
                                      },
                                      substeps: []
                                    };
                                  }
                                }
                              }
                              
                              // Get actors data from API
                              let actorsData = { actors: [] };
                              try {
                                const actorsStep = analysis?.steps?.actors;
                                if (actorsStep?.jsonData) {
                                  actorsData = actorsStep.jsonData;
                                }
                              } catch (e) {
                                console.error("Failed to parse actors data:", e);
                              }
                              
                              // Ensure testSetupData has all required properties
                              const enhancedTestSetupData = {
                                ...testSetupData,
                                testEnvironment: testSetupData.testEnvironment || "Hardhat",
                                networkSettings: testSetupData.networkSettings || {
                                  name: "Local Hardhat",
                                  chainId: "31337"
                                },
                                actors: actorsData.actors || [],
                                substeps: testSetupData.substeps || [
                                  {
                                    id: "setup",
                                    name: "Setup Workspace",
                                    description: "Create and configure the test environment workspace",
                                    output: "Workspace initialized with Hardhat\nContract ABIs generated\nTest accounts created with 1000 ETH each"
                                  },
                                  {
                                    id: "contract_deployment",
                                    name: "Contract Deployment",
                                    description: "Implement contract deployment and initialization",
                                    output: "Predify.sol deployed successfully\nManualResolutionStrategy.sol deployed successfully\nMockERC20.sol deployed successfully"
                                  },
                                  {
                                    id: "actors",
                                    name: "Implement Actors",
                                    description: "Create actor implementations based on the identified roles",
                                    output: "Created MarketCreator implementation\nCreated Bettor implementation\nCreated MarketResolver implementation\nCreated TokenManager implementation"
                                  }
                                ]
                              };
                              
                              // Since we already have activeSubstep at the component level, 
                              // we just need to ensure it has a valid value
                              if (activeSubstep === "" && enhancedTestSetupData.substeps.length > 0) {
                                // This is safe because we're just updating state without a hook
                                setActiveSubstep(enhancedTestSetupData.substeps[0].id);
                              }
                              
                              return (
                                <div className="space-y-6">
                                  {/* Test Environment with file viewer */}
                                  <div className="mb-8">
                                    <h3 className="text-xl font-semibold text-blue-400 mb-4">Test Environment</h3>
                                    
                                    {/* Network info panel */}
                                    <div className="bg-gray-900 p-4 rounded-md mb-4">
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                          <span className="text-gray-400">Runtime:</span>
                                          <p className="text-white">{enhancedTestSetupData.testEnvironment}</p>
                                        </div>
                                        <div>
                                          <span className="text-gray-400">Network:</span>
                                          <p className="text-cyan-300">{enhancedTestSetupData.networkSettings.name}</p>
                                        </div>
                                        <div>
                                          <span className="text-gray-400">Chain ID:</span>
                                          <p className="text-white">{enhancedTestSetupData.networkSettings.chainId}</p>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Code Viewer */}
                                    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                                      <h4 className="text-lg font-medium text-blue-400 mb-3">Simulation Code</h4>
                                      <div className="w-full overflow-hidden">
                                        {/* Get simulation repository from API */}
                                        {simRepo ? (
                                          <GitHubCodeViewer 
                                            owner={simRepo.owner}
                                            repo={simRepo.repo}
                                            branch={simRepo.branch}
                                            path=""
                                            showBreadcrumb={true}
                                          />
                                        ) : simRepoError ? (
                                          <div className="bg-red-950 p-4 rounded border border-red-700">
                                            <h4 className="text-red-400 font-medium mb-2">Error Loading Simulation Repository</h4>
                                            <p className="text-gray-300">{simRepoError}</p>
                                          </div>
                                        ) : (
                                          <div className="flex items-center justify-center h-40">
                                            <Loader2 className="h-6 w-6 text-blue-500 animate-spin mr-2" />
                                            <span className="text-gray-400">Loading simulation repository...</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Implementation Steps Section */}
                                  <div className="space-y-4" id="implementation-steps">
                                    <h3 className="text-xl font-semibold text-blue-400">Actor Implementations</h3>
                                    
                                    {/* Actors and their actions with validation details */}
                                    <div className="space-y-4">
                                      {/* Actor Implementations Section */}
                                      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                                        <p className="text-gray-300 mb-4">Create actor implementations based on the identified roles</p>
                                        
                                        {/* Dynamic Actor List */}
                                        <div className="space-y-4">
                                          {enhancedTestSetupData.actors.length > 0 ? (
                                            enhancedTestSetupData.actors.map((actor: any, index: number) => (
                                              <Collapsible key={index} className="bg-gray-800 rounded-md">
                                                <CollapsibleTrigger className="w-full p-4 flex items-center justify-between">
                                                  <div>
                                                    <h4 className="text-lg font-medium text-blue-400 text-left">{actor.name}</h4>
                                                    <p className="mt-1 text-white/70 text-sm text-left">{actor.summary}</p>
                                                  </div>
                                                  <ChevronRight className="h-5 w-5 text-gray-400 transform transition-transform group-data-[state=open]:rotate-90" />
                                                </CollapsibleTrigger>
                                                <CollapsibleContent className="px-4 pb-4">
                                                  <div className="space-y-4">
                                                    {actor.actions.map((action: any, i: number) => (
                                                      <Collapsible key={i}>
                                                        <CollapsibleTrigger className="flex items-center gap-2 text-gray-300 p-2 bg-gray-700/50 rounded w-full justify-between">
                                                          <div className="flex items-center gap-2">
                                                            <ChevronRight className="h-4 w-4 transform transition-transform group-data-[state=open]:rotate-90" />
                                                            <span>{action.name}</span>
                                                          </div>
                                                          <div className="flex items-center gap-2">
                                                            <span className="text-xs bg-blue-900 px-2 py-1 rounded-full text-blue-200">
                                                              {action.contract_name}
                                                            </span>
                                                            <Button size="sm" variant="outline" className="h-7 text-xs">
                                                              Modify
                                                            </Button>
                                                          </div>
                                                        </CollapsibleTrigger>
                                                        <CollapsibleContent className="p-3 mt-2 bg-gray-700/30 rounded-md">
                                                          <div className="space-y-3">
                                                            <div>
                                                              <h5 className="text-sm font-medium text-blue-300 mb-2">Implementation</h5>
                                                              
                                                              <Tabs defaultValue="summary">
                                                                <TabsList className="bg-gray-800 text-gray-400 mb-2">
                                                                  <TabsTrigger value="summary" className="data-[state=active]:bg-gray-700 data-[state=active]:text-white">
                                                                    <Eye className="h-3.5 w-3.5 mr-1" />
                                                                    Summary
                                                                  </TabsTrigger>
                                                                  <TabsTrigger value="code" className="data-[state=active]:bg-gray-700 data-[state=active]:text-white">
                                                                    <Code className="h-3.5 w-3.5 mr-1" />
                                                                    Code
                                                                  </TabsTrigger>
                                                                  <TabsTrigger value="preview" className="data-[state=active]:bg-gray-700 data-[state=active]:text-white">
                                                                    <FileEdit className="h-3.5 w-3.5 mr-1" />
                                                                    Preview Changes
                                                                  </TabsTrigger>
                                                                </TabsList>
                                                                
                                                                <TabsContent value="summary" className="mt-0">
                                                                  <div className="bg-black/40 p-3 rounded text-xs">
                                                                    <p className="text-green-400 mb-2">
                                                                      This action will call the <span className="font-bold">{action.function_name}</span> function on the <span className="font-bold">{action.contract_name}</span> contract.
                                                                    </p>
                                                                    
                                                                    <div className="text-white/80 space-y-2">
                                                                      <p>Contract interaction: {action.contract_name}</p>
                                                                      <p>Function: {action.function_name}</p>
                                                                      <p>Actor: {actor.name}</p>
                                                                      <p>Parameters will be passed according to the function specification</p>
                                                                    </div>
                                                                  </div>
                                                                </TabsContent>
                                                                
                                                                <TabsContent value="code" className="mt-0">
                                                                  <div className="bg-black/40 p-3 rounded text-xs">
                                                                    <pre className="whitespace-pre-wrap text-green-300 font-mono text-xs">{`
// Implementation for ${action.name}
// Contract: ${action.contract_name}
// Function: ${action.function_name}

async function execute() {
  // Setup required parameters
  const ${action.contract_name.toLowerCase()} = await ethers.getContractAt("${action.contract_name}", "${action.contract_name.toLowerCase()}Address");
  
  // Execute the transaction
  const tx = await ${action.contract_name.toLowerCase()}.${action.function_name.split('(')[0]}(
    // Parameters will depend on the specific function
  );
  
  // Wait for confirmation
  await tx.wait();
  
  // Log the result
  console.log("${action.name} executed successfully");
}
`}</pre>
                                                                  </div>
                                                                </TabsContent>
                                                                
                                                                <TabsContent value="preview" className="mt-0">
                                                                  <div className="bg-black/40 p-3 rounded text-xs">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                      <div className="text-gray-300 text-xs">Modified implementation code:</div>
                                                                      <div className="flex gap-2">
                                                                        <Button size="sm" variant="outline" className="h-6 text-xs">
                                                                          Reject Changes
                                                                        </Button>
                                                                        <Button size="sm" variant="default" className="h-6 text-xs">
                                                                          Accept Changes
                                                                        </Button>
                                                                      </div>
                                                                    </div>
                                                                    <div className="border border-gray-700 rounded-md overflow-hidden">
                                                                      <div className="bg-red-950/30 p-2 text-red-300 font-mono text-xs line-through">{`async function execute() {
  // Setup required parameters
  const ${action.contract_name.toLowerCase()} = await ethers.getContractAt("${action.contract_name}", "${action.contract_name.toLowerCase()}Address");`}</div>
                                                                      <div className="bg-green-950/30 p-2 text-green-300 font-mono text-xs">{`async function execute() {
  // Setup required parameters with provider and signer
  const provider = ethers.provider;
  const signer = await ethers.getSigner();
  const ${action.contract_name.toLowerCase()} = await ethers.getContractAt("${action.contract_name}", "${action.contract_name.toLowerCase()}Address", signer);`}</div>
                                                                    </div>
                                                                  </div>
                                                                </TabsContent>
                                                              </Tabs>
                                                              
                                                              <Button 
                                                                size="sm" 
                                                                variant="ghost" 
                                                                className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                                                                onClick={() => {
                                                                  if (isFreeUser) {
                                                                    toast({
                                                                      title: "Feature restricted",
                                                                      description: "AI chat assistance is only available for Pro and Teams plans",
                                                                      variant: "destructive"
                                                                    });
                                                                    // Redirect to pricing page after a short delay
                                                                    setTimeout(() => window.location.href = '/pricing', 2000);
                                                                  } else {
                                                                    setOpenChats(prev => ({ 
                                                                      ...prev, 
                                                                      [`implementation-${actor.id}-${action.id}`]: true 
                                                                    }));
                                                                  }
                                                                }}
                                                              >
                                                                {isFreeUser ? (
                                                                  <Lock className="h-3.5 w-3.5 mr-1" />
                                                                ) : (
                                                                  <MessageSquare className="h-3.5 w-3.5 mr-1" />
                                                                )}
                                                                {isFreeUser ? "Pro Feature" : "Modify Implementation"}
                                                              </Button>
                                                              
                                                              {openChats[`implementation-${actor.id}-${action.id}`] && (
                                                                <SectionChat
                                                                  sectionType="implementation"
                                                                  sectionName={action.name}
                                                                  projectId={id || ""}
                                                                  actorId={actor.id}
                                                                  actionId={action.id}
                                                                  onClose={() => setOpenChats(prev => ({ 
                                                                    ...prev, 
                                                                    [`implementation-${actor.id}-${action.id}`]: false 
                                                                  }))}
                                                                  isOpen={true}
                                                                />
                                                              )}
                                                            </div>
                                                            
                                                            <div>
                                                              <h5 className="text-sm font-medium text-yellow-300 mb-2">Validation Rules</h5>
                                                              
                                                              <Tabs defaultValue="summary">
                                                                <TabsList className="bg-gray-800 text-gray-400 mb-2">
                                                                  <TabsTrigger value="summary" className="data-[state=active]:bg-gray-700 data-[state=active]:text-white">
                                                                    <Eye className="h-3.5 w-3.5 mr-1" />
                                                                    Summary
                                                                  </TabsTrigger>
                                                                  <TabsTrigger value="code" className="data-[state=active]:bg-gray-700 data-[state=active]:text-white">
                                                                    <Code className="h-3.5 w-3.5 mr-1" />
                                                                    Code
                                                                  </TabsTrigger>
                                                                  <TabsTrigger value="preview" className="data-[state=active]:bg-gray-700 data-[state=active]:text-white">
                                                                    <FileEdit className="h-3.5 w-3.5 mr-1" />
                                                                    Preview Changes
                                                                  </TabsTrigger>
                                                                </TabsList>
                                                                
                                                                <TabsContent value="summary" className="mt-0">
                                                                  <div className="bg-black/40 p-3 rounded text-xs">
                                                                    <ul className="list-disc pl-5 text-yellow-400 space-y-1">
                                                                      <li>All required parameters must be provided and valid</li>
                                                                      <li>Actor must have appropriate permissions/role</li>
                                                                      <li>Actor must have sufficient balance if operations involve transfers</li>
                                                                      <li>Contract state must allow this operation</li>
                                                                      <li>Gas estimation must be within reasonable limits</li>
                                                                      <li>Operation must not violate any business logic constraints</li>
                                                                    </ul>
                                                                  </div>
                                                                </TabsContent>
                                                                
                                                                <TabsContent value="code" className="mt-0">
                                                                  <div className="bg-black/40 p-3 rounded text-xs">
                                                                    <pre className="whitespace-pre-wrap text-yellow-300 font-mono text-xs">{`
// Validation for ${action.name}
// Contract: ${action.contract_name}
// Function: ${action.function_name}

function validate${action.function_name.split('(')[0]}Result(result) {
  // Assertion 1: Check that the transaction was successful
  expect(result.status).to.equal(1);
  
  // Assertion 2: Check state changes (will depend on the function)
  // Examples:
  // - For token transfers: check balances changed correctly
  // - For market creation: check market exists with correct parameters
  
  // Assertion 3: Check event emissions
  // expectEvent(result, "${action.function_name.split('(')[0]}Event", {
  //   param1: expectedValue1,
  //   param2: expectedValue2
  // });
}
`}</pre>
                                                                  </div>
                                                                </TabsContent>
                                                                
                                                                <TabsContent value="preview" className="mt-0">
                                                                  <div className="bg-black/40 p-3 rounded text-xs">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                      <div className="text-gray-300 text-xs">Modified validation code:</div>
                                                                      <div className="flex gap-2">
                                                                        <Button size="sm" variant="outline" className="h-6 text-xs">
                                                                          Reject Changes
                                                                        </Button>
                                                                        <Button size="sm" variant="default" className="h-6 text-xs">
                                                                          Accept Changes
                                                                        </Button>
                                                                      </div>
                                                                    </div>
                                                                    <div className="border border-gray-700 rounded-md overflow-hidden">
                                                                      <div className="bg-red-950/30 p-2 text-red-300 font-mono text-xs line-through">{`function validate${action.function_name.split('(')[0]}Result(result) {
  // Assertion 1: Check that the transaction was successful
  expect(result.status).to.equal(1);`}</div>
                                                                      <div className="bg-green-950/30 p-2 text-green-300 font-mono text-xs">{`function validate${action.function_name.split('(')[0]}Result(result) {
  // Assertion 1: Check that the transaction was successful
  expect(result.status).to.equal(1);
  
  // Assertion 2: Check that the transaction didn't revert
  expect(result.confirmations).to.be.gt(0);`}</div>
                                                                    </div>
                                                                  </div>
                                                                </TabsContent>
                                                              </Tabs>
                                                              
                                                              <Button 
                                                                size="sm" 
                                                                variant="ghost" 
                                                                className="mt-2 text-xs text-yellow-400 hover:text-yellow-300"
                                                                onClick={() => {
                                                                  if (isFreeUser) {
                                                                    toast({
                                                                      title: "Feature restricted",
                                                                      description: "AI chat assistance is only available for Pro and Teams plans",
                                                                      variant: "destructive"
                                                                    });
                                                                    // Redirect to pricing page after a short delay
                                                                    setTimeout(() => window.location.href = '/pricing', 2000);
                                                                  } else {
                                                                    setOpenChats(prev => ({ 
                                                                      ...prev, 
                                                                      [`validation-${actor.id}-${action.id}`]: true 
                                                                    }));
                                                                  }
                                                                }}
                                                              >
                                                                {isFreeUser ? (
                                                                  <Lock className="h-3.5 w-3.5 mr-1" />
                                                                ) : (
                                                                  <MessageSquare className="h-3.5 w-3.5 mr-1" />
                                                                )}
                                                                {isFreeUser ? "Pro Feature" : "Modify Validation Rules"}
                                                              </Button>
                                                              
                                                              {openChats[`validation-${actor.id}-${action.id}`] && (
                                                                <SectionChat
                                                                  sectionType="validation_rules"
                                                                  sectionName={action.name}
                                                                  projectId={id || ""}
                                                                  actorId={actor.id}
                                                                  actionId={action.id}
                                                                  onClose={() => setOpenChats(prev => ({ 
                                                                    ...prev, 
                                                                    [`validation-${actor.id}-${action.id}`]: false 
                                                                  }))}
                                                                  isOpen={true}
                                                                />
                                                              )}
                                                            </div>
                                                          </div>
                                                        </CollapsibleContent>
                                                      </Collapsible>
                                                    ))}
                                                  </div>
                                                </CollapsibleContent>
                                              </Collapsible>
                                            ))
                                          ) : (
                                            <div className="text-center p-6 bg-gray-800/50 rounded-lg">
                                              <p className="text-gray-400">No actors available. Please ensure the analysis has completed successfully.</p>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            } catch (e) {
                              return (
                                <pre className="text-sm text-green-400 whitespace-pre-wrap">
                                  {getStepDetails(currentStep.id) || currentStep.output || "No output available"}
                                </pre>
                              );
                            }
                          })()}
                        </div>
                      ) : currentStep.id === "simulations" ? (
                        // Show simulations component when either the step is completed OR deployment verification is completed
                        <SimulationsComponent 
                          analysis={analysis} 
                          deploymentVerified={isDeploymentVerificationCompleted(analysis.completedSteps)} 
                        />
                      
                      ) : currentStep.id === "test_setup" && getStepStatus(currentStep.id) === "completed" ? (
                        <div className="text-white font-mono">
                          <div className="space-y-6">
                            <h3 className="text-xl font-semibold text-blue-400">Deployment Instructions</h3>
                            
                            <div className="space-y-4">
                              <div className="bg-gray-900 p-4 rounded-md">
                                <h4 className="text-lg font-medium text-yellow-300 mb-3">Transaction Sequence</h4>
                                <div className="space-y-5">
                                  
                                  {/* Transaction 1: Deploy MockERC20 Token */}
                                  <div className="border border-gray-700 p-3 rounded-md bg-black/30 relative">
                                    <div className="absolute -top-3 -left-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                                      Transaction 1
                                    </div>
                                    <h5 className="text-blue-300 font-medium mb-2">Deploy MockERC20 Token</h5>
                                    <div className="grid grid-cols-12 gap-2 text-xs mb-2">
                                      <div className="col-span-3 text-gray-400">From:</div>
                                      <div className="col-span-9 text-green-300 font-mono">0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (Admin)</div>
                                      
                                      <div className="col-span-3 text-gray-400">Contract:</div>
                                      <div className="col-span-9 text-green-300 font-mono">MockERC20.sol</div>
                                      
                                      <div className="col-span-3 text-gray-400">Method:</div>
                                      <div className="col-span-9 text-green-300 font-mono">constructor</div>
                                      
                                      <div className="col-span-3 text-gray-400">Args:</div>
                                      <div className="col-span-9 text-yellow-200 font-mono">
                                        <div>- name: "Prediction Token"</div>
                                        <div>- symbol: "PRED"</div>
                                        <div>- initialSupply: 1000000</div>
                                      </div>
                                    </div>
                                    <div className="text-gray-400 text-xs mt-2">
                                      <span className="text-yellow-400">Note:</span> This contract will be used for betting in prediction markets
                                    </div>
                                  </div>
                                  
                                  {/* Transaction 2: Deploy ResolutionStrategy */}
                                  <div className="border border-gray-700 p-3 rounded-md bg-black/30 relative">
                                    <div className="absolute -top-3 -left-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                                      Transaction 2
                                    </div>
                                    <h5 className="text-blue-300 font-medium mb-2">Deploy ManualResolutionStrategy</h5>
                                    <div className="grid grid-cols-12 gap-2 text-xs mb-2">
                                      <div className="col-span-3 text-gray-400">From:</div>
                                      <div className="col-span-9 text-green-300 font-mono">0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (Admin)</div>
                                      
                                      <div className="col-span-3 text-gray-400">Contract:</div>
                                      <div className="col-span-9 text-green-300 font-mono">ManualResolutionStrategy.sol</div>
                                      
                                      <div className="col-span-3 text-gray-400">Method:</div>
                                      <div className="col-span-9 text-green-300 font-mono">constructor</div>
                                      
                                      <div className="col-span-3 text-gray-400">Args:</div>
                                      <div className="col-span-9 text-yellow-200 font-mono">
                                        <div>- admin: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266</div>
                                      </div>
                                    </div>
                                    <div className="text-gray-400 text-xs mt-2">
                                      <span className="text-yellow-400">Note:</span> The strategy will be used to manually resolve prediction markets
                                    </div>
                                  </div>
                                  
                                  {/* Transaction 3: Deploy Predify */}
                                  <div className="border border-gray-700 p-3 rounded-md bg-black/30 relative">
                                    <div className="absolute -top-3 -left-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                                      Transaction 3
                                    </div>
                                    <h5 className="text-blue-300 font-medium mb-2">Deploy Predify Contract</h5>
                                    <div className="grid grid-cols-12 gap-2 text-xs mb-2">
                                      <div className="col-span-3 text-gray-400">From:</div>
                                      <div className="col-span-9 text-green-300 font-mono">0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (Admin)</div>
                                      
                                      <div className="col-span-3 text-gray-400">Contract:</div>
                                      <div className="col-span-9 text-green-300 font-mono">Predify.sol</div>
                                      
                                      <div className="col-span-3 text-gray-400">Method:</div>
                                      <div className="col-span-9 text-green-300 font-mono">constructor</div>
                                      
                                      <div className="col-span-3 text-gray-400">Args:</div>
                                      <div className="col-span-9 text-yellow-200 font-mono">
                                        <div>- admin: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266</div>
                                        <div>- defaultToken: [MOCK_ERC20_ADDRESS] (from tx 1)</div>
                                        <div>- defaultResolutionStrategy: [RESOLUTION_STRATEGY_ADDRESS] (from tx 2)</div>
                                        <div>- minMarketDuration: 3600 (1 hour)</div>
                                        <div>- platformFee: 100 (1%)</div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Transaction 4: Admin Setup */}
                                  <div className="border border-gray-700 p-3 rounded-md bg-black/30 relative">
                                    <div className="absolute -top-3 -left-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                                      Transaction 4
                                    </div>
                                    <h5 className="text-blue-300 font-medium mb-2">MockERC20 Setup: Approve Token Spending</h5>
                                    <div className="grid grid-cols-12 gap-2 text-xs mb-2">
                                      <div className="col-span-3 text-gray-400">From:</div>
                                      <div className="col-span-9 text-green-300 font-mono">0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (Admin)</div>
                                      
                                      <div className="col-span-3 text-gray-400">Contract:</div>
                                      <div className="col-span-9 text-green-300 font-mono">MockERC20 (from tx 1)</div>
                                      
                                      <div className="col-span-3 text-gray-400">Method:</div>
                                      <div className="col-span-9 text-green-300 font-mono">approve</div>
                                      
                                      <div className="col-span-3 text-gray-400">Args:</div>
                                      <div className="col-span-9 text-yellow-200 font-mono">
                                        <div>- spender: [PREDIFY_ADDRESS] (from tx 3)</div>
                                        <div>- amount: 1000000000000000000000000 (unlimited)</div>
                                      </div>
                                    </div>
                                    <div className="text-gray-400 text-xs mt-2">
                                      <span className="text-yellow-400">Note:</span> Setup to allow the Predify contract to transfer tokens on behalf of the admin
                                    </div>
                                  </div>
                                  
                                  {/* Transaction 5: Resolution Strategy Setup */}
                                  <div className="border border-gray-700 p-3 rounded-md bg-black/30 relative">
                                    <div className="absolute -top-3 -left-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                                      Transaction 5
                                    </div>
                                    <h5 className="text-blue-300 font-medium mb-2">Resolution Strategy Setup</h5>
                                    <div className="grid grid-cols-12 gap-2 text-xs mb-2">
                                      <div className="col-span-3 text-gray-400">From:</div>
                                      <div className="col-span-9 text-green-300 font-mono">0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (Admin)</div>
                                      
                                      <div className="col-span-3 text-gray-400">Contract:</div>
                                      <div className="col-span-9 text-green-300 font-mono">ManualResolutionStrategy (from tx 2)</div>
                                      
                                      <div className="col-span-3 text-gray-400">Method:</div>
                                      <div className="col-span-9 text-green-300 font-mono">setPredifyAddress</div>
                                      
                                      <div className="col-span-3 text-gray-400">Args:</div>
                                      <div className="col-span-9 text-yellow-200 font-mono">
                                        <div>- predifyAddress: [PREDIFY_ADDRESS] (from tx 3)</div>
                                      </div>
                                    </div>
                                    <div className="text-gray-400 text-xs mt-2">
                                      <span className="text-yellow-400">Note:</span> Connect the resolution strategy to the Predify contract
                                    </div>
                                  </div>
                                  
                                  {/* Local Network Setup Instructions */}
                                  <div className="bg-black/20 border border-blue-900 p-3 rounded-md mt-5">
                                    <h5 className="text-blue-300 font-medium mb-2">Local Network Setup</h5>
                                    <div className="text-xs text-gray-300 space-y-2">
                                      <p>Use Hardhat local network for testing:</p>
                                      <div className="bg-gray-900 p-2 rounded font-mono text-green-300">
                                        npx hardhat node
                                      </div>
                                      <p>Deploy contracts using the provided script:</p>
                                      <div className="bg-gray-900 p-2 rounded font-mono text-green-300">
                                        npx hardhat run scripts/deploy.js --network localhost
                                      </div>
                                      {/* Remove reference to addresses */}
                                    </div>
                                  </div>
                                  
                                </div>
                              </div>
                              
                              <div className="text-gray-400 text-sm mt-2">
                                <p>After completing these deployment steps, the Prediction Market platform will be fully operational on your local network. Users will be able to create markets, place bets, and administrators will be able to resolve markets and distribute winnings.</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : currentStep.id === "deployment" && getStepStatus(currentStep.id) === "completed" ? (
                        <div className="text-white font-mono">
                          {(() => {
                            try {
                              // Log the current state to help debug
                              console.log("Current analysis data:", analysis);
                              
                              // Try multiple approaches to get the submission ID
                              let submissionId = null;
                              
                              // First check if it's directly in the analysis object
                              if (analysis?.submissionId) {
                                submissionId = analysis.submissionId;
                                console.log("Found submission ID in analysis object:", submissionId);
                              }
                              
                              // If not found and we have a project ID, try to get it from the URL
                              if (!submissionId && id) {
                                // We'll use the project ID itself for now, the backend will look up the submission
                                submissionId = id;
                                console.log("Using project ID as fallback:", submissionId);
                              }
                              
                              if (!submissionId) {
                                return (
                                  <div className="p-4 bg-yellow-900/30 border border-yellow-700 rounded-md">
                                    <h3 className="text-yellow-400 font-medium">Submission ID Not Found</h3>
                                    <p className="mt-2 text-gray-300">
                                      Could not determine the submission ID for this project. 
                                      Please try refreshing the page or contact support if the issue persists.
                                    </p>
                                  </div>
                                );
                              }
                              
                              // Let's fetch the data directly from the API using the ID we found
                              return <DeploymentInstructionsSection submissionId={submissionId} analysis={analysis} />
                            } catch (error) {
                              console.error("Error rendering deployment section:", error);
                              return (
                                <pre className="text-sm text-green-400 whitespace-pre-wrap">
                                  {getStepDetails(currentStep.id) || currentStep.output || "No deployment data available"}
                                </pre>
                              );
                            }
                          })()}
                        </div>
                      ) : currentStep.id === "actors" && getStepStatus(currentStep.id) === "completed" ? (
                        <div className="text-white font-mono">
                          {(() => {
                            try {
                              // First try to use the jsonData field directly from the API
                              const stepData = analysis?.steps[currentStep.id];
                              
                              // Prepare actors data
                              let actorsData = { actors: [] };
                              
                              if (stepData?.jsonData) {
                                // Handle the new API format where actors_summary is a string
                                if (stepData.jsonData.actors_summary && typeof stepData.jsonData.actors_summary === 'string') {
                                  try {
                                        console.log("Raw actors_summary data:", stepData.jsonData.actors_summary);
                                    const parsedData = JSON.parse(stepData.jsonData.actors_summary);
                                    console.log("Parsed actors data:", parsedData);
                                    if (parsedData && parsedData.actors) {
                                      actorsData = parsedData;
                                    }
                                  } catch (e) {
                                    console.error("Failed to parse actors_summary:", e);
                                  }
                                } else {
                                  // Use the old format directly
                                  actorsData = stepData.jsonData;
                                }
                              } else {
                                try {
                                  const details = getStepDetails(currentStep.id);
                                  if (details) {
                                    try {
                                      // Try to parse the details, which might be a JSON string
                                      const parsedDetails = JSON.parse(details);
                                      
                                      // Check if we have actors_summary in the details
                                      if (parsedDetails.actors_summary && typeof parsedDetails.actors_summary === 'string') {
                                        actorsData = JSON.parse(parsedDetails.actors_summary);
                                      } else {
                                        actorsData = parsedDetails;
                                      }
                                    } catch (e) {
                                      console.error("Failed to parse actors JSON:", e);
                                    }
                                  } else {
                                    // Use the Prediction Market actors as fallback
                                    actorsData = {
                                      "actors": [
                                        {
                                          "name": "Market Creator",
                                          "summary": "Creates prediction markets with specific parameters like description, resolution strategy, and betting token.",
                                          "actions": [
                                            {
                                              "name": "Create Market",
                                              "summary": "Creates a new prediction market.",
                                              "contract_name": "Predify",
                                              "function_name": "createMarket",
                                              "probability": 1.0
                                            }
                                          ]
                                        },
                                        {
                                          "name": "Bettor",
                                          "summary": "Participants who place bets on the outcome of prediction markets.",
                                          "actions": [
                                            {
                                              "name": "Place Bet",
                                              "summary": "Places a bet on a specific outcome in a market.",
                                              "contract_name": "Predify",
                                              "function_name": "predict",
                                              "probability": 1.0
                                            },
                                            {
                                              "name": "Claim Winnings",
                                              "summary": "Allows users to claim their winnings from a resolved market.",
                                              "contract_name": "Predify",
                                              "function_name": "claim",
                                              "probability": 1.0
                                            },
                                            {
                                              "name": "Withdraw Bet",
                                              "summary": "Allows users to withdraw their bet from a market.",
                                              "contract_name": "Predify",
                                              "function_name": "withdrawBet",
                                              "probability": 1.0
                                            }
                                          ]
                                        },
                                        {
                                          "name": "Market Resolver",
                                          "summary": "Entity responsible for resolving the market based on a predefined resolution strategy. This may be done manually or automatically.",
                                          "actions": [
                                            {
                                              "name": "Resolve Market",
                                              "summary": "Resolves a market to determine the winning outcome.",
                                              "contract_name": "Predify",
                                              "function_name": "resolveMarket",
                                              "probability": 1.0
                                            },
                                            {
                                              "name": "Register Outcome",
                                              "summary": "Registers a possible outcome for a given market.",
                                              "contract_name": "ManualResolutionStrategy",
                                              "function_name": "registerOutcome",
                                              "probability": 0.5
                                            },
                                            {
                                              "name": "Resolve Market (Manual)",
                                              "summary": "Resolves a given market with provided resolution data to determine the winning outcome.",
                                              "contract_name": "ManualResolutionStrategy",
                                              "function_name": "resolve",
                                              "probability": 1.0
                                            }
                                          ]
                                        },
                                        {
                                          "name": "Token Manager",
                                          "summary": "Can mint or burn tokens in the Predify ecosystem, if a mock token is used. This role manages the supply of the betting token.",
                                          "actions": [
                                            {
                                              "name": "Mint Tokens",
                                              "summary": "Mints new tokens to the specified address.",
                                              "contract_name": "MockERC20",
                                              "function_name": "mint",
                                              "probability": 0.5
                                            },
                                            {
                                              "name": "Burn Tokens",
                                              "summary": "Burns tokens from the specified address.",
                                              "contract_name": "MockERC20",
                                              "function_name": "burn",
                                              "probability": 0.5
                                            }
                                          ]
                                        }
                                      ]
                                    };
                                  }
                                } catch (parseError) {
                                  console.error("Error parsing actors data:", parseError);
                                }
                              }
                              
                              return (
                                <div className="space-y-6">
                                  <div className="space-y-2">
                                    <h3 className="text-xl font-semibold text-green-400">Market Participants</h3>
                                    <div className="space-y-4">
                                      {actorsData.actors.map((actor: any, index: number) => (
                                        <Collapsible key={index} className="bg-gray-900 rounded-md">
                                          <CollapsibleTrigger className="w-full p-4 flex items-center justify-between">
                                            <div>
                                              <h4 className="text-lg font-medium text-blue-400 text-left">{actor.name}</h4>
                                              <p className="mt-1 text-white/70 text-sm text-left">{actor.summary}</p>
                                            </div>
                                            <ChevronRight className="h-5 w-5 text-gray-400 transform transition-transform group-data-[state=open]:rotate-90" />
                                          </CollapsibleTrigger>
                                          <CollapsibleContent className="px-4 pb-4">
                                            <div className="mt-3 space-y-4">
                                              {/* Actions Section */}
                                              <Collapsible defaultOpen>
                                                <CollapsibleTrigger className="flex items-center gap-2 text-gray-300 mb-2 w-full justify-between bg-gray-800/50 p-2 rounded">
                                                  <div className="flex items-center gap-2">
                                                    <ChevronRight className="h-4 w-4 transform transition-transform group-data-[state=open]:rotate-90" />
                                                    <span className="font-medium">Actions</span>
                                                  </div>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent className="space-y-2 mt-2">
                                                  {actor.actions.map((action: any, i: number) => (
                                                    <div key={i} className="bg-gray-800 p-3 rounded border border-gray-700">
                                                      <div className="flex justify-between items-center">
                                                        <span className="text-yellow-300 font-medium">{action.name}</span>
                                                        <span className="text-xs bg-blue-900 px-2 py-1 rounded-full text-blue-200">
                                                          {action.contract_name}
                                                        </span>
                                                      </div>
                                                      <p className="text-sm text-gray-300 mt-1">{action.summary}</p>
                                                      <div className="mt-2 flex text-xs text-gray-400 space-x-4">
                                                        <span>Function: <code className="text-cyan-300">{action.function_name}</code></span>
                                                        <span>Probability: <span className="text-green-300">{action.probability * 100}%</span></span>
                                                      </div>
                                                    </div>
                                                  ))}
                                                </CollapsibleContent>
                                              </Collapsible>
                                            </div>
                                          </CollapsibleContent>
                                        </Collapsible>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              );
                            } catch (e) {
                              return (
                                <pre className="text-sm text-green-400 whitespace-pre-wrap">
                                  {getStepDetails(currentStep.id) || currentStep.output || "No output available"}
                                </pre>
                              );
                            }
                          })()}
                        </div>
                      ) : (
                        <pre className="text-sm text-green-400 whitespace-pre-wrap font-mono">
                          {currentStep.output || getStepDetails(currentStep.id) || "No output available"}
                        </pre>
                      )}
                    </div>
                  ) : getStepStatus(currentStep.id) === "failed" ? (
                    <pre className="text-sm text-red-400 whitespace-pre-wrap font-mono">
                      Analysis failed: {getStepDetails(currentStep.id) || "Unknown error occurred"}
                    </pre>
                  ) : (
                    <p className="text-muted-foreground">Waiting for analysis to reach this step...</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      {/* Add context-aware AI Chat Assistant - only for Pro and Teams users */}
      {isFreeUser ? (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Lock className="h-4 w-4 text-yellow-500" />
            <p className="text-sm font-medium text-yellow-500">AI Chat Assistant is only available on Pro and Teams plans</p>
          </div>
          <Button 
            onClick={() => window.location.href = '/pricing'}
            className="bg-yellow-600 hover:bg-yellow-700 text-white">
            Upgrade to Pro
          </Button>
        </div>
      ) : (
        <ChatAssistant projectId={id} currentSection={currentStep.id} submissionId={submissionId} />
      )}
    </div>
  );
}