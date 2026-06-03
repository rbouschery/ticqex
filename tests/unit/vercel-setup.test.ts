import { describe, expect, it } from "vitest";
import {
  defaultVercelProjectName,
  parseVercelTeamsJson,
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
