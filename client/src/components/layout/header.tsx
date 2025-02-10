import { Link } from "wouter";
import { SunDim } from "lucide-react";

export default function Header() {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center">
        <Link href="/" className="flex items-center space-x-3 font-bold">
          <div className="p-2 bg-primary rounded-lg">
            <SunDim className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-semibold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Ilumina
          </span>
        </Link>
        <span className="ml-4 text-sm text-muted-foreground border-l pl-4">
          Smart Contract Analysis Platform
        </span>
      </div>
    </header>
  );
}