import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle, AlertCircle, Check, Loader2, CheckCircle2, XCircle, CircleDot, Download, ChevronRight, ChevronDown, RefreshCw, FileCode, Users, Box, Laptop, PlayCircle, Code, FileEdit, Eye, MessageSquare, Wand, FileText, Code2, Lock, Zap, Clock as ClockIcon, History as HistoryIcon, ExternalLink } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
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
import ProfileCompletion from "@/components/profile-completion";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

// Simulation run type definition
type SimulationRun = {
  id: string;
  status: "success" | "error" | "in_progress" | "scheduled";
  date: string;
  logUrl: string | null;
  branch?: string;
  description?: string;
  type?: string;
  num_simulations?: number;
  // Batch-specific fields
  success_count?: number;
  failed_count?: number;
  total_count?: number;
  is_batch?: boolean;
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
  submissionId?: string;
}

// Type for history log entries
type HistoryLogEntry = {
  step: string;
  status: string;
  user_prompt?: string;
  executed_at: string;
  step_metadata?: string;
};

// Import HistoryComponent for use in the History tab
import HistoryComponent from "@/components/history-component";

// Hook to fetch action files from simulation repository
function useActionFile(submissionId: string | undefined, contractName: string, functionName: string, fileType: 'json' | 'ts') {
  return useQuery({
    queryKey: ['/api/action-file', submissionId, contractName, functionName, fileType],
    queryFn: async () => {
      if (!submissionId) throw new Error('No submission ID');
      
      console.log(`Fetching action file: ${contractName}_${functionName}.${fileType} for submission ${submissionId}`);
      
      const response = await fetch(`/api/action-file/${submissionId}/${contractName}/${functionName}/${fileType}`, {
        credentials: 'include' // Include cookies for authentication
      });
      
      console.log(`API response status: ${response.status}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log(`Action file not found: ${contractName}_${functionName}.${fileType}`);
          throw new Error(`Action file not found: ${contractName}_${functionName}.${fileType}`);
        }
        const errorText = await response.text();
        console.error(`Failed to fetch action file: ${response.status} - ${errorText}`);
        throw new Error(`Failed to fetch action file: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`Successfully fetched action file data:`, data);
      return data;
    },
    enabled: !!submissionId && !!contractName && !!functionName,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1
  });
}

