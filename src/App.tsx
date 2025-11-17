import React, { useMemo, useRef, useState } from "react";

// A single-file React component you can drop into a Vite/CRA app.
// No external libraries required.
// 1) Create a new Vite React app
// 2) Replace App.jsx/tsx with this file's contents
// 3) npm run dev

// ---- Helpers ----
const caregivers = ["Mom", "Dad", "Childcare", "Other", "None (e.g., sleeping)"] as const;
const caregiverColors: Record<(typeof caregivers)[number], string> = {
  Mom: "#ffe8ef",   // soft pink
  Dad: "#eaf3ff",   // soft blue
  "Childcare": "#eafbea", // soft green
  Other: "#f1effa", // soft purple
  "None (e.g., sleeping)": "#f5f5f5", // soft gray
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

  // grid[timeIndex][activityIndex] -> string (comma-separated caregivers)
  const [grid, setGrid] = useState<string[][]>(() =>
    Array.from({ length: times.length }, () => Array(activities.length).fill(""))
  );

  const [yourName, setYourName] = useState("");
  const [selectedCaregivers, setSelectedCaregivers] = useState<Set<(typeof caregivers)[number]>>(new Set());
  const [otherCaregiver, setOtherCaregiver] = useState("");
  const [caregiverEmails, setCaregiverEmails] = useState("");
  const [typicalWeekNote, setTypicalWeekNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isDraggingRef = useRef(false);
  const verticalScrollRef = useRef<HTMLDivElement | null>(null);

  function getSelectedCaregiverLabels(): string[] {
    const labels: string[] = [];
    selectedCaregivers.forEach((cg) => {
      if (cg === "Other") {
        const trimmed = otherCaregiver.trim();
        labels.push(trimmed.length > 0 ? trimmed : "Other");
      } else {
        labels.push(cg);
      }
    });
    return labels;
  }

  function toggleCaregiver(caregiver: (typeof caregivers)[number]) {
    setSelectedCaregivers((prev) => {
      const next = new Set(prev);
      if (next.has(caregiver)) {
        next.delete(caregiver);
      } else {
        next.add(caregiver);
      }
      return next;
    });
  }

  function setCell(ti: number, ai: number, caregiversToAdd: string[]) {
    setGrid((g) => {
      const currentValue = g[ti][ai] || "";
      const currentCaregivers = currentValue ? currentValue.split(", ") : [];
      
      // Merge: add new caregivers, keep existing ones
      const merged = new Set([...currentCaregivers, ...caregiversToAdd]);
      const newValue = Array.from(merged).join(", ");
      
      if (g[ti][ai] === newValue) return g; // no-op
      const next = g.map((row, r) => (r === ti ? [...row] : row));
      next[ti] = [...next[ti]];
      next[ti][ai] = newValue;
      return [...next];
    });
  }

  // Deprecated: per-cell pointer handlers (replaced by container-level handlers)
  function handlePointerUp() {
    isDraggingRef.current = false;
  }
  function handlePointerCancel() {
    isDraggingRef.current = false;
  }

  // Container-level dragging for reliable touch painting across cells
  function paintCellAtPoint(clientX: number, clientY: number) {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const tdEl = el?.closest('td[data-ti][data-ai]') as HTMLElement | null;
    if (!tdEl) return;
    const tiStr = tdEl.getAttribute('data-ti');
    const aiStr = tdEl.getAttribute('data-ai');
    if (tiStr == null || aiStr == null) return;
    const ti = parseInt(tiStr, 10);
    const ai = parseInt(aiStr, 10);
    if (Number.isNaN(ti) || Number.isNaN(ai)) return;
    const labels = getSelectedCaregiverLabels();
    if (labels.length > 0) {
      setCell(ti, ai, labels);
    }
  }

  function containerPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    isDraggingRef.current = true;
    paintCellAtPoint(e.clientX, e.clientY);
  }
  function containerPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    paintCellAtPoint(e.clientX, e.clientY);
  }
  function containerPointerUp() {
    isDraggingRef.current = false;
  }
  function containerPointerCancel() {
    isDraggingRef.current = false;
  }

  // On mount: scroll vertically to show 8:00 AM at the top of the viewport
  React.useEffect(() => {
    const container = verticalScrollRef.current;
    if (!container) return;
    // Index of 8:00 AM in 30-min slots from midnight
    const eightAmIndex = 16; // 8 * 2
    const target = container.querySelector(`td[data-ti="${eightAmIndex}"]`) as HTMLElement | null;
    if (!target) return;
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const delta = targetRect.top - containerRect.top;
    container.scrollTop += delta;
  }, []);

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
      CaregiverEmails: string;
      TypicalWeekNote: string;
      Timestamp: string;
    }> = [];
    grid.forEach((row, timeIndex) => {
      row.forEach((caregiverStr, activityIndex) => {
        if (caregiverStr) { // Only include cells that have caregivers
          const caregiversList = caregiverStr.split(", ");
          caregiversList.forEach((caregiver) => {
            data.push({
              Time: times[timeIndex],
              Category: activities[activityIndex],
              Caregiver: caregiver,
              ParentName: yourName || "",
              CaregiverEmails: caregiverEmails || "",
              TypicalWeekNote: typicalWeekNote || "",
              Timestamp: new Date().toISOString(),
            });
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
    setGrid((g) => {
      const next = g.map((row, r) => (r === ti ? [...row] : row));
      next[ti] = [...next[ti]];
      next[ti][ai] = "";
      return [...next];
    });
  }

  

  return (
    <div
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", padding: 16 }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>Baby Schedule Survey</h1>

      {/* Instructions Header */}
      <div style={{ 
        backgroundColor: "#f8f9fa", 
        border: "1px solid #dee2e6", 
        borderRadius: 8, 
        padding: 20, 
        marginBottom: 24,
        fontSize: 14,
        lineHeight: 1.6
      }}>
        <p style={{ fontWeight: 600, marginBottom: 16, color: "#d63384" }}>
          Note: This form works best on a computer!
        </p>
        
        <div style={{ marginBottom: 20 }}>
          <p style={{ marginBottom: 8 }}>
            <strong>First & last name of person filling out form</strong> (this name will be used to link your schedule to your survey responses)
          </p>
          <input
            value={yourName}
            onChange={(e) => setYourName(e.target.value)}
            placeholder="First & Last Name"
            style={{ border: "1px solid #ccc", borderRadius: 8, padding: "8px 12px", width: "100%", maxWidth: 500, fontSize: 14 }}
          />
        </div>
        
        <div style={{ marginBottom: 20 }}>
          <p style={{ marginBottom: 8 }}>
            <strong>Email of person filling out form</strong> (your gift card will be sent to this address)
          </p>
          <input
            value={caregiverEmails}
            onChange={(e) => setCaregiverEmails(e.target.value)}
            placeholder="your.email@example.com"
            type="email"
            style={{ border: "1px solid #ccc", borderRadius: 8, padding: "8px 12px", width: "100%", maxWidth: 500, fontSize: 14 }}
          />
        </div>
        
        <p style={{ marginBottom: 16 }}>
          We would like to know what your baby does in a typical day. We will ask you to describe your child's most common daily schedule. For example, if your child spends 5 days at daycare, 1 weekend day with Grandma, and 1 weekend day at home, you would describe their daily schedule on a "daycare day."
        </p>
        
        <div style={{ marginBottom: 20 }}>
          <p style={{ marginBottom: 8 }}>
            <strong>Please write a brief note describing your child's typical week and the typical day you are describing</strong> (e.g., my child goes to daycare 5 days a week, spends 1 weekend day with Grandma, and spends 1 weekend day at home. I am describing a "daycare day").
          </p>
          <textarea
            value={typicalWeekNote}
            onChange={(e) => setTypicalWeekNote(e.target.value)}
            placeholder="e.g., my child goes to daycare 5 days a week, spends 1 weekend day with Grandma, and spends 1 weekend day at home. I am describing a 'daycare day'."
            rows={3}
            style={{ border: "1px solid #ccc", borderRadius: 8, padding: "8px 12px", width: "100%", maxWidth: 500, fontFamily: "inherit", resize: "vertical", fontSize: 14 }}
          />
        </div>
        
        <p style={{ marginBottom: 16 }}>
          Using the table below, mark the times that your child does each activity. Also note the caregiver(s) responsible for your child during these activities. Try to mark an activity for all possible times.
        </p>
        
        <p style={{ marginBottom: 12 }}>
          <strong>First, choose a caregiver (or multiple caregivers) from the checkboxes below.</strong> Then click and drag to highlight the times that your child does each activity in the corresponding column. Multiple activities can occur at the same times.
        </p>
        
        <p style={{ marginBottom: 12 }}>
          For example, if your child eats with Mom from 7:00 am – 7:30 am and then plays indoors with Dad from 9:00 am – 11:00 am you would fill in the columns like this:
        </p>
        
        <p style={{ marginBottom: 12, fontStyle: "italic", color: "#666" }}>
          [Picture/Video example would go here]
        </p>
        
        <p style={{ marginBottom: 8 }}>
          You can right click to de-select a time. You can hit "clear all" to clear the entire form.
        </p>
        
        <p style={{ marginBottom: 0 }}>
          When you are finished hit "Submit". While the form is submitting the submit button will say "submitting…" Please do not close your browser until a pop-up appears and says your responses were submitted.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start", marginBottom: 12 }}>

        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontWeight: 500, marginBottom: 4 }}>Select caregiver(s) (you can select multiple):</span>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              {caregivers.map((c) => (
                <label key={c} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={selectedCaregivers.has(c)}
                    onChange={() => toggleCaregiver(c)}
                    style={{ width: 18, height: 18, cursor: "pointer" }}
                  />
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      border: "1px solid #ddd",
                      background: caregiverColors[c],
                      display: "inline-block",
                    }}
                  />
                  <span style={{ fontSize: 14 }}>{c}</span>
                </label>
              ))}
            </div>
            {selectedCaregivers.has("Other") && (
              <input
                value={otherCaregiver}
                onChange={(e) => setOtherCaregiver(e.target.value)}
                placeholder="Type caregiver name"
                style={{ border: "1px solid #ccc", borderRadius: 8, padding: "6px 10px", marginTop: 8, maxWidth: 300 }}
              />
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
          <button onClick={clearAll} style={btnStyle}>Clear all</button>
          <button 
            onClick={submitToOwner} 
            disabled={isSubmitting || selectedCaregivers.size === 0}
            style={{
              ...btnStyle,
              opacity: (isSubmitting || selectedCaregivers.size === 0) ? 0.6 : 1,
              cursor: (isSubmitting || selectedCaregivers.size === 0) ? 'not-allowed' : 'pointer'
            }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>

      <div style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>
        Tip: Select one or more caregivers using the checkboxes above, then click and drag to fill cells. Right-click a cell to erase it.
      </div>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>
        Please fill in all the activities that your child does in a typical day
      </div>

      <div
        ref={verticalScrollRef}
        onPointerDown={containerPointerDown}
        onPointerMove={containerPointerMove}
        onPointerUp={containerPointerUp}
        onPointerCancel={containerPointerCancel}
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          overflow: "auto",
          maxHeight: "70vh",
          boxShadow: "0 1px 3px rgba(0,0,0,.05)",
          WebkitOverflowScrolling: "touch",
          touchAction: "none",
        }}
      >
        <table className="grid-table" style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", tableLayout: "fixed" }}>
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
                  const value = grid[ti][ai] || "";
                  const caregiversList = value ? value.split(", ") : [];
                  // Use the first caregiver's color, or a gradient if multiple
                  const bgColor = caregiversList.length > 0 
                    ? (caregiverColors[caregiversList[0] as keyof typeof caregiverColors] ?? caregiverColors.Other)
                    : "#fff";
                  return (
                    <td
                      key={ai}
                      data-ti={ti}
                      data-ai={ai}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        eraseCell(ti, ai);
                      }}
                      style={{
                        ...tdStyle,
                        background: bgColor,
                        borderLeft: ai === 0 ? "1px solid #eee" : undefined,
                      }}
                      title={value || ""}
                    >
                      <span style={{ opacity: value ? 1 : 0.2, fontSize: 11 }}>
                        {caregiversList.length > 0 ? caregiversList.join(", ") : ""}
                      </span>
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
  borderRadius: 8,
  padding: "6px 10px",
  background: "#fafafa",
  cursor: "pointer",
  fontSize: 14,
};

const thTimeStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  left: 0,
  zIndex: 10,
  background: "#fafafa",
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "2px solid #e5e5e5",
  whiteSpace: "nowrap",
  width: 120,
  boxShadow: "0 2px 4px rgba(0,0,0,.1)",
};

const thStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 9,
  background: "#fafafa",
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "2px solid #e5e5e5",
  boxShadow: "0 2px 4px rgba(0,0,0,.1)",
};

const tdTimeStyle: React.CSSProperties = {
  position: "sticky",
  zIndex: 8,
  left: 0,
  background: "#fff",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
  padding: "8px 12px",
  borderBottom: "1px solid #f0f0f0",
  borderRight: "1px solid #eee",
  width: 120,
  boxShadow: "2px 0 4px rgba(0,0,0,.05)",
};

const tdStyle: React.CSSProperties = {
  minWidth: 120,
  height: 26,
  padding: "0 10px",
  borderBottom: "1px solid #f5f5f5",
  userSelect: "none",
  cursor: "pointer",
  touchAction: "none",
};
