require('dotenv').config();
const path = require('path');
const express = require('express');
const ordersRouter = require('./src/routes/orders');
const importRouter = require('./src/routes/import');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', ordersRouter);
app.use('/api', importRouter);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Order tracker running at http://localhost:${port}`);
});
