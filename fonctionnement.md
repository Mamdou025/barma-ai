Document processing pipeline
User uploads a PDF from the UI

The upload button component sends the file to the backend through api.uploadDocument once the file passes client‑side validation

Backend ingests the file

POST /api/upload stores the PDF via Multer, parses text with pdf-parse, saves the file and metadata to Supabase, and generates OpenAI embeddings for each chunk, writing them to the chunks table

Documents become available for selection

The sidebar fetches stored documents from GET /api/documents and updates the list so the user can choose which file to chat about

User sends a question about a document

The chat component submits the prompt and selected document ID(s) through api.sendMessage, which calls the backend /api/chat endpoint

Backend retrieves context and generates the reply

/api/chat embeds the user question, retrieves the most relevant document chunks by cosine similarity, crafts a system prompt, sends context and prompt to OpenAI Chat Completions, logs the interaction, and returns the AI response

UI displays the response

The returned reply is appended to the message list and rendered in the chat interface