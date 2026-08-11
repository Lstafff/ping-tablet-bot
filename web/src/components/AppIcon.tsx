import type { LucideIcon, LucideProps } from "lucide-react";
import {
  ArrowLeft,
  Award,
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  CircleMinus,
  CirclePile,
  CirclePlus,
  Clock3,
  Crown,
  Info,
  ListFilter,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Star,
  Swords,
  Trash2,
  UserRound,
  X,
  Zap,
} from "lucide-react";

export type AppIconName =
  | "add"
  | "arrow-left"
  | "award"
  | "calendar"
  | "chart"
  | "check"
  | "chevron-left"
  | "chevron-right"
  | "circle-minus"
  | "circle-pile"
  | "circle-plus"
  | "clock"
  | "crown"
  | "filter"
  | "info"
  | "pencil"
  | "refresh"
  | "send"
  | "settings"
  | "star"
  | "swords"
  | "target"
  | "trash"
  | "user"
  | "x"
  | "zap";

const icons: Record<AppIconName, LucideIcon> = {
  add: Plus,
  "arrow-left": ArrowLeft,
  award: Award,
  calendar: CalendarDays,
  chart: BarChart3,
  check: Check,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "circle-minus": CircleMinus,
  "circle-pile": CirclePile,
  "circle-plus": CirclePlus,
  clock: Clock3,
  crown: Crown,
  filter: ListFilter,
  info: Info,
  pencil: Pencil,
  refresh: RefreshCw,
  send: Send,
  settings: Settings,
  star: Star,
  swords: Swords,
  target: CircleDot,
  trash: Trash2,
  user: UserRound,
  x: X,
  zap: Zap,
};

type AppIconProps = Omit<LucideProps, "ref"> & {
  name: AppIconName;
};

export function AppIcon({ className, name, strokeWidth = 2.25, ...props }: AppIconProps) {
  const Icon = icons[name];
  const classes = className ? `app-icon ${className}` : "app-icon";

  return <Icon className={classes} focusable="false" strokeWidth={strokeWidth} {...props} />;
}
