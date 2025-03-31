import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, CircleDot, Download, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, addMinutes, formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";

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
    title: "Setup Test Environment",
    description: "Configuring test workspace with simulation library",
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
              ~{formatDistanceToNow(addMinutes(new Date(startTime), 1))} remaining
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

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left sidebar with steps */}
          <div className="md:col-span-5 space-y-4">
            {analysisSteps.map((step, index) => (
              <Card 
                key={step.id} 
                className={`transition-all duration-300 cursor-pointer hover:border-primary/70 ${
                  selectedStep === step.id ? 'border-primary' : 
                  getStepStatus(step.id) === "in_progress" ? "border-primary/80" : ""
                }`}
                onClick={() => setSelectedStep(step.id)}
              >
                <CardHeader className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-8 w-8 rounded-full bg-muted items-center justify-center">
                        {index + 1}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{step.title}</CardTitle>
                        <CardDescription className="text-sm">
                          {step.description}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <StepStatus 
                        status={getStepStatus(step.id)} 
                        startTime={analysis.steps[step.id]?.startTime}
                      />
                      {selectedStep === step.id && (
                        <ChevronRight className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>

          {/* Right side with output */}
          <div className="md:col-span-7">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{currentStep.title} Output</span>
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
                   getStepStatus(currentStep.id) === "completed" ? "Analysis completed" :
                   getStepStatus(currentStep.id) === "failed" ? "Analysis failed" : "Waiting to start..."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[500px] overflow-auto rounded-md bg-black/90 p-4">
                  {getStepStatus(currentStep.id) === "in_progress" ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="ml-2 text-primary">Processing...</p>
                    </div>
                  ) : getStepStatus(currentStep.id) === "completed" ? (
                    <pre className="text-sm text-green-400 whitespace-pre-wrap font-mono">
                      {currentStep.output || getStepDetails(currentStep.id) || "No output available"}
                    </pre>
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