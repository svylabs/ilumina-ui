import { Link, useLocation } from "wouter";
import { SunDim, User, Menu } from "lucide-react";
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

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleHomeClick = (e: React.MouseEvent) => {
    if (window.location.pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setLocation('/');
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
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-primary/20 bg-black/95 backdrop-blur supports-[backdrop-filter]:bg-black/60">
      <div className="container px-6 mx-auto flex h-20 max-w-screen-2xl items-center">
        <Link href="/" onClick={handleHomeClick} className="flex flex-col justify-center">
          <div className="flex items-center">
            <div className="p-3 bg-primary rounded-lg mr-3">
              <SunDim className="h-7 w-7 text-black" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-semibold">
                <span className="text-white font-bold">i</span><span className="text-primary">lumina</span>
              </span>
              <span className="text-sm text-white/70 hidden sm:block">
                Agent based simulations for your protocol
              </span>
            </div>
          </div>
        </Link>

        <div className="flex items-center space-x-4 sm:space-x-6 ml-auto">
          {user ? (
            <>
              <Button 
                variant="ghost" 
                className="text-white/90 hover:text-white hidden sm:flex"
                asChild
              >
                <Link href="/projects">My Projects</Link>
              </Button>

              {user.plan === 'teams' && (
                <Button 
                  variant="ghost" 
                  className="text-white/90 hover:text-white hidden sm:flex"
                  asChild
                >
                  <Link href="/teams">Teams</Link>
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="text-white/90 hover:text-white">
                    <User className="h-5 w-5 sm:mr-2" />
                    <span className="hidden sm:inline">{user.name}</span>
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
                    className="text-white/90 focus:text-white focus:bg-primary/20 cursor-pointer sm:hidden"
                    onClick={() => setLocation('/projects')}
                  >
                    My Projects
                  </DropdownMenuItem>

                  {user.plan === 'teams' && (
                    <DropdownMenuItem 
                      className="text-white/90 focus:text-white focus:bg-primary/20 cursor-pointer sm:hidden"
                      onClick={() => setLocation('/teams')}
                    >
                      Teams
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem 
                    className="text-white/90 focus:text-white focus:bg-primary/20 cursor-pointer"
                    onClick={() => scrollToSection("pricing")}
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
              <Button 
                variant="ghost" 
                className="text-white/90 hover:text-white hidden sm:flex"
                onClick={() => scrollToSection("features")}
                >
                  Features
                </Button>
              <Button 
                variant="ghost" 
                className="text-white/90 hover:text-white hidden sm:flex"
                onClick={() => scrollToSection("pricing")}
                >
                  Pricing
                </Button>
              <Button 
                variant="ghost" 
                className="text-white/90 hover:text-white hidden sm:flex"
                onClick={() => scrollToSection("about")}
                >
                  About
                </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild className="sm:hidden">
                  <Button variant="ghost" className="text-white/90 hover:text-white">
                    <Menu className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-black/95 border-primary/20">
                  <DropdownMenuItem onClick={() => scrollToSection("features")}>Features</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => scrollToSection("pricing")}>Pricing</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => scrollToSection("about")}>About</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

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