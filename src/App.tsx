import React, { useMemo, useRef, useState } from "react";

// A single-file React component you can drop into a Vite/CRA app.
// No external libraries required.
// 1) Create a new Vite React app
// 2) Replace App.jsx/tsx with this file's contents
// 3) npm run dev

// ---- Helpers ----
const caregivers = ["Mom", "Dad", "Nanny", "Other"] as const;
const caregiverColors: Record<(typeof caregivers)[number], string> = {
  Mom: "#ffe8ef",   // soft pink
  Dad: "#eaf3ff",   // soft blue
  Nanny: "#eafbea", // soft green
  Other: "#f1effa", // soft purple
};
const activities = [
  "Sleeping",
  "Grooming & dressing",
  "Eating",
  "Indoor play",
  "Outdoor play",
  "Errands (e.g., commuting, grocery)",
  "Baby class",
  "Bathing",
  "Other",
];

// Replace with your Google Apps Script Web App URL
const SUBMISSION_ENDPOINT = "https://script.google.com/macros/s/AKfycbz1Pu1tO7T0n4Ddx4OMlLDBs8W71X-lOFvi58O2YLCvHsUmQn-Qijka2Asz3ySBEN1Z/exec"; 

// Generate 48 half-hour slots as strings, starting 12:00 AM
function buildTimes(): string[] {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const isPM = h >= 12;
      const hour12 = ((h + 11) % 12) + 1; // 0->12, 13->1 etc.
      const mm = m.toString().padStart(2, "0");
      out.push(`${hour12}:${mm} ${isPM ? "PM" : "AM"}`);
    }
  }
  return out;
}

