import { Card, CardContent } from "@/components/ui/card";
import SubmissionForm from "@/components/submission-form";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            GitHub Project Testing Platform
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Submit your GitHub project for comprehensive testing. Get detailed insights and results after payment.
          </p>
        </div>

        <Card className="border-2">
          <CardContent className="p-6">
            <SubmissionForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
