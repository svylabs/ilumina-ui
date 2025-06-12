import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertContactSchema, type InsertContact } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle, 
  Zap, 
  Shield, 
  Users, 
  Code, 
  BarChart3, 
  Github, 
  Sparkles, 
  ArrowRight, 
  Check,
  Loader2,
  Brain,
  Rocket,
  Target
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

export default function HomePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: pricingData, isLoading: isPricingLoading } = useQuery({
    queryKey: ['/api/pricing-plans'],
  });

  const contactMutation = useMutation({
    mutationFn: async (data: InsertContact) => {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error("Failed to submit contact form");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Message sent!",
        description: "We'll get back to you soon.",
      });
      reset();
      setIsSubmitting(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<InsertContact>({
    resolver: zodResolver(insertContactSchema),
  });

  const onSubmit = (data: InsertContact) => {
    setIsSubmitting(true);
    contactMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-black to-gray-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-black/80 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Stablebase</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-white/70 hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="text-white/70 hover:text-white transition-colors">Pricing</a>
              <a href="#about" className="text-white/70 hover:text-white transition-colors">About</a>
              <a href="#contact" className="text-white/70 hover:text-white transition-colors">Contact</a>
              <Link href="/login">
                <Button variant="outline" className="text-white border-white/20 hover:bg-white/10">
                  Login
                </Button>
              </Link>
              <Link href="/register">
                <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-32 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-8">
            Build Smart Contracts with
            <span className="bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent"> AI</span>
          </h1>
          <p className="text-xl text-white/70 mb-12 max-w-2xl mx-auto">
            Stablebase empowers developers to create, simulate, and analyze smart contracts through intelligent automation and comprehensive project tools.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-lg px-8 py-4">
                Start Building
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="text-white border-white/20 hover:bg-white/10 text-lg px-8 py-4">
              View Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="scroll-mt-20 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Powerful Features for Smart Contract Development
            </h2>
            <p className="text-lg text-white/70 max-w-2xl mx-auto">
              Everything you need to build, test, and deploy smart contracts with confidence
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: <Brain className="h-8 w-8 text-blue-400" />,
                title: "AI-Powered Analysis",
                description: "Get intelligent insights and recommendations for your smart contract code"
              },
              {
                icon: <Code className="h-8 w-8 text-purple-400" />,
                title: "Advanced Simulation",
                description: "Test your contracts in realistic environments before deployment"
              },
              {
                icon: <Shield className="h-8 w-8 text-green-400" />,
                title: "Security Auditing",
                description: "Comprehensive security analysis to identify vulnerabilities"
              },
              {
                icon: <Github className="h-8 w-8 text-orange-400" />,
                title: "GitHub Integration",
                description: "Seamless integration with your existing development workflow"
              },
              {
                icon: <BarChart3 className="h-8 w-8 text-red-400" />,
                title: "Analytics Dashboard",
                description: "Track performance and get detailed insights on your contracts"
              },
              {
                icon: <Users className="h-8 w-8 text-cyan-400" />,
                title: "Team Collaboration",
                description: "Work together with your team on smart contract projects"
              }
            ].map((feature, index) => (
              <Card key={index} className="bg-black/50 border-white/10 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-white/70">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="scroll-mt-20 py-24 px-6 bg-gradient-to-b from-black/95 to-black">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Simple Pricing
            </h2>
            <p className="text-lg text-white/70">
              Choose the plan that's right for you
            </p>
          </div>

          {isPricingLoading ? (
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-12">
              {/* Top Row - First 3 Plans */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {pricingData?.slice(0, 3).map((plan: {
                  name: string;
                  price: number;
                  period: string;
                  description: string;
                  features: string[];
                }) => (
                <Card
                  key={plan.name}
                  className={`border-2 ${
                    plan.name === 'Pro' 
                      ? 'border-primary bg-primary/10 backdrop-blur relative' 
                      : 'border-primary/20 bg-black/50 backdrop-blur'
                  }`}
                >
                  {plan.name === 'Pro' && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">
                        Most Popular
                      </div>
                    </div>
                  )}
                  <CardContent className="p-6">
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-semibold mb-2 text-white">
                        {plan.name}
                      </h3>
                      <div className="text-3xl font-bold text-white mb-1">
                        ${plan.price}
                      </div>
                      <div className="text-sm text-white/70">
                        {plan.period}
                      </div>
                      {plan.name === 'Pro' && (
                        <div className="mt-1 text-xs text-primary/80">
                          3-month commitment ($149/month) or<br />
                          Monthly subscription: $199/month
                        </div>
                      )}
                      <p className="mt-2 text-white/70">
                        {plan.description}
                      </p>
                    </div>
                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature: string) => (
                        <li key={feature} className="flex items-center text-white/90">
                          <Check className="h-4 w-4 text-primary mr-2" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full bg-primary/20 hover:bg-primary/30 text-white"
                    >
                      Get Started
                    </Button>
                  </CardContent>
                </Card>
              ))}
              </div>

              {/* Bottom Row - Teams Plan and Custom */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                {/* Teams Plan */}
                {pricingData?.slice(3, 4).map((plan: {
                  name: string;
                  price: number;
                  period: string;
                  description: string;
                  features: string[];
                }) => (
                <Card
                  key={plan.name}
                  className="border-2 border-primary/20 bg-black/50 backdrop-blur relative"
                >
                  <CardContent className="p-6">
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-semibold mb-2 text-white">
                        {plan.name}
                      </h3>
                      <div className="text-3xl font-bold text-white mb-1">
                        ${plan.price}
                      </div>
                      <div className="text-sm text-white/70">
                        {plan.period}
                      </div>
                      {plan.name === 'Teams' && (
                        <div className="mt-1 text-xs text-primary/80">
                          3-month commitment ($1499/month) or<br />
                          Monthly subscription: $1999/month
                        </div>
                      )}
                      <p className="mt-2 text-white/70">
                        {plan.description}
                      </p>
                    </div>
                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature: string) => (
                        <li key={feature} className="flex items-center text-white/90">
                          <Check className="h-4 w-4 text-primary mr-2" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full bg-primary/20 hover:bg-primary/30 text-white"
                    >
                      Get Started
                    </Button>
                  </CardContent>
                </Card>
                ))}
                
                {/* Custom Plan Card */}
                <Card className="border-2 border-primary/20 bg-black/50 backdrop-blur relative">
                  <CardContent className="p-6">
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-semibold mb-2 text-white">
                        Custom
                      </h3>
                      <div className="text-3xl font-bold text-white mb-1">
                        Contact Us
                      </div>
                      <p className="mt-2 text-white/70">
                        For specialized requirements and custom integrations
                      </p>
                    </div>
                    <Button
                      className="w-full bg-primary/20 hover:bg-primary/30 text-white"
                      onClick={() => {
                        const element = document.getElementById('contact');
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth' });
                        }
                      }}
                    >
                      Contact Us
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Credit Purchase Options for Free Users */}
              <div className="mt-16">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-white mb-2">
                    Need More Credits?
                  </h3>
                  <p className="text-white/70">
                    Free users get 10 chatbot message credits per month. Purchase additional credits as needed.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                  {/* 50 Credits Option */}
                  <Card className="border-2 border-primary/30 bg-black/50 backdrop-blur">
                    <CardContent className="p-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-white mb-2">
                          50 Credits
                        </div>
                        <div className="text-lg text-primary mb-4">
                          $4.99
                        </div>
                        <p className="text-white/70 mb-6">
                          Perfect for occasional use
                        </p>
                        <Button 
                          className="w-full bg-primary/20 hover:bg-primary/30 text-white"
                          onClick={() => {
                            console.log("Purchase 50 credits");
                          }}
                        >
                          Purchase
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 200 Credits Option */}
                  <Card className="border-2 border-primary/30 bg-black/50 backdrop-blur">
                    <CardContent className="p-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-white mb-2">
                          200 Credits
                        </div>
                        <div className="text-lg text-primary mb-4">
                          $14.99
                        </div>
                        <p className="text-white/70 mb-6">
                          Better value for regular users
                        </p>
                        <Button 
                          className="w-full bg-primary/20 hover:bg-primary/30 text-white"
                          onClick={() => {
                            console.log("Purchase 200 credits");
                          }}
                        >
                          Purchase
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="scroll-mt-20 py-24 px-6 bg-black">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Contact Us
            </h2>
            <p className="text-lg text-white/70">
              Ready to get started? We'd love to hear from you.
            </p>
          </div>
          
          <Card className="bg-black/50 border-white/10 backdrop-blur-sm">
            <CardContent className="p-8">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="name" className="text-white">Name</Label>
                    <Input
                      id="name"
                      {...register("name")}
                      className="bg-white/5 border-white/20 text-white placeholder:text-white/50"
                      placeholder="Your name"
                    />
                    {errors.name && (
                      <p className="text-red-400 text-sm mt-1">{errors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-white">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      {...register("email")}
                      className="bg-white/5 border-white/20 text-white placeholder:text-white/50"
                      placeholder="your@email.com"
                    />
                    {errors.email && (
                      <p className="text-red-400 text-sm mt-1">{errors.email.message}</p>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="message" className="text-white">Message</Label>
                  <Textarea
                    id="message"
                    {...register("message")}
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/50 min-h-[120px]"
                    placeholder="Tell us about your project..."
                  />
                  {errors.message && (
                    <p className="text-red-400 text-sm mt-1">{errors.message.message}</p>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Message'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="scroll-mt-20 py-24 px-6 bg-gradient-to-b from-black to-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Why Choose Stablebase?
            </h2>
            <p className="text-lg text-white/70 max-w-2xl mx-auto">
              Built by developers, for developers. We understand the challenges of smart contract development.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-400 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Rocket className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">Fast Development</h3>
              <p className="text-white/70">
                Speed up your smart contract development with AI-powered tools and automated testing.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">Secure by Design</h3>
              <p className="text-white/70">
                Built-in security analysis and best practices ensure your contracts are secure from day one.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Target className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-4">Production Ready</h3>
              <p className="text-white/70">
                Comprehensive testing and simulation tools ensure your contracts work perfectly in production.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-gradient-to-r from-blue-600 to-purple-700">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Build the Future?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Join thousands of developers who trust Stablebase for their smart contract development.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-4">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="text-white border-white/20 hover:bg-white/10 text-lg px-8 py-4">
              Schedule Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-black border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <span className="text-xl font-bold text-white">Stablebase</span>
              </div>
              <p className="text-white/70">
                The future of smart contract development is here.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-white/70">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-white/70">
                <li><a href="#about" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-white/70">
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
          
          <Separator className="my-8 bg-white/10" />
          
          <div className="text-center text-white/70">
            <p>&copy; 2024 Stablebase. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}