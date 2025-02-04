import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCcw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import type { SelectRun } from "@db/schema";

interface TestResultsProps {
  runs: SelectRun[];
  submissionId: number;
}

export default function TestResults({ runs, submissionId }: TestResultsProps) {
  const queryClient = useQueryClient();

  const rerunMutation = useMutation({
    mutationFn: async (runId: number) => {
      await apiRequest("POST", `/api/runs/${runId}/rerun`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries([`/api/submissions/${submissionId}`]);
    },
  });

  if (!runs?.length) {
    return (
      <p className="text-muted-foreground">No test runs available yet.</p>
    );
  }

  return (
    <div className="space-y-4">
      {runs.map((run) => (
        <Card key={run.id} className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-4">
              <div>
                <span className="text-sm text-muted-foreground">Run #{run.id}</span>
                <p className="font-medium">
                  Started: {format(new Date(run.startedAt), "MMM d, yyyy HH:mm:ss")}
                </p>
                {run.completedAt && (
                  <p className="text-sm text-muted-foreground">
                    Completed: {format(new Date(run.completedAt), "MMM d, yyyy HH:mm:ss")}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge 
                variant={
                  run.status === "success" ? "default" :
                  run.status === "failed" ? "destructive" :
                  run.status === "running" ? "secondary" :
                  "outline"
                }
              >
                {run.status === "running" && (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                )}
                {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
              </Badge>
              {(run.status === "failed" || run.status === "success") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => rerunMutation.mutate(run.id)}
                  disabled={rerunMutation.isPending}
                >
                  <RefreshCcw className="h-4 w-4 mr-1" />
                  Re-run
                </Button>
              )}
            </div>
          </div>
          {run.latestLog && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-1">Latest Log:</p>
              <pre className="p-3 bg-muted rounded-md text-sm overflow-x-auto whitespace-pre-wrap">
                {run.latestLog}
              </pre>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}