import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SunDim } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  name: z.string().min(1, "Name is required"),
  password: z.string().min(1, "Password is required").min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [, setLocation] = useLocation();
  const { login, register, user } = useAuth();

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onBlur",
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      name: "",
      password: "",
    },
    mode: "onBlur",
  });

  if (user) {
    setLocation("/projects");
    return null;
  }

  const handleLoginSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password);
      setLocation("/projects");
    } catch (error) {
      // Error handling is done in the auth context
    }
  };

  const handleRegisterSubmit = async (data: RegisterFormData) => {
    try {
      await register(data.email, data.name, data.password);
      setLocation("/projects");
    } catch (error) {
      // Error handling is done in the auth context
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="flex min-h-screen">
        {/* Form Section */}
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
                  <form
                    onSubmit={loginForm.handleSubmit(handleLoginSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="Enter your email"
                              className="bg-black/50 border-primary/40 text-white placeholder:text-white/50"
                              autoComplete="email"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="text-red-500" />
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
                              type="password"
                              placeholder="Enter your password"
                              className="bg-black/50 border-primary/40 text-white placeholder:text-white/50"
                              autoComplete="current-password"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full bg-primary hover:bg-primary/90 text-black"
                      disabled={loginForm.formState.isSubmitting}
                    >
                      Sign In
                    </Button>
                  </form>
                </Form>
              ) : (
                <Form {...registerForm}>
                  <form
                    onSubmit={registerForm.handleSubmit(handleRegisterSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="Enter your email"
                              className="bg-black/50 border-primary/40 text-white placeholder:text-white/50"
                              autoComplete="email"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter your name"
                              className="bg-black/50 border-primary/40 text-white placeholder:text-white/50"
                              autoComplete="name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="text-red-500" />
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
                              type="password"
                              placeholder="Choose a password"
                              className="bg-black/50 border-primary/40 text-white placeholder:text-white/50"
                              autoComplete="new-password"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full bg-primary hover:bg-primary/90 text-black"
                      disabled={registerForm.formState.isSubmitting}
                    >
                      Sign Up
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

        {/* Info Section */}
        <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary/20 to-primary/5 p-8 items-center justify-center">
          <div className="max-w-md">
            <h1 className="text-4xl font-bold text-white mb-4">
              {isLogin ? "Welcome Back!" : "Join Ilumina"}
            </h1>
            <p className="text-lg text-white/70">
              Get comprehensive insights into your smart contracts with our advanced
              testing and analysis platform.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}