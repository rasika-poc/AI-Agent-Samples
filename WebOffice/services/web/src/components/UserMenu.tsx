import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { clearToken } from "../auth";
import { useCurrentUser } from "../context/UserContext";
import { PersonAvatar } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function UserMenu() {
  const { user, clear } = useCurrentUser();
  const navigate = useNavigate();

  if (!user) return null;

  function handleLogout() {
    clearToken();
    clear();
    navigate("/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <PersonAvatar id={user.id} name={user.display_name} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <p className="truncate font-medium text-slate-700">{user.display_name}</p>
          <p className="truncate text-slate-400">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleLogout}>
          <LogOut className="h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
