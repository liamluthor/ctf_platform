import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Flame, User, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PlayerDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ctfId: number;
  playerId: string | number;
  playerName: string;
  isTeamBased: boolean;
}

interface PlayerChallengesData {
  playerId: string | number;
  playerName: string;
  ctfId: number;
  isTeamBased: boolean;
  totalChallenges: number;
  solvedCount: number;
  totalScore: number;
  solvedChallenges: Array<{
    id: number;
    name: string;
    category: {
      id: number;
      name: string;
      color: string;
      icon: string;
    } | null;
    points: number;
    solvedAt: Date;
    isFirstBlood: boolean;
  }>;
  unsolvedChallenges: Array<{
    id: number;
    name: string;
    category: {
      id: number;
      name: string;
      color: string;
      icon: string;
    } | null;
    points: number;
  }>;
}

export function PlayerDetailModal({
  open,
  onOpenChange,
  ctfId,
  playerId,
  playerName,
  isTeamBased,
}: PlayerDetailModalProps) {
  const { data, isLoading, error } = useQuery<PlayerChallengesData>({
    queryKey: [`/api/ctfs/${ctfId}/players/${playerId}/challenges`],
    enabled: open && !!playerId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isTeamBased ? (
              <Users className="w-5 h-5" />
            ) : (
              <User className="w-5 h-5" />
            )}
            {playerName}
          </DialogTitle>
          {data && (
            <div className="text-sm text-muted-foreground">
              {data.solvedCount}/{data.totalChallenges} Challenges Solved •{" "}
              {data.totalScore.toLocaleString()} points
            </div>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-destructive">
            Failed to load player data. Please try again.
          </div>
        ) : data ? (
          <Accordion
            type="multiple"
            defaultValue={["solved"]}
            className="w-full"
          >
            {/* Solved Challenges Section */}
            <AccordionItem value="solved">
              <AccordionTrigger className="font-tech text-lg">
                Solved Challenges ({data.solvedCount})
              </AccordionTrigger>
              <AccordionContent>
                {data.solvedChallenges.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No challenges solved yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.solvedChallenges.map((challenge) => (
                      <div
                        key={challenge.id}
                        className="bg-card border border-white/5 rounded-lg p-4 hover:border-primary/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {challenge.category && (
                                <Badge
                                  className="text-xs"
                                  style={{
                                    backgroundColor: `${challenge.category.color}20`,
                                    color: challenge.category.color,
                                    borderColor: `${challenge.category.color}40`,
                                  }}
                                >
                                  {challenge.category.name}
                                </Badge>
                              )}
                              <span className="font-semibold">
                                {challenge.name}
                              </span>
                              {challenge.isFirstBlood && (
                                <Flame className="w-4 h-4 text-orange-500" />
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {challenge.points} pts • Solved{" "}
                              {formatDistanceToNow(new Date(challenge.solvedAt), {
                                addSuffix: true,
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Unsolved Challenges Section */}
            <AccordionItem value="unsolved">
              <AccordionTrigger className="font-tech text-lg">
                Unsolved Challenges (
                {data.totalChallenges - data.solvedCount})
              </AccordionTrigger>
              <AccordionContent>
                {data.unsolvedChallenges.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    All challenges solved!
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Group by category */}
                    {Object.entries(
                      data.unsolvedChallenges.reduce(
                        (acc, challenge) => {
                          const categoryName =
                            challenge.category?.name || "Uncategorized";
                          if (!acc[categoryName]) {
                            acc[categoryName] = [];
                          }
                          acc[categoryName].push(challenge);
                          return acc;
                        },
                        {} as Record<
                          string,
                          typeof data.unsolvedChallenges
                        >
                      )
                    ).map(([categoryName, challenges]) => (
                      <div key={categoryName}>
                        <h4 className="font-tech text-sm text-muted-foreground mb-2">
                          {categoryName}
                        </h4>
                        <div className="space-y-2">
                          {challenges.map((challenge) => (
                            <div
                              key={challenge.id}
                              className="bg-card/50 border border-white/5 rounded-lg p-3 hover:border-white/10 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {challenge.category && (
                                    <Badge
                                      className="text-xs"
                                      style={{
                                        backgroundColor: `${challenge.category.color}20`,
                                        color: challenge.category.color,
                                        borderColor: `${challenge.category.color}40`,
                                      }}
                                    >
                                      {challenge.category.name}
                                    </Badge>
                                  )}
                                  <span className="text-sm">
                                    {challenge.name}
                                  </span>
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  {challenge.points} pts
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
