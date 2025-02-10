import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { Link } from "wouter";
import type { SelectProject } from "@db/schema";
import { format } from "date-fns";

export default function ProjectsPage() {
  const { user } = useAuth();

  const { data: projects, isLoading } = useQuery<SelectProject[]>({
    queryKey: ["/api/projects"],
    enabled: !!user,
  });

  if (!user) {
    return <Link href="/auth">Redirecting to login...</Link>;
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
                    <Button asChild variant="secondary">
                      <Link href={`/analysis/${project.id}`}>View Analysis</Link>
                    </Button>
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