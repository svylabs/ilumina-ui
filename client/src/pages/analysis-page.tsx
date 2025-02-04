import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, CircleDot } from "lucide-react";

type AnalysisStep = {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed";
};

const analysisSteps: AnalysisStep[] = [
  {
    id: "files",
    title: "File Analysis",
    description: "Identifying repository structure and smart contract files",
    status: "pending"
  },
  {
    id: "abi",
    title: "ABI Detection",
    description: "Locating ABI files or identifying compilation requirements",
    status: "pending"
  },
  {
    id: "workspace",
    title: "Workspace Setup",
    description: "Setting up development workspace and compiling code to ABIs",
    status: "pending"
  },
  {
    id: "test_setup",
    title: "Test Environment",
    description: "Configuring test workspace with flocc-ext library",
    status: "pending"
  },
  {
    id: "actors",
    title: "Actor Analysis",
    description: "Identifying actors and implementing their actions",
    status: "pending"
  }
];

function StepStatus({ status }: { status: AnalysisStep["status"] }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-6 w-6 text-green-500" />;
    case "failed":
      return <XCircle className="h-6 w-6 text-red-500" />;
    case "in_progress":
      return <Loader2 className="h-6 w-6 animate-spin text-blue-500" />;
    default:
      return <CircleDot className="h-6 w-6 text-gray-300" />;
  }
}

export default function AnalysisPage() {
  const { id } = useParams();
  
  const { data: analysis, isLoading } = useQuery({
    queryKey: [`/api/analysis/${id}`],
    refetchInterval: (data) => {
      return data?.status === "completed" || data?.status === "failed" ? false : 2000;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Smart Contract Analysis
          </h1>
          <p className="text-muted-foreground text-lg">
            Analyzing repository structure and preparing test environment
          </p>
        </div>

        <div className="grid gap-4">
          {analysisSteps.map((step) => (
            <Card key={step.id}>
              <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">{step.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {step.description}
                    </p>
                  </div>
                  <StepStatus status={analysis?.steps?.[step.id]?.status || "pending"} />
                </div>
                {analysis?.steps?.[step.id]?.details && (
                  <div className="mt-4 p-3 bg-muted rounded-md">
                    <pre className="text-sm whitespace-pre-wrap">
                      {analysis.steps[step.id].details}
                    </pre>
                  </div>
                )}
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
