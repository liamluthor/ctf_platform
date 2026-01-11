import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trophy, Medal, Users, User } from "lucide-react";
import { PlayerDetailModal } from "@/components/ctf/player-detail-modal";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useState } from "react";
import type { CtfEvent } from "@shared/schema";

interface LeaderboardEntry {
  rank: number;
  id: string | number;
  name: string;
  score: number;
  solves: number;
  lastSolve: string | null;
}

interface LeaderboardData {
  isTeamBased: boolean;
  scoreboardFrozen: boolean;
  entries: LeaderboardEntry[];
}

export default function LeaderboardPage() {
  const { ctfId } = useParams<{ ctfId?: string }>();
  const [selectedCtfId, setSelectedCtfId] = useState<string>(ctfId || "");
  const [selectedPlayer, setSelectedPlayer] = useState<{
    id: string | number;
    name: string;
  } | null>(null);

  const { data: ctfs } = useQuery<CtfEvent[]>({
    queryKey: ["/api/ctfs"],
  });

  // Filter to only show active CTFs (current time is between start and end)
  const activeCtfs = ctfs?.filter((ctf) => {
    const now = new Date();
    const startTime = new Date(ctf.startTime);
    const endTime = new Date(ctf.endTime);
    return startTime <= now && now <= endTime;
  }) || [];

  const activeCtfId = selectedCtfId || ctfId;

  const { data: leaderboard, isLoading } = useQuery<LeaderboardData>({
    queryKey: [`/api/ctfs/${activeCtfId}/leaderboard`],
    enabled: !!activeCtfId,
  });

  const { data: selectedCtf } = useQuery<CtfEvent>({
    queryKey: [`/api/ctfs/${activeCtfId}`],
    enabled: !!activeCtfId,
  });

  const { data: scoreProgression } = useQuery<{
    isTeamBased: boolean;
    entries: Array<{
      id: string | number;
      name: string;
      progression: Array<{ time: string; score: number }>;
    }>;
  }>({
    queryKey: [`/api/ctfs/${activeCtfId}/score-progression`],
    enabled: !!activeCtfId,
  });

  // Transform leaderboard data for multi-line chart
  // Each player/team gets their own line with a unique color
  const topEntries = leaderboard?.entries.slice(0, 10) || [];

  // Color palette for different players/teams
  // Reserve gold/silver/bronze for top 3, then use other colors
  const COLORS = [
    "#FCD34D", // gold (rank 1)
    "#9CA3AF", // silver (rank 2)
    "#D97706", // bronze (rank 3)
    "#3B82F6", // blue
    "#10B981", // green
    "#8B5CF6", // purple
    "#F59E0B", // orange
    "#EC4899", // pink
    "#14B8A6", // teal
    "#8B1538", // burgundy
  ];

  // Create a consistent color mapping based on player rank
  // This ensures the same player gets the same color in both graph and table
  const playerColorMap = new Map<string | number, string>();
  if (scoreProgression?.entries) {
    scoreProgression.entries.forEach((entry) => {
      // Find this player in the leaderboard to get their rank
      const leaderboardEntry = leaderboard?.entries.find(lb => lb.id === entry.id);
      if (leaderboardEntry && leaderboardEntry.rank <= 10) {
        // Assign color based on rank (rank-1 because array is 0-indexed)
        playerColorMap.set(entry.id, COLORS[(leaderboardEntry.rank - 1) % COLORS.length]);
      }
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-orbitron font-bold mb-2">
                <span className="text-primary">Leaderboard</span>
              </h1>
              {selectedCtf && (
                <p className="text-muted-foreground">{selectedCtf.name}</p>
              )}
            </div>

            {activeCtfs && activeCtfs.length > 0 && (
              <Select
                value={activeCtfId?.toString()}
                onValueChange={(value) => setSelectedCtfId(value)}
              >
                <SelectTrigger className="w-[280px] bg-card border-white/10">
                  <SelectValue placeholder="Select a competition" />
                </SelectTrigger>
                <SelectContent>
                  {activeCtfs.map((ctf) => (
                    <SelectItem key={ctf.id} value={ctf.id.toString()}>
                      {ctf.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {!activeCtfId ? (
            <Card className="bg-card border-white/5">
              <CardContent className="py-12 text-center">
                <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-orbitron font-bold mb-2">Select a Competition</h3>
                <p className="text-muted-foreground text-sm">
                  Choose a competition to view its leaderboard.
                </p>
              </CardContent>
            </Card>
          ) : isLoading ? (
            <div className="space-y-6">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-96 w-full" />
            </div>
          ) : leaderboard && leaderboard.entries.length > 0 ? (
            <div className="space-y-6">
              {leaderboard.scoreboardFrozen && (
                <Card className="bg-amber-500/10 border-amber-500/20">
                  <CardContent className="py-4 flex items-center gap-3">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    <p className="text-amber-400 text-sm">
                      Scoreboard is frozen. Rankings may not reflect latest solves.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Top 3 Podium */}
              <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
                {[1, 0, 2].map((podiumIndex) => {
                  const entry = leaderboard.entries[podiumIndex];
                  if (!entry) return <div key={podiumIndex} />;

                  const heights = ["h-32", "h-40", "h-24"];
                  const colors = [
                    "from-gray-400 to-gray-600",
                    "from-yellow-400 to-yellow-600",
                    "from-amber-600 to-amber-800",
                  ];
                  const order = [1, 0, 2];

                  return (
                    <div
                      key={entry.id}
                      className={`flex flex-col items-center ${
                        order[podiumIndex] === 0 ? "order-2" : order[podiumIndex] === 1 ? "order-1" : "order-3"
                      }`}
                    >
                      <div className="w-16 h-16 rounded-full bg-card border-2 border-primary flex items-center justify-center mb-2">
                        {leaderboard.isTeamBased ? (
                          <Users className="w-8 h-8 text-primary" />
                        ) : (
                          <User className="w-8 h-8 text-primary" />
                        )}
                      </div>
                      <p className="font-tech text-sm mb-1 text-center truncate max-w-full">
                        {entry.name}
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">
                        {entry.score} pts
                      </p>
                      <div
                        className={`w-full ${heights[order[podiumIndex]]} bg-gradient-to-t ${
                          colors[order[podiumIndex]]
                        } rounded-t-lg flex items-start justify-center pt-4`}
                      >
                        <span className="font-orbitron font-bold text-2xl text-white">
                          {entry.rank}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Score Over Time Graph */}
              {scoreProgression && scoreProgression.entries.length > 0 && (
                <Card className="bg-card border-white/5">
                  <CardHeader>
                    <CardTitle className="font-orbitron text-lg">Score Progression Over Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={(() => {
                            // Merge all time points from all teams/players
                            const allTimePoints = new Set<number>();
                            scoreProgression.entries.forEach(entry => {
                              entry.progression.forEach(point => {
                                allTimePoints.add(new Date(point.time).getTime());
                              });
                            });

                            // Sort time points
                            const sortedTimes = Array.from(allTimePoints).sort((a, b) => a - b);

                            // Build data points with interpolated scores
                            return sortedTimes.map(timestamp => {
                              const dataPoint: any = { time: timestamp };

                              scoreProgression.entries.forEach((entry, index) => {
                                // Find the cumulative score at this time
                                let score = 0;
                                for (const point of entry.progression) {
                                  if (new Date(point.time).getTime() <= timestamp) {
                                    score = point.score;
                                  } else {
                                    break;
                                  }
                                }
                                dataPoint[entry.name] = score || null;
                              });

                              return dataPoint;
                            });
                          })()}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                          <XAxis
                            dataKey="time"
                            tick={{ fill: "#888", fontSize: 10 }}
                            tickFormatter={(timestamp) => {
                              const date = new Date(timestamp);
                              return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            }}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis
                            tick={{ fill: "#888" }}
                            label={{ value: "Score", angle: -90, position: "insideLeft", fill: "#888" }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#1a1a1a",
                              border: "1px solid #333",
                              borderRadius: "8px",
                            }}
                            labelFormatter={(timestamp) => {
                              const date = new Date(timestamp);
                              return date.toLocaleString();
                            }}
                          />
                          <Legend wrapperStyle={{ paddingTop: "20px" }} />
                          {scoreProgression.entries
                            .slice()
                            .sort((a, b) => {
                              // Sort by leaderboard rank for consistent legend order
                              const rankA = leaderboard?.entries.find(lb => lb.id === a.id)?.rank ?? 999;
                              const rankB = leaderboard?.entries.find(lb => lb.id === b.id)?.rank ?? 999;
                              return rankA - rankB;
                            })
                            .map((entry) => (
                              <Line
                                key={entry.id}
                                type="stepAfter"
                                dataKey={entry.name}
                                stroke={playerColorMap.get(entry.id) || "#888"}
                                strokeWidth={2}
                                dot={false}
                                connectNulls={true}
                              />
                            ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Full Table */}
              <Card className="bg-card border-white/5">
                <CardHeader>
                  <CardTitle className="font-orbitron text-lg">
                    {leaderboard.isTeamBased ? "Team" : "Player"} Rankings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/5">
                        <TableHead className="w-16">Rank</TableHead>
                        <TableHead>{leaderboard.isTeamBased ? "Team" : "Player"}</TableHead>
                        <TableHead className="text-center">Solves</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaderboard.entries.map((entry) => {
                        // Get the color from the map to match the graph
                        const entryColor = entry.rank <= 10 ? COLORS[(entry.rank - 1) % COLORS.length] : undefined;

                        return (
                          <TableRow key={entry.id} className="border-white/5">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {entry.rank <= 3 ? (
                                  <Medal
                                    className={`w-5 h-5 ${
                                      entry.rank === 1
                                        ? "text-yellow-500"
                                        : entry.rank === 2
                                        ? "text-gray-400"
                                        : "text-amber-700"
                                    }`}
                                  />
                                ) : (
                                  <span className="font-orbitron">{entry.rank}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {leaderboard.isTeamBased ? (
                                  <Users className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <User className="w-4 h-4 text-muted-foreground" />
                                )}
                                <button
                                  onClick={() => setSelectedPlayer({ id: entry.id, name: entry.name })}
                                  className="font-tech font-semibold hover:text-primary transition-colors cursor-pointer text-left"
                                  style={entryColor ? { color: entryColor } : undefined}
                                >
                                  {entry.name}
                                </button>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">{entry.solves}</TableCell>
                            <TableCell className="text-right font-orbitron font-bold text-primary">
                              {entry.score}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="bg-card border-white/5">
              <CardContent className="py-12 text-center">
                <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-orbitron font-bold mb-2">No Scores Yet</h3>
                <p className="text-muted-foreground text-sm">
                  Be the first to solve a challenge and appear on the leaderboard!
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Footer />

      {selectedPlayer && activeCtfId && (
        <PlayerDetailModal
          open={!!selectedPlayer}
          onOpenChange={(open) => !open && setSelectedPlayer(null)}
          ctfId={parseInt(activeCtfId)}
          playerId={selectedPlayer.id}
          playerName={selectedPlayer.name}
          isTeamBased={leaderboard?.isTeamBased ?? false}
        />
      )}
    </div>
  );
}
