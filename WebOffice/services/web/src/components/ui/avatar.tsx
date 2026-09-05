import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn, colorForId, initials } from "../../lib/utils";

interface PersonAvatarProps {
  id: string;
  name: string;
  className?: string;
  ringColor?: string;
}

// Colored-initials avatar (no image upload yet — PLAN.md's user profile
// photo support isn't built) keyed by a stable per-user color so the same
// person looks the same everywhere (share list, presence bar, user menu).
export function PersonAvatar({ id, name, className, ringColor }: PersonAvatarProps) {
  const color = colorForId(id);
  return (
    <AvatarPrimitive.Root
      className={cn(
        "inline-flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full text-xs font-semibold text-white",
        className,
      )}
      style={{ backgroundColor: color, boxShadow: ringColor ? `0 0 0 2px ${ringColor}` : undefined }}
      title={name}
    >
      <AvatarPrimitive.Fallback>{initials(name)}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
