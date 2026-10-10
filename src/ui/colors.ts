// Full class names so Tailwind finds them; a task's color follows its position.
const TASK_COLORS = [
  'bg-sky-600',
  'bg-violet-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-teal-600',
  'bg-indigo-600',
  'bg-orange-600',
]

export const taskColor = (index: number) =>
  TASK_COLORS[index % TASK_COLORS.length]
