import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  Plus, 
  UserPlus, 
  Users, 
  Mail, 
  Settings, 
  Trash2, 
  ChevronRight,
  CircleCheck
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

// Define types for team data
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

type TeamMember = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  joinedAt: string;
  invitedBy: number;
};

type TeamInvitation = {
  id: number;
  email: string;
  invitedAt: string;
  status: string;
  expiresAt: string;
  inviterName: string;
  inviterEmail: string;
};

// Form schemas
const createTeamSchema = z.object({
  name: z.string().min(2, "Team name must be at least 2 characters").max(50, "Team name cannot exceed 50 characters"),
  description: z.string().optional(),
});
type CreateTeamFormData = z.infer<typeof createTeamSchema>;

const inviteUserSchema = z.object({
  email: z.string().email("Must be a valid email address"),
  role: z.enum(["member", "admin"]).default("member"),
});
type InviteUserFormData = z.infer<typeof inviteUserSchema>;

export default function TeamsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();

  // Check if the user can create teams
  const { data: canCreateTeam, isLoading: isLoadingTeamCheck } = useQuery({
    queryKey: ["/api/can-create-team"],
    enabled: !!user,
  });

  // Get teams the user belongs to
  const { data: teams, isLoading: isLoadingTeams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    enabled: !!user,
  });

  const isLoading = isLoadingTeamCheck || isLoadingTeams;
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);

  const createTeamForm = useForm<CreateTeamFormData>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const createTeamMutation = useMutation({
    mutationFn: async (data: CreateTeamFormData) => {
      return await apiRequest("POST", "/api/teams", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setIsCreateTeamOpen(false);
      createTeamForm.reset();
      toast({
        title: "Team created",
        description: "Your new team has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating team",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateTeamSubmit = (data: CreateTeamFormData) => {
    createTeamMutation.mutate(data);
  };

  if (!user) {
    return <Link href="/auth">Please login to view your teams</Link>;
  }

  if (user.plan !== 'teams') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted p-6 pt-28">
        <div className="max-w-4xl mx-auto">
          <Card className="border-primary/20 bg-black/50">
            <CardHeader>
              <CardTitle>Teams Feature</CardTitle>
              <CardDescription>
                Team management is only available for Teams plan subscribers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-lg text-white/70 mb-4">
                Upgrade to our Teams plan to access the following features:
              </p>
              <ul className="list-disc list-inside text-white/70 space-y-2">
                <li>Create and manage multiple teams</li>
                <li>Invite team members via email</li>
                <li>Assign roles and permissions</li>
                <li>Collaborate on projects within teams</li>
                <li>Unlimited simulations for all team members</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild>
                <a href="/pricing">View Pricing Plans</a>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
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
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">My Teams</h1>
              <p className="text-sm text-white/70 mt-1">Create and manage your teams</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/projects" className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4" />
                Projects
              </Link>
            </Button>
            <Dialog open={isCreateTeamOpen} onOpenChange={setIsCreateTeamOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Team
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-black/95 border-primary/20">
                <DialogHeader>
                  <DialogTitle className="text-white">Create New Team</DialogTitle>
                  <DialogDescription className="text-white/70">
                    Create a new team to collaborate with others on your projects.
                  </DialogDescription>
                </DialogHeader>
                <Form {...createTeamForm}>
                  <form onSubmit={createTeamForm.handleSubmit(handleCreateTeamSubmit)} className="space-y-4">
                    <FormField
                      control={createTeamForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Team Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter team name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createTeamForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Description (optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Brief description of your team"
                              className="resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button 
                        type="submit" 
                        disabled={createTeamMutation.isPending}
                        className="w-full"
                      >
                        {createTeamMutation.isPending && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        Create Team
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {!teams?.length ? (
          <Card className="border-primary/20 bg-black/50">
            <CardContent className="p-6 text-center">
              <p className="text-lg text-white/70 mb-4">
                You don't have any teams yet.
              </p>
              <Button onClick={() => setIsCreateTeamOpen(true)}>
                Create Your First Team
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {teams.map((team) => (
              <Card
                key={team.id}
                className="border-primary/20 bg-black/50 hover:border-primary/40 transition-colors"
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl font-semibold text-white">
                      {team.name}
                    </CardTitle>
                    {team.role === 'admin' && (
                      <Badge variant="outline" className="bg-primary/10 text-primary">
                        Admin
                      </Badge>
                    )}
                  </div>
                  {team.description && (
                    <CardDescription className="text-white/70 mt-1">
                      {team.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex items-center gap-2 text-white/70 text-sm">
                    <Users className="h-4 w-4" />
                    <span>Created {format(new Date(team.createdAt), "MMMM d, yyyy")}</span>
                  </div>
                </CardContent>
                <Separator className="bg-primary/10" />
                <CardFooter className="pt-4">
                  <div className="w-full flex justify-between items-center">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/teams/${team.id}`} className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Manage
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/projects?team=${team.id}`} className="flex items-center gap-2">
                        <ChevronRight className="h-4 w-4" />
                        View Projects
                      </Link>
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Add the missing import
import { useState } from "react";

// Add the team detail page component
export function TeamDetailPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  
  // Extract team ID from URL
  const teamId = location.split('/').pop();
  
  // Get team details
  const { data: teamDetails, isLoading: isLoadingTeam } = useQuery({
    queryKey: [`/api/teams/${teamId}`],
    enabled: !!user && !!teamId,
  });
  
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  
  const inviteForm = useForm<InviteUserFormData>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      email: "",
      role: "member",
    },
  });
  
  const inviteMutation = useMutation({
    mutationFn: async (data: InviteUserFormData) => {
      return await apiRequest("POST", `/api/teams/${teamId}/invite`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}`] });
      setIsInviteDialogOpen(false);
      inviteForm.reset();
      toast({
        title: "Invitation sent",
        description: "The user has been invited to join your team.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error sending invitation",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const deleteTeamMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/teams/${teamId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setLocation("/teams");
      toast({
        title: "Team deleted",
        description: "The team has been successfully deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting team",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: number) => {
      return await apiRequest("DELETE", `/api/teams/${teamId}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}`] });
      toast({
        title: "Member removed",
        description: "The team member has been removed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error removing member",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      return await apiRequest("PATCH", `/api/teams/${teamId}/members/${userId}`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}`] });
      toast({
        title: "Role updated",
        description: "The member's role has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating role",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleInviteSubmit = (data: InviteUserFormData) => {
    inviteMutation.mutate(data);
  };
  
  if (!user) {
    return <Link href="/auth">Please login to view team details</Link>;
  }
  
  if (isLoadingTeam) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  if (!teamDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted p-6 pt-28">
        <div className="max-w-4xl mx-auto">
          <Card className="border-primary/20 bg-black/50">
            <CardHeader>
              <CardTitle>Team Not Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-white/70">
                The team you're looking for could not be found or you don't have access to it.
              </p>
            </CardContent>
            <CardFooter>
              <Link href="/teams">
                <Button variant="outline" className="gap-2">
                  <ChevronRight className="h-4 w-4 rotate-180" />
                  Back to Teams
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted p-6 pt-28">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Team Header */}
        <div className="flex justify-between items-start">
          <div>
            <Link href="/teams">
              <Button variant="outline" className="gap-2 mb-2">
                <ChevronRight className="h-4 w-4 rotate-180" />
                Back to Teams
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold text-white">{teamDetails.name}</h1>
                  {teamDetails.userRole === "admin" && (
                    <Badge variant="outline" className="bg-primary/10 text-primary">
                      Admin
                    </Badge>
                  )}
                </div>
                {teamDetails.description && (
                  <p className="text-sm text-white/70 mt-1">{teamDetails.description}</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-black/95 border-primary/20">
                <DialogHeader>
                  <DialogTitle className="text-white">Invite Team Member</DialogTitle>
                  <DialogDescription className="text-white/70">
                    Invite someone to join your team. They'll receive an email invitation.
                  </DialogDescription>
                </DialogHeader>
                <Form {...inviteForm}>
                  <form onSubmit={inviteForm.handleSubmit(handleInviteSubmit)} className="space-y-4">
                    <FormField
                      control={inviteForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Email</FormLabel>
                          <FormControl>
                            <Input placeholder="email@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={inviteForm.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Role</FormLabel>
                          <div className="flex gap-4">
                            <div className="flex items-center">
                              <input
                                type="radio"
                                id="member-role"
                                value="member"
                                checked={field.value === "member"}
                                onChange={() => field.onChange("member")}
                                className="mr-2"
                              />
                              <label htmlFor="member-role" className="text-white">Member</label>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="radio"
                                id="admin-role"
                                value="admin"
                                checked={field.value === "admin"}
                                onChange={() => field.onChange("admin")}
                                className="mr-2"
                              />
                              <label htmlFor="admin-role" className="text-white">Admin</label>
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button 
                        type="submit" 
                        disabled={inviteMutation.isPending}
                        className="w-full"
                      >
                        {inviteMutation.isPending && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        Send Invitation
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
            
            {teamDetails.isCreator && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Team
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-black/95 border-primary/20">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-white">Delete Team</AlertDialogTitle>
                    <AlertDialogDescription className="text-white/70">
                      Are you sure you want to delete this team? All team data will be lost, but projects will remain accessible to their respective owners.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-muted text-white hover:bg-muted/90">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteTeamMutation.mutate()}
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
        
        {/* Team Content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Members Section */}
          <div className="md:col-span-2">
            <Card className="border-primary/20 bg-black/50">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-white">
                  Team Members
                </CardTitle>
                <CardDescription className="text-white/70">
                  {teamDetails.members.length} {teamDetails.members.length === 1 ? "member" : "members"} in this team
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {teamDetails.members.map((member: TeamMember) => (
                    <div 
                      key={member.id} 
                      className="flex justify-between items-center p-3 rounded-md bg-black/30 border border-primary/10"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-primary text-sm">{member.name.slice(0, 2).toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="font-medium text-white">{member.name}</p>
                            <p className="text-sm text-white/70">{member.email}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {member.role === "admin" ? (
                          <Badge variant="outline" className="bg-primary/10 text-primary">
                            Admin
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-white/10 text-white/70">
                            Member
                          </Badge>
                        )}
                        
                        {/* Role actions - only for admins */}
                        {teamDetails.userRole === "admin" && member.id !== user.id && !teamDetails.isCreator && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateRoleMutation.mutate({
                              userId: member.id,
                              role: member.role === "admin" ? "member" : "admin"
                            })}
                          >
                            {member.role === "admin" ? "Make Member" : "Make Admin"}
                          </Button>
                        )}
                        
                        {/* Remove member button */}
                        {((teamDetails.userRole === "admin" && member.id !== user.id) || 
                           member.id === user.id) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                {member.id === user.id ? "Leave" : "Remove"}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-black/95 border-primary/20">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-white">
                                  {member.id === user.id ? "Leave Team" : "Remove Member"}
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-white/70">
                                  {member.id === user.id 
                                    ? "Are you sure you want to leave this team? You'll need to be invited again to rejoin."
                                    : `Are you sure you want to remove ${member.name} from this team?`}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-muted text-white hover:bg-muted/90">
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => removeMemberMutation.mutate(member.id)}
                                  className="bg-red-600 text-white hover:bg-red-700"
                                >
                                  {member.id === user.id ? "Leave Team" : "Remove"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Pending Invitations */}
          <div>
            <Card className="border-primary/20 bg-black/50">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-white">
                  Pending Invitations
                </CardTitle>
                <CardDescription className="text-white/70">
                  {teamDetails.pendingInvitations.length} {teamDetails.pendingInvitations.length === 1 ? "invitation" : "invitations"} pending
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {teamDetails.pendingInvitations.length === 0 ? (
                    <p className="text-white/70 text-center py-4">No pending invitations</p>
                  ) : (
                    teamDetails.pendingInvitations.map((invitation: TeamInvitation) => (
                      <div 
                        key={invitation.id} 
                        className="p-3 rounded-md bg-black/30 border border-primary/10"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Mail className="h-4 w-4 text-primary" />
                          <p className="font-medium text-white">{invitation.email}</p>
                        </div>
                        <p className="text-sm text-white/70">
                          Invited {format(new Date(invitation.invitedAt), "MMM d, yyyy")}
                        </p>
                      </div>
                    ))
                  )}
                  
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setIsInviteDialogOpen(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite New Member
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Team Projects Quick View */}
            <Card className="border-primary/20 bg-black/50 mt-6">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-white">
                  Team Projects
                </CardTitle>
                <CardDescription className="text-white/70">
                  {teamDetails.projects.filter((p: any) => p.teamId === parseInt(teamId)).length} {teamDetails.projects.filter((p: any) => p.teamId === parseInt(teamId)).length === 1 ? "project" : "projects"} in this team
                </CardDescription>
              </CardHeader>
              <CardContent>
                {teamDetails.projects.filter((p: any) => p.teamId === parseInt(teamId)).length === 0 ? (
                  <p className="text-white/70 text-center py-4">No projects in this team yet</p>
                ) : (
                  <div className="space-y-3">
                    {teamDetails.projects.filter((p: any) => p.teamId === parseInt(teamId)).slice(0, 5).map((project: any) => (
                      <div 
                        key={project.id} 
                        className="p-3 rounded-md bg-black/30 border border-primary/10"
                      >
                        <p className="font-medium text-white">{project.name}</p>
                        {project.githubUrl && (
                          <p className="text-sm text-white/70 truncate">
                            {project.githubUrl}
                          </p>
                        )}
                      </div>
                    ))}
                    {teamDetails.projects.filter((p: any) => p.teamId === parseInt(teamId)).length > 5 && (
                      <p className="text-sm text-primary text-center">
                        +{teamDetails.projects.filter((p: any) => p.teamId === parseInt(teamId)).length - 5} more projects
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/projects?team=${teamId}`}>
                    View All Projects
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}