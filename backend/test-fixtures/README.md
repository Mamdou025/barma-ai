# Test fixtures

Local copies of real documents, used to test segmentation/retrieval offline
(without hitting Supabase or OpenAI on every run).

Populate this folder from your Supabase project:

```bash
cd backend
# Export the default doc (codedutravail) as both .txt (full_text) and .pdf:
node scripts/exportFixture.js

# Or export a specific document by id:
node scripts/exportFixture.js <document-id>
```

Then run segmentation against a fixture (no network needed):

```bash
node testSegment.js test-fixtures/codedutravail.txt
```

The `.txt` file is the exact `full_text` the chat/retrieval pipeline reads, so
it reproduces the app's behaviour faithfully.
