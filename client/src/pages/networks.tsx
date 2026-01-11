import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Network as NetworkIcon, Activity } from "lucide-react";
import { NetworkDesigner } from "@/components/network/network-designer";

type Network = {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  graphData: string;
  createdAt: string;
  updatedAt: string;
  authorId: string | null;
};

export default function NetworksPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null);
  const [designingNetwork, setDesigningNetwork] = useState<Network | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "" });

  // Fetch all networks
  const { data: networks = [], isLoading } = useQuery<Network[]>({
    queryKey: ["/api/admin/networks"],
  });

  // Create network mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const res = await fetch("/api/admin/networks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create network");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/networks"] });
      setCreateDialogOpen(false);
      setFormData({ name: "", description: "" });
      toast({ title: "Network created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create network", variant: "destructive" });
    },
  });

  // Update network mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: { name: string; description: string };
    }) => {
      const res = await fetch(`/api/admin/networks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update network");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/networks"] });
      setEditDialogOpen(false);
      setSelectedNetwork(null);
      toast({ title: "Network updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update network", variant: "destructive" });
    },
  });

  // Delete network mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/networks/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete network");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/networks"] });
      setDeleteDialogOpen(false);
      setSelectedNetwork(null);
      toast({ title: "Network deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete network", variant: "destructive" });
    },
  });

  // Activate network mutation
  const activateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/networks/${id}/activate`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to activate network");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/networks"] });
      toast({ title: "Network activated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to activate network", variant: "destructive" });
    },
  });

  const handleCreate = () => {
    setFormData({ name: "", description: "" });
    setCreateDialogOpen(true);
  };

  const handleEdit = (network: Network) => {
    setSelectedNetwork(network);
    setFormData({ name: network.name, description: network.description || "" });
    setEditDialogOpen(true);
  };

  const handleDelete = (network: Network) => {
    setSelectedNetwork(network);
    setDeleteDialogOpen(true);
  };

  const handleDesign = (network: Network) => {
    setDesigningNetwork(network);
  };

  const handleActivate = (network: Network) => {
    activateMutation.mutate(network.id);
  };

  const handleCloseDesigner = () => {
    setDesigningNetwork(null);
    queryClient.invalidateQueries({ queryKey: ["/api/admin/networks"] });
  };

  // If designing a network, show the designer
  if (designingNetwork) {
    return <NetworkDesigner network={designingNetwork} onClose={handleCloseDesigner} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-orbitron font-bold mb-2">CTFNet - Network Designer</h1>
            <p className="text-muted-foreground">
              Design and manage network topologies for CTF deployments
            </p>
          </div>
          <Button onClick={handleCreate} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Network
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading networks...</div>
        ) : networks.length === 0 ? (
          <div className="text-center py-12">
            <NetworkIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">No networks created yet</p>
            <Button onClick={handleCreate}>Create your first network</Button>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {networks.map((network) => (
                  <TableRow key={network.id}>
                    <TableCell className="font-medium">{network.name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-md truncate">
                      {network.description || "-"}
                    </TableCell>
                    <TableCell>
                      {network.isActive ? (
                        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                          <Activity className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(network.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDesign(network)}
                        >
                          Design
                        </Button>
                        {!network.isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleActivate(network)}
                          >
                            Activate
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(network)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(network)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Network</DialogTitle>
            <DialogDescription>
              Create a new network topology design for your CTF deployment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Production Network, Test Environment"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the purpose of this network..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.name.trim() || createMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Network</DialogTitle>
            <DialogDescription>Update the network name and description.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedNetwork &&
                updateMutation.mutate({ id: selectedNetwork.id, data: formData })
              }
              disabled={!formData.name.trim() || updateMutation.isPending}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Network</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedNetwork?.name}"? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedNetwork && deleteMutation.mutate(selectedNetwork.id)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
