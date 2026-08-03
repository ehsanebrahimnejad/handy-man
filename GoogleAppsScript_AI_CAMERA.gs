/**
 * ERS HOME SERVICE — AI CAMERA ESTIMATE BACKEND
 *
 * Open this Apps Script project FROM your Google Sheet:
 * Google Sheet > Extensions > Apps Script
 *
 * Required Script Property for real AI analysis:
 * OPENAI_API_KEY = your OpenAI API key
 *
 * Optional Script Property:
 * ESTIMATE_EMAIL = the email that should receive estimate requests
 */

const ESTIMATES_SHEET = "Estimates";
const REVIEWS_SHEET = "Reviews";
const PHOTO_ESTIMATES_SHEET = "Photo Estimates";
const PHOTO_FOLDER_NAME = "ERS Website Estimate Photos";
const DEFAULT_BUSINESS_EMAIL = "e.r.s.home.service@gmail.com";

function doGet(e) {
  try {
    const action = String(
      e && e.parameter && e.parameter.action ? e.parameter.action : ""
    ).toLowerCase();

    if (action === "getreviews") {
      return getReviews();
    }

    return jsonResponse({
      result: "success",
      message: "ERS AI estimate backend is working."
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No form data was received.");
    }

    const data = JSON.parse(e.postData.contents);
    const action = String(data.action || "").toLowerCase();
    const type = String(data.type || "").toLowerCase();

    if (action === "analyzeestimate") {
      return analyzeEstimate(data);
    }

    if (action === "submitphotoestimate" || type === "photoestimate") {
      return submitPhotoEstimate(data);
    }

    const spreadsheet = getSpreadsheet();

    if (type === "review") {
      saveReview(spreadsheet, data);
      sendReviewEmail(data);
      return jsonResponse({
        result: "success",
        message: "Review saved successfully."
      });
    }

    saveEstimate(spreadsheet, data);
    sendEstimateEmail(data);

    return jsonResponse({
      result: "success",
      message: "Estimate request saved and emailed."
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function analyzeEstimate(data) {
  const photos = Array.isArray(data.photos) ? data.photos.slice(0, 5) : [];

  if (!photos.length) {
    throw new Error("At least one project photo is required.");
  }

  const apiKey = PropertiesService
    .getScriptProperties()
    .getProperty("OPENAI_API_KEY");

  if (!apiKey) {
    return jsonResponse({
      result: "success",
      analysis: createFallbackAssessment(data)
    });
  }

  const prompt = [
    "You are assisting ERS Home Service in Columbus, Ohio.",
    "Analyze only what is visibly supported by the customer photos and description.",
    "Do not claim hidden damage is visible.",
    "Provide a preliminary assessment using these headings:",
    "VISIBLE CONDITIONS",
    "LIKELY WORK NEEDED",
    "QUESTIONS OR MISSING INFORMATION",
    "PRELIMINARY PRICE RANGE",
    "SAFETY OR URGENCY NOTES",
    "",
    "The price is only a preliminary range and must be approved by ERS Home Service.",
    "Be concise and practical.",
    "",
    "Service: " + clean(data.service),
    "Measurement: " + clean(data.measurement),
    "Customer description: " + clean(data.description)
  ].join("\n");

  const content = [{
    type: "input_text",
    text: prompt
  }];

  photos.forEach(function(photo) {
    const dataUrl = typeof photo === "string" ? photo : photo.dataUrl;
    if (dataUrl) {
      content.push({
        type: "input_image",
        image_url: dataUrl,
        detail: "auto"
      });
    }
  });

  const payload = {
    model: "gpt-5",
    input: [{
      role: "user",
      content: content
    }]
  };

  const response = UrlFetchApp.fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + apiKey
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    }
  );

  const status = response.getResponseCode();
  const responseText = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error(
      "AI service error (" + status + "): " + responseText.slice(0, 300)
    );
  }

  const result = JSON.parse(responseText);
  const analysis = extractResponseText(result);

  return jsonResponse({
    result: "success",
    analysis: analysis || createFallbackAssessment(data)
  });
}

function submitPhotoEstimate(data) {
  const spreadsheet = getSpreadsheet();
  const photos = Array.isArray(data.photos) ? data.photos.slice(0, 5) : [];

  if (!photos.length) {
    throw new Error("At least one project photo is required.");
  }

  const folder = getOrCreatePhotoFolder();
  const requestFolder = folder.createFolder(
    safeFileName(
      Utilities.formatDate(new Date(), "America/New_York", "yyyy-MM-dd_HH-mm") +
      "_" +
      clean(data.name)
    )
  );

  const photoLinks = [];

  photos.forEach(function(photo, index) {
    const dataUrl = typeof photo === "string" ? photo : photo.dataUrl;
    if (!dataUrl) return;

    const parsed = parseDataUrl(dataUrl);
    const filename = safeFileName(
      (photo.name || "project-photo-" + (index + 1)) + ".jpg"
    );

    const blob = Utilities.newBlob(
      Utilities.base64Decode(parsed.base64),
      parsed.mimeType || "image/jpeg",
      filename
    );

    const file = requestFolder.createFile(blob);
    photoLinks.push(file.getUrl());
  });

  savePhotoEstimate(spreadsheet, data, photoLinks, requestFolder.getUrl());
  sendPhotoEstimateEmail(data, photoLinks, requestFolder.getUrl());

  return jsonResponse({
    result: "success",
    message: "Pictures and estimate request were sent successfully."
  });
}

function savePhotoEstimate(spreadsheet, data, photoLinks, folderUrl) {
  let sheet = spreadsheet.getSheetByName(PHOTO_ESTIMATES_SHEET);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(PHOTO_ESTIMATES_SHEET);
    sheet.appendRow([
      "Date Submitted",
      "Full Name",
      "Phone",
      "Email",
      "Preferred Contact",
      "Service",
      "Measurement",
      "Address",
      "Zip Code",
      "Customer Description",
      "AI Preliminary Assessment",
      "Photo Folder",
      "Photo Links",
      "Status"
    ]);
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    new Date(),
    clean(data.name),
    clean(data.phone),
    clean(data.email),
    clean(data.preferredContact),
    clean(data.service),
    clean(data.measurement),
    clean(data.address),
    clean(data.zip),
    clean(data.description),
    clean(data.aiAnalysis),
    folderUrl,
    photoLinks.join("\n"),
    "New"
  ]);
}