// Component for displaying validation rules from real JSON data
function ValidationRulesTab({ submissionId, contractName, functionName, action, actor }: {
  submissionId: string | undefined;
  contractName: string;
  functionName: string;
  action: any;
  actor: any;
}) {
  const { data: validationData, isLoading, error } = useActionFile(submissionId, contractName, functionName, 'json');

  const realActionData = validationData?.content;

  if (isLoading) {
    return (
      <div className="bg-black/40 p-3 rounded text-xs flex items-center">
        <Loader2 className="h-3 w-3 animate-spin mr-2" />
        <span className="text-white/60">Loading validation rules...</span>
      </div>
    );
  }

  return (
    <div className="bg-black/40 p-3 rounded text-xs max-h-64 overflow-y-auto">
      {realActionData?.action_detail?.post_execution_contract_state_validation_rules ? (
        <div className="space-y-3">
          <p className="text-yellow-300 mb-2">Post-Execution Validation Rules:</p>
          {realActionData.action_detail.post_execution_contract_state_validation_rules.map((category, categoryIndex) => (
            <div key={categoryIndex} className="space-y-1">
              <p className="text-blue-300 font-semibold">{category.category}:</p>
              <ul className="list-disc pl-5 text-yellow-400 space-y-1">
                {category.rule_descriptions.map((rule, ruleIndex) => (
                  <li key={ruleIndex} className="text-xs">{rule}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <ul className="list-disc pl-5 text-yellow-400 space-y-1">
            <li>All required parameters must be provided and valid</li>
            <li>Actor must have appropriate permissions/role</li>
            <li>Actor must have sufficient balance if operations involve transfers</li>
            <li>Contract state must allow this operation</li>
            <li>Gas estimation must be within reasonable limits</li>
          </ul>
        </div>
      )}
    </div>
  );
}

// Component for displaying action summary from real JSON data
function ActionSummaryTab({ submissionId, contractName, functionName, action, actor }: {
  submissionId: string | undefined;
  contractName: string;
  functionName: string;
  action: any;
  actor: any;
}) {
  const { data: summaryData, isLoading, error } = useActionFile(submissionId, contractName, functionName, 'json');

  console.log('ActionSummaryTab COMPONENT RENDERED:', { submissionId, contractName, functionName, summaryData, isLoading, error });

  // Extract the actual content from the API response
  const realActionData = summaryData?.content;
  console.log('Extracted action data:', realActionData);
  console.log('Full summaryData object:', summaryData);
  console.log('Does realActionData exist?', !!realActionData);
  console.log('Does action_detail exist?', !!realActionData?.action_detail);

  if (isLoading) {
    return (
      <div className="bg-black/40 p-3 rounded text-xs flex items-center">
        <Loader2 className="h-3 w-3 animate-spin mr-2" />
        <span className="text-white/60">Loading action summary...</span>
      </div>
    );
  }

  // Always prioritize displaying real data when available

  // Use the extracted real action data
  
  return (
    <div className="bg-black/40 p-3 rounded text-xs max-h-64 overflow-y-auto">
      {realActionData?.action_detail ? (
        <div className="space-y-3">
          <div>
            <p className="text-green-400 mb-2">
              {realActionData.action?.summary || `This action will call the ${action.function_name} function on the ${action.contract_name} contract.`}
            </p>
          </div>
          
          <div className="text-white/80 space-y-2">
            <p>Contract: {realActionData.action_detail.contract_name}</p>
            <p>Function: {realActionData.action_detail.function_name}</p>
            <p>Actor: {actor.name}</p>
          </div>

          {realActionData.action_detail.pre_execution_parameter_generation_rules && (
            <div>
              <p className="text-blue-300 mb-1">Parameter Generation Rules:</p>
              <div className="ml-2 space-y-1">
                {realActionData.action_detail.pre_execution_parameter_generation_rules.map((rule, index) => (
                  <p key={index} className="text-xs text-gray-300">• {rule}</p>
                ))}
              </div>
            </div>
          )}

          {realActionData.action_detail.on_execution_state_updates_made && (
            <div>
              <p className="text-purple-300 mb-1">State Changes:</p>
              <div className="ml-2 space-y-1">
                {realActionData.action_detail.on_execution_state_updates_made.map((update, index) => (
                  <div key={index} className="text-xs text-gray-300 mb-1">
                    <p className="font-semibold text-purple-200">• {update.category}:</p>
                    <div className="ml-4 space-y-1">
                      {update.state_update_descriptions?.map((desc, descIndex) => (
                        <p key={descIndex} className="text-gray-400">- {desc}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <p className="text-green-400 mb-2">
            This action will call the <span className="font-bold">{action.function_name}</span> function on the <span className="font-bold">{action.contract_name}</span> contract.
          </p>
          <div className="text-white/80 space-y-2">
            <p>Contract: {action.contract_name}</p>
            <p>Function: {action.function_name}</p>
            <p>Actor: {actor.name}</p>
            <p>Implementation will be generated during simulation setup</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Component for displaying action code from real TypeScript data
function ActionCodeTab({ submissionId, contractName, functionName, action, sectionContext }: {
  submissionId: string | undefined;
  contractName: string;
  functionName: string;
  action: any;
  sectionContext?: string;
}) {
  const { data: codeData, isLoading, error } = useActionFile(submissionId, contractName, functionName, 'ts');
  
  // Extract the actual TypeScript code from the API response
  const realCodeContent = codeData?.content;
  
  // Generate a stable unique ID for this specific instance with section context
  const uniqueContainerId = `code-container-${sectionContext || 'default'}-${contractName}-${functionName}-${submissionId?.slice(-8) || 'default'}`;
  
  console.log('ActionCodeTab COMPONENT RENDERED:', { submissionId, contractName, functionName, codeData, isLoading, error });
  console.log('Does codeData exist?', !!codeData);
  console.log('Does realCodeContent exist?', !!realCodeContent);
  console.log('CodeData content preview:', realCodeContent?.substring(0, 200));

  if (isLoading) {
    return (
      <div className="bg-black/40 p-3 rounded text-xs flex items-center">
        <Loader2 className="h-3 w-3 animate-spin mr-2" />
        <span className="text-white/60">Loading action code...</span>
      </div>
    );
  }

  // Extract method sections for easy navigation
  const extractMethods = (code: string) => {
    if (!code) return {};
    
    const methods = {};
    const lines = code.split('\n');
    
    // Find method start lines - look for function signature lines
    lines.forEach((line, index) => {
      // Look for the actual function signature, not just any line containing the word
      if (line.trim().match(/^(async\s+)?initialize\s*\(/)) {
        methods.initialize = index;
      }
      if (line.trim().match(/^(async\s+)?execute\s*\(/)) {
        methods.execute = index;
      }
      if (line.trim().match(/^(async\s+)?validate\s*\(/)) {
        methods.validate = index;
      }
    });
    
    return methods;
  };

  const methods = extractMethods(realCodeContent);
  const codeLines = realCodeContent ? realCodeContent.split('\n') : [];

  const scrollToMethod = (methodName: string) => {
    const methodLine = methods[methodName];
    if (methodLine !== undefined) {
      const codeContainer = document.querySelector(`#${uniqueContainerId}`);
      if (codeContainer) {
        const lineHeight = 20; // adjust for line numbers
        // Scroll to show the function definition with context above
        const scrollPosition = Math.max(0, (methodLine - 2) * lineHeight);
        codeContainer.scrollTop = scrollPosition;
      }
    }
  };

  return (
    <div className="bg-black/40 p-3 rounded text-xs max-h-64 overflow-y-auto">
      {realCodeContent ? (
        <>
          <div className="flex items-center justify-between mb-2">
            <p className="text-green-400">TypeScript Implementation:</p>
            {Object.keys(methods).length > 0 && (
              <div className="flex gap-1">
                {methods.initialize !== undefined && (
                  <button 
                    onClick={() => scrollToMethod('initialize')}
                    className="px-2 py-1 text-xs bg-blue-600/20 text-blue-300 rounded hover:bg-blue-600/40"
                  >
                    initialize
                  </button>
                )}
                {methods.execute !== undefined && (
                  <button 
                    onClick={() => scrollToMethod('execute')}
                    className="px-2 py-1 text-xs bg-green-600/20 text-green-300 rounded hover:bg-green-600/40"
                  >
                    execute
                  </button>
                )}
                {methods.validate !== undefined && (
                  <button 
                    onClick={() => scrollToMethod('validate')}
                    className="px-2 py-1 text-xs bg-yellow-600/20 text-yellow-300 rounded hover:bg-yellow-600/40"
                  >
                    validate
                  </button>
                )}
              </div>
            )}
          </div>
          <div 
            id={uniqueContainerId}
            className="overflow-y-auto max-h-48"
          >
            <pre className="text-gray-300 text-xs overflow-x-auto whitespace-pre-wrap font-mono">
              {codeLines.map((line, index) => {
                const isMethodLine = Object.values(methods).includes(index);
                const lineNumber = index + 1;
                return (
                  <div 
                    key={index} 
                    className={`flex ${isMethodLine ? 'bg-blue-900/30 px-1 rounded' : ''}`}
                  >
                    <span className="text-gray-500 select-none mr-3 text-right w-8 flex-shrink-0">
                      {lineNumber}
                    </span>
                    <span className="flex-1">
                      {line}
                    </span>
                  </div>
                );
              })}
            </pre>
          </div>
        </>
      ) : error ? (
        <>
          <p className="text-orange-400 mb-2">Code implementation will be available after simulation setup.</p>
          <pre className="text-gray-400 text-xs overflow-x-auto">
{`// Implementation for ${action.name}
// Contract: ${action.contract_name}
// Function: ${action.function_name}
// TypeScript implementation will be generated during simulation setup

async function execute() {
  // Setup required parameters and execute transaction
  // Implementation details will be available once generated
}`}
          </pre>
        </>
      ) : (
        <p className="text-gray-400">Loading TypeScript implementation...</p>
      )}
    </div>
  );
}

function SimulationsComponent({ analysis, deploymentVerified = false, submissionId: propSubmissionId }: SimulationsComponentProps) {
  const { id: projectId } = useParams();
  
  // Use the passed submission ID, or fall back to project ID for backward compatibility
  const submissionId = propSubmissionId || projectId;
  
  // State for simulation runs
  const [simulationRuns, setSimulationRuns] = useState<SimulationRun[]>([]);
  const [isRunningSimulation, setIsRunningSimulation] = useState(false);
  const [isRefreshingSimulations, setIsRefreshingSimulations] = useState(false);
  const [simulationMessage, setSimulationMessage] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState("main");
  const [simulationDescription, setSimulationDescription] = useState("");
  const [numSimulations, setNumSimulations] = useState(1);
  const [iterations, setIterations] = useState(350);
  const [availableBranches, setAvailableBranches] = useState<{name: string; isDefault?: boolean}[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [simStatus, setSimStatus] = useState<{
    canRun: boolean;
    message: string;
    plan?: string;
    runsUsed?: number;
    runsLimit?: number | string;
    earlyAccess?: boolean;
  } | null>(null);
  const [showUpgradeMessage, setShowUpgradeMessage] = useState(false);
  const [simulationType, setSimulationType] = useState<'run' | 'batch_run'>('run');
  const [simRepo, setSimRepo] = useState<{ owner: string; repo: string } | null>(null);
  
  // Actor configuration state
  const [actorConfig, setActorConfig] = useState<{[actorName: string]: number}>({});
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  
  // Initialize actor config from submission data
  useEffect(() => {
    if (analysis?.steps?.actors?.jsonData?.actors) {
      const actors = analysis.steps.actors.jsonData.actors;
      const defaultConfig: {[actorName: string]: number} = {};
      
      // Check if there's existing actor_config in submission data
      const existingActorConfig = analysis.steps.actors.jsonData.actor_config;
      
      actors.forEach((actor: any) => {
        // Use existing config if available, otherwise default to 1
        defaultConfig[actor.name] = existingActorConfig?.[actor.name] || 1;
      });
      
      setActorConfig(defaultConfig);
    }
  }, [analysis]);
  
  // Tab state for Simulations/History tabs
  const [activeTab, setActiveTab] = useState<'simulations' | 'history'>('simulations');
  
  // Batch view state
  const [viewingBatchId, setViewingBatchId] = useState<string | null>(null);
  const [currentBatch, setCurrentBatch] = useState<SimulationRun | null>(null);
  const [isLoadingBatch, setIsLoadingBatch] = useState(false);

  // Action status state
  const [actionStatuses, setActionStatuses] = useState<any>(null);
  const [isLoadingActionStatuses, setIsLoadingActionStatuses] = useState(false);
  const [actionStatusError, setActionStatusError] = useState<string | null>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch action statuses for the test_setup section
  useEffect(() => {
    if (!submissionId) return;

    const fetchActionStatuses = async () => {
      setIsLoadingActionStatuses(true);
      setActionStatusError(null);
      
      try {
        const response = await fetch(`/api/action-statuses/${submissionId}`);
        if (response.ok) {
          const data = await response.json();
          setActionStatuses(data);
        } else {
          setActionStatusError('Failed to fetch action statuses');
        }
      } catch (error) {
        console.error('Error fetching action statuses:', error);
        setActionStatusError('Failed to fetch action statuses');
      } finally {
        setIsLoadingActionStatuses(false);
      }
    };

    fetchActionStatuses();
  }, [submissionId]);

  // Helper function to get action status
  const getActionStatus = (contractName: string, functionName: string) => {
    if (!actionStatuses?.actions) return null;
    
    const action = actionStatuses.actions.find((a: any) => 
      a.contract_name === contractName && a.function_name === functionName
    );
    
    return action ? {
      step: action.current_step || 'pending',
      status: action.status || 'pending',
      progress: action.progress || 0
    } : null;
  };
  
  // Function to fetch batch simulations
  const fetchBatchSimulations = async (batchId: string) => {
    if (!submissionId || !batchId) return;
    
    setIsLoadingBatch(true);
    try {
      // Find the batch run in current simulations to set as current batch
      let batchRun = simulationRuns.find(run => run.id === batchId);
      if (batchRun) {
        setCurrentBatch(batchRun);
      }
      
      // Fetch batch simulations from the API
      const response = await fetch(`/api/simulation-runs/${submissionId}/batch/${batchId}`);
      if (response.ok) {
        const responseData = await response.json();
        console.log("Received batch simulations:", responseData);
        
        // Get batch metadata from the API response if available
        const batchMetadata = responseData.batch_metadata || {};
        
        if (responseData.simulation_runs) {
          // Process the batch simulation runs the same way we process regular runs
          const formattedRuns: SimulationRun[] = responseData.simulation_runs.map((run: any) => {
            // Check if the response data is already in our expected format
            if (run.id && run.status) {
              return run;
            }
            
            // Handle data from external API
            if (run.simulation_id || run.run_id || run.id) {
              // Log the raw run data to debug
              console.log("Processing run data (from batch):", run);
              
              const status = run.status === "SUCCESS" ? "success" : 
                          run.status === "success" ? "success" :
                          run.status === "FAILURE" ? "error" : 
                          run.status === "failure" ? "error" :
                          run.status === "ERROR" ? "error" :
                          run.status === "error" ? "error" :
                          run.status === "SCHEDULED" ? "scheduled" :
                          run.status === "scheduled" ? "scheduled" :
                          run.status === "CREATED" ? "scheduled" :
                          run.status === "created" ? "scheduled" :
                          run.status === "IN_PROGRESS" ? "in_progress" :
                          run.status === "in_progress" ? "in_progress" :
                          run.status?.toLowerCase() || "error";
              
              return {
                id: run.simulation_id || run.run_id || run.id,
                status: status as 'success' | 'error' | 'in_progress' | 'scheduled',
                date: run.created_at || run.date || new Date().toISOString(),
                logUrl: run.log_url || run.logUrl || null,
                branch: run.branch || "default",
                description: run.description || "",
                type: run.type || "run",
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
          
          // Use statistics from batch_metadata if available, otherwise calculate from runs
          // This ensures we use pre-calculated stats when they exist
          let totalCount, successCount, failedCount, batchStatus;
          
          // First try to get stats from the batch metadata
          if (batchMetadata && (batchMetadata.success_count !== undefined || batchMetadata.failed_count !== undefined)) {
            // Use stats directly from the metadata
            totalCount = batchMetadata.total_count || formattedRuns.length;
            successCount = batchMetadata.success_count || 0;
            failedCount = batchMetadata.failed_count || 0;
            batchStatus = batchMetadata.status as 'success' | 'error' | 'in_progress' | 'scheduled' || 'success';
          } 
          // Then try to use stats from the existing batch run (as they might come from the previous API call)
          else if (batchRun && (batchRun.success_count !== undefined || batchRun.failed_count !== undefined)) {
            totalCount = batchRun.total_count || formattedRuns.length;
            successCount = batchRun.success_count || 0;
            failedCount = batchRun.failed_count || 0;
            batchStatus = batchRun.status || 'success';
          } 
          // If no pre-calculated stats are available, calculate them from the runs
          else {
            // Calculate batch statistics from individual simulation runs
            totalCount = formattedRuns.length;
            successCount = formattedRuns.filter(run => run.status === 'success').length;
            failedCount = formattedRuns.filter(run => run.status === 'error').length;
            const inProgressCount = formattedRuns.filter(run => 
              run.status === 'in_progress' || run.status === 'scheduled'
            ).length;
            
            // Determine overall batch status based on individual runs
            batchStatus = 'success';
            if (inProgressCount > 0) {
              batchStatus = 'in_progress';
            } else if (successCount === 0 && failedCount > 0) {
              batchStatus = 'error';
            } else if (successCount > 0 && failedCount > 0) {
              batchStatus = 'success'; // Partial success still shows as success
            }
          }
          
          // Update the batch run with statistics (from API or calculated)
          const updatedBatchRun: SimulationRun = {
            ...(batchRun || {}),
            id: batchId,
            status: batchStatus,
            date: batchRun?.date || formattedRuns[0]?.date || new Date().toISOString(),
            logUrl: batchRun?.logUrl || null,
            branch: batchRun?.branch || batchMetadata?.branch || 'main',
            description: batchRun?.description || batchMetadata?.description || `Batch with ${totalCount} simulations`,
            type: 'batch',
            num_simulations: totalCount,
            success_count: successCount,
            failed_count: failedCount,
            total_count: totalCount,
            is_batch: true
          };
          
          // Update the current batch in state with correct counts
          setCurrentBatch(updatedBatchRun);
          
          // Add batch ID to each run for reference
          const runsWithBatchId = formattedRuns.map(run => ({
            ...run,
            batch_id: batchId
          }));
          
          setSimulationRuns(runsWithBatchId);
        }
      } else {
        console.error('Error fetching batch simulations:', response.status);
        toast({
          title: "Error",
          description: "Could not load batch simulation data. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error fetching batch simulation data:', error);
      toast({
        title: "Error",
        description: "Could not load batch simulation data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingBatch(false);
    }
  };
  
  // Function to go back to main simulation list
  const goBackToMainList = async () => {
    // If we have a currentBatch, remember its updated statistics before clearing
    const previousBatchId = viewingBatchId;
    const previousBatchData = currentBatch;
    
    // Clear batch viewing state
    setViewingBatchId(null);
    setCurrentBatch(null);
    
    // Refetch the main simulation runs list
    try {
      const runsResponse = await fetch(`/api/simulation-runs/${submissionId}`);
      if (runsResponse.ok) {
        const responseData = await runsResponse.json();
        console.log("Received simulation runs:", responseData);
        
        if (responseData.simulation_runs) {
          // Get batch metadata from the API response if available
          const batchMetadata = responseData.batch_metadata || {};
          
          let formattedRuns: SimulationRun[] = responseData.simulation_runs.map((run: any) => {
            // Processing remains the same as in the original fetchData function
            if (run.id && run.status) {
              return run;
            }
            
            if (run.simulation_id || run.run_id || run.id) {
              console.log("Processing run data (from simulation):", run);
              
              const status = run.status === "SUCCESS" ? "success" : 
                          run.status === "success" ? "success" :
                          run.status === "FAILURE" ? "error" : 
                          run.status === "failure" ? "error" :
                          run.status === "ERROR" ? "error" :
                          run.status === "error" ? "error" :
                          run.status === "SCHEDULED" ? "scheduled" :
                          run.status === "scheduled" ? "scheduled" :
                          run.status === "CREATED" ? "scheduled" :
                          run.status === "created" ? "scheduled" :
                          run.status === "IN_PROGRESS" ? "in_progress" :
                          run.status === "in_progress" ? "in_progress" :
                          run.status?.toLowerCase() || "error";
              
              // Get batch stats if available
              let batchStats = {};
              if (run.type === 'batch' || (run.num_simulations && run.num_simulations > 1)) {
                // Check if the API provided success_count and failed_count
                if (run.success_count !== undefined && run.failed_count !== undefined) {
                  batchStats = {
                    success_count: run.success_count,
                    failed_count: run.failed_count,
                    total_count: run.total_count || run.num_simulations || 0
                  };
                }
                // If not, set default values
                else {
                  batchStats = {
                    success_count: 0,
                    failed_count: 0,
                    total_count: run.num_simulations || 0
                  };
                }
              }
              
              return {
                id: run.simulation_id || run.run_id || run.id,
                status: status as 'success' | 'error' | 'in_progress' | 'scheduled',
                date: run.created_at || run.date || new Date().toISOString(),
                logUrl: run.log_url || run.logUrl || null,
                branch: run.branch || "default",
                description: run.description || "",
                type: run.type || (run.num_simulations && run.num_simulations > 1 ? "batch" : "run"),
                num_simulations: run.num_simulations || 1,
                // Batch-specific fields
                ...batchStats,
                is_batch: run.type === 'batch' || (run.num_simulations && run.num_simulations > 1) || false,
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
          
          // If we had a batch we were previously viewing, update its statistics in the list
          if (previousBatchId && previousBatchData) {
            formattedRuns = formattedRuns.map(run => {
              if (run.id === previousBatchId) {
                // Use our previously calculated statistics rather than the API values
                // This ensures consistent display between batch detail view and main list
                return {
                  ...run,
                  success_count: previousBatchData.success_count,
                  failed_count: previousBatchData.failed_count,
                  total_count: previousBatchData.total_count,
                  status: previousBatchData.status,
                  description: previousBatchData.description || run.description
                };
              }
              return run;
            });
          } else {
            // Process all batch runs to ensure stats are calculated properly
            const batchRuns = formattedRuns.filter(run => run.is_batch || run.type === 'batch');
            
            // Calculate statistics for each batch if not already provided
            batchRuns.forEach(batchRun => {
              // Only calculate if we don't have both success_count and failed_count
              if (batchRun.success_count === undefined || batchRun.failed_count === undefined) {
                // Find all runs in this batch
                const batchId = batchRun.id;
                const batchMembers = formattedRuns.filter(run => 
                  run.batch_id === batchId || 
                  (responseData.simulation_runs.find((r: any) => 
                    r.id === run.id && r.batch_id === batchId
                  ))
                );
                
                if (batchMembers.length > 0) {
                  // Calculate batch statistics
                  const totalCount = batchMembers.length;
                  const successCount = batchMembers.filter(run => run.status === 'success').length;
                  const failedCount = batchMembers.filter(run => run.status === 'error').length;
                  
                  // Update the batch run with calculated statistics
                  formattedRuns = formattedRuns.map(run => {
                    if (run.id === batchId) {
                      return {
                        ...run,
                        success_count: successCount,
                        failed_count: failedCount,
                        total_count: totalCount
                      };
                    }
                    return run;
                  });
                }
              }
            });
          }
          
          setSimulationRuns(formattedRuns);
        }
      }
    } catch (error) {
      console.error('Error fetching simulation data:', error);
    }
  };



  // Function to fetch and refresh simulation runs data
  const fetchSimulationRuns = useCallback(async (showLoadingState = true) => {
    if (!user || !submissionId) return;
    
    // We'll set the loading state in the button click handler now,
    // so we don't need to set it here anymore (avoids React state batching issues)
    console.log("fetchSimulationRuns called, loading state:", isRefreshingSimulations);
    
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
      
      // Extract GitHub repo info from the project data if available
      if (analysis?.steps?.files?.jsonData) {
        const projectData = analysis.steps.files.jsonData;
        if (projectData.repo_url) {
          try {
            // Parse GitHub URL to extract owner and repo
            const url = new URL(projectData.repo_url);
            const pathParts = url.pathname.split('/').filter(Boolean);
            
            if (pathParts.length >= 2 && url.hostname.includes('github.com')) {
              const owner = pathParts[0];
              const repo = pathParts[1];
              console.log(`Extracted GitHub repo info: ${owner}/${repo}`);
              setSimRepo({ owner, repo });
            }
          } catch (parseError) {
            console.error('Error parsing GitHub URL:', parseError);
          }
        }
      }
        
      // Fetch existing simulation runs
      const runsResponse = await fetch(`/api/simulation-runs/${submissionId}`);
      if (runsResponse.ok) {
        const responseData = await runsResponse.json();
        console.log("Received simulation runs:", responseData);
          
        // Check if the response has a 'simulation_runs' property (from external API)
        const runsData = responseData.simulation_runs || responseData || [];
        
        // First pass: Convert API data to our SimulationRun type
        let formattedRuns: SimulationRun[] = runsData.map((run: any) => {
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
                             run.status === "SCHEDULED" ? "scheduled" :
                             run.status === "scheduled" ? "scheduled" :
                             run.status === "CREATED" ? "scheduled" :
                             run.status === "created" ? "scheduled" :
                             run.status === "IN_PROGRESS" ? "in_progress" :
                             run.status === "in_progress" ? "in_progress" :
                             run.status?.toLowerCase() || "error";
              
              return {
                id: run.simulation_id || run.run_id || run.id,
                status: status as 'success' | 'error' | 'in_progress' | 'scheduled',
                date: run.created_at || run.date || new Date().toISOString(),
                logUrl: run.log_url || run.logUrl || null,
                branch: run.branch || "default",
                description: run.description || "",
                type: run.type || (run.num_simulations && run.num_simulations > 1 ? "batch" : "run"),
                num_simulations: run.num_simulations || 1,
                batch_id: run.batch_id,
                // Batch-specific fields
                success_count: run.success_count || 0,
                failed_count: run.failed_count || 0,
                total_count: run.total_count || (run.num_simulations || 0),
                is_batch: run.type === 'batch' || (run.num_simulations && run.num_simulations > 1) || false,
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
          
          // Second pass: Process batch statistics for each batch
          // Find all batch runs
          const batchRuns = formattedRuns.filter(run => run.is_batch || run.type === 'batch');
          
          // Process each batch run to calculate accurate statistics
          batchRuns.forEach(batchRun => {
            // Get all runs that belong to this batch
            const batchId = batchRun.id;
            const batchMembers = formattedRuns.filter(run => 
              run.batch_id === batchId || 
              (runsData.find((r: any) => 
                r.id === run.id && r.batch_id === batchId
              ))
            );
            
            if (batchMembers.length > 0) {
              // First check if we already have stats from the API
              if (batchRun.success_count !== undefined && 
                  batchRun.failed_count !== undefined && 
                  batchRun.total_count !== undefined) {
                // Use stats directly from API
                // No need to update, already have valid stats
              } else {
                // Calculate batch statistics from individual runs
                const totalCount = batchRun.total_count || batchMembers.length || batchRun.num_simulations || 1;
                const successCount = batchMembers.filter(run => run.status === 'success').length;
                const failedCount = batchMembers.filter(run => run.status === 'error').length;
                const inProgressCount = batchMembers.filter(run => 
                  run.status === 'in_progress' || run.status === 'scheduled'
                ).length;
                
                // Determine batch status based on contained runs
                let batchStatus: 'success' | 'error' | 'in_progress' | 'scheduled' = 'success';
                if (inProgressCount > 0) {
                  batchStatus = 'in_progress';
                } else if (successCount === 0 && failedCount > 0) {
                  batchStatus = 'error';
                } else if (successCount > 0 && failedCount > 0) {
                  batchStatus = 'success'; // Partial success still shows as success
                }
                
                // Update the batch run with calculated statistics
                formattedRuns = formattedRuns.map(run => {
                  if (run.id === batchId) {
                    return {
                      ...run,
                      success_count: successCount,
                      failed_count: failedCount,
                      total_count: totalCount,
                      status: batchStatus,
                      description: run.description || `Batch with ${totalCount} simulations`
                    };
                  }
                  return run;
                });
              }
            }
          });
          
          setSimulationRuns(formattedRuns);
        }
      } catch (error) {
        console.error('Error fetching simulation data:', error);
        if (showLoadingState) {
          toast({
            title: "Error",
            description: "Could not load simulation data. Please try again.",
            variant: "destructive"
          });
        }
      } finally {
        // Always reset the loading state, regardless of the showLoadingState parameter
        console.log("Setting refresh loading state back to false");
        setIsRefreshingSimulations(false);
      }
  }, [user, submissionId, deploymentVerified, toast, analysis, setIsRefreshingSimulations, setSimStatus, setShowUpgradeMessage, setSimRepo, setSimulationRuns]);
  
  // Fetch simulation runs and status on component mount
  useEffect(() => {
    if (!user || !submissionId) return;
    
    // Initial fetch without showing loading state
    fetchSimulationRuns(false);
  }, [user, submissionId, deploymentVerified, fetchSimulationRuns]);
  
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
  
  // Fetch available branches from the original project repository (not the simulation repo)
  useEffect(() => {
    if (!submissionId) return;
    
    const fetchBranches = async () => {
      try {
        setIsLoadingBranches(true);
        console.log("Attempting to fetch simulation repository information...");
        
        // First, fetch the simulation repository information for the code viewer
        const repoResponse = await fetch(`/api/simulation-repo/${submissionId}`);
        
        if (!repoResponse.ok) {
          throw new Error(`Failed to fetch simulation repository: ${repoResponse.status}`);
        }
        
        const repoData = await repoResponse.json();
        console.log("Simulation repository data:", repoData);
        
        if (!repoData.owner || !repoData.repo) {
          throw new Error("Invalid simulation repository data received");
        }
        
        // Set the simulation repository information for the code viewer
        setSimRepo({
          owner: repoData.owner,
          repo: repoData.repo,
          branch: repoData.branch || 'main'
        });
        
        // Fetch branches from the ORIGINAL project repository instead of the simulation repo
        console.log(`Fetching branches from original project repository for submissionId: ${submissionId}`);
        
        // Use our new endpoint that fetches branches from the original project repository
        const branchesResponse = await fetch(`/api/project/branches/${submissionId}`);
        
        if (!branchesResponse.ok) {
          console.warn(`Failed to fetch branches from original repository (${branchesResponse.status}), falling back to simulation repo branches`);
          
          // Fallback to simulation repository branches if original repo fetch fails
          const simBranchesResponse = await fetch(`/api/github/branches/${repoData.owner}/${repoData.repo}`);
          
          if (!simBranchesResponse.ok) {
            throw new Error(`Failed to fetch any branches: ${simBranchesResponse.status}`);
          }
          
          const fallbackBranchesData = await simBranchesResponse.json();
          console.log("Fallback simulation repository branches data:", fallbackBranchesData);
          
          if (fallbackBranchesData.branches && Array.isArray(fallbackBranchesData.branches)) {
            setAvailableBranches(fallbackBranchesData.branches);
            
            // If there's a default branch, select it
            const defaultBranch = fallbackBranchesData.branches.find((b: any) => b.isDefault) || fallbackBranchesData.branches[0];
            if (defaultBranch) {
              setSelectedBranch(defaultBranch.name);
            }
          } else {
            // If no branches are found, provide a fallback
            console.log("No branches found in response, using fallback");
            setAvailableBranches([{ name: 'main', isDefault: true }]);
            setSelectedBranch('main');
          }
          return;
        }
        
        // We successfully got branches from the original project repository
        const branchesData = await branchesResponse.json();
        console.log("Original project repository branches data:", branchesData);
        
        if (branchesData.branches && Array.isArray(branchesData.branches)) {
          setAvailableBranches(branchesData.branches);
          
          // If there's a default branch, select it
          const defaultBranch = branchesData.branches.find((b: any) => b.isDefault) || branchesData.branches[0];
          if (defaultBranch) {
            setSelectedBranch(defaultBranch.name);
          }
        } else {
          // If no branches are found, provide a fallback
          console.log("No branches found in response, using fallback");
          setAvailableBranches([{ name: 'main', isDefault: true }]);
          setSelectedBranch('main');
        }
      } catch (error) {
        console.error('Error fetching repository or branches:', error);
        // Fallback to main branch if there's an error
        setAvailableBranches([{ name: 'main', isDefault: true }]);
        setSelectedBranch('main');
      } finally {
        setIsLoadingBranches(false);
      }
    };
    
    fetchBranches();
  }, [submissionId, analysis]);
  
  // Generate a new simulation ID
  const generateSimId = () => {
    return `sim-${String(Math.floor(Math.random() * 900) + 100)}`;
  };
  
  // Start a new simulation
  const startSimulation = async () => {
    if (isRunningSimulation || !simStatus?.canRun || !submissionId) return;
    
    try {
      setIsRunningSimulation(true);
      
      // Extract the UUID submission ID from analysis data
      // The analysis data contains the UUID format submission ID which is needed by the external API
      const uuidSubmissionId = analysis?.submissionId || 
                              analysis?.steps?.files?.jsonData?.submission_id || 
                              submissionId;
      
      console.log("Using submission UUID for simulation:", uuidSubmissionId);
      
      // Get actors from analysis data using same logic as above
      let actorsData = { actors: [] };
      try {
        const actorsStep = analysis?.steps?.actors;
        if (actorsStep?.jsonData) {
          if (typeof actorsStep.jsonData.actors_summary === 'string') {
            try {
              actorsData = JSON.parse(actorsStep.jsonData.actors_summary);
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
      
      // Build complete actor configuration including all actors with their current values
      const completeActorConfig: {[actorName: string]: number} = {};
      if (actorsData.actors && actorsData.actors.length > 0) {
        actorsData.actors.forEach((actor: any) => {
          completeActorConfig[actor.name] = actorConfig[actor.name] || 1;
        });
      }
      
      console.log("Complete actor configuration being sent:", completeActorConfig);
      
      // Call the new API endpoint to trigger the simulation
      const response = await fetch('/api/run-simulation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          submissionId: uuidSubmissionId, // Send the UUID format submission ID
          branch: selectedBranch, // Include selected branch
          description: simulationDescription, // Include description
          numSimulations: numSimulations, // Include number of simulations
          simulationType: simulationType, // Include simulation type (run or batch_run)
          actorConfig: completeActorConfig, // Include complete actor configuration
          iterations: iterations // Include iterations count
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
      
      // Show a success toast notification
      toast({
        title: "Success",
        description: "Simulation has been started successfully",
        variant: "default"
      });
      
      // Parse the response for more detailed information
      const responseData = await response.json();
      
      // Display a clear success message to the user with details
      const messagePrefix = numSimulations > 1 
        ? `Batch simulation with ${numSimulations} runs started successfully` 
        : "Simulation started successfully";
      
      setSimulationMessage(
        `${messagePrefix} on branch "${selectedBranch}". Results will appear in the list below shortly.`
      );
      
      console.log("Refreshing simulation runs after starting a new simulation...");
      // Immediately call fetchSimulationRuns with a short delay to ensure UI updates
      setTimeout(() => fetchSimulationRuns(true), 1000);
      
      // Set a timeout to refresh the simulation runs again after some time
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
                            run.status === "SCHEDULED" ? "scheduled" :
                            run.status === "scheduled" ? "scheduled" :
                            run.status === "CREATED" ? "scheduled" :
                            run.status === "created" ? "scheduled" :
                            run.status === "IN_PROGRESS" ? "in_progress" :
                            run.status === "in_progress" ? "in_progress" :
                            run.status?.toLowerCase() || "error";
                
                return {
                  id: run.simulation_id || run.run_id || run.id,
                  status: status as 'success' | 'error' | 'in_progress' | 'scheduled',
                  date: run.created_at || run.date || new Date().toISOString(),
                  logUrl: run.log_url || run.logUrl || null,
                  branch: run.branch || "default",
                  description: run.description || "",
                  type: run.type || (run.num_simulations && run.num_simulations > 1 ? "batch" : "run"),
                  num_simulations: run.num_simulations || 1,
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
                status: (run.status === 'failure' ? 'error' : 
                        run.status === 'CREATED' || run.status === 'created' ? 'scheduled' : 
                        run.status) as 'success' | 'error' | 'in_progress' | 'scheduled',
                date: run.date || new Date().toISOString(),
                logUrl: run.logUrl || null,
                branch: run.branch || "default",
                description: run.description || "",
                type: run.type || (run.num_simulations && run.num_simulations > 1 ? "batch" : "run"),
                num_simulations: run.num_simulations || 1,
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
        } catch (error) {
          console.error('Error completing simulation:', error);
          toast({
            title: "Error",
            description: "Failed to complete simulation. Please try again.",
            variant: "destructive"
          });
          setIsRunningSimulation(false);
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
        <div className="mb-4">
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
        
        {/* Simulation Parameters - Moved to center */}
        <div className="bg-gray-800 p-4 rounded-lg mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Branch Selection */}
            <div className="flex flex-col gap-1">
              <label htmlFor="branch-select" className="text-sm text-gray-300">
                Branch
              </label>
              <select
                id="branch-select"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                disabled={isLoadingBranches || isRunningSimulation || availableBranches.length === 0}
                className="bg-gray-900 border border-gray-700 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {isLoadingBranches ? (
                  <option>Loading branches...</option>
                ) : availableBranches.length === 0 ? (
                  <option>No branches available</option>
                ) : (
                  availableBranches.map((branch) => (
                    <option key={branch.name} value={branch.name}>
                      {branch.name} {branch.isDefault ? "(default)" : ""}
                    </option>
                  ))
                )}
              </select>
            </div>
            
            {/* Number of Simulations */}
            <div className="flex flex-col gap-1">
              <label htmlFor="sim-count" className="text-sm text-gray-300">
                Number of Simulations
              </label>
              <div className="flex items-center gap-2">
                <div className="flex w-full">
                  <button 
                    type="button"
                    onClick={() => {
                      if (numSimulations > 1 && !isRunningSimulation) {
                        const newVal = numSimulations - 1;
                        setNumSimulations(newVal);
                        setSimulationType(newVal > 1 ? 'batch_run' : 'run');
                      }
                    }}
                    disabled={numSimulations <= 1 || isRunningSimulation}
                    className="bg-gray-800 border border-gray-700 rounded-l-md px-3 py-1 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    -
                  </button>
                  <input
                    id="sim-count"
                    type="text" 
                    inputMode="numeric"
                    value={numSimulations}
                    onClick={(e) => {
                      // Select all text when clicked for easier replacement
                      e.currentTarget.select();
                    }}
                    onChange={(e) => {
                      let inputValue = e.target.value.trim();
                      
                      // Handle empty input by maintaining the current text field value
                      // but don't update the actual state yet (do that on blur)
                      if (inputValue === '') {
                        e.target.value = '';
                        return;
                      }
                      
                      // Only allow numbers
                      if (!/^\d+$/.test(inputValue)) {
                        return;
                      }
                      
                      // Parse the input value
                      const val = parseInt(inputValue, 10);
                      
                      // If valid number, update state with clamped value
                      if (!isNaN(val)) {
                        const clampedVal = Math.min(Math.max(val, 1), 100);
                        setNumSimulations(clampedVal);
                        setSimulationType(clampedVal > 1 ? 'batch_run' : 'run');
                        
                        // Update input field if we had to clamp the value
                        if (val !== clampedVal) {
                          e.target.value = clampedVal.toString();
                        }
                      }
                    }}
                    onBlur={(e) => {
                      // Get the current displayed value
                      const inputValue = e.target.value.trim();
                      
                      // Restore default value if empty or invalid
                      if (inputValue === '' || !/^\d+$/.test(inputValue) || isNaN(parseInt(inputValue, 10))) {
                        setNumSimulations(1);
                        setSimulationType('run');
                        e.target.value = '1'; // Explicitly update the input value
                      } else {
                        // Apply limits to make sure value is between 1 and 100
                        const val = parseInt(inputValue, 10);
                        const clampedVal = Math.min(Math.max(val, 1), 100);
                        
                        // Only update if the value needed clamping
                        if (val !== clampedVal) {
                          setNumSimulations(clampedVal);
                          setSimulationType(clampedVal > 1 ? 'batch_run' : 'run');
                        }
                        
                        // Make sure field shows the actual state value
                        e.target.value = numSimulations.toString();
                      }
                    }}
                    disabled={isRunningSimulation}
                    className="bg-gray-900 border-y border-gray-700 px-3 py-1 text-sm w-full text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      if (numSimulations < 100 && !isRunningSimulation) {
                        const newVal = numSimulations + 1;
                        setNumSimulations(newVal);
                        setSimulationType(newVal > 1 ? 'batch_run' : 'run');
                      }
                    }}
                    disabled={numSimulations >= 100 || isRunningSimulation}
                    className="bg-gray-800 border border-gray-700 rounded-r-md px-3 py-1 text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            
            {/* Description */}
            <div className="flex flex-col gap-1 md:col-span-3">
              <label htmlFor="sim-description" className="text-sm text-gray-300">
                Description (optional)
              </label>
              <input
                id="sim-description"
                type="text"
                placeholder="e.g., Test with increased gas price"
                value={simulationDescription}
                onChange={(e) => setSimulationDescription(e.target.value)}
                disabled={isRunningSimulation}
                className="bg-gray-900 border border-gray-700 rounded-md px-3 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Advanced Configuration Toggle */}
            <div className="md:col-span-3">
              <button
                type="button"
                onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
                disabled={isRunningSimulation}
                className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50"
              >
                <ChevronRight className={`h-4 w-4 transition-transform ${showAdvancedConfig ? 'rotate-90' : ''}`} />
                Advanced Configuration
              </button>
            </div>

            {/* Advanced Configuration Panel */}
            {showAdvancedConfig && (
              <div className="md:col-span-3 bg-gray-900/50 p-4 rounded-md border border-gray-700">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Advanced Configuration</h4>
                
                {/* Iterations Field */}
                <div className="mb-4">
                  <label htmlFor="iterations" className="text-sm text-gray-300 block mb-1">
                    Iterations
                  </label>
                  <input
                    id="iterations"
                    type="number"
                    min="1"
                    max="1000"
                    value={iterations}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= 1 && val <= 1000) {
                        setIterations(val);
                      }
                    }}
                    disabled={isRunningSimulation}
                    className="bg-gray-800 border border-gray-600 rounded-md px-3 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="350"
                  />
                  <p className="text-xs text-gray-400 mt-1">Number of iterations per simulation (default: 350)</p>
                </div>

                <h5 className="text-sm font-medium text-gray-300 mb-2">Actor Configuration</h5>
                <div className="space-y-3">
                  {(() => {
                    // Use same actor data parsing logic as Actor Summary section
                    let actorsData = { actors: [] };
                    try {
                      const actorsStep = analysis?.steps?.actors;
                      if (actorsStep?.jsonData) {
                        if (typeof actorsStep.jsonData.actors_summary === 'string') {
                          try {
                            actorsData = JSON.parse(actorsStep.jsonData.actors_summary);
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

                    return actorsData.actors && actorsData.actors.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {actorsData.actors.map((actor: any, index: number) => (
                        <div key={index} className="bg-gray-800/50 p-3 rounded-md">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h5 className="text-sm font-medium text-gray-300">{actor.name}</h5>
                              <p className="text-xs text-gray-500">{actor.summary}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-400">Count:</label>
                            <div className="flex items-center">
                              <button
                                type="button"
                                onClick={() => {
                                  const currentCount = actorConfig[actor.name] || 1;
                                  if (currentCount > 1) {
                                    setActorConfig(prev => ({
                                      ...prev,
                                      [actor.name]: currentCount - 1
                                    }));
                                  }
                                }}
                                disabled={isRunningSimulation || (actorConfig[actor.name] || 1) <= 1}
                                className="bg-gray-700 border border-gray-600 rounded-l-md px-2 py-1 text-xs text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                -
                              </button>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={actorConfig[actor.name] || 1}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value.trim(), 10);
                                  if (!isNaN(val) && val >= 1 && val <= 500) {
                                    // Get actors from analysis data using same logic as above
                                    let actorsData = { actors: [] };
                                    try {
                                      const actorsStep = analysis?.steps?.actors;
                                      if (actorsStep?.jsonData) {
                                        if (typeof actorsStep.jsonData.actors_summary === 'string') {
                                          try {
                                            actorsData = JSON.parse(actorsStep.jsonData.actors_summary);
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
                                    
                                    // Calculate current total including all actors
                                    let currentTotal = 0;
                                    if (actorsData.actors && actorsData.actors.length > 0) {
                                      actorsData.actors.forEach((a: any) => {
                                        currentTotal += a.name === actor.name ? val : (actorConfig[a.name] || 1);
                                      });
                                    }
                                    
                                    if (currentTotal <= 500) {
                                      setActorConfig(prev => ({
                                        ...prev,
                                        [actor.name]: val
                                      }));
                                    }
                                  }
                                }}
                                disabled={isRunningSimulation}
                                className="bg-gray-800 border-y border-gray-600 px-2 py-1 text-xs w-12 text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const currentCount = actorConfig[actor.name] || 1;
                                  
                                  // Get actors from analysis data using same logic as above
                                  let actorsData = { actors: [] };
                                  try {
                                    const actorsStep = analysis?.steps?.actors;
                                    if (actorsStep?.jsonData) {
                                      if (typeof actorsStep.jsonData.actors_summary === 'string') {
                                        try {
                                          actorsData = JSON.parse(actorsStep.jsonData.actors_summary);
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
                                  
                                  let currentTotal = 0;
                                  if (actorsData.actors && actorsData.actors.length > 0) {
                                    actorsData.actors.forEach((a: any) => {
                                      currentTotal += actorConfig[a.name] || 1;
                                    });
                                  }
                                  
                                  if (currentTotal < 500) {
                                    setActorConfig(prev => ({
                                      ...prev,
                                      [actor.name]: currentCount + 1
                                    }));
                                  }
                                }}
                                disabled={isRunningSimulation || (() => {
                                  // Get actors from analysis data using same logic as above
                                  let actorsData = { actors: [] };
                                  try {
                                    const actorsStep = analysis?.steps?.actors;
                                    if (actorsStep?.jsonData) {
                                      if (typeof actorsStep.jsonData.actors_summary === 'string') {
                                        try {
                                          actorsData = JSON.parse(actorsStep.jsonData.actors_summary);
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
                                  
                                  let total = 0;
                                  if (actorsData.actors && actorsData.actors.length > 0) {
                                    actorsData.actors.forEach((a: any) => {
                                      total += actorConfig[a.name] || 1;
                                    });
                                  }
                                  return total >= 500;
                                })()}
                                className="bg-gray-700 border border-gray-600 rounded-r-md px-2 py-1 text-xs text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                      ) : (
                        <div className="text-center p-4 text-gray-500 text-sm">
                          No actors available for configuration
                        </div>
                      );
                  })()}
                  
                  <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                    <div className="text-xs text-gray-400">
                      Total actors: {(() => {
                        // Get actors from analysis data using same logic as above
                        let actorsData = { actors: [] };
                        try {
                          const actorsStep = analysis?.steps?.actors;
                          if (actorsStep?.jsonData) {
                            if (typeof actorsStep.jsonData.actors_summary === 'string') {
                              try {
                                actorsData = JSON.parse(actorsStep.jsonData.actors_summary);
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
                        
                        let total = 0;
                        if (actorsData.actors && actorsData.actors.length > 0) {
                          actorsData.actors.forEach((actor: any) => {
                            total += actorConfig[actor.name] || 1;
                          });
                        }
                        return total > 500 ? (
                          <span className="text-red-400">{total} (max 500)</span>
                        ) : (
                          <span className="text-white">{total}</span>
                        );
                      })()}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        // Use same parsing logic as above
                        let actorsData = { actors: [] };
                        try {
                          const actorsStep = analysis?.steps?.actors;
                          if (actorsStep?.jsonData) {
                            if (typeof actorsStep.jsonData.actors_summary === 'string') {
                              try {
                                actorsData = JSON.parse(actorsStep.jsonData.actors_summary);
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
                        
                        if (actorsData.actors && actorsData.actors.length > 0) {
                          const resetConfig: {[actorName: string]: number} = {};
                          actorsData.actors.forEach((actor: any) => {
                            resetConfig[actor.name] = 1;
                          });
                          setActorConfig(resetConfig);
                        }
                      }}
                      disabled={isRunningSimulation}
                      className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                    >
                      Reset to defaults
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Run Button */}
            <div className="flex items-end">
              <div className="flex flex-col w-full">
                <div className="flex-grow"></div>
                <button
                  onClick={startSimulation}
                  disabled={isRunningSimulation || !simStatus?.canRun}
                  className={`px-4 py-2 rounded-md font-medium w-full ${
                    isRunningSimulation || !simStatus?.canRun
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {isRunningSimulation ? 'Running...' : numSimulations > 1 ? `Run ${numSimulations} Simulations` : 'Run Simulation'}
                </button>
              </div>
            </div>
          </div>
          
          {showUpgradeMessage && (
            <div className="mt-2 text-center">
              <Link href="/pricing" className="text-sm text-yellow-400 hover:text-yellow-300 underline">
                Upgrade Plan to Run More Simulations
              </Link>
            </div>
          )}
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
        
        {/* Batch Information Panel */}
        {viewingBatchId && currentBatch && (
          <div className="bg-purple-900/30 border border-purple-800 p-4 rounded-md mb-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-white font-medium mb-1 flex items-center">
                  <Box className="h-4 w-4 mr-2 text-purple-400" />
                  Batch Simulation: {currentBatch.description || currentBatch.id.substring(0, 8)}
                </h3>
                <div className="flex flex-wrap gap-3 text-sm">
                  <div className="flex items-center text-green-300">
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    <span>Success: {currentBatch.success_count || 0}</span>
                  </div>
                  <div className="flex items-center text-red-300">
                    <XCircle className="h-4 w-4 mr-1" />
                    <span>Failed: {currentBatch.failed_count || 0}</span>
                  </div>
                  <div className="flex items-center text-blue-300">
                    <CircleDot className="h-4 w-4 mr-1" />
                    <span>Total: {currentBatch.total_count || currentBatch.num_simulations || 0}</span>
                  </div>
                  <div className="flex items-center text-gray-300">
                    <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">
                      {format(new Date(currentBatch.date), 'MMM dd, yyyy HH:mm')}
                    </span>
                  </div>
                </div>
                
                {/* Status bar showing success percentage */}
                {currentBatch.total_count && currentBatch.total_count > 0 && (
                  <div className="mt-3 w-full max-w-md">
                    <div className="text-xs text-gray-300 mb-1 flex justify-between">
                      <span>Success Rate: {Math.round((currentBatch.success_count || 0) / currentBatch.total_count * 100)}%</span>
                      {currentBatch.status === 'in_progress' ? (
                        <span className="text-blue-300 flex items-center">
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> In Progress
                        </span>
                      ) : currentBatch.status === 'scheduled' ? (
                        <span className="text-gray-300 flex items-center">
                          <AlertCircle className="h-3 w-3 mr-1" /> Scheduled
                        </span>
                      ) : (
                        <span className={`${
                          currentBatch.success_count === currentBatch.total_count 
                            ? 'text-green-300' 
                            : currentBatch.failed_count === currentBatch.total_count 
                              ? 'text-red-300' 
                              : 'text-amber-300'
                        }`}>
                          {currentBatch.success_count === currentBatch.total_count 
                            ? 'Complete' 
                            : currentBatch.failed_count === currentBatch.total_count 
                              ? 'Failed' 
                              : 'Partial Success'}
                        </span>
                      )}
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full" 
                        style={{ width: `${Math.round((currentBatch.success_count || 0) / currentBatch.total_count * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={goBackToMainList}
                className="text-xs bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300 hover:text-white"
              >
                <ChevronRight className="h-4 w-4 mr-1" /> Back to Simulations
              </Button>
            </div>
          </div>
        )}
        
        {simulationRuns.length > 0 ? (
          <div className="bg-gray-900 rounded-md">
            <div className="border-b border-gray-800 p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-medium text-gray-300">Simulation Runs</h3>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    // Set loading state first, then fetch
                    setIsRefreshingSimulations(true);
                    console.log("Refresh button clicked, setting loading state");
                    // Use a small delay to ensure state updates before fetch starts
                    setTimeout(() => fetchSimulationRuns(true), 50);
                  }}
                  disabled={isRefreshingSimulations}
                  className="text-xs bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300 hover:text-white"
                >
                  {isRefreshingSimulations ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Refreshing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1" /> Refresh
                    </>
                  )}
                </Button>
              </div>
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
                    isBatch={(run.type === 'batch' || (run.num_simulations && run.num_simulations > 1))}
                    onBatchClick={viewingBatchId ? undefined : (batchId) => {
                      console.log(`Viewing batch simulations for batch ID: ${batchId}`);
                      setViewingBatchId(batchId);
                      fetchBatchSimulations(batchId);
                    }}
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
function SimulationRunItem({ 
  run, 
  index, 
  number, 
  isBatch, 
  onBatchClick 
}: { 
  run: SimulationRun, 
  index: number, 
  number: number,
  isBatch?: boolean,
  onBatchClick?: (batchId: string) => void
}) {
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
    // If this is a batch and has a batch click handler, don't toggle details
    if (isBatch && onBatchClick) {
      onBatchClick(run.id);
      return;
    }
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
    <div 
      className={`hover:bg-gray-800/50 transition-colors cursor-pointer ${
        isBatch && onBatchClick 
          ? 'border-l-4 border-purple-700 hover:bg-purple-900/30 group' 
          : ''
      }`} 
      onClick={toggleDetails}
      title={isBatch && onBatchClick ? "Click to view individual simulations in this batch" : "Click to view details"}
    >
      <div className={`p-4 ${isBatch && onBatchClick ? 'pl-3' : ''}`}>
        {/* First row with run ID, status and action buttons */}
        <div className="flex flex-col md:grid md:grid-cols-12 items-start md:items-center gap-2 md:gap-0 mb-2">
          <div className="md:col-span-1 font-medium text-gray-300">
            <div className="md:hidden text-xs text-gray-400 mb-1">#</div>
            {number}
          </div>
          <div className="md:col-span-3 font-mono text-white">
            <div className="md:hidden text-xs text-gray-400 mb-1">Run ID</div>
            <div className="truncate max-w-[180px]">{run.id}</div>
            {isBatch && (
              <div className="flex flex-col space-y-1 mt-1 text-xs">
                <div className="flex items-center text-purple-300">
                  <Box className="h-3 w-3 mr-1" />
                  <span>{run.num_simulations || run.total_count || 0} simulation{(run.num_simulations || run.total_count || 0) !== 1 ? 's' : ''}</span>
                  {onBatchClick && (
                    <span className="ml-2 text-purple-400 group-hover:text-purple-300 transition-colors">
                      (Click to view)
                    </span>
                  )}
                </div>
                
                {/* Show batch statistics when available */}
                {(run.success_count !== undefined || run.failed_count !== undefined) && (
                  <div className="flex items-center space-x-2 pl-4 text-xs">
                    {run.success_count !== undefined && (
                      <span className="text-green-300 flex items-center">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> 
                        {run.success_count}
                      </span>
                    )}
                    {run.failed_count !== undefined && (
                      <span className="text-red-300 flex items-center">
                        <XCircle className="h-3 w-3 mr-1" /> 
                        {run.failed_count}
                      </span>
                    )}
                    {run.total_count !== undefined && run.total_count > 0 && (
                      <span className="text-gray-300 flex items-center">
                        <CircleDot className="h-3 w-3 mr-1" /> 
                        {Math.round((run.success_count || 0) / run.total_count * 100)}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="md:col-span-3">
            <div className="md:hidden text-xs text-gray-400 mb-1">Status</div>
            {isBatch ? (
              // Custom status display for batches
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                ${run.status === 'in_progress'
                  ? 'bg-blue-900/50 text-blue-300'
                  : run.status === 'scheduled'
                    ? 'bg-gray-700/50 text-gray-300'
                    : (run.success_count !== undefined && run.total_count !== undefined) && 
                      (run.success_count === run.total_count)
                      ? 'bg-green-900/50 text-green-300'
                      : (run.failed_count !== undefined && run.total_count !== undefined) && 
                        (run.failed_count === run.total_count)
                        ? 'bg-red-900/50 text-red-300'
                        : 'bg-amber-900/50 text-amber-300' // Partial success
                }`}
              >
                {run.status === 'in_progress'
                  ? <><RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Running</>
                  : run.status === 'scheduled'
                    ? <><AlertCircle className="h-3 w-3 mr-1" /> Scheduled</>
                    : (run.success_count !== undefined && run.total_count !== undefined) && 
                      (run.success_count === run.total_count)
                      ? <><CheckCircle2 className="h-3 w-3 mr-1" /> Complete</>
                      : (run.failed_count !== undefined && run.total_count !== undefined) && 
                        (run.failed_count === run.total_count)
                        ? <><XCircle className="h-3 w-3 mr-1" /> Failed</>
                        : <><AlertCircle className="h-3 w-3 mr-1" /> Partial</>
                }
              </span>
            ) : (
              // Regular status display for individual runs
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                ${run.status === 'success' 
                  ? 'bg-green-900/50 text-green-300' 
                  : run.status === 'in_progress'
                    ? 'bg-blue-900/50 text-blue-300'
                    : run.status === 'scheduled'
                      ? 'bg-gray-700/50 text-gray-300'
                      : 'bg-red-900/50 text-red-300'
                }`}
              >
                {run.status === 'success' 
                  ? <><CheckCircle2 className="h-3 w-3 mr-1" /> Success</> 
                  : run.status === 'in_progress'
                    ? <><RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Running</>
                    : run.status === 'scheduled'
                      ? <><AlertCircle className="h-3 w-3 mr-1" /> Scheduled</>
                      : <><XCircle className="h-3 w-3 mr-1" /> Failed</>}
              </span>
            )}
          </div>
          <div className="md:col-span-3 text-gray-300">
            <div className="md:hidden text-xs text-gray-400 mb-1">Date</div>
            {typeof run.date === 'string' && run.date.includes('GMT')
              ? new Date(run.date.replace('GMT', '+0000')).toLocaleString()
              : new Date(run.date).toLocaleString()}
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-2 md:space-x-2" onClick={(e) => e.stopPropagation()}>
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
        
        {/* Second row with branch, type and description */}
        <div className="flex flex-col md:grid md:grid-cols-12 items-start md:items-center gap-2 md:gap-0 border-t border-gray-800/50 pt-2">
          <div className="md:col-span-1">
            {/* Empty space to align with top row */}
          </div>
          <div className="md:col-span-3 text-gray-300">
            <div className="md:hidden text-xs text-gray-400 mb-1">Branch</div>
            <div className="flex items-center">
              <span className="text-xs text-gray-400 mr-2">Branch:</span>
              <span className="px-2 py-0.5 bg-gray-700/50 rounded text-blue-200 text-sm">
                {run.branch || "default"}
              </span>
            </div>
          </div>
          <div className="md:col-span-2 text-gray-300">
            <div className="md:hidden text-xs text-gray-400 mb-1">Type</div>
            <div className="flex items-center">
              <span className="text-xs text-gray-400 mr-2">Type:</span>
              <span className={`px-2 py-0.5 rounded text-sm ${
                run.type === 'batch' || (run.num_simulations && run.num_simulations > 1) 
                  ? 'bg-purple-800/50 text-purple-200' 
                  : 'bg-gray-700/50 text-gray-300'
              }`}>
                {run.type === 'batch' || (run.num_simulations && run.num_simulations > 1) ? 'batch' : 'run'}
              </span>
            </div>
          </div>
          <div className="md:col-span-6 text-gray-300">
            <div className="md:hidden text-xs text-gray-400 mb-1">Description</div>
            <div className="flex items-center">
              <span className="text-xs text-gray-400 mr-2">Description:</span>
              <span className="text-sm truncate max-w-[300px]">
                {run.description || ""}
              </span>
            </div>
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
                  <span>Type:</span>
                  <span>
                    {run.type === 'batch' || (run.num_simulations && run.num_simulations > 1) 
                      ? `Batch (${run.num_simulations || '?'} simulations)` 
                      : 'Single Run'}
                  </span>
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
  status?: string; // Optional field that may be present in some API responses
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
  },
  {
    id: "history",
    title: "History",
    description: "View submission history and step execution logs",
    status: "pending"
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
  const [isDebugInProgress, setIsDebugInProgress] = useState(false);
  const [isVerifyInProgress, setIsVerifyInProgress] = useState(false);
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
          
          // Check for all deployment-related steps in completed_steps
          if (details.data.completed_steps) {
            // Check for all deployment-related steps that might be in progress
            const verificationStep = details.data.completed_steps.find((step: any) => 
              step.step === "verify_deployment_script");
            
            const debugStep = details.data.completed_steps.find((step: any) => 
              step.step === "debug_deployment_script");
            
            const analyzeDeploymentStep = details.data.completed_steps.find((step: any) => 
              step.step === "analyze_deployment");
            
            const implementDeploymentStep = details.data.completed_steps.find((step: any) => 
              step.step === "implement_deployment_script");
            
            // Set the in-progress status for showing spinner for verification
            if (verificationStep) {
              setIsVerifyInProgress(verificationStep.status === "in_progress");
              console.log("Verification status:", verificationStep.status);
            }
            
            // Set the in-progress status for showing spinner for debug
            if (debugStep) {
              setIsDebugInProgress(debugStep.status === "in_progress");
              console.log("Debug status:", debugStep.status);
            }
            
            // Also check if any other deployment-related steps are in progress
            // to show the spinner in the deployment section header
            const isAnyDeploymentStepInProgress = [
              verificationStep, 
              debugStep, 
              analyzeDeploymentStep, 
              implementDeploymentStep
            ].some(step => step && step.status === "in_progress");
            
            if (isAnyDeploymentStepInProgress) {
              // Set either debug or verify to true to show the spinner
              setIsDebugInProgress(true);
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
                {/* Status message at the top */}
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
                      The deployment script verification has failed. Please review the logs below for details on what needs to be corrected.
                    </p>
                    <div className="mt-4 flex items-center">
                      <Button 
                        variant="outline"
                        className="bg-blue-900/30 border-blue-700 text-blue-300 hover:bg-blue-900/60 hover:text-blue-200"
                        onClick={async () => {
                          try {
                            // Make a POST request to the backend API endpoint
                            const response = await fetch('/api/analyze', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                submission_id: submissionId,
                                step: 'debug_deployment_script'
                              })
                            });
                            if (response.ok) {
                              toast({
                                title: "Debug Started",
                                description: "Starting deployment script debug process. This may take a moment.",
                              });
                              // Start a polling interval to update verification status
                              toast({
                                title: "Checking debug progress...",
                                description: "Checking for updates every few seconds...",
                              });
                              
                              // Set up a repeating check for debug status
                              const statusCheckInterval = setInterval(async () => {
                                // Get the latest status
                                await fetchSubmissionDetails();
                                await fetchVerificationData();
                                
                                // Check if debug or verification is no longer in progress
                                const currentDetails = await fetchSubmissionDetails();
                                if (currentDetails?.data?.completed_steps) {
                                  const debugStep = currentDetails.data.completed_steps.find((step: any) => 
                                    step.step === "debug_deployment_script");
                                  
                                  const verifyStep = currentDetails.data.completed_steps.find((step: any) => 
                                    step.step === "verify_deployment_script");
                                  
                                  // Check if verification status has changed (may be updated as part of debug)
                                  if (verifyStep && verifyStep.status !== "in_progress") {
                                    if (verifyStep.status === "success") {
                                      toast({
                                        title: "Verification Succeeded",
                                        description: "Deployment verification passed successfully!",
                                      });
                                    }
                                  }
                                  
                                  // If debug is complete or failed, stop checking
                                  if (debugStep && debugStep.status !== "in_progress") {
                                    clearInterval(statusCheckInterval);
                                    
                                    // Show a message based on the final status
                                    if (debugStep.status === "success") {
                                      toast({
                                        title: "Debug Complete",
                                        description: "Debug process completed successfully. Verification may still be in progress.",
                                      });
                                      
                                      // Check again for verification after debug completes
                                      setTimeout(() => {
                                        fetchVerificationData();
                                      }, 2000);
                                      
                                    } else if (debugStep.status === "error") {
                                      toast({
                                        title: "Debug Failed",
                                        description: "Debug process failed. Please check the logs for details.",
                                        variant: "destructive",
                                      });
                                    }
                                  }
                                }
                              }, 5000); // Check every 5 seconds
                            } else {
                              const errorData = await response.json().catch(() => ({}));
                              toast({
                                title: "Debug Failed",
                                description: errorData.message || "Failed to start debug process. Please try again.",
                                variant: "destructive",
                              });
                            }
                          } catch (error) {
                            console.error("Error debugging deploy script:", error);
                            toast({
                              title: "Debug Error",
                              description: "An error occurred while trying to debug the deployment script.",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Debug Deployment Script
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Verification details and logs */}
                <div className="bg-gray-900 border border-gray-700 rounded-md overflow-hidden">
                  <div className="bg-gray-800 p-3 border-b border-gray-700 flex justify-between items-center">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-300">Verification Status</span>
                    </div>
                    {/* Check if debug is in progress based on the steps data */}
                    {(isDebugInProgress || isVerifyInProgress) ? (
                      <Badge variant="outline" className="bg-blue-900/30 text-blue-300 border-blue-700 flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                        Processing
                      </Badge>
                    ) : (
                      <Badge variant={verificationData.status === "completed" ? "outline" : "destructive"} 
                        className={verificationData.status === "completed" ? 
                          "bg-green-900/30 text-green-300 border-green-700" : 
                          "bg-red-900/30 text-red-300 border-red-700"}
                      >
                        {verificationData.status === "completed" ? "Success" : "Failed"}
                      </Badge>
                    )}
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
  const [showProgressDetails, setShowProgressDetails] = useState(false);
  
  // Define the complete analysis flow order at component level
  const analysisFlow = [
    "analyze_project",
    "analyze_actors", 
    "analyze_deployment",
    "implement_deployment_script",
    "verify_deployment_script",
    "debug_deployment_script",
    "scaffold",
    "analyze_all_actions",
    "analyze_all_snapshots",
    "implement_snapshots",
    "implement_all_actions"
  ];

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

  const { data: analysis, isLoading, refetch, error } = useQuery<AnalysisResponse>({
    queryKey: [`/api/analysis/${id}`],
    enabled: !!id, // Only run query when we have an ID
    queryFn: async () => {
      const response = await fetch(`/api/analysis/${id}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch analysis: ${response.status}`);
      }
      return response.json();
    },
    refetchInterval: false,
    retry: 2,
    staleTime: 0, // Always fresh data for analysis
    cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
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
    console.log("Analysis loading state:", isLoading);
    console.log("Analysis error:", error);
    
    // Force refetch if stuck in loading state
    if (isLoading && !analysis && !error) {
      const timer = setTimeout(() => {
        console.log("Forcing refetch due to stuck loading state");
        refetch();
      }, 3000);
      return () => clearTimeout(timer);
    }
    
    // Debug completedSteps structure
    if (analysis?.completedSteps) {
      console.log("CompletedSteps array:", analysis.completedSteps);
      console.log("CompletedSteps length:", analysis.completedSteps.length);
      analysis.completedSteps.forEach((step, index) => {
        console.log(`CompletedStep ${index}:`, step);
      });
    } else {
      console.log("No completedSteps found in analysis data");
    }
    
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
  }, [analysis, submissionId, isLoading, error, refetch]);
  
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
    
    console.log(`Checking completion for stepId: ${stepId}, apiStepName: ${apiStepName}`);
    console.log('Available completed steps:', analysis.completedSteps.map(s => s.step));
    
    // Check if this step is in the completed_steps array
    const isCompleted = analysis.completedSteps.some(step => step.step === apiStepName);
    console.log(`Result: ${isCompleted}`);
    
    return isCompleted;
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
    // Special case for history tab - always consider it completed since it's just a view
    if (stepId === "history") {
      return "completed";
    }
    
    // Special case for simulations step - if deployment is verified, mark it as completed
    if (stepId === "simulations" && isDeploymentVerificationCompleted(analysis.completedSteps)) {
      return "completed";
    }
    
    // Check if this step has failed by looking at completedSteps array
    const apiStepName = getApiStepName(stepId);
    const stepInfo = analysis.completedSteps?.find(step => step.step === apiStepName);
    
    if (stepInfo) {
      // Step is in completedSteps array
      if (stepInfo.status === "error" || stepInfo.status === "failed") {
        return "failed";
      } else if (stepInfo.status === "in_progress") {
        return "in_progress";
      } else {
        // Default to completed if no explicit status or status is success
        return "completed";
      }
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
      // Count how many successful steps are completed so far
      const successfulStepsCount = analysis.completedSteps?.filter(step => 
        step.status !== "error" && step.status !== "failed"
      ).length || 0;
      
      // If this step's index matches the successful completed count, it should be the next in progress
      if (stepIndex === successfulStepsCount) {
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

        {/* Progress Indicator - Show for all analysis statuses */}
        {analysis && (analysis.status === "in_progress" || analysis.status === "success" || analysis.status === "error" || analysis.status === "failed") && (
          <div className="mb-6 bg-blue-900/30 border border-blue-500/50 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              {(() => {
                // Check if the essential steps for simulations are complete
                // Note: completedSteps uses original names, steps object uses transformed names
                const essentialSteps = [
                  { original: "analyze_project", transformed: "files" },
                  { original: "analyze_actors", transformed: "actors" },
                  { original: "analyze_deployment", transformed: "deployment" }
                ];
                const essentialStepsComplete = essentialSteps.every(step => {
                  const completedInArray = analysis?.completedSteps?.some(cs => cs.step === step.original);
                  const completedInSteps = analysis?.steps?.[step.transformed]?.status === "completed";
                  return completedInArray || completedInSteps;
                });

                if (analysis?.status === "error" || analysis?.status === "failed") {
                  return <XCircle className="h-5 w-5 text-red-400" />;
                } else if (essentialStepsComplete) {
                  return <CheckCircle2 className="h-5 w-5 text-green-400" />;
                } else if (analysis?.status === "success") {
                  return <AlertCircle className="h-5 w-5 text-orange-400" />;
                } else {
                  return <Loader2 className="h-5 w-5 animate-spin text-blue-400" />;
                }
              })()}
              <div className="flex-1">
                {(() => {
                  // Check if the essential steps for simulations are complete
                  const essentialSteps = [
                    { original: "analyze_project", transformed: "files" },
                    { original: "analyze_actors", transformed: "actors" },
                    { original: "analyze_deployment", transformed: "deployment" }
                  ];
                  const essentialStepsComplete = essentialSteps.every(step => {
                    // Use completedSteps array as the only authoritative source
                    return analysis?.completedSteps?.some(cs => cs.step === step.original) || false;
                  });

                  // Check if deployment verification is complete (allows early access to simulations)
                  const deploymentVerificationComplete = analysis?.completedSteps?.some(cs => 
                    cs.step === 'verify_deployment_script' || cs.step === 'debug_deployment_script'
                  ) || false;

                  // Check if ALL steps in the full pipeline are complete (true analysis completion)
                  const analysisFlow = [
                    "analyze_project",
                    "analyze_actors", 
                    "analyze_deployment",
                    "implement_deployment_script",
                    "verify_deployment_script",
                    "debug_deployment_script",
                    "scaffold",
                    "analyze_all_actions",
                    "analyze_all_snapshots",
                    "implement_snapshots",
                    "implement_all_actions"
                  ];
                  // Check if any step has failed
                  const hasFailedSteps = analysis?.completedSteps?.some(cs => cs.status === 'error') || false;

                  const allStepsComplete = analysisFlow.every(step => {
                    const stepInfo = analysis?.completedSteps?.find(cs => cs.step === step);
                    // If no status field exists, treat the presence of the step as success (backward compatibility)
                    return stepInfo && (stepInfo.status === 'success' || !stepInfo.status);
                  });

                  if (analysis?.status === "error" || hasFailedSteps) {
                    return <h3 className="text-red-400 font-medium">Analysis Failed</h3>;
                  } else if (allStepsComplete) {
                    return (
                      <>
                        <h3 className="text-green-400 font-medium">Analysis Complete</h3>
                        <div className="text-green-300 text-sm mt-1">Ready to run simulations</div>
                      </>
                    );
                  } else if (deploymentVerificationComplete) {
                    return (
                      <>
                        <h3 className="text-orange-400 font-medium">Deployment Verified</h3>
                        <div className="text-orange-300 text-sm mt-1">Basic simulations available, full pipeline in progress</div>
                      </>
                    );
                  } else if (analysis?.status === "success") {
                    return (
                      <>
                        <h3 className="text-orange-400 font-medium">Analysis Partially Complete</h3>
                        <div className="text-orange-300 text-sm mt-1">Additional steps required before simulations</div>
                      </>
                    );
                  } else {
                    return <h3 className="text-blue-400 font-medium">Analysis in Progress</h3>;
                  }
                })()}
                <div className="text-gray-300 text-sm mt-1 space-y-1">
                  {(() => {
                    // Define the complete analysis flow order
                    const analysisFlow = [
                      "analyze_project",
                      "analyze_actors", 
                      "analyze_deployment",
                      "implement_deployment_script",
                      "verify_deployment_script",
                      "debug_deployment_script",
                      "scaffold",
                      "analyze_all_actions",
                      "analyze_all_snapshots",
                      "implement_snapshots",
                      "implement_all_actions"
                    ];
                    
                    const stepDisplayNames = {
                      "analyze_project": "Analyze Project",
                      "analyze_actors": "Analyze Actors",
                      "analyze_deployment": "Analyze Deployment",
                      "implement_deployment_script": "Implement Deployment Script",
                      "verify_deployment_script": "Deployment Verification",
                      "debug_deployment_script": "Deployment Debugging",
                      "scaffold": "Scaffolding",
                      "analyze_all_actions": "Action Analysis",
                      "analyze_all_snapshots": "Snapshot Analysis",
                      "implement_snapshots": "Snapshot Implementation",
                      "implement_all_actions": "Action Implementation"
                    };
                    
                    const stepDescriptions = {
                      "analyze_project": "Analyzes the project, the purpose, etc.",
                      "analyze_actors": "Identifies market participants and actions that will be taken by each of the market participant.",
                      "analyze_deployment": "Evaluate how to deploy the contracts based on user input.",
                      "implement_deployment_script": "Implements deployment script",
                      "verify_deployment_script": "Ensures that deployment script works",
                      "debug_deployment_script": "Deployment debugging (If needed)",
                      "scaffold": "Scaffolds actions, actors and snapshots",
                      "analyze_all_actions": "Understands what are the state changes and validations necessary for each action.",
                      "analyze_all_snapshots": "What are the states that should be snapshotted and how.",
                      "implement_snapshots": "Implements datastructures and methods to snapshot contracts.",
                      "implement_all_actions": "Implements parameter generation logic, execution of action logic and validation of action. At this point, simulation code should be ready."
                    };
                    
                    // Check if essential steps are complete first
                    const essentialSteps = [
                      { original: "analyze_project", transformed: "files" },
                      { original: "analyze_actors", transformed: "actors" },
                      { original: "analyze_deployment", transformed: "deployment" }
                    ];
                    const essentialStepsComplete = essentialSteps.every(step => {
                      // Use completedSteps array as the only authoritative source
                      return analysis?.completedSteps?.some(cs => cs.step === step.original) || false;
                    });

                    // Check if deployment verification is complete (allows early access to simulations)
                    const deploymentVerificationComplete = analysis?.completedSteps?.some(cs => 
                      cs.step === 'verify_deployment_script' || cs.step === 'debug_deployment_script'
                    ) || false;

                    // Check if ALL steps in the full pipeline are complete (true analysis completion)
                    const allStepsComplete = analysisFlow.every(step => {
                      return analysis?.completedSteps?.some(cs => cs.step === step) || false;
                    });

                    // Determine current step based on analysis status
                    let currentStep = null;
                    let nextStep = null;
                    
                    if (analysis?.status === "success" || analysis?.status === "error" || analysis?.status === "failed") {
                      // For success/error/failed status, determine current step based on completed steps
                      if (analysis.completedSteps && analysis.completedSteps.length > 0) {
                        // Check if there's a failed step
                        const failedStep = analysis.completedSteps.find(step => step.status === "error" || step.status === "failed");
                        
                        if (failedStep && (analysis?.status === "error" || analysis?.status === "failed")) {
                          // Show the step that failed
                          currentStep = failedStep.step;
                          nextStep = null;
                        } else {
                          const lastCompletedStep = analysis.completedSteps[analysis.completedSteps.length - 1];
                          const lastCompletedIndex = analysisFlow.indexOf(lastCompletedStep.step);
                          
                          if (allStepsComplete) {
                            // All pipeline steps done, show the actual last completed step
                            currentStep = lastCompletedStep.step;
                            nextStep = null;
                          } else if (lastCompletedIndex >= 0 && lastCompletedIndex < analysisFlow.length - 1) {
                            // Show next step that needs to be completed
                            currentStep = analysisFlow[lastCompletedIndex + 1];
                            if (lastCompletedIndex + 2 < analysisFlow.length) {
                              nextStep = analysisFlow[lastCompletedIndex + 2];
                            }
                          } else {
                            currentStep = lastCompletedStep.step;
                            nextStep = null;
                          }
                        }
                      } else {
                        currentStep = analysisFlow[0];
                        nextStep = analysisFlow[1];
                      }
                    } else if (analysis?.status === "in_progress") {
                      // For in_progress status, show the actual current step being worked on
                      if (analysis.completedSteps && analysis.completedSteps.length > 0) {
                        // Check if any step is currently in_progress
                        const inProgressStep = analysis.completedSteps.find(step => step.status === "in_progress");
                        
                        if (inProgressStep) {
                          // Show the step that's currently in progress
                          currentStep = inProgressStep.step;
                          const currentIndex = analysisFlow.indexOf(inProgressStep.step);
                          if (currentIndex >= 0 && currentIndex < analysisFlow.length - 1) {
                            nextStep = analysisFlow[currentIndex + 1];
                          }
                        } else {
                          // No in_progress step found, use last completed + 1
                          const lastCompletedStep = analysis.completedSteps[analysis.completedSteps.length - 1];
                          const lastCompletedIndex = analysisFlow.indexOf(lastCompletedStep.step);
                          
                          if (lastCompletedIndex >= 0 && lastCompletedIndex < analysisFlow.length - 1) {
                            currentStep = analysisFlow[lastCompletedIndex + 1];
                            if (lastCompletedIndex + 2 < analysisFlow.length) {
                              nextStep = analysisFlow[lastCompletedIndex + 2];
                            }
                          } else {
                            currentStep = lastCompletedStep.step;
                            nextStep = null;
                          }
                        }
                      } else {
                        // If no completed steps, we're on the first step
                        currentStep = analysisFlow[0];
                        nextStep = analysisFlow[1];
                      }
                    } else {
                      // Default case - starting with first step
                      currentStep = analysisFlow[0];
                      nextStep = analysisFlow[1];
                    }
                    
                    // Helper function to get completion date for a step
                    const getStepCompletionDate = (stepKey: string): string | null => {
                      if (!analysis?.completedSteps) return null;
                      
                      // stepKey is already the API step name, so use it directly
                      const completedStep = analysis.completedSteps.find(step => step.step === stepKey);
                      return completedStep?.updatedAt || null;
                    };

                    return (
                      <>
                        <div>
                          {analysis?.status === "error" || analysis?.status === "failed" ? (
                            <>
                              <span className="text-red-300">Failed at:</span>{" "}
                              <span className="text-white font-medium">
                                {currentStep ? stepDisplayNames[currentStep] || currentStep : "Unknown Step"}
                              </span>
                            </>
                          ) : analysis?.status === "success" ? (
                            <>
                              {allStepsComplete ? (
                                <>
                                  <span className="text-green-300">Completed:</span>{" "}
                                  <span className="text-white font-medium">
                                    {currentStep ? stepDisplayNames[currentStep] || currentStep : "Final Step"}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="text-blue-300">Next Step:</span>{" "}
                                  <span className="text-white font-medium">
                                    {currentStep ? stepDisplayNames[currentStep] || currentStep : "Unknown"}
                                  </span>
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="text-blue-300">Current Step:</span>{" "}
                              <span className="text-white font-medium">
                                {currentStep ? stepDisplayNames[currentStep] || currentStep : "Initializing..."}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {currentStep ? stepDescriptions[currentStep] : "Preparing analysis environment..."}
                        </div>
                        {nextStep && analysis?.status === "in_progress" && (
                          <div className="mt-2">
                            <span className="text-gray-400">Next Step:</span>{" "}
                            <span className="text-gray-200">
                              {stepDisplayNames[nextStep] || nextStep}
                            </span>
                          </div>
                        )}
                        
                        {/* Expandable Details Button */}
                        <button 
                          onClick={() => setShowProgressDetails(!showProgressDetails)}
                          className="mt-3 text-xs text-blue-300 hover:text-blue-200 flex items-center gap-1 transition-colors"
                        >
                          <ChevronRight className={`h-3 w-3 transition-transform ${showProgressDetails ? 'rotate-90' : ''}`} />
                          {showProgressDetails ? 'Hide Details' : 'More Information'}
                        </button>
                        
                        {/* Expandable Details Section */}
                        {showProgressDetails && (
                          <div className="mt-3 pt-3 border-t border-blue-500/30 space-y-2">
                            <div className="text-xs font-medium text-blue-300 mb-2">Analysis Pipeline Progress</div>
                            {analysisFlow.map((step, index) => {
                              // Check the actual status of this step from completedSteps array
                              const stepInfo = analysis?.completedSteps?.find(cs => cs.step === step);
                              // If no status field exists, treat the presence of the step as success (backward compatibility)
                              const isCompleted = stepInfo && (stepInfo.status === 'success' || !stepInfo.status);
                              const isFailedStep = stepInfo && stepInfo.status === 'error';
                              const isCurrent = step === analysis?.currentStep;
                              const completionDate = getStepCompletionDate(step);
                              
                              return (
                                <div key={step} className={`text-xs flex items-center justify-between py-1 ${
                                  isFailedStep ? 'text-red-400' :
                                  isCompleted ? 'text-green-400' : 
                                  isCurrent ? 'text-blue-300 font-medium' : 'text-gray-500'
                                }`}>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${
                                      isFailedStep ? 'bg-red-400' :
                                      isCompleted ? 'bg-green-400' : 
                                      isCurrent ? 'bg-blue-400 animate-pulse' : 'bg-gray-600'
                                    }`} />
                                    <span 
                                      title={stepDescriptions[step]}
                                      className="cursor-help"
                                    >
                                      {index + 1}. {stepDisplayNames[step]}
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {isCompleted ? (
                                      completionDate ? (
                                        `Completed ${new Date(completionDate).toLocaleString('en-US', {
                                          month: 'short',
                                          day: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}`
                                      ) : (
                                        'Completed'
                                      )
                                    ) : isCurrent ? (
                                      'In Progress'
                                    ) : (
                                      'Not started'
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

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
              {step.id === "history" && <ClockIcon className="h-5 w-5 mr-2" />}
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
                    
                    return "View Progress";
                  }
                  
                  // Special case for History tab - don't show "Ready for analysis"
                  if (currentStep.id === "history") {
                    return "View analysis history";
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
                          
                          {/* Code Viewer with Commit History */}
                          <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 mb-6">
                            <div className="flex justify-between items-center mb-3">
                              <h4 className="text-lg font-medium text-blue-400">Simulation Code</h4>
                              <Badge variant="outline" className="bg-blue-950/50 text-blue-300">
                                Latest Commit History
                              </Badge>
                            </div>
                            <div className="w-full overflow-hidden h-[500px]">
                              <GitHubCodeViewer 
                                owner={simRepo.owner}
                                repo={simRepo.repo}
                                branch={simRepo.branch}
                                path=""
                                showBreadcrumb={true}
                                showCommits={true}
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
                                                  <div className="flex items-center justify-between mb-2">
                                                    <h5 className="text-sm font-medium text-blue-300">Actions</h5>
                                                    {isLoadingActionStatuses && (
                                                      <span className="text-xs text-blue-400">Loading status...</span>
                                                    )}
                                                    {actionStatusError && (
                                                      <span className="text-xs text-red-400">Status unavailable</span>
                                                    )}
                                                  </div>
                                                  {actor.actions && actor.actions.map((action: any, i: number) => {
                                                    const actionStatus = getActionStatus(action.contract_name, action.function_name);
                                                    return (
                                                      <Collapsible key={i} className="bg-gray-700/50 rounded-md">
                                                      <CollapsibleTrigger className="w-full p-3 flex items-center justify-between">
                                                        <div className="flex-1 min-w-0">
                                                          <h6 className="text-white text-left text-sm font-medium">{action.name}</h6>
                                                          <p className="text-gray-400 text-xs text-left">{action.summary}</p>
                                                          <p className="text-gray-500 text-[10px] text-left mt-1">{action.contract_name}.{action.function_name}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2 ml-2">
                                                          <span className="text-xs bg-blue-900 px-2 py-1 rounded-full text-blue-200">
                                                            {action.contract_name}
                                                          </span>
                                                          {/* Action Status Display */}
                                                          {actionStatus ? (
                                                            <div className="flex items-center gap-2">
                                                              <span className={`px-2 py-1 rounded text-[10px] font-medium ${
                                                                actionStatus.status === 'completed' ? 'bg-green-900/50 text-green-300' :
                                                                actionStatus.status === 'in_progress' ? 'bg-blue-900/50 text-blue-300' :
                                                                actionStatus.status === 'failed' ? 'bg-red-900/50 text-red-300' :
                                                                'bg-gray-900/50 text-gray-400'
                                                              }`}>
                                                                {actionStatus.step}
                                                              </span>
                                                              <div className={`w-2 h-2 rounded-full ${
                                                                actionStatus.status === 'completed' ? 'bg-green-400' :
                                                                actionStatus.status === 'in_progress' ? 'bg-blue-400 animate-pulse' :
                                                                actionStatus.status === 'failed' ? 'bg-red-400' :
                                                                'bg-gray-500'
                                                              }`} />
                                                            </div>
                                                          ) : (
                                                            <span className="px-2 py-1 rounded text-[10px] bg-gray-900/50 text-gray-500">
                                                              pending
                                                            </span>
                                                          )}
                                                          <a 
                                                            href={`/action/${id}/${submissionId}/${index}/${i}?actorName=${encodeURIComponent(actor.name)}&actionName=${encodeURIComponent(action.name)}&contractName=${encodeURIComponent(action.contract_name)}&functionName=${encodeURIComponent(action.function_name)}&actorSummary=${encodeURIComponent(actor.summary)}&actionSummary=${encodeURIComponent(action.summary)}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs bg-gray-600 hover:bg-gray-500 border border-gray-500 px-2 py-1 rounded text-gray-200 cursor-pointer inline-flex items-center gap-1"
                                                          >
                                                            <ExternalLink className="h-3 w-3" />
                                                            View Details
                                                          </a>
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
                                                              </TabsList>
                                                              
                                                              <TabsContent value="summary" className="mt-0">
                                                                {submissionId ? (
                                                                  <ActionSummaryTab 
                                                                    submissionId={submissionId}
                                                                    contractName={action.contract_name}
                                                                    functionName={action.function_name}
                                                                    action={action}
                                                                    actor={actor}
                                                                  />
                                                                ) : (
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
                                                                )}
                                                              </TabsContent>
                                                              
                                                              <TabsContent value="code" className="mt-0">
                                                                {submissionId ? (
                                                                  <ActionCodeTab 
                                                                    submissionId={submissionId}
                                                                    contractName={action.contract_name}
                                                                    functionName={action.function_name}
                                                                    action={action}
                                                                    sectionContext={`implementation-${index}-${i}`}
                                                                  />
                                                                ) : (
                                                                  <div className="bg-black/40 p-3 rounded text-xs text-gray-400">
                                                                    Loading submission data...
                                                                  </div>
                                                                )}
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
                                                              </TabsList>
                                                              
                                                              <TabsContent value="summary" className="mt-0">
                                                                {submissionId ? (
                                                                  <ValidationRulesTab 
                                                                    submissionId={submissionId}
                                                                    contractName={action.contract_name}
                                                                    functionName={action.function_name}
                                                                    action={action}
                                                                    actor={actor}
                                                                  />
                                                                ) : (
                                                                  <div className="bg-black/40 p-3 rounded text-xs">
                                                                    <ul className="list-disc pl-5 text-yellow-400 space-y-1">
                                                                      <li>All required parameters must be provided and valid</li>
                                                                      <li>Actor must have appropriate permissions/role</li>
                                                                      <li>Actor must have sufficient balance if operations involve transfers</li>
                                                                      <li>Contract state must allow this operation</li>
                                                                      <li>Gas estimation must be within reasonable limits</li>
                                                                    </ul>
                                                                  </div>
                                                                )}
                                                              </TabsContent>
                                                              
                                                              <TabsContent value="code" className="mt-0">
                                                                {submissionId ? (
                                                                  <ActionCodeTab 
                                                                    submissionId={submissionId}
                                                                    contractName={action.contract_name}
                                                                    functionName={action.function_name}
                                                                    action={action}
                                                                    sectionContext={`validation-${index}-${i}`}
                                                                  />
                                                                ) : (
                                                                  <div className="bg-black/40 p-3 rounded text-xs text-gray-400">
                                                                    Loading submission data...
                                                                  </div>
                                                                )}
                                                              </TabsContent>
                                                              

                                                            </Tabs>
                                                          </div>
                                                        </div>
                                                      </CollapsibleContent>
                                                    </Collapsible>
                                                    );
                                                  })}
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
                                    
                                    {/* Code Viewer with Commit History */}
                                    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                                      <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-lg font-medium text-blue-400">Simulation Code</h4>
                                        <Badge variant="outline" className="bg-blue-950/50 text-blue-300">
                                          Latest Commit History
                                        </Badge>
                                      </div>
                                      <div className="w-full overflow-hidden h-[500px]">
                                        {/* Get simulation repository from API */}
                                        {simRepo ? (
                                          <GitHubCodeViewer 
                                            owner={simRepo.owner}
                                            repo={simRepo.repo}
                                            branch={simRepo.branch}
                                            path=""
                                            showBreadcrumb={true}
                                            showCommits={true}
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
                                              <Collapsible key={index} className="bg-gray-800 rounded-md" open={index === 0}>
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
                                                      <Collapsible key={i} open={i === 0}>
                                                        <CollapsibleTrigger className="flex items-center gap-2 text-gray-300 p-2 bg-gray-700/50 rounded w-full justify-between hover:bg-gray-600/50">
                                                          <div className="flex items-center gap-2">
                                                            <ChevronRight className="h-4 w-4 transform transition-transform group-data-[state=open]:rotate-90" />
                                                            <span>{action.name}</span>
                                                          </div>
                                                          <div className="flex items-center gap-2">
                                                            <span className="text-xs bg-blue-900 px-2 py-1 rounded-full text-blue-200">
                                                              {action.contract_name}
                                                            </span>
                                                            <span className="text-xs px-3 py-1 border border-gray-600 rounded text-gray-300 bg-gray-800/50">
                                                              Modify
                                                            </span>
                                                          </div>
                                                        </CollapsibleTrigger>
                                                        <CollapsibleContent className="p-3 mt-2 bg-gray-700/30 rounded-md">
                                                          {console.log('CollapsibleContent is rendering for action:', action.name)}
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
                                                                  {console.log('DEBUG: Rendering Summary tab with submissionId:', submissionId, 'Expected:', 'b2467fc4-e77a-4529-bcea-09c31cb2e8fe')}
                                                                  {console.log('DEBUG: Contract/Function:', { contractName: action.contract_name, functionName: action.function_name })}
                                                                  {submissionId ? (
                                                                    <ActionSummaryTab 
                                                                      submissionId={submissionId}
                                                                      contractName={action.contract_name}
                                                                      functionName={action.function_name}
                                                                      action={action}
                                                                      actor={actor}
                                                                    />
                                                                  ) : (
                                                                    <div className="bg-black/40 p-3 rounded text-xs text-gray-400">
                                                                      Loading submission data...
                                                                    </div>
                                                                  )}
                                                                </TabsContent>
                                                                
                                                                <TabsContent value="code" className="mt-0">
                                                                  {submissionId ? (
                                                                    <ActionCodeTab 
                                                                      submissionId={submissionId}
                                                                      contractName={action.contract_name}
                                                                      functionName={action.function_name}
                                                                      action={action}
                                                                      sectionContext="validation-rules"
                                                                    />
                                                                  ) : (
                                                                    <div className="bg-black/40 p-3 rounded text-xs text-gray-400">
                                                                      Loading submission data...
                                                                    </div>
                                                                  )}
                                                                </TabsContent>
                                                                
                                                                <TabsContent value="preview" className="mt-0">
                                                                  <div className="bg-black/40 p-3 rounded text-xs">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                      <div className="text-gray-300 text-xs">Modified implementation code:</div>
                                                                      <div className="flex gap-2">
                                                                        <button className="h-6 text-xs px-3 py-1 border border-gray-600 rounded text-gray-300 hover:bg-gray-700">
                                                                          Reject Changes
                                                                        </button>
                                                                        <button className="h-6 text-xs px-3 py-1 bg-blue-600 rounded text-white hover:bg-blue-700">
                                                                          Accept Changes
                                                                        </button>
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
                                                                  setOpenChats(prev => ({ 
                                                                    ...prev, 
                                                                    [`implementation-${actor.id}-${action.id}`]: true 
                                                                  }));
                                                                }}
                                                              >
                                                                <MessageSquare className="h-3.5 w-3.5 mr-1" />
                                                                Modify Implementation
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
                                                                  {submissionId ? (
                                                                    <ValidationRulesTab 
                                                                      submissionId={submissionId}
                                                                      contractName={action.contract_name}
                                                                      functionName={action.function_name}
                                                                      action={action}
                                                                      actor={actor}
                                                                    />
                                                                  ) : (
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
                                                                  )}
                                                                </TabsContent>
                                                                
                                                                <TabsContent value="code" className="mt-0">
                                                                  {submissionId ? (
                                                                    <ActionCodeTab 
                                                                      submissionId={submissionId}
                                                                      contractName={action.contract_name}
                                                                      functionName={action.function_name}
                                                                      action={action}
                                                                      sectionContext="action-summary"
                                                                    />
                                                                  ) : (
                                                                    <div className="bg-black/40 p-3 rounded text-xs text-gray-400">
                                                                      Loading submission data...
                                                                    </div>
                                                                  )}
                                                                </TabsContent>
                                                                
                                                                <TabsContent value="preview" className="mt-0">
                                                                  <div className="bg-black/40 p-3 rounded text-xs">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                      <div className="text-gray-300 text-xs">Modified validation code:</div>
                                                                      <div className="flex gap-2">
                                                                        <button className="h-6 text-xs px-3 py-1 border border-gray-600 rounded text-gray-300 hover:bg-gray-700">
                                                                          Reject Changes
                                                                        </button>
                                                                        <button className="h-6 text-xs px-3 py-1 bg-blue-600 rounded text-white hover:bg-blue-700">
                                                                          Accept Changes
                                                                        </button>
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
                                                                  setOpenChats(prev => ({ 
                                                                    ...prev, 
                                                                    [`validation-${actor.id}-${action.id}`]: true 
                                                                  }));
                                                                }}
                                                              >
                                                                <MessageSquare className="h-3.5 w-3.5 mr-1" />
                                                                Modify Validation Rules
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
                          submissionId={submissionId}
                        />
                      
                      ) : currentStep.id === "history" ? (
                        <div className="py-4">
                          <h3 className="text-lg font-medium text-blue-400 mb-2">Submission History</h3>
                          <p className="text-sm text-gray-400 mb-4">View detailed history of this submission's analysis process</p>
                          
                          {submissionId || id ? (
                            <HistoryComponent submissionId={submissionId || id?.toString() || ""} />
                          ) : (
                            <div className="text-center py-10 border border-gray-600 rounded">
                              <div className="mx-auto h-12 w-12 text-gray-400 mb-2">📋</div>
                              <h3 className="text-lg font-medium text-gray-300">ID Not Available</h3>
                              <p className="text-sm text-gray-500">Cannot fetch history without a project or submission ID.</p>
                            </div>
                          )}
                        </div>
                      
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
                                    // Return empty actors data when no authentic data is available
                                    actorsData = { actors: [] };
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
      
      {/* Profile Completion Component */}
      {user && (
        <div className="fixed bottom-4 right-4 z-40 max-w-md">
          <ProfileCompletion 
            user={user} 
            onComplete={() => {
              // Refresh user data after profile completion
              window.location.reload();
            }}
            onDismiss={() => {
              // User can dismiss the component if they don't want to complete now
            }}
          />
        </div>
      )}
      
      {/* Add context-aware AI Chat Assistant */}
      <ChatAssistant projectId={id} currentSection={selectedStep} submissionId={submissionId} analysisData={analysis} />
    </div>
  );
}