function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  // … do your stuff …
  return ContentService
    .createTextOutput(JSON.stringify({ result: "success" }))
    .setMimeType(ContentService.MimeType.JSON);
}
