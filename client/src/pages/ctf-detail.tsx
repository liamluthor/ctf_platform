import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { CountdownTimer } from "@/components/ctf/countdown-timer";
import { ChallengeCard } from "@/components/ctf/challenge-card";
import { ChallengeModal } from "@/components/ctf/challenge-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Clock,
  Users,
  Trophy,
  Calendar,
  ChevronLeft,
  Lock,
  Flag,
  Target,
  KeyRound,
} from "lucide-react";
import { format, isPast, isFuture } from "date-fns";
import type { CtfEvent } from "@shared/schema";

interface Challenge {
  id: number;
  name: string;
  description: string;
  points: number;
  solveCount: number;
  isDynamic: boolean;
  category: {
    id: number;
    name: string;
    color: string;
    icon: string;
  } | null;
  solved: boolean;
  isHidden: boolean;
}

export default function CtfDetailPage() {
  const { id } = useParams<{ id: string }>();
  const ctfId = parseInt(id!);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");

  const { data: ctf, isLoading: ctfLoading } = useQuery<CtfEvent>({
    queryKey: [`/api/ctfs/${ctfId}`],
  });

  const { data: isRegistered } = useQuery<boolean>({
    queryKey: [`/api/ctfs/${ctfId}/registration`],
    enabled: !!user && !!ctf,
  });

  const { data: challenges, isLoading: challengesLoading } = useQuery<Challenge[]>({
    queryKey: [`/api/ctfs/${ctfId}/challenges`],
    enabled: !!user && !!ctf && isRegistered === true,
  });

  const { data: leaderboard } = useQuery<{
    isTeamBased: boolean;
    entries: Array<{
      rank: number;
      id: string | number;
      name: string;
      score: number;
      solves: number;
    }>;
  }>({
    queryKey: [`/api/ctfs/${ctfId}/leaderboard`],
    enabled: !!ctf,
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/ctfs/${ctfId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: ctf?.isPrivate ? inviteCode : undefined }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to register");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/ctfs/${ctfId}/registration`] });
      queryClient.invalidateQueries({ queryKey: [`/api/ctfs/${ctfId}/challenges`] });
      setRegisterDialogOpen(false);
      setInviteCode("");
      toast({
        title: "Registration Successful",
        description: "You've been registered for this CTF event!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (ctfLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-24 pb-16 container mx-auto px-4">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  if (!ctf) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-24 pb-16 container mx-auto px-4 text-center">
          <h1 className="text-2xl font-orbitron mb-4">CTF Not Found</h1>
          <Link href="/ctfs">
            <Button>Back to Competitions</Button>
          </Link>
        </main>
      </div>
    );
  }

  const now = new Date();
  const isActive = new Date(ctf.startTime) <= now && new Date(ctf.endTime) >= now;
  const isUpcoming = isFuture(new Date(ctf.startTime));
  const isPastEvent = isPast(new Date(ctf.endTime));

  // Get unique categories from challenges
  const categories = challenges
    ? Array.from(new Set(challenges.map((c) => c.category?.name).filter(Boolean)))
    : [];

  const solvedCount = challenges?.filter((c) => c.solved).length || 0;
  const totalPoints = challenges?.reduce((acc, c) => (c.solved ? acc + c.points : acc), 0) || 0;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Back link */}
          <Link href="/ctfs">
            <Button variant="ghost" className="mb-4 -ml-2">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to Competitions
            </Button>
          </Link>

          {/* CTF Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <h1 className="text-3xl font-orbitron font-bold">{ctf.name}</h1>
              <div className="flex items-center gap-2">
                {isActive && (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    <span className="w-2 h-2 rounded-full bg-green-400 mr-1 animate-pulse" />
                    Live
                  </Badge>
                )}
                {isUpcoming && <Badge variant="secondary">Upcoming</Badge>}
                {isPastEvent && <Badge variant="outline">Ended</Badge>}
                {ctf.isTeamBased && (
                  <Badge variant="outline">
                    <Users className="w-3 h-3 mr-1" />
                    Team
                  </Badge>
                )}
              </div>
            </div>

            {ctf.description && (
              <p className="text-muted-foreground max-w-3xl mb-6">{ctf.description}</p>
            )}

            {/* CTF Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-card border-white/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Start</p>
                    <p className="font-tech text-sm">
                      {format(new Date(ctf.startTime), "MMM d, h:mm a")}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-white/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <Clock className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">End</p>
                    <p className="font-tech text-sm">
                      {format(new Date(ctf.endTime), "MMM d, h:mm a")}
                    </p>
                  </div>
                </CardContent>
              </Card>
              {user && (
                <>
                  <Card className="bg-card border-white/5">
                    <CardContent className="p-4 flex items-center gap-3">
                      <Target className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Solved</p>
                        <p className="font-tech text-sm">
                          {solvedCount} / {challenges?.length || 0}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-white/5">
                    <CardContent className="p-4 flex items-center gap-3">
                      <Trophy className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Points</p>
                        <p className="font-tech text-sm">{totalPoints}</p>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* Countdown */}
            {isUpcoming && (
              <Card className="bg-card border-white/5 mb-6">
                <CardContent className="py-6">
                  <CountdownTimer
                    targetDate={ctf.startTime}
                    label="Competition starts in"
                  />
                </CardContent>
              </Card>
            )}

            {isActive && (
              <Card className="bg-card border-white/5 mb-6">
                <CardContent className="py-6">
                  <CountdownTimer
                    targetDate={ctf.endTime}
                    label="Time remaining"
                  />
                </CardContent>
              </Card>
            )}
          </div>

          <Tabs defaultValue="challenges" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="challenges">
                <Flag className="w-4 h-4 mr-2" />
                Challenges
              </TabsTrigger>
              <TabsTrigger value="leaderboard">
                <Trophy className="w-4 h-4 mr-2" />
                Leaderboard
              </TabsTrigger>
              {ctf.rules && (
                <TabsTrigger value="rules">Rules</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="challenges">
              {!user ? (
                <Card className="bg-card border-white/5">
                  <CardContent className="py-12 text-center">
                    <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-orbitron font-bold mb-2">Login Required</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      Please log in to view and solve challenges.
                    </p>
                    <Link href="/auth">
                      <Button className="bg-primary hover:bg-primary/90">Sign In</Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : isRegistered === false ? (
                <Card className="bg-card border-white/5">
                  <CardContent className="py-12 text-center">
                    <KeyRound className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-orbitron font-bold mb-2">
                      {ctf.isPrivate ? "Private Event" : "Registration Required"}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      {ctf.isPrivate
                        ? "This is a private event. You need an invite code to register."
                        : "Please register to view and solve challenges."}
                    </p>
                    <Button
                      className="bg-primary hover:bg-primary/90"
                      onClick={() => setRegisterDialogOpen(true)}
                    >
                      {ctf.isPrivate ? "Enter Invite Code" : "Register Now"}
                    </Button>
                  </CardContent>
                </Card>
              ) : isUpcoming ? (
                <Card className="bg-card border-white/5">
                  <CardContent className="py-12 text-center">
                    <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-orbitron font-bold mb-2">Coming Soon</h3>
                    <p className="text-muted-foreground text-sm">
                      Challenges will be available when the competition starts.
                    </p>
                  </CardContent>
                </Card>
              ) : challengesLoading ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
              ) : challenges && challenges.length > 0 ? (
                <div>
                  {/* Category filters */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    <Badge
                      variant={categoryFilter === "all" ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setCategoryFilter("all")}
                    >
                      All ({challenges.length})
                    </Badge>
                    {categories.map((cat) => (
                      <Badge
                        key={cat}
                        variant={categoryFilter === cat ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setCategoryFilter(cat!)}
                      >
                        {cat} ({challenges.filter((c) => c.category?.name === cat).length})
                      </Badge>
                    ))}
                  </div>

                  {/* Challenges grouped by category */}
                  <div className="space-y-8">
                    {(categoryFilter === "all" ? categories : [categoryFilter]).map((categoryName) => {
                      const categoryInfo = challenges.find((c) => c.category?.name === categoryName)?.category;
                      const categoryChallenges = challenges.filter((c) => c.category?.name === categoryName);

                      if (categoryChallenges.length === 0) return null;

                      return (
                        <motion.section
                          key={categoryName}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          {/* Category Header */}
                          <div className="flex items-center gap-3 mb-4">
                            <div
                              className="w-1 h-8 rounded-full"
                              style={{ backgroundColor: categoryInfo?.color || "#8B1538" }}
                            />
                            <h2
                              className="text-xl font-orbitron font-bold uppercase tracking-wider"
                              style={{ color: categoryInfo?.color || "#8B1538" }}
                            >
                              {categoryName}
                            </h2>
                            <span className="text-sm text-muted-foreground font-tech">
                              ({categoryChallenges.length} challenge{categoryChallenges.length !== 1 ? "s" : ""})
                            </span>
                          </div>

                          {/* Category Challenges Grid */}
                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {categoryChallenges.map((challenge, index) => (
                              <ChallengeCard
                                key={challenge.id}
                                challenge={challenge}
                                onClick={() => setSelectedChallenge(challenge)}
                                index={index}
                              />
                            ))}
                          </div>
                        </motion.section>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <Card className="bg-card border-white/5">
                  <CardContent className="py-12 text-center">
                    <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-orbitron font-bold mb-2">No Challenges</h3>
                    <p className="text-muted-foreground text-sm">
                      No challenges have been added yet.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="leaderboard">
              {leaderboard && leaderboard.entries.length > 0 ? (
                <Card className="bg-card border-white/5">
                  <CardHeader>
                    <CardTitle className="font-orbitron">
                      {leaderboard.isTeamBased ? "Team" : "Player"} Rankings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {leaderboard.entries.slice(0, 10).map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center gap-4 p-3 rounded-lg bg-secondary/50"
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-orbitron font-bold text-sm">
                            {entry.rank}
                          </div>
                          <div className="flex-1">
                            <p className="font-tech">{entry.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {entry.solves} solve{entry.solves !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <div className="font-orbitron font-bold text-primary">
                            {entry.score}
                          </div>
                        </div>
                      ))}
                    </div>

                    <Link href={`/leaderboard/${ctfId}`}>
                      <Button variant="outline" className="w-full mt-4">
                        View Full Leaderboard
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-card border-white/5">
                  <CardContent className="py-12 text-center">
                    <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-orbitron font-bold mb-2">No Scores Yet</h3>
                    <p className="text-muted-foreground text-sm">
                      Be the first to solve a challenge!
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {ctf.rules && (
              <TabsContent value="rules">
                <Card className="bg-card border-white/5">
                  <CardContent className="py-6">
                    <div className="prose prose-invert max-w-none">
                      <div dangerouslySetInnerHTML={{ __html: ctf.rules }} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </main>

      <Footer />

      <ChallengeModal
        challenge={selectedChallenge}
        ctfId={ctfId}
        open={!!selectedChallenge}
        onOpenChange={(open) => !open && setSelectedChallenge(null)}
      />

      {/* Registration Dialog */}
      <Dialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-orbitron">
              {ctf?.isPrivate ? "Enter Invite Code" : "Register for CTF"}
            </DialogTitle>
            <DialogDescription>
              {ctf?.isPrivate
                ? "This is a private event. Please enter the invite code to register."
                : "Register to participate in this CTF competition."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {ctf?.isPrivate && (
              <div>
                <Label htmlFor="invite-code">Invite Code</Label>
                <Input
                  id="invite-code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Enter 8-character code"
                  maxLength={8}
                  className="font-mono"
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRegisterDialogOpen(false);
                  setInviteCode("");
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => registerMutation.mutate()}
                disabled={registerMutation.isPending || (ctf?.isPrivate && inviteCode.length !== 8)}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                {registerMutation.isPending ? "Registering..." : "Register"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