function sendPhotoEstimateEmail(data, photoLinks, folderUrl) {
  const email = getBusinessEmail();
  const body = [
    "A new AI photo estimate request was submitted.",
    "",
    "Name: " + clean(data.name),
    "Phone: " + clean(data.phone),
    "Email: " + clean(data.email),
    "Preferred Contact: " + clean(data.preferredContact),
    "Service: " + clean(data.service),
    "Measurement: " + clean(data.measurement),
    "Address: " + clean(data.address),
    "Zip Code: " + clean(data.zip),
    "",
    "Customer Description:",
    clean(data.description),
    "",
    "AI Preliminary Assessment:",
    clean(data.aiAnalysis) || "No AI analysis was requested.",
    "",
    "Google Drive Photo Folder:",
    folderUrl,
    "",
    "Individual Photo Links:",
    photoLinks.join("\n"),
    "",
    "This is a preliminary visual request. ERS must confirm final scope and price."
  ].join("\n");

  MailApp.sendEmail({
    to: email,
    subject: "New ERS AI Photo Estimate — " + (clean(data.service) || "Service Request"),
    body: body,
    replyTo: clean(data.email) || email,
    name: "ERS Home Service App"
  });
}

function createFallbackAssessment(data) {
  const ranges = {
    "HVAC": "$149–$449 diagnostic or minor repair range; equipment or refrigerant work may be higher.",
    "Plumbing": "$175–$650 for many visible fixture, disposal, toilet, or minor leak repairs.",
    "Electrical": "$175–$600 for many fixture, fan, outlet, or switch projects.",
    "Painting": "$250–$1,200 depending on area, preparation, height, and materials.",
    "Drywall": "$250–$900 depending on patch size, texture, finishing, and painting.",
    "Carpentry": "$250–$1,500 depending on framing, trim, doors, and materials.",
    "Maintenance & Repairs": "$175–$1,000 depending on the number and complexity of repairs.",
    "Commercial Maintenance": "Pricing depends on access, scheduling, scope, and required materials.",
    "Other": "ERS Home Service must review the pictures and project details."
  };

  return [
    "VISIBLE CONDITIONS",
    "The pictures were received for ERS review. Automatic visual AI is not connected yet.",
    "",
    "LIKELY WORK NEEDED",
    "Service category: " + clean(data.service),
    "Customer measurement: " + (clean(data.measurement) || "Not provided"),
    "",
    "PRELIMINARY PRICE RANGE",
    ranges[clean(data.service)] || ranges.Other,
    "",
    "IMPORTANT",
    "This range is not a final quote. Hidden damage, exact materials, permits, access, and site conditions may change the final price."
  ].join("\n");
}

