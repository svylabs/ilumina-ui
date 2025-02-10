import { Card, CardContent } from "@/components/ui/card";
import SubmissionForm from "@/components/submission-form";
import { SunDim } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black p-6">
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
            Welcome to Ilumina
          </h1>
          <p className="text-xl text-white/90 max-w-2xl mx-auto leading-relaxed">
            Illuminate your smart contracts with comprehensive testing and analysis. 
            Get detailed insights and ensure your code meets the highest standards.
          </p>
        </div>

        <Card className="border-2 border-primary/20 bg-black/50 shadow-lg backdrop-blur">
          <CardContent className="p-8">
            <h2 className="text-2xl font-semibold mb-6 text-center text-white">Start Your Analysis</h2>
            <SubmissionForm />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: "Smart Analysis",
              description: "Advanced code analysis using state-of-the-art tools"
            },
            {
              title: "Detailed Reports",
              description: "Comprehensive reports with actionable insights"
            },
            {
              title: "Quick Results",
              description: "Fast and efficient testing process"
            }
          ].map((feature) => (
            <Card key={feature.title} className="border border-primary/20 bg-black/50 shadow-sm backdrop-blur">
              <CardContent className="p-6 text-center">
                <h3 className="font-semibold mb-2 text-white">{feature.title}</h3>
                <p className="text-sm text-white/70">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}