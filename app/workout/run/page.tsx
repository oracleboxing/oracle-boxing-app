import { loadWorkoutRunnerData } from '@/features/workouts/runner';
import { TimerPrototype } from './TimerPrototype';

export const dynamic = 'force-dynamic';

type TimerPrototypePageProps = {
  searchParams?: Promise<{
    slug?: string;
  }>;
};

export default async function TimerPrototypePage({ searchParams }: TimerPrototypePageProps) {
  const resolvedSearchParams = await searchParams;
  const { workout, dataSource, notice } = await loadWorkoutRunnerData(resolvedSearchParams?.slug);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Oracle Boxing</p>
          <h1 className="text-xl font-bold tracking-tight">Workout Runner Prototype</h1>
        </div>
      </header>
      <main className="mx-auto max-w-md p-4">
        <TimerPrototype workout={workout} dataSource={dataSource} notice={notice} />
      </main>
    </div>
  );
}
