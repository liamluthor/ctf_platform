import { Handle, Position, type NodeProps } from "reactflow";
import { Monitor } from "lucide-react";

export function VMNode({ data }: NodeProps) {
  return (
    <div className="px-4 py-3 rounded-lg border-2 border-blue-500 bg-background/95 backdrop-blur min-w-[120px] shadow-lg">
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-blue-500" />
      <div className="flex items-center gap-2">
        <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20">
          <Monitor className="w-4 h-4 text-blue-500" />
        </div>
        <div>
          <div className="font-semibold text-sm">{data.label}</div>
          <div className="text-xs text-muted-foreground">VM/Host</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-blue-500" />
    </div>
  );
}
