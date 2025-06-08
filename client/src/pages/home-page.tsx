import { Card, CardContent } from "@/components/ui/card";
import SubmissionForm from "@/components/submission-form";
import { 
  SunDim, 
  Check, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  Github,
  Twitter,
  Linkedin,
  Mail
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { insertContactSchema, type InsertContact } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";

export default function HomePage() {
  const { toast } = useToast();
  
  // Use optional chaining to handle cases where auth context might not be available
  let user = null;
  try {
    const authContext = useAuth();
    user = authContext?.user || null;
  } catch (error) {
    console.log('Auth context not available on homepage');
  }
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InsertContact>({
    resolver: zodResolver(insertContactSchema),
  });

  const contactMutation = useMutation({
    mutationFn: async (data: InsertContact) => {
      const res = await apiRequest("POST", "/api/contact", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Message sent",
        description: "We'll get back to you soon!",
      });
      reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const creditPurchaseMutation = useMutation({
    mutationFn: async (credits: number) => {
      const res = await apiRequest("POST", "/api/create-credit-payment", { credits });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Purchase Initiated",
        description: data.message || "Credit purchase has been initiated successfully!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Purchase Failed",
        description: "Failed to initiate credit purchase. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertContact) => {
    contactMutation.mutate(data);
  };

  const handleCreditPurchase = (credits: number) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to purchase credits.",
        variant: "destructive",
      });
      return;
    }
    creditPurchaseMutation.mutate(credits);
  };

  // Static pricing data
  const pricingData = [
    {
      name: "Free",
      price: 0,
      period: "forever",
      description: "Perfect for getting started",
      features: [
        "1 project",
        "1 simulation run per day",
        "One time simulation autogeneration per month",
        "10 monthly credits for AI assisted edits",
        "Export / Import simulation code to / from GitHub"
      ]
    },
    {
      name: "Pro",
      price: 99,
      period: "per month",
      description: "For professional developers",
      features: [
        "3 projects",
        "20 simulation runs per day",
        "One time simulation autogeneration",
        "AI assisted edits",
        "Export / Import simulation code to / from GitHub",
        "Priority support"
      ]
    },
    {
      name: "Teams",
      price: 999,
      period: "per month",
      description: "For development teams",
      features: [
        "10 projects",
        "Unlimited simulation runs",
        "AI assisted edits",
        "10 hours of manual test plan analysis/creation support per month",
        "Export / Import simulation code to / from GitHub",
        "< 24 hour support turnaround"
      ]
    }
  ];
  const isPricingLoading = false;

  return (
    <div className="min-h-screen bg-black pt-20">
      {/* Hero Section */}
      <div className="relative px-6 lg:px-8 py-24 bg-gradient-to-b from-black to-black/95">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-6">
            <div className="flex justify-center mb-8">
              <div className="p-4 bg-primary/10 rounded-full">
                <div className="p-3 bg-primary rounded-full">
                  <SunDim className="h-12 w-12 text-black" />
                </div>
              </div>
            </div>
            <h1 className="text-5xl font-bold text-white">
              Create and run smart contract simulations in a day
            </h1>
            <p className="text-xl text-white/90 max-w-2xl mx-auto leading-relaxed">
              AI-powered simulation generation and on-demand execution to uncover 
              vulnerabilities and validate smart contract behavior
            </p>
          </div>

          <Card className="border-2 border-primary/20 bg-black/50 shadow-lg backdrop-blur">
            <CardContent className="p-8">
              <h2 className="text-2xl font-semibold mb-6 text-center text-white">
                Start Your Analysis
              </h2>
              <SubmissionForm />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Who Is This For Section */}
      <section className="py-24 px-6 bg-gradient-to-b from-black to-black/95">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Built for Smart Contract Professionals
            </h2>
            <p className="text-lg text-white/70 max-w-3xl mx-auto">
              Ilumina empowers security experts and development teams with AI-driven testing tools
              to identify vulnerabilities and ensure robust smart contract deployments.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border border-primary/20 bg-black/50 backdrop-blur text-center">
              <CardContent className="p-8">
                <div className="text-5xl mb-6">🔍</div>
                <h3 className="text-xl font-semibold mb-4 text-white">
                  Smart Contract Auditors
                </h3>
                <p className="text-white/70 leading-relaxed">
                  Accelerate your audit process with automated test generation and comprehensive 
                  vulnerability detection. Generate detailed reports for clients with confidence.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-primary/20 bg-black/50 backdrop-blur text-center">
              <CardContent className="p-8">
                <div className="text-5xl mb-6">🏢</div>
                <h3 className="text-xl font-semibold mb-4 text-white">
                  Protocol Development Teams
                </h3>
                <p className="text-white/70 leading-relaxed">
                  Integrate rigorous testing into your development workflow. Catch issues early 
                  and ensure your protocol launches with maximum security and reliability.
                </p>
              </CardContent>
            </Card>

            <Card className="border border-primary/20 bg-black/50 backdrop-blur text-center">
              <CardContent className="p-8">
                <div className="text-5xl mb-6">🎯</div>
                <h3 className="text-xl font-semibold mb-4 text-white">
                  Bug Bounty Hunters
                </h3>
                <p className="text-white/70 leading-relaxed">
                  Discover vulnerabilities faster with intelligent simulation tools. Generate 
                  comprehensive test scenarios to maximize your bug discovery potential.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="scroll-mt-20 py-24 px-6 bg-black/95">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Features</h2>
            <p className="text-lg text-white/70">
              Comprehensive tools for smart contract testing
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                title: "Solidity Projects",
                description:
                  "Advanced support for Solidity smart contract testing and validation",
                icon: "🔗",
              },
              {
                title: "AI Enabled Test Generation",
                description: "Automatically generate comprehensive test cases using AI",
                icon: "🤖",
              },
              {
                title: "Detailed Reports",
                description: "Get in-depth analysis and actionable insights",
                icon: "📊",
              },
              {
                title: "Run Tests On Demand",
                description: "Execute tests whenever you need with real-time results",
                icon: "▶️",
              },
              {
                title: "Manage Teams",
                description: "Collaborate with your team and manage permissions",
                icon: "👥",
              },
            ].map((feature) => (
              <Card
                key={feature.title}
                className="border border-primary/20 bg-black/50 backdrop-blur"
              >
                <CardContent className="p-6">
                  <div className="text-3xl mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-semibold mb-2 text-white">
                    {feature.title}
                  </h3>
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
              {/* Main Subscription Plans */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                {pricingData?.map((plan: {
                  name: string;
                  price: number;
                  period: string;
                  description: string;
                  features: string[];
                }) => (
                <Card
                  key={plan.name}
                  className={`border-2 ${
                    plan.name === "Pro"
                      ? "border-primary"
                      : "border-primary/20"
                  } bg-black/50 backdrop-blur relative`}
                >
                  <CardContent className="p-6">
                    {plan.name === "Pro" && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary px-3 py-1 rounded-full text-xs font-semibold text-black">
                        Popular
                      </div>
                    )}
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
                          3-month commitment ($99/month) or<br />
                          Monthly subscription: $129/month
                        </div>
                      )}
                      {plan.name === 'Teams' && (
                        <div className="mt-1 text-xs text-primary/80">
                          3-month commitment ($999/month) or<br />
                          Monthly subscription: $1299/month
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
                      className={`w-full ${
                        plan.name === "Pro"
                          ? "bg-primary hover:bg-primary/90 text-black"
                          : "bg-primary/20 hover:bg-primary/30 text-white"
                      }`}
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
                    <div className="text-sm text-white/70">
                      For special requirements
                    </div>
                    <p className="mt-2 text-white/70">
                      For organizations with specialized needs and enterprise-level requirements
                    </p>
                  </div>
                  <ul className="space-y-3 mb-6">
                    <li className="flex items-center text-white/90">
                      <Check className="h-4 w-4 text-primary mr-2" />
                      Customized to fit your needs
                    </li>
                  </ul>
                  <Button
                    className="w-full bg-primary/20 hover:bg-primary/30 text-white"
                    onClick={() => {
                      const contactSection = document.getElementById('contact');
                      if (contactSection) {
                        contactSection.scrollIntoView({ behavior: 'smooth' });
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
                      <div className="text-center mb-6">
                        <h4 className="text-lg font-semibold mb-2 text-white">
                          50 Credits
                        </h4>
                        <div className="text-2xl font-bold text-white mb-1">
                          $5
                        </div>
                        <div className="text-sm text-white/70">
                          One-time purchase
                        </div>
                        <p className="mt-2 text-white/70 text-sm">
                          Perfect for occasional use
                        </p>
                      </div>
                      <ul className="space-y-2 mb-6">
                        <li className="flex items-center text-white/90 text-sm">
                          <Check className="h-3 w-3 text-primary mr-2" />
                          50 AI assistant messages
                        </li>
                        <li className="flex items-center text-white/90 text-sm">
                          <Check className="h-3 w-3 text-primary mr-2" />
                          Never expires
                        </li>
                        <li className="flex items-center text-white/90 text-sm">
                          <Check className="h-3 w-3 text-primary mr-2" />
                          Instant activation
                        </li>
                      </ul>
                      <Button
                        className="w-full bg-primary/20 hover:bg-primary/30 text-white"
                        onClick={() => handleCreditPurchase(50)}
                        disabled={creditPurchaseMutation.isPending}
                      >
                        {creditPurchaseMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Processing...
                          </>
                        ) : (
                          'Buy 50 Credits'
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* 100 Credits Option */}
                  <Card className="border-2 border-primary/50 bg-black/50 backdrop-blur relative">
                    <CardContent className="p-6">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary px-3 py-1 rounded-full text-xs font-semibold text-black">
                        Best Value
                      </div>
                      <div className="text-center mb-6">
                        <h4 className="text-lg font-semibold mb-2 text-white">
                          100 Credits
                        </h4>
                        <div className="text-2xl font-bold text-white mb-1">
                          $10
                        </div>
                        <div className="text-sm text-white/70">
                          One-time purchase
                        </div>
                        <div className="mt-1 text-xs text-primary/80">
                          Save $0.10 per credit
                        </div>
                        <p className="mt-2 text-white/70 text-sm">
                          Great for regular users
                        </p>
                      </div>
                      <ul className="space-y-2 mb-6">
                        <li className="flex items-center text-white/90 text-sm">
                          <Check className="h-3 w-3 text-primary mr-2" />
                          100 AI assistant messages
                        </li>
                        <li className="flex items-center text-white/90 text-sm">
                          <Check className="h-3 w-3 text-primary mr-2" />
                          Never expires
                        </li>
                        <li className="flex items-center text-white/90 text-sm">
                          <Check className="h-3 w-3 text-primary mr-2" />
                          Instant activation
                        </li>
                      </ul>
                      <Button
                        className="w-full bg-primary hover:bg-primary/90 text-black"
                        onClick={() => handleCreditPurchase(100)}
                        disabled={creditPurchaseMutation.isPending}
                      >
                        {creditPurchaseMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Processing...
                          </>
                        ) : (
                          'Buy 100 Credits'
                        )}
                      </Button>
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
              Get in touch with our team
            </p>
          </div>

          <Card className="border-2 border-primary/20 bg-black/50">
            <CardContent className="p-8">
              <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-2">
                  <label className="text-white">Name</label>
                  <Input
                    {...register("name")}
                    placeholder="Your name"
                    className="bg-black/50 border-primary/40 text-white placeholder:text-white/50"
                  />
                  {errors.name && (
                    <p className="text-red-500 text-sm">{errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-white">Email</label>
                  <Input
                    {...register("email")}
                    type="email"
                    placeholder="your@email.com"
                    className="bg-black/50 border-primary/40 text-white placeholder:text-white/50"
                  />
                  {errors.email && (
                    <p className="text-red-500 text-sm">{errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-white">Message</label>
                  <textarea
                    {...register("message")}
                    rows={4}
                    placeholder="Your message"
                    className="w-full rounded-md bg-black/50 border border-primary/40 text-white placeholder:text-white/50 p-3"
                  />
                  {errors.message && (
                    <p className="text-red-500 text-sm">{errors.message.message}</p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-black"
                  disabled={contactMutation.isPending}
                >
                  {contactMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Message"
                  )}
                </Button>
                {contactMutation.isSuccess && (
                  <p className="text-green-500 text-sm text-center">
                    Thank you for your message! We'll get back to you soon.
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="scroll-mt-20 py-24 px-6 bg-gradient-to-b from-black to-black/95">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-white/70">
              Find answers to common questions about our platform
            </p>
          </div>

          <Card className="border-2 border-primary/20 bg-black/50">
            <CardContent className="p-8">
              <Accordion type="single" collapsible className="space-y-4">
                <AccordionItem value="item-1" className="border-primary/20">
                  <AccordionTrigger className="text-white font-medium py-4 hover:text-primary">
                    What types of smart contracts can I test?
                  </AccordionTrigger>
                  <AccordionContent className="text-white/70 pb-4">
                    Ilumina supports testing for Ethereum-based smart contracts written in Solidity. Our platform is designed to work with a variety of contract types, including DeFi protocols, NFTs, marketplaces, and more.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2" className="border-primary/20">
                  <AccordionTrigger className="text-white font-medium py-4 hover:text-primary">
                    How does the AI-generated testing work?
                  </AccordionTrigger>
                  <AccordionContent className="text-white/70 pb-4">
                    Our AI system analyzes your smart contract code to identify potential vulnerabilities, edge cases, and complex interactions. It then generates comprehensive test scenarios that simulate real-world conditions, including various actor behaviors and transaction sequences.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3" className="border-primary/20">
                  <AccordionTrigger className="text-white font-medium py-4 hover:text-primary">
                    Can I collaborate with my team on projects?
                  </AccordionTrigger>
                  <AccordionContent className="text-white/70 pb-4">
                    Yes! Our Teams plan allows you to create teams, invite members, and collaborate on multiple projects. Team members can access shared projects, run simulations, and view results based on their assigned permissions.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-4" className="border-primary/20">
                  <AccordionTrigger className="text-white font-medium py-4 hover:text-primary">
                    How secure is my contract code on your platform?
                  </AccordionTrigger>
                  <AccordionContent className="text-white/70 pb-4">
                    We take security seriously. Your code is transmitted and stored using industry-standard encryption practices. We don't share your code with third parties, and you maintain complete ownership of your intellectual property.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-5" className="border-primary/20">
                  <AccordionTrigger className="text-white font-medium py-4 hover:text-primary">
                    Can I export test results and simulation environments?
                  </AccordionTrigger>
                  <AccordionContent className="text-white/70 pb-4">
                    Yes, all plans include the ability to export simulation environments to GitHub repositories. This allows you to integrate our tests with your development workflow and CI/CD pipelines.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* About Us Section */}
      <section id="about" className="scroll-mt-20 py-24 px-6 bg-black">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              About Ilumina
            </h2>
            <p className="text-lg text-white/70">
              Building the future of smart contract testing
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-2xl font-semibold text-white mb-4">Our Mission</h3>
              <p className="text-white/70 mb-6">
                At Ilumina, we're on a mission to make blockchain development safer and more reliable through advanced agent-based simulations. We believe that robust simulations are essential for the growth and adoption of decentralized technologies.
              </p>
              <p className="text-white/70">
                Our platform combines cutting-edge AI with deep blockchain expertise to deliver comprehensive simulation solutions that help developers identify and fix vulnerabilities before deployment.
              </p>
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-white mb-4">Our Story</h3>
              <p className="text-white/70 mb-6">
                Our team has built several decentralized applications: Settlement contracts for supply chain space, Trustlex (a decentralized exchange), Predify (a prediction market for DeFi), Stablebase (A stablecoin protocol), and while working on these protocols we discovered creating simulations / testing is what takes the most time and even slowed us down.
              </p>
              <p className="text-white/70">
                We created an open source framework, ilumina to develop our simulations. This naturally led us to work on ilumina.dev, to offer the framework we used to run simulations for some of our protocols in a seamless, cost effective manner to other Smart contract developers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section id="team" className="scroll-mt-20 py-24 px-6 bg-gradient-to-b from-black/95 to-black">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Our Team
            </h2>
            <p className="text-lg text-white/70">
              Meet the minds behind Ilumina
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Team Member 1 - Sridhar G */}
            <div className="flex flex-col items-center md:items-start md:flex-row gap-6">
              <div className="w-32 h-32 rounded-full overflow-hidden flex-shrink-0">
                <img 
                  src="https://www.stablebase.org/static/media/sridhar.0f88d01bba2539ee4dba.jpeg" 
                  alt="Sridhar G" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-white mb-1 text-center md:text-left">Sridhar G</h3>
                <p className="text-primary mb-2 text-center md:text-left">Founder</p>
                <p className="text-white/70 mb-4">
                  17+ years of Software Engineering experience with companies like Amazon.com, Booking.com and in web3 since 2022, working with companies like skuchain, and having built dApps like Trustlex (a decentralized exchange to exchange native BTC with ETH/ERC20), Predify (a prediction market for DeFi) and Stablebase (a stablecoin protocol).
                </p>
                <div className="flex space-x-4 justify-center md:justify-start">
                  <a href="https://github.com/svylabs" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-primary transition-colors">
                    <Github className="h-5 w-5" />
                  </a>
                  <a href="https://www.linkedin.com/in/sridhar-g-b10902284/" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-primary transition-colors">
                    <Linkedin className="h-5 w-5" />
                  </a>
                </div>
              </div>
            </div>

            {/* Team Member 2 - Rohit Bharti */}
            <div className="flex flex-col items-center md:items-start md:flex-row gap-6">
              <div className="w-32 h-32 rounded-full overflow-hidden flex-shrink-0">
                <img 
                  src="https://www.stablebase.org/static/media/rohit.b48fc6eefa16bd6c8363.jpg" 
                  alt="Rohit Bharti" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-white mb-1 text-center md:text-left">Rohit Bharti</h3>
                <p className="text-primary mb-2 text-center md:text-left">Software Engineer</p>
                <p className="text-white/70 mb-4">
                  Software Engineer with 1 year of experience, working on products like microcraft.dev and Stablebase.
                </p>
                <div className="flex space-x-4 justify-center md:justify-start">
                  <a href="https://github.com/rohitbharti279" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-primary transition-colors">
                    <Github className="h-5 w-5" />
                  </a>
                  <a href="https://www.linkedin.com/in/rohit-bharti-b9a437211/" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-primary transition-colors">
                    <Linkedin className="h-5 w-5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Terms of Service Section */}
      <section id="terms" className="scroll-mt-20 py-24 px-6 bg-gradient-to-b from-black/95 to-black">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Terms of Service
            </h2>
            <p className="text-lg text-white/70">
              Please review our terms and conditions
            </p>
          </div>

          <Card className="border-2 border-primary/20 bg-black/50">
            <CardContent className="p-8">
              <div className="space-y-6 text-white/70">
                <h3 className="text-xl font-semibold text-white">1. Service Usage</h3>
                <p>
                  By accessing and using Ilumina, you agree to comply with these Terms of Service and all applicable laws and regulations. You are responsible for maintaining the confidentiality of your account credentials.
                </p>

                <h3 className="text-xl font-semibold text-white mt-6">2. Intellectual Property</h3>
                <p>
                  You retain all rights to your smart contract code and related materials uploaded to our platform. We do not claim ownership of your content. However, you grant us a license to use your content solely for the purpose of providing our services.
                </p>

                <h3 className="text-xl font-semibold text-white mt-6">3. Limitations of Liability</h3>
                <p>
                  While we strive to provide accurate and comprehensive testing, Ilumina is provided "as is" without warranties of any kind. Our tests are designed to help identify issues but cannot guarantee the absence of vulnerabilities or bugs.
                </p>

                <h3 className="text-xl font-semibold text-white mt-6">4. Subscription and Billing</h3>
                <p>
                  Paid plans are billed according to the pricing terms in effect at the time of purchase. You may cancel your subscription at any time, but refunds are provided only in accordance with our refund policy.
                </p>

                <h3 className="text-xl font-semibold text-white mt-6">5. Privacy</h3>
                <p>
                  We collect and process personal information in accordance with our Privacy Policy. By using our services, you consent to such processing and you warrant that all data provided by you is accurate.
                </p>

                <div className="mt-6">
                  <p className="italic">
                    Last updated: April 1, 2025
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div>
              <h3 className="text-white font-semibold text-lg mb-4">Ilumina</h3>
              <p className="text-white/70 text-sm">
                Smart testing for your smart contracts
              </p>
              <div className="flex space-x-4 mt-4">
                <a href="#" className="text-white/70 hover:text-primary transition-colors">
                  <Github className="h-5 w-5" />
                </a>
                <a href="#" className="text-white/70 hover:text-primary transition-colors">
                  <Twitter className="h-5 w-5" />
                </a>
                <a href="#" className="text-white/70 hover:text-primary transition-colors">
                  <Linkedin className="h-5 w-5" />
                </a>
              </div>
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg mb-4">Company</h3>
              <ul className="space-y-2">
                <li><a href="#about" className="text-white/70 hover:text-primary transition-colors">About Us</a></li>
                <li><a href="#team" className="text-white/70 hover:text-primary transition-colors">Our Team</a></li>
                <li><a href="#contact" className="text-white/70 hover:text-primary transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg mb-4">Resources</h3>
              <ul className="space-y-2">
                <li><a href="#faq" className="text-white/70 hover:text-primary transition-colors">FAQ</a></li>
                <li><a href="#contact" className="text-white/70 hover:text-primary transition-colors">Support</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg mb-4">Legal</h3>
              <ul className="space-y-2">
                <li><a href="#terms" className="text-white/70 hover:text-primary transition-colors">Terms of Service</a></li>
                <li><a href="#" className="text-white/70 hover:text-primary transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="text-white/70 hover:text-primary transition-colors">Security</a></li>
                <li><a href="#" className="text-white/70 hover:text-primary transition-colors">Compliance</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-white/50 text-sm mb-4 md:mb-0">
                &copy; 2025 Ilumina. All rights reserved.
              </p>
              <div className="flex items-center space-x-2">
                <a href="mailto:contact@ilumina.dev" className="flex items-center text-white/50 hover:text-primary transition-colors text-sm">
                  <Mail className="h-4 w-4 mr-1" />
                  contact@ilumina.dev
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}