/**
 * ERS HOME SERVICE — ESTIMATE EMAIL BACKEND
 *
 * PURPOSE
 * - Receives estimate requests from the ERS website
 * - Saves each request in the connected Google Sheet
 * - Emails each request to e.r.s.home.service@gmail.com
 * - Saves and loads website reviews
 *
 * IMPORTANT
 * Open Apps Script FROM the Google Sheet:
 * Google Sheet > Extensions > Apps Script
 */

const BUSINESS_EMAIL = "e.r.s.home.service@gmail.com";
const ESTIMATES_SHEET_NAME = "Estimates";
const REVIEWS_SHEET_NAME = "Reviews";

/**
 * Open the deployed /exec URL in a browser.
 * A success JSON message confirms that the web app is reachable.
 */
function doGet(e) {
  try {
    const action = String(
      e && e.parameter && e.parameter.action
        ? e.parameter.action
        : ""
    ).toLowerCase();

    if (action === "getreviews") {
      return getApprovedReviews();
    }

    return jsonResponse({
      result: "success",
      message: "ERS Home Service estimate and email system is working."
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Receives website form submissions.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No form information was received.");
    }

    const data = JSON.parse(e.postData.contents);
    const type = String(data.type || "estimate").toLowerCase();

    if (type === "review") {
      saveReview(data);
      emailReview(data);

      return jsonResponse({
        result: "success",
        message: "Review saved successfully."
      });
    }

    saveEstimate(data);
    emailEstimate(data);

    return jsonResponse({
      result: "success",
      message: "Estimate request saved and emailed successfully."
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Saves an estimate request in the Estimates tab.
 */
function saveEstimate(data) {
  const spreadsheet = getConnectedSpreadsheet();
  let sheet = spreadsheet.getSheetByName(ESTIMATES_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(ESTIMATES_SHEET_NAME);

    sheet.appendRow([
      "Date Submitted",
      "Customer Name",
      "Phone",
      "Email",
      "Service",
      "Address",
      "Zip Code",
      "Project Details",
      "Status"
    ]);

    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 9).setFontWeight("bold");
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

/**
 * Emails the estimate request to ERS.
 */
function emailEstimate(data) {
  const customerName = clean(data.name) || "Customer";
  const customerEmail = clean(data.email);

  const subject =
    "NEW ERS ESTIMATE — " +
    (clean(data.service) || "Home Service") +
    " — " +
    customerName;

  const body = [
    "A new estimate request was submitted from the ERS website.",
    "",
    "CUSTOMER INFORMATION",
    "Name: " + customerName,
    "Phone: " + clean(data.phone),
    "Email: " + customerEmail,
    "",
    "PROJECT INFORMATION",
    "Service: " + clean(data.service),
    "Address: " + clean(data.address),
    "Zip Code: " + clean(data.zip),
    "",
    "PROJECT DETAILS",
    clean(data.message),
    "",
    "Submitted: " + new Date(),
    "",
    "Reply to this email or contact the customer using the information above."
  ].join("\n");

  const options = {
    to: BUSINESS_EMAIL,
    subject: subject,
    body: body,
    name: "ERS Home Service Website"
  };

  if (customerEmail) {
    options.replyTo = customerEmail;
  }

  MailApp.sendEmail(options);
}

/**
 * Saves a website review.
 */
function saveReview(data) {
  const spreadsheet = getConnectedSpreadsheet();
  let sheet = spreadsheet.getSheetByName(REVIEWS_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(REVIEWS_SHEET_NAME);

    sheet.appendRow([
      "Date Submitted",
      "Customer Name",
      "Rating",
      "Review",
      "Approval Status"
    ]);

    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 5).setFontWeight("bold");
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

/**
 * Emails a new review notification.
 */
function emailReview(data) {
  const body = [
    "A new website review was submitted.",
    "",
    "Name: " + clean(data.name),
    "Rating: " + clean(data.rating) + " stars",
    "",
    "Review:",
    clean(data.review),
    "",
    "Submitted: " + new Date()
  ].join("\n");

  MailApp.sendEmail({
    to: BUSINESS_EMAIL,
    subject: "New ERS Website Review",
    body: body,
    name: "ERS Home Service Website"
  });
}

/**
 * Returns approved reviews to the website.
 */
function getApprovedReviews() {
  const spreadsheet = getConnectedSpreadsheet();
  const sheet = spreadsheet.getSheetByName(REVIEWS_SHEET_NAME);

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

/**
 * RUN THIS FUNCTION ONCE before deployment.
 *
 * It sends a test email and asks Google for the required permissions.
 */
function TEST_EMAIL_NOW() {
  MailApp.sendEmail({
    to: BUSINESS_EMAIL,
    subject: "ERS Website Email Test — SUCCESS",
    body: [
      "This test email confirms that Google Apps Script can send",
      "ERS website estimate notifications to this address.",
      "",
      "Test time: " + new Date()
    ].join("\n"),
    name: "ERS Home Service Website"
  });

  Logger.log(
    "Test email sent to " + BUSINESS_EMAIL
  );
}

/**
 * Optional test that creates a sample estimate row and email.
 */
function TEST_FULL_ESTIMATE_NOW() {
  const sample = {
    type: "estimate",
    name: "ERS Test Customer",
    phone: "(614) 000-0000",
    email: BUSINESS_EMAIL,
    service: "Test Estimate",
    address: "Test Address",
    zip: "43200",
    message: "This is a test submission from Google Apps Script."
  };

  saveEstimate(sample);
  emailEstimate(sample);

  Logger.log("Full estimate test completed.");
}

function getConnectedSpreadsheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error(
      "No Google Sheet is connected. Open Apps Script from the Google Sheet using Extensions > Apps Script."
    );
  }

  return spreadsheet;
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

function errorResponse(error) {
  return jsonResponse({
    result: "error",
    message: String(
      error && error.message
        ? error.message
        : error
    )
  });
}
