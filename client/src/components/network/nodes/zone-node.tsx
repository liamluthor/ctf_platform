import { type NodeProps } from "reactflow";

export function ZoneNode({ data }: NodeProps) {
  return (
    <div className="w-full h-full border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/5 backdrop-blur p-4">
      <div className="text-sm font-semibold text-muted-foreground mb-2">{data.label}</div>
      <div className="text-xs text-muted-foreground/70">Zone / Container</div>
    </div>
  );
}
