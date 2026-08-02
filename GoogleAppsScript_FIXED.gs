/**
 * ERS HOME SERVICE — GOOGLE APPS SCRIPT BACKEND
 *
 * IMPORTANT:
 * Put this code inside Apps Script opened FROM your Google Sheet:
 * Google Sheet > Extensions > Apps Script
 *
 * This script automatically uses that Google Sheet.
 */

const ESTIMATES_SHEET = "Estimates";
const REVIEWS_SHEET = "Reviews";

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({
        result: "error",
        message: "No form data was received."
      });
    }

    const data = JSON.parse(e.postData.contents);
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    if (!spreadsheet) {
      throw new Error(
        "No Google Sheet is connected. Open Apps Script from the Google Sheet using Extensions > Apps Script."
      );
    }

    if (String(data.type || "").toLowerCase() === "review") {
      saveReview(spreadsheet, data);
      return jsonResponse({
        result: "success",
        message: "Review saved successfully."
      });
    }

    saveEstimate(spreadsheet, data);

    return jsonResponse({
      result: "success",
      message: "Estimate request saved successfully."
    });
  } catch (error) {
    return jsonResponse({
      result: "error",
      message: String(error && error.message ? error.message : error)
    });
  }
}

function doGet(e) {
  try {
    const action = String(
      e && e.parameter && e.parameter.action
        ? e.parameter.action
        : ""
    ).toLowerCase();

    if (action === "getreviews") {
      return getReviews();
    }

    return jsonResponse({
      result: "success",
      message: "ERS Home Service web app is working."
    });
  } catch (error) {
    return jsonResponse({
      result: "error",
      message: String(error && error.message ? error.message : error)
    });
  }
}

function saveEstimate(spreadsheet, data) {
  let sheet = spreadsheet.getSheetByName(ESTIMATES_SHEET);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(ESTIMATES_SHEET);
    sheet.appendRow([
      "Date Submitted",
      "Full Name",
      "Phone",
      "Email",
      "Service",
      "Address",
      "Zip Code",
      "Project Details",
      "Status"
    ]);

    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    new Date(),
    clean(data.name),
    clean(data.phone),
    clean(data.email),
    clean(data.service),
    clean(data.address),
    clean(data.zip),
    clean(data.message),
    "New"
  ]);
}

function saveReview(spreadsheet, data) {
  let sheet = spreadsheet.getSheetByName(REVIEWS_SHEET);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(REVIEWS_SHEET);
    sheet.appendRow([
      "Date Submitted",
      "Customer Name",
      "Rating",
      "Review",
      "Approval Status"
    ]);

    sheet.setFrozenRows(1);
  }

  const rating = Math.min(
    5,
    Math.max(1, Number(data.rating) || 5)
  );

  sheet.appendRow([
    new Date(),
    clean(data.name),
    rating,
    clean(data.review),
    "Approved"
  ]);
}

function getReviews() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error(
      "No Google Sheet is connected. Open Apps Script from the Google Sheet."
    );
  }

  const sheet = spreadsheet.getSheetByName(REVIEWS_SHEET);

  if (!sheet || sheet.getLastRow() < 2) {
    return jsonResponse({
      result: "success",
      reviews: []
    });
  }

  const rows = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 5)
    .getValues();

  const timezone =
    spreadsheet.getSpreadsheetTimeZone() ||
    Session.getScriptTimeZone() ||
    "America/New_York";

  const reviews = rows
    .filter(function(row) {
      return String(row[4] || "").toLowerCase() === "approved";
    })
    .map(function(row) {
      return {
        date: row[0]
          ? Utilities.formatDate(
              new Date(row[0]),
              timezone,
              "MM/dd/yyyy"
            )
          : "",
        name: clean(row[1]),
        rating: Number(row[2]) || 5,
        review: clean(row[3])
      };
    });

  return jsonResponse({
    result: "success",
    reviews: reviews
  });
}

function clean(value) {
  return value === null || value === undefined
    ? ""
    : String(value).trim();
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
