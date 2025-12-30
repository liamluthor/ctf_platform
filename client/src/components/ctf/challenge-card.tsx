import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Globe,
  Lock,
  Terminal,
  Cpu,
  Search,
  Puzzle,
  Eye,
  CheckCircle2,
  Flame,
} from "lucide-react";

interface ChallengeCardProps {
  challenge: {
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
  };
  onClick: () => void;
  index: number;
  isFirstBlood?: boolean;
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

export function ChallengeCard({ challenge, onClick, index, isFirstBlood }: ChallengeCardProps) {
  const Icon = challenge.category?.icon
    ? iconMap[challenge.category.icon] || Terminal
    : Terminal;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
    >
      <Card
        className={cn(
          "bg-card border-white/5 cursor-pointer transition-all hover:border-primary/30 relative overflow-hidden",
          challenge.solved && "border-green-500/30 challenge-solved"
        )}
        onClick={onClick}
      >
        {isFirstBlood && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 first-blood">
              <Flame className="w-3 h-3 mr-1" />
              First Blood
            </Badge>
          </div>
        )}

        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Category Icon */}
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{
                backgroundColor: `${challenge.category?.color || "#8B1538"}20`,
                borderColor: `${challenge.category?.color || "#8B1538"}40`,
              }}
            >
              <Icon
                className="w-5 h-5"
                style={{ color: challenge.category?.color || "#8B1538" }}
              />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-orbitron font-bold text-sm truncate">
                  {challenge.name}
                </h3>
                {challenge.solved && (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                )}
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-xs"
                  style={{
                    borderColor: `${challenge.category?.color || "#8B1538"}40`,
                    color: challenge.category?.color || "#8B1538",
                  }}
                >
                  {challenge.category?.name || "Misc"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {challenge.solveCount} solve{challenge.solveCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Points */}
            <div className="text-right shrink-0">
              <div className="font-orbitron font-bold text-lg text-primary">
                {challenge.points}
              </div>
              <div className="text-xs text-muted-foreground">pts</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
