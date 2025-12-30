import { Link } from "wouter";
import { Flag, Github } from "lucide-react";
import { usePlatformSettings } from "@/hooks/use-platform-settings";

export function Footer() {
  const { settings } = usePlatformSettings();

  return (
    <footer className="border-t border-white/5 bg-card/50">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
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
            <p className="text-muted-foreground text-sm max-w-md">
              {settings?.platformTagline || "Test Your Cybersecurity Skills"}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-tech uppercase text-xs tracking-wider mb-4 text-muted-foreground">
              Quick Links
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/ctfs" className="text-sm hover:text-primary transition-colors">
                  Competitions
                </Link>
              </li>
              <li>
                <Link href="/leaderboard" className="text-sm hover:text-primary transition-colors">
                  Leaderboard
                </Link>
              </li>
              <li>
                <Link href="/teams" className="text-sm hover:text-primary transition-colors">
                  Teams
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-tech uppercase text-xs tracking-wider mb-4 text-muted-foreground">
              Resources
            </h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://ctftime.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:text-primary transition-colors"
                >
                  CTFtime
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/liamluthor/ctf_platform"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:text-primary transition-colors"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 mt-8 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            {settings?.footerCopyright || `© ${new Date().getFullYear()} CTF Platform. All rights reserved.`}
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/liamluthor/ctf_platform"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <Github className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
