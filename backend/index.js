const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/db');
const authRoutes = require('./routers/auth.routes');
const userRoutes = require('./routers/user.routes');
const messageRoutes = require('./routers/message.routes');

const app = express();

connectDB();

app.use(cors());
app.use(express.json());


app.use('/', authRoutes);
app.use('/chat/users', userRoutes);
app.use('/chat/messages', messageRoutes);



const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});