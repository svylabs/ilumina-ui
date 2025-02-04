import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import TestResults from "@/components/test-results";
import { Loader2 } from "lucide-react";

export default function ResultsPage() {
  const { id } = useParams();

  const { data: submission, isLoading } = useQuery({
    queryKey: [`/api/submissions/${id}`],
    retry: false,
    refetchInterval: (data) => {
      // Refetch every 2 seconds if there's a running test
      return data?.runs?.some(run => run.status === "running") ? 2000 : false;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold text-center mb-4">Results Not Found</h2>
            <p className="text-muted-foreground">
              The requested test results could not be found.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Test Runs</h2>
              <p className="text-sm text-muted-foreground">
                Repository: {submission.githubUrl}
              </p>
            </div>
            <TestResults runs={submission.runs} submissionId={submission.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}