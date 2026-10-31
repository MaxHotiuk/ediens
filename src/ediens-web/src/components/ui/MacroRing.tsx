import { cn } from '../../lib/utils';
import { Flame } from 'lucide-react';

export interface MacroItemValue {
  current: number;
  target: number;
  unit?: string;
}

export interface MacroRingProps {
  calories: MacroItemValue;
  protein: MacroItemValue;
  fat: MacroItemValue;
  carbs: MacroItemValue;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showLegend?: boolean;
}

export function MacroRing({
  calories,
  protein,
  fat,
  carbs,
  size = 180,
  strokeWidth = 10,
  className,
  showLegend = true,
}: MacroRingProps) {
  const center = size / 2;
  const gap = 3;

  // Concentric circle radii
  const rCalories = center - strokeWidth / 2 - 4;
  const rProtein = rCalories - strokeWidth - gap;
  const rFat = rProtein - strokeWidth - gap;
  const rCarbs = rFat - strokeWidth - gap;

  function calculateCircle(radius: number, current: number, target: number) {
    const circumference = 2 * Math.PI * radius;
    const progress = target > 0 ? Math.min(Math.max(current / target, 0), 1) : 0;
    const strokeDashoffset = circumference * (1 - progress);
    const percentage = Math.round((current / (target || 1)) * 100);
    return { circumference, strokeDashoffset, percentage };
  }

  const calData = calculateCircle(rCalories, calories.current, calories.target);
  const proData = calculateCircle(rProtein, protein.current, protein.target);
  const fatData = calculateCircle(rFat, fat.current, fat.target);
  const carbData = calculateCircle(rCarbs, carbs.current, carbs.target);

  const remainingCalories = Math.max(0, calories.target - calories.current);

  return (
    <div className={cn('flex flex-col items-center select-none', className)}>
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background tracks */}
          <circle
            cx={center}
            cy={center}
            r={rCalories}
            fill="transparent"
            stroke="#27272a"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={center}
            cy={center}
            r={rProtein}
            fill="transparent"
            stroke="#27272a"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={center}
            cy={center}
            r={rFat}
            fill="transparent"
            stroke="#27272a"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={center}
            cy={center}
            r={rCarbs}
            fill="transparent"
            stroke="#27272a"
            strokeWidth={strokeWidth}
          />

          {/* Active progress rings */}
          {/* Calories (Amber) */}
          <circle
            cx={center}
            cy={center}
            r={rCalories}
            fill="transparent"
            stroke="#f59e0b"
            strokeWidth={strokeWidth}
            strokeDasharray={calData.circumference}
            strokeDashoffset={calData.strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />

          {/* Protein (Sky) */}
          <circle
            cx={center}
            cy={center}
            r={rProtein}
            fill="transparent"
            stroke="#38bdf8"
            strokeWidth={strokeWidth}
            strokeDasharray={proData.circumference}
            strokeDashoffset={proData.strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />

          {/* Fat (Rose) */}
          <circle
            cx={center}
            cy={center}
            r={rFat}
            fill="transparent"
            stroke="#fb7185"
            strokeWidth={strokeWidth}
            strokeDasharray={fatData.circumference}
            strokeDashoffset={fatData.strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />

          {/* Carbs (Emerald) */}
          <circle
            cx={center}
            cy={center}
            r={rCarbs}
            fill="transparent"
            stroke="#34d399"
            strokeWidth={strokeWidth}
            strokeDasharray={carbData.circumference}
            strokeDashoffset={carbData.strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center content: Calories Remaining */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <Flame className="h-4 w-4 text-amber-500 mb-0.5 animate-pulse" />
          <span className="text-xl font-bold font-mono tracking-tight text-zinc-100">
            {remainingCalories}
          </span>
          <span className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">
            ккал залиш.
          </span>
        </div>
      </div>

      {/* Legend & Breakdown */}
      {showLegend && (
        <div className="mt-4 grid grid-cols-2 gap-2.5 w-full max-w-xs text-xs font-mono">
          {/* Calories */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-zinc-400 font-sans text-xs">Калорії</span>
            </div>
            <span className="text-zinc-200 font-semibold">
              {calories.current} / {calories.target}
            </span>
          </div>

          {/* Protein */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              <span className="text-zinc-400 font-sans text-xs">Білки</span>
            </div>
            <span className="text-zinc-200 font-semibold">
              {protein.current}г / {protein.target}г
            </span>
          </div>

          {/* Fat */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              <span className="text-zinc-400 font-sans text-xs">Жири</span>
            </div>
            <span className="text-zinc-200 font-semibold">
              {fat.current}г / {fat.target}г
            </span>
          </div>

          {/* Carbs */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-zinc-400 font-sans text-xs">Вуглеводи</span>
            </div>
            <span className="text-zinc-200 font-semibold">
              {carbs.current}г / {carbs.target}г
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
