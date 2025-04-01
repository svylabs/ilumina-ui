import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, CircleDot, Download, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, addMinutes, formatDistanceToNow } from "date-fns";
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
                  <span>
                    {currentStep.id === "files" ? "Project Summary" : 
                     currentStep.id === "actors" ? "Actor Summary" :
                     currentStep.id === "test_setup" ? "Simulation Setup" :
                     "Simulation Results"}
                  </span>
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

                                  {/* Implementation Steps Section */}
                                  <div className="space-y-4" id="implementation-steps">
                                    <h3 className="text-xl font-semibold text-blue-400">Implementation Steps</h3>
                                    
                                    {/* Substep Navigation Tabs */}
                                    <div className="flex space-x-2 border-b border-gray-800">
                                      {enhancedTestSetupData.substeps.map((substep: any) => (
                                        <button
                                          key={substep.id}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            setActiveSubstep(substep.id);
                                          }}
                                          className={`px-3 py-2 text-sm font-medium border-b-2 ${
                                            activeSubstep === substep.id 
                                              ? 'border-blue-400 text-blue-400' 
                                              : 'border-transparent text-gray-400 hover:text-gray-300'
                                          }`}
                                        >
                                          {substep.name}
                                        </button>
                                      ))}
                                    </div>
                                    
                                    {/* Substep Content */}
                                    <div className="space-y-6">
                                      {enhancedTestSetupData.substeps.map((substep: any) => (
                                        <div 
                                          key={substep.id} 
                                          className={activeSubstep === substep.id ? 'block' : 'hidden'}
                                        >
                                          <div className="mb-4">
                                            <p className="text-gray-300">{substep.description}</p>
                                          </div>
                                          
                                          {substep.output && (
                                            <div className="mt-2 bg-black/60 p-3 rounded-md">
                                              <pre className="text-sm text-green-400 whitespace-pre-wrap">{substep.output}</pre>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Test Environment with file viewer and AI assistant */}
                                  <div className="mt-8 mb-8">
                                    <h3 className="text-xl font-semibold text-blue-400 mb-2">Test Environment</h3>
                                    
                                    {/* Main container with code files and AI assistant */}
                                    <div className="bg-gray-900 rounded-lg border border-gray-800 p-2">
                                      {/* Network info panel */}
                                      <div className="bg-gray-900 p-3 rounded-md mb-4">
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
                                      
                                      {/* Code Viewer and AI Assistant */}
                                      <div id="code-content">
                                        <div className="flex flex-col gap-4">
                                          {/* Main code viewer */}
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
                                          
                                          {/* AI Assistant for Pro and Teams plans only */}
                                          {(() => {
                                            // Get the current user from auth context
                                            const { user } = useAuth();
                                            
                                            // Only render the assistant for pro and teams plans
                                            if (user && (user.plan === "pro" || user.plan === "teams")) {
                                              return (
                                                <div className="w-full bg-gray-800 rounded-lg p-3">
                                                  <div className="mb-2 p-2 bg-blue-500/10 rounded flex items-center">
                                                    <span className="text-blue-400 font-semibold">AI Assistant</span>
                                                    <Badge className="ml-2 bg-blue-500 text-xs" variant="default">
                                                      {user.plan === "pro" ? "Pro" : "Teams"}
                                                    </Badge>
                                                  </div>
                                                  <div className="h-[300px]">
                                                    <TestEnvironmentChat 
                                                      submissionId={id || ""}
                                                      projectName={enhancedTestSetupData.projectName || "Smart Contract Project"}
                                                      onCodeUpdate={(code: string, path?: string) => {
                                                        console.log("Code update requested:", { code, path });
                                                        // Here you would implement the code update logic
                                                      }}
                                                      initialMessages={[
                                                        {
                                                          id: "welcome",
                                                          role: "assistant",
                                                          content: "Welcome to the AI Code Assistant. I can help you understand and modify the code. What questions do you have?",
                                                          timestamp: new Date()
                                                        }
                                                      ]}
                                                    />
                                                  </div>
                                                </div>
                                              );
                                            }
                                            
                                            // For free plan users, show upgrade prompt
                                            return (
                                              <div className="w-full bg-gray-800 rounded-lg p-4 flex flex-col items-center justify-center h-[150px]">
                                                <h3 className="text-white font-semibold mb-2">AI Assistant</h3>
                                                <p className="text-gray-400 text-sm text-center mb-4">
                                                  Upgrade to Pro or Teams plan to access the AI Assistant and get help with your smart contracts.
                                                </p>
                                                <Link href="/pricing">
                                                  <Button variant="default" className="bg-blue-600 hover:bg-blue-700">
                                                    Upgrade Plan
                                                  </Button>
                                                </Link>
                                              </div>
                                            );
                                          })()}
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
                                        <div key={index} className="bg-gray-900 p-4 rounded-md">
                                          <div className="flex items-center justify-between">
                                            <h4 className="text-lg font-medium text-blue-400">{actor.name}</h4>
                                          </div>
                                          <p className="mt-1 text-white">{actor.summary}</p>
                                          
                                          <div className="mt-3">
                                            <p className="text-gray-400 mb-2">Possible Actions:</p>
                                            <div className="space-y-2">
                                              {actor.actions.map((action: any, i: number) => (
                                                <div key={i} className="bg-gray-800 p-3 rounded">
                                                  <div className="flex justify-between">
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
                                            </div>
                                          </div>
                                        </div>
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