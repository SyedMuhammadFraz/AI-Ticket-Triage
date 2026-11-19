import {
  ArchiveIcon,
  ArmchairIcon,
  BoxesIcon,
  CableIcon,
  CoffeeIcon,
  CupSodaIcon,
  DropletsIcon,
  FileTextIcon,
  HeadphonesIcon,
  HighlighterIcon,
  InboxIcon,
  KeyboardIcon,
  LampIcon,
  LayersIcon,
  MonitorIcon,
  NotebookPenIcon,
  PaperclipIcon,
  PenLineIcon,
  PrinterIcon,
  SprayCanIcon,
  StickyNoteIcon,
  TagIcon,
  UsbIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Products are shown as consistent illustrated tiles rather than stock photos. */
const ICONS = {
  file: FileTextIcon,
  notebook: NotebookPenIcon,
  sticky: StickyNoteIcon,
  pen: PenLineIcon,
  highlighter: HighlighterIcon,
  printer: PrinterIcon,
  droplets: DropletsIcon,
  paperclip: PaperclipIcon,
  inbox: InboxIcon,
  layers: LayersIcon,
  tag: TagIcon,
  chair: ArmchairIcon,
  lamp: LampIcon,
  monitor: MonitorIcon,
  archive: ArchiveIcon,
  keyboard: KeyboardIcon,
  usb: UsbIcon,
  headphones: HeadphonesIcon,
  cable: CableIcon,
  coffee: CoffeeIcon,
  cup: CupSodaIcon,
  spray: SprayCanIcon,
  boxes: BoxesIcon,
} as const;

export type ProductIconName = keyof typeof ICONS;

const CATEGORY_TINT: Record<string, string> = {
  paper: "from-sky-500/15 to-sky-500/5 text-sky-700 dark:text-sky-300",
  writing: "from-violet-500/15 to-violet-500/5 text-violet-700 dark:text-violet-300",
  "ink-toner": "from-slate-500/20 to-slate-500/5 text-slate-700 dark:text-slate-300",
  desk: "from-amber-500/20 to-amber-500/5 text-amber-700 dark:text-amber-300",
  furniture: "from-emerald-500/15 to-emerald-500/5 text-emerald-700 dark:text-emerald-300",
  tech: "from-indigo-500/15 to-indigo-500/5 text-indigo-700 dark:text-indigo-300",
  breakroom: "from-orange-500/15 to-orange-500/5 text-orange-700 dark:text-orange-300",
};

export function ProductIcon({
  name,
  category,
  className,
  iconClassName,
}: {
  name: string;
  category: string;
  className?: string;
  iconClassName?: string;
}) {
  const Icon = ICONS[name as ProductIconName] ?? BoxesIcon;
  return (
    <div
      aria-hidden
      className={cn(
        "grid place-items-center rounded-xl bg-gradient-to-br",
        CATEGORY_TINT[category] ?? "from-muted to-muted/40 text-muted-foreground",
        className,
      )}
    >
      <Icon className={cn("size-10", iconClassName)} strokeWidth={1.5} />
    </div>
  );
}
