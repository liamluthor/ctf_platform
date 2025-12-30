import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Flag, Home } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-24 h-24 mx-auto mb-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
          <Flag className="w-12 h-12 text-primary" />
        </div>
        <h1 className="text-6xl font-orbitron font-bold mb-4">
          4<span className="text-primary">0</span>4
        </h1>
        <h2 className="text-2xl font-orbitron mb-4">Page Not Found</h2>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          The page you're looking for doesn't exist or has been moved.
          Maybe try capturing a different flag?
        </p>
        <Link href="/">
          <Button className="bg-primary hover:bg-primary/90 font-tech uppercase tracking-widest">
            <Home className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
