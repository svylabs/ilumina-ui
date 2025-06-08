import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { SunDim, CheckCircle, AlertCircle } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, { message: "Password must be at least 6 characters" }),
  confirmPassword: z.string().min(6, { message: "Password must be at least 6 characters" }),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
});

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [mode, setMode] = useState<'forgot' | 'reset'>('forgot');
  const [token, setToken] = useState<string | null>(null);

  // Check for reset token in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('token');
    if (resetToken) {
      setToken(resetToken);
      setMode('reset');
    }
  }, []);

  const resetForm = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const forgotForm = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const handleResetPassword = async (data: ResetPasswordForm) => {
    if (!token) return;
    
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/reset-password", {
        token,
        newPassword: data.newPassword,
      });
      
      setIsSuccess(true);
      toast({
        title: "Password Reset Successful",
        description: "Your password has been updated. You can now log in with your new password.",
      });
      
      // Redirect to login after a delay
      setTimeout(() => {
        setLocation("/auth");
      }, 3000);
    } catch (error: any) {
      toast({
        title: "Password Reset Failed",
        description: error.message || "Failed to reset password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (data: ForgotPasswordForm) => {
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/forgot-password", data);
      
      setIsSuccess(true);
      toast({
        title: "Reset Link Sent",
        description: "If an account with that email exists, a password reset link has been sent.",
      });
    } catch (error: any) {
      toast({
        title: "Request Failed",
        description: error.message || "Failed to send reset email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <Card className="w-full max-w-md border-primary/20 bg-black/50">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="flex justify-center mb-6">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-4">
              {mode === 'reset' ? 'Password Reset Complete!' : 'Reset Link Sent!'}
            </h2>
            
            <p className="text-gray-300 mb-6">
              {mode === 'reset' 
                ? 'Your password has been successfully updated. Redirecting to login...'
                : 'If an account exists with that email, a reset link has been sent.'
              }
            </p>
            
            <Button 
              onClick={() => setLocation("/auth")}
              className="w-full"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-primary/20 bg-black/50">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary rounded-lg">
              <SunDim className="h-6 w-6 text-black" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            {mode === 'reset' ? 'Reset Your Password' : 'Forgot Password'}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {mode === 'reset' && token ? (
            <Form {...resetForm}>
              <form onSubmit={resetForm.handleSubmit(handleResetPassword)} className="space-y-4">
                <FormField
                  control={resetForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">New Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Enter your new password"
                          className="bg-black/50 border-primary/20 text-white"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={resetForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Confirm Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Confirm your new password"
                          className="bg-black/50 border-primary/20 text-white"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                >
                  {isLoading ? "Resetting..." : "Reset Password"}
                </Button>
              </form>
            </Form>
          ) : mode === 'reset' && !token ? (
            <Alert className="border-destructive/50 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Invalid or missing reset token. Please request a new password reset link.
              </AlertDescription>
            </Alert>
          ) : (
            <Form {...forgotForm}>
              <form onSubmit={forgotForm.handleSubmit(handleForgotPassword)} className="space-y-4">
                <p className="text-gray-300 text-sm">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
                
                <FormField
                  control={forgotForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Email Address</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Enter your email address"
                          className="bg-black/50 border-primary/20 text-white"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                >
                  {isLoading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            </Form>
          )}
          
          <div className="text-center">
            <Button
              variant="link"
              className="text-primary"
              onClick={() => setLocation("/auth")}
            >
              Back to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}