const SHEET_ID = "PUT_YOUR_GOOGLE_SHEET_ID_HERE";
const REVIEW_SHEET = "Reviews";
const ESTIMATE_SHEET = "Estimates";

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || "{}");
    const ss = SpreadsheetApp.openById(SHEET_ID);

    if (data.type === "review") {
      let sheet = ss.getSheetByName(REVIEW_SHEET);
      if (!sheet) {
        sheet = ss.insertSheet(REVIEW_SHEET);
        sheet.appendRow(["Submitted", "Name", "Rating", "Review", "Status"]);
      }
      sheet.appendRow([new Date(), data.name || "", data.rating || 5, data.review || "", "Approved"]);
      return json({result:"success"});
    }

    let sheet = ss.getSheetByName(ESTIMATE_SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(ESTIMATE_SHEET);
      sheet.appendRow(["Submitted", "Name", "Phone", "Email", "Service", "Address", "Zip", "Message"]);
    }
    sheet.appendRow([new Date(), data.name || "", data.phone || "", data.email || "", data.service || "", data.address || "", data.zip || "", data.message || ""]);
    return json({result:"success"});
  } catch (err) {
    return json({result:"error", message:err.message});
  }
}

function doGet(e) {
  try {
    if ((e.parameter.action || "") !== "getReviews") return json({result:"error", reviews:[]});
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(REVIEW_SHEET);
    if (!sheet || sheet.getLastRow() < 2) return json({result:"success", reviews:[]});
    const rows = sheet.getRange(2,1,sheet.getLastRow()-1,5).getValues();
    const reviews = rows
      .filter(r => String(r[4]).toLowerCase() === "approved")
      .map(r => ({date: Utilities.formatDate(new Date(r[0]), Session.getScriptTimeZone(), "MM/dd/yyyy"), name:r[1], rating:r[2], review:r[3]}));
    return json({result:"success", reviews:reviews});
  } catch (err) {
    return json({result:"error", message:err.message, reviews:[]});
  }
}
