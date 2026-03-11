import { useEffect, useMemo, useState } from "react";
import {
  fetchRemoteState,
  createRemoteEntry,
  updateRemoteEntry,
  deleteRemoteEntry,
  saveRemoteSettings,
} from "./lib/firestoreApi";
import {
  blankAppState,
  createInitialEntryState,
  hydrateEntry,
  updateGameWinner,
  getTeamById,
} from "./lib/bracketState";
import { REGION_ORDER } from "./lib/bracketData";

const ADMIN_PIN = "2026";

function countCompletedPicks(entry) {
  let count = 0;

  Object.values(entry.regions).forEach((region) => {
    region.qf.forEach((g) => g.winnerId && count++);
    region.sf.forEach((g) => g.winnerId && count++);
    if (region.final.winnerId) count++;
  });

  ["leftSemi1", "leftSemi2", "rightSemi1", "rightSemi2", "titleLeft", "titleRight"].forEach((k) => {
    if (entry.finalFour[k].winnerId) count++;
  });

  if (entry.champion) count++;
  return count;
}

function maxPickCount() {
  return 63;
}

function scoreEntry(entry, results) {
  const regionPoints = [1, 2, 4];
  const eliteEightPoints = 6;
  const finalFourPoints = 8;
  const titlePoints = 12;

  let score = 0;
  let possibleRemaining = 0;

  REGION_ORDER.forEach((regionName) => {
    const e = entry.regions[regionName];
    const r = results.regions[regionName];

    e.qf.forEach((game, i) => {
      if (game.winnerId && game.winnerId === r.qf[i].winnerId) score += regionPoints[0];
      if (!r.qf[i].winnerId) possibleRemaining += regionPoints[0];
    });

    e.sf.forEach((game, i) => {
      if (game.winnerId && game.winnerId === r.sf[i].winnerId) score += regionPoints[1];
      if (!r.sf[i].winnerId) possibleRemaining += regionPoints[1];
    });

    if (e.final.winnerId && e.final.winnerId === r.final.winnerId) score += regionPoints[2];
    if (!r.final.winnerId) possibleRemaining += regionPoints[2];
  });

  ["leftSemi1", "leftSemi2", "rightSemi1", "rightSemi2"].forEach((key) => {
    if (entry.finalFour[key].winnerId && entry.finalFour[key].winnerId === results.finalFour[key].winnerId) {
      score += eliteEightPoints;
    }
    if (!results.finalFour[key].winnerId) possibleRemaining += eliteEightPoints;
  });

  ["titleLeft", "titleRight"].forEach((key) => {
    if (entry.finalFour[key].winnerId && entry.finalFour[key].winnerId === results.finalFour[key].winnerId) {
      score += finalFourPoints;
    }
    if (!results.finalFour[key].winnerId) possibleRemaining += finalFourPoints;
  });

  if (entry.champion && entry.champion === results.champion) score += titlePoints;
  if (!results.champion) possibleRemaining += titlePoints;

  return { score, maxTotal: score + possibleRemaining };
}

function GameCard({ title, teams, winnerId, onSelect, disabled }) {
  return (
    <div
      style={{
        border: "1px solid #444",
        borderRadius: 12,
        padding: 12,
        background: "#181818",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 10 }}>{title}</div>

      {teams.map((team, idx) => (
        <button
          key={team?.id || idx}
          onClick={() => team && onSelect(team.id)}
          disabled={!team || disabled}
          style={{
            width: "100%",
            textAlign: "left",
            marginBottom: idx === 0 ? 8 : 0,
            padding: 10,
            borderRadius: 10,
            border: winnerId === team?.id ? "2px solid white" : "1px solid #555",
            background: winnerId === team?.id ? "#2a2a2a" : "#111",
            color: "white",
            cursor: team && !disabled ? "pointer" : "default",
            opacity: team ? 1 : 0.5,
          }}
        >
          {team ? `#${team.seed} ${team.name}` : "Waiting for prior pick"}
        </button>
      ))}
    </div>
  );
}

