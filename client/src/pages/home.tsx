import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { usePlatformSettings } from "@/hooks/use-platform-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Flag,
  Trophy,
  Users,
  Clock,
  ChevronRight,
  Shield,
  Target,
  Zap,
} from "lucide-react";
import { formatDistanceToNow, format, isPast, isFuture } from "date-fns";
import type { CtfEvent } from "@shared/schema";

function getCtfStatus(ctf: CtfEvent): { label: string; variant: "default" | "secondary" | "destructive" } {
  const now = new Date();
  if (isFuture(new Date(ctf.startTime))) {
    return { label: "Upcoming", variant: "secondary" };
  }
  if (isPast(new Date(ctf.endTime))) {
    return { label: "Ended", variant: "destructive" };
  }
  return { label: "Active", variant: "default" };
}

export default function HomePage() {
  const { data: ctfs, isLoading } = useQuery<CtfEvent[]>({
    queryKey: ["/api/ctfs"],
  });
  const { settings } = usePlatformSettings();

  const activeCtfs = ctfs?.filter(
    (ctf) =>
      new Date(ctf.startTime) <= new Date() && new Date(ctf.endTime) >= new Date()
  );
  const upcomingCtfs = ctfs
    ?.filter((ctf) => isFuture(new Date(ctf.startTime)))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Navbar />

      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative py-24 overflow-hidden">
          <div className="absolute inset-0 bg-cyber-gradient" />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 30% 50%, var(--hero-gradient), transparent 50%)' }} />

          <div className="container mx-auto px-4 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center max-w-4xl mx-auto"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
                <Flag className="w-4 h-4 text-primary" />
                <span className="font-tech text-sm uppercase tracking-wider">
                  {settings?.platformName || "CTF Platform"}
                </span>
              </div>

              <h1 className="text-4xl md:text-6xl font-orbitron font-bold mb-6">
                {settings?.platformTagline || "Test Your Cybersecurity Skills"}
              </h1>

              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                Compete in challenging CTF competitions, solve puzzles across
                various categories, and climb the leaderboard. Whether you're a
                beginner or an expert, there's a challenge waiting for you.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/ctfs">
                  <Button
                    size="lg"
                    className="bg-primary hover:bg-primary/90 font-tech uppercase tracking-widest"
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    View Competitions
                  </Button>
                </Link>
                <Link href="/auth">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-primary/50 hover:bg-primary/10 font-tech uppercase tracking-widest"
                  >
                    Get Started
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Active CTFs Section */}
        {activeCtfs && activeCtfs.length > 0 && (
          <section className="py-12 bg-primary/5 border-y border-primary/20">
            <div className="container mx-auto px-4">
              <div className="mb-8">
                <h2 className="text-2xl font-orbitron font-bold flex items-center gap-2">
                  <Zap className="w-6 h-6 text-primary animate-pulse" />
                  Live <span className="text-primary">Competitions</span>
                </h2>
                <p className="text-muted-foreground mt-2">Join these active CTF events now</p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeCtfs.map((ctf, index) => (
                  <motion.div
                    key={ctf.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                  >
                    <Card className="bg-card border-primary/30 h-full hover:border-primary/50 transition-colors flex flex-col">
                      <CardHeader>
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="default" className="animate-pulse">LIVE</Badge>
                          {ctf.isTeamBased && (
                            <Badge variant="outline">
                              <Users className="w-3 h-3 mr-1" />
                              Team
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="font-orbitron">{ctf.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col">
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                          {ctf.description || "No description available."}
                        </p>
                        <div className="mt-auto space-y-4">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            Ends {formatDistanceToNow(new Date(ctf.endTime), { addSuffix: true })}
                          </div>
                          <Link href={`/ctfs/${ctf.id}`}>
                            <Button className="w-full bg-primary hover:bg-primary/90 font-tech uppercase tracking-widest">
                              Join Now
                              <ChevronRight className="w-4 h-4 ml-2" />
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Features Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl font-orbitron font-bold mb-4">
                Why <span className="text-primary">Compete</span>?
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Our platform offers a comprehensive CTF experience with multiple
                challenge categories and competitive features.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: Target,
                  title: "Diverse Challenges",
                  description:
                    "Web, Crypto, Pwn, Reverse Engineering, Forensics, OSINT, and more. Test all your skills.",
                },
                {
                  icon: Trophy,
                  title: "Real-time Leaderboard",
                  description:
                    "Track your progress, compete for first blood, and watch your rank climb in real-time.",
                },
                {
                  icon: Users,
                  title: "Team Play",
                  description:
                    "Form teams with friends or go solo. Collaborate to solve challenges together.",
                },
              ].map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card className="bg-card border-white/5 h-full hover:border-primary/30 transition-colors">
                    <CardContent className="p-6">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                        <feature.icon className="w-6 h-6 text-primary" />
                      </div>
                      <h3 className="font-orbitron font-bold text-lg mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Upcoming CTFs Section */}
        <section className="py-20 bg-card/50">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-orbitron font-bold">
                Upcoming <span className="text-primary">Competitions</span>
              </h2>
              <Link href="/ctfs">
                <Button variant="ghost" className="font-tech">
                  View All
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>

            {isLoading ? (
              <div className="grid md:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="bg-card border-white/5">
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : upcomingCtfs && upcomingCtfs.length > 0 ? (
              <div className="grid md:grid-cols-3 gap-6">
                {upcomingCtfs.map((ctf, index) => {
                  const status = getCtfStatus(ctf);
                  return (
                    <motion.div
                      key={ctf.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: index * 0.1 }}
                      viewport={{ once: true }}
                    >
                      <Link href={`/ctfs/${ctf.id}`}>
                        <Card className="bg-card border-white/5 h-full hover:border-primary/30 transition-colors cursor-pointer">
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <Badge variant={status.variant}>{status.label}</Badge>
                              {ctf.isTeamBased && (
                                <Badge variant="outline">
                                  <Users className="w-3 h-3 mr-1" />
                                  Team
                                </Badge>
                              )}
                            </div>
                            <CardTitle className="font-orbitron">{ctf.name}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                              {ctf.description || "No description available."}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              Starts {format(new Date(ctf.startTime), "MMM d, yyyy 'at' h:mm a")}
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <Card className="bg-card border-white/5">
                <CardContent className="py-12 text-center">
                  <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-orbitron font-bold mb-2">No Upcoming CTFs</h3>
                  <p className="text-muted-foreground text-sm">
                    Check back later for new competitions.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
