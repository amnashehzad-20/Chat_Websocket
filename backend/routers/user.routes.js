const express = require('express');
const userController = require('../controllers/user.controller');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, userController.getAllUsers);
router.get('/search', auth, userController.searchUsers);
router.get('/:id', auth, userController.getUserById);

module.exports = router;