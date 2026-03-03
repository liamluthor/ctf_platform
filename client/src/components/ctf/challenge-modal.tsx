import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Download,
  Flame,
  Globe,
  Lock,
  Terminal,
  Cpu,
  Search,
  Puzzle,
  Eye,
  Trophy,
  ExternalLink,
  Container,
  PlayCircle,
  StopCircle,
  Copy,
} from "lucide-react";

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
}

interface ChallengeFile {
  id: number;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
}

interface ChallengeSolve {
  id: number;
  name: string;
  solvedAt: string;
  isFirstBlood: boolean;
}

interface ChallengeModalProps {
  challenge: Challenge | null;
  ctfId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  globe: Globe,
  lock: Lock,
  terminal: Terminal,
  cpu: Cpu,
  search: Search,
  puzzle: Puzzle,
  eye: Eye,
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ChallengeModal({
  challenge,
  ctfId,
  open,
  onOpenChange,
}: ChallengeModalProps) {
  const [flag, setFlag] = useState("");
  const { toast } = useToast();

  const { data: files } = useQuery<ChallengeFile[]>({
    queryKey: [`/api/challenges/${challenge?.id}/files`],
    enabled: !!challenge && open,
  });

  const { data: solves } = useQuery<ChallengeSolve[]>({
    queryKey: [`/api/challenges/${challenge?.id}/solves`],
    enabled: !!challenge && open,
  });

  const { data: containerInfo } = useQuery<{
    hasContainer: boolean;
    containerName?: string;
    description?: string;
    containerMode?: string;
    status?: string;
    message?: string;
    accessUrls?: Array<{
      port: number;
      protocol: string;
      serviceName: string;
      url: string;
      proxyUrl: string;
    }>;
    primaryUrl?: string;
    primaryProxyUrl?: string;
  } | null>({
    queryKey: [`/api/challenges/${challenge?.id}/container`],
    enabled: !!challenge && open,
    retry: false,
    // Custom queryFn that returns null on 401/404 instead of throwing
    queryFn: async () => {
      const res = await fetch(`/api/challenges/${challenge?.id}/container`, {
        credentials: "include",
      });

      // Return null if unauthorized or not found (graceful degradation)
      if (res.status === 401 || res.status === 404) {
        return null;
      }

      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }

      return await res.json();
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: { challengeId: number; flag: string }) => {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit flag");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.correct) {
        toast({
          title: data.isFirstBlood ? "First Blood!" : "Correct!",
          description: `+${data.points} points`,
        });
        queryClient.invalidateQueries({ queryKey: [`/api/ctfs/${ctfId}/challenges`] });
        queryClient.invalidateQueries({ queryKey: [`/api/ctfs/${ctfId}/leaderboard`] });
        setFlag("");
        onOpenChange(false);
      } else {
        toast({
          title: "Incorrect",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!challenge) return null;

  const Icon = challenge.category?.icon
    ? iconMap[challenge.category.icon] || Terminal
    : Terminal;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!flag.trim()) return;
    submitMutation.mutate({ challengeId: challenge.id, flag: flag.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-white/10">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: `${challenge.category?.color || "#8B1538"}20`,
              }}
            >
              <Icon
                className="w-5 h-5"
                style={{ color: challenge.category?.color || "#8B1538" }}
              />
            </div>
            <div>
              <DialogTitle className="font-orbitron">{challenge.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant="outline"
                  style={{
                    borderColor: `${challenge.category?.color || "#8B1538"}40`,
                    color: challenge.category?.color || "#8B1538",
                  }}
                >
                  {challenge.category?.name || "Misc"}
                </Badge>
                <span className="font-orbitron text-primary font-bold text-sm">
                  {challenge.points} pts
                </span>
                <span className="text-muted-foreground text-sm">
                  {challenge.solveCount} solve{challenge.solveCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="challenge" className="mt-4">
          <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
            <TabsTrigger value="challenge">Challenge</TabsTrigger>
            <TabsTrigger value="solves">
              Solves ({challenge.solveCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="challenge" className="space-y-4 mt-4">
            {/* Description */}
            <div className="prose prose-invert prose-sm max-w-none text-sm text-muted-foreground">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ node, ...props }) => (
                    <a
                      {...props}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline break-words"
                    />
                  ),
                  code: ({ node, inline, ...props }: any) =>
                    inline ? (
                      <code
                        {...props}
                        className="bg-secondary/50 px-1.5 py-0.5 rounded text-primary font-mono text-xs"
                      />
                    ) : (
                      <code
                        {...props}
                        className="block bg-secondary/50 p-3 rounded font-mono text-xs overflow-x-auto"
                      />
                    ),
                  pre: ({ node, ...props }) => (
                    <pre {...props} className="bg-secondary/50 p-3 rounded overflow-x-auto" />
                  ),
                  p: ({ node, ...props }) => <p {...props} className="mb-2" />,
                  ul: ({ node, ...props }) => <ul {...props} className="list-disc list-inside mb-2" />,
                  ol: ({ node, ...props }) => <ol {...props} className="list-decimal list-inside mb-2" />,
                  strong: ({ node, ...props }) => <strong {...props} className="font-bold text-foreground" />,
                  em: ({ node, ...props }) => <em {...props} className="italic" />,
                  h1: ({ node, ...props }) => <h1 {...props} className="text-lg font-bold mb-2 text-foreground" />,
                  h2: ({ node, ...props }) => <h2 {...props} className="text-base font-bold mb-2 text-foreground" />,
                  h3: ({ node, ...props }) => <h3 {...props} className="text-sm font-bold mb-2 text-foreground" />,
                }}
              >
                {challenge.description}
              </ReactMarkdown>
            </div>

            {/* Files section */}
            {files && files.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-tech uppercase tracking-wider text-muted-foreground">
                  Attachments
                </p>
                <div className="flex flex-wrap gap-2">
                  {files.map((file) => (
                    <a
                      key={file.id}
                      href={`/api/challenges/${challenge.id}/files/${file.id}`}
                      download={file.originalName}
                      className="flex items-center gap-2 px-3 py-2 bg-secondary/50 hover:bg-secondary border border-white/10 rounded-lg transition-colors text-sm"
                    >
                      <Download className="w-4 h-4 text-primary" />
                      <span className="font-tech">{file.originalName}</span>
                      <span className="text-xs text-muted-foreground">
                        ({formatFileSize(file.size)})
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Container Access */}
            {containerInfo?.hasContainer && (
              <div className="space-y-2">
                <p className="text-xs font-tech uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Container className="w-3 h-3" />
                  Container Access
                </p>
                {containerInfo.status === "running" ? (
                  <div className="space-y-2">
                    {containerInfo.description && (
                      <p className="text-sm text-muted-foreground">{containerInfo.description}</p>
                    )}
                    {containerInfo.containerMode === "tcp" ? (
                      <>
                        <div className="flex flex-col gap-2">
                          {containerInfo.accessUrls?.map((urlInfo, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/30 rounded-lg text-sm"
                            >
                              <Terminal className="w-4 h-4 text-primary flex-shrink-0" />
                              <code className="font-tech flex-1 select-all">nc {urlInfo.url.replace(":", " ")}</code>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(`nc ${urlInfo.url.replace(":", " ")}`);
                                }}
                                className="p-1 hover:bg-primary/20 rounded transition-colors"
                                title="Copy to clipboard"
                              >
                                <Copy className="w-3.5 h-3.5 text-primary/60 hover:text-primary" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Connect using nc or netcat
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {containerInfo.accessUrls?.map((urlInfo, index) => (
                            <a
                              key={index}
                              href={urlInfo.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg transition-colors text-sm group"
                            >
                              <PlayCircle className="w-4 h-4 text-primary" />
                              <span className="font-tech">{urlInfo.serviceName}</span>
                              <ExternalLink className="w-3 h-3 text-primary/60 group-hover:text-primary transition-colors" />
                            </a>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Access the challenge environment at the link{containerInfo.accessUrls && containerInfo.accessUrls.length > 1 ? 's' : ''} above
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <StopCircle className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm text-yellow-400">
                      {containerInfo.message || "Container is not currently available"}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Flag submission */}
            {challenge.solved ? (
              <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="text-green-400 font-tech">Challenge Solved!</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={flag}
                    onChange={(e) => setFlag(e.target.value)}
                    placeholder="Enter flag..."
                    className="bg-secondary border-white/10 font-mono"
                    disabled={submitMutation.isPending}
                  />
                  <Button
                    type="submit"
                    className="bg-primary hover:bg-primary/90 font-tech shrink-0"
                    disabled={submitMutation.isPending || !flag.trim()}
                  >
                    {submitMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Submit"
                    )}
                  </Button>
                </div>
              </form>
            )}
          </TabsContent>

          <TabsContent value="solves" className="mt-4">
            {solves && solves.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {solves.map((solve, index) => (
                  <div
                    key={solve.id}
                    className="flex items-center justify-between p-3 bg-secondary/30 border border-white/5 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground font-orbitron text-sm w-6">
                        #{index + 1}
                      </span>
                      {solve.isFirstBlood && (
                        <Flame className="w-4 h-4 text-orange-500" />
                      )}
                      <span className="font-tech">{solve.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(solve.solvedAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No solves yet. Be the first!</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
