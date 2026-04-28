import { TimerPrototype } from './TimerPrototype';

export default function TimerPrototypePage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white border-b sticky top-0 z-10 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Workout Prototype</h1>
      </header>
      <main className="max-w-md mx-auto p-4">
        <TimerPrototype />
      </main>
    </div>
  );
}
