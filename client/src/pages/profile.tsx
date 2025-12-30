import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Trophy, Target, Calendar, Users, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import type { User as UserType, Solve, Team } from "@shared/schema";

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();

  const { data: user, isLoading: userLoading } = useQuery<Omit<UserType, "password">>({
    queryKey: [`/api/users/${id}`],
  });

  const { data: solves } = useQuery<Solve[]>({
    queryKey: [`/api/users/${id}/solves`],
  });

  const { data: team } = useQuery<Team | null>({
    queryKey: [`/api/users/${id}/team`],
  });

  const totalPoints = solves?.reduce((acc, s) => acc + s.points, 0) || 0;
  const firstBloods = solves?.filter((s) => s.isFirstBlood).length || 0;

  if (userLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-24 pb-16 container mx-auto px-4">
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-24 pb-16 container mx-auto px-4 text-center">
          <User className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-orbitron mb-2">User Not Found</h1>
          <p className="text-muted-foreground">This user doesn't exist or has been removed.</p>
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
          {/* Profile Header */}
          <Card className="bg-card border-white/5 mb-6">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary">
                  <User className="w-12 h-12 text-primary" />
                </div>
                <div className="text-center md:text-left">
                  <div className="flex items-center gap-3 justify-center md:justify-start">
                    <h1 className="text-3xl font-orbitron font-bold">{user.username}</h1>
                    {user.role === "admin" && (
                      <Badge className="bg-primary/20 text-primary">Admin</Badge>
                    )}
                  </div>
                  {user.bio && (
                    <p className="text-muted-foreground mt-2 max-w-md">{user.bio}</p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground justify-center md:justify-start">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Joined {format(new Date(user.createdAt), "MMM yyyy")}
                    </div>
                    {team && (
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {team.name}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-card border-white/5">
              <CardContent className="p-4 text-center">
                <Trophy className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-2xl font-orbitron font-bold">{totalPoints}</p>
                <p className="text-xs text-muted-foreground">Total Points</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-white/5">
              <CardContent className="p-4 text-center">
                <Target className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-2xl font-orbitron font-bold">{solves?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Challenges Solved</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-white/5">
              <CardContent className="p-4 text-center">
                <CheckCircle2 className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                <p className="text-2xl font-orbitron font-bold">{firstBloods}</p>
                <p className="text-xs text-muted-foreground">First Bloods</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-white/5">
              <CardContent className="p-4 text-center">
                <Users className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-2xl font-orbitron font-bold">{team ? 1 : 0}</p>
                <p className="text-xs text-muted-foreground">Team</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Solves */}
          <Card className="bg-card border-white/5">
            <CardHeader>
              <CardTitle className="font-orbitron">Recent Solves</CardTitle>
            </CardHeader>
            <CardContent>
              {solves && solves.length > 0 ? (
                <div className="space-y-3">
                  {solves.slice(0, 10).map((solve) => (
                    <div
                      key={solve.id}
                      className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <div>
                          <p className="font-tech">{solve.challenge?.title || `Challenge #${solve.challengeId}`}</p>
                          <p className="text-xs text-muted-foreground">
                            {solve.ctfEvent?.name} • {format(new Date(solve.solvedAt), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {solve.isFirstBlood && (
                          <Badge className="bg-amber-500/20 text-amber-400">1st Blood</Badge>
                        )}
                        <span className="font-orbitron text-primary font-bold">
                          +{solve.points}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No challenges solved yet.</p>
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