function RegionSection({ regionName, entry, onPick, disabled }) {
  const region = entry.regions[regionName];

  return (
    <div
      style={{
        border: "1px solid #444",
        borderRadius: 16,
        padding: 16,
        background: "#151515",
      }}
    >
      <h2 style={{ marginTop: 0 }}>{regionName}</h2>

      <div style={{ display: "grid", gap: 12 }}>
        {region.qf.map((game, idx) => (
          <GameCard
            key={game.id}
            title={`Round of 64 - Game ${idx + 1}`}
            teams={game.teams}
            winnerId={game.winnerId}
            onSelect={(winnerId) =>
              onPick({ scope: "region", region: regionName, round: "qf", index: idx }, winnerId)
            }
            disabled={disabled}
          />
        ))}
      </div>

      <div style={{ height: 12 }} />

      <div style={{ display: "grid", gap: 12 }}>
        {region.sf.map((game, idx) => (
          <GameCard
            key={game.id}
            title={`Round of 32 - Game ${idx + 1}`}
            teams={game.teams}
            winnerId={game.winnerId}
            onSelect={(winnerId) =>
              onPick({ scope: "region", region: regionName, round: "sf", index: idx }, winnerId)
            }
            disabled={disabled}
          />
        ))}
      </div>

      <div style={{ height: 12 }} />

      <GameCard
        title="Regional Final"
        teams={region.final.teams}
        winnerId={region.final.winnerId}
        onSelect={(winnerId) => onPick({ scope: "region", region: regionName, round: "final" }, winnerId)}
        disabled={disabled}
      />
    </div>
  );
}

