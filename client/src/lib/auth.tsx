import { ReactNode, createContext, useContext } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { SelectUser } from "@db/schema";
import { apiRequest, queryClient } from "./queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

type AuthContextType = {
  user: SelectUser | null;
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
  } = useQuery<SelectUser | null>({
    queryKey: ["/api/user"],
    queryFn: async ({ queryKey }) => {
      try {
        const res = await fetch(queryKey[0], { credentials: "include" });
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
    if (pendingGithubUrl) {
      try {
        const repoName = pendingGithubUrl.split("/").pop()?.replace(".git", "") || "New Project";
        const response = await apiRequest("POST", "/api/projects", {
          name: repoName,
          githubUrl: pendingGithubUrl,
          userId: newUser.id
        });

        if (!response.ok) {
          throw new Error("Failed to create project");
        }

        const data = await response.json();
        sessionStorage.removeItem('pendingGithubUrl');
        sessionStorage.removeItem('pendingEmail');

        // Ensure we have a submissionId before redirecting
        if (!data.submissionId) {
          throw new Error("No submission ID returned from project creation");
        }

        setLocation(`/analysis/${data.submissionId}`);
      } catch (error) {
        console.error("Error creating pending project:", error);
        toast({
          title: "Error",
          description: "Failed to create project from stored GitHub URL",
          variant: "destructive",
        });
      }
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
      sessionStorage.removeItem('pendingGithubUrl');
      sessionStorage.removeItem('pendingEmail');
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
        user,
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