import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Users, Crown, Copy, UserPlus, LogOut, RefreshCw } from "lucide-react";
import { Link, Redirect } from "wouter";

interface TeamMember {
  id: string;
  username: string;
  joinedAt: string;
}

interface Team {
  id: number;
  name: string;
  inviteCode: string;
  captainId: string;
  members: TeamMember[];
  createdAt: string;
}

export default function TeamPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [createTeamName, setCreateTeamName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);

  const { data: team, isLoading } = useQuery<Team | null>({
    queryKey: [`/api/users/${user?.id}/team`],
    enabled: !!user,
  });

  const createTeamMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create team");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Team created successfully!" });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.id}/team`] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setCreateDialogOpen(false);
      setCreateTeamName("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const joinTeamMutation = useMutation({
    mutationFn: async (inviteCode: string) => {
      const res = await fetch("/api/teams/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to join team");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Successfully joined team!" });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.id}/team`] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setJoinDialogOpen(false);
      setJoinCode("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const leaveTeamMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/teams/leave", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to leave team");
      }
    },
    onSuccess: () => {
      toast({ title: "Left team successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.id}/team`] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const regenerateCodeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/teams/${team?.id}/regenerate-invite`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to regenerate invite code");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invite code regenerated" });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.id}/team`] });
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${team?.id}`] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (!user) {
    return <Redirect to="/auth" />;
  }

  const copyInviteCode = () => {
    if (team?.inviteCode) {
      navigator.clipboard.writeText(team.inviteCode);
      toast({ title: "Invite code copied!" });
    }
  };

  const isCaptain = team?.captainId === user.id;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="text-3xl font-orbitron font-bold mb-8">
            My <span className="text-primary">Team</span>
          </h1>

          {isLoading ? (
            <Card className="bg-card border-white/5">
              <CardContent className="py-12 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </CardContent>
            </Card>
          ) : team ? (
            <div className="space-y-6">
              {/* Team Info */}
              <Card className="bg-card border-white/5">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="font-orbitron">{team.name}</CardTitle>
                        <CardDescription>
                          {team.members.length} member{team.members.length !== 1 ? "s" : ""}
                        </CardDescription>
                      </div>
                    </div>
                    {isCaptain && <Badge>Captain</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Invite Code */}
                  <div>
                    <Label className="font-tech uppercase text-xs tracking-wider">
                      Invite Code
                    </Label>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-secondary border border-white/10 rounded-lg px-4 py-2 font-mono">
                        {team.inviteCode}
                      </div>
                      <Button variant="outline" size="icon" onClick={copyInviteCode}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      {isCaptain && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => regenerateCodeMutation.mutate()}
                          disabled={regenerateCodeMutation.isPending}
                        >
                          <RefreshCw
                            className={`w-4 h-4 ${
                              regenerateCodeMutation.isPending ? "animate-spin" : ""
                            }`}
                          />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Members */}
                  <div>
                    <Label className="font-tech uppercase text-xs tracking-wider mb-2 block">
                      Members
                    </Label>
                    <div className="space-y-2">
                      {team.members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              {member.id === team.captainId ? (
                                <Crown className="w-4 h-4 text-primary" />
                              ) : (
                                <Users className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                            <span className="font-tech">{member.username}</span>
                          </div>
                          {member.id === team.captainId && (
                            <Badge variant="outline">Captain</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Leave Team */}
                  {!isCaptain && (
                    <Button
                      variant="destructive"
                      onClick={() => leaveTeamMutation.mutate()}
                      disabled={leaveTeamMutation.isPending}
                      className="w-full"
                    >
                      {leaveTeamMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <LogOut className="w-4 h-4 mr-2" />
                      )}
                      Leave Team
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="bg-card border-white/5">
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-orbitron font-bold mb-2">No Team</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  You're not part of a team yet. Create one or join an existing team.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  {/* Create Team Dialog */}
                  <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-primary hover:bg-primary/90">
                        <Users className="w-4 h-4 mr-2" />
                        Create Team
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-card border-white/10">
                      <DialogHeader>
                        <DialogTitle className="font-orbitron">Create a Team</DialogTitle>
                        <DialogDescription>
                          Create a new team and invite others to join.
                        </DialogDescription>
                      </DialogHeader>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          createTeamMutation.mutate(createTeamName);
                        }}
                        className="space-y-4"
                      >
                        <div>
                          <Label htmlFor="team-name">Team Name</Label>
                          <Input
                            id="team-name"
                            value={createTeamName}
                            onChange={(e) => setCreateTeamName(e.target.value)}
                            placeholder="Enter team name"
                            className="bg-secondary border-white/10"
                            minLength={3}
                            required
                          />
                        </div>
                        <Button
                          type="submit"
                          className="w-full bg-primary hover:bg-primary/90"
                          disabled={createTeamMutation.isPending}
                        >
                          {createTeamMutation.isPending && (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          )}
                          Create Team
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>

                  {/* Join Team Dialog */}
                  <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Join Team
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-card border-white/10">
                      <DialogHeader>
                        <DialogTitle className="font-orbitron">Join a Team</DialogTitle>
                        <DialogDescription>
                          Enter an invite code to join an existing team.
                        </DialogDescription>
                      </DialogHeader>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          joinTeamMutation.mutate(joinCode);
                        }}
                        className="space-y-4"
                      >
                        <div>
                          <Label htmlFor="invite-code">Invite Code</Label>
                          <Input
                            id="invite-code"
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            placeholder="XXXXXXXX"
                            className="bg-secondary border-white/10 font-mono uppercase"
                            maxLength={8}
                            required
                          />
                        </div>
                        <Button
                          type="submit"
                          className="w-full bg-primary hover:bg-primary/90"
                          disabled={joinTeamMutation.isPending}
                        >
                          {joinTeamMutation.isPending && (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          )}
                          Join Team
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
