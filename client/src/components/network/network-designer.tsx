import { useCallback, useState, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
} from "reactflow";
import "reactflow/dist/style.css";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Save, X, Monitor, Router, Network, Container } from "lucide-react";
import { VMNode } from "./nodes/vm-node";
import { RouterNode } from "./nodes/router-node";
import { SwitchNode } from "./nodes/switch-node";
import { ZoneNode } from "./nodes/zone-node";
import { DeviceConfigPanel } from "./device-config-panel";

type NetworkProp = {
  id: number;
  name: string;
  graphData: string;
};

type Props = {
  network: NetworkProp;
  onClose: () => void;
};

const nodeTypes: NodeTypes = {
  vm: VMNode,
  router: RouterNode,
  switch: SwitchNode,
  zone: ZoneNode,
};

let nodeId = 0;
const getNodeId = () => `node_${nodeId++}`;

export function NetworkDesigner({ network, onClose }: Props) {
  const { toast } = useToast();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load graph data on mount
  useEffect(() => {
    try {
      const graphData = JSON.parse(network.graphData);
      if (graphData.nodes) {
        // Ensure zones have proper z-index when loading
        const nodesWithZIndex = graphData.nodes.map((node: Node) => ({
          ...node,
          zIndex: node.type === "zone" ? -1 : node.zIndex ?? 1,
        }));
        setNodes(nodesWithZIndex);
      }
      if (graphData.edges) setEdges(graphData.edges);

      // Update nodeId counter to prevent ID collisions
      if (graphData.nodes && graphData.nodes.length > 0) {
        const maxId = Math.max(
          ...graphData.nodes
            .map((n: Node) => parseInt(n.id.replace("node_", "")))
            .filter((id: number) => !isNaN(id))
        );
        nodeId = maxId + 1;
      }
    } catch (error) {
      console.error("Failed to parse graph data:", error);
    }
  }, [network.graphData, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node);
    },
    []
  );

  const handleAddNode = (type: string) => {
    const newNode: Node = {
      id: getNodeId(),
      type,
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: {
        label: `${type.charAt(0).toUpperCase() + type.slice(1)} ${nodeId}`,
        config: {
          dockerImage: "",
          services: "",
          ports: "",
          credentials: "",
          interfaces: "",
        },
      },
    };

    if (type === "zone") {
      newNode.style = {
        width: 400,
        height: 300,
        background: "rgba(255, 255, 255, 0.05)",
        border: "2px dashed rgba(255, 255, 255, 0.2)",
      };
      newNode.zIndex = -1; // Keep zones in the background
    } else {
      newNode.zIndex = 1; // Keep regular nodes above zones
    }

    setNodes((nds) => [...nds, newNode]);
  };

  const handleUpdateNode = (nodeId: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );
    // Update selected node to reflect changes
    setSelectedNode((sel) =>
      sel && sel.id === nodeId ? { ...sel, data: { ...sel.data, ...newData } } : sel
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/networks/${network.id}/graph`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nodes, edges }),
      });

      if (!res.ok) throw new Error("Failed to save network");

      toast({ title: "Network saved successfully" });
    } catch (error) {
      toast({
        title: "Failed to save network",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-orbitron font-bold">{network.name}</h2>
          <p className="text-sm text-muted-foreground">Network Topology Designer</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2">
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Toolbar */}
        <div className="w-64 border-r bg-card p-4 overflow-y-auto">
          <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider text-muted-foreground">
            Add Devices
          </h3>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleAddNode("vm")}
            >
              <Monitor className="w-4 h-4 mr-2" />
              VM / Host
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleAddNode("router")}
            >
              <Router className="w-4 h-4 mr-2" />
              Router
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleAddNode("switch")}
            >
              <Network className="w-4 h-4 mr-2" />
              Switch
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleAddNode("zone")}
            >
              <Container className="w-4 h-4 mr-2" />
              Zone / Container
            </Button>
          </div>

          <div className="mt-6 p-4 border rounded-lg bg-background">
            <h4 className="text-xs font-semibold mb-2 text-muted-foreground">Instructions</h4>
            <ul className="text-xs space-y-2 text-muted-foreground">
              <li>• Click devices to add them to the canvas</li>
              <li>• Drag devices to reposition them</li>
              <li>• Click a device to configure it</li>
              <li>• Drag from one device to another to create connections</li>
              <li>• Use zones to group devices visually</li>
            </ul>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            elevateEdgesOnSelect
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        {/* Config Panel */}
        {selectedNode && (
          <DeviceConfigPanel
            node={selectedNode}
            onUpdate={(data) => handleUpdateNode(selectedNode.id, data)}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  );
}