function extractResponseText(result) {
  if (result && typeof result.output_text === "string") {
    return result.output_text;
  }

  const parts = [];

  (result.output || []).forEach(function(item) {
    (item.content || []).forEach(function(content) {
      if (content.type === "output_text" && content.text) {
        parts.push(content.text);
      }
    });
  });

  return parts.join("\n");
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    throw new Error("A photo was not encoded correctly.");
  }

  return {
    mimeType: match[1],
    base64: match[2]
  };
}

function getOrCreatePhotoFolder() {
  const folders = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(PHOTO_FOLDER_NAME);
}

function getSpreadsheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error(
      "No Google Sheet is connected. Open Apps Script from the Google Sheet."
    );
  }

  return spreadsheet;
}

function getBusinessEmail() {
  return PropertiesService
    .getScriptProperties()
    .getProperty("ESTIMATE_EMAIL") || DEFAULT_BUSINESS_EMAIL;
}

function safeFileName(value) {
  const cleaned = clean(value)
    .replace(/[\\/:*?"<>|#%{}[\]]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 100);

  return cleaned || "ERS-Estimate";
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

  sheet.appendRow([
    new Date(),
    clean(data.name),
    Math.min(5, Math.max(1, Number(data.rating) || 5)),
    clean(data.review),
    "Approved"
  ]);
}

function sendEstimateEmail(data) {
  const email = getBusinessEmail();

  MailApp.sendEmail({
    to: email,
    subject: "New ERS Estimate Request — " + (clean(data.service) || "Home Service"),
    body: [
      "Name: " + clean(data.name),
      "Phone: " + clean(data.phone),
      "Email: " + clean(data.email),
      "Service: " + clean(data.service),
      "Address: " + clean(data.address),
      "Zip: " + clean(data.zip),
      "",
      "Project Details:",
      clean(data.message)
    ].join("\n"),
    replyTo: clean(data.email) || email,
    name: "ERS Home Service Website"
  });
}

function sendReviewEmail(data) {
  MailApp.sendEmail({
    to: getBusinessEmail(),
    subject: "New ERS Website Review",
    body: [
      "Name: " + clean(data.name),
      "Rating: " + clean(data.rating),
      "",
      clean(data.review)
    ].join("\n"),
    name: "ERS Home Service Website"
  });
}

function getReviews() {
  const sheet = getSpreadsheet().getSheetByName(REVIEWS_SHEET);

  if (!sheet || sheet.getLastRow() < 2) {
    return jsonResponse({ result: "success", reviews: [] });
  }

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();

  const reviews = rows
    .filter(function(row) {
      return String(row[4] || "").toLowerCase() === "approved";
    })
    .map(function(row) {
      return {
        date: row[0]
          ? Utilities.formatDate(new Date(row[0]), "America/New_York", "MM/dd/yyyy")
          : "",
        name: clean(row[1]),
        rating: Number(row[2]) || 5,
        review: clean(row[3])
      };
    });

  return jsonResponse({ result: "success", reviews: reviews });
}

function clean(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(error) {
  return jsonResponse({
    result: "error",
    message: String(error && error.message ? error.message : error)
  });
}
