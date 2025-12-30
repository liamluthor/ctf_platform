import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePlatformSettings } from "@/hooks/use-platform-settings";
import { Loader2, CheckCircle2, XCircle, Flag } from "lucide-react";

export default function VerifyEmailPage() {
  const { settings } = usePlatformSettings();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const [verificationStatus, setVerificationStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMessage, setErrorMessage] = useState("");

  // Extract token from URL query params
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  const verifyEmailMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await fetch("/api/account/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to verify email");
      }

      return response.json();
    },
    onSuccess: () => {
      setVerificationStatus("success");
      // Invalidate user query to refetch with updated emailVerified status
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: Error) => {
      setVerificationStatus("error");
      setErrorMessage(error.message);
    },
  });

  useEffect(() => {
    if (token) {
      verifyEmailMutation.mutate(token);
    } else {
      setVerificationStatus("error");
      setErrorMessage("No verification token provided");
    }
  }, [token]);

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
              Verify your email to unlock all platform features
            </p>
          </div>
        </motion.div>

        {/* Right side - Verification Status */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {verificationStatus === "verifying" && (
            <Card className="bg-card border-white/5">
              <CardHeader className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <CardTitle className="text-2xl font-orbitron">Verifying Email</CardTitle>
                <CardDescription>
                  Please wait while we verify your email address...
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-secondary/50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">
                    This should only take a moment.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {verificationStatus === "success" && (
            <Card className="bg-card border-white/5">
              <CardHeader className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <CardTitle className="text-2xl font-orbitron">Email Verified!</CardTitle>
                <CardDescription>
                  Your email address has been successfully verified
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                  <p className="text-sm text-green-200">
                    You now have full access to all platform features, including password reset and email notifications.
                  </p>
                </div>
                <Link href="/auth">
                  <Button className="w-full bg-primary hover:bg-primary/90 font-tech uppercase tracking-wider">
                    Continue to Platform
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {verificationStatus === "error" && (
            <Card className="bg-card border-white/5">
              <CardHeader className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center border border-destructive/20">
                  <XCircle className="w-8 h-8 text-destructive" />
                </div>
                <CardTitle className="text-2xl font-orbitron">Verification Failed</CardTitle>
                <CardDescription>
                  We couldn't verify your email address
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive text-center">
                    {errorMessage || "The verification link is invalid or has expired."}
                  </p>
                </div>
                <div className="text-center text-sm text-muted-foreground">
                  <p>
                    Please request a new verification email from your account settings.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href="/auth" className="flex-1">
                    <Button variant="outline" className="w-full">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/settings" className="flex-1">
                    <Button className="w-full bg-primary hover:bg-primary/90 font-tech uppercase tracking-wider">
                      Account Settings
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
}
