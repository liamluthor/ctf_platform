import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Loader2, Lock, CheckCircle2, Trophy, Download } from "lucide-react";

interface SerialChallengeModalProps {
  challenge: any;
  ctfId: number;
  onClose: () => void;
}

export function SerialChallengeModal({ challenge: initialChallenge, ctfId, onClose }: SerialChallengeModalProps) {
  const { toast } = useToast();
  const [flags, setFlags] = useState<Record<number, string>>({});

  // Fetch fresh challenge data to keep progress updated
  const { data: challenges } = useQuery<any[]>({
    queryKey: [`/api/ctfs/${ctfId}/serial-challenges`],
  });

  // Find the current challenge from the fresh data
  const challenge = challenges?.find(c => c.id === initialChallenge.id) || initialChallenge;

  const { data: stages, isLoading } = useQuery<any[]>({
    queryKey: [`/api/serial-challenges/${challenge.id}/stages`],
    queryFn: async () => {
      const res = await fetch(`/api/serial-challenges/${challenge.id}/stages`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch stages");
      return res.json();
    },
  });

  const submitFlagMutation = useMutation({
    mutationFn: async ({ stageId, flag }: { stageId: number; flag: string }) => {
      const res = await fetch("/api/submit-serial-stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ stageId, flag }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit flag");
      return data;
    },
    onSuccess: (data, variables) => {
      if (data.correct) {
        toast({
          title: data.message,
          description: `+${data.points} points${data.isFirstBlood ? " 🩸 First Blood!" : ""}`,
        });
        setFlags({ ...flags, [variables.stageId]: "" });
        queryClient.invalidateQueries({ queryKey: [`/api/serial-challenges/${challenge.id}/stages`] });
        queryClient.invalidateQueries({ queryKey: [`/api/ctfs/${ctfId}/serial-challenges`] });
      } else {
        toast({
          title: "Incorrect Flag",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (stageId: number) => {
    const flag = flags[stageId]?.trim();
    if (!flag) {
      toast({
        title: "Flag Required",
        description: "Please enter a flag",
        variant: "destructive",
      });
      return;
    }
    submitFlagMutation.mutate({ stageId, flag });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-orbitron text-2xl">
            {challenge.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-muted-foreground">{challenge.description}</p>

          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" />
              <span>{challenge.totalPointsEarned || 0} points earned</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">
                {challenge.stagesCompleted || 0} / {challenge.totalStages} completed
              </span>
            </div>
          </div>

          {/* Challenge Complete Banner */}
          {challenge.isComplete && (
            <Card className="bg-primary/10 border-primary/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                  <div>
                    <h3 className="font-semibold text-primary">Challenge Complete!</h3>
                    <p className="text-sm text-muted-foreground">
                      You've completed all {challenge.totalStages} stages and earned {challenge.totalPointsEarned} points!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : !stages || stages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No stages available.
            </div>
          ) : (
            <div className="space-y-3">
              {stages.map((stage: any) => (
                <Card
                  key={stage.id}
                  className={
                    stage.isLocked
                      ? "opacity-60"
                      : stage.isSolved
                        ? "border-primary/50"
                        : ""
                  }
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={stage.isSolved ? "default" : "outline"}>
                          Stage {stage.stageOrder}
                        </Badge>
                        <CardTitle className="text-lg">{stage.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{stage.points} pts</span>
                        {stage.isLocked && <Lock className="w-4 h-4 text-muted-foreground" />}
                        {stage.isSolved && <CheckCircle2 className="w-4 h-4 text-primary" />}
                      </div>
                    </div>
                  </CardHeader>

                  {!stage.isLocked && (
                    <CardContent className="space-y-4">
                      <p className="text-sm whitespace-pre-wrap">{stage.description}</p>

                      {stage.hint && (
                        <div className="text-sm text-muted-foreground italic">
                          <strong>Hint:</strong> {stage.hint}
                        </div>
                      )}

                      {stage.files && stage.files.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Files</Label>
                          <div className="flex flex-wrap gap-2">
                            {stage.files.map((file: any) => (
                              <Button
                                key={file.id}
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(`/api/serial-stages/${stage.id}/files/${file.id}`, "_blank")}
                              >
                                <Download className="w-3 h-3 mr-1" />
                                {file.originalName}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}

                      {!stage.isSolved && (
                        <div className="space-y-2">
                          <Label>Submit Flag</Label>
                          <div className="flex gap-2">
                            <Input
                              value={flags[stage.id] || ""}
                              onChange={(e) =>
                                setFlags({ ...flags, [stage.id]: e.target.value })
                              }
                              placeholder="Enter flag..."
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleSubmit(stage.id);
                                }
                              }}
                              className="bg-secondary border-white/10"
                            />
                            <Button
                              onClick={() => handleSubmit(stage.id)}
                              disabled={submitFlagMutation.isPending}
                            >
                              {submitFlagMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                "Submit"
                              )}
                            </Button>
                          </div>
                        </div>
                      )}

                      {stage.isSolved && (
                        <div className="text-sm text-primary font-medium">
                          ✓ Completed
                        </div>
                      )}
                    </CardContent>
                  )}

                  {stage.isLocked && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Complete the previous stage to unlock this challenge.
                      </p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
