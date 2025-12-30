import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { usePlatformSettings } from "@/hooks/use-platform-settings";
import { Loader2, Mail, ArrowLeft, Flag, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const { settings } = usePlatformSettings();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const forgotPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch("/api/account/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send reset email");
      }

      return response.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }
    forgotPasswordMutation.mutate(email);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="bg-card border-white/5">
              <CardHeader className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <CardTitle className="text-2xl font-orbitron">Check Your Email</CardTitle>
                <CardDescription>
                  If an account exists with this email, a password reset link has been sent
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-secondary/50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">
                    Please check your inbox and click the password reset link. The link will expire in 1 hour.
                  </p>
                </div>
                <Link href="/auth">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Sign In
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Left side - Branding */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="hidden lg:flex flex-col items-center justify-center text-center p-8"
        >
          <div className="mb-8">
            {settings?.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={settings.platformName}
                className="w-24 h-24 mx-auto mb-6 object-contain"
              />
            ) : (
              <div className="w-24 h-24 mx-auto mb-6 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <Flag className="w-12 h-12 text-primary" />
              </div>
            )}
            <h1 className="text-4xl font-orbitron font-bold mb-4">
              {settings?.platformName || "CTF Platform"}
            </h1>
            <p className="text-muted-foreground text-lg max-w-md">
              Reset your password and get back to competing
            </p>
          </div>
        </motion.div>

        {/* Right side - Forgot Password form */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="bg-card border-white/5">
            <CardHeader className="text-center">
              <div className="lg:hidden mb-4">
                <div className="w-16 h-16 mx-auto rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Mail className="w-8 h-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-2xl font-orbitron">Forgot Password?</CardTitle>
              <CardDescription>
                Enter your email address and we'll send you a password reset link
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 font-tech uppercase tracking-wider"
                  disabled={forgotPasswordMutation.isPending}
                >
                  {forgotPasswordMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Send Reset Link
                    </>
                  )}
                </Button>

                <div className="text-center pt-4">
                  <Link href="/auth">
                    <a className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1">
                      <ArrowLeft className="w-3 h-3" />
                      Back to Sign In
                    </a>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
