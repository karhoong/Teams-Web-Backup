import fs from "node:fs";
import path from "node:path";
import { AppPreferences, LanguagePreference, ThemePreference } from "../shared/types";

export const DEFAULT_PREFERENCES: AppPreferences = {
  theme: "system",
  language: "system"
};

const THEMES = new Set<ThemePreference>(["system", "light", "dark"]);
const LANGUAGES = new Set<LanguagePreference>(["system", "en", "zh-CN", "zh-TW", "ja", "es", "fr", "de", "pt-BR", "ko"]);

export function normalizePreferences(value: unknown): AppPreferences {
  if (!value || typeof value !== "object") return { ...DEFAULT_PREFERENCES };
  const candidate = value as Partial<AppPreferences>;
  return {
    theme: candidate.theme && THEMES.has(candidate.theme) ? candidate.theme : DEFAULT_PREFERENCES.theme,
    language: candidate.language && LANGUAGES.has(candidate.language) ? candidate.language : DEFAULT_PREFERENCES.language
  };
}

export class PreferencesStore {
  private readonly filePath: string;
  private preferences: AppPreferences;

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, "preferences.json");
    this.preferences = this.load();
  }

  get(): AppPreferences {
    return { ...this.preferences };
  }

  save(value: unknown): AppPreferences {
    this.preferences = normalizePreferences(value);
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(this.preferences, null, 2)}\n`, "utf8");
    fs.renameSync(temporaryPath, this.filePath);
    return this.get();
  }

  private load(): AppPreferences {
    try {
      return normalizePreferences(JSON.parse(fs.readFileSync(this.filePath, "utf8")));
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  }
}
