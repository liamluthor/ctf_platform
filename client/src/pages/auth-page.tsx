import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePlatformSettings } from "@/hooks/use-platform-settings";
import { Link, Redirect } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Flag, Shield } from "lucide-react";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const { settings } = usePlatformSettings();
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [registerData, setRegisterData] = useState({ username: "", email: "", password: "", confirmPassword: "" });

  if (user) {
    return <Redirect to="/" />;
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(loginData);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (registerData.password !== registerData.confirmPassword) {
      return;
    }
    registerMutation.mutate({
      username: registerData.username,
      email: registerData.email,
      password: registerData.password,
    });
  };

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
              {settings?.platformTagline || "Test Your Cybersecurity Skills"}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
            <div className="p-4 rounded-lg bg-card border border-white/5 text-center">
              <div className="text-2xl font-bold text-primary">CTF</div>
              <div className="text-xs text-muted-foreground">Competitions</div>
            </div>
            <div className="p-4 rounded-lg bg-card border border-white/5 text-center">
              <div className="text-2xl font-bold text-primary">7+</div>
              <div className="text-xs text-muted-foreground">Categories</div>
            </div>
            <div className="p-4 rounded-lg bg-card border border-white/5 text-center">
              <Shield className="w-6 h-6 mx-auto text-primary" />
              <div className="text-xs text-muted-foreground mt-1">Secure</div>
            </div>
          </div>
        </motion.div>

        {/* Right side - Auth forms */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="bg-card border-white/5">
            <CardHeader className="text-center">
              <div className="lg:hidden mb-4">
                <div className="w-16 h-16 mx-auto rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Flag className="w-8 h-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-2xl font-orbitron">Welcome</CardTitle>
              <CardDescription>
                Sign in to your account or create a new one
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-username" className="font-tech uppercase text-xs tracking-wider">
                        Username
                      </Label>
                      <Input
                        id="login-username"
                        type="text"
                        value={loginData.username}
                        onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                        placeholder="Enter your username"
                        className="bg-secondary border-white/10"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password" className="font-tech uppercase text-xs tracking-wider">
                        Password
                      </Label>
                      <Input
                        id="login-password"
                        type="password"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        placeholder="Enter your password"
                        className="bg-secondary border-white/10"
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-primary hover:bg-primary/90 font-tech uppercase tracking-widest"
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Sign In
                    </Button>
                    <div className="text-center pt-2">
                      <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                        Forgot password?
                      </Link>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-username" className="font-tech uppercase text-xs tracking-wider">
                        Username
                      </Label>
                      <Input
                        id="register-username"
                        type="text"
                        value={registerData.username}
                        onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                        placeholder="Choose a username"
                        className="bg-secondary border-white/10"
                        required
                        minLength={3}
                        maxLength={32}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-email" className="font-tech uppercase text-xs tracking-wider">
                        Email
                      </Label>
                      <Input
                        id="register-email"
                        type="email"
                        value={registerData.email}
                        onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                        placeholder="Enter your email"
                        className="bg-secondary border-white/10"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-password" className="font-tech uppercase text-xs tracking-wider">
                        Password
                      </Label>
                      <Input
                        id="register-password"
                        type="password"
                        value={registerData.password}
                        onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                        placeholder="Create a password"
                        className="bg-secondary border-white/10"
                        required
                        minLength={8}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-confirm" className="font-tech uppercase text-xs tracking-wider">
                        Confirm Password
                      </Label>
                      <Input
                        id="register-confirm"
                        type="password"
                        value={registerData.confirmPassword}
                        onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                        placeholder="Confirm your password"
                        className="bg-secondary border-white/10"
                        required
                      />
                      {registerData.confirmPassword && registerData.password !== registerData.confirmPassword && (
                        <p className="text-xs text-destructive">Passwords do not match</p>
                      )}
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-primary hover:bg-primary/90 font-tech uppercase tracking-widest"
                      disabled={registerMutation.isPending || registerData.password !== registerData.confirmPassword}
                    >
                      {registerMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Create Account
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
