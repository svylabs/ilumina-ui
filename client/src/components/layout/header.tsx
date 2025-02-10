import { Link } from "wouter";
import { SunDim } from "lucide-react";

export default function Header() {
  return (
    <header className="border-b border-primary/20 bg-black/95 backdrop-blur supports-[backdrop-filter]:bg-black/60">
      <div className="container flex h-16 max-w-screen-2xl items-center">
        <Link href="/" className="flex items-center space-x-3 font-bold">
          <div className="p-2 bg-primary rounded-lg">
            <SunDim className="h-6 w-6 text-black" />
          </div>
          <span className="text-xl font-semibold text-white">
            Ilumina
          </span>
        </Link>
        <span className="ml-4 text-sm text-white/70 border-l border-primary/20 pl-4">
          Smart Contract Analysis Platform
        </span>
      </div>
    </header>
  );
}