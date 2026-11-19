"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Repeat, X, Check, Calendar } from "lucide-react";
import {
  RECURRENCE_FREQUENCIES,
  type RecurrenceFrequencyType,
} from "@/lib/validations/recurrence";

export interface RecurrenceConfig {
  frequency: RecurrenceFrequencyType;
  interval: number;
  daysOfWeek?: number[];
  startDate: string;
  endDate?: string | null;
  maxOccurrences?: number | null;
}

interface RecurrenceConfigDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialStartDate?: string;
  initialConfig?: RecurrenceConfig | null;
  onSave: (config: RecurrenceConfig | null) => void;
}

const WEEKDAYS = [
  { day: 1, label: "Mon", short: "M" },
  { day: 2, label: "Tue", short: "T" },
  { day: 3, label: "Wed", short: "W" },
  { day: 4, label: "Thu", short: "T" },
  { day: 5, label: "Fri", short: "F" },
  { day: 6, label: "Sat", short: "S" },
  { day: 7, label: "Sun", short: "S" },
];

export function RecurrenceConfigDialog({
  isOpen,
  onOpenChange,
  initialStartDate,
  initialConfig,
  onSave,
}: RecurrenceConfigDialogProps) {
  const todayIso = new Date().toISOString().slice(0, 10);

  const [frequency, setFrequency] = React.useState<RecurrenceFrequencyType>(
    initialConfig?.frequency || "WEEKLY"
  );
  const [interval, setInterval] = React.useState<number>(
    initialConfig?.interval || 1
  );
  const [daysOfWeek, setDaysOfWeek] = React.useState<number[]>(
    initialConfig?.daysOfWeek || [1]
  );
  const [startDate, setStartDate] = React.useState<string>(
    initialConfig?.startDate || initialStartDate || todayIso
  );
  const [endType, setEndType] = React.useState<"NEVER" | "AFTER" | "ON_DATE">(
    initialConfig?.endDate
      ? "ON_DATE"
      : initialConfig?.maxOccurrences
      ? "AFTER"
      : "NEVER"
  );
  const [endDate, setEndDate] = React.useState<string>(
    initialConfig?.endDate || ""
  );
  const [maxOccurrences, setMaxOccurrences] = React.useState<number>(
    initialConfig?.maxOccurrences || 10
  );

  React.useEffect(() => {
    if (isOpen) {
      if (initialConfig) {
        setFrequency(initialConfig.frequency);
        setInterval(initialConfig.interval);
        setDaysOfWeek(initialConfig.daysOfWeek || [1]);
        setStartDate(initialConfig.startDate || initialStartDate || todayIso);
        if (initialConfig.endDate) {
          setEndType("ON_DATE");
          setEndDate(initialConfig.endDate);
        } else if (initialConfig.maxOccurrences) {
          setEndType("AFTER");
          setMaxOccurrences(initialConfig.maxOccurrences);
        } else {
          setEndType("NEVER");
        }
      } else {
        setFrequency("WEEKLY");
        setInterval(1);
        setDaysOfWeek([1]);
        setStartDate(initialStartDate || todayIso);
        setEndType("NEVER");
      }
    }
  }, [isOpen, initialConfig, initialStartDate, todayIso]);

  if (!isOpen) return null;

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev; // Keep at least one day
        return prev.filter((d) => d !== day);
      } else {
        return [...prev, day].sort((a, b) => a - b);
      }
    });
  };

  const handleApply = () => {
    const config: RecurrenceConfig = {
      frequency,
      interval: Math.max(1, interval),
      daysOfWeek: frequency === "WEEKLY" ? daysOfWeek : undefined,
      startDate: startDate || todayIso,
      endDate: endType === "ON_DATE" && endDate ? endDate : null,
      maxOccurrences: endType === "AFTER" ? Math.max(1, maxOccurrences) : null,
    };
    onSave(config);
    onOpenChange(false);
  };

  const handleClear = () => {
    onSave(null);
    onOpenChange(false);
  };

  // Human readable summary
  const getSummary = () => {
    let text = "Repeats ";
    if (interval === 1) {
      if (frequency === "DAILY") text += "daily";
      else if (frequency === "WEEKLY") text += "weekly";
      else if (frequency === "MONTHLY") text += "monthly";
      else if (frequency === "YEARLY") text += "yearly";
      else text += "custom";
    } else {
      text += `every ${interval} `;
      if (frequency === "DAILY") text += "days";
      else if (frequency === "WEEKLY") text += "weeks";
      else if (frequency === "MONTHLY") text += "months";
      else if (frequency === "YEARLY") text += "years";
      else text += "intervals";
    }

    if (frequency === "WEEKLY" && daysOfWeek.length > 0) {
      const dayNames = daysOfWeek
        .map((d) => WEEKDAYS.find((w) => w.day === d)?.label)
        .filter(Boolean)
        .join(", ");
      text += ` on ${dayNames}`;
    }

    if (endType === "ON_DATE" && endDate) {
      text += ` until ${endDate}`;
    } else if (endType === "AFTER" && maxOccurrences) {
      text += `, up to ${maxOccurrences} occurrences`;
    }

    return text;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-xl border border-neutral-200 bg-white p-5 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-purple-50 p-1.5 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
              <Repeat className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Repeat Schedule
              </h3>
              <p className="text-xs text-neutral-500">
                Configure recurrence frequency and rules
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 py-4 text-xs">
          {/* Frequency & Interval */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) =>
                  setFrequency(e.target.value as RecurrenceFrequencyType)
                }
                className="w-full h-8 rounded border border-neutral-200 bg-white px-2 shadow-2xs dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
              >
                {RECURRENCE_FREQUENCIES.map((freq) => (
                  <option key={freq} value={freq}>
                    {freq.charAt(0) + freq.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Repeat Every
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={frequency === "DAILY" ? 365 : frequency === "WEEKLY" ? 52 : 60}
                  value={interval}
                  onChange={(e) => setInterval(Number(e.target.value))}
                  className="h-8"
                />
                <span className="text-neutral-500">
                  {frequency === "DAILY"
                    ? "days"
                    : frequency === "WEEKLY"
                    ? "weeks"
                    : frequency === "MONTHLY"
                    ? "months"
                    : frequency === "YEARLY"
                    ? "years"
                    : "intervals"}
                </span>
              </div>
            </div>
          </div>

          {/* Weekdays Picker for WEEKLY */}
          {frequency === "WEEKLY" && (
            <div>
              <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                Repeat on
              </label>
              <div className="flex gap-1">
                {WEEKDAYS.map((w) => {
                  const isSelected = daysOfWeek.includes(w.day);
                  return (
                    <button
                      key={w.day}
                      type="button"
                      onClick={() => toggleDay(w.day)}
                      className={`h-7 w-8 rounded text-[11px] font-medium transition-colors ${
                        isSelected
                          ? "bg-purple-600 text-white dark:bg-purple-500"
                          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
                      }`}
                      title={w.label}
                    >
                      {w.short}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Start Date */}
          <div>
            <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Start Date
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8"
            />
          </div>

          {/* Ends Condition */}
          <div className="space-y-2">
            <label className="block font-medium text-neutral-700 dark:text-neutral-300">
              Ends
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="endType"
                  checked={endType === "NEVER"}
                  onChange={() => setEndType("NEVER")}
                  className="text-purple-600"
                />
                <span>Never</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="endType"
                  checked={endType === "AFTER"}
                  onChange={() => setEndType("AFTER")}
                  className="text-purple-600"
                />
                <span className="flex items-center gap-2">
                  <span>After</span>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={maxOccurrences}
                    disabled={endType !== "AFTER"}
                    onChange={(e) => setMaxOccurrences(Number(e.target.value))}
                    className="h-7 w-16 text-center"
                  />
                  <span>occurrences</span>
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="endType"
                  checked={endType === "ON_DATE"}
                  onChange={() => setEndType("ON_DATE")}
                  className="text-purple-600"
                />
                <span className="flex items-center gap-2">
                  <span>On</span>
                  <Input
                    type="date"
                    value={endDate}
                    disabled={endType !== "ON_DATE"}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-7 w-36"
                  />
                </span>
              </label>
            </div>
          </div>

          {/* Schedule Summary Banner */}
          <div className="rounded-md bg-purple-50/60 p-2.5 text-purple-900 border border-purple-200/50 dark:bg-purple-950/30 dark:text-purple-200 dark:border-purple-800/40 text-[11px] leading-relaxed">
            <span className="font-semibold">Summary:</span> {getSummary()}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-neutral-100 dark:border-neutral-800">
          {initialConfig ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 h-8"
            >
              Remove Repeat
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              className="text-xs h-8 gap-1 bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Apply</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
