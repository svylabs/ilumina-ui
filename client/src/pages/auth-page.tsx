import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SunDim } from "lucide-react";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [, setLocation] = useLocation();
  const { login, register, user } = useAuth();

  // Basic form state without validation
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
  });

  if (user) {
    setLocation("/projects");
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(formData.email, formData.password);
      setLocation("/projects");
    } catch (error) {
      // Error handling is done in the auth context
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(formData.email, formData.name, formData.password);
      setLocation("/projects");
    } catch (error) {
      // Error handling is done in the auth context
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="flex min-h-screen">
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
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="text-white">Email</label>
                    <Input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="Enter your email"
                      className="bg-black/50 border-primary/40 text-white placeholder:text-white/50"
                    />
                  </div>
                  <div>
                    <label className="text-white">Password</label>
                    <Input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Enter your password"
                      className="bg-black/50 border-primary/40 text-white placeholder:text-white/50"
                    />
                  </div>
                  <Button 
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-black"
                  >
                    Sign In
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div>
                    <label className="text-white">Name</label>
                    <Input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Enter your name"
                      className="bg-black/50 border-primary/40 text-white placeholder:text-white/50"
                    />
                  </div>
                  <div>
                    <label className="text-white">Email</label>
                    <Input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="Enter your email"
                      className="bg-black/50 border-primary/40 text-white placeholder:text-white/50"
                    />
                  </div>
                  <div>
                    <label className="text-white">Password</label>
                    <Input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Choose a password"
                      className="bg-black/50 border-primary/40 text-white placeholder:text-white/50"
                    />
                  </div>
                  <Button 
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-black"
                  >
                    Sign Up
                  </Button>
                </form>
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

        <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary/20 to-primary/5 p-8 items-center justify-center">
          <div className="max-w-md">
            <h1 className="text-4xl font-bold text-white mb-4">
              {isLogin ? "Welcome Back!" : "Join Ilumina"}
            </h1>
            <p className="text-lg text-white/70">
              Get comprehensive insights into your smart contracts with our
              advanced testing and analysis platform.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}