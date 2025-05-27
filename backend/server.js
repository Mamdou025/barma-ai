require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

console.log('🔧 Adding body parsing middleware...');
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


const uploadRoute = require('./routes/upload');
const chatRoute = require('./routes/chat');
const previewRoute = require('./routes/preview');
const mindmapRoute = require('./routes/mindmap');
const documentsRoute = require('./routes/documents');
const deletedocument = require('./routes/deleteDocument')
const chatLogsRoute = require('./routes/chatlogs'); // 🆕 ADD THIS
const notesRoute = require('./routes/notes'); // 🆕 NEW






app.use(cors());

app.use('/api', uploadRoute);
app.use('/api', chatRoute);
app.use('/api', previewRoute);
app.use('/api', mindmapRoute);
app.use('/api', documentsRoute);
app.use('/api', deletedocument);
app.use('/api', chatLogsRoute); // 🆕 NEW
app.use('/api', notesRoute); // 🆕 NEW



app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
