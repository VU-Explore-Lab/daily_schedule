function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Handle both JSON and FormData
    let data;
    if (e.postData && e.postData.contents) {
      // JSON format
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter && e.parameter.data) {
      // FormData format
      data = JSON.parse(e.parameter.data);
    } else {
      return returnJson({ result: "error", message: "No data received" });
    }

    // Check if data is an array
    if (!Array.isArray(data)) {
      return returnJson({ result: "error", message: "Expected array of rows" });
    }

    // Add header row if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Time",
        "Category", 
        "Caregiver",
        "Parent Name",
        "Timestamp"
      ]);
    }

    // Add each row to the sheet
    data.forEach(row => {
      sheet.appendRow([
        row.Time || "",
        row.Category || "",
        row.Caregiver || "",
        row.ParentName || "",
        row.Timestamp || new Date().toISOString(),
      ]);
    });

    return returnJson({ result: "success", rows: data.length });

  } catch (err) {
    console.error("Error in doPost:", err);
    return returnJson({ result: "error", message: err.message });
  }
}

function doGet(e) {
  return returnJson({ result: "error", message: "GET not supported" });
}

function doOptions(e) {
  return returnJson({ result: "ok", message: "CORS preflight" });
}

/**
 * Helper: return JSON with CORS headers
 */
function returnJson(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
