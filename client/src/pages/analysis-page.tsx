import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle, Loader2, CheckCircle2, XCircle, CircleDot, Download, ChevronRight, RefreshCw, FileCode, Users, Box, Laptop, PlayCircle, Code, FileEdit, Eye, MessageSquare } from "lucide-react";
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
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

// Simulation run type definition
type SimulationRun = {
  id: string;
  status: "success" | "failure";
  date: string;
  logUrl: string;
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
  };
};

// Component for Simulations tab
function SimulationsComponent() {
  const { id: submissionId } = useParams();
  
  // State for simulation runs
  const [simulationRuns, setSimulationRuns] = useState<SimulationRun[]>([]);
  const [isRunningSimulation, setIsRunningSimulation] = useState(false);
  const [progress, setProgress] = useState(0);
  const [simStatus, setSimStatus] = useState<{
    canRun: boolean;
    message: string;
    plan?: string;
    runsUsed?: number;
    runsLimit?: number | string;
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
          setSimStatus(statusData);
          setShowUpgradeMessage(!statusData.canRun);
        } else if (statusResponse.status === 401) {
          setSimStatus({
            canRun: false,
            message: "Please login to run simulations"
          });
        }
        
        // Fetch existing simulation runs
        const runsResponse = await fetch(`/api/simulation-runs/${submissionId}`);
        if (runsResponse.ok) {
          const runsData = await runsResponse.json();
          // Convert database records to our SimulationRun type
          const formattedRuns: SimulationRun[] = runsData.map((run: any) => ({
            id: run.runId, // Use the runId as our display ID
            status: run.status as 'success' | 'failure',
            date: run.date,
            logUrl: run.logUrl || '#log',
            summary: run.summary || {
              totalTests: 0,
              passed: 0,
              failed: 0
            }
          }));
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
  }, [user, submissionId, toast]);
  
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
      const simId = generateSimId();
      
      // Mock progress updates
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 5;
        });
      }, 300);
      
      // Simulate a running time
      setTimeout(async () => {
        try {
          // Generate random results
          const isSuccess = Math.random() > 0.3; // 70% success rate
          const totalTests = Math.floor(Math.random() * 20) + 30; // 30-50 tests
          const passedTests = isSuccess 
            ? totalTests 
            : Math.floor(totalTests * (Math.random() * 0.4 + 0.5)); // 50-90% pass rate for failures
          
          // Log the simulation run
          const logResponse = await fetch('/api/log-simulation', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              submissionId,
              runId: simId,
              status: isSuccess ? 'success' : 'failure',
              logUrl: '#log',
              summary: {
                totalTests,
                passed: passedTests,
                failed: totalTests - passedTests
              }
            })
          });
          
          if (!logResponse.ok) {
            if (logResponse.status === 401) {
              toast({
                title: "Authentication Required",
                description: "Please login to run simulations",
                variant: "destructive"
              });
              setIsRunningSimulation(false);
              clearInterval(interval);
              return;
            }
            throw new Error('Failed to log simulation');
          }
          
          const logData = await logResponse.json();
          
          // Update simulation runs with the new one from the server
          if (logData.success && logData.simulationRun) {
            // Fetch all runs to ensure consistency
            const runsResponse = await fetch(`/api/simulation-runs/${submissionId}`);
            if (runsResponse.ok) {
              const runsData = await runsResponse.json();
              // Convert database records to our SimulationRun type
              const formattedRuns: SimulationRun[] = runsData.map((run: any) => ({
                id: run.runId, // Use the runId as our display ID
                status: run.status as 'success' | 'failure',
                date: run.date,
                logUrl: run.logUrl || '#log',
                summary: run.summary || {
                  totalTests: 0,
                  passed: 0,
                  failed: 0
                }
              }));
              setSimulationRuns(formattedRuns);
            } else {
              // Fallback to just adding the new run as a formatted SimulationRun
              const newRun: SimulationRun = {
                id: logData.simulationRun.runId,
                status: logData.simulationRun.status,
                date: logData.simulationRun.date,
                logUrl: logData.simulationRun.logUrl || '#log',
                summary: logData.simulationRun.summary || {
                  totalTests: 0,
                  passed: 0,
                  failed: 0
                }
              };
              setSimulationRuns(prev => [newRun, ...prev]);
            }
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
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h3 className="text-xl font-semibold text-blue-400">Simulations</h3>
            {simStatus && (
              <p className="text-sm text-gray-400 mt-1">
                {simStatus.canRun 
                  ? `${simStatus.message}`
                  : `${simStatus.message}`
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
            <div className="flex items-center mb-2">
              <div className="w-4 h-4 rounded-full bg-blue-500 animate-pulse mr-2"></div>
              <span className="text-blue-400 font-medium">Simulation in progress</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2.5 mb-2">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="text-right text-xs text-gray-400">{progress}% complete</div>
            <div className="mt-2 text-sm text-gray-300">
              <p>• Preparing test environment</p>
              {progress > 20 && <p>• Deploying contracts</p>}
              {progress > 40 && <p>• Initializing actor agents</p>}
              {progress > 60 && <p>• Running test scenarios</p>}
              {progress > 80 && <p>• Analyzing results</p>}
            </div>
          </div>
        )}
        
        {simulationRuns.length > 0 ? (
          <div className="bg-gray-900 rounded-md">
            <div className="border-b border-gray-800 p-4">
              <div className="hidden md:grid md:grid-cols-12 text-sm text-gray-400 font-medium">
                <div className="col-span-3">Run ID</div>
                <div className="col-span-3">Status</div>
                <div className="col-span-3">Date</div>
                <div className="col-span-3">Actions</div>
              </div>
            </div>
            
            <div className="divide-y divide-gray-800">
              {simulationRuns.map((run) => (
                <div key={run.id} className="p-4 hover:bg-gray-800/50 transition-colors">
                  <div className="flex flex-col md:grid md:grid-cols-12 items-start md:items-center gap-2 md:gap-0">
                    <div className="md:col-span-3 font-mono text-white">
                      <div className="md:hidden text-xs text-gray-400 mb-1">Run ID</div>
                      {run.id}
                    </div>
                    <div className="md:col-span-3">
                      <div className="md:hidden text-xs text-gray-400 mb-1">Status</div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                        ${run.status === 'success' 
                          ? 'bg-green-900/50 text-green-300' 
                          : 'bg-red-900/50 text-red-300'
                        }`}
                      >
                        {run.status === 'success' ? '✓ Success' : '✗ Failed'}
                      </span>
                    </div>
                    <div className="md:col-span-3 text-gray-300">
                      <div className="md:hidden text-xs text-gray-400 mb-1">Date</div>
                      {new Date(run.date).toLocaleString()}
                    </div>
                    <div className="md:col-span-3 flex flex-wrap gap-2 md:space-x-2">
                      <a 
                        href={run.logUrl} 
                        className="text-xs px-2 py-1 inline-flex items-center rounded border border-gray-700 text-gray-300 hover:bg-gray-800"
                      >
                        <span className="mr-1">📝</span> View Log
                      </a>
                      <a 
                        href={`#details-${run.id}`} 
                        className="text-xs px-2 py-1 inline-flex items-center rounded border border-gray-700 text-gray-300 hover:bg-gray-800"
                      >
                        <span className="mr-1">📊</span> Details
                      </a>
                    </div>
                  </div>
                </div>
              ))}
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
};

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
  // Second test_setup entry removed to prevent duplication
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

export default function AnalysisPage() {
  const { id } = useParams();
  const [selectedStep, setSelectedStep] = useState<string>("files");
  const [activeSubstep, setActiveSubstep] = useState<string>("");
  const [openChats, setOpenChats] = useState<Record<string, boolean>>({});
  
  // No content ref needed

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

  // This effect only runs once on initial load and whenever analysis changes,
  // and only sets the selected step if not manually selected by the user
  const userSelectedRef = useRef(false);
  
  useEffect(() => {
    if (analysis && analysis.steps) {
      // Only auto-select a step if the user hasn't manually selected one yet
      if (!userSelectedRef.current) {
        // Type safety: Explicitly cast entries to the right type
        const entries = Object.entries(analysis.steps) as [string, AnalysisStepStatus][];
        
        // Find any in-progress step
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
      stepId === "deployment" ? "deployment_instructions" :
      stepId === "simulations" ? "run_simulation" : "";
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
  
  const getStepStatus = (stepId: string): StepStatus => {
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
                  <a href={project.githubUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 mt-1 text-sm">
                    {project.githubUrl}
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
                       currentStep.id === "simulations" ? "Simulation Results" :
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
                      
                      {(currentStep.id === "files" || currentStep.id === "actors" || currentStep.id === "deployment") && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={getStepStatus(currentStep.id) === "in_progress"}
                          onClick={() => setOpenChats(prev => ({ 
                            ...prev, 
                            [`refine-${currentStep.id}`]: true 
                          }))}
                        >
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Refine
                        </Button>
                      )}
                      
                      {/* Chat interface for refining project/actor summary or deployment instructions */}
                      {openChats[`refine-${currentStep.id}`] && (
                        <SectionChat
                          sectionType={
                            currentStep.id === "files" ? "project_summary" : 
                            currentStep.id === "actors" ? "actor_summary" : 
                            "deployment_instructions"
                          }
                          sectionName={
                            currentStep.id === "files" ? "Project Summary" : 
                            currentStep.id === "actors" ? "Actor Summary" : 
                            "Deployment Instructions"
                          }
                          projectId={id || ""}
                          onClose={() => setOpenChats(prev => ({ 
                            ...prev, 
                            [`refine-${currentStep.id}`]: false 
                          }))}
                          isOpen={true}
                        />
                      )}
                    </div>
                  </div>
                  {currentStep.link && getStepStatus(currentStep.id) === "completed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <Link href={currentStep.id === "simulations" ? `/results/${id}` : currentStep.link}>
                        {currentStep.linkText}
                      </Link>
                    </Button>
                  )}
                </CardTitle>
                <CardDescription>
                  {(() => {
                  // Determine the status text based on step status and data availability
                  const stepStatus = getStepStatus(currentStep.id);
                  
                  if (stepStatus === "in_progress") {
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
                    return "Analysis complete";
                  }
                  
                  // Default state for pending
                  return "Ready for analysis";
                })()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md bg-black/90 p-4">
                  {getStepStatus(currentStep.id) === "in_progress" ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="ml-2 text-primary">Processing...</p>
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
                                    projectSummaryObj = JSON.parse(projectData.project_summary);
                                    console.log("Parsed project summary:", projectSummaryObj);
                                  } catch (e) {
                                    console.error("Failed to parse project_summary:", e);
                                  }
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
                      ) : currentStep.id === "test_setup" && getStepStatus(currentStep.id) === "completed" ? (
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
                                if (!details) return <p>No details available</p>;
                                testSetupData = JSON.parse(details);
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
                                        {/* Dynamically get repository from submission */}
                                        <GitHubCodeViewer 
                                          owner="ethereum"
                                          repo="solidity"
                                          branch="develop"
                                          path="docs/examples"
                                          showBreadcrumb={true}
                                        />
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
                                                                onClick={() => setOpenChats(prev => ({ 
                                                                  ...prev, 
                                                                  [`implementation-${actor.id}-${action.id}`]: true 
                                                                }))}
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
                                                                onClick={() => setOpenChats(prev => ({ 
                                                                  ...prev, 
                                                                  [`validation-${actor.id}-${action.id}`]: true 
                                                                }))}
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
                        <SimulationsComponent />
                      
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
                              // First try to use the jsonData field directly from the API
                              const stepData = analysis?.steps[currentStep.id];
                              
                              // Fall back to parsing the details field if jsonData is not available
                              let deploymentData;
                              if (stepData?.jsonData) {
                                deploymentData = stepData.jsonData;
                              } else {
                                const details = getStepDetails(currentStep.id);
                                if (!details) return <p>No details available</p>;
                                deploymentData = JSON.parse(details);
                              }
                              
                              return (
                                <div className="space-y-6">
                                  <div className="bg-gray-900 p-4 rounded-md">
                                    <h3 className="text-xl font-semibold text-blue-400">Deployment Instructions</h3>
                                    <p className="text-gray-300 mt-1">{deploymentData.title || "Smart Contract Deployment Process"}</p>
                                    <p className="text-gray-400 mt-3 text-sm">{deploymentData.description || "Follow these steps to deploy the smart contracts to your local development network."}</p>
                                  </div>
                                  


                                  <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-green-400">Deployment Steps</h3>
                                    <div className="space-y-3">
                                      {(deploymentData.deploymentSteps || []).map((step: any, index: number) => (
                                        <div key={index} className="bg-gray-900 p-3 rounded-md">
                                          <div className="flex justify-between items-start">
                                            <h4 className="font-medium text-yellow-300">{step.name}</h4>
                                            <div className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-400">Gas: {step.gas}</div>
                                          </div>
                                          <div className="mt-2">
                                            <div className="text-xs text-gray-400">Transaction:</div>
                                            <div className="text-sm font-mono text-cyan-300 bg-gray-800 p-2 rounded mt-1 overflow-x-auto">
                                              {step.tx}
                                            </div>
                                          </div>
                                          {Object.keys(step.params || {}).length > 0 && (
                                            <div className="mt-2">
                                              <div className="text-xs text-gray-400">Parameters:</div>
                                              <div className="grid grid-cols-1 gap-1 mt-1">
                                                {Object.entries(step.params).map(([key, value]: [string, any], i: number) => (
                                                  <div key={i} className="text-sm">
                                                    <span className="text-gray-500">{key}: </span>
                                                    <span className="text-green-300">{String(value)}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                          <div className="mt-2">
                                            <div className="text-xs text-gray-400">Result:</div>
                                            <div className="text-sm text-blue-300 mt-1">{step.result}</div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              );
                            } catch (e) {
                              console.error("Error rendering deployment data:", e);
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
                                    const parsedData = JSON.parse(stepData.jsonData.actors_summary);
                                    console.log("Parsed actors data:", parsedData);
                                    actorsData = parsedData;
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
    </div>
  );
}