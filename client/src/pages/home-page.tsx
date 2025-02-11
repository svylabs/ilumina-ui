import { Card, CardContent } from "@/components/ui/card";
import SubmissionForm from "@/components/submission-form";
import { SunDim, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Added import for Input component

export default function HomePage() {
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
            <h1 className="text-5xl font-bold">
              <span className="text-white font-bold">Smart</span> testing for your smart contracts
            </h1>
            <p className="text-xl text-white/90 max-w-2xl mx-auto leading-relaxed">
              Powerful agent-based simulations that reveal how your smart contracts behave in real-world scenarios
            </p>
          </div>

          <Card className="border-2 border-primary/20 bg-black/50 shadow-lg backdrop-blur">
            <CardContent className="p-8">
              <h2 className="text-2xl font-semibold mb-6 text-center text-white">Start Your Analysis</h2>
              <SubmissionForm />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Features Section */}
      <section id="features" className="scroll-mt-20 py-24 px-6 bg-black/95">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Features</h2>
            <p className="text-lg text-white/70">Comprehensive tools for smart contract testing</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                title: "Solidity Projects",
                description: "Advanced support for Solidity smart contract testing and validation",
                icon: "🔗"
              },
              {
                title: "AI Enabled Test Generation",
                description: "Automatically generate comprehensive test cases using AI",
                icon: "🤖"
              },
              {
                title: "Detailed Reports",
                description: "Get in-depth analysis and actionable insights",
                icon: "📊"
              },
              {
                title: "Run Tests On Demand",
                description: "Execute tests whenever you need with real-time results",
                icon: "▶️"
              },
              {
                title: "Manage Teams",
                description: "Collaborate with your team and manage permissions",
                icon: "👥"
              }
            ].map((feature) => (
              <Card key={feature.title} className="border border-primary/20 bg-black/50 backdrop-blur">
                <CardContent className="p-6">
                  <div className="text-3xl mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-semibold mb-2 text-white">{feature.title}</h3>
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
            <h2 className="text-4xl font-bold text-white mb-4">Simple Pricing</h2>
            <p className="text-lg text-white/70">Choose the plan that's right for you</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: "Free",
                price: "$0",
                period: "forever",
                description: "Perfect for individual developers",
                features: [
                  "Limited simulations",
                  "Basic analysis tools",
                  "View reports",
                  "Community support"
                ]
              },
              {
                name: "Pro",
                price: "$39",
                period: "per month",
                description: "For professional developers",
                features: [
                  "1 project",
                  "Chatbot access to update tests",
                  "60 simulation runs per month",
                  "Priority support",
                  "Download test code"
                ]
              },
              {
                name: "Teams",
                price: "$799",
                period: "per month",
                description: "For growing teams",
                features: [
                  "Unlimited repos",
                  "Unlimited simulation runs",
                  "Continuous simulation updates",
                  "Updates based on commits",
                  "Advanced security",
                  "API access"
                ]
              }
            ].map((plan) => (
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
                    <h3 className="text-xl font-semibold mb-2 text-white">{plan.name}</h3>
                    <div className="text-3xl font-bold text-white mb-1">{plan.price}</div>
                    <div className="text-sm text-white/70">{plan.period}</div>
                    <p className="mt-2 text-white/70">{plan.description}</p>
                  </div>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature) => (
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
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="scroll-mt-20 py-24 px-6 bg-black">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Contact Us</h2>
            <p className="text-lg text-white/70">Get in touch with our team</p>
          </div>

          <Card className="border-2 border-primary/20 bg-black/50">
            <CardContent className="p-8">
              <form className="space-y-6">
                <div className="space-y-2">
                  <label className="text-white">Name</label>
                  <Input 
                    placeholder="Your name"
                    className="bg-black/50 border-primary/40 text-white placeholder:text-white/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-white">Email</label>
                  <Input 
                    type="email"
                    placeholder="your@email.com"
                    className="bg-black/50 border-primary/40 text-white placeholder:text-white/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-white">Message</label>
                  <textarea 
                    rows={4}
                    placeholder="Your message"
                    className="w-full rounded-md bg-black/50 border border-primary/40 text-white placeholder:text-white/50 p-3"
                  />
                </div>
                <Button 
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-black"
                >
                  Send Message
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}