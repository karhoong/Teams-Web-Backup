import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, normalizePreferences, PreferencesStore } from "../main/preferences";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("preferences", () => {
  it("uses system appearance, language, and download defaults", () => {
    expect(normalizePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
  });

  it("rejects unsupported values", () => {
    expect(normalizePreferences({ theme: "purple", language: "xx" })).toEqual(DEFAULT_PREFERENCES);
  });

  it("persists validated preferences", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "teams-web-backup-preferences-"));
    temporaryDirectories.push(directory);
    const store = new PreferencesStore(directory);

    const preferences = {
      theme: "dark" as const,
      language: "ja" as const,
      downloadConcurrency: 8,
      baseFolder: "/tmp/teams-backups"
    };
    expect(store.save(preferences)).toEqual(preferences);
    expect(new PreferencesStore(directory).get()).toEqual(preferences);
  });

  it("clamps worker count and ignores blank folders", () => {
    expect(normalizePreferences({
      theme: "light",
      language: "en",
      downloadConcurrency: 99,
      baseFolder: "  "
    })).toEqual({
      theme: "light",
      language: "en",
      downloadConcurrency: 10,
      baseFolder: null
    });
  });
});
