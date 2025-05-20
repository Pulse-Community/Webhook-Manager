async function formatResponse(response, responseEditor, monaco) {
  const contentType = response.headers.get('content-type') || '';
  const responseText = await response.text();

  if (contentType.includes('application/json')) {
    try {
      const jsonData = JSON.parse(responseText);
      monaco.editor.setModelLanguage(responseEditor.getModel(), 'json');
      return JSON.stringify(jsonData, null, 2);
    } catch (e) {
      monaco.editor.setModelLanguage(responseEditor.getModel(), 'text');
      return responseText;
    }
  } else if (contentType.includes('text/html')) {
    monaco.editor.setModelLanguage(responseEditor.getModel(), 'html');
    return responseText;
  } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
    monaco.editor.setModelLanguage(responseEditor.getModel(), 'xml');
    return responseText;
  } else {
    monaco.editor.setModelLanguage(responseEditor.getModel(), 'text');
    return responseText;
  }
}

module.exports = formatResponse;
