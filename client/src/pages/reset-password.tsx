import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useLocation, Redirect } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { usePlatformSettings } from "@/hooks/use-platform-settings";
import { Loader2, Lock, CheckCircle2, AlertCircle, Flag } from "lucide-react";

export default function ResetPasswordPage() {
  const { toast } = useToast();
  const { settings } = usePlatformSettings();
  const [location] = useLocation();
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [resetSuccess, setResetSuccess] = useState(false);

  // Extract token from URL query params
  const params = new URLSearchParams(location.split("?")[1]);
  const token = params.get("token");

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { token: string; newPassword: string }) => {
      const response = await fetch("/api/account/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reset password");
      }

      return response.json();
    },
    onSuccess: () => {
      setResetSuccess(true);
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

    if (!token) {
      toast({
        title: "Error",
        description: "Invalid reset link",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    resetPasswordMutation.mutate({
      token,
      newPassword: passwordData.newPassword,
    });
  };

  // If no token, redirect to forgot password page
  if (!token) {
    return <Redirect to="/forgot-password" />;
  }

  if (resetSuccess) {
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
                <CardTitle className="text-2xl font-orbitron">Password Reset Successful</CardTitle>
                <CardDescription>
                  Your password has been successfully updated
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-secondary/50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">
                    You can now sign in with your new password.
                  </p>
                </div>
                <Link href="/auth">
                  <Button className="w-full bg-primary hover:bg-primary/90 font-tech uppercase tracking-wider">
                    Sign In
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
              Set a new secure password for your account
            </p>
          </div>
        </motion.div>

        {/* Right side - Reset Password form */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="bg-card border-white/5">
            <CardHeader className="text-center">
              <div className="lg:hidden mb-4">
                <div className="w-16 h-16 mx-auto rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Lock className="w-8 h-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-2xl font-orbitron">Reset Password</CardTitle>
              <CardDescription>
                Enter your new password below
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-200">
                    Choose a strong password with at least 8 characters
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Enter new password"
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, newPassword: e.target.value })
                    }
                    required
                    minLength={8}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Must be at least 8 characters
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm new password"
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                    }
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 font-tech uppercase tracking-wider"
                  disabled={resetPasswordMutation.isPending}
                >
                  {resetPasswordMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      Reset Password
                    </>
                  )}
                </Button>

                <div className="text-center pt-4">
                  <Link href="/auth">
                    <a className="text-sm text-muted-foreground hover:text-primary transition-colors">
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
