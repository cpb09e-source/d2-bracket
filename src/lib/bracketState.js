import { BRACKET } from "./bracketData";

export function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function teamId(region, team) {
  return `${slugify(region)}-${team.seed}-${slugify(team.name)}`;
}

export function getTeamById(id) {
  for (const region of BRACKET.regions) {
    for (const team of region.teams) {
      const tid = teamId(region.name, team);
      if (tid === id) return { ...team, id: tid, region: region.name };
    }
  }
  return null;
}

export function createInitialEntryState() {
  const state = { regions: {}, eliteEight: {}, finalFour: {}, champion: "" };

  BRACKET.regions.forEach((region) => {
    const teams = region.teams.map((t) => ({ ...t, id: teamId(region.name, t) }));
    state.regions[region.name] = {
      qf: [
        { id: `${slugify(region.name)}-qf-1`, teams: [teams[0], teams[1]], winnerId: "" },
        { id: `${slugify(region.name)}-qf-2`, teams: [teams[2], teams[3]], winnerId: "" },
        { id: `${slugify(region.name)}-qf-3`, teams: [teams[4], teams[5]], winnerId: "" },
        { id: `${slugify(region.name)}-qf-4`, teams: [teams[6], teams[7]], winnerId: "" },
      ],
      sf: [
        { id: `${slugify(region.name)}-sf-1`, teams: [], winnerId: "" },
        { id: `${slugify(region.name)}-sf-2`, teams: [], winnerId: "" },
      ],
      final: { id: `${slugify(region.name)}-final`, teams: [], winnerId: "" },
    };
    state.eliteEight[region.name] = "";
  });

  return state;
}

function collectWinners(games) {
  return games.map((g) => g.teams.find((t) => t.id === g.winnerId)).filter(Boolean);
}

function collectRegionWinners(entryState, regions) {
  return regions.map((name) => getTeamById(entryState.eliteEight[name])).filter(Boolean);
}

export function hydrateEntry(entryState) {
  const result = JSON.parse(JSON.stringify(entryState || createInitialEntryState()));

  BRACKET.regions.forEach((region) => {
    const regionState = result.regions[region.name];
    regionState.sf[0].teams = collectWinners(regionState.qf.slice(0, 2));
    regionState.sf[1].teams = collectWinners(regionState.qf.slice(2, 4));
    regionState.final.teams = collectWinners(regionState.sf);
    result.eliteEight[region.name] = regionState.final.winnerId || "";
  });

  const leftRegions = ["Atlantic", "South", "Central", "Southeast"];
  const rightRegions = ["East", "South Central", "Midwest", "West"];

  result.finalFour = {
    leftSemi1: { id: "ff-left-1", teams: collectRegionWinners(result, leftRegions.slice(0, 2)), winnerId: result.finalFour?.leftSemi1?.winnerId || "" },
    leftSemi2: { id: "ff-left-2", teams: collectRegionWinners(result, leftRegions.slice(2, 4)), winnerId: result.finalFour?.leftSemi2?.winnerId || "" },
    rightSemi1: { id: "ff-right-1", teams: collectRegionWinners(result, rightRegions.slice(0, 2)), winnerId: result.finalFour?.rightSemi1?.winnerId || "" },
    rightSemi2: { id: "ff-right-2", teams: collectRegionWinners(result, rightRegions.slice(2, 4)), winnerId: result.finalFour?.rightSemi2?.winnerId || "" },
    titleLeft: { id: "title-left", teams: [], winnerId: result.finalFour?.titleLeft?.winnerId || "" },
    titleRight: { id: "title-right", teams: [], winnerId: result.finalFour?.titleRight?.winnerId || "" },
  };

  result.finalFour.titleLeft.teams = collectWinners([result.finalFour.leftSemi1, result.finalFour.leftSemi2]);
  result.finalFour.titleRight.teams = collectWinners([result.finalFour.rightSemi1, result.finalFour.rightSemi2]);

  result.championGame = {
    id: "championship",
    teams: collectWinners([result.finalFour.titleLeft, result.finalFour.titleRight]),
    winnerId: result.champion || "",
  };

  return result;
}

export function updateGameWinner(entryState, path, winnerId) {
  const next = JSON.parse(JSON.stringify(entryState));

  if (path.scope === "region") {
    const target = next.regions[path.region][path.round];
    if (Array.isArray(target)) {
      target[path.index].winnerId = winnerId;
      if (path.round === "qf") {
        const sfIndex = path.index < 2 ? 0 : 1;
        next.regions[path.region].sf[sfIndex].winnerId = "";
        next.regions[path.region].final.winnerId = "";
        next.eliteEight[path.region] = "";
      }
      if (path.round === "sf") {
        next.regions[path.region].final.winnerId = "";
        next.eliteEight[path.region] = "";
      }
    } else {
      target.winnerId = winnerId;
      next.eliteEight[path.region] = winnerId;
    }
  } else if (path.scope === "finalFour") {
    next.finalFour[path.gameKey].winnerId = winnerId;
    if (["leftSemi1", "leftSemi2"].includes(path.gameKey)) {
      next.finalFour.titleLeft.winnerId = "";
      next.champion = "";
    }
    if (["rightSemi1", "rightSemi2"].includes(path.gameKey)) {
      next.finalFour.titleRight.winnerId = "";
      next.champion = "";
    }
    if (["titleLeft", "titleRight"].includes(path.gameKey)) {
      next.champion = "";
    }
  } else if (path.scope === "championship") {
    next.champion = winnerId;
  }

  return hydrateEntry(next);
}

export function blankAppState() {
  return {
    entries: [],
    results: hydrateEntry(createInitialEntryState()),
    settings: {
      title: "D2 March Madness Bracket Challenge",
      lockEntries: false,
      adminPinEnabled: true,
    },
  };
}