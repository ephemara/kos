export type KadeChromeIconTheme = "light"
export type KadeChromeIconFormat = "svg" | "png"
export type KadeChromeIconName = "activity" | "chat" | "new-task" | "history" | "settings" | "popout" | "help" | "profile"

export type KadeChromeIconEntry = (typeof iconManifest)[number]

export const iconManifest = [
  {
    "name": "activity",
    "title": "Activity",
    "category": "chrome",
    "tags": [
      "activity",
      "sidebar",
      "extension",
      "launch"
    ],
    "aliases": [
      "activity",
      "sidebar",
      "kade-ActivityBar",
      "kade.SidebarProvider"
    ],
    "usage": "Primary Kade entry icon for the VS Code activity bar and extension surface.",
    "paths": {
      "light": {
        "svg": "svg/light/chrome/activity.svg",
        "png": "png/light/chrome/activity.png"
      }
    }
  },
  {
    "name": "chat",
    "title": "Chat",
    "category": "chrome",
    "tags": [
      "chat",
      "conversation",
      "assistant"
    ],
    "aliases": [
      "chat",
      "chatButtonClicked",
      "kade.chatButtonClicked"
    ],
    "usage": "Main conversational workspace for prompts and responses.",
    "paths": {
      "light": {
        "svg": "svg/light/chrome/chat.svg",
        "png": "png/light/chrome/chat.png"
      }
    }
  },
  {
    "name": "new-task",
    "title": "New Task",
    "category": "chrome",
    "tags": [
      "new",
      "task",
      "create"
    ],
    "aliases": [
      "new-task",
      "plus",
      "kade.plusButtonClicked",
      "kade.newTask"
    ],
    "usage": "Create a fresh task, prompt, or agent request.",
    "paths": {
      "light": {
        "svg": "svg/light/chrome/new-task.svg",
        "png": "png/light/chrome/new-task.png"
      }
    }
  },
  {
    "name": "history",
    "title": "History",
    "category": "chrome",
    "tags": [
      "history",
      "sessions",
      "recents"
    ],
    "aliases": [
      "history",
      "historyButtonClicked",
      "kade.historyButtonClicked"
    ],
    "usage": "Open prior sessions, previous tasks, and resumable context.",
    "paths": {
      "light": {
        "svg": "svg/light/chrome/history.svg",
        "png": "png/light/chrome/history.png"
      }
    }
  },
  {
    "name": "settings",
    "title": "Settings",
    "category": "chrome",
    "tags": [
      "settings",
      "config",
      "preferences"
    ],
    "aliases": [
      "settings",
      "settingsButtonClicked",
      "kade.settingsButtonClicked"
    ],
    "usage": "Open Kade settings, modes, and preference controls.",
    "paths": {
      "light": {
        "svg": "svg/light/chrome/settings.svg",
        "png": "png/light/chrome/settings.png"
      }
    }
  },
  {
    "name": "popout",
    "title": "Popout",
    "category": "chrome",
    "tags": [
      "popout",
      "external",
      "tab"
    ],
    "aliases": [
      "popout",
      "open-in-tab",
      "kade.popoutButtonClicked"
    ],
    "usage": "Open the Kade surface in a separate tab or window.",
    "paths": {
      "light": {
        "svg": "svg/light/chrome/popout.svg",
        "png": "png/light/chrome/popout.png"
      }
    }
  },
  {
    "name": "help",
    "title": "Help",
    "category": "chrome",
    "tags": [
      "help",
      "docs",
      "support"
    ],
    "aliases": [
      "help",
      "documentation",
      "kade.helpButtonClicked"
    ],
    "usage": "Documentation, walkthroughs, and guided product support.",
    "paths": {
      "light": {
        "svg": "svg/light/chrome/help.svg",
        "png": "png/light/chrome/help.png"
      }
    }
  },
  {
    "name": "profile",
    "title": "Profile",
    "category": "chrome",
    "tags": [
      "profile",
      "account",
      "user"
    ],
    "aliases": [
      "profile",
      "account",
      "profileButtonClicked",
      "kade.profileButtonClicked"
    ],
    "usage": "User profile and account identity state.",
    "paths": {
      "light": {
        "svg": "svg/light/chrome/profile.svg",
        "png": "png/light/chrome/profile.png"
      }
    }
  }
] as const
export const iconAliasMap = {
  "activity": "activity",
  "sidebar": "activity",
  "kade-activitybar": "activity",
  "kade-sidebarprovider": "activity",
  "extension": "activity",
  "launch": "activity",
  "chat": "chat",
  "chatbuttonclicked": "chat",
  "kade-chatbuttonclicked": "chat",
  "conversation": "chat",
  "assistant": "chat",
  "new-task": "new-task",
  "plus": "new-task",
  "kade-plusbuttonclicked": "new-task",
  "kade-newtask": "new-task",
  "new": "new-task",
  "task": "new-task",
  "create": "new-task",
  "history": "history",
  "historybuttonclicked": "history",
  "kade-historybuttonclicked": "history",
  "sessions": "history",
  "recents": "history",
  "settings": "settings",
  "settingsbuttonclicked": "settings",
  "kade-settingsbuttonclicked": "settings",
  "config": "settings",
  "preferences": "settings",
  "popout": "popout",
  "open-in-tab": "popout",
  "kade-popoutbuttonclicked": "popout",
  "external": "popout",
  "tab": "popout",
  "help": "help",
  "documentation": "help",
  "kade-helpbuttonclicked": "help",
  "docs": "help",
  "support": "help",
  "profile": "profile",
  "account": "profile",
  "profilebuttonclicked": "profile",
  "kade-profilebuttonclicked": "profile",
  "user": "profile"
} as const

export function normalizeKadeChromeIconTerm(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

export function resolveKadeChromeIconName(value: string): KadeChromeIconName | null {
  const normalized = normalizeKadeChromeIconTerm(value)
  if ((iconAliasMap as Record<string, string>)[normalized]) {
    return (iconAliasMap as Record<string, string>)[normalized] as KadeChromeIconName
  }
  return iconManifest.find((entry) => entry.name === normalized)?.name ?? null
}

export function getKadeChromeIconEntry(nameOrAlias: string): KadeChromeIconEntry | null {
  const resolved = resolveKadeChromeIconName(nameOrAlias)
  if (!resolved) return null
  return iconManifest.find((entry) => entry.name === resolved) ?? null
}

export function getKadeChromeIconPath(nameOrAlias: string, format: KadeChromeIconFormat = "svg", base = ".."): string | null {
  const entry = getKadeChromeIconEntry(nameOrAlias)
  if (!entry) return null
  const relativePath = entry.paths.light[format]
  if (!base) return relativePath
  return `${base.replace(/\/+$/g, "")}/${relativePath}`
}

export function listKadeChromeIcons(): readonly KadeChromeIconEntry[] {
  return iconManifest
}
