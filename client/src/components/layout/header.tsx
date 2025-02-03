import { Link } from "wouter";
import { SiGithub } from "react-icons/si";

export default function Header() {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <Link href="/" className="flex items-center space-x-2 font-bold">
          <SiGithub className="h-6 w-6" />
          <span className="hidden sm:inline-block">
            GitHub Testing Platform
          </span>
        </Link>
      </div>
    </header>
  );
}
