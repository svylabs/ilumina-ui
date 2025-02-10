import { Link } from "wouter";
import { SunDim } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export default function Header() {
  const { user } = useAuth();

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

        <div className="flex items-center space-x-6 ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="text-white/90 hover:text-white">
                Features
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-black/95 border-primary/20">
              <DropdownMenuItem className="text-white/90 focus:text-white focus:bg-primary/20">
                Solidity Projects
              </DropdownMenuItem>
              <DropdownMenuItem className="text-white/90 focus:text-white focus:bg-primary/20">
                AI Enabled Test Generation
              </DropdownMenuItem>
              <DropdownMenuItem className="text-white/90 focus:text-white focus:bg-primary/20">
                Reports
              </DropdownMenuItem>
              <DropdownMenuItem className="text-white/90 focus:text-white focus:bg-primary/20">
                Run Tests On Demand
              </DropdownMenuItem>
              <DropdownMenuItem className="text-white/90 focus:text-white focus:bg-primary/20">
                Manage Teams
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" className="text-white/90 hover:text-white">
            Pricing
          </Button>

          <Button 
            variant="default" 
            className="bg-primary hover:bg-primary/90 text-black"
            asChild
          >
            <Link href={user ? "/projects" : "/auth"}>Go to App</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}