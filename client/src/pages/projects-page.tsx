import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Link } from "wouter";
import type { SelectProject } from "@db/schema";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ProjectsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projects, isLoading } = useQuery<SelectProject[]>({
    queryKey: ["/api/projects"],
    enabled: !!user,
    staleTime: 0, // Always refetch on mount
  });

  const deleteMutation = useMutation({
    mutationFn: async (projectId: number) => {
      await apiRequest("DELETE", `/api/projects/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project deleted",
        description: "The project has been successfully deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!user) {
    return <Link href="/auth">Please login to view your projects</Link>;
  }

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
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">My Projects</h1>
          <Button asChild>
            <Link href="/new-project" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Project
            </Link>
          </Button>
        </div>

        {!projects?.length ? (
          <Card className="border-primary/20 bg-black/50">
            <CardContent className="p-6 text-center">
              <p className="text-lg text-white/70 mb-4">
                You don't have any projects yet.
              </p>
              <Button asChild>
                <Link href="/new-project">Add Your First Project</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="border-primary/20 bg-black/50 hover:border-primary/40 transition-colors"
              >
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        {project.name}
                      </h3>
                      {project.githubUrl && (
                        <p className="text-sm text-white/70 mt-1">
                          {project.githubUrl}
                        </p>
                      )}
                      <p className="text-sm text-white/50 mt-2">
                        Created {format(new Date(project.createdAt), "PPP")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild variant="secondary">
                        <Link href={`/analysis/${project.id}`}>View Analysis</Link>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-black/95 border-primary/20">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-white">Delete Project</AlertDialogTitle>
                            <AlertDialogDescription className="text-white/70">
                              Are you sure you want to delete "{project.name}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-muted text-white hover:bg-muted/90">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(project.id)}
                              className="bg-red-600 text-white hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}