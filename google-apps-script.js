function doPost(e) {
  try {
    // Get or create the spreadsheet
    // Option 1: Use a specific spreadsheet by ID (replace with your spreadsheet ID)
    const spreadsheetId = '1k2Xymdzh0Lw9E4v9wsa7w58ivTxtFTey39M5F0xrBQM';
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    
    // Option 2: Use the active spreadsheet (the one where the script is deployed)
    // const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const spreadsheetName = spreadsheet.getName();
    
    // Get or create the "Schedule Data" sheet
    let sheet = spreadsheet.getSheetByName("Schedule Data");
    if (!sheet) {
      sheet = spreadsheet.insertSheet("Schedule Data");
    }
    
    // Handle both JSON and FormData
    let data;
    if (e.postData && e.postData.contents) {
      // JSON format
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter && e.parameter.data) {
      // FormData format
      data = JSON.parse(e.parameter.data);
    } else {
      return returnJson({ 
        result: "error", 
        message: "No data received. Parameters: " + JSON.stringify(Object.keys(e.parameter || {})) 
      });
    }

    // Check if data is an array
    if (!Array.isArray(data)) {
      return returnJson({ 
        result: "error", 
        message: "Expected array of rows, got: " + typeof data 
      });
    }

    // Add header row if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Timestamp",
        "Time",
        "Category", 
        "Caregiver",
        "Parent Name",
        "Caregiver Emails",
        "Typical Week Note"
      ]);
      
      // Format header row
      const headerRange = sheet.getRange(1, 1, 1, 7);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#4285f4");
      headerRange.setFontColor("#ffffff");
    }

    // Add each row to the sheet
    let rowsAdded = 0;
    data.forEach(row => {
      sheet.appendRow([
        row.Timestamp || new Date().toISOString(),
        row.Time || "",
        row.Category || "",
        row.Caregiver || "",
        row.ParentName || "",
        row.CaregiverEmails || "",
        row.TypicalWeekNote || ""
      ]);
      rowsAdded++;
    });

    return returnJson({ 
      result: "success", 
      rows: rowsAdded,
      spreadsheet: spreadsheetName,
      sheet: "Schedule Data"
    });

  } catch (err) {
    Logger.log("Error in doPost: " + err.toString());
    Logger.log("Stack: " + err.stack);
    return returnJson({ 
      result: "error", 
      message: err.toString(),
      stack: err.stack
    });
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
