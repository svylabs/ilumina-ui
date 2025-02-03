import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface TestResult {
  passed: boolean;
  output?: string;
  duration: number; // in milliseconds
  category: string;
  errorDetails?: {
    message: string;
    stackTrace?: string;
  };
}

interface TestResults {
  summary: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
  };
  results: {
    [category: string]: {
      [testName: string]: TestResult;
    };
  };
}

interface TestResultsProps {
  results: string | null;
}

export default function TestResults({ results }: TestResultsProps) {
  if (!results) {
    return (
      <p className="text-muted-foreground">No test results available yet.</p>
    );
  }

  const parsedResults = JSON.parse(results) as TestResults;
  const { summary } = parsedResults;

  return (
    <div className="space-y-6">
      {/* Summary Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center space-x-3">
          <div className="p-2 bg-muted rounded-full">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Duration</p>
            <p className="text-lg font-semibold">
              {(summary.duration / 1000).toFixed(2)}s
            </p>
          </div>
        </Card>
        <Card className="p-4 flex items-center space-x-3">
          <div className="p-2 bg-muted rounded-full">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Tests</p>
            <p className="text-lg font-semibold">{summary.total}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center space-x-3">
          <div className="p-2 bg-green-100 rounded-full">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Passed</p>
            <p className="text-lg font-semibold">{summary.passed}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center space-x-3">
          <div className="p-2 bg-red-100 rounded-full">
            <XCircle className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Failed</p>
            <p className="text-lg font-semibold">{summary.failed}</p>
          </div>
        </Card>
      </div>

      {/* Detailed Results Section */}
      <Accordion type="single" collapsible className="space-y-4">
        {Object.entries(parsedResults.results).map(([category, tests]) => (
          <AccordionItem key={category} value={category}>
            <AccordionTrigger className="text-lg font-semibold hover:no-underline">
              <div className="flex items-center space-x-2">
                <span>{category}</span>
                <Badge variant={Object.values(tests).every(t => t.passed) ? "default" : "destructive"}>
                  {Object.values(tests).filter(t => t.passed).length}/{Object.values(tests).length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-4">
                {Object.entries(tests).map(([testName, result]) => (
                  <Card key={testName} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {result.passed ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <h3 className="font-medium">{testName}</h3>
                      </div>
                      <Badge variant="outline">
                        {(result.duration / 1000).toFixed(2)}s
                      </Badge>
                    </div>
                    {!result.passed && result.errorDetails && (
                      <div className="mt-2 p-3 bg-red-50 rounded-md text-sm">
                        <p className="text-red-600 font-medium">
                          {result.errorDetails.message}
                        </p>
                        {result.errorDetails.stackTrace && (
                          <pre className="mt-2 text-xs text-red-500 overflow-x-auto">
                            {result.errorDetails.stackTrace}
                          </pre>
                        )}
                      </div>
                    )}
                    {result.output && (
                      <pre className="mt-2 p-3 bg-muted rounded-md text-sm overflow-x-auto whitespace-pre-wrap">
                        {result.output}
                      </pre>
                    )}
                  </Card>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}