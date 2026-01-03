import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { usePlatformSettings, hexToHSL, hslToHex } from "@/hooks/use-platform-settings";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Trophy,
  Flag,
  Users,
  Settings,
  Calendar,
  Upload,
  File,
  X,
  ChevronRight,
  ChevronDown,
  ArrowUpDown,
  Palette,
  Image,
  Container,
  Play,
  Square,
  RotateCw,
  RefreshCw,
  ExternalLink,
  Terminal,
  Activity,
  List,
  Eye,
  EyeOff,
} from "lucide-react";
import { format } from "date-fns";
import type { CtfEvent, Category, Challenge } from "@shared/schema";

// ========== CTF EVENTS TAB ==========
function CtfEventsTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCtf, setEditingCtf] = useState<CtfEvent | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    rules: string;
    ctfType: string;
    startTime: Date | undefined;
    endTime: Date | undefined;
    isTeamBased: boolean;
    maxTeamSize: string;
    isPublished: boolean;
    isPrivate: boolean;
  }>({
    name: "",
    description: "",
    rules: "",
    ctfType: "jeopardy",
    startTime: undefined,
    endTime: undefined,
    isTeamBased: false,
    maxTeamSize: "",
    isPublished: false,
    isPrivate: false,
  });

  const { data: ctfs, isLoading } = useQuery<CtfEvent[]>({
    queryKey: ["/api/admin/ctfs"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/admin/ctfs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          maxTeamSize: data.maxTeamSize ? parseInt(data.maxTeamSize) : null,
        }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create CTF");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "CTF created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ctfs"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: () => toast({ title: "Failed to create CTF", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      const res = await fetch(`/api/admin/ctfs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          maxTeamSize: data.maxTeamSize ? parseInt(data.maxTeamSize) : null,
        }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update CTF");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "CTF updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ctfs"] });
      setDialogOpen(false);
      setEditingCtf(null);
      resetForm();
    },
    onError: () => toast({ title: "Failed to update CTF", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/ctfs/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete CTF");
    },
    onSuccess: () => {
      toast({ title: "CTF deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ctfs"] });
    },
    onError: () => toast({ title: "Failed to delete CTF", variant: "destructive" }),
  });

  const resetForm = () => {
    const now = new Date();
    const oneWeekLater = new Date();
    oneWeekLater.setDate(now.getDate() + 7);

    setFormData({
      name: "",
      description: "",
      rules: "",
      ctfType: "jeopardy",
      startTime: now,
      endTime: oneWeekLater,
      isTeamBased: false,
      maxTeamSize: "",
      isPublished: false,
      isPrivate: false,
    });
  };

  const openEditDialog = (ctf: CtfEvent) => {
    setEditingCtf(ctf);
    setFormData({
      name: ctf.name,
      description: ctf.description || "",
      rules: ctf.rules || "",
      ctfType: ctf.ctfType || "jeopardy",
      startTime: new Date(ctf.startTime),
      endTime: new Date(ctf.endTime),
      isTeamBased: ctf.isTeamBased,
      maxTeamSize: ctf.maxTeamSize?.toString() || "",
      isPublished: ctf.isPublished,
      isPrivate: ctf.isPrivate,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCtf) {
      updateMutation.mutate({ id: editingCtf.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-orbitron font-bold">CTF Events</h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingCtf(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              New CTF
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-white/10 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-orbitron">
                {editingCtf ? "Edit CTF" : "Create CTF"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-secondary border-white/10"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="bg-secondary border-white/10"
                    rows={3}
                  />
                </div>
                <div>
                  <Label>CTF Type</Label>
                  <Select
                    value={formData.ctfType}
                    onValueChange={(value) => setFormData({ ...formData, ctfType: value })}
                  >
                    <SelectTrigger className="bg-secondary border-white/10">
                      <SelectValue placeholder="Select CTF Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="jeopardy">Jeopardy</SelectItem>
                      <SelectItem value="serial">Serial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Start Time</Label>
                  <DateTimePicker
                    value={formData.startTime}
                    onChange={(date) => setFormData({ ...formData, startTime: date })}
                    placeholder="Select start date and time"
                  />
                </div>
                <div>
                  <Label>End Time</Label>
                  <DateTimePicker
                    value={formData.endTime}
                    onChange={(date) => setFormData({ ...formData, endTime: date })}
                    placeholder="Select end date and time"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.isTeamBased}
                    onCheckedChange={(checked) => setFormData({ ...formData, isTeamBased: checked })}
                  />
                  <Label>Team-based</Label>
                </div>
                {formData.isTeamBased && (
                  <div>
                    <Label>Max Team Size</Label>
                    <Input
                      type="number"
                      value={formData.maxTeamSize}
                      onChange={(e) => setFormData({ ...formData, maxTeamSize: e.target.value })}
                      className="bg-secondary border-white/10"
                      min={2}
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.isPublished}
                    onCheckedChange={(checked) => setFormData({ ...formData, isPublished: checked })}
                  />
                  <Label>Published</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.isPrivate}
                    onCheckedChange={(checked) => setFormData({ ...formData, isPrivate: checked })}
                  />
                  <Label>Private (Require Invite Code)</Label>
                </div>
                {editingCtf?.isPrivate && editingCtf.inviteCode && (
                  <div className="p-3 bg-secondary/20 rounded border border-primary/30">
                    <Label className="text-xs text-muted-foreground">Invite Code</Label>
                    <code className="block mt-1 text-lg font-mono font-bold text-primary">{editingCtf.inviteCode}</code>
                  </div>
                )}
              </div>
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                )}
                {editingCtf ? "Update CTF" : "Create CTF"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-white/5">
              <TableHead>Name</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ctfs
              ?.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
              .map((ctf) => (
              <TableRow key={ctf.id} className="border-white/5">
                <TableCell className="font-tech">{ctf.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(ctf.startTime), "MMM d")} - {format(new Date(ctf.endTime), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {ctf.isTeamBased ? "Team" : "Individual"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={ctf.isPublished ? "default" : "secondary"}>
                    {ctf.isPublished ? "Published" : "Draft"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => openEditDialog(ctf)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-card border-white/10">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete CTF?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the CTF and all its challenges.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(ctf.id)}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

interface ChallengeFile {
  id: number;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ========== CHALLENGES TAB ==========
function ChallengesTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filesDialogOpen, setFilesDialogOpen] = useState(false);
  const [selectedChallengeId, setSelectedChallengeId] = useState<number | null>(null);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [linkedContainers, setLinkedContainers] = useState<number[]>([]);
  const [expandedCtfs, setExpandedCtfs] = useState<Set<number>>(new Set());
  const [revealedFlags, setRevealedFlags] = useState<Set<number>>(new Set());
  const [flagCache, setFlagCache] = useState<Map<number, string>>(new Map());
  const [loadingFlags, setLoadingFlags] = useState<Set<number>>(new Set());
  const [sortConfig, setSortConfig] = useState<{
    key: 'name' | 'categoryName' | 'points';
    direction: 'asc' | 'desc';
  } | null>(null);

  const toggleCtfExpanded = (ctfId: number) => {
    setExpandedCtfs(prev => {
      const next = new Set(prev);
      if (next.has(ctfId)) {
        next.delete(ctfId);
      } else {
        next.add(ctfId);
      }
      return next;
    });
  };

  const handleSort = (key: 'name' | 'categoryName' | 'points') => {
    setSortConfig(current => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return { key, direction: 'asc' };
    });
  };

  // Fetch flag securely from dedicated endpoint
  const fetchFlag = async (challengeId: number) => {
    // Check cache first
    if (flagCache.has(challengeId)) {
      return flagCache.get(challengeId)!;
    }

    // Prevent duplicate requests
    if (loadingFlags.has(challengeId)) {
      return null;
    }

    setLoadingFlags((prev) => new Set(prev).add(challengeId));

    try {
      const res = await fetch(`/api/admin/challenges/${challengeId}/flag`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch flag");
      }

      const data = await res.json();
      const flag = data.flag;

      // Cache the flag
      setFlagCache((prev) => new Map(prev).set(challengeId, flag));

      return flag;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch flag",
      });
      return null;
    } finally {
      setLoadingFlags((prev) => {
        const next = new Set(prev);
        next.delete(challengeId);
        return next;
      });
    }
  };

  // Toggle flag visibility
  const toggleFlagReveal = async (challengeId: number) => {
    const isRevealed = revealedFlags.has(challengeId);

    if (isRevealed) {
      // Hide the flag
      setRevealedFlags((prev) => {
        const next = new Set(prev);
        next.delete(challengeId);
        return next;
      });
    } else {
      // Reveal the flag - fetch it first if not cached
      await fetchFlag(challengeId);
      setRevealedFlags((prev) => new Set(prev).add(challengeId));
    }
  };

  const [formData, setFormData] = useState({
    ctfEventId: "",
    categoryId: "",
    name: "",
    description: "",
    flag: "",
    points: "100",
    isDynamic: false,
    minPoints: "50",
    decay: "10",
    isHidden: false,
  });

  const { data: ctfs } = useQuery<CtfEvent[]>({ queryKey: ["/api/admin/ctfs"] });
  const { data: categories } = useQuery<Category[]>({ queryKey: ["/api/categories"] });
  const { data: challenges, isLoading } = useQuery<(Challenge & { ctfEventName: string; categoryName: string | null })[]>({
    queryKey: ["/api/admin/challenges"],
  });
  const { data: containers } = useQuery<Array<{ id: number; name: string; deploymentType: string }>>({
    queryKey: ["/api/admin/containers"],
  });
  const { data: challengeContainers } = useQuery<Array<{ containerId: number; isPrimary: boolean }>>({
    queryKey: [`/api/admin/challenges/${editingChallenge?.id}/containers`],
    enabled: !!editingChallenge,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/admin/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          ctfEventId: parseInt(data.ctfEventId),
          categoryId: parseInt(data.categoryId),
          points: parseInt(data.points),
          minPoints: data.isDynamic ? parseInt(data.minPoints) : null,
          decay: data.isDynamic ? parseInt(data.decay) : null,
        }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create challenge");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      toast({ title: "Challenge created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/challenges"] });
      // Also invalidate the CTF-specific challenges query so it shows up immediately
      queryClient.invalidateQueries({ queryKey: [`/api/ctfs/${variables.ctfEventId}/challenges`] });
      setDialogOpen(false);
      resetForm();
    },
    onError: () => toast({ title: "Failed to create challenge", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      const res = await fetch(`/api/admin/challenges/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          ctfEventId: parseInt(data.ctfEventId),
          categoryId: parseInt(data.categoryId),
          points: parseInt(data.points),
          minPoints: data.isDynamic ? parseInt(data.minPoints) : null,
          decay: data.isDynamic ? parseInt(data.decay) : null,
        }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update challenge");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      toast({ title: "Challenge updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/challenges"] });
      queryClient.invalidateQueries({ queryKey: [`/api/ctfs/${variables.data.ctfEventId}/challenges`] });
      setDialogOpen(false);
      resetForm();
    },
    onError: () => toast({ title: "Failed to update challenge", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/challenges/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete challenge");
    },
    onSuccess: () => {
      toast({ title: "Challenge deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/challenges"] });
      // Invalidate all CTF challenges queries to update the public view
      queryClient.invalidateQueries({ queryKey: ["/api/ctfs"], type: "all" });
    },
  });

  const { data: challengeFiles, refetch: refetchFiles } = useQuery<ChallengeFile[]>({
    queryKey: [`/api/challenges/${selectedChallengeId}/files`],
    enabled: !!selectedChallengeId && filesDialogOpen,
  });

  const uploadFilesMutation = useMutation({
    mutationFn: async ({ challengeId, files }: { challengeId: number; files: File[] }) => {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const res = await fetch(`/api/admin/challenges/${challengeId}/files`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to upload files");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast({ title: "Files uploaded successfully" });
      refetchFiles();
      queryClient.invalidateQueries({ queryKey: [`/api/challenges/${variables.challengeId}/files`] });
    },
    onError: (error: Error) => toast({
      title: "Failed to upload files",
      description: error.message,
      variant: "destructive"
    }),
  });

  const deleteFileMutation = useMutation({
    mutationFn: async ({ challengeId, fileId }: { challengeId: number; fileId: number }) => {
      const res = await fetch(`/api/admin/challenges/${challengeId}/files/${fileId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete file");
    },
    onSuccess: (_, variables) => {
      toast({ title: "File deleted" });
      refetchFiles();
      queryClient.invalidateQueries({ queryKey: [`/api/challenges/${variables.challengeId}/files`] });
    },
    onError: () => toast({ title: "Failed to delete file", variant: "destructive" }),
  });

  const openFilesDialog = (challengeId: number) => {
    setSelectedChallengeId(challengeId);
    setFilesDialogOpen(true);
  };

  const linkContainerMutation = useMutation({
    mutationFn: async ({ challengeId, containerId }: { challengeId: number; containerId: number }) => {
      const res = await fetch(`/api/admin/challenges/${challengeId}/containers/${containerId}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to link container");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/challenges/${editingChallenge?.id}/containers`] });
      queryClient.invalidateQueries({ queryKey: [`/api/challenges/${editingChallenge?.id}/container`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/containers"] });
      toast({ title: "Container linked successfully" });
    },
    onError: () => {
      toast({ title: "Failed to link container", variant: "destructive" });
    },
  });

  const unlinkContainerMutation = useMutation({
    mutationFn: async ({ challengeId, containerId }: { challengeId: number; containerId: number }) => {
      const res = await fetch(`/api/admin/challenges/${challengeId}/containers/${containerId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to unlink container");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/challenges/${editingChallenge?.id}/containers`] });
      queryClient.invalidateQueries({ queryKey: [`/api/challenges/${editingChallenge?.id}/container`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/containers"] });
      toast({ title: "Container unlinked successfully" });
    },
    onError: () => {
      toast({ title: "Failed to unlink container", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      ctfEventId: "",
      categoryId: "",
      name: "",
      description: "",
      flag: "",
      points: "100",
      isDynamic: false,
      minPoints: "50",
      decay: "10",
      isHidden: false,
    });
    setEditingChallenge(null);
    setLinkedContainers([]);
  };

  const openEditDialog = (challenge: Challenge & { ctfEventName: string; categoryName: string | null }) => {
    setEditingChallenge(challenge);
    setFormData({
      ctfEventId: challenge.ctfEventId.toString(),
      categoryId: (challenge.categoryId || "").toString(),
      name: challenge.name,
      description: challenge.description,
      flag: challenge.flag,
      points: challenge.points.toString(),
      isDynamic: challenge.isDynamic,
      minPoints: (challenge.minPoints || "50").toString(),
      decay: (challenge.decay || "10").toString(),
      isHidden: challenge.isHidden,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingChallenge) {
      updateMutation.mutate({ id: editingChallenge.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-orbitron font-bold">Challenges</h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              New Challenge
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-white/10 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-orbitron">
                {editingChallenge ? "Edit Challenge" : "Create Challenge"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>CTF Event</Label>
                  <Select
                    value={formData.ctfEventId}
                    onValueChange={(value) => setFormData({ ...formData, ctfEventId: value })}
                  >
                    <SelectTrigger className="bg-secondary border-white/10">
                      <SelectValue placeholder="Select CTF" />
                    </SelectTrigger>
                    <SelectContent>
                      {ctfs?.map((ctf) => (
                        <SelectItem key={ctf.id} value={ctf.id.toString()}>
                          {ctf.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Category</Label>
                  <Select
                    value={formData.categoryId}
                    onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                  >
                    <SelectTrigger className="bg-secondary border-white/10">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-secondary border-white/10"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <Label>Description (Markdown supported)</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="bg-secondary border-white/10 font-mono text-xs"
                    rows={6}
                    placeholder="Use Markdown formatting:&#10;[Link text](https://url.com)&#10;**bold** *italic* `code`&#10;## Heading"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports: links, bold, italic, code blocks, headings, lists
                  </p>
                </div>
                <div className="col-span-2">
                  <Label>Flag</Label>
                  <Input
                    value={formData.flag}
                    onChange={(e) => setFormData({ ...formData, flag: e.target.value })}
                    className="bg-secondary border-white/10 font-mono"
                    placeholder="flag{...}"
                    required
                  />
                </div>
                <div>
                  <Label>Points</Label>
                  <Input
                    type="number"
                    value={formData.points}
                    onChange={(e) => setFormData({ ...formData, points: e.target.value })}
                    className="bg-secondary border-white/10"
                    required
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.isDynamic}
                    onCheckedChange={(checked) => setFormData({ ...formData, isDynamic: checked })}
                  />
                  <Label>Dynamic Scoring</Label>
                </div>
                {formData.isDynamic && (
                  <>
                    <div>
                      <Label>Min Points</Label>
                      <Input
                        type="number"
                        value={formData.minPoints}
                        onChange={(e) => setFormData({ ...formData, minPoints: e.target.value })}
                        className="bg-secondary border-white/10"
                      />
                    </div>
                    <div>
                      <Label>Decay</Label>
                      <Input
                        type="number"
                        value={formData.decay}
                        onChange={(e) => setFormData({ ...formData, decay: e.target.value })}
                        className="bg-secondary border-white/10"
                      />
                    </div>
                  </>
                )}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.isHidden}
                    onCheckedChange={(checked) => setFormData({ ...formData, isHidden: checked })}
                  />
                  <Label>Hidden</Label>
                </div>
              </div>

              {/* Container Linking Section - Only show for existing challenges */}
              {editingChallenge && (
                <div className="border-t border-white/10 pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Container className="w-4 h-4 text-primary" />
                    <Label className="text-base font-orbitron">Linked Containers</Label>
                  </div>

                  {/* Display linked containers */}
                  {challengeContainers && challengeContainers.length > 0 ? (
                    <div className="space-y-2">
                      {challengeContainers.map((link) => {
                        const container = containers?.find(c => c.id === link.containerId);
                        return container ? (
                          <div
                            key={link.containerId}
                            className="flex items-center justify-between p-2 bg-secondary/50 border border-white/10 rounded"
                          >
                            <div className="flex items-center gap-2">
                              <Container className="w-4 h-4 text-primary" />
                              <span className="font-tech text-sm">{container.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {container.deploymentType}
                              </Badge>
                              {link.isPrimary && (
                                <Badge className="text-xs bg-primary">Primary</Badge>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (editingChallenge) {
                                  unlinkContainerMutation.mutate({
                                    challengeId: editingChallenge.id,
                                    containerId: link.containerId,
                                  });
                                }
                              }}
                              disabled={unlinkContainerMutation.isPending}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : null;
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No containers linked to this challenge.</p>
                  )}

                  {/* Add container dropdown */}
                  {containers && containers.length > 0 && (
                    <div className="flex gap-2">
                      <Select
                        value=""
                        onValueChange={(value) => {
                          if (editingChallenge && value) {
                            linkContainerMutation.mutate({
                              challengeId: editingChallenge.id,
                              containerId: parseInt(value),
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="bg-secondary border-white/10">
                          <SelectValue placeholder="Link a container..." />
                        </SelectTrigger>
                        <SelectContent>
                          {containers
                            .filter(c => !challengeContainers?.some(cc => cc.containerId === c.id))
                            .map((container) => (
                              <SelectItem key={container.id} value={container.id.toString()}>
                                {container.name} ({container.deploymentType})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Link containers that players can access from this challenge. The first container linked will be the primary one.
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                )}
                {editingChallenge ? "Update Challenge" : "Create Challenge"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        </div>
      ) : (
        <div className="space-y-2">
          {/* Group challenges by CTF */}
          {(() => {
            // Group challenges by ctfEventId
            const grouped = challenges?.reduce((acc, challenge) => {
              const key = challenge.ctfEventId;
              if (!acc[key]) {
                acc[key] = {
                  ctfName: challenge.ctfEventName,
                  challenges: [],
                };
              }
              acc[key].challenges.push(challenge);
              return acc;
            }, {} as Record<number, { ctfName: string; challenges: typeof challenges }>);

            if (!grouped) return null;

            return Object.entries(grouped).map(([ctfIdStr, { ctfName, challenges: ctfChallenges }]) => {
              const ctfId = parseInt(ctfIdStr);
              const isExpanded = expandedCtfs.has(ctfId);

              return (
                <div key={ctfId} className="border border-white/5 rounded-lg overflow-hidden">
                  {/* CTF Header - Clickable */}
                  <button
                    onClick={() => toggleCtfExpanded(ctfId)}
                    className="w-full flex items-center justify-between p-4 bg-secondary/30 hover:bg-secondary/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-primary" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      )}
                      <span className="font-orbitron font-bold">{ctfName}</span>
                      <Badge variant="outline" className="ml-2">
                        {ctfChallenges?.length} challenge{ctfChallenges?.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </button>

                  {/* Challenges Table - Collapsible */}
                  {isExpanded && (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/5">
                          <TableHead>
                            <button
                              onClick={() => handleSort('name')}
                              className="flex items-center gap-1 hover:text-primary"
                            >
                              Name
                              <ArrowUpDown className="w-3 h-3" />
                            </button>
                          </TableHead>
                          <TableHead>
                            <button
                              onClick={() => handleSort('categoryName')}
                              className="flex items-center gap-1 hover:text-primary"
                            >
                              Category
                              <ArrowUpDown className="w-3 h-3" />
                            </button>
                          </TableHead>
                          <TableHead>
                            <button
                              onClick={() => handleSort('points')}
                              className="flex items-center gap-1 hover:text-primary"
                            >
                              Points
                              <ArrowUpDown className="w-3 h-3" />
                            </button>
                          </TableHead>
                          <TableHead>Solves</TableHead>
                          <TableHead>Flag</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          let sorted = [...ctfChallenges];
                          if (sortConfig) {
                            sorted.sort((a, b) => {
                              const aVal = a[sortConfig.key] ?? '';
                              const bVal = b[sortConfig.key] ?? '';
                              if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                              if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                              return 0;
                            });
                          }
                          return sorted;
                        })().map((challenge) => (
                          <TableRow key={challenge.id} className="border-white/5">
                            <TableCell className="font-tech">{challenge.name}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {challenge.categoryName || '-'}
                            </TableCell>
                            <TableCell>{challenge.points}</TableCell>
                            <TableCell>{challenge.solveCount}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <code className="text-xs font-mono bg-secondary px-2 py-1 rounded max-w-xs truncate">
                                  {revealedFlags.has(challenge.id) && flagCache.has(challenge.id)
                                    ? flagCache.get(challenge.id)
                                    : "•".repeat(Math.min(challenge.flagLength || 20, 20))}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleFlagReveal(challenge.id)}
                                  disabled={loadingFlags.has(challenge.id)}
                                  title={revealedFlags.has(challenge.id) ? "Hide flag" : "Reveal flag"}
                                >
                                  {loadingFlags.has(challenge.id) ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : revealedFlags.has(challenge.id) ? (
                                    <EyeOff className="w-4 h-4" />
                                  ) : (
                                    <Eye className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(challenge)}
                                title="Edit Challenge"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openFilesDialog(challenge.id)}
                                title="Manage Files"
                              >
                                <Upload className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-destructive">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-card border-white/10">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Challenge?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteMutation.mutate(challenge.id)}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Files Management Dialog */}
      <Dialog open={filesDialogOpen} onOpenChange={setFilesDialogOpen}>
        <DialogContent className="bg-card border-white/10">
          <DialogHeader>
            <DialogTitle className="font-orbitron">Manage Challenge Files</DialogTitle>
            <DialogDescription>
              Upload and manage files for this challenge
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Upload Section */}
            <div>
              <Label className="text-xs font-tech uppercase tracking-wider mb-2 block">
                Upload Files
              </Label>
              <div className="flex gap-2">
                <Input
                  type="file"
                  multiple
                  className="bg-secondary border-white/10"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0 && selectedChallengeId) {
                      // Convert FileList to array immediately to prevent it from being cleared
                      const filesArray = Array.from(e.target.files);

                      // Clear input to allow re-uploading same file
                      e.target.value = "";

                      // Trigger upload with array of files
                      uploadFilesMutation.mutate({
                        challengeId: selectedChallengeId,
                        files: filesArray,
                      });
                    }
                  }}
                  disabled={uploadFilesMutation.isPending}
                />
              </div>
              {uploadFilesMutation.isPending && (
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </div>
              )}
            </div>

            {/* Existing Files */}
            <div>
              <Label className="text-xs font-tech uppercase tracking-wider mb-2 block">
                Existing Files
              </Label>
              {challengeFiles && challengeFiles.length > 0 ? (
                <div className="space-y-2">
                  {challengeFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <File className="w-4 h-4 text-primary" />
                        <div>
                          <p className="font-tech text-sm">{file.originalName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => {
                          if (selectedChallengeId) {
                            deleteFileMutation.mutate({
                              challengeId: selectedChallengeId,
                              fileId: file.id,
                            });
                          }
                        }}
                        disabled={deleteFileMutation.isPending}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No files attached to this challenge
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ========== USERS TAB ==========
function UsersTab() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const { data: users, isLoading } = useQuery<{
    id: string;
    username: string;
    email: string;
    role: "owner" | "admin" | "user";
    isBanned: boolean;
  }[]>({ queryKey: ["/api/admin/users"] });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { role?: string; isBanned?: boolean } }) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update user");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "User updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
  });

  return (
    <div>
      <h2 className="text-xl font-orbitron font-bold mb-6">Users</h2>

      {isLoading ? (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-white/5">
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((user) => (
              <TableRow key={user.id} className="border-white/5">
                <TableCell className="font-tech">{user.username}</TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <Badge variant={
                    user.role === "owner" ? "default" :
                    user.role === "admin" ? "default" :
                    "secondary"
                  } className={user.role === "owner" ? "bg-amber-600" : ""}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={user.isBanned ? "destructive" : "outline"}>
                    {user.isBanned ? "Banned" : "Active"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  {user.role === "owner" ? (
                    <span className="text-xs text-muted-foreground italic">Platform Owner</span>
                  ) : user.role === "admin" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={user.id === currentUser?.id}
                      onClick={() => updateMutation.mutate({
                        id: user.id,
                        data: { role: "user" },
                      })}
                    >
                      Demote to User
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentUser?.role !== "owner"}
                        onClick={() => updateMutation.mutate({
                          id: user.id,
                          data: { role: "admin" },
                        })}
                      >
                        Make Admin
                      </Button>
                    </>
                  )}
                  {user.role !== "owner" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateMutation.mutate({
                        id: user.id,
                        data: { isBanned: !user.isBanned },
                      })}
                    >
                      {user.isBanned ? "Unban" : "Ban"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ========== CATEGORIES TAB ==========
function CategoriesTab() {
  const { toast } = useToast();
  const { data: categories, isLoading } = useQuery<Category[]>({ queryKey: ["/api/categories"] });

  return (
    <div>
      <h2 className="text-xl font-orbitron font-bold mb-6">Categories</h2>

      {isLoading ? (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories?.map((category) => (
            <Card key={category.id} className="bg-card border-white/5">
              <CardContent className="p-4 flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${category.color}20` }}
                >
                  <Flag className="w-5 h-5" style={{ color: category.color }} />
                </div>
                <div>
                  <p className="font-tech">{category.name}</p>
                  {category.isDefault && (
                    <Badge variant="outline" className="text-xs">Default</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ========== SUBMISSIONS TAB ==========
function SubmissionsTab() {
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    ctfEventId: undefined as number | undefined,
    challengeId: undefined as number | undefined,
    userId: undefined as string | undefined,
    isCorrect: undefined as boolean | undefined,
  });
  const [page, setPage] = useState(0);
  const limit = 50;

  // Fetch all CTFs for filter dropdown
  const { data: ctfs } = useQuery<any[]>({
    queryKey: ["/api/admin/ctfs"],
  });

  // Fetch all challenges for filter dropdown
  const { data: challenges } = useQuery<any[]>({
    queryKey: ["/api/admin/challenges"],
  });

  // Build query string from filters
  const queryString = new URLSearchParams({
    ...(filters.ctfEventId && { ctfEventId: filters.ctfEventId.toString() }),
    ...(filters.challengeId && { challengeId: filters.challengeId.toString() }),
    ...(filters.userId && { userId: filters.userId }),
    ...(filters.isCorrect !== undefined && { isCorrect: filters.isCorrect.toString() }),
    limit: limit.toString(),
    offset: (page * limit).toString(),
  }).toString();

  // Fetch submissions
  const { data: submissionsData, isLoading } = useQuery<{ submissions: any[]; total: number }>({
    queryKey: ["/api/admin/submissions", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/admin/submissions?${queryString}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch submissions");
      return res.json();
    },
  });

  const submissions = submissionsData?.submissions || [];
  const total = submissionsData?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-orbitron">Flag Submissions</h2>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>CTF Event</Label>
              <Select
                value={filters.ctfEventId?.toString() || "all"}
                onValueChange={(value) => {
                  setFilters({
                    ...filters,
                    ctfEventId: value === "all" ? undefined : parseInt(value),
                  });
                  setPage(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All CTFs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All CTFs</SelectItem>
                  {ctfs?.map((ctf) => (
                    <SelectItem key={ctf.id} value={ctf.id.toString()}>
                      {ctf.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Challenge</Label>
              <Select
                value={filters.challengeId?.toString() || "all"}
                onValueChange={(value) => {
                  setFilters({
                    ...filters,
                    challengeId: value === "all" ? undefined : parseInt(value),
                  });
                  setPage(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Challenges" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Challenges</SelectItem>
                  {challenges?.map((challenge) => (
                    <SelectItem key={challenge.id} value={challenge.id.toString()}>
                      {challenge.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                placeholder="Filter by username"
                value={filters.userId || ""}
                onChange={(e) => {
                  setFilters({
                    ...filters,
                    userId: e.target.value || undefined,
                  });
                  setPage(0);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={
                  filters.isCorrect === undefined
                    ? "all"
                    : filters.isCorrect
                      ? "correct"
                      : "incorrect"
                }
                onValueChange={(value) => {
                  setFilters({
                    ...filters,
                    isCorrect:
                      value === "all" ? undefined : value === "correct",
                  });
                  setPage(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Submissions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Submissions</SelectItem>
                  <SelectItem value="correct">Correct Only</SelectItem>
                  <SelectItem value="incorrect">Incorrect Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing {submissions.length} of {total} submission{total !== 1 ? "s" : ""}
      </div>

      {/* Submissions Table */}
      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : submissions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No submissions found
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>CTF Event</TableHead>
                <TableHead>Challenge</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Flag</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell className="font-mono text-sm">
                    {new Date(submission.submittedAt).toLocaleString()}
                  </TableCell>
                  <TableCell>{submission.ctfEventName}</TableCell>
                  <TableCell>{submission.challengeName}</TableCell>
                  <TableCell>{submission.username}</TableCell>
                  <TableCell>{submission.teamName || "-"}</TableCell>
                  <TableCell className="font-mono text-sm max-w-xs truncate">
                    {submission.flag}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={submission.isCorrect ? "default" : "destructive"}
                      className={
                        submission.isCorrect
                          ? "bg-green-500 hover:bg-green-600"
                          : ""
                      }
                    >
                      {submission.isCorrect ? "Correct" : "Incorrect"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== SETTINGS TAB ==========
function SettingsTab() {
  const { toast } = useToast();
  const { settings: platformSettings, isLoading } = usePlatformSettings();
  const [formData, setFormData] = useState({
    platform_name: "",
    platform_tagline: "",
    primary_color: "",
    footer_copyright: "",
  });
  const [colorHex, setColorHex] = useState("#8B1538");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);

  // Initialize form data when settings load
  useEffect(() => {
    if (platformSettings) {
      setFormData({
        platform_name: platformSettings.platformName,
        platform_tagline: platformSettings.platformTagline,
        primary_color: platformSettings.primaryColor,
        footer_copyright: platformSettings.footerCopyright,
      });
      setColorHex(hslToHex(platformSettings.primaryColor));
    }
  }, [platformSettings]);

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, string>) => {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update settings");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Settings updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch("/api/admin/settings/logo", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to upload logo");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Logo uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setLogoFile(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadFaviconMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("favicon", file);
      const res = await fetch("/api/admin/settings/favicon", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to upload favicon");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Favicon uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setFaviconFile(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleColorChange = (hex: string) => {
    setColorHex(hex);
    const hsl = hexToHSL(hex);
    setFormData({ ...formData, primary_color: hsl });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Branding Card */}
      <Card className="bg-card border-white/5">
        <CardHeader>
          <CardTitle className="font-orbitron flex items-center gap-2">
            <Image className="w-5 h-5" />
            Branding
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="platform_name">Platform Name</Label>
              <Input
                id="platform_name"
                value={formData.platform_name}
                onChange={(e) => setFormData({ ...formData, platform_name: e.target.value })}
                className="bg-secondary border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform_tagline">Tagline</Label>
              <Input
                id="platform_tagline"
                value={formData.platform_tagline}
                onChange={(e) => setFormData({ ...formData, platform_tagline: e.target.value })}
                className="bg-secondary border-white/10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="footer_copyright">Footer Copyright</Label>
            <Input
              id="footer_copyright"
              value={formData.footer_copyright}
              onChange={(e) => setFormData({ ...formData, footer_copyright: e.target.value })}
              className="bg-secondary border-white/10"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="logo">Logo</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  className="bg-secondary border-white/10"
                />
                {logoFile && (
                  <Button
                    onClick={() => uploadLogoMutation.mutate(logoFile)}
                    disabled={uploadLogoMutation.isPending}
                    size="sm"
                  >
                    {uploadLogoMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
              {platformSettings?.logoUrl && (
                <div className="mt-2">
                  <img
                    src={platformSettings.logoUrl}
                    alt="Logo preview"
                    className="w-16 h-16 object-contain rounded border border-white/10"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="favicon">Favicon</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="favicon"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFaviconFile(e.target.files?.[0] || null)}
                  className="bg-secondary border-white/10"
                />
                {faviconFile && (
                  <Button
                    onClick={() => uploadFaviconMutation.mutate(faviconFile)}
                    disabled={uploadFaviconMutation.isPending}
                    size="sm"
                  >
                    {uploadFaviconMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
              {platformSettings?.faviconUrl && (
                <div className="mt-2">
                  <img
                    src={platformSettings.faviconUrl}
                    alt="Favicon preview"
                    className="w-8 h-8 object-contain rounded border border-white/10"
                  />
                </div>
              )}
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="bg-primary hover:bg-primary/90"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            Save Branding Settings
          </Button>
        </CardContent>
      </Card>

      {/* Appearance Card */}
      <Card className="bg-card border-white/5">
        <CardHeader>
          <CardTitle className="font-orbitron flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="primary_color">Primary Color</Label>
            <div className="flex items-center gap-4">
              <Input
                id="primary_color_picker"
                type="color"
                value={colorHex}
                onChange={(e) => handleColorChange(e.target.value)}
                className="w-20 h-10 cursor-pointer"
              />
              <Input
                id="primary_color"
                value={formData.primary_color}
                onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                placeholder="345 80% 35%"
                className="flex-1 bg-secondary border-white/10 font-mono text-sm"
              />
              <div
                className="w-10 h-10 rounded border border-white/10"
                style={{ backgroundColor: colorHex }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              HSL format: hue saturation% lightness% (e.g., "345 80% 35%")
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="bg-primary hover:bg-primary/90"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            Save Appearance Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ========== SERIAL CHALLENGES TAB ==========
function SerialChallengesTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stagesDialogOpen, setStagesDialogOpen] = useState(false);
  const [stageFormDialogOpen, setStageFormDialogOpen] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<any | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<any | null>(null);
  const [editingStage, setEditingStage] = useState<any | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    ctfEventId: "",
    categoryId: "",
    authorId: "",
    isHidden: false,
    releaseTime: undefined as Date | undefined,
  });

  const [stageFormData, setStageFormData] = useState({
    stageOrder: "",
    name: "",
    description: "",
    flag: "",
    points: "",
    hint: "",
  });

  // Fetch all CTFs and categories for dropdowns
  const { data: ctfs } = useQuery<any[]>({
    queryKey: ["/api/admin/ctfs"],
  });

  const { data: categories } = useQuery<any[]>({
    queryKey: ["/api/categories"],
  });

  // Fetch serial challenges
  const { data: serialChallenges, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/serial-challenges"],
    queryFn: async () => {
      const res = await fetch("/api/admin/serial-challenges", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch serial challenges");
      return res.json();
    },
  });

  // Fetch stages for selected challenge
  const { data: stages } = useQuery<any[]>({
    queryKey: ["/api/admin/serial-challenges", selectedChallenge?.id, "stages"],
    queryFn: async () => {
      const res = await fetch(`/api/serial-challenges/${selectedChallenge!.id}/stages`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch stages");
      return res.json();
    },
    enabled: !!selectedChallenge,
  });

  // Create serial challenge
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/admin/serial-challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create serial challenge");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Serial challenge created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/serial-challenges"] });
      if (data.ctfEventId) {
        queryClient.invalidateQueries({ queryKey: [`/api/ctfs/${data.ctfEventId}/serial-challenges`] });
      }
      setDialogOpen(false);
      resetForm();
    },
    onError: () => toast({ title: "Failed to create serial challenge", variant: "destructive" }),
  });

  // Update serial challenge
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/admin/serial-challenges/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update serial challenge");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Serial challenge updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/serial-challenges"] });
      if (data.ctfEventId) {
        queryClient.invalidateQueries({ queryKey: [`/api/ctfs/${data.ctfEventId}/serial-challenges`] });
      }
      setDialogOpen(false);
      resetForm();
    },
    onError: () => toast({ title: "Failed to update serial challenge", variant: "destructive" }),
  });

  // Delete serial challenge
  const deleteMutation = useMutation({
    mutationFn: async (challenge: any) => {
      const res = await fetch(`/api/admin/serial-challenges/${challenge.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete serial challenge");
      return challenge;
    },
    onSuccess: (challenge) => {
      toast({ title: "Serial challenge deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/serial-challenges"] });
      if (challenge.ctfEventId) {
        queryClient.invalidateQueries({ queryKey: [`/api/ctfs/${challenge.ctfEventId}/serial-challenges`] });
      }
    },
    onError: () => toast({ title: "Failed to delete serial challenge", variant: "destructive" }),
  });

  // Create stage
  const createStageMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/admin/serial-challenges/${selectedChallenge!.id}/stages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create stage");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Stage created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/serial-challenges", selectedChallenge!.id, "stages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/serial-challenges"] });
      setStageFormDialogOpen(false);
      resetStageForm();
    },
    onError: () => toast({ title: "Failed to create stage", variant: "destructive" }),
  });

  // Update stage
  const updateStageMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/admin/serial-stages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update stage");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Stage updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/serial-challenges", selectedChallenge!.id, "stages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/serial-challenges"] });
      setStageFormDialogOpen(false);
      resetStageForm();
    },
    onError: () => toast({ title: "Failed to update stage", variant: "destructive" }),
  });

  // Delete stage
  const deleteStageMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/serial-stages/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete stage");
    },
    onSuccess: () => {
      toast({ title: "Stage deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/serial-challenges", selectedChallenge!.id, "stages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/serial-challenges"] });
    },
    onError: () => toast({ title: "Failed to delete stage", variant: "destructive" }),
  });

  // Upload file to stage
  const uploadFileMutation = useMutation({
    mutationFn: async ({ stageId, file }: { stageId: number; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/admin/serial-stages/${stageId}/files`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to upload file");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "File uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/serial-challenges", selectedChallenge!.id, "stages"] });
      queryClient.invalidateQueries({ queryKey: [`/api/serial-challenges/${selectedChallenge!.id}/stages`] });
    },
    onError: () => toast({ title: "Failed to upload file", variant: "destructive" }),
  });

  // Delete file from stage
  const deleteFileMutation = useMutation({
    mutationFn: async ({ stageId, fileId }: { stageId: number; fileId: number }) => {
      const res = await fetch(`/api/admin/serial-stages/${stageId}/files/${fileId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete file");
    },
    onSuccess: () => {
      toast({ title: "File deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/serial-challenges", selectedChallenge!.id, "stages"] });
      queryClient.invalidateQueries({ queryKey: [`/api/serial-challenges/${selectedChallenge!.id}/stages`] });
    },
    onError: () => toast({ title: "Failed to delete file", variant: "destructive" }),
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      ctfEventId: "",
      categoryId: "",
      authorId: "",
      isHidden: false,
      releaseTime: undefined,
    });
    setEditingChallenge(null);
  };

  const resetStageForm = () => {
    setStageFormData({
      stageOrder: "",
      name: "",
      description: "",
      flag: "",
      points: "",
      hint: "",
    });
    setEditingStage(null);
  };

  const openEditDialog = (challenge: any) => {
    setEditingChallenge(challenge);
    setFormData({
      name: challenge.name,
      description: challenge.description,
      ctfEventId: challenge.ctfEventId.toString(),
      categoryId: challenge.categoryId.toString(),
      authorId: challenge.authorId || "",
      isHidden: challenge.isHidden,
      releaseTime: challenge.releaseTime ? new Date(challenge.releaseTime) : undefined,
    });
    setDialogOpen(true);
  };

  const openStagesDialog = (challenge: any) => {
    setSelectedChallenge(challenge);
    setStagesDialogOpen(true);
  };

  const openStageFormDialog = (stage?: any) => {
    if (stage) {
      setEditingStage(stage);
      setStageFormData({
        stageOrder: stage.stageOrder.toString(),
        name: stage.name,
        description: stage.description,
        flag: stage.flag,
        points: stage.points.toString(),
        hint: stage.hint || "",
      });
    } else {
      resetStageForm();
      // Auto-set next stage order
      const nextOrder = stages ? stages.length + 1 : 1;
      setStageFormData(prev => ({ ...prev, stageOrder: nextOrder.toString() }));
    }
    setStageFormDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = {
      name: formData.name,
      description: formData.description,
      ctfEventId: parseInt(formData.ctfEventId),
      categoryId: parseInt(formData.categoryId),
      isHidden: formData.isHidden,
      releaseTime: formData.releaseTime,
    };

    // Only include authorId if it's not empty
    if (formData.authorId && formData.authorId.trim() !== "") {
      data.authorId = formData.authorId;
    }

    if (editingChallenge) {
      updateMutation.mutate({ id: editingChallenge.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleStageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...stageFormData,
      stageOrder: parseInt(stageFormData.stageOrder),
      points: parseInt(stageFormData.points),
    };

    if (editingStage) {
      updateStageMutation.mutate({ id: editingStage.id, data });
    } else {
      createStageMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold font-orbitron">Serial Challenges</h2>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Create Serial Challenge
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          {!serialChallenges || serialChallenges.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No serial challenges yet. Create one to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {serialChallenges.map((challenge) => (
                <Card key={challenge.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">{challenge.name}</h3>
                        <p className="text-sm text-muted-foreground">{challenge.description}</p>
                        <div className="flex gap-4 mt-2 text-sm">
                          <span>CTF: {challenge.ctfEvent?.name || "Unknown"}</span>
                          <span>Stages: {challenge.totalStages}</span>
                          {challenge.isHidden && <Badge variant="secondary">Hidden</Badge>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openStagesDialog(challenge)}>
                          <List className="w-4 h-4 mr-1" />
                          Manage Stages
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(challenge)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteMutation.mutate(challenge)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Serial Challenge Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-orbitron">
              {editingChallenge ? "Edit" : "Create"} Serial Challenge
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>CTF Event</Label>
                <Select
                  value={formData.ctfEventId}
                  onValueChange={(value) => setFormData({ ...formData, ctfEventId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select CTF" />
                  </SelectTrigger>
                  <SelectContent>
                    {ctfs?.filter(ctf => ctf.ctfType === "serial").map((ctf) => (
                      <SelectItem key={ctf.id} value={ctf.id.toString()}>
                        {ctf.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isHidden}
                onCheckedChange={(checked) => setFormData({ ...formData, isHidden: checked })}
              />
              <Label>Hidden</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingChallenge ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Stages Dialog */}
      <Dialog open={stagesDialogOpen} onOpenChange={setStagesDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-orbitron">
              Manage Stages: {selectedChallenge?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button onClick={() => openStageFormDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Stage
            </Button>

            {!stages || stages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No stages yet. Add a stage to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {stages
                  .sort((a, b) => a.stageOrder - b.stageOrder)
                  .map((stage) => (
                    <Card key={stage.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge>{`Stage ${stage.stageOrder}`}</Badge>
                              <h4 className="font-semibold">{stage.name}</h4>
                              <span className="text-sm text-muted-foreground">
                                ({stage.points} pts)
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {stage.description}
                            </p>
                            {stage.files && stage.files.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {stage.files.map((file: any) => (
                                  <Badge key={file.id} variant="secondary" className="text-xs">
                                    {file.originalName}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openStageFormDialog(stage)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteStageMutation.mutate(stage.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Stage Dialog */}
      <Dialog open={stageFormDialogOpen} onOpenChange={setStageFormDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-orbitron">
              {editingStage ? "Edit" : "Add"} Stage
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleStageSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Stage Order</Label>
                <Input
                  type="number"
                  value={stageFormData.stageOrder}
                  onChange={(e) => setStageFormData({ ...stageFormData, stageOrder: e.target.value })}
                  min={1}
                  required
                />
              </div>
              <div>
                <Label>Points</Label>
                <Input
                  type="number"
                  value={stageFormData.points}
                  onChange={(e) => setStageFormData({ ...stageFormData, points: e.target.value })}
                  min={0}
                  required
                />
              </div>
            </div>
            <div>
              <Label>Name</Label>
              <Input
                value={stageFormData.name}
                onChange={(e) => setStageFormData({ ...stageFormData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={stageFormData.description}
                onChange={(e) => setStageFormData({ ...stageFormData, description: e.target.value })}
                rows={3}
                required
              />
            </div>
            <div>
              <Label>Flag</Label>
              <Input
                value={stageFormData.flag}
                onChange={(e) => setStageFormData({ ...stageFormData, flag: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Hint (Optional)</Label>
              <Textarea
                value={stageFormData.hint}
                onChange={(e) => setStageFormData({ ...stageFormData, hint: e.target.value })}
                rows={2}
              />
            </div>

            {/* File Management Section - Only show when editing */}
            {editingStage && (
              <div className="border-t border-white/10 pt-4 space-y-3">
                <div>
                  <Label className="text-sm font-medium">Stage Files</Label>

                  {/* Existing Files */}
                  {editingStage.files && editingStage.files.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {editingStage.files.map((file: any) => (
                        <div key={file.id} className="flex items-center justify-between p-2 bg-secondary rounded-md">
                          <span className="text-sm">{file.originalName}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteFileMutation.mutate({ stageId: editingStage.id, fileId: file.id })}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-2">No files uploaded yet.</p>
                  )}

                  {/* Upload New File */}
                  <div className="mt-3">
                    <Input
                      id={`file-upload-${editingStage.id}`}
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          uploadFileMutation.mutate({ stageId: editingStage.id, file });
                          // Reset input
                          e.target.value = '';
                        }
                      }}
                      className="bg-secondary border-white/10"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setStageFormDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingStage ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ========== CONTAINERS TAB ==========
function ContainersTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [editingContainer, setEditingContainer] = useState<any | null>(null);
  const [selectedDeployment, setSelectedDeployment] = useState<any | null>(null);
  const [deploymentLogs, setDeploymentLogs] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    deploymentType: "registry",
    registryUrl: "",
    imageName: "",
    imageTag: "latest",
    registryUsername: "",
    registryPassword: "",
    exposedPorts: "[]",
    memoryLimit: 512,
    cpuLimit: 256,
  });

  const [portMappings, setPortMappings] = useState<Array<{ containerPort: number | ""; subdomain: string }>>([
    { containerPort: 80, subdomain: "" }
  ]);

  // Fetch containers
  const { data: containers = [], isLoading: containersLoading, refetch: refetchContainers } = useQuery({
    queryKey: ["/api/admin/containers"],
    queryFn: async () => {
      const res = await fetch("/api/admin/containers", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch containers");
      return res.json();
    },
  });

  // Fetch deployments
  const { data: deployments = [], isLoading: deploymentsLoading, refetch: refetchDeployments } = useQuery({
    queryKey: ["/api/admin/deployments"],
    queryFn: async () => {
      const res = await fetch("/api/admin/deployments", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch deployments");
      return res.json();
    },
  });

  // Fetch Docker containers
  const { data: dockerContainers = [], isLoading: dockerLoading, refetch: refetchDockerContainers } = useQuery({
    queryKey: ["/api/admin/docker/containers"],
    queryFn: async () => {
      const res = await fetch("/api/admin/docker/containers", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch Docker containers");
      return res.json();
    },
  });

  // Create/Update container mutation
  const containerMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingContainer
        ? `/api/admin/containers/${editingContainer.id}`
        : "/api/admin/containers";
      const method = editingContainer ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save container");
      }
      const container = await res.json();

      // If creating a new container (not editing), auto-deploy it
      if (!editingContainer) {
        // Get the first port's subdomain to use as instance name
        const exposedPorts = JSON.parse(data.exposedPorts || "[]");
        const firstSubdomain = exposedPorts[0]?.subdomain;

        if (!firstSubdomain) {
          throw new Error("Subdomain is required for deployment");
        }

        // Deploy the container
        const deployRes = await fetch(`/api/admin/containers/${container.id}/deploy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ instanceName: firstSubdomain }),
        });

        if (!deployRes.ok) {
          // Deployment failed - rollback by deleting the container
          await fetch(`/api/admin/containers/${container.id}`, {
            method: "DELETE",
            credentials: "include",
          });

          const deployError = await deployRes.json();
          throw new Error(deployError.error || "Failed to deploy container. Container has been removed.");
        }
      }

      return container;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/containers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deployments"] });
      setDialogOpen(false);
      setEditingContainer(null);
      resetForm();
      toast({
        title: editingContainer ? "Container updated" : "Container created and deployed",
        description: editingContainer
          ? "Container has been updated successfully"
          : "Container has been created and deployed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // Delete container mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/containers/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete container");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/containers"] });
      toast({ title: "Container deleted", description: "Container has been deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  // Refresh Docker image mutation (nuclear clean: remove all containers, pull fresh image)
  const refreshImageMutation = useMutation({
    mutationFn: async (containerId: number) => {
      const res = await fetch(`/api/admin/containers/${containerId}/refresh-image`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to refresh image");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deployments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/containers"] });
      toast({
        title: "Nuclear refresh complete",
        description: `Removed ${data.removedContainers} container(s), deleted ${data.deletedDeployments} deployment(s)${data.pulledImage ? ', pulled fresh image' : ''}. Ready for fresh deployment.`,
      });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Refresh failed", description: error.message });
    },
  });

  // Deploy container mutation (smart deploy: restart if exists, create if doesn't)
  const deployContainerMutation = useMutation({
    mutationFn: async (container: any) => {
      // Get the first port's subdomain to use as instance name
      const exposedPorts = JSON.parse(container.exposedPorts || "[]");
      const firstSubdomain = exposedPorts[0]?.subdomain;

      if (!firstSubdomain) {
        throw new Error("Subdomain is required for deployment");
      }

      const res = await fetch(`/api/admin/containers/${container.id}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ instanceName: firstSubdomain }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to deploy container");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deployments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/containers"] });

      // Show appropriate message based on whether container was restarted or deployed fresh
      if (data.wasRestarted) {
        toast({
          title: "Container restarted",
          description: "Existing container has been restarted successfully"
        });
      } else {
        toast({
          title: "Container deployed",
          description: "Container has been deployed successfully"
        });
      }
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Deploy failed", description: error.message });
    },
  });

  // Stop deployment mutation
  const stopMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/deployments/${id}/stop`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to stop deployment");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deployments"] });
      toast({ title: "Deployment stopped", description: "Deployment has been stopped successfully" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  // Restart deployment mutation
  const restartMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/deployments/${id}/restart`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to restart deployment");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deployments"] });
      toast({ title: "Deployment restarted", description: "Deployment has been restarted successfully" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  // Cleanup orphaned containers mutation
  const cleanupOrphansMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/docker/cleanup-orphans", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to cleanup orphaned containers");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/docker/containers"] });
      toast({
        title: "Cleanup complete",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  // Remove single Docker container mutation
  const removeDockerContainerMutation = useMutation({
    mutationFn: async (containerId: string) => {
      const res = await fetch(`/api/admin/docker/containers/${containerId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove Docker container");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/docker/containers"] });
      toast({ title: "Container removed", description: "Docker container has been removed successfully" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  // Fetch logs function
  const fetchLogs = async (deploymentId: number) => {
    try {
      const res = await fetch(`/api/admin/deployments/${deploymentId}/logs?tail=100`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch logs");
      const data = await res.json();
      setDeploymentLogs(data.logs);
      setLogsDialogOpen(true);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      deploymentType: "registry",
      registryUrl: "",
      imageName: "",
      imageTag: "latest",
      registryUsername: "",
      registryPassword: "",
      exposedPorts: "[]",
      memoryLimit: 512,
      cpuLimit: 256,
    });
    setPortMappings([{ containerPort: 80, subdomain: "" }]);
  };

  const openEditDialog = (container: any) => {
    setEditingContainer(container);
    setFormData({
      name: container.name,
      description: container.description || "",
      deploymentType: container.deploymentType,
      registryUrl: container.registryUrl || "",
      imageName: container.imageName || "",
      imageTag: container.imageTag || "latest",
      registryUsername: container.registryUsername || "",
      registryPassword: "",
      exposedPorts: container.exposedPorts || "[]",
      memoryLimit: container.memoryLimit || 512,
      cpuLimit: container.cpuLimit || 256,
    });

    // Parse existing port mappings from exposedPorts JSON
    try {
      const ports = JSON.parse(container.exposedPorts || "[]");
      if (Array.isArray(ports) && ports.length > 0) {
        setPortMappings(ports.map((p: any) => ({
          containerPort: typeof p === 'number' ? p : p.containerPort,
          subdomain: typeof p === 'object' ? (p.subdomain || p.serviceName || "") : ""
        })));
      } else {
        setPortMappings([{ containerPort: 80, subdomain: "" }]);
      }
    } catch {
      setPortMappings([{ containerPort: 80, subdomain: "" }]);
    }

    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate that all ports are valid numbers
    if (portMappings.some(pm => !pm.containerPort || pm.containerPort === "")) {
      return; // HTML5 required attribute should prevent this, but double-check
    }

    // Convert port mappings to JSON format for exposedPorts field
    const exposedPortsData = portMappings.map(pm => ({
      containerPort: typeof pm.containerPort === "number" ? pm.containerPort : parseInt(pm.containerPort),
      subdomain: pm.subdomain
    }));

    containerMutation.mutate({
      ...formData,
      exposedPorts: JSON.stringify(exposedPortsData)
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Container Management</h2>
          <p className="text-muted-foreground">Manage Docker containers and deployments</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditingContainer(null);
                resetForm();
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Container
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingContainer ? "Edit Container" : "Create Container"}</DialogTitle>
              <DialogDescription>
                Configure a container from a registry or upload
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Container Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="my-web-challenge"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Web application challenge"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deploymentType">Deployment Type *</Label>
                <Select
                  value={formData.deploymentType}
                  onValueChange={(value) => setFormData({ ...formData, deploymentType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="registry">Registry (Docker Hub, ECR)</SelectItem>
                    <SelectItem value="upload">Upload TAR File (Coming Soon)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.deploymentType === "registry" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="imageName">Image Name *</Label>
                      <Input
                        id="imageName"
                        value={formData.imageName}
                        onChange={(e) => setFormData({ ...formData, imageName: e.target.value })}
                        placeholder="nginx"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="imageTag">Image Tag</Label>
                      <Input
                        id="imageTag"
                        value={formData.imageTag}
                        onChange={(e) => setFormData({ ...formData, imageTag: e.target.value })}
                        placeholder="latest"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="registryUrl">Registry URL (optional)</Label>
                    <Input
                      id="registryUrl"
                      value={formData.registryUrl}
                      onChange={(e) => setFormData({ ...formData, registryUrl: e.target.value })}
                      placeholder="Leave empty for Docker Hub"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="registryUsername">Registry Username (optional)</Label>
                      <Input
                        id="registryUsername"
                        value={formData.registryUsername}
                        onChange={(e) => setFormData({ ...formData, registryUsername: e.target.value })}
                        placeholder="username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="registryPassword">Registry Password (optional)</Label>
                      <Input
                        id="registryPassword"
                        type="password"
                        value={formData.registryPassword}
                        onChange={(e) => setFormData({ ...formData, registryPassword: e.target.value })}
                        placeholder="password"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Port Mappings *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPortMappings([...portMappings, { containerPort: 80, subdomain: "" }])}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Port
                  </Button>
                </div>
                <div className="space-y-2 border rounded-md p-3">
                  {portMappings.map((mapping, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4">
                        <Label htmlFor={`port-${index}`} className="text-xs">Container Port</Label>
                        <Input
                          id={`port-${index}`}
                          type="number"
                          value={mapping.containerPort || ""}
                          onChange={(e) => {
                            const updated = [...portMappings];
                            updated[index].containerPort = e.target.value === "" ? "" : parseInt(e.target.value);
                            setPortMappings(updated);
                          }}
                          placeholder="80"
                          min={1}
                          max={65535}
                          required
                        />
                      </div>
                      <div className="col-span-7">
                        <Label htmlFor={`subdomain-${index}`} className="text-xs">Subdomain (required)</Label>
                        <Input
                          id={`subdomain-${index}`}
                          value={mapping.subdomain}
                          onChange={(e) => {
                            const updated = [...portMappings];
                            updated[index].subdomain = e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, '');
                            setPortMappings(updated);
                          }}
                          placeholder="whamazon"
                          pattern="[a-z0-9]([a-z0-9\-]*[a-z0-9])?"
                          required
                        />
                      </div>
                      <div className="col-span-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (portMappings.length > 1) {
                              setPortMappings(portMappings.filter((_, i) => i !== index));
                            }
                          }}
                          disabled={portMappings.length === 1}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Each port gets its own subdomain (e.g., "whamazon" becomes https://whamazon.strayerraptors.com)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="memoryLimit">Memory Limit (MB)</Label>
                  <Input
                    id="memoryLimit"
                    type="number"
                    value={formData.memoryLimit}
                    onChange={(e) => setFormData({ ...formData, memoryLimit: parseInt(e.target.value) })}
                    min={128}
                    max={4096}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpuLimit">CPU Limit (shares)</Label>
                  <Input
                    id="cpuLimit"
                    type="number"
                    value={formData.cpuLimit}
                    onChange={(e) => setFormData({ ...formData, cpuLimit: parseInt(e.target.value) })}
                    min={128}
                    max={2048}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    setEditingContainer(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={containerMutation.isPending}>
                  {containerMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingContainer ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Containers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Containers</CardTitle>
        </CardHeader>
        <CardContent>
          {containersLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : containers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No containers yet. Create your first container to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead>Ports</TableHead>
                  <TableHead>Resources</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {containers.map((container: any) => (
                  <TableRow key={container.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{container.name}</div>
                        {container.description && (
                          <div className="text-sm text-muted-foreground">{container.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{container.deploymentType}</Badge>
                    </TableCell>
                    <TableCell>
                      {container.deploymentType === "registry" ? (
                        <code className="text-xs">
                          {container.registryUrl ? `${container.registryUrl}/` : ""}
                          {container.imageName}:{container.imageTag}
                        </code>
                      ) : (
                        <span className="text-xs">{container.uploadFilename}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">
                        {(() => {
                          const ports = JSON.parse(container.exposedPorts || "[]");
                          return ports.map((p: any) => {
                            if (typeof p === 'number') {
                              return p;
                            } else if (p.serviceName) {
                              return `${p.containerPort} (${p.serviceName})`;
                            } else {
                              return p.containerPort;
                            }
                          }).join(", ");
                        })()}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground">
                        {container.memoryLimit}MB / {container.cpuLimit} CPU
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deployContainerMutation.mutate(container)}
                          disabled={deployContainerMutation.isPending}
                        >
                          {deployContainerMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={refreshImageMutation.isPending}
                            >
                              {refreshImageMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RotateCw className="w-4 h-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Refresh Docker Image</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will stop all running deployments for "{container.name}", remove the cached Docker image, and pull a fresh copy from the registry. Continue?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => refreshImageMutation.mutate(container.id)}
                              >
                                Refresh Image
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(container)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Container</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{container.name}"? This will also remove all
                                deployments.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(container.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Active Deployments */}
      <Card>
        <CardHeader>
          <CardTitle>Active Deployments</CardTitle>
        </CardHeader>
        <CardContent>
          {deploymentsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : deployments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No active deployments. Deploy a container to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instance Name</TableHead>
                  <TableHead>Container</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Linked Challenges</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deployments.map((deployment: any) => (
                  <TableRow key={deployment.id}>
                    <TableCell>
                      <div className="font-medium">{deployment.instanceName}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">{deployment.containerName || "-"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={deployment.status === "running" ? "default" : "secondary"}
                      >
                        {deployment.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{deployment.platform}</Badge>
                    </TableCell>
                    <TableCell>
                      {deployment.linkedChallenges && deployment.linkedChallenges.length > 0 ? (
                        <div className="space-y-1">
                          {deployment.linkedChallenges.map((link: any) => (
                            <div key={link.challengeId}>
                              <a
                                href={link.accessUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-1 text-sm"
                              >
                                <ExternalLink className="w-3 h-3" />
                                {link.challengeName}
                              </a>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">Not linked to any challenge</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {deployment.startedAt
                        ? format(new Date(deployment.startedAt), "MMM d, HH:mm")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchLogs(deployment.id)}
                        >
                          <Terminal className="w-4 h-4" />
                        </Button>
                        {deployment.status === "running" ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => restartMutation.mutate(deployment.id)}
                            >
                              <RotateCw className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => stopMutation.mutate(deployment.id)}
                            >
                              <Square className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => restartMutation.mutate(deployment.id)}
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Docker Containers */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Docker Containers</CardTitle>
            <CardDescription>All Docker containers on this host (orphans highlighted in red)</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchDockerContainers()}
              disabled={dockerLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${dockerLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => cleanupOrphansMutation.mutate()}
              disabled={cleanupOrphansMutation.isPending || dockerContainers.filter((c: any) => c.isOrphan).length === 0}
            >
              {cleanupOrphansMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Trash2 className="w-4 h-4 mr-2" />
              Remove All Orphans ({dockerContainers.filter((c: any) => c.isOrphan).length})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {dockerLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : dockerContainers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No Docker containers found
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Container Name</TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Container ID</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dockerContainers.map((container: any) => (
                  <TableRow
                    key={container.id}
                    className={container.isOrphan ? "bg-red-500/10 border-l-4 border-l-red-500" : ""}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {container.name || "(unnamed)"}
                        {container.isOrphan && (
                          <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded">
                            ORPHAN
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground font-mono">
                        {container.image}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded ${
                        container.state === 'running' ? 'bg-green-500/20 text-green-400' :
                        container.state === 'exited' ? 'bg-gray-500/20 text-gray-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {container.state}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground">
                        {container.status}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground font-mono">
                        {container.id.substring(0, 12)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {container.isOrphan && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeDockerContainerMutation.mutate(container.id)}
                          disabled={removeDockerContainerMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Logs Dialog */}
      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Container Logs</DialogTitle>
          </DialogHeader>
          <div className="bg-black/90 p-4 rounded-lg overflow-auto max-h-96">
            <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
              {deploymentLogs || "No logs available"}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ========== MAIN ADMIN PAGE ==========
export default function AdminPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-orbitron font-bold mb-8">
            Admin <span className="text-primary">Dashboard</span>
          </h1>

          <Card className="bg-card border-white/5">
            <CardContent className="p-6">
              <Tabs defaultValue="ctfs">
                <TabsList className="mb-6">
                  <TabsTrigger value="ctfs">
                    <Trophy className="w-4 h-4 mr-2" />
                    CTF Events
                  </TabsTrigger>
                  <TabsTrigger value="challenges">
                    <Flag className="w-4 h-4 mr-2" />
                    Challenges
                  </TabsTrigger>
                  <TabsTrigger value="serial">
                    <List className="w-4 h-4 mr-2" />
                    Serial Challenges
                  </TabsTrigger>
                  <TabsTrigger value="containers">
                    <Container className="w-4 h-4 mr-2" />
                    Containers
                  </TabsTrigger>
                  <TabsTrigger value="users">
                    <Users className="w-4 h-4 mr-2" />
                    Users
                  </TabsTrigger>
                  <TabsTrigger value="submissions">
                    <List className="w-4 h-4 mr-2" />
                    Submissions
                  </TabsTrigger>
                  <TabsTrigger value="categories">
                    <Palette className="w-4 h-4 mr-2" />
                    Categories
                  </TabsTrigger>
                  <TabsTrigger value="settings">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="ctfs">
                  <CtfEventsTab />
                </TabsContent>
                <TabsContent value="challenges">
                  <ChallengesTab />
                </TabsContent>
                <TabsContent value="serial">
                  <SerialChallengesTab />
                </TabsContent>
                <TabsContent value="containers">
                  <ContainersTab />
                </TabsContent>
                <TabsContent value="users">
                  <UsersTab />
                </TabsContent>
                <TabsContent value="submissions">
                  <SubmissionsTab />
                </TabsContent>
                <TabsContent value="categories">
                  <CategoriesTab />
                </TabsContent>
                <TabsContent value="settings">
                  <SettingsTab />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
