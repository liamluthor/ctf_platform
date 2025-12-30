import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Lock, Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { Redirect } from "wouter";
import { Badge } from "@/components/ui/badge";

export default function AccountSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [profileData, setProfileData] = useState({
    bio: user?.bio || "",
    avatarUrl: user?.avatarUrl || "",
  });

  if (!user) {
    return <Redirect to="/auth" />;
  }

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to change password");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password changed",
        description: "Your password has been successfully updated.",
      });
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { bio?: string; avatarUrl?: string }) => {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update profile");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
      // Trigger a page refresh to update the user data
      window.location.reload();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sendVerificationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/account/send-verification", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send verification email");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Verification email sent",
        description: "Please check your inbox and click the verification link.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
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

    changePasswordMutation.mutate({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
    });
  };

  const handleProfileUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(profileData);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-orbitron font-bold mb-2">Account Settings</h1>
            <p className="text-muted-foreground">Manage your account preferences and security settings</p>
          </div>

          <div className="space-y-6">
            {/* Email Verification Status */}
            <Card className="bg-card border-white/5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-orbitron flex items-center gap-2">
                      <Mail className="w-5 h-5" />
                      Email Verification
                    </CardTitle>
                    <CardDescription>Verify your email address to unlock all features</CardDescription>
                  </div>
                  {user.emailVerified ? (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-500/30 text-amber-400">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Unverified
                    </Badge>
                  )}
                </div>
              </CardHeader>
              {!user.emailVerified && (
                <CardContent>
                  <div className="flex items-center justify-between p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <div>
                      <p className="font-tech text-sm">Email: {user.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Please verify your email to enable password reset and notifications
                      </p>
                    </div>
                    <Button
                      onClick={() => sendVerificationMutation.mutate()}
                      disabled={sendVerificationMutation.isPending}
                      variant="outline"
                      className="border-amber-500/30"
                    >
                      {sendVerificationMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Send Verification Email"
                      )}
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Profile Settings */}
            <Card className="bg-card border-white/5">
              <CardHeader>
                <CardTitle className="font-orbitron flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Profile Information
                </CardTitle>
                <CardDescription>Update your public profile details</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileUpdate} className="space-y-4">
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={user.username}
                      disabled
                      className="bg-secondary/50"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Username cannot be changed
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={user.email}
                      disabled
                      className="bg-secondary/50"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Email cannot be changed
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      placeholder="Tell us about yourself..."
                      value={profileData.bio}
                      onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                      maxLength={500}
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {profileData.bio.length}/500 characters
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="avatarUrl">Avatar URL (Optional)</Label>
                    <Input
                      id="avatarUrl"
                      type="url"
                      placeholder="https://example.com/avatar.jpg"
                      value={profileData.avatarUrl}
                      onChange={(e) => setProfileData({ ...profileData, avatarUrl: e.target.value })}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    className="w-full sm:w-auto"
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Profile"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Password Change */}
            <Card className="bg-card border-white/5">
              <CardHeader>
                <CardTitle className="font-orbitron flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Change Password
                </CardTitle>
                <CardDescription>Update your password to keep your account secure</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, currentPassword: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, newPassword: e.target.value })
                      }
                      required
                      minLength={8}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Must be at least 8 characters
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                      }
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={changePasswordMutation.isPending}
                    className="w-full sm:w-auto"
                  >
                    {changePasswordMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Changing...
                      </>
                    ) : (
                      "Change Password"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
