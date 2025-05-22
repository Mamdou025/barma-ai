require('dotenv').config();
const express = require('express');
const cors = require('cors');

const bodyParser = require('body-parser');
const uploadRoute = require('./routes/upload');
const chatRoute = require('./routes/chat');
const previewRoute = require('./routes/preview');
const mindmapRoute = require('./routes/mindmap');
const documentsRoute = require('./routes/documents');
const deletedocument = require('./routes/deleteDocument')


const app = express();
const port = 5000;

app.use(cors());
app.use(bodyParser.json());

app.use('/api', uploadRoute.router);

app.use('/api', chatRoute);
app.use('/api', previewRoute);
app.use('/api', mindmapRoute);
app.use('/api', documentsRoute);
app.use('/api', deletedocument);



app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
