import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, CircleDot, Download, ChevronRight, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, addMinutes, formatDistanceToNow } from "date-fns";
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

type AnalysisResponse = {
  status: string;
  steps: Record<string, AnalysisStepStatus>;
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
    title: "Setup Simulation",
    description: "Configuring and implementing the simulation environment",
    status: "pending",
    output: `// Test Environment Setup
Setting up Hardhat environment...
Compiling contracts with solc 0.8.17...
Compilation successful

Configuring simulation environment:
- Network: Hardhat local
- Chain ID: 31337
- Block Gas Limit: 30000000
- Initial ETH Balance: 10000 ETH per account

Generating test accounts:
- Owner: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
- LP Provider: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
- Trader 1: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
- Trader 2: 0x90F79bf6EB2c4f870365E785982E1f101E93b906
- Staker: 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65

Test scenario scripts generated:
- scenario1_basic_trading.js
- scenario2_liquidity_provision.js
- scenario3_staking_rewards.js
- scenario4_attack_simulation.js
`
  },
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
  
  // No content ref needed

  const { data: analysis, isLoading } = useQuery<AnalysisResponse>({
    queryKey: [`/api/analysis/${id}`],
    refetchInterval: (data: unknown) => {
      if (!data || typeof data !== 'object' || !('steps' in data)) return 2000;
      
      // Type assertion
      const analysisData = data as AnalysisResponse;
      const steps = analysisData.steps;
      
      // Check if any step is in progress
      const hasInProgressStep = Object.values(steps).some(
        (step: AnalysisStepStatus) => step.status === "in_progress"
      );
      
      return hasInProgressStep ? 2000 : false;
    },
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

  useEffect(() => {
    if (analysis && analysis.steps) {
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

  const getStepStatus = (stepId: string): StepStatus => {
    return analysis.steps[stepId]?.status || "pending";
  };

  const getStepDetails = (stepId: string): string | null => {
    return analysis.steps[stepId]?.details || null;
  };

  const calculateProgress = (): number => {
    const totalSteps = analysisSteps.length;
    const completedSteps = Object.values(analysis.steps).filter(
      step => step.status === "completed"
    ).length;
    return Math.round((completedSteps / totalSteps) * 100);
  };

  // Find the selected step object
  const currentStep = analysisSteps.find(step => step.id === selectedStep) || analysisSteps[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Smart Contract Analysis
          </h1>
          <Button
            variant="outline"
            onClick={() => window.location.href = `/api/download/${id}`}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download Project
          </Button>
        </div>
        
        <p className="text-muted-foreground text-lg">
          Analyzing repository structure and preparing test environment
        </p>
        
        <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
          <div 
            className="bg-primary h-full transition-all duration-500 ease-in-out"
            style={{ width: `${calculateProgress()}%` }}
          />
        </div>
        
        <p className="text-sm text-muted-foreground">
          Overall Progress: {calculateProgress()}%
        </p>

        {/* Compact Steps Bar */}
        <div className="flex flex-wrap justify-center mb-6">
          {analysisSteps.map((step, index) => (
            <div 
              key={step.id}
              onClick={(e) => {
                e.preventDefault();
                // Just change the selected step - no scrolling needed
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
              <div className="flex h-6 w-6 rounded-full mr-2 items-center justify-center text-xs border">
                {index + 1}
              </div>
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
                       currentStep.id === "test_setup" ? "Simulation Setup" :
                       "Simulation Results"}
                    </span>
                    <div className="flex items-center gap-2">
                      {(currentStep.id === "files" || currentStep.id === "actors") && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={getStepStatus(currentStep.id) === "in_progress"}
                            >
                              <RefreshCcw className="h-4 w-4 mr-1" />
                              Refresh
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-black/95 border-primary/20">
                            <DialogHeader>
                              <DialogTitle className="text-white">Refine Analysis</DialogTitle>
                              <DialogDescription className="text-white/70">
                                Optionally provide instructions to refine the analysis.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-col gap-4 py-4">
                              <textarea
                                className="w-full h-24 rounded-md bg-black/50 border-gray-700 text-white p-2"
                                placeholder="Enter prompt (optional)"
                                id="prompt"
                              />
                            </div>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button
                                  variant="default"
                                  onClick={async () => {
                                    const prompt = (document.getElementById('prompt') as HTMLTextAreaElement).value;
                                    try {
                                      if (prompt) {
                                        await fetch(`/api/refine-analysis/${id}/${currentStep.id}`, {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json'
                                          },
                                          body: JSON.stringify({ prompt })
                                        });
                                      } else {
                                        await fetch(`/api/reanalyze/${id}/${currentStep.id}`, {
                                          method: 'POST'
                                        });
                                      }
                                    } catch (error) {
                                      console.error('Error triggering reanalysis:', error);
                                    }
                                  }}
                                >
                                  Start Analysis
                                </Button>
                              </DialogClose>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
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
                  {getStepStatus(currentStep.id) === "in_progress" ? "Analysis in progress..." : 
                   getStepStatus(currentStep.id) === "failed" ? "Analysis failed" : "Waiting to start..."}
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
                              if (stepData?.jsonData) {
                                projectData = stepData.jsonData;
                              } else {
                                const details = getStepDetails(currentStep.id);
                                if (!details) return <p>No details available</p>;
                                projectData = JSON.parse(details);
                              }
                              return (
                                <div className="space-y-6">
                                  <div className="bg-gray-900 p-4 rounded-md">
                                    <div className="flex justify-between items-start mb-4">
                                      <div>
                                        <h3 className="text-xl font-semibold text-blue-400">{projectData.projectName}</h3>
                                        <p className="text-gray-300 mt-1">{projectData.projectSummary}</p>
                                      </div>
                                      <div className="bg-gray-800 px-3 py-2 rounded-md text-sm">
                                        <div className="flex gap-2 items-center">
                                          <span className="text-gray-400">Environment:</span>
                                          <span className="text-green-400">{projectData.devEnvironment}</span>
                                        </div>
                                        <div className="flex gap-2 items-center mt-1">
                                          <span className="text-gray-400">Compiler:</span>
                                          <span className="text-cyan-300">v{projectData.compiler}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-green-400">Smart Contracts</h3>
                                    <div className="space-y-3">
                                      {projectData.contracts.map((contract: { name: string; summary: string; interfaces: string[]; libraries: string[] }, index: number) => (
                                        <div key={index} className="bg-gray-900 p-3 rounded-md">
                                          <div className="flex justify-between items-start">
                                            <h4 className="font-medium text-yellow-300">{contract.name}</h4>
                                          </div>
                                          <p className="text-sm text-gray-300 mt-1">{contract.summary}</p>
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
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <h3 className="text-lg font-semibold text-green-400 mb-3">Dependencies</h3>
                                    <div className="bg-gray-900 p-3 rounded-md">
                                      <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(projectData.dependencies).map(([name, version]: [string, unknown], index: number) => (
                                          <div key={name} className="flex justify-between text-sm">
                                            <span className="text-blue-300">{name}</span>
                                            <span className="text-gray-400">{version as string}</span>
                                          </div>
                                        ))}
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
                              
                              // Ensure testSetupData has all required properties
                              const enhancedTestSetupData = {
                                ...testSetupData,
                                testEnvironment: testSetupData.testEnvironment || "Hardhat",
                                networkSettings: testSetupData.networkSettings || {
                                  name: "Local Hardhat",
                                  chainId: "31337"
                                },
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
                                    output: "Predify.sol deployed to 0x1234...\nManualResolutionStrategy.sol deployed to 0x5678...\nMockERC20.sol deployed to 0x9abc..."
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
                                      <h4 className="text-lg font-medium text-blue-400 mb-3">Contract Code</h4>
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
                                      {enhancedTestSetupData.substeps.map((substep: any) => (
                                        substep.id === "actors" && (
                                          <div key={substep.id} className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                                            <p className="text-gray-300 mb-4">{substep.description}</p>
                                            
                                            {/* Actor List */}
                                            <div className="space-y-4">
                                              {/* Example actor - hardcoded for now but would come from API */}
                                              <Collapsible className="bg-gray-800 rounded-md">
                                                <CollapsibleTrigger className="w-full p-4 flex items-center justify-between">
                                                  <div>
                                                    <h4 className="text-lg font-medium text-blue-400 text-left">Market Creator</h4>
                                                    <p className="mt-1 text-white/70 text-sm text-left">Creates prediction markets with specific parameters</p>
                                                  </div>
                                                  <ChevronRight className="h-5 w-5 text-gray-400 transform transition-transform group-data-[state=open]:rotate-90" />
                                                </CollapsibleTrigger>
                                                <CollapsibleContent className="px-4 pb-4">
                                                  <div className="space-y-4">
                                                    <Collapsible>
                                                      <CollapsibleTrigger className="flex items-center gap-2 text-gray-300 p-2 bg-gray-700/50 rounded w-full justify-between">
                                                        <div className="flex items-center gap-2">
                                                          <ChevronRight className="h-4 w-4 transform transition-transform group-data-[state=open]:rotate-90" />
                                                          <span>Create Market</span>
                                                        </div>
                                                        <Button size="sm" variant="outline" className="h-7 text-xs">
                                                          Modify
                                                        </Button>
                                                      </CollapsibleTrigger>
                                                      <CollapsibleContent className="p-3 mt-2 bg-gray-700/30 rounded-md">
                                                        <div className="space-y-3">
                                                          <div>
                                                            <h5 className="text-sm font-medium text-blue-300 mb-1">Implementation</h5>
                                                            <pre className="text-xs text-green-400 bg-black/40 p-2 rounded whitespace-pre-wrap">
{`async function createMarket(creator, params) {
  // Validate market parameters
  if (!params.question || !params.endTime || !params.options || params.options.length < 2) {
    throw new Error("Invalid market parameters");
  }
  
  // Create the market
  const tx = await predictionMarket.connect(creator).createMarket(
    params.question,
    params.options,
    Math.floor(new Date(params.endTime).getTime() / 1000)
  );
  
  // Wait for confirmation
  await tx.wait();
  return tx;
}`}
                                                            </pre>
                                                          </div>
                                                          
                                                          <div>
                                                            <h5 className="text-sm font-medium text-yellow-300 mb-1">Validation Rules</h5>
                                                            <pre className="text-xs text-yellow-400 bg-black/40 p-2 rounded whitespace-pre-wrap">
{`// Validation for Market Creation
1. Question must be non-empty string
2. At least 2 options must be provided 
3. End time must be in the future (> now + 1 hour)
4. Creator must have sufficient balance for market creation fee
5. Creator must not have too many active markets (limit: 10)
6. Market with identical question should not exist`}
                                                            </pre>
                                                          </div>
                                                        </div>
                                                      </CollapsibleContent>
                                                    </Collapsible>
                                                    
                                                    <Collapsible>
                                                      <CollapsibleTrigger className="flex items-center gap-2 text-gray-300 p-2 bg-gray-700/50 rounded w-full justify-between">
                                                        <div className="flex items-center gap-2">
                                                          <ChevronRight className="h-4 w-4 transform transition-transform group-data-[state=open]:rotate-90" />
                                                          <span>Add Market Liquidity</span>
                                                        </div>
                                                        <Button size="sm" variant="outline" className="h-7 text-xs">
                                                          Modify
                                                        </Button>
                                                      </CollapsibleTrigger>
                                                      <CollapsibleContent className="p-3 mt-2 bg-gray-700/30 rounded-md">
                                                        <div className="space-y-3">
                                                          <div>
                                                            <h5 className="text-sm font-medium text-blue-300 mb-1">Implementation</h5>
                                                            <pre className="text-xs text-green-400 bg-black/40 p-2 rounded whitespace-pre-wrap">
{`async function addLiquidity(creator, marketId, amount) {
  // Check if market exists
  const marketExists = await predictionMarket.marketExists(marketId);
  if (!marketExists) {
    throw new Error(\`Market \${marketId} does not exist\`);
  }
  
  // Approve token transfer first
  await token.connect(creator).approve(predictionMarket.address, amount);
  
  // Add liquidity
  const tx = await predictionMarket.connect(creator).addLiquidity(marketId, amount);
  
  // Wait for confirmation
  await tx.wait();
  return tx;
}`}
                                                            </pre>
                                                          </div>
                                                          
                                                          <div>
                                                            <h5 className="text-sm font-medium text-yellow-300 mb-1">Validation Rules</h5>
                                                            <pre className="text-xs text-yellow-400 bg-black/40 p-2 rounded whitespace-pre-wrap">
{`// Validation for Adding Liquidity
1. Market must exist and be active (not resolved)
2. Amount must be > 0
3. Creator must have sufficient token balance
4. Creator must approve token transfer to market contract
5. Market must not be in resolution period
6. Liquidity amount must not exceed maximum limit`}
                                                            </pre>
                                                          </div>
                                                        </div>
                                                      </CollapsibleContent>
                                                    </Collapsible>
                                                  </div>
                                                </CollapsibleContent>
                                              </Collapsible>
                                              
                                              {/* Another example actor */}
                                              <Collapsible className="bg-gray-800 rounded-md">
                                                <CollapsibleTrigger className="w-full p-4 flex items-center justify-between">
                                                  <div>
                                                    <h4 className="text-lg font-medium text-blue-400 text-left">Market Participant</h4>
                                                    <p className="mt-1 text-white/70 text-sm text-left">Participates in markets by placing bets on outcomes</p>
                                                  </div>
                                                  <ChevronRight className="h-5 w-5 text-gray-400 transform transition-transform group-data-[state=open]:rotate-90" />
                                                </CollapsibleTrigger>
                                                <CollapsibleContent className="px-4 pb-4">
                                                  <div className="space-y-4">
                                                    <Collapsible>
                                                      <CollapsibleTrigger className="flex items-center gap-2 text-gray-300 p-2 bg-gray-700/50 rounded w-full justify-between">
                                                        <div className="flex items-center gap-2">
                                                          <ChevronRight className="h-4 w-4 transform transition-transform group-data-[state=open]:rotate-90" />
                                                          <span>Place Bet</span>
                                                        </div>
                                                        <Button size="sm" variant="outline" className="h-7 text-xs">
                                                          Modify
                                                        </Button>
                                                      </CollapsibleTrigger>
                                                      <CollapsibleContent className="p-3 mt-2 bg-gray-700/30 rounded-md">
                                                        <div className="space-y-3">
                                                          <div>
                                                            <h5 className="text-sm font-medium text-blue-300 mb-1">Implementation</h5>
                                                            <pre className="text-xs text-green-400 bg-black/40 p-2 rounded whitespace-pre-wrap">
{`async function placeBet(participant, marketId, outcomeIndex, amount) {
  // Approve token transfer
  await token.connect(participant).approve(predictionMarket.address, amount);
  
  // Place bet
  const tx = await predictionMarket.connect(participant).placeBet(
    marketId,
    outcomeIndex,
    amount
  );
  
  // Wait for confirmation
  await tx.wait();
  return tx;
}`}
                                                            </pre>
                                                          </div>
                                                          
                                                          <div>
                                                            <h5 className="text-sm font-medium text-yellow-300 mb-1">Validation Rules</h5>
                                                            <pre className="text-xs text-yellow-400 bg-black/40 p-2 rounded whitespace-pre-wrap">
{`// Validation for Placing Bets
1. Market must exist and be active
2. Outcome index must be valid for the market
3. Bet amount must be greater than minimum (> 0.01 tokens)
4. Participant must have sufficient token balance
5. Market must not be in pending resolution state
6. Betting period must not have ended`}
                                                            </pre>
                                                          </div>
                                                        </div>
                                                      </CollapsibleContent>
                                                    </Collapsible>
                                                  </div>
                                                </CollapsibleContent>
                                              </Collapsible>
                                            </div>
                                          </div>
                                        )
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
                      ) : currentStep.id === "simulations" ? (
                        <SimulationsComponent />
                      
                      ) : currentStep.id === "actors" && getStepStatus(currentStep.id) === "completed" ? (
                        <div className="text-white font-mono">
                          {(() => {
                            try {
                              // First try to use the jsonData field directly from the API
                              const stepData = analysis?.steps[currentStep.id];
                              
                              // Fall back to parsing the details field if jsonData is not available
                              let actorsData;
                              if (stepData?.jsonData) {
                                actorsData = stepData.jsonData;
                              } else {
                                const details = getStepDetails(currentStep.id);
                                if (!details) return <p>No details available</p>;
                                actorsData = JSON.parse(details);
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
                                                      
                                                      {/* Code Implementation and Validation Collapsible Sections */}
                                                      <div className="mt-3 grid grid-cols-1 gap-2">
                                                        <Collapsible className="w-full">
                                                          <CollapsibleTrigger className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 w-full justify-between bg-gray-700/30 p-1.5 rounded">
                                                            <div className="flex items-center">
                                                              <ChevronRight className="h-3 w-3 transform transition-transform group-data-[state=open]:rotate-90" />
                                                              <span>Implementation Details</span>
                                                            </div>
                                                          </CollapsibleTrigger>
                                                          <CollapsibleContent className="mt-2 p-2 bg-gray-800/50 rounded text-xs">
                                                            <pre className="text-green-400 whitespace-pre-wrap">
                                                              {`async function ${action.function_name}() {
  // Implementation details would go here
  // This would show the actual code implementation of how this action is executed
  await ${action.contract_name}.connect(actor).${action.function_name}(params);
  
  // Additional logic, error handling, etc.
}`}
                                                            </pre>
                                                            <Button 
                                                              size="sm" 
                                                              variant="ghost" 
                                                              className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                                                            >
                                                              Modify Implementation
                                                            </Button>
                                                          </CollapsibleContent>
                                                        </Collapsible>
                                                        
                                                        <Collapsible className="w-full">
                                                          <CollapsibleTrigger className="text-xs flex items-center gap-1 text-yellow-400 hover:text-yellow-300 w-full justify-between bg-gray-700/30 p-1.5 rounded">
                                                            <div className="flex items-center">
                                                              <ChevronRight className="h-3 w-3 transform transition-transform group-data-[state=open]:rotate-90" />
                                                              <span>Validation Rules</span>
                                                            </div>
                                                          </CollapsibleTrigger>
                                                          <CollapsibleContent className="mt-2 p-2 bg-gray-800/50 rounded text-xs">
                                                            <pre className="text-yellow-400 whitespace-pre-wrap">
                                                              {`// Validation rules for ${action.name}
1. Check if actor has sufficient balance
2. Verify contract state allows this action
3. Ensure gas limits are appropriate
4. Validate transaction parameters`}
                                                            </pre>
                                                            <Button 
                                                              size="sm" 
                                                              variant="ghost" 
                                                              className="mt-2 text-xs text-yellow-400 hover:text-yellow-300"
                                                            >
                                                              Modify Validation Rules
                                                            </Button>
                                                          </CollapsibleContent>
                                                        </Collapsible>
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