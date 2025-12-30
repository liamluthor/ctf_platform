import { useCountdown } from "@/hooks/use-countdown";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  targetDate: Date | string;
  label?: string;
  className?: string;
}

export function CountdownTimer({ targetDate, label, className }: CountdownTimerProps) {
  const { days, hours, minutes, seconds, isExpired } = useCountdown(targetDate);

  if (isExpired) {
    return (
      <div className={cn("text-center", className)}>
        <p className="text-muted-foreground font-tech uppercase text-sm">{label || "Time"}</p>
        <p className="text-2xl font-orbitron font-bold text-primary">Expired</p>
      </div>
    );
  }

  return (
    <div className={cn("text-center", className)}>
      {label && (
        <p className="text-muted-foreground font-tech uppercase text-sm mb-2">{label}</p>
      )}
      <div className="flex items-center justify-center gap-2">
        <TimeUnit value={days} label="Days" />
        <Separator />
        <TimeUnit value={hours} label="Hours" />
        <Separator />
        <TimeUnit value={minutes} label="Min" />
        <Separator />
        <TimeUnit value={seconds} label="Sec" />
      </div>
    </div>
  );
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="bg-card border border-white/10 rounded-lg px-3 py-2 min-w-[3rem]">
        <span className="text-2xl font-orbitron font-bold tabular-nums">
          {value.toString().padStart(2, "0")}
        </span>
      </div>
      <span className="text-xs text-muted-foreground mt-1 font-tech uppercase">
        {label}
      </span>
    </div>
  );
}

function Separator() {
  return <span className="text-2xl font-orbitron text-muted-foreground">:</span>;
}
