import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, CheckCircle2, List } from "lucide-react";
import { useState } from "react";
import { SerialChallengeModal } from "./serial-challenge-modal";

interface SerialChallengesViewProps {
  ctfId: number;
}

export function SerialChallengesView({ ctfId }: SerialChallengesViewProps) {
  const [selectedChallenge, setSelectedChallenge] = useState<any | null>(null);

  const { data: challenges, isLoading } = useQuery<any[]>({
    queryKey: [`/api/ctfs/${ctfId}/serial-challenges`],
    queryFn: async () => {
      const res = await fetch(`/api/ctfs/${ctfId}/serial-challenges`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch serial challenges");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!challenges || challenges.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No serial challenges available yet.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {challenges.map((challenge) => {
          const progressPercent = challenge.totalStages > 0
            ? (challenge.currentStage / challenge.totalStages) * 100
            : 0;

          return (
            <Card
              key={challenge.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedChallenge(challenge)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{challenge.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {challenge.description}
                    </CardDescription>
                  </div>
                  <List className="w-5 h-5 text-muted-foreground flex-shrink-0 ml-2" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">
                    {challenge.currentStage || 0} / {challenge.totalStages} Stages
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Points Earned</span>
                  <span className="font-medium text-primary">
                    {challenge.totalPointsEarned || 0} pts
                  </span>
                </div>

                {challenge.isComplete ? (
                  <Badge variant="default" className="w-full justify-center">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Complete
                  </Badge>
                ) : challenge.currentStage === 0 ? (
                  <Badge variant="secondary" className="w-full justify-center">
                    <Lock className="w-3 h-3 mr-1" />
                    Not Started
                  </Badge>
                ) : (
                  <Badge variant="outline" className="w-full justify-center">
                    In Progress
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedChallenge && (
        <SerialChallengeModal
          challenge={selectedChallenge}
          ctfId={ctfId}
          onClose={() => setSelectedChallenge(null)}
        />
      )}
    </>
  );
}
