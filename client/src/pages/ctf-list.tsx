import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Users, Trophy, Calendar, ChevronRight } from "lucide-react";
import { format, formatDistanceToNow, isPast, isFuture } from "date-fns";
import type { CtfEvent } from "@shared/schema";

function CtfCard({ ctf, index }: { ctf: CtfEvent; index: number }) {
  const now = new Date();
  const isActive = new Date(ctf.startTime) <= now && new Date(ctf.endTime) >= now;
  const isUpcoming = isFuture(new Date(ctf.startTime));
  const isPastEvent = isPast(new Date(ctf.endTime));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link href={`/ctfs/${ctf.id}`}>
        <Card className="bg-card border-white/5 h-full hover:border-primary/30 transition-all cursor-pointer group">
          <CardHeader>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {isActive && (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    <span className="w-2 h-2 rounded-full bg-green-400 mr-1 animate-pulse" />
                    Live
                  </Badge>
                )}
                {isUpcoming && <Badge variant="secondary">Upcoming</Badge>}
                {isPastEvent && <Badge variant="outline">Ended</Badge>}
              </div>
              {ctf.isTeamBased && (
                <Badge variant="outline">
                  <Users className="w-3 h-3 mr-1" />
                  Team
                </Badge>
              )}
            </div>
            <CardTitle className="font-orbitron group-hover:text-primary transition-colors flex items-center justify-between">
              {ctf.name}
              <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
              {ctf.description || "No description available."}
            </p>

            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                <span>
                  {format(new Date(ctf.startTime), "MMM d, yyyy")} -{" "}
                  {format(new Date(ctf.endTime), "MMM d, yyyy")}
                </span>
              </div>
              {isActive && (
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  <span>
                    Ends {formatDistanceToNow(new Date(ctf.endTime), { addSuffix: true })}
                  </span>
                </div>
              )}
              {isUpcoming && (
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  <span>
                    Starts {formatDistanceToNow(new Date(ctf.startTime), { addSuffix: true })}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

export default function CtfListPage() {
  const { data: ctfs, isLoading } = useQuery<CtfEvent[]>({
    queryKey: ["/api/ctfs"],
  });

  const now = new Date();
  const activeCtfs = ctfs?.filter(
    (ctf) => new Date(ctf.startTime) <= now && new Date(ctf.endTime) >= now
  ) || [];
  const upcomingCtfs = (ctfs?.filter((ctf) => isFuture(new Date(ctf.startTime))) || [])
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()); // Sort ascending - next event first
  const pastCtfs = ctfs?.filter((ctf) => isPast(new Date(ctf.endTime))) || [];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-orbitron font-bold mb-2">
              CTF <span className="text-primary">Competitions</span>
            </h1>
            <p className="text-muted-foreground">
              Browse and participate in Capture The Flag competitions.
            </p>
          </div>

          <Tabs defaultValue="active" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="active" className="gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                Active ({activeCtfs.length})
              </TabsTrigger>
              <TabsTrigger value="upcoming">
                Upcoming ({upcomingCtfs.length})
              </TabsTrigger>
              <TabsTrigger value="past">
                Past ({pastCtfs.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active">
              {isLoading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="bg-card border-white/5">
                      <CardHeader>
                        <Skeleton className="h-6 w-3/4" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-20 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : activeCtfs.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeCtfs.map((ctf, i) => (
                    <CtfCard key={ctf.id} ctf={ctf} index={i} />
                  ))}
                </div>
              ) : (
                <Card className="bg-card border-white/5">
                  <CardContent className="py-12 text-center">
                    <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-orbitron font-bold mb-2">No Active CTFs</h3>
                    <p className="text-muted-foreground text-sm">
                      Check the upcoming tab for future competitions.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="upcoming">
              {upcomingCtfs.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {upcomingCtfs.map((ctf, i) => (
                    <CtfCard key={ctf.id} ctf={ctf} index={i} />
                  ))}
                </div>
              ) : (
                <Card className="bg-card border-white/5">
                  <CardContent className="py-12 text-center">
                    <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-orbitron font-bold mb-2">No Upcoming CTFs</h3>
                    <p className="text-muted-foreground text-sm">
                      Check back later for new competitions.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="past">
              {pastCtfs.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pastCtfs.map((ctf, i) => (
                    <CtfCard key={ctf.id} ctf={ctf} index={i} />
                  ))}
                </div>
              ) : (
                <Card className="bg-card border-white/5">
                  <CardContent className="py-12 text-center">
                    <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-orbitron font-bold mb-2">No Past CTFs</h3>
                    <p className="text-muted-foreground text-sm">
                      Completed competitions will appear here.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
}
