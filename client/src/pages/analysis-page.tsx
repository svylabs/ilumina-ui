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
                  <span>{currentStep.id === "files" ? "Project Summary" : `${currentStep.title} Output`}</span>
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
                                      {projectData.contracts.map((contract, index) => (
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
                                                  {contract.interfaces.map((iface, i) => (
                                                    <span key={i} className="text-xs bg-blue-900 px-2 py-0.5 rounded-full text-blue-300">{iface}</span>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            {contract.libraries && contract.libraries.length > 0 && (
                                              <div className="ml-3">
                                                <span className="text-xs text-gray-400">Libraries: </span>
                                                <div className="inline-flex flex-wrap gap-1 ml-1">
                                                  {contract.libraries.map((lib, i) => (
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
                                        {Object.entries(projectData.dependencies).map(([name, version]) => (
                                          <div key={name} className="flex justify-between text-sm">
                                            <span className="text-blue-300">{name}</span>
                                            <span className="text-gray-400">{version}</span>
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
                              
                              return (
                                <div className="space-y-6">
                                  <div className="space-y-2">
                                    <h3 className="text-xl font-semibold text-green-400">Test Environment</h3>
                                    <div className="bg-gray-900 p-4 rounded-md">
                                      <p className="text-gray-400 mb-1">Runtime:</p>
                                      <p className="text-white">{testSetupData.testEnvironment}</p>
                                      
                                      <p className="text-gray-400 mt-3 mb-1">Network Settings:</p>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                        <div>
                                          <p className="text-cyan-300">{testSetupData.networkSettings.name}</p>
                                          <p className="text-white">Chain ID: {testSetupData.networkSettings.chainId}</p>
                                          <p className="text-white">Gas Limit: {testSetupData.networkSettings.gasLimit}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <h3 className="text-xl font-semibold text-green-400">Test Accounts</h3>
                                    <div className="overflow-x-auto">
                                      <table className="w-full bg-gray-900 rounded-md text-sm">
                                        <thead>
                                          <tr className="border-b border-gray-800">
                                            <th className="py-2 px-3 text-left text-gray-400">Role</th>
                                            <th className="py-2 px-3 text-left text-gray-400">Address</th>
                                            <th className="py-2 px-3 text-left text-gray-400">Balance</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {testSetupData.networkSettings.accounts.map((account: any, i: number) => (
                                            <tr key={i} className="border-b border-gray-800">
                                              <td className="py-2 px-3 text-yellow-300">{account.name}</td>
                                              <td className="py-2 px-3 font-mono text-blue-300">{account.address}</td>
                                              <td className="py-2 px-3 text-green-300">{account.balance}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <h3 className="text-xl font-semibold text-green-400">Test Cases</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {testSetupData.testCases.map((testCase: any, i: number) => (
                                        <div key={i} className="bg-gray-900 p-3 rounded-md">
                                          <h4 className="text-blue-400 font-medium">{testCase.name}</h4>
                                          <p className="text-gray-400 text-xs mt-1">{testCase.file}</p>
                                          <p className="text-white text-sm mt-1">{testCase.description}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <h3 className="text-xl font-semibold text-green-400">Test Fixtures</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                        <h4 className="text-blue-400 text-base font-medium mb-2">Mock Tokens</h4>
                                        <div className="space-y-2">
                                          {testSetupData.fixtures.tokens.map((token: any, i: number) => (
                                            <div key={i} className="bg-gray-800 p-2 rounded-md">
                                              <div className="flex justify-between">
                                                <span className="text-yellow-300">{token.name}</span>
                                                <span className="text-cyan-300">{token.symbol}</span>
                                              </div>
                                              <div className="text-xs text-gray-300 mt-1">
                                                <p>Decimals: {token.decimals}</p>
                                                <p>Supply: {token.initialSupply}</p>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      
                                      <div>
                                        <h4 className="text-blue-400 text-base font-medium mb-2">Test Markets</h4>
                                        <div className="space-y-2">
                                          {testSetupData.fixtures.markets.map((market: any, i: number) => (
                                            <div key={i} className="bg-gray-800 p-2 rounded-md">
                                              <p className="text-white">{market.description}</p>
                                              <div className="flex flex-wrap gap-1 mt-1">
                                                {market.outcomes.map((outcome: string, j: number) => (
                                                  <span key={j} className="px-2 py-0.5 bg-blue-900 text-blue-200 rounded-full text-xs">
                                                    {outcome}
                                                  </span>
                                                ))}
                                              </div>
                                              <p className="text-xs text-gray-300 mt-1">
                                                Resolution: {market.resolutionStrategy}
                                              </p>
                                            </div>
                                          ))}
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
                      ) : currentStep.id === "simulations" && getStepStatus(currentStep.id) === "completed" ? (
                        <div className="text-white font-mono">
                          {(() => {
                            try {
                              // First try to use the jsonData field directly from the API
                              const stepData = analysis?.steps[currentStep.id];
                              
                              // Fall back to parsing the details field if jsonData is not available
                              let simulationData;
                              if (stepData?.jsonData) {
                                simulationData = stepData.jsonData;
                              } else {
                                const details = getStepDetails(currentStep.id);
                                if (!details) return <p>No details available</p>;
                                simulationData = JSON.parse(details);
                              }
                              
                              return (
                                <div className="space-y-6">
                                  <div className="bg-gray-900 p-4 rounded-md">
                                    <h3 className="text-xl font-semibold text-green-400 mb-4">Test Summary</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                      <div className="bg-gray-800 p-3 rounded-md">
                                        <p className="text-gray-400 text-sm">Total Tests</p>
                                        <p className="text-white text-xl font-bold">{simulationData.summary.totalTests}</p>
                                      </div>
                                      <div className="bg-gray-800 p-3 rounded-md">
                                        <p className="text-gray-400 text-sm">Passed</p>
                                        <p className="text-green-400 text-xl font-bold">{simulationData.summary.passed}</p>
                                      </div>
                                      <div className="bg-gray-800 p-3 rounded-md">
                                        <p className="text-gray-400 text-sm">Failed</p>
                                        <p className="text-red-400 text-xl font-bold">{simulationData.summary.failed}</p>
                                      </div>
                                      <div className="bg-gray-800 p-3 rounded-md">
                                        <p className="text-gray-400 text-sm">Warnings</p>
                                        <p className="text-yellow-400 text-xl font-bold">{simulationData.summary.warnings}</p>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                                      <div className="bg-gray-800 p-3 rounded-md">
                                        <p className="text-gray-400 text-sm">Duration</p>
                                        <p className="text-white text-lg font-bold">{simulationData.summary.duration}</p>
                                      </div>
                                      <div className="bg-gray-800 p-3 rounded-md">
                                        <p className="text-gray-400 text-sm">Coverage</p>
                                        <p className="text-blue-400 text-lg font-bold">{simulationData.summary.coverage}</p>
                                      </div>
                                      <div className="bg-gray-800 p-3 rounded-md">
                                        <p className="text-gray-400 text-sm">Security Score</p>
                                        <div className="flex items-center">
                                          <p className={`text-lg font-bold ${
                                            simulationData.summary.securityScore > 85 ? 'text-green-400' : 
                                            simulationData.summary.securityScore > 70 ? 'text-yellow-400' : 'text-red-400'
                                          }`}>
                                            {simulationData.summary.securityScore}
                                          </p>
                                          <p className="text-gray-400 text-sm ml-1">/100</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <h3 className="text-xl font-semibold text-green-400 mb-4">Test Results</h3>
                                    <div className="space-y-4">
                                      {simulationData.testResults.map((suite: any, suiteIndex: number) => (
                                        <div key={suiteIndex} className={`border-l-4 ${
                                          suite.status === 'passed' ? 'border-green-500' : 'border-red-500'
                                        } bg-gray-900 rounded-r-md overflow-hidden`}>
                                          <div className="p-3 flex justify-between items-center bg-gray-800">
                                            <h4 className="font-medium text-white">{suite.name}</h4>
                                            <span className={`text-xs px-2 py-1 rounded-full ${
                                              suite.status === 'passed' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                                            }`}>
                                              {suite.status.toUpperCase()}
                                            </span>
                                          </div>
                                          <div className="py-1">
                                            {suite.tests.map((test: any, testIndex: number) => (
                                              <div key={testIndex} className="border-b border-gray-800 px-3 py-2">
                                                <div className="flex justify-between items-center">
                                                  <span className="text-sm text-gray-200">{test.description}</span>
                                                  <div className="flex items-center">
                                                    {test.gas && (
                                                      <span className="text-xs text-cyan-300 mr-2">Gas: {test.gas.toLocaleString()}</span>
                                                    )}
                                                    <span className={`flex-shrink-0 w-3 h-3 rounded-full ${
                                                      test.status === 'passed' ? 'bg-green-400' : 'bg-red-400'
                                                    }`}></span>
                                                  </div>
                                                </div>
                                                {test.reason && (
                                                  <p className="text-xs text-red-400 mt-1 pl-4 border-l-2 border-red-800">
                                                    {test.reason}
                                                  </p>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <h3 className="text-xl font-semibold text-red-400 mb-4">Vulnerabilities</h3>
                                    <div className="space-y-3">
                                      {simulationData.vulnerabilities.map((vuln: any, vulnIndex: number) => (
                                        <div key={vulnIndex} className="bg-gray-900 rounded-md p-3">
                                          <div className="flex justify-between items-start">
                                            <h4 className="font-medium text-white">{vuln.description}</h4>
                                            <span className={`text-xs px-2 py-1 rounded-full ${
                                              vuln.severity === 'high' ? 'bg-red-900 text-red-300' : 
                                              vuln.severity === 'medium' ? 'bg-yellow-900 text-yellow-300' : 
                                              'bg-blue-900 text-blue-300'
                                            }`}>
                                              {vuln.severity.toUpperCase()}
                                            </span>
                                          </div>
                                          <p className="text-sm text-gray-300 mt-2">{vuln.details}</p>
                                          <div className="mt-2">
                                            <span className="text-xs text-gray-400">Affected: </span>
                                            <code className="text-xs text-cyan-300">{vuln.affected}</code>
                                          </div>
                                          <div className="mt-2 border-t border-gray-800 pt-2">
                                            <span className="text-xs text-gray-400">Recommendation: </span>
                                            <span className="text-xs text-green-300">{vuln.recommendation}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <h3 className="text-xl font-semibold text-green-400 mb-4">Recommendations</h3>
                                    <ul className="list-disc list-inside space-y-2 text-gray-200">
                                      {simulationData.recommendations.map((rec: string, recIndex: number) => (
                                        <li key={recIndex} className="text-sm">{rec}</li>
                                      ))}
                                    </ul>
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