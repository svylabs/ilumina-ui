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
      <div className="container flex h-20 max-w-screen-2xl items-center">
        <Link href="/" className="flex flex-col justify-center">
          <div className="flex items-center">
            <div className="p-3 bg-primary rounded-lg mr-3">
              <SunDim className="h-7 w-7 text-black" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-semibold">
                <span className="text-white font-bold">i</span><span className="text-primary">lumina</span>
              </span>
              <span className="text-sm text-white/70">
                Agent based simulations for your protocol
              </span>
            </div>
          </div>
        </Link>

        <div className="flex items-center space-x-6 ml-auto">
          {user ? (
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