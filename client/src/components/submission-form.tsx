import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient"; // Added import
import type { InsertSubmission } from "@db/schema";
import { insertSubmissionSchema } from "@db/schema";
import { z } from "zod";

// Create a simpler schema for non-authenticated submissions
const unauthenticatedSchema = z.object({
  githubUrl: insertSubmissionSchema.shape.githubUrl,
  email: insertSubmissionSchema.shape.email,
});

export default function SubmissionForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<InsertSubmission>({
    resolver: zodResolver(user ? insertSubmissionSchema : unauthenticatedSchema),
    defaultValues: {
      githubUrl: "",
      email: user?.email || "",
    },
  });

  const handleSubmit = async (data: InsertSubmission) => {
    if (!user) {
      // Store GitHub URL in session storage and redirect to auth
      sessionStorage.setItem('pendingGithubUrl', data.githubUrl);
      if (data.email) {
        sessionStorage.setItem('pendingEmail', data.email);
      }
      setLocation('/auth');
      return;
    }

    try {
      const repoName = data.githubUrl.split("/").pop()?.replace(".git", "") || "New Project";
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: repoName,
          githubUrl: data.githubUrl,
          userId: user.id,
        }),
        credentials: 'include',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create project');
      }

      await res.json();

      // Invalidate the projects query to force a refresh
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });

      toast({
        title: "Success!",
        description: "Your project has been created.",
      });

      // Redirect to projects page after creation
      setLocation('/projects');
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to create project',
        variant: "destructive",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="githubUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-primary/90">GitHub Repository URL</FormLabel>
              <FormControl>
                <Input 
                  placeholder="https://github.com/user/repo" 
                  {...field} 
                  className="bg-black/50 border-primary/40 text-white placeholder:text-white/50 focus:border-primary/70"
                />
              </FormControl>
              <FormMessage className="text-white/90" />
            </FormItem>
          )}
        />

        {!user && (
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-primary/90">Email</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="your@email.com" 
                    type="email" 
                    {...field} 
                    className="bg-black/50 border-primary/40 text-white placeholder:text-white/50 focus:border-primary/70"
                  />
                </FormControl>
                <FormMessage className="text-white/90" />
              </FormItem>
            )}
          />
        )}

        <Button 
          type="submit" 
          className="w-full bg-primary hover:bg-primary/90 text-black"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {user ? 'Create Project' : 'Continue to Login'}
        </Button>
      </form>
    </Form>
  );
}