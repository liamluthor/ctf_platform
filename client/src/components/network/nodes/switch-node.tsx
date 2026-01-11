import { Handle, Position, type NodeProps } from "reactflow";
import { Network } from "lucide-react";

export function SwitchNode({ data }: NodeProps) {
  return (
    <div className="px-4 py-3 rounded-lg border-2 border-purple-500 bg-background/95 backdrop-blur min-w-[120px] shadow-lg">
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-purple-500" />
      <div className="flex items-center gap-2">
        <div className="p-2 rounded bg-purple-500/10 border border-purple-500/20">
          <Network className="w-4 h-4 text-purple-500" />
        </div>
        <div>
          <div className="font-semibold text-sm">{data.label}</div>
          <div className="text-xs text-muted-foreground">Switch</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-purple-500" />
    </div>
  );
}
