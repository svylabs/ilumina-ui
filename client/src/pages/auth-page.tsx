import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SunDim } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Form schemas for validation
const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

const registerSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [location, setLocation] = useLocation();
  const { login, register, user, isLoading } = useAuth();
  
  // Form handling with react-hook-form
  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
  
  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  // Check if pending submission exists in session storage
  const pendingGithubUrl = typeof window !== 'undefined' 
    ? sessionStorage.getItem('pendingGithubUrl') 
    : null;

  // Redirect if user is already authenticated
  useEffect(() => {
    if (user && !isLoading) {
      if (pendingGithubUrl) {
        // If there's a pending submission, user will be redirected after handling it
        // This is already handled in the auth context
      } else {
        // Otherwise redirect to projects page
        setLocation("/projects");
      }
    }
  }, [user, isLoading, pendingGithubUrl, setLocation]);

  // If still loading or user is already logged in, don't render the form
  if (isLoading || user) {
    return null;
  }

  const handleLoginSubmit = async (data: LoginForm) => {
    try {
      await login(data.email, data.password);
      // Redirect is handled in the useEffect above
    } catch (error) {
      // Error handling is done in the auth context
      console.error("Login error:", error);
    }
  };

  const handleRegisterSubmit = async (data: RegisterForm) => {
    try {
      await register(data.email, data.name, data.password);
      // Redirect is handled in the useEffect above
    } catch (error) {
      // Error handling is done in the auth context
      console.error("Registration error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="flex min-h-screen">
        {/* Left column with form */}
        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
          <Card className="w-full max-w-md border-primary/20 bg-black/50">
            <CardContent className="pt-8 pb-8">
              <div className="flex justify-center mb-8">
                <div className="p-3 bg-primary rounded-lg">
                  <SunDim className="h-6 w-6 text-black" />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-center text-white mb-8">
                {isLogin ? "Welcome Back" : "Create Account"}
              </h2>

              {isLogin ? (
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(handleLoginSubmit)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Email</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              placeholder="Enter your email"
                              className="bg-black/50 border-primary/40 text-white placeholder:text-white/50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Password</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              placeholder="Enter your password"
                              className="bg-black/50 border-primary/40 text-white placeholder:text-white/50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit"
                      disabled={loginForm.formState.isSubmitting}
                      className="w-full bg-primary hover:bg-primary/90 text-black"
                    >
                      {loginForm.formState.isSubmitting ? "Signing In..." : "Sign In"}
                    </Button>
                    
                    <div className="text-center mt-2">
                      <Button
                        variant="link"
                        className="text-primary text-sm"
                        onClick={() => setLocation("/forgot-password")}
                      >
                        Forgot your password?
                      </Button>
                    </div>
                  </form>
                </Form>
              ) : (
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(handleRegisterSubmit)} className="space-y-4">
                    <FormField
                      control={registerForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Name</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Enter your name"
                              className="bg-black/50 border-primary/40 text-white placeholder:text-white/50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Email</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              placeholder="Enter your email"
                              className="bg-black/50 border-primary/40 text-white placeholder:text-white/50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Password</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              placeholder="Choose a password"
                              className="bg-black/50 border-primary/40 text-white placeholder:text-white/50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit"
                      disabled={registerForm.formState.isSubmitting}
                      className="w-full bg-primary hover:bg-primary/90 text-black"
                    >
                      {registerForm.formState.isSubmitting ? "Creating Account..." : "Sign Up"}
                    </Button>
                  </form>
                </Form>
              )}

              <div className="mt-4 text-center">
                <Button
                  variant="link"
                  className="text-primary"
                  onClick={() => setIsLogin(!isLogin)}
                >
                  {isLogin
                    ? "Don't have an account? Sign Up"
                    : "Already have an account? Sign In"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column with hero section */}
        <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary/20 to-primary/5 p-8 items-center justify-center">
          <div className="max-w-md">
            <h1 className="text-4xl font-bold text-white mb-4">
              {isLogin ? "Welcome Back!" : "Join Ilumina"}
            </h1>
            <p className="text-lg text-white/70 mb-6">
              Get comprehensive insights into your smart contracts with our
              advanced testing and analysis platform.
            </p>
            <div className="space-y-3">
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-1">
                  <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                    <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                </div>
                <p className="ml-3 text-white/80">Identify vulnerabilities and risks in your smart contracts</p>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-1">
                  <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                    <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                </div>
                <p className="ml-3 text-white/80">Run agent-based simulations on your code</p>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-1">
                  <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                    <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                </div>
                <p className="ml-3 text-white/80">Get actionable recommendations to improve security</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}