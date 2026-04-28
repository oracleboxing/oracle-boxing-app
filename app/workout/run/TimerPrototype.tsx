"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { RunnableWorkout } from "@/features/workouts/runner";

type TimerPrototypeProps = {
  workout: RunnableWorkout;
  dataSource: "supabase" | "fallback";
  notice?: string;
};

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TimerPrototype({ workout, dataSource, notice }: TimerPrototypeProps) {
  const blocks = useMemo(() => workout.blocks, [workout.blocks]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(blocks[0]?.durationSeconds ?? 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const currentBlock = blocks[currentIndex];
  const progressPercent = currentBlock
    ? ((currentBlock.durationSeconds - timeLeft) / currentBlock.durationSeconds) * 100
    : 100;

  useEffect(() => {
    setCurrentIndex(0);
    setTimeLeft(blocks[0]?.durationSeconds ?? 0);
    setIsPlaying(false);
    setIsFinished(false);
  }, [blocks]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((t) => t - 1);
      }, 1000);
    } else if (isPlaying && timeLeft === 0) {
      if (currentIndex < blocks.length - 1) {
        const nextIdx = currentIndex + 1;
        setCurrentIndex(nextIdx);
        setTimeLeft(blocks[nextIdx].durationSeconds);
      } else {
        setIsFinished(true);
        setIsPlaying(false);
      }
    }
    return () => clearInterval(interval);
  }, [blocks, isPlaying, timeLeft, currentIndex]);

  const togglePlay = () => setIsPlaying(!isPlaying);

  const restartWorkout = () => {
    setIsFinished(false);
    setCurrentIndex(0);
    setTimeLeft(blocks[0]?.durationSeconds ?? 0);
    setIsPlaying(false);
  };

  const nextBlock = () => {
    if (currentIndex < blocks.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setTimeLeft(blocks[nextIdx].durationSeconds);
    } else {
      setIsFinished(true);
      setIsPlaying(false);
    }
  };

  const prevBlock = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      setTimeLeft(blocks[prevIdx].durationSeconds);
      setIsFinished(false);
    } else {
      setTimeLeft(blocks[0]?.durationSeconds ?? 0);
    }
  };

  if (!currentBlock) {
    return (
      <Card className="mt-12 border border-gray-200 p-8 text-center shadow-sm">
        <h2 className="mb-4 text-2xl font-bold">No timed blocks yet</h2>
        <p className="text-gray-600">This workout needs at least one timed block before it can run.</p>
      </Card>
    );
  }

  if (isFinished) {
    return (
      <Card className="mt-12 border border-gray-200 p-8 text-center shadow-sm">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">{workout.title}</p>
        <h2 className="mb-4 text-2xl font-bold">Workout Complete</h2>
        <p className="mb-8 text-gray-600">Good work. Clean rounds beat messy heroics.</p>
        <Button onClick={restartWorkout} variant="primary" className="w-full">
          Restart Workout
        </Button>
      </Card>
    );
  }

  const bgColor = currentBlock.type === "work" ? "bg-red-50 text-red-900 border-red-200"
    : currentBlock.type === "rest" ? "bg-blue-50 text-blue-900 border-blue-200"
    : "bg-yellow-50 text-yellow-900 border-yellow-200";

  const progressColor = currentBlock.type === "work" ? "bg-red-500"
    : currentBlock.type === "rest" ? "bg-blue-500"
    : "bg-yellow-500";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Workout runner</p>
            <h2 className="mt-1 text-xl font-bold text-gray-950">{workout.title}</h2>
            {workout.summary && <p className="mt-1 text-sm leading-6 text-gray-600">{workout.summary}</p>}
          </div>
          <Badge variant={dataSource === "supabase" ? "default" : "outline"} className="shrink-0 uppercase tracking-wider">
            {dataSource === "supabase" ? "Live" : "Fallback"}
          </Badge>
        </div>
        {notice && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{notice}</p>}
      </div>

      <div className="mb-8 flex h-2 gap-1">
        {blocks.map((block, idx) => {
          let bg = "bg-gray-200";
          if (idx < currentIndex) bg = block.type === "work" ? "bg-red-500" : block.type === "rest" ? "bg-blue-500" : "bg-yellow-500";
          if (idx === currentIndex) bg = "bg-gray-400";
          return <div key={block.id} className={`flex-1 rounded-full ${bg}`} />;
        })}
      </div>

      <div className={`rounded-3xl border p-8 text-center shadow-sm transition-colors duration-500 ${bgColor}`}>
        <div className="mb-4">
          <Badge variant={currentBlock.type === "work" ? "red" : currentBlock.type === "rest" ? "default" : "outline"} className="px-3 py-1 text-xs uppercase tracking-wider">
            {currentBlock.type}
          </Badge>
        </div>

        <h2 className="mb-2 text-2xl font-bold">{currentBlock.title}</h2>

        <div className="my-8 font-mono text-7xl font-black tracking-tighter">
          {formatTime(timeLeft)}
        </div>

        <div className="mb-8 h-3 w-full overflow-hidden rounded-full bg-white/50 shadow-inner">
          <div
            className={`h-full ${progressColor} transition-all duration-1000 ease-linear`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="mb-8 space-y-2 rounded-xl bg-white/40 p-4 text-left">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider opacity-70">Focus Points</p>
          <ul className="space-y-2">
            {currentBlock.instructions.map((inst, i) => (
              <li key={`${currentBlock.id}-${i}`} className="flex items-start gap-2">
                <span className="mt-1 opacity-50">•</span>
                <span className="text-lg font-medium">{inst}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Button onClick={prevBlock} variant="secondary" className="flex h-16 w-16 items-center justify-center rounded-full shadow-sm" aria-label="Previous block">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </Button>

        <Button onClick={togglePlay} variant="primary" className="h-20 flex-1 rounded-2xl text-xl shadow-md">
          {isPlaying ? "PAUSE" : "START"}
        </Button>

        <Button onClick={nextBlock} variant="secondary" className="flex h-16 w-16 items-center justify-center rounded-full shadow-sm" aria-label="Next block">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </Button>
      </div>

      {currentIndex < blocks.length - 1 && (
        <div className="mt-8 flex items-center justify-between rounded-xl border bg-gray-50 p-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Up Next</p>
            <p className="font-medium">{blocks[currentIndex + 1].title}</p>
          </div>
          <div className="font-mono text-sm text-gray-500">
            {formatTime(blocks[currentIndex + 1].durationSeconds)}
          </div>
        </div>
      )}
    </div>
  );
}
