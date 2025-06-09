import { useParams, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, FileText, Code2, Settings, Users, Box, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Define the useActionFile hook directly in this file
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

// Action viewer components from analysis page
function ActionSummaryTab({ submissionId, contractName, functionName, action, actor }: {
  submissionId: string | undefined;
  contractName: string;
  functionName: string;
  action: any;
  actor: any;
}) {
  const { data: summaryData, isLoading, error } = useActionFile(submissionId, contractName, functionName, 'json');

  const realActionData = summaryData?.content;

  if (isLoading) {
    return (
      <div className="bg-black/40 p-6 rounded text-base flex items-center justify-center min-h-[200px]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <span className="text-white/60">Loading action details...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 p-6 rounded text-base">
        <p className="text-red-400 mb-2">Error loading action details:</p>
        <p className="text-red-300 text-sm">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="bg-black/40 p-6 rounded text-base">
      {realActionData ? (
        <div className="space-y-6">
          <div>
            <h4 className="text-green-400 text-lg font-semibold mb-3">Action Overview</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-white/80">
              <div>
                <span className="text-gray-400">Contract:</span>
                <p className="font-medium">{realActionData.action?.contract_name || contractName}</p>
              </div>
              <div>
                <span className="text-gray-400">Function:</span>
                <p className="font-medium">{realActionData.action?.function_name || functionName}</p>
              </div>
              <div>
                <span className="text-gray-400">Actor:</span>
                <p className="font-medium">{actor.name}</p>
              </div>
              <div>
                <span className="text-gray-400">Action:</span>
                <p className="font-medium">{realActionData.action?.name || action.name}</p>
              </div>
            </div>
          </div>
          
          {(realActionData.action?.summary || action.summary) && (
            <div>
              <h5 className="text-blue-400 font-medium mb-2">Description</h5>
              <p className="text-white/90">{realActionData.action?.summary || action.summary}</p>
            </div>
          )}

          {realActionData.action_detail?.pre_execution_parameter_generation_rules && (
            <div>
              <h5 className="text-yellow-400 font-medium mb-3">Parameter Generation Rules</h5>
              <div className="space-y-2">
                {realActionData.action_detail.pre_execution_parameter_generation_rules.map((rule: string, index: number) => (
                  <div key={index} className="bg-gray-800/50 p-3 rounded">
                    <p className="text-sm text-gray-200">{rule}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {realActionData.action_detail?.on_execution_state_updates_made && realActionData.action_detail.on_execution_state_updates_made.length > 0 && (
            <div>
              <h5 className="text-green-400 font-medium mb-3">State Updates</h5>
              <div className="space-y-2">
                {realActionData.action_detail.on_execution_state_updates_made.map((update: any, index: number) => (
                  <div key={index} className="bg-gray-800/50 p-3 rounded">
                    {typeof update === 'string' ? (
                      <p className="text-sm text-gray-200">{update}</p>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-green-300">{update.variable_name || update.name || 'State Variable'}</span>
                          {update.update_type && <Badge variant="outline" className="text-xs">{update.update_type}</Badge>}
                          {update.type && <Badge variant="outline" className="text-xs">{update.type}</Badge>}
                        </div>
                        <p className="text-sm text-gray-200">{update.description || update.details || JSON.stringify(update)}</p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {realActionData.action_detail?.expected_state_changes && realActionData.action_detail.expected_state_changes.length > 0 && (
            <div>
              <h5 className="text-purple-400 font-medium mb-3">Expected State Changes</h5>
              <div className="space-y-2">
                {realActionData.action_detail.expected_state_changes.map((change: any, index: number) => (
                  <div key={index} className="bg-purple-900/20 p-3 rounded border border-purple-700/30">
                    {typeof change === 'string' ? (
                      <p className="text-sm text-gray-200">{change}</p>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-purple-300">{change.variable || change.field || 'Variable'}</span>
                          {change.change_type && <Badge variant="outline" className="text-xs">{change.change_type}</Badge>}
                        </div>
                        <p className="text-sm text-gray-200">{change.description || change.expected_value || JSON.stringify(change)}</p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {realActionData.action_detail.description && (
            <div>
              <h5 className="text-blue-400 font-medium mb-2">Description</h5>
              <p className="text-white/90">{realActionData.action_detail.description}</p>
            </div>
          )}

          {realActionData.action_detail.parameters && realActionData.action_detail.parameters.length > 0 && (
            <div>
              <h5 className="text-blue-400 font-medium mb-3">Parameters</h5>
              <div className="space-y-3">
                {realActionData.action_detail.parameters.map((param: any, index: number) => (
                  <div key={index} className="bg-gray-800/50 p-3 rounded">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-yellow-300">{param.name}</span>
                      <Badge variant="outline" className="text-xs">{param.type}</Badge>
                    </div>
                    {param.description && (
                      <p className="text-sm text-gray-300">{param.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {realActionData.action_detail.expected_outcomes && (
            <div>
              <h5 className="text-blue-400 font-medium mb-2">Expected Outcomes</h5>
              <div className="text-white/90">
                {Array.isArray(realActionData.action_detail.expected_outcomes) ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {realActionData.action_detail.expected_outcomes.map((outcome: string, index: number) => (
                      <li key={index}>{outcome}</li>
                    ))}
                  </ul>
                ) : (
                  <p>{realActionData.action_detail.expected_outcomes}</p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-green-400 text-lg font-semibold mb-4">
            This action will call the <span className="font-bold">{action.function_name}</span> function on the <span className="font-bold">{action.contract_name}</span> contract.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-white/80">
            <div>
              <span className="text-gray-400">Contract:</span>
              <p className="font-medium">{action.contract_name}</p>
            </div>
            <div>
              <span className="text-gray-400">Function:</span>
              <p className="font-medium">{action.function_name}</p>
            </div>
            <div>
              <span className="text-gray-400">Actor:</span>
              <p className="font-medium">{actor.name}</p>
            </div>
          </div>
          
          <div>
            <p className="text-white/90">Parameters will be passed according to the function specification</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionCodeTab({ submissionId, contractName, functionName, action, sectionContext }: {
  submissionId: string | undefined;
  contractName: string;
  functionName: string;
  action: any;
  sectionContext: string;
}) {
  // Add line numbers to code
  const formatCodeWithLineNumbers = (code: string, title: string) => {
    const lines = code.split('\n');
    return (
      <div className="mb-6">
        <h4 className="text-blue-400 font-medium mb-3">{title}</h4>
        <div className="bg-gray-900/50 p-4 rounded">
          {lines.map((line, index) => (
            <div key={index} className="flex">
              <span className="text-gray-500 text-xs mr-4 select-none min-w-[3rem] text-right">
                {index + 1}
              </span>
              <span className="flex-1 text-green-400">{line}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Get code snippets from action context
  const codeSnippets = action.code_snippet || {};
  
  return (
    <div className="bg-black/40 p-6 rounded text-sm">
      {Object.keys(codeSnippets).length > 0 ? (
        <div className="space-y-6">
          <h3 className="text-green-400 text-lg font-semibold mb-4">Contract Code</h3>
          {Object.entries(codeSnippets).map(([contractName, code]) => 
            formatCodeWithLineNumbers(code as string, `${contractName}.sol`)
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg mb-2">No Contract Code Available</div>
          <p className="text-gray-500 text-sm">
            Code snippets will appear here once the contracts are implemented.
          </p>
        </div>
      )}
    </div>
  );
}

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
      <div className="bg-black/40 p-6 rounded text-base flex items-center justify-center min-h-[200px]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <span className="text-white/60">Loading validation rules...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 p-6 rounded text-base">
        <p className="text-red-400 mb-2">Error loading validation rules:</p>
        <p className="text-red-300 text-sm">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="bg-black/40 p-6 rounded text-base">
      {realActionData?.action_detail?.post_execution_contract_state_validation_rules ? (
        <div className="space-y-4">
          <p className="text-yellow-300 text-lg font-semibold mb-4">Post-Execution Validation Rules:</p>
          {realActionData.action_detail.post_execution_contract_state_validation_rules.map((category: any, categoryIndex: number) => (
            <div key={categoryIndex} className="space-y-2">
              <p className="text-blue-300 font-semibold text-base">{category.category}:</p>
              <ul className="list-disc pl-5 text-yellow-400 space-y-2">
                {category.rule_descriptions.map((rule: string, ruleIndex: number) => (
                  <li key={ruleIndex} className="text-sm">{rule}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <p className="text-yellow-300 text-lg font-semibold mb-4">Default Validation Rules:</p>
          <ul className="list-disc pl-5 text-yellow-400 space-y-2">
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

export default function ActionViewer() {
  const params = useParams();
  const [location] = useLocation();
  
  // Extract parameters from URL
  const submissionId = params.submissionId;
  const actorIndex = params.actorIndex;
  const actionIndex = params.actionIndex;
  
  // Parse URL search params to get actor and action data
  const searchParams = new URLSearchParams(window.location.search);
  const actorName = searchParams.get('actorName') || '';
  const actionName = searchParams.get('actionName') || '';
  const contractName = searchParams.get('contractName') || '';
  const functionName = searchParams.get('functionName') || '';
  const actorSummary = searchParams.get('actorSummary') || '';
  const actionSummary = searchParams.get('actionSummary') || '';

  // Fetch submission data to get complete action information
  const { data: submission, isLoading: submissionLoading, error: submissionError } = useQuery({
    queryKey: [`/api/submissions/${submissionId}`],
    enabled: !!submissionId
  });

  const [activeTab, setActiveTab] = useState("action-summary");

  // Debug logging
  console.log('ActionViewer params:', { submissionId, actorIndex, actionIndex });
  console.log('ActionViewer URL params:', { actorName, actionName, contractName, functionName, actorSummary, actionSummary });
  console.log('Submission data:', submission);
  console.log('Submission loading:', submissionLoading);
  console.log('Submission error:', submissionError);

  // Create mock objects for compatibility with existing components
  const actor = {
    name: actorName,
    summary: actorSummary,
    id: actorIndex
  };

  const action = {
    name: actionName,
    summary: actionSummary,
    contract_name: contractName,
    function_name: functionName,
    id: actionIndex
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm"
                asChild
                className="border-gray-700 hover:bg-gray-800"
              >
                <Link href={`/analysis/${submissionId}`}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Analysis
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-blue-400">{actionName}</h1>
                <p className="text-gray-400 text-sm">
                  {actorName} → {contractName}.{functionName}()
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-950/50 text-blue-300">
                <Users className="h-3 w-3 mr-1" />
                {actorName}
              </Badge>
              <Badge variant="outline" className="bg-purple-950/50 text-purple-300">
                <Box className="h-3 w-3 mr-1" />
                {contractName}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Action Details Header */}
      <div className="border-b border-gray-800 bg-gray-900/30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" />
              <div>
                <span className="text-gray-400">Actor:</span>
                <p className="text-white font-medium">{actorName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Box className="h-4 w-4 text-purple-400" />
              <div>
                <span className="text-gray-400">Contract:</span>
                <p className="text-white font-medium">{contractName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-green-400" />
              <div>
                <span className="text-gray-400">Function:</span>
                <p className="text-white font-medium">{functionName}()</p>
              </div>
            </div>
            <div className="flex items-center justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                className="border-gray-700 hover:bg-gray-800"
                asChild
              >
                <Link href={`/analysis/${submissionId}#test_setup`}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Back to Simulation
                </Link>
              </Button>
            </div>
          </div>
          
          {actionSummary && (
            <div className="mt-3 pt-3 border-t border-gray-800">
              <p className="text-gray-300 text-sm">{actionSummary}</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Full Width */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="border-b border-gray-800 px-6 py-4">
                <TabsList className="grid w-full max-w-2xl grid-cols-4 bg-gray-800/50">
                  <TabsTrigger value="action-summary" className="text-sm">
                    <FileText className="h-4 w-4 mr-1" />
                    Action Summary
                  </TabsTrigger>
                  <TabsTrigger value="contract-code" className="text-sm">
                    <Code2 className="h-4 w-4 mr-1" />
                    Contract Code
                  </TabsTrigger>
                  <TabsTrigger value="validation-rules" className="text-sm">
                    <Settings className="h-4 w-4 mr-1" />
                    Validation Rules
                  </TabsTrigger>
                  <TabsTrigger value="simulation-code" className="text-sm">
                    <Box className="h-4 w-4 mr-1" />
                    Simulation Code
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <div className="p-6">
                <TabsContent value="action-summary" className="mt-0">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold text-blue-400 mb-4">Action Summary</h3>
                      <ActionSummaryTab 
                        submissionId={submissionId}
                        contractName={contractName}
                        functionName={functionName}
                        action={action}
                        actor={actor}
                      />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="contract-code" className="mt-0">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold text-green-400 mb-4">Contract Code</h3>
                      <div className="bg-black/40 p-6 rounded text-base">
                        <p className="text-gray-400 mb-4">Smart contract source code for {contractName}</p>
                        <div className="bg-gray-900/80 p-4 rounded border border-gray-700">
                          <code className="text-green-400 text-sm">
                            // Contract code will be loaded from simulation repository<br/>
                            // Function: {functionName}()<br/>
                            // This tab will show the actual smart contract implementation
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="validation-rules" className="mt-0">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold text-purple-400 mb-4">Validation Rules</h3>
                      <ValidationRulesTab 
                        submissionId={submissionId}
                        contractName={contractName}
                        functionName={functionName}
                        action={action}
                        actor={actor}
                      />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="simulation-code" className="mt-0">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold text-orange-400 mb-4">Simulation Code</h3>
                      <div className="bg-black/60 rounded-lg p-6">
                        <ActionCodeTab 
                          submissionId={submissionId}
                          contractName={contractName}
                          functionName={functionName}
                          action={action}
                          sectionContext={`implementation-${actorIndex}-${actionIndex}`}
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}