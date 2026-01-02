"use client"

import * as React from "react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CalendarIcon, Clock } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

export interface DateTimePickerProps {
  value?: Date | string
  onChange?: (date: Date) => void
  placeholder?: string
  className?: string
}

export function DateTimePicker({ value, onChange, placeholder = "Pick a date and time", className }: DateTimePickerProps) {
  // Use value prop directly instead of internal state
  const date = value ? (typeof value === 'string' ? new Date(value) : value) : undefined

  const [time, setTime] = React.useState<string>(
    date ? format(date, "HH:mm") : "12:00"
  )
  const [open, setOpen] = React.useState(false)

  // Update time when date prop changes
  React.useEffect(() => {
    if (date) {
      setTime(format(date, "HH:mm"))
    }
  }, [date])

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const [hours, minutes] = time.split(':').map(Number)
      const newDate = new Date(selectedDate)
      newDate.setHours(hours, minutes)
      onChange?.(newDate)
    }
  }

  const handleTimeChange = (newTime: string) => {
    setTime(newTime)
    if (date) {
      const [hours, minutes] = newTime.split(':').map(Number)
      const newDate = new Date(date)
      newDate.setHours(hours, minutes)
      onChange?.(newDate)
    }
  }

  const handleNowClick = () => {
    const now = new Date()
    setTime(format(now, "HH:mm"))
    onChange?.(now)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal bg-secondary border-white/10",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP 'at' HH:mm") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
        <div className="p-5 space-y-4">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            initialFocus
            className="w-full"
          />
          <div className="border-t border-white/10 pt-4 space-y-3">
            <Label className="text-sm font-medium">Time</Label>
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Input
                type="time"
                value={time}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="flex-1 bg-secondary border-white/10"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleNowClick}
              className="flex-1"
            >
              Now
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
