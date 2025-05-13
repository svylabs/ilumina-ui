import { useState, useEffect, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import {
  ChevronsRight,
  ArrowRightCircle,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Clipboard,
  Check,
  Loader2,
  Zap
} from "lucide-react";
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
import ChatAssistant from "@/components/chat-assistant";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

// Simulation run type definition
type SimulationRun = {
  id: string;
  status: "success" | "error" | "running";
  date: string;
  logUrl: string | null;
  branch?: string;
  description?: string;
  type?: string;
  num_simulations?: number;
  is_batch_parent?: boolean;
  batch_id?: string | null;
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
  const [simulationMessage, setSimulationMessage] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState("main");
  const [simulationDescription, setSimulationDescription] = useState("");
  const [numSimulations, setNumSimulations] = useState(1);
  const [availableBranches, setAvailableBranches] = useState<{name: string; isDefault?: boolean}[]>([]);
  const [simStatus, setSimStatus] = useState<{
    canRun: boolean;
    earlyAccess: boolean;
    limitReached?: boolean;
    message?: string;
  } | null>(null);
  const [showUpgradeMessage, setShowUpgradeMessage] = useState(false);
  
  // Batch simulations display state
  const [viewingBatchId, setViewingBatchId] = useState<string | null>(null);
  const [batchRuns, setBatchRuns] = useState<SimulationRun[]>([]);
  const [isLoadingBatchRuns, setIsLoadingBatchRuns] = useState(false);
  const [batchTitle, setBatchTitle] = useState("");
  
  // Show upgrade message for limited simulations if applicable
  useEffect(() => {
    if (simStatus?.limitReached) {
      setShowUpgradeMessage(true);
    }
  }, [simStatus]);
  
  // Fetch simulation list
  useEffect(() => {
    if (!submissionId) return;
    
    // First API call to get simulation status
    async function fetchSimulationStatus() {
      try {
        const response = await fetch(`/api/submission/${submissionId}/simulation/status`, {
          credentials: "include"
        });
        if (response.ok) {
          const data = await response.json();
          setSimStatus({
            canRun: data.can_run || false,
            earlyAccess: data.early_access || false,
            limitReached: data.limit_reached || false,
            message: data.message || ""
          });
        }
      } catch (error) {
        console.error("Error fetching simulation status:", error);
      }
    }
    
    // Second API call to get available branches
    async function fetchBranches() {
      try {
        const response = await fetch(`/api/submission/${submissionId}/branches`, {
          credentials: "include"
        });
        if (response.ok) {
          const data = await response.json();
          setAvailableBranches(data.branches || []);
          
          // Select default branch automatically
          const defaultBranch = data.branches.find((b: any) => b.isDefault);
          if (defaultBranch) {
            setSelectedBranch(defaultBranch.name);
          } else if (data.branches.length > 0) {
            setSelectedBranch(data.branches[0].name);
          }
        }
      } catch (error) {
        console.error("Error fetching branches:", error);
      }
    }
    
    // Helper function to parse simulation runs
    function parseSimulationRuns(runsData: any[]): SimulationRun[] {
      if (!runsData || !Array.isArray(runsData)) {
        console.error("Invalid runs data:", runsData);
        return [];
      }
      
      return runsData.map(run => {
        if (run.simulation_id || run.run_id || run.id) {
          // Log the raw run data to debug
          console.log("Processing run data:", run);
          
          const status = run.status === "SUCCESS" ? "success" : 
                         run.status === "success" ? "success" :
                         run.status === "FAILURE" ? "error" : 
                         run.status === "failure" ? "error" :
                         run.status === "error" ? "error" :
                         run.status === "scheduled" ? "running" :
                         run.status === "SCHEDULED" ? "running" :
                         run.status?.toLowerCase() || "error";
          
          return {
            id: run.simulation_id || run.run_id || run.id,
            status: status as 'success' | 'error' | 'running',
            date: run.created_at || run.date || new Date().toISOString(),
            logUrl: run.log_url || run.logUrl || null,
            branch: run.branch || selectedBranch,
            description: run.description || "",
            type: run.type || "simulation",
            num_simulations: run.num_simulations || 1,
            is_batch_parent: !!run.is_batch_parent,
            batch_id: run.batch_id || null,
            summary: run.summary || null,
            log: run.log || null,
            return_code: run.return_code || null,
            stderr: run.stderr || null,
            stdout: run.stdout || null
          };
        }
        return null;
      }).filter(Boolean);
    }
    
    // Third API call to get simulation runs
    async function fetchSimulationRuns() {
      try {
        if (viewingBatchId) {
          // Fetch batch runs
          setIsLoadingBatchRuns(true);
          const response = await fetch(`/api/submission/${submissionId}/simulations/batch/${viewingBatchId}/list`, {
            credentials: "include"
          });
          if (response.ok) {
            const data = await response.json();
            console.log("Batch runs data:", data);
            
            // Get the batch title from the parent run
            if (data.parent) {
              setBatchTitle(data.parent.description || `Batch ${viewingBatchId}`);
            }
            
            // Process batch simulation runs
            if (data.runs && Array.isArray(data.runs)) {
              const parsedRuns = parseSimulationRuns(data.runs);
              console.log("Parsed batch runs:", parsedRuns);
              setBatchRuns(parsedRuns);
            }
          }
          setIsLoadingBatchRuns(false);
        } else {
          // Fetch all simulation runs
          const response = await fetch(`/api/submission/${submissionId}/simulations/list`, {
            credentials: "include"
          });
          if (response.ok) {
            const data = await response.json();
            console.log("Simulation runs data:", data);
            
            // Process simulation runs
            if (data.runs && Array.isArray(data.runs)) {
              const parsedRuns = parseSimulationRuns(data.runs);
              console.log("Parsed runs:", parsedRuns);
              setSimulationRuns(parsedRuns);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching simulation runs:", error);
      }
    }
    
    // Call all the API functions
    fetchSimulationStatus();
    fetchBranches();
    fetchSimulationRuns();
    
  }, [submissionId, viewingBatchId, selectedBranch]);
  
  // Function to view batch runs
  const viewBatchRuns = (run: SimulationRun) => {
    if (run.is_batch_parent && run.batch_id) {
      setViewingBatchId(run.batch_id);
    }
  };
  
  // Function to go back to all simulations
  const backToAllSimulations = () => {
    setViewingBatchId(null);
    setBatchRuns([]);
    setBatchTitle("");
  };
  
  // Function to start a simulation
  const { toast } = useToast();
  
  const startSimulation = async () => {
    if (!submissionId || isRunningSimulation || !simStatus?.canRun) return;
    
    setIsRunningSimulation(true);
    
    try {
      const payload = {
        branch: selectedBranch,
        description: simulationDescription || `Simulation on ${selectedBranch}`,
        num_simulations: numSimulations
      };
      
      console.log("Starting simulation with payload:", payload);
      
      const response = await fetch(`/api/submission/${submissionId}/simulation/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        credentials: "include"
      });
      
      if (!response.ok) {
        throw new Error(`Failed to start simulation: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Simulation started:", data);
      
      if (data.run_id) {
        setSimulationMessage(`Simulation started successfully. Run ID: ${data.run_id}`);
        
        // Fetch updated simulation runs after a short delay
        setTimeout(() => {
          setIsRunningSimulation(false);
        }, 2000);
      } else {
        setSimulationMessage("Simulation request was accepted.");
        setIsRunningSimulation(false);
      }
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
        
        {(!deploymentVerified && !simStatus?.earlyAccess) && (
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-md mb-4 text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
              <span className="font-semibold text-yellow-300">Complete Deployment Verification</span>
            </div>
            <p className="text-gray-300 mt-1">
              Complete the deployment verification step to enable full simulation functionality.
            </p>
          </div>
        )}
        
        <div className="bg-gray-900 p-4 rounded-md">
          <h3 className="text-lg font-medium mb-4">Run New Simulation</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Branch</label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                disabled={isRunningSimulation || !simStatus?.canRun}
                className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableBranches.map(branch => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name} {branch.isDefault ? "(default)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Description (optional)</label>
              <input
                type="text"
                value={simulationDescription}
                onChange={(e) => setSimulationDescription(e.target.value)}
                disabled={isRunningSimulation || !simStatus?.canRun}
                placeholder="Enter description for this simulation run"
                className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between bg-gray-800 p-3 rounded-md">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Number of Simulations</label>
              <div className="flex items-center">
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={numSimulations}
                  onChange={(e) => setNumSimulations(Math.max(1, Math.min(10, Number(e.target.value))))}
                  disabled={isRunningSimulation || !simStatus?.canRun}
                  className="w-20 bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="ml-3 text-xs text-gray-400">
                  {numSimulations > 1 ? `Creates a batch of ${numSimulations} simulations with random inputs` : "Single simulation run"}
                </div>
              </div>
              <div className="flex items-center mt-3">
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
        
        {/* Batch navigation if viewing batch */}
        {viewingBatchId && (
          <div className="mb-4">
            <button 
              onClick={backToAllSimulations}
              className="flex items-center text-blue-400 hover:text-blue-300 text-sm"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to all simulations
            </button>
            <h3 className="text-lg font-medium text-white mt-2">{batchTitle || `Batch Simulations (${viewingBatchId})`}</h3>
          </div>
        )}
        
        {/* Simulations List */}
        {(viewingBatchId ? batchRuns : simulationRuns).length > 0 ? (
          <div className="bg-gray-900 rounded-md">
            <div className="border-b border-gray-800 p-4">
              <div className="hidden md:grid md:grid-cols-12 text-sm text-gray-400 font-medium">
                <div className="col-span-1">#</div>
                <div className="col-span-3">Run ID</div>
                <div className="col-span-3">Status</div>
                <div className="col-span-3">Date</div>
                <div className="col-span-2">Actions</div>
              </div>
            </div>
            <div className="divide-y divide-gray-800">
              {(viewingBatchId ? batchRuns : simulationRuns).map((run, index) => (
                <SimulationRunItem 
                  key={run.id} 
                  run={run} 
                  index={index + 1} 
                  viewBatchRuns={viewBatchRuns} 
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center p-8 bg-gray-900 rounded-md border border-gray-800">
            {isLoadingBatchRuns ? (
              <div className="flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-2" />
                <p className="text-gray-400">Loading batch simulations...</p>
              </div>
            ) : viewingBatchId ? (
              <p className="text-gray-400">No batch simulations found.</p>
            ) : (
              <p className="text-gray-400">No simulations have been run yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper component to render simulation items
function SimulationRunItem({ 
  run, 
  index, 
  viewBatchRuns 
}: { 
  run: SimulationRun, 
  index: number, 
  viewBatchRuns?: (run: SimulationRun) => void 
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();
  
  const handleCopyLog = () => {
    if (run.log) {
      navigator.clipboard.writeText(run.log);
      toast({
        title: "Copied",
        description: "Log content copied to clipboard"
      });
    }
  };
  
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (e) {
      return dateString;
    }
  };
  
  return (
    <div className="p-4">
      <div className="grid md:grid-cols-12 gap-2 md:gap-0 items-center">
        <div className="col-span-1 text-gray-500">{index}</div>
        
        <div className="col-span-3 md:truncate">
          <div className="flex items-center">
            {run.is_batch_parent && (
              <Badge variant="secondary" className="mr-2">BATCH</Badge>
            )}
            <span className="font-mono text-sm text-gray-300">{run.id.substring(0, 8)}</span>
          </div>
          {run.description && (
            <div className="text-xs text-gray-500 mt-1">{run.description}</div>
          )}
        </div>
        
        <div className="col-span-3">
          {run.status === 'success' ? (
            <div className="flex items-center text-green-400">
              <CheckCircle className="h-4 w-4 mr-1" />
              <span>Success</span>
            </div>
          ) : run.status === 'error' ? (
            <div className="flex items-center text-red-400">
              <XCircle className="h-4 w-4 mr-1" />
              <span>Failed</span>
            </div>
          ) : (
            <div className="flex items-center text-blue-400">
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse mr-2"></div>
              <span>Running</span>
            </div>
          )}
        </div>
        
        <div className="col-span-3 text-gray-400 text-sm">
          {formatDate(run.date)}
        </div>
        
        <div className="col-span-2 flex items-center space-x-2">
          {run.is_batch_parent && viewBatchRuns && (
            <button 
              onClick={() => viewBatchRuns(run)}
              className="text-blue-400 hover:text-blue-300 p-1 rounded-md"
              title="View batch runs"
            >
              <Layers className="h-4 w-4" />
            </button>
          )}
          
          {run.logUrl && (
            <a 
              href={run.logUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 p-1 rounded-md"
              title="View log"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-gray-300 p-1 rounded-md"
            title="Toggle details"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="mt-4 text-sm bg-gray-800 p-4 rounded-md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <h4 className="text-gray-400 font-medium mb-2">Details</h4>
              <div className="space-y-1">
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-gray-500">ID:</span>
                  <span className="text-gray-300 col-span-2 font-mono">{run.id}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-gray-500">Status:</span>
                  <span className="text-gray-300 col-span-2">{run.status}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-gray-500">Date:</span>
                  <span className="text-gray-300 col-span-2">{run.date}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-gray-500">Branch:</span>
                  <span className="text-gray-300 col-span-2">{run.branch || 'main'}</span>
                </div>
                {run.is_batch_parent && (
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-gray-500">Batch:</span>
                    <span className="text-gray-300 col-span-2">Yes ({run.num_simulations} simulations)</span>
                  </div>
                )}
              </div>
            </div>
            
            {run.summary && (
              <div>
                <h4 className="text-gray-400 font-medium mb-2">Summary</h4>
                <div className="space-y-1">
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-gray-500">Total Tests:</span>
                    <span className="text-gray-300 col-span-2">{run.summary.totalTests}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-gray-500">Passed:</span>
                    <span className="text-green-400 col-span-2">{run.summary.passed}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-gray-500">Failed:</span>
                    <span className={`${run.summary.failed > 0 ? 'text-red-400' : 'text-gray-300'} col-span-2`}>
                      {run.summary.failed}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {run.log && (
            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-gray-400 font-medium mb-2">Log</h4>
                <button 
                  onClick={handleCopyLog}
                  className="text-blue-400 hover:text-blue-300 text-xs flex items-center"
                >
                  <Clipboard className="h-3 w-3 mr-1" />
                  Copy
                </button>
              </div>
              <pre className="bg-gray-900 p-4 rounded-md text-xs text-gray-300 overflow-x-auto max-h-96 overflow-y-auto">
                {run.log}
              </pre>
            </div>
          )}
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

function isDeploymentVerificationCompleted(completedSteps?: CompletedStep[]): boolean {
  return !!completedSteps?.some(step => step.step === "verify_deployment_script");
}

function StepStatus({ status, startTime }: { status: StepStatus; startTime?: string | null }) {
  if (status === "completed") {
    return (
      <div className="flex items-center text-green-500">
        <CheckCircle className="h-5 w-5 mr-1" />
        <span>Completed</span>
      </div>
    );
  }
  
  if (status === "in_progress") {
    return (
      <div className="flex items-center text-blue-500">
        <div className="w-4 h-4 rounded-full bg-blue-500 animate-pulse mr-2"></div>
        <span>In progress</span>
        {startTime && (
          <span className="ml-2 text-xs text-gray-500">
            (started {new Date(startTime).toLocaleTimeString()})
          </span>
        )}
      </div>
    );
  }
  
  if (status === "failed") {
    return (
      <div className="flex items-center text-red-500">
        <XCircle className="h-5 w-5 mr-1" />
        <span>Failed</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center text-gray-500">
      <Clock className="h-5 w-5 mr-1" />
      <span>Pending</span>
    </div>
  );
}

function DeploymentInstructionsSection({ submissionId, analysis }: { submissionId: string; analysis: AnalysisResponse }) {
  const [selectedTab, setSelectedTab] = useState<'instructions' | 'script' | 'verification'>('instructions');
  const [deploymentData, setDeploymentData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    async function fetchDeploymentData() {
      setIsLoading(true);
      try {
        const response = await apiRequest("GET", `/api/submission/${submissionId}/deployment_instructions`);
        if (response.ok) {
          const data = await response.json();
          setDeploymentData(data);
        } else {
          console.error("Failed to fetch deployment data");
        }
      } catch (error) {
        console.error("Error fetching deployment data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchDeploymentData();
  }, [submissionId]);
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
          <span className="text-gray-500">Loading deployment instructions...</span>
        </div>
      </div>
    );
  }
  
  const instructions = deploymentData?.deployment_instructions?.steps || [];
  const deploymentScript = deploymentData?.deployment_script?.content || "";
  const verificationLog = deploymentData?.verification_log?.content || "";
  
  return (
    <div className="bg-gray-900 rounded-lg">
      <div className="border-b border-gray-800 px-4">
        <div className="flex">
          <button
            onClick={() => setSelectedTab('instructions')}
            className={`py-3 px-4 text-sm font-medium border-b-2 ${
              selectedTab === 'instructions' 
                ? 'text-blue-400 border-blue-400' 
                : 'text-gray-400 border-transparent hover:text-gray-300'
            }`}
          >
            Instructions
          </button>
          <button
            onClick={() => setSelectedTab('script')}
            className={`py-3 px-4 text-sm font-medium border-b-2 ${
              selectedTab === 'script' 
                ? 'text-blue-400 border-blue-400' 
                : 'text-gray-400 border-transparent hover:text-gray-300'
            }`}
          >
            Deployment Script
          </button>
          <button
            onClick={() => setSelectedTab('verification')}
            className={`py-3 px-4 text-sm font-medium border-b-2 ${
              selectedTab === 'verification' 
                ? 'text-blue-400 border-blue-400' 
                : 'text-gray-400 border-transparent hover:text-gray-300'
            }`}
          >
            Verification
          </button>
        </div>
      </div>
      
      <div className="p-4">
        {selectedTab === 'instructions' && (
          <div>
            <h3 className="text-lg font-medium text-white mb-4">Deployment Instructions</h3>
            {instructions.length > 0 ? (
              <ol className="list-decimal list-inside space-y-4 text-gray-300">
                {instructions.map((instruction: any, index: number) => (
                  <li key={index} className="ml-4">
                    <div dangerouslySetInnerHTML={{ __html: instruction }} />
                  </li>
                ))}
              </ol>
            ) : (
              <div className="text-gray-400 py-4">No deployment instructions available.</div>
            )}
          </div>
        )}
        
        {selectedTab === 'script' && (
          <div>
            <h3 className="text-lg font-medium text-white mb-4">Deployment Script</h3>
            {deploymentScript ? (
              <pre className="bg-gray-800 p-4 rounded-md text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap">
                {deploymentScript}
              </pre>
            ) : (
              <div className="text-gray-400 py-4">No deployment script available.</div>
            )}
          </div>
        )}
        
        {selectedTab === 'verification' && (
          <div>
            <h3 className="text-lg font-medium text-white mb-4">Verification Results</h3>
            {verificationLog ? (
              <pre className="bg-gray-800 p-4 rounded-md text-sm text-gray-300 overflow-x-auto max-h-96 overflow-y-auto">
                {verificationLog}
              </pre>
            ) : (
              <div className="text-gray-400 py-4">No verification results available.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Main Analysis Page Component
export default function AnalysisPage() {
  const [location] = useLocation();
  const { id: submissionId } = useParams();
  const { toast } = useToast();
  
  // State for analysis data
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [analysisSteps, setAnalysisSteps] = useState<AnalysisStep[]>([
    {
      id: "analyze_project",
      title: "Analyze Project",
      description: "Analyzing repository structure and smart contracts",
      status: "pending",
    },
    {
      id: "analyze_actors",
      title: "Analyze Actors",
      description: "Identifying key actors and their interactions",
      status: "pending",
    },
    {
      id: "deployment",
      title: "Deployment Instructions",
      description: "Generating deployment guide and verification process",
      status: "pending",
    },
    {
      id: "test_setup",
      title: "Simulation Setup",
      description: "Setting up simulation environment",
      status: "pending",
    },
    {
      id: "simulations",
      title: "Run Simulation",
      description: "Run simulations to test contract behavior",
      status: "pending",
    },
  ]);

  // Fetch analysis status
  const { data: analysis, error, isLoading, refetch } = useQuery<AnalysisResponse>({ 
    queryKey: [`/api/submission/${submissionId}/analysis`],
    queryFn: async ({ queryKey }) => {
      try {
        const response = await fetch(queryKey[0] as string, {
          credentials: "include",
        });
        
        if (response.status === 401) {
          return null;
        }
        
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error("Error fetching analysis:", error);
        throw error;
      }
    },
    refetchInterval: 5000,  // Poll every 5 seconds
    retry: 3
  });
  
  useEffect(() => {
    if (error) {
      console.error("Error fetching analysis:", error);
      toast({
        title: "Error",
        description: "Failed to load analysis. Please try refreshing the page.",
        variant: "destructive"
      });
    }
  }, [error, toast]);
  
  // Update step status when analysis data changes
  useEffect(() => {
    if (analysis) {
      const updatedSteps = [...analysisSteps];
      
      // Function to help determine the correct status
      const getStepStatus = (stepId: string): StepStatus => {
        // Special handling for simulations - show as completed after verify_deployment_script
        if (stepId === "simulations" && isDeploymentVerificationCompleted(analysis.completedSteps)) {
          return "completed";
        }
        
        // Map server step IDs to our step IDs
        const mappedStepId = {
          "analyze_project": "files",
          "analyze_actors": "actors",
          "deployment": "deployment", 
          "test_setup": "test_setup",
          "simulations": "simulations"
        }[stepId] || stepId;
        
        // Get status from server data if available
        if (analysis.steps && analysis.steps[mappedStepId]) {
          return analysis.steps[mappedStepId].status;
        }
        
        // Check if step is in completed steps
        if (analysis.completedSteps?.some(step => {
          if (stepId === "deployment") {
            return step.step === "analyze_deployment" || 
                   step.step === "implement_deployment_script" || 
                   step.step === "verify_deployment_script";
          }
          return step.step === stepId || step.step === mappedStepId;
        })) {
          return "completed";
        }
        
        return "pending";
      };
      
      // Update each step's status
      for (let i = 0; i < updatedSteps.length; i++) {
        const step = updatedSteps[i];
        const status = getStepStatus(step.id);
        const mappedStepId = {
          "analyze_project": "files", 
          "analyze_actors": "actors",
          "deployment": "deployment", 
          "test_setup": "test_setup",
          "simulations": "simulations"
        }[step.id] || step.id;
        
        step.status = status;
        
        // Add start time if available
        if (analysis.steps && analysis.steps[mappedStepId]) {
          step.startTime = analysis.steps[mappedStepId].startTime;
          step.details = analysis.steps[mappedStepId].details;
        }
        
        // Auto-select first pending or in-progress step
        if ((status === "pending" || status === "in_progress") && currentStepIndex < i) {
          setCurrentStepIndex(i);
          break;
        }
      }
      
      setAnalysisSteps(updatedSteps);
    }
  }, [analysis, analysisSteps, currentStepIndex]);
  
  const currentStep = analysisSteps[currentStepIndex];
  
  // Helper function to get details for a specific step
  const getStepDetails = (stepId: string): string | null => {
    if (!analysis || !analysis.steps) return null;
    
    // Map front-end step IDs to back-end step IDs
    const mappedStepId = {
      "analyze_project": "files",
      "analyze_actors": "actors", 
      "deployment": "deployment",
      "test_setup": "test_setup",
      "simulations": "simulations"
    }[stepId] || stepId;
    
    return analysis.steps[mappedStepId]?.details || null;
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
          <span className="text-xl text-gray-400">Loading analysis...</span>
        </div>
      </div>
    );
  }
  
  if (!submissionId || !analysis) {
    return (
      <div className="p-8 bg-gray-950 text-white min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-900/30 border border-red-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Error Loading Analysis</h2>
            <p className="text-gray-300">Could not load analysis data. Please make sure the URL is correct and try again.</p>
            <Link href="/" className="mt-4 inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white">
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  const isVerificationCompleted = isDeploymentVerificationCompleted(analysis.completedSteps);
  
  return (
    <div className="p-6 md:p-8 bg-gray-950 text-white min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Smart Contract Analysis</h1>
            <p className="text-gray-400 mt-1">Submission ID: {submissionId}</p>
          </div>
          <Link href="/projects" className="mt-4 md:mt-0 text-blue-400 hover:text-blue-300 flex items-center">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Projects
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left sidebar with steps */}
          <div className="md:col-span-3">
            <div className="bg-gray-900 rounded-lg p-4">
              <h2 className="font-semibold text-lg mb-4">Analysis Steps</h2>
              <ol className="space-y-3">
                {analysisSteps.map((step, index) => (
                  <li key={step.id}>
                    <button
                      onClick={() => setCurrentStepIndex(index)}
                      className={`w-full text-left p-3 rounded-md flex items-start ${
                        currentStepIndex === index 
                          ? 'bg-blue-900/30 border border-blue-700' 
                          : 'hover:bg-gray-800'
                      }`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {step.status === 'completed' ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : step.status === 'in_progress' ? (
                          <div className="w-5 h-5 rounded-full bg-blue-500 animate-pulse"></div>
                        ) : step.status === 'failed' ? (
                          <XCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <Circle className="h-5 w-5 text-gray-500" />
                        )}
                      </div>
                      <div className="ml-3">
                        <div className={`font-medium ${
                          step.status === 'completed' ? 'text-green-400' :
                          step.status === 'in_progress' ? 'text-blue-400' :
                          step.status === 'failed' ? 'text-red-400' :
                          'text-gray-300'
                        }`}>
                          {step.title}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{step.description}</div>
                      </div>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          
          {/* Main content area */}
          <div className="md:col-span-9">
            <div className="bg-gray-900 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">{currentStep.title}</h2>
                <StepStatus status={currentStep.status} startTime={currentStep.startTime} />
              </div>
              
              <div className="space-y-6">
                {/* Render different content based on step ID */}
                {currentStep.id === "analyze_project" && (
                  <div className="prose prose-invert max-w-none">
                    <h3>Project Analysis</h3>
                    <p>This step analyzes the project's smart contracts, identifying key components, dependencies, and functionality.</p>
                    
                    {currentStep.status === "completed" ? (
                      <div className="mt-4">
                        <h4>Analysis Results</h4>
                        {(() => {
                          try {
                            // Handle JSON data if available
                            if (analysis.steps.files?.jsonData?.project_summary) {
                              const projectSummary = analysis.steps.files.jsonData.project_summary;
                              return (
                                <div className="mt-2">
                                  <p className="mb-4">{projectSummary.summary}</p>
                                  <h5>Key Smart Contracts</h5>
                                  <ul>
                                    {projectSummary.contracts.map((contract: any, i: number) => (
                                      <li key={i} className="mb-3">
                                        <strong className="text-blue-300">{contract.name}</strong>
                                        <p className="text-sm mt-1">{contract.description}</p>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              );
                            }
                            // Fall back to text content
                            return (
                              <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                                {getStepDetails(currentStep.id) || currentStep.output || "No output available"}
                              </pre>
                            );
                          } catch (e) {
                            // Fallback for any formatting errors
                            return (
                              <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                                {getStepDetails(currentStep.id) || "No output available"}
                              </pre>
                            );
                          }
                        })()}
                      </div>
                    ) : currentStep.status === "failed" ? (
                      <div className="bg-red-900/30 border border-red-700 p-4 rounded-md mt-4">
                        <p className="text-red-400 font-medium">Analysis failed: {getStepDetails(currentStep.id) || "Unknown error occurred"}</p>
                      </div>
                    ) : (
                      <div className="mt-4">
                        <p className="text-gray-400">Analyzing project structure and smart contracts...</p>
                      </div>
                    )}
                  </div>
                )}
                
                {currentStep.id === "analyze_actors" && (
                  <div className="prose prose-invert max-w-none">
                    <h3>Actor Analysis</h3>
                    <p>This step identifies the key actors in your smart contracts and their interactions.</p>
                    
                    {currentStep.status === "completed" ? (
                      <div className="mt-4">
                        <h4>Identified Actors</h4>
                        {(() => {
                          try {
                            // Handle JSON data if available
                            if (analysis.steps.actors?.jsonData?.actors_summary) {
                              const actorsSummary = analysis.steps.actors.jsonData.actors_summary;
                              return (
                                <div className="mt-2">
                                  <p className="mb-4">{actorsSummary.summary}</p>
                                  <div className="space-y-4">
                                    {actorsSummary.actors.map((actor: any, i: number) => (
                                      <div key={i} className="bg-gray-800 p-4 rounded-md">
                                        <div className="flex items-center gap-2 mb-2">
                                          <UserCircle className="h-5 w-5 text-blue-400" />
                                          <h5 className="font-semibold text-blue-300 m-0">{actor.name}</h5>
                                        </div>
                                        <p className="text-sm">{actor.summary}</p>
                                        
                                        {actor.actions && actor.actions.length > 0 && (
                                          <div className="mt-3">
                                            <h6 className="text-sm font-medium text-gray-400 mb-2">Key Actions:</h6>
                                            <ul className="space-y-2">
                                              {actor.actions.map((action: any, j: number) => (
                                                <li key={j} className="bg-gray-900 p-3 rounded-md">
                                                  <div className="flex items-center gap-1 mb-1">
                                                    <span className="text-yellow-300 font-medium">{action.name}</span>
                                                  </div>
                                                  <div className="text-xs text-gray-500">
                                                    {action.contract_name}
                                                  </div>
                                                  <p className="text-sm text-gray-300 mt-1">{action.summary}</p>
                                                  <div className="flex gap-4 text-xs text-gray-400 mt-2">
                                                    <span>Function: <code className="text-cyan-300">{action.function_name}</code></span>
                                                    <span>Probability: <span className="text-green-300">{action.probability * 100}%</span></span>
                                                  </div>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            // Fall back to text content
                            return (
                              <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                                {getStepDetails(currentStep.id) || currentStep.output || "No output available"}
                              </pre>
                            );
                          } catch (e) {
                            // Fallback for any formatting errors
                            return (
                              <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                                {getStepDetails(currentStep.id) || "No output available"}
                              </pre>
                            );
                          }
                        })()}
                      </div>
                    ) : currentStep.status === "failed" ? (
                      <div className="bg-red-900/30 border border-red-700 p-4 rounded-md mt-4">
                        <p className="text-red-400 font-medium">Analysis failed: {getStepDetails(currentStep.id) || "Unknown error occurred"}</p>
                      </div>
                    ) : (
                      <div className="mt-4">
                        <p className="text-gray-400">Identifying actors and their interactions...</p>
                      </div>
                    )}
                  </div>
                )}
                
                {currentStep.id === "deployment" && (
                  <div>
                    <div className="prose prose-invert max-w-none mb-6">
                      <p>This step generates deployment instructions and scripts for your smart contracts.</p>
                    </div>
                    
                    {currentStep.status === "completed" ? (
                      <DeploymentInstructionsSection submissionId={submissionId} analysis={analysis} />
                    ) : currentStep.status === "failed" ? (
                      <div className="bg-red-900/30 border border-red-700 p-4 rounded-md">
                        <p className="text-red-400 font-medium">Deployment analysis failed: {getStepDetails(currentStep.id) || "Unknown error occurred"}</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8">
                        <div className="flex items-center mb-4">
                          <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
                          <span className="text-gray-300">Generating deployment instructions...</span>
                        </div>
                        <p className="text-sm text-gray-500 max-w-md text-center">
                          This may take several minutes as we analyze your contracts to generate secure deployment steps.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                {currentStep.id === "test_setup" && (
                  <div className="prose prose-invert max-w-none">
                    <h3>Simulation Setup</h3>
                    <p>This step configures the testing environment for running simulations on your smart contracts.</p>
                    
                    {currentStep.status === "completed" ? (
                      <div className="mt-4">
                        <div className="bg-green-900/30 border border-green-700 p-4 rounded-md">
                          <div className="flex items-center text-green-400 mb-2">
                            <CheckCircle className="h-5 w-5 mr-2" />
                            <span className="font-medium">Simulation environment ready</span>
                          </div>
                          <p className="text-gray-300 text-sm">
                            The simulation environment has been configured successfully. You can now run simulations to test your smart contracts.
                          </p>
                        </div>
                      </div>
                    ) : currentStep.status === "in_progress" ? (
                      <div className="mt-4">
                        <div className="bg-blue-900/30 border border-blue-700 p-4 rounded-md">
                          <div className="flex items-center text-blue-400 mb-2">
                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            <span className="font-medium">Setting up simulation environment</span>
                          </div>
                          <p className="text-gray-300 text-sm">
                            We're currently setting up the simulation environment for your smart contracts. This process may take a few minutes.
                          </p>
                        </div>
                      </div>
                    ) : currentStep.status === "failed" ? (
                      <div className="bg-red-900/30 border border-red-700 p-4 rounded-md mt-4">
                        <p className="text-red-400 font-medium">Setup failed: {getStepDetails(currentStep.id) || "Unknown error occurred"}</p>
                      </div>
                    ) : (
                      <div className="mt-4">
                        <p className="text-gray-400">Waiting for deployment verification to complete before setting up simulation environment...</p>
                      </div>
                    )}
                  </div>
                )}
                
                {currentStep.id === "simulations" && (
                  <div>
                    <SimulationsComponent 
                      analysis={analysis} 
                      deploymentVerified={isVerificationCompleted} 
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Add context-aware AI Chat Assistant - only for Pro and Teams users */}
      {analysis.steps?.files?.status === "completed" && (
        <div className="fixed bottom-6 right-6">
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg flex items-center"
            onClick={() => window.location.href = '/pricing'}
          >
            <MessageSquare className="h-6 w-6" />
          </button>
        </div>
      )}
      
      <ChatAssistant projectId={submissionId} currentSection={currentStep.id} submissionId={submissionId} />
    </div>
  );
}

// Missing Component
function Circle(props: any) {
  return <div className={`w-5 h-5 rounded-full border-2 border-gray-500 ${props.className || ''}`} />;
}

// Missing Component
function Layers(props: any) {
  return <div className={`w-4 h-4 ${props.className || ''}`}>📑</div>;
}

// Missing Component
function ChevronLeft(props: any) {
  return <ChevronRight className={`rotate-180 ${props.className || ''}`} />;
}

// Missing Component
function MessageSquare(props: any) {
  return <div className={`w-6 h-6 ${props.className || ''}`}>💬</div>;
}

// Missing Component
function UserCircle(props: any) {
  return <div className={`w-5 h-5 ${props.className || ''}`}>👤</div>;
}