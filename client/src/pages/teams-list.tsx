import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Crown, ArrowLeft, Calendar } from "lucide-react";
import { format } from "date-fns";
import type { Team } from "@shared/schema";

interface TeamMember {
  id: string;
  username: string;
  joinedAt: string;
}

interface TeamWithMembers extends Team {
  members: TeamMember[];
}

export default function TeamsListPage() {
  const { id } = useParams<{ id?: string }>();

  // If ID is present, show team detail view
  if (id) {
    return <TeamDetailView teamId={parseInt(id)} />;
  }

  // Otherwise show teams list
  const { data: teams, isLoading } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-3xl font-orbitron font-bold mb-2">
              <span className="text-primary">Teams</span>
            </h1>
            <p className="text-muted-foreground">
              Browse all registered teams on the platform.
            </p>
          </div>

          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : teams && teams.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teams.map((team, index) => (
                <motion.div
                  key={team.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                >
                  <Link href={`/teams/${team.id}`}>
                    <Card className="bg-card border-white/5 hover:border-primary/30 transition-colors cursor-pointer">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Users className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-orbitron font-bold">{team.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              Created {new Date(team.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <Card className="bg-card border-white/5">
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-orbitron font-bold mb-2">No Teams Yet</h3>
                <p className="text-muted-foreground text-sm">
                  Be the first to create a team!
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

function TeamDetailView({ teamId }: { teamId: number }) {
  const { data: team, isLoading } = useQuery<TeamWithMembers>({
    queryKey: [`/api/teams/${teamId}`],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-24 pb-16 container mx-auto px-4">
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans">
        <Navbar />
        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-orbitron mb-2">Team Not Found</h1>
            <p className="text-muted-foreground mb-6">This team doesn't exist or has been removed.</p>
            <Link href="/teams">
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Teams
              </Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Back Button */}
          <Link href="/teams">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Teams
            </Button>
          </Link>

          {/* Team Header */}
          <Card className="bg-card border-white/5 mb-6">
            <CardContent className="p-8">
              <div className="flex items-center gap-6 mb-4">
                <div className="w-20 h-20 rounded-lg bg-primary/10 flex items-center justify-center border-2 border-primary">
                  <Users className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <h1 className="text-3xl font-orbitron font-bold">{team.name}</h1>
                  <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Created {format(new Date(team.createdAt), "MMM d, yyyy")}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {team.members.length} {team.members.length === 1 ? "Member" : "Members"}
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Invite Code: <code className="bg-secondary/50 px-2 py-1 rounded font-mono">{team.inviteCode}</code>
              </div>
            </CardContent>
          </Card>

          {/* Team Members */}
          <Card className="bg-card border-white/5">
            <CardHeader>
              <CardTitle className="font-orbitron">Team Members</CardTitle>
            </CardHeader>
            <CardContent>
              {team.members && team.members.length > 0 ? (
                <div className="space-y-3">
                  {team.members.map((member) => (
                    <Link key={member.id} href={`/profile/${member.id}`}>
                      <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg hover:bg-secondary/70 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                            <Users className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-tech font-bold flex items-center gap-2">
                              {member.username}
                              {team.captainId === member.id && (
                                <Badge className="bg-amber-500/20 text-amber-400 flex items-center gap-1">
                                  <Crown className="w-3 h-3" />
                                  Captain
                                </Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Joined {format(new Date(member.joinedAt), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No members in this team yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
