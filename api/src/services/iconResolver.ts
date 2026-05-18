const browserApps = [
    "chrome",
    "edge",
    "brave",
    "firefox",
    "avast secure browser"
  ];
  
  const appIconMap: Record<string, string> = {
    cursor: "/icons/apps/cursor.png",
    "visual studio code": "/icons/apps/vscode.png",
    spotify: "/icons/apps/spotify.png",
    discord: "/icons/apps/discord.png",
    notion: "/icons/apps/notion.png",
    docker: "/icons/apps/docker.png",

    github: "/icons/apps/github.png",
    figma: "/icons/apps/figma.png",
    whatsapp: "/icons/apps/whatsapp.png",
    telegram: "/icons/apps/telegram.png",
    valorant: "/icons/apps/valorant.png",
    brave: "/icons/apps/brave.png",
  "brave browser": "/icons/apps/brave.png",
  codex: "/icons/apps/codex.png"
  };
  
  function normalize(value: string) {
    return value.toLowerCase().trim();
  }
  
  export function getDomainFromUrl(url?: string | null) {
    if (!url) return null;
  
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  }
  
  export function resolveActivityIcon(input: {
    appName: string;
    url?: string | null;
    domain?: string | null;
  }) {
    const appName = normalize(input.appName);
    const domain = input.domain ?? getDomainFromUrl(input.url);
  
    const isBrowser = browserApps.some(browser =>
      appName.includes(browser)
    );
  
    if (isBrowser && domain) {
      return {
        domain,
        iconUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
      };
    }
  
    const matchedApp = Object.keys(appIconMap).find(key =>
      appName.includes(key)
    );
  
    if (matchedApp) {
      return {
        domain: null,
        iconUrl: appIconMap[matchedApp]
      };
    }
  
    return {
      domain,
      iconUrl: null
    };
  }