import type { HocuspocusProvider } from "@hocuspocus/provider";
import { useEffect, useState } from "react";

import { Tooltip } from "./ui/tooltip";

interface AwarenessUser {
  name: string;
  color: string;
}

// Reads Yjs awareness state (CollaborationCaret writes `{ user: { name, color } }`
// per connected client, keyed by a random per-connection clientID — this shows
// who else is currently viewing/editing, updating live as people join/leave.
export function PresenceBar({ provider }: { provider: HocuspocusProvider }) {
  const [users, setUsers] = useState<AwarenessUser[]>([]);

  useEffect(() => {
    function sync() {
      const states = Array.from(provider.awareness?.getStates().values() ?? []);
      const seen = new Set<string>();
      const people: AwarenessUser[] = [];
      for (const state of states) {
        const user = (state as { user?: AwarenessUser }).user;
        if (user && !seen.has(user.name)) {
          seen.add(user.name);
          people.push(user);
        }
      }
      setUsers(people);
    }
    sync();
    provider.awareness?.on("update", sync);
    return () => provider.awareness?.off("update", sync);
  }, [provider]);

  if (users.length === 0) return null;

  return (
    <div className="flex -space-x-2">
      {users.map((u, i) => (
        <Tooltip key={i} content={u.name}>
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white"
            style={{ backgroundColor: u.color }}
          >
            {u.name.slice(0, 2).toUpperCase()}
          </div>
        </Tooltip>
      ))}
    </div>
  );
}
