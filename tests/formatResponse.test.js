const formatResponse = require('../formatResponse');

describe('formatResponse', () => {
  let monaco;
  let model;
  let responseEditor;

  beforeEach(() => {
    model = {};
    responseEditor = { getModel: jest.fn(() => model) };
    monaco = { editor: { setModelLanguage: jest.fn() } };
  });

  function createResponse(body, contentType) {
    return {
      headers: {
        get: (name) => (name === 'content-type' ? contentType : undefined)
      },
      text: () => Promise.resolve(body)
    };
  }

  test('handles JSON', async () => {
    const resp = createResponse('{"a":1}', 'application/json');
    const result = await formatResponse(resp, responseEditor, monaco);
    expect(monaco.editor.setModelLanguage).toHaveBeenCalledWith(model, 'json');
    expect(result).toBe(JSON.stringify({ a: 1 }, null, 2));
  });

  test('handles invalid JSON as text', async () => {
    const resp = createResponse('invalid', 'application/json');
    const result = await formatResponse(resp, responseEditor, monaco);
    expect(monaco.editor.setModelLanguage).toHaveBeenCalledWith(model, 'text');
    expect(result).toBe('invalid');
  });

  test('handles HTML', async () => {
    const resp = createResponse('<p>hi</p>', 'text/html');
    const result = await formatResponse(resp, responseEditor, monaco);
    expect(monaco.editor.setModelLanguage).toHaveBeenCalledWith(model, 'html');
    expect(result).toBe('<p>hi</p>');
  });

  test('handles XML', async () => {
    const resp = createResponse('<root/>', 'application/xml');
    const result = await formatResponse(resp, responseEditor, monaco);
    expect(monaco.editor.setModelLanguage).toHaveBeenCalledWith(model, 'xml');
    expect(result).toBe('<root/>');
  });

  test('handles text', async () => {
    const resp = createResponse('plain', 'text/plain');
    const result = await formatResponse(resp, responseEditor, monaco);
    expect(monaco.editor.setModelLanguage).toHaveBeenCalledWith(model, 'text');
    expect(result).toBe('plain');
  });
});