// ---- Component ----
export default function BabyScheduleSurvey() {
  const times = useMemo(buildTimes, []);

  // grid[timeIndex][activityIndex] -> string (caregiver or "")
  const [grid, setGrid] = useState<string[][]>(() =>
    Array.from({ length: times.length }, () => Array(activities.length).fill(""))
  );

  const [yourName, setYourName] = useState("");
  const [selectedCaregiver, setSelectedCaregiver] = useState<(typeof caregivers)[number]>("Nanny");
  const [otherCaregiver, setOtherCaregiver] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isDraggingRef = useRef(false);

  function getSelectedCaregiverLabel(): string {
    if (selectedCaregiver === "Other") {
      const trimmed = otherCaregiver.trim();
      return trimmed.length > 0 ? trimmed : "Other";
    }
    return selectedCaregiver;
  }

  function setCell(ti: number, ai: number, value: string) {
    setGrid((g) => {
      if (g[ti][ai] === value) return g; // no-op
      const next = g.map((row, r) => (r === ti ? [...row] : row));
      next[ti] = [...next[ti]];
      next[ti][ai] = value;
      return [...next];
    });
  }

  function handleMouseDown(ti: number, ai: number) {
    isDraggingRef.current = true;
    setCell(ti, ai, getSelectedCaregiverLabel());
  }
  function handleMouseEnter(ti: number, ai: number) {
    if (!isDraggingRef.current) return;
    setCell(ti, ai, getSelectedCaregiverLabel());
  }
  function handleMouseUp() {
    isDraggingRef.current = false;
  }

  function clearAll() {
    setGrid(Array.from({ length: times.length }, () => Array(activities.length).fill("")));
  }


  async function submitToOwner() {
    if (!SUBMISSION_ENDPOINT) {
      alert("Submission endpoint is not configured yet.");
      return;
    }
    
    setIsSubmitting(true);
    
    // Convert grid to array of objects for your Apps Script
    const data: Array<{
      Time: string;
      Category: string;
      Caregiver: string;
      ParentName: string;
      Timestamp: string;
    }> = [];
    grid.forEach((row, timeIndex) => {
      row.forEach((caregiver, activityIndex) => {
        if (caregiver) { // Only include cells that have a caregiver
          data.push({
            Time: times[timeIndex],
            Category: activities[activityIndex],
            Caregiver: caregiver,
            ParentName: yourName || "",
            Timestamp: new Date().toISOString(),
          });
        }
      });
    });

    try {
      console.log("Submitting data:", data);
      console.log("URL:", SUBMISSION_ENDPOINT);
      
      // Use a different approach to avoid CORS issues
      const formData = new FormData();
      formData.append('data', JSON.stringify(data));
      
      const res = await fetch(SUBMISSION_ENDPOINT, {
        method: "POST",
        body: formData,
      });
      
      console.log("Response status:", res.status);
      console.log("Response headers:", res.headers);
      
      const result = await res.json();
      console.log("Response data:", result);
      
      if (result.result === "success") {
        alert(`Thanks! Your schedule has been submitted. ${result.rows} entries added.`);
      } else {
        throw new Error(result.message || "Submission failed");
      }
    } catch (e: any) {
      console.error("Full error:", e);
      console.error("Error message:", e.message);
      console.error("Error stack:", e.stack);
      alert(`Error: ${e.message}. Check console for details.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  function eraseCell(ti: number, ai: number) {
    setCell(ti, ai, "");
  }

  

  return (
    <div
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", padding: 16 }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Baby Schedule Survey</h1>

      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span>Caregiver's First & Last Name</span>
          <input
            value={yourName}
            onChange={(e) => setYourName(e.target.value)}
            placeholder="Caregiver's First & Last Name"
            style={{ border: "1px solid #ccc", borderRadius: 8, padding: "6px 10px" }}
          />
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span>Choose caregiver</span>
          <select
            value={selectedCaregiver}
            onChange={(e) => setSelectedCaregiver(e.target.value as any)}
            style={{ border: "1px solid #ccc", borderRadius: 8, padding: "6px 10px" }}
          >
            {caregivers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {selectedCaregiver === "Other" && (
            <input
              value={otherCaregiver}
              onChange={(e) => setOtherCaregiver(e.target.value)}
              placeholder="Type caregiver name"
              style={{ border: "1px solid #ccc", borderRadius: 8, padding: "6px 10px" }}
            />
          )}
        </label>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {caregivers.map((c) => (
            <div key={c} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  border: "1px solid #ddd",
                  background: caregiverColors[c],
                  display: "inline-block",
                }}
              />
              <span style={{ fontSize: 12 }}>{c}</span>
            </div>
          ))}
        </div>

        <button onClick={clearAll} style={btnStyle}>Clear all</button>
        <button 
          onClick={submitToOwner} 
          disabled={isSubmitting}
          style={{
            ...btnStyle,
            opacity: isSubmitting ? 0.6 : 1,
            cursor: isSubmitting ? 'not-allowed' : 'pointer'
          }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </button>
      </div>

      <div style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>
        Tip: Click and drag to fill cells with the selected caregiver. Right-click a cell to erase it.
      </div>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>
        Please fill in all the activities that your child does in a typical day
      </div>

      <div style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        overflow: "auto",
        maxHeight: "70vh",
        boxShadow: "0 1px 3px rgba(0,0,0,.05)",
      }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%" }}>
          <thead>
            <tr>
              <th style={thTimeStyle}>Time</th>
              {activities.map((a) => (
                <th key={a} style={thStyle}>{a}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {times.map((t, ti) => (
              <tr key={t}>
                <td style={tdTimeStyle}>{t}</td>
                {activities.map((_, ai) => {
                  const value = grid[ti][ai];
                  return (
                    <td
                      key={ai}
                      onMouseDown={() => handleMouseDown(ti, ai)}
                      onMouseEnter={() => handleMouseEnter(ti, ai)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        eraseCell(ti, ai);
                      }}
                      style={{
                        ...tdStyle,
                        background: value ? ((caregiverColors as any)[value] ?? caregiverColors.Other) : "#fff",
                        borderLeft: ai === 0 ? "1px solid #eee" : undefined,
                      }}
                    >
                      <span style={{ opacity: value ? 1 : 0.2 }}>{value || ""}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
        Saved locally in memory while the page is open. Use Submit to send your entries.
      </div>
    </div>
  );
}

// ---- Styles ----
const btnStyle: React.CSSProperties = {
  border: "1px solid #ccc",
  borderRadius: 10,
  padding: "8px 12px",
  background: "#fafafa",
  cursor: "pointer",
};

const thTimeStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  left: 0,
  zIndex: 3,
  background: "#fafafa",
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #e5e5e5",
  whiteSpace: "nowrap",
};

const thStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 1,
  background: "#fafafa",
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #e5e5e5",
};

const tdTimeStyle: React.CSSProperties = {
  position: "sticky",
  zIndex: 2,
  left: 0,
  background: "#fff",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
  padding: "8px 12px",
  borderBottom: "1px solid #f0f0f0",
  borderRight: "1px solid #eee",
};

const tdStyle: React.CSSProperties = {
  minWidth: 160,
  height: 26,
  padding: "0 10px",
  borderBottom: "1px solid #f5f5f5",
  userSelect: "none",
  cursor: "pointer",
};