function FinalRounds({ entry, onPick, disabled }) {
  return (
    <div
      style={{
        border: "1px solid #444",
        borderRadius: 16,
        padding: 16,
        background: "#151515",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Elite Eight, Final Four & Championship</h2>

      <div style={{ display: "grid", gap: 12 }}>
        <GameCard
          title="Elite Eight A"
          teams={entry.finalFour.leftSemi1.teams}
          winnerId={entry.finalFour.leftSemi1.winnerId}
          onSelect={(winnerId) => onPick({ scope: "finalFour", gameKey: "leftSemi1" }, winnerId)}
          disabled={disabled}
        />
        <GameCard
          title="Elite Eight B"
          teams={entry.finalFour.leftSemi2.teams}
          winnerId={entry.finalFour.leftSemi2.winnerId}
          onSelect={(winnerId) => onPick({ scope: "finalFour", gameKey: "leftSemi2" }, winnerId)}
          disabled={disabled}
        />
        <GameCard
          title="Elite Eight C"
          teams={entry.finalFour.rightSemi1.teams}
          winnerId={entry.finalFour.rightSemi1.winnerId}
          onSelect={(winnerId) => onPick({ scope: "finalFour", gameKey: "rightSemi1" }, winnerId)}
          disabled={disabled}
        />
        <GameCard
          title="Elite Eight D"
          teams={entry.finalFour.rightSemi2.teams}
          winnerId={entry.finalFour.rightSemi2.winnerId}
          onSelect={(winnerId) => onPick({ scope: "finalFour", gameKey: "rightSemi2" }, winnerId)}
          disabled={disabled}
        />
        <GameCard
          title="National Semifinal 1"
          teams={entry.finalFour.titleLeft.teams}
          winnerId={entry.finalFour.titleLeft.winnerId}
          onSelect={(winnerId) => onPick({ scope: "finalFour", gameKey: "titleLeft" }, winnerId)}
          disabled={disabled}
        />
        <GameCard
          title="National Semifinal 2"
          teams={entry.finalFour.titleRight.teams}
          winnerId={entry.finalFour.titleRight.winnerId}
          onSelect={(winnerId) => onPick({ scope: "finalFour", gameKey: "titleRight" }, winnerId)}
          disabled={disabled}
        />
        <GameCard
          title="Championship"
          teams={entry.championGame.teams}
          winnerId={entry.champion}
          onSelect={(winnerId) => onPick({ scope: "championship" }, winnerId)}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export default function App() {
  const [appState, setAppState] = useState(blankAppState());
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [workingEntry, setWorkingEntry] = useState(hydrateEntry(createInitialEntryState()));
  const [adminPin, setAdminPin] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [tab, setTab] = useState("picks");

  useEffect(() => {
  async function boot() {
    try {
      const state = await fetchRemoteState();
      setAppState(state);
    } catch (error) {
      console.error(error);
      alert(`Firebase load failed: ${error.message}`);
      setAppState(blankAppState());
    } finally {
      setLoading(false);
    }
  }
    boot();
  }, []);

  const leaderboard = useMemo(() => {
    return [...appState.entries]
      .map((entry) => ({
        ...entry,
        ...scoreEntry(entry.bracket, appState.results),
      }))
      .sort((a, b) => b.score - a.score || b.maxTotal - a.maxTotal || a.name.localeCompare(b.name));
  }, [appState]);

  function handlePick(path, winnerId) {
    setWorkingEntry((prev) => updateGameWinner(prev, path, winnerId));
  }

  function resetForm() {
    setName("");
    setEditingId(null);
    setWorkingEntry(hydrateEntry(createInitialEntryState()));
  }

  async function submitEntry() {
    try {
      if (!name.trim()) {
        alert("Enter a name first.");
        return;
      }

      if (countCompletedPicks(workingEntry) !== maxPickCount()) {
        alert("Complete the entire bracket before submitting.");
        return;
      }

      const payload = {
        id: editingId || null,
        name: name.trim(),
        createdAt: new Date().toISOString(),
        bracket: workingEntry,
      };

      if (editingId) {
        const saved = await updateRemoteEntry(payload);
        setAppState((prev) => ({
          ...prev,
          entries: prev.entries.map((e) => (e.id === editingId ? saved : e)),
        }));
      } else {
        const saved = await createRemoteEntry(payload);
        setAppState((prev) => ({
          ...prev,
          entries: [...prev.entries, saved],
        }));
      }

      resetForm();
      alert("Bracket saved.");
    } catch (error) {
      console.error(error);
      alert(`Save failed: ${error.message}`);
    }
  }

  function editEntry(entry) {
    setName(entry.name);
    setEditingId(entry.id);
    setWorkingEntry(hydrateEntry(entry.bracket));
    setTab("picks");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeEntry(id) {
    try {
      await deleteRemoteEntry(id);
      setAppState((prev) => ({
        ...prev,
        entries: prev.entries.filter((e) => e.id !== id),
      }));
    } catch (error) {
      console.error(error);
      alert(`Delete failed: ${error.message}`);
    }
  }

  async function saveAdminState(nextState) {
    try {
      await saveRemoteSettings(nextState);
      setAppState(nextState);
      alert("Admin changes saved.");
    } catch (error) {
      console.error(error);
      alert(`Admin save failed: ${error.message}`);
    }
  }

  function openAdmin() {
    if (adminPin === ADMIN_PIN) {
      setAdminOpen(true);
      setTab("admin");
    } else {
      alert("Wrong admin PIN.");
    }
  }

  if (loading) {
    return <div style={{ padding: 24, color: "white", background: "#111", minHeight: "100vh" }}>Loading...</div>;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#111",
        color: "white",
        padding: 16,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1300, margin: "0 auto" }}>
        <h1 style={{ fontSize: 48, marginBottom: 12 }}>{appState.settings.title}</h1>

        <div style={{ marginBottom: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => setTab("picks")}>Make Picks</button>
          <button onClick={() => setTab("leaderboard")}>Leaderboard</button>
          <button onClick={() => setTab("admin")}>Admin</button>
        </div>

        {tab === "picks" && (
          <>
            <div
              style={{
                border: "1px solid #444",
                borderRadius: 16,
                padding: 16,
                background: "#151515",
                marginBottom: 20,
              }}
            >
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  style={{ padding: 10, minWidth: 220 }}
                />
                <button onClick={submitEntry}>{editingId ? "Update Entry" : "Submit Entry"}</button>
                <button onClick={resetForm}>New Entry</button>
                <div>Progress: {countCompletedPicks(workingEntry)}/{maxPickCount()}</div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              {REGION_ORDER.map((regionName) => (
                <RegionSection
                  key={regionName}
                  regionName={regionName}
                  entry={workingEntry}
                  onPick={handlePick}
                  disabled={false}
                />
              ))}
            </div>

            <div style={{ height: 16 }} />

            <FinalRounds entry={workingEntry} onPick={handlePick} disabled={false} />

            <div style={{ height: 20 }} />

            <div
              style={{
                border: "1px solid #444",
                borderRadius: 16,
                padding: 16,
                background: "#151515",
              }}
            >
              <h2>Saved Entries</h2>
              {appState.entries.length === 0 ? (
                <div>No entries yet.</div>
              ) : (
                appState.entries.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      border: "1px solid #333",
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "bold" }}>{entry.name}</div>
                      <div style={{ fontSize: 14, opacity: 0.8 }}>
                        Champion: {getTeamById(entry.bracket.champion)?.name || "None"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => editEntry(entry)}>Edit</button>
                      <button onClick={() => removeEntry(entry.id)}>Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {tab === "leaderboard" && (
          <div
            style={{
              border: "1px solid #444",
              borderRadius: 16,
              padding: 16,
              background: "#151515",
            }}
          >
            <h2>Leaderboard</h2>
            {leaderboard.length === 0 ? (
              <div>No entries yet.</div>
            ) : (
              leaderboard.map((entry, index) => (
                <div
                  key={entry.id}
                  style={{
                    border: "1px solid #333",
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 10,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "bold" }}>
                      #{index + 1} {entry.name}
                    </div>
                    <div style={{ fontSize: 14, opacity: 0.8 }}>
                      Champion: {getTeamById(entry.bracket.champion)?.name || "None"}
                    </div>
                  </div>
                  <div>
                    <div>{entry.score} pts</div>
                    <div style={{ fontSize: 14, opacity: 0.8 }}>Max left: {entry.maxTotal}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "admin" && (
          <>
            {!adminOpen ? (
              <div
                style={{
                  border: "1px solid #444",
                  borderRadius: 16,
                  padding: 16,
                  background: "#151515",
                }}
              >
                <h2>Admin Access</h2>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <input
                    type="password"
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    placeholder="Admin PIN"
                    style={{ padding: 10 }}
                  />
                  <button onClick={openAdmin}>Open Admin</button>
                </div>
              </div>
            ) : (
              <>
                <div
                  style={{
                    border: "1px solid #444",
                    borderRadius: 16,
                    padding: 16,
                    background: "#151515",
                    marginBottom: 20,
                  }}
                >
                  <h2>Admin Settings</h2>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      value={appState.settings.title}
                      onChange={(e) =>
                        setAppState((prev) => ({
                          ...prev,
                          settings: { ...prev.settings, title: e.target.value },
                        }))
                      }
                      style={{ padding: 10, minWidth: 260 }}
                    />
                    <button
                      onClick={() =>
                        setAppState((prev) => ({
                          ...prev,
                          settings: { ...prev.settings, lockEntries: !prev.settings.lockEntries },
                        }))
                      }
                    >
                      {appState.settings.lockEntries ? "Unlock Entries" : "Lock Entries"}
                    </button>
                    <button onClick={() => saveAdminState(appState)}>Save Admin Changes</button>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 16 }}>
                  {REGION_ORDER.map((regionName) => (
                    <RegionSection
                      key={regionName}
                      regionName={regionName}
                      entry={appState.results}
                      onPick={(path, winnerId) =>
                        setAppState((prev) => ({
                          ...prev,
                          results: updateGameWinner(prev.results, path, winnerId),
                        }))
                      }
                      disabled={false}
                    />
                  ))}
                </div>

                <div style={{ height: 16 }} />

                <FinalRounds
                  entry={appState.results}
                  onPick={(path, winnerId) =>
                    setAppState((prev) => ({
                      ...prev,
                      results: updateGameWinner(prev.results, path, winnerId),
                    }))
                  }
                  disabled={false}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
