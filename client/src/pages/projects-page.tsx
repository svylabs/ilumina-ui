import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash2, Users, UserPlus, Settings } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Define the types for team data
type Team = {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: number;
  role: string;
  status: string;
  isCreator: boolean;
};

type TeamProject = SelectProject & {
  teamName?: string;
};

type ProjectsByTeam = {
  teamId: number | null;
  teamName: string;
  role?: string;
  projects: TeamProject[];
};

export default function ProjectsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get teams the user belongs to
  const { data: teams, isLoading: isLoadingTeams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    enabled: !!user && user.plan === 'teams',
  });

  // Get projects including team projects
  const { data: allProjectsData, isLoading: isLoadingProjects } = useQuery<{
    personalProjects: TeamProject[];
    teamProjects: TeamProject[];
    projectsByTeam: ProjectsByTeam[];
  }>({
    queryKey: ["/api/all-projects"],
    enabled: !!user,
    staleTime: 0, // Always refetch on mount
  });

  // For backward compatibility, use the regular projects endpoint too
  const { data: projects, isLoading: isLoadingOldProjects } = useQuery<SelectProject[]>({
    queryKey: ["/api/projects"],
    enabled: !!user && !allProjectsData,
  });

  const isTeamsUser = user?.plan === 'teams';
  const isLoading = isLoadingProjects || isLoadingTeams || isLoadingOldProjects;
  
  // Determine which projects to display
  const personalProjects = allProjectsData?.personalProjects || projects || [];
  // Filter team projects to only include actual team projects (those with teamId)
  const teamProjects = (allProjectsData?.teamProjects || []).filter(p => p.teamId !== null);
  const projectsByTeam = allProjectsData?.projectsByTeam || [];
  const hasTeamProjects = isTeamsUser && teamProjects.length > 0;

  const deleteMutation = useMutation({
    mutationFn: async (projectId: number) => {
      await apiRequest("DELETE", `/api/projects/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/all-projects"] });
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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted p-6 pt-28">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <svg className="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">My Projects</h1>
              <p className="text-sm text-white/70 mt-1">Manage and analyze your smart contract projects</p>
            </div>
          </div>
          <div className="flex gap-2">
            {isTeamsUser && (
              <Button asChild variant="outline">
                <Link href="/teams" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Manage Teams
                </Link>
              </Button>
            )}
            <Button asChild>
              <Link href="/new-project" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                New Project
              </Link>
            </Button>
          </div>
        </div>

        {!personalProjects.length && !hasTeamProjects ? (
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
          <div className="space-y-8">
            {/* Group projects by team */}
            {allProjectsData ? (
              // Display projects organized by team when using the new API
              projectsByTeam.map((teamGroup) => (
                <div key={teamGroup.teamId || 'personal'} className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      {teamGroup.teamId === null ? (
                        <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                        </svg>
                      ) : (
                        <Users className="h-5 w-5 text-primary" />
                      )}
                      <h2 className="text-xl font-semibold text-white">{teamGroup.teamName}</h2>
                      {teamGroup.teamId !== null && teamGroup.role === 'admin' && (
                        <Badge variant="outline" className="ml-2 bg-primary/10 text-primary">
                          Admin
                        </Badge>
                      )}
                    </div>
                    {teamGroup.teamId !== null && (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/teams/${teamGroup.teamId}`}>
                          <Settings className="h-4 w-4 mr-1" /> Team Settings
                        </Link>
                      </Button>
                    )}
                  </div>
                  
                  {teamGroup.projects.length === 0 ? (
                    <Card className="border-primary/20 bg-black/50">
                      <CardContent className="p-4 text-center">
                        <p className="text-white/70">
                          {teamGroup.teamId === null 
                            ? "You don't have any personal projects yet." 
                            : "This team doesn't have any projects yet."}
                        </p>
                        <Button variant="outline" size="sm" className="mt-2" asChild>
                          <Link href="/new-project">Add Project</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-4">
                      {teamGroup.projects.map((project) => (
                        <ProjectCard 
                          key={project.id} 
                          project={project} 
                          isTeamProject={teamGroup.teamId !== null}
                          teamName={teamGroup.teamName}
                          onDelete={() => deleteMutation.mutate(project.id)}
                          canDelete={teamGroup.teamId === null || teamGroup.role === 'admin'}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              // Display projects for backward compatibility
              <div className="grid gap-4">
                {projects?.map((project) => (
                  <ProjectCard 
                    key={project.id} 
                    project={project} 
                    isTeamProject={false}
                    onDelete={() => deleteMutation.mutate(project.id)}
                    canDelete={true}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Project card component
function ProjectCard({ 
  project, 
  isTeamProject = false, 
  teamName,
  onDelete, 
  canDelete = true 
}: { 
  project: TeamProject, 
  isTeamProject?: boolean, 
  teamName?: string,
  onDelete: () => void, 
  canDelete?: boolean 
}) {
  return (
    <Card className="border-primary/20 bg-black/50 hover:border-primary/40 transition-colors overflow-hidden">
      <Link href={`/analysis/${project.id}`} className="block">
        <CardContent className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-semibold text-white">
                  {project.name}
                </h3>
                {isTeamProject && (
                  <Badge variant="secondary" className="bg-primary/10 text-xs">
                    {teamName || 'Team Project'}
                  </Badge>
                )}
              </div>
              {project.githubUrl && (
                <p className="text-sm text-white/70 mt-1 truncate max-w-[400px]">
                  {project.githubUrl}
                </p>
              )}
              <p className="text-sm text-white/50 mt-2">
                Created {format(new Date(project.createdAt), "PPP")}
              </p>
            </div>
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              {canDelete && (
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
                        onClick={onDelete}
                        className="bg-red-600 text-white hover:bg-red-700"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}