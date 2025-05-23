import { ReactNode, createContext, useContext } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { SelectUser } from "@db/schema";
import { apiRequest, queryClient } from "./queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

// Enhanced user type with plan field
export interface AuthUser extends SelectUser {
  plan: 'free' | 'pro' | 'teams';
  name: string;
  email: string;
}

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  error: Error | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser>({
    queryKey: ["/api/user"],
    queryFn: async ({ queryKey }) => {
      try {
        const res = await fetch(queryKey[0] as string, { credentials: "include" });
        if (res.status === 401) return null;
        if (!res.ok) throw new Error("Failed to fetch user");
        return res.json();
      } catch (error) {
        console.error("Error fetching user:", error);
        return null;
      }
    },
  });

  const handlePendingProject = async (newUser: SelectUser) => {
    const pendingGithubUrl = sessionStorage.getItem('pendingGithubUrl');

    // If no pending project, redirect to projects page
    if (!pendingGithubUrl) {
      setLocation('/projects');
      return;
    }

    try {
      const repoName = pendingGithubUrl.split("/").pop()?.replace(".git", "") || "New Project";
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: repoName,
          githubUrl: pendingGithubUrl,
          userId: newUser.id,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create project');
      }

      // Clean up session storage
      sessionStorage.removeItem('pendingGithubUrl');
      sessionStorage.removeItem('pendingEmail');

      // Redirect to projects page after creating the project
      setLocation('/projects');
    } catch (error) {
      console.error("Error creating pending project:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create project. Please try again.",
        variant: "destructive",
      });
      setLocation('/projects');
    }
  };

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/login", { email, password });
      return res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/user"], user);
      handlePendingProject(user);
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
      setLocation('/auth');
    },
  });

  const registerMutation = useMutation({
    mutationFn: async ({
      email,
      name,
      password,
    }: {
      email: string;
      name: string;
      password: string;
    }) => {
      const res = await apiRequest("POST", "/api/register", {
        email,
        name,
        password,
      });
      return res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/user"], user);
      handlePendingProject(user);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      // Clean up session storage on logout
      sessionStorage.removeItem('pendingGithubUrl');
      sessionStorage.removeItem('pendingEmail');
      setLocation('/');
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        error: error || null,
        login: async (email, password) => {
          await loginMutation.mutateAsync({ email, password });
        },
        register: async (email, name, password) => {
          await registerMutation.mutateAsync({ email, name, password });
        },
        logout: async () => {
          await logoutMutation.mutateAsync();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}