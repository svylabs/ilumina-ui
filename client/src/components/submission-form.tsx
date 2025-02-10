import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { InsertSubmission } from "@db/schema";
import { insertSubmissionSchema } from "@db/schema";

export default function SubmissionForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<InsertSubmission>({
    resolver: zodResolver(insertSubmissionSchema),
    defaultValues: {
      githubUrl: "",
      email: user?.email || "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: InsertSubmission) => {
      const res = await apiRequest("POST", "/api/submissions", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success!",
        description: "Your submission has been received.",
      });

      if (!user) {
        // Store GitHub URL in session storage for later project creation
        sessionStorage.setItem('pendingGithubUrl', form.getValues('githubUrl'));
        setLocation('/auth');
      } else {
        setLocation(`/analysis/${data.id}`);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
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
          disabled={mutation.isPending}
        >
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Run Simulation
        </Button>
      </form>
    </Form>
  );
}