import { useState } from "react";

export type IdeId = "vscode" | "cursor" | "windsurf" | "antigravity";

export interface IdeOption {
  id: IdeId;
  label: string;
  configFile: string;
  invokeHint: string;
}

export const IDE_OPTIONS: IdeOption[] = [
  {
    id: "vscode",
    label: "VSCode",
    configFile: ".vscode/mcp.json",
    invokeHint: "GitHub Copilot chat (@wanderai) or Cmd+I",
  },
  {
    id: "cursor",
    label: "Cursor",
    configFile: "~/.cursor/mcp.json",
    invokeHint: "@wanderai in chat or Cmd+K",
  },
  {
    id: "windsurf",
    label: "Windsurf",
    configFile: "~/.codeium/windsurf/mcp_config.json",
    invokeHint: "@wanderai in Cascade chat",
  },
  {
    id: "antigravity",
    label: "Antigravity",
    configFile: "~/.antigravity/config/mcp.json",
    invokeHint: "@wanderai in Agent panel",
  },
];

const STORAGE_KEY = "wanderai_selected_ide";

function readFromStorage(): IdeId | null {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val && IDE_OPTIONS.some(o => o.id === val)) return val as IdeId;
  } catch {}
  return null;
}

export function useIdeSelection() {
  const [selectedIde, setSelectedIde] = useState<IdeId | null>(readFromStorage);

  const selectIde = (ide: IdeId) => {
    setSelectedIde(ide);
    try { localStorage.setItem(STORAGE_KEY, ide); } catch {}
  };

  const clearIde = () => {
    setSelectedIde(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const ideOption = IDE_OPTIONS.find(o => o.id === selectedIde) ?? null;

  return { selectedIde, ideOption, selectIde, clearIde };
}
