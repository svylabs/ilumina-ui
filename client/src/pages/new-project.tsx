import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import type { InsertProject } from "@db/schema";
import { insertProjectSchema } from "@db/schema";

export default function NewProjectPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [extractedName, setExtractedName] = useState("");

  // Get existing projects to check limits
  const { data: projects } = useQuery<InsertProject[]>({
    queryKey: ["/api/projects"],
    enabled: !!user,
  });

  const form = useForm<InsertProject>({
    resolver: zodResolver(insertProjectSchema),
    defaultValues: {
      name: "",
      githubUrl: "",
      userId: user?.id,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: InsertProject) => {
      const res = await apiRequest("POST", "/api/projects", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success!",
        description: "Project created successfully.",
      });
      setLocation(`/analysis/${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Extract project name from GitHub URL
  const handleGitHubUrlChange = (url: string) => {
    const match = url.match(/github\.com\/[^/]+\/([^/]+)/);
    if (match) {
      const name = match[1].replace(/.git$/, '');
      setExtractedName(name);
      form.setValue('name', name);
    }
  };

  if (!user) {
    return <div>Please login to create a project</div>;
  }

  const maxProjects = user.plan === 'teams' ? Infinity : 
                     user.plan === 'pro' ? 3 : 1;

  const projectCount = projects?.length || 0;
  const canAddProject = projectCount < maxProjects;

  if (!canAddProject) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted p-6">
        <div className="max-w-md mx-auto">
          <Card className="border-primary/20 bg-black/50">
            <CardContent className="p-6 text-center space-y-4">
              <h2 className="text-xl font-bold text-white">Project Limit Reached</h2>
              <p className="text-white/70">
                You've reached the maximum number of projects for your {user.plan} plan.
              </p>
              <Button asChild variant="default">
                <a href="/#pricing">Upgrade Plan</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted p-6">
      <div className="max-w-md mx-auto">
        <Card className="border-primary/20 bg-black/50">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold text-white mb-6">Create New Project</h2>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => mutation.mutate({...data, userId: user.id}))} className="space-y-6">
                <FormField
                  control={form.control}
                  name="githubUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">GitHub Repository URL</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://github.com/user/repo" 
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            handleGitHubUrlChange(e.target.value);
                          }}
                          className="bg-black/50 border-primary/40 text-white"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Project Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Project name"
                          {...field}
                          className="bg-black/50 border-primary/40 text-white"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-primary/90 text-black"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Project
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}