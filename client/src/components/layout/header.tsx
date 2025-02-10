import { Link, useLocation } from "wouter";
import { SunDim, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

export default function Header() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    try {
      await logout();
      setLocation('/'); // Redirect to home page after logout
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const getPlanBadgeVariant = (plan: string) => {
    switch (plan) {
      case 'pro':
        return 'default';
      case 'teams':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <header className="border-b border-primary/20 bg-black/95 backdrop-blur supports-[backdrop-filter]:bg-black/60">
      <div className="container flex h-16 max-w-screen-2xl items-center">
        <Link href="/" className="flex flex-col items-start">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary rounded-lg">
              <SunDim className="h-6 w-6 text-black" />
            </div>
            <span className="text-xl font-semibold text-white">
              <span className="text-primary font-bold">i</span>lumina
            </span>
          </div>
          <span className="text-sm text-white/70 mt-1">
            Agent based simulations for your protocol
          </span>
        </Link>

        <div className="flex items-center space-x-6 ml-auto">
          {user ? (
            // Logged in state
            <>
              <Button 
                variant="ghost" 
                className="text-white/90 hover:text-white"
                asChild
              >
                <Link href="/projects">My Projects</Link>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="text-white/90 hover:text-white">
                    <User className="h-5 w-5 mr-2" />
                    {user.name}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-black/95 border-primary/20">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Account</span>
                    <Badge variant={getPlanBadgeVariant(user.plan)} className="capitalize">
                      {user.plan} Plan
                    </Badge>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-white/90 focus:text-white focus:bg-primary/20 cursor-pointer"
                    onClick={() => setLocation("/#pricing")}
                  >
                    Upgrade Plan
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="text-white/90 focus:text-white focus:bg-primary/20 cursor-pointer"
                    onClick={handleLogout}
                  >
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            // Logged out state
            <>
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

              <Button 
                variant="ghost" 
                className="text-white/90 hover:text-white"
                asChild
              >
                <Link href="/#pricing">Pricing</Link>
              </Button>

              <Button 
                variant="default" 
                className="bg-primary hover:bg-primary/90 text-black"
                asChild
              >
                <Link href="/auth">Sign In</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}