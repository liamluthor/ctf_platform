import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { usePlatformSettings } from "@/hooks/use-platform-settings";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Flag, Menu, X, User, LogOut, Settings, Trophy, Users } from "lucide-react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/ctfs", label: "Competitions" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/teams", label: "Teams" },
];

export function Navbar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { settings } = usePlatformSettings();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-white/5">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            {settings?.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={settings.platformName}
                className="w-8 h-8 object-contain rounded-lg"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                <Flag className="w-4 h-4 text-primary" />
              </div>
            )}
            <span className="font-orbitron font-bold text-lg">
              {settings?.platformName || "CTF Platform"}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`font-tech uppercase text-sm tracking-wider transition-colors ${
                  location === link.href
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth Section */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <span className="font-tech">{user.username}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href={`/profile/${user.id}`}>
                      <a className="flex items-center gap-2 w-full">
                        <User className="w-4 h-4" />
                        Profile
                      </a>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/team">
                      <a className="flex items-center gap-2 w-full">
                        <Users className="w-4 h-4" />
                        My Team
                      </a>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <a className="flex items-center gap-2 w-full">
                        <Settings className="w-4 h-4" />
                        Account Settings
                      </a>
                    </Link>
                  </DropdownMenuItem>
                  {(user.role === "admin" || user.role === "owner") && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin">
                          <a className="flex items-center gap-2 w-full">
                            <Settings className="w-4 h-4" />
                            Admin Panel
                          </a>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => logoutMutation.mutate()}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/auth">
                <Button className="bg-primary hover:bg-primary/90 font-tech uppercase tracking-wider">
                  Sign In
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-card border-t border-white/5"
          >
            <div className="container mx-auto px-4 py-4 space-y-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block font-tech uppercase text-sm tracking-wider py-2 ${
                    location === link.href
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-4 border-t border-white/5">
                {user ? (
                  <div className="space-y-2">
                    <Link href={`/profile/${user.id}`}>
                      <a
                        className="block font-tech text-sm py-2"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Profile
                      </a>
                    </Link>
                    <Link href="/settings">
                      <a
                        className="block font-tech text-sm py-2"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Account Settings
                      </a>
                    </Link>
                    {(user.role === "admin" || user.role === "owner") && (
                      <Link href="/admin">
                        <a
                          className="block font-tech text-sm py-2"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Admin Panel
                        </a>
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        logoutMutation.mutate();
                        setMobileMenuOpen(false);
                      }}
                      className="block w-full text-left font-tech text-sm py-2 text-destructive"
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <Link href="/auth">
                    <Button
                      className="w-full bg-primary hover:bg-primary/90 font-tech uppercase tracking-wider"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Sign In
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
