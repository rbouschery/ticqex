import { describe, expect, it } from "vitest";
import {
  defaultVercelProjectName,
  normalizeVercelProductionUrl,
  parseVercelTeamsJson,
  resolveGitProductionBranch,
  resolveVercelTeamSelection,
  type VercelTeam,
} from "../../scripts/lib/vercel-setup";

describe("defaultVercelProjectName", () => {
  it("reads the package name", () => {
    expect(defaultVercelProjectName()).toBe("ticqex");
  });
});

describe("parseVercelTeamsJson", () => {
  it("parses teams from CLI JSON output", () => {
    const teams = parseVercelTeamsJson(`Fetching teams
{
  "teams": [
    {
      "id": "team_abc",
      "slug": "personal",
      "name": "Personal",
      "current": true
    },
    {
      "id": "team_xyz",
      "slug": "sempervirens-labs",
      "name": "Sempervirens Labs"
    }
  ]
}`);

    expect(teams).toEqual([
      {
        id: "team_abc",
        slug: "personal",
        name: "Personal",
        current: true,
      },
      {
        id: "team_xyz",
        slug: "sempervirens-labs",
        name: "Sempervirens Labs",
        current: false,
      },
    ]);
  });
});

describe("resolveVercelTeamSelection", () => {
  const teams: VercelTeam[] = [
    {
      id: "team_abc",
      slug: "personal",
      name: "Personal",
      current: true,
    },
    {
      id: "team_xyz",
      slug: "sempervirens-labs",
      name: "Sempervirens Labs",
      current: false,
    },
  ];

  it("returns the current team for blank input", () => {
    expect(resolveVercelTeamSelection("", teams)?.slug).toBe("personal");
  });

  it("selects by number", () => {
    expect(resolveVercelTeamSelection("2", teams)?.slug).toBe(
      "sempervirens-labs",
    );
  });

  it("selects by slug or id", () => {
    expect(resolveVercelTeamSelection("sempervirens-labs", teams)?.slug).toBe(
      "sempervirens-labs",
    );
    expect(resolveVercelTeamSelection("team_xyz", teams)?.slug).toBe(
      "sempervirens-labs",
    );
  });

  it("returns null for invalid input", () => {
    expect(resolveVercelTeamSelection("unknown", teams)).toBeNull();
    expect(resolveVercelTeamSelection("99", teams)).toBeNull();
  });
});

describe("normalizeVercelProductionUrl", () => {
  it("rejects placeholder production URLs from the CLI", () => {
    expect(normalizeVercelProductionUrl("--")).toBeNull();
    expect(normalizeVercelProductionUrl("https://--")).toBeNull();
  });

  it("normalizes valid production URLs", () => {
    expect(normalizeVercelProductionUrl("readbetter-ticqex.vercel.app")).toBe(
      "https://readbetter-ticqex.vercel.app",
    );
    expect(normalizeVercelProductionUrl("https://readbetter-ticqex.vercel.app/")).toBe(
      "https://readbetter-ticqex.vercel.app",
    );
  });
});

describe("resolveGitProductionBranch", () => {
  it("prefers main or master when present", () => {
    expect(resolveGitProductionBranch("feature/foo")).toBe("main");
    expect(resolveGitProductionBranch("develop")).toBe("main");
    expect(resolveGitProductionBranch(null)).toBe("main");
  });

  it("keeps the current branch when it is main or master", () => {
    expect(resolveGitProductionBranch("main")).toBe("main");
    expect(resolveGitProductionBranch("master")).toBe("master");
  });
});
