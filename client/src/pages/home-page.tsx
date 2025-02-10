import { Card, CardContent } from "@/components/ui/card";
import SubmissionForm from "@/components/submission-form";
import { SunDim } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted p-6">
      <div className="max-w-4xl mx-auto space-y-12">
        <div className="text-center space-y-6">
          <div className="flex justify-center mb-8">
            <div className="p-4 bg-primary/10 rounded-full">
              <div className="p-3 bg-primary rounded-full">
                <SunDim className="h-12 w-12 text-primary-foreground" />
              </div>
            </div>
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Welcome to Ilumina
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Illuminate your smart contracts with comprehensive testing and analysis. 
            Get detailed insights and ensure your code meets the highest standards.
          </p>
        </div>

        <Card className="border-2 shadow-lg">
          <CardContent className="p-8">
            <h2 className="text-2xl font-semibold mb-6 text-center">Start Your Analysis</h2>
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
            <Card key={feature.title} className="border shadow-sm">
              <CardContent className="p-6 text-center">
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}