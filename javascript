function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    // handle data …
    return ContentService
      .createTextOutput(JSON.stringify({ result: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: "error", message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ result: "ready" }))
    .setMimeType(ContentService.MimeType.JSON);
}
