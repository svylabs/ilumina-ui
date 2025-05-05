import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash2, Users, UserPlus, Settings } from "lucide-react";
import { Link, useLocation } from "wouter";
import type { SelectProject } from "@db/schema";
import { format } from "date-fns";
import * as React from "react";
import DeleteProjectDialog from "@/components/delete-project-dialog";
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
  
  // Fetch project verification data to check which projects are accessible
  const [verifiedProjects, setVerifiedProjects] = React.useState<Record<number, boolean>>({});
  const [isVerifying, setIsVerifying] = React.useState(false);

  // Helper to verify project accessibility
  // We assume the backend has already filtered projects correctly
  const verifyProjectAccess = React.useCallback(async (projectId: number) => {
    // Trust that the backend already filtered projects correctly
    return true;
  }, []);

  // Set all projects as verified without making API calls
  React.useEffect(() => {
    const projectsToVerify = [...(allProjectsData?.personalProjects || []), ...(allProjectsData?.teamProjects || [])];
    
    if (projectsToVerify.length > 0 && !isVerifying) {
      // Set all projects as verified without making individual requests
      const verificationResults: Record<number, boolean> = {};
      
      // Mark all returned projects as verified (true)
      for (const project of projectsToVerify) {
        verificationResults[project.id] = true;
      }
      
      setVerifiedProjects(verificationResults);
    }
  }, [allProjectsData, isVerifying]);

  // Determine which projects to display
  // Make sure personal projects only includes projects with no teamId and are accessible
  const rawPersonalProjects = allProjectsData?.personalProjects || projects || [];
  console.log("Raw personal projects:", rawPersonalProjects.map(p => ({ id: p.id, name: p.name, teamId: p.teamId, teamIdType: typeof p.teamId })));
  
  const personalProjects = rawPersonalProjects.filter(p => {
    // Only include projects that have no teamId AND are verified accessible
    // If verification is ongoing or not done yet, include them for now
    return p.teamId === null && (Object.keys(verifiedProjects).length === 0 || verifiedProjects[p.id] !== false);
  });
  console.log("Filtered personal projects:", personalProjects.map(p => ({ id: p.id, name: p.name })));
  
  // Filter team projects to only include actual team projects (those with teamId) and are accessible
  const rawTeamProjects = allProjectsData?.teamProjects || [];
  console.log("Raw team projects:", rawTeamProjects.map(p => ({ id: p.id, name: p.name, teamId: p.teamId, teamIdType: typeof p.teamId })));
  
  const teamProjects = rawTeamProjects.filter(p => {
    // Only include projects that have a teamId AND are verified accessible
    // If verification is ongoing or not done yet, include them for now
    return p.teamId !== null && (Object.keys(verifiedProjects).length === 0 || verifiedProjects[p.id] !== false);
  });
  console.log("Filtered team projects:", teamProjects.map(p => ({ id: p.id, name: p.name, teamId: p.teamId })));
  
  // Filter projectsByTeam to only include accessible projects
  const projectsByTeam = allProjectsData?.projectsByTeam?.map(teamGroup => {
    // If we're still verifying or have no verification results, return all projects
    if (Object.keys(verifiedProjects).length === 0) return teamGroup;
    
    // Otherwise filter out inaccessible projects
    return {
      ...teamGroup,
      projects: teamGroup.projects.filter(p => verifiedProjects[p.id] !== false)
    };
  }) || [];
  
  const hasTeamProjects = isTeamsUser && teamProjects.length > 0;

  const deleteMutation = useMutation({
    mutationFn: async (projectId: number) => {
      console.log(`Attempting to delete project with ID: ${projectId}`);
      try {
        const response = await apiRequest("DELETE", `/api/projects/${projectId}`);
        console.log(`Delete API response:`, response);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`Delete API error response:`, errorData);
          
          // Handle 403 permission errors specifically
          if (response.status === 403) {
            throw new Error(errorData.message || "You don't have permission to delete this project");
          } else {
            throw new Error(errorData.message || "Failed to delete project");
          }
        }
        return response;
      } catch (err) {
        console.error("Project deletion error:", err);
        throw err;
      }
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
      console.error("Project deletion error:", error);
      toast({
        title: "Error deleting project",
        description: error.message || "Failed to delete the project. Please try again.",
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
                      {teamGroup.teamId === null ? (
                        <h2 className="text-xl font-semibold text-white">{teamGroup.teamName}</h2>
                      ) : (
                        <Link href={`/teams/${teamGroup.teamId}`} className="hover:text-primary transition-colors">
                          <h2 className="text-xl font-semibold text-white">{teamGroup.teamName}</h2>
                        </Link>
                      )}
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
  const navigate = useLocation()[1];
  
  const handleCardClick = (e: React.MouseEvent) => {
    // If the click was on the delete button or dialog, don't navigate
    const target = e.target as HTMLElement;
    if (!target.closest('.delete-action')) {
      // Using navigate instead of direct window.location to avoid page reload
      navigate(`/analysis/${project.id}`);
    }
  };

  return (
    <Card className="border-primary/20 bg-black/50 hover:border-primary/40 transition-colors overflow-hidden cursor-pointer">
      <CardContent className="p-6" onClick={handleCardClick}>
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
          {canDelete && (
            <div className="delete-action" onClick={(e) => e.stopPropagation()}>
              <DeleteProjectDialog 
                projectName={project.name}
                onDelete={() => {
                  console.log(`Triggering delete for project ${project.id} - ${project.name}`);
                  onDelete();
                }}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}