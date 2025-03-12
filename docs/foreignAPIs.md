## LeanSearch API Documentation

### Endpoint:
```
GET https://leansearch.net/api/search
```

### Query Parameters:
- `query` (string, required):  
  Natural language query describing a theorem, lemma, or tactic in Lean.
- `num_results` (integer, optional):  
  Number of search results to return (default is 6).

### Example Request:
```http
GET https://leansearch.net/api/search?query=definition+of+continuity&num_results=3
```

### Output Format:
Returns a JSON array with each entry containing:
```json
[
  {
    "id": integer,
    "formal_name": string,
    "formal_type": string (Lean type notation),
    "kind": string (e.g., "theorem", "lemma", "definition"),
    "file_name": string,
    "doc_url": string (link to documentation),
    "docstring": string (description, possibly empty)
  }
  // additional results...
]
```

---

## Moogle API Documentation

### Endpoint:
```
POST https://www.moogle.ai/api/search
```

### JSON Payload Format:
```json
[
  {
    "isFind": boolean,
    "contents": string
  }
]
```

- `isFind`:  
  - `false`: Perform a **natural language** query.
  - `true`: Perform an **exact** (symbolic/theorem name) query.

- `contents`:  
  Query string (natural language or exact, depending on `isFind`).

### Example Request (Natural Language):
```json
[
  {
    "isFind": false,
    "contents": "definition of continuity"
  }
]
```

### Output Format:
Returns JSON object:
```json
{
  "data": [
    {
      "id": string,
      "displayHtml": string (HTML formatted representation),
      "sourceCodeUrl": string (GitHub source link),
      "mathlibPath": string (path in mathlib),
      "moduleImports": array of strings,
      "moduleDocstring": string,
      "declarationDocstring": string,
      "declarationName": string,
      "declarationCode": string (Lean source code),
      "declarationType": string (e.g., "theorem", "def", "lemma")
    }
    // additional results...
  ]
}
```