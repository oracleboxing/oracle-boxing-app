"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

// Mock Data
type WorkoutBlock = {
  id: string;
  type: "prep" | "work" | "rest";
  durationSeconds: number;
  title: string;
  instructions: string[];
};

const MOCK_WORKOUT: WorkoutBlock[] = [
  {
    id: "b1",
    type: "prep",
    durationSeconds: 10,
    title: "Get Ready",
    instructions: ["Wrap up", "Gloves on"],
  },
  {
    id: "b2",
    type: "work",
    durationSeconds: 180,
    title: "Round 1: Basics",
    instructions: ["Jab - Cross", "Keep hands up", "Move after every combo"],
  },
  {
    id: "b3",
    type: "rest",
    durationSeconds: 60,
    title: "Rest",
    instructions: ["Breathe deeply", "Stay loose"],
  },
  {
    id: "b4",
    type: "work",
    durationSeconds: 180,
    title: "Round 2: Adding the Hook",
    instructions: ["Jab - Cross - Lead Hook", "Pivot on the hook", "Reset to guard instantly"],
  },
  {
    id: "b5",
    type: "rest",
    durationSeconds: 60,
    title: "Rest",
    instructions: ["Focus on heart rate recovery"],
  },
  {
    id: "b6",
    type: "work",
    durationSeconds: 180,
    title: "Round 3: Burnout",
    instructions: ["1-2s continuous", "Power shots", "Don't drop the pace"],
  }
];

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TimerPrototype() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(MOCK_WORKOUT[0].durationSeconds);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const currentBlock = MOCK_WORKOUT[currentIndex];
  const progressPercent = currentBlock 
    ? ((currentBlock.durationSeconds - timeLeft) / currentBlock.durationSeconds) * 100 
    : 100;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((t) => t - 1);
      }, 1000);
    } else if (isPlaying && timeLeft === 0) {
      // Move to next block
      if (currentIndex < MOCK_WORKOUT.length - 1) {
        const nextIdx = currentIndex + 1;
        setCurrentIndex(nextIdx);
        setTimeLeft(MOCK_WORKOUT[nextIdx].durationSeconds);
      } else {
        setIsFinished(true);
        setIsPlaying(false);
      }
    }
    return () => clearInterval(interval);
  }, [isPlaying, timeLeft, currentIndex]);

  const togglePlay = () => setIsPlaying(!isPlaying);

  const nextBlock = () => {
    if (currentIndex < MOCK_WORKOUT.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setTimeLeft(MOCK_WORKOUT[nextIdx].durationSeconds);
    } else {
      setIsFinished(true);
      setIsPlaying(false);
    }
  };

  const prevBlock = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      setTimeLeft(MOCK_WORKOUT[prevIdx].durationSeconds);
      setIsFinished(false);
    } else {
      setTimeLeft(MOCK_WORKOUT[0].durationSeconds);
    }
  };

  if (isFinished) {
    return (
      <Card className="p-8 text-center mt-12 shadow-sm border border-gray-200">
        <h2 className="text-2xl font-bold mb-4">Workout Complete</h2>
        <p className="text-gray-600 mb-8">Great job! You crushed it today.</p>
        <Button onClick={() => {
          setIsFinished(false);
          setCurrentIndex(0);
          setTimeLeft(MOCK_WORKOUT[0].durationSeconds);
        }} variant="primary" className="w-full">
          Restart Prototype
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
      {/* Session Progress Overview */}
      <div className="flex gap-1 h-2 mb-8">
        {MOCK_WORKOUT.map((block, idx) => {
          let bg = "bg-gray-200";
          if (idx < currentIndex) bg = block.type === "work" ? "bg-red-500" : block.type === "rest" ? "bg-blue-500" : "bg-yellow-500";
          if (idx === currentIndex) bg = "bg-gray-400";
          return <div key={block.id} className={`flex-1 rounded-full ${bg}`} />
        })}
      </div>

      {/* Main Timer Card */}
      <div className={`rounded-3xl p-8 border text-center shadow-sm transition-colors duration-500 ${bgColor}`}>
        <div className="mb-4">
          <Badge variant={currentBlock.type === "work" ? "red" : currentBlock.type === "rest" ? "default" : "outline"} className="uppercase tracking-wider px-3 py-1 text-xs">
            {currentBlock.type}
          </Badge>
        </div>
        
        <h2 className="text-2xl font-bold mb-2">{currentBlock.title}</h2>
        
        <div className="text-7xl font-black tracking-tighter my-8 font-mono">
          {formatTime(timeLeft)}
        </div>

        {/* Custom Progress Bar since our UI component might not take color props directly easily, we wrap it or use a raw div */}
        <div className="h-3 w-full bg-white/50 rounded-full overflow-hidden mb-8 shadow-inner">
          <div 
            className={`h-full ${progressColor} transition-all duration-1000 ease-linear`} 
            style={{ width: `${progressPercent}%` }} 
          />
        </div>

        <div className="space-y-2 mb-8 text-left bg-white/40 p-4 rounded-xl">
          <p className="font-semibold text-sm uppercase tracking-wider mb-3 opacity-70">Focus Points</p>
          <ul className="space-y-2">
            {currentBlock.instructions.map((inst, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 opacity-50">•</span>
                <span className="font-medium text-lg">{inst}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <Button onClick={prevBlock} variant="secondary" className="h-16 w-16 rounded-full flex items-center justify-center shadow-sm" aria-label="Previous">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Button>
        
        <Button onClick={togglePlay} variant="primary" className="h-20 flex-1 rounded-2xl text-xl shadow-md">
          {isPlaying ? "PAUSE" : "START"}
        </Button>
        
        <Button onClick={nextBlock} variant="secondary" className="h-16 w-16 rounded-full flex items-center justify-center shadow-sm" aria-label="Next">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Button>
      </div>
      
      {/* Up Next Preview */}
      {currentIndex < MOCK_WORKOUT.length - 1 && (
        <div className="mt-8 p-4 bg-gray-50 border rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Up Next</p>
            <p className="font-medium">{MOCK_WORKOUT[currentIndex + 1].title}</p>
          </div>
          <div className="text-sm font-mono text-gray-500">
            {formatTime(MOCK_WORKOUT[currentIndex + 1].durationSeconds)}
          </div>
        </div>
      )}
    </div>
  );
}
