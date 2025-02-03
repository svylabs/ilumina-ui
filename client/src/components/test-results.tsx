import { Card } from "@/components/ui/card";

interface TestResult {
  passed: boolean;
  output?: string;
}

interface TestResults {
  [testName: string]: TestResult;
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

  return (
    <div className="space-y-4">
      {Object.entries(parsedResults).map(([testName, result]) => (
        <Card key={testName} className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">{testName}</h3>
            <span className={result.passed ? "text-green-500" : "text-red-500"}>
              {result.passed ? "Passed" : "Failed"}
            </span>
          </div>
          {result.output && (
            <pre className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
              {result.output}
            </pre>
          )}
        </Card>
      ))}
    </div>
  );
}