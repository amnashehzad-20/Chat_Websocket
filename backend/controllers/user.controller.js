const User = require('../models/user');

const userController = {
  getAllUsers: async (req, res) => {
    try {
      // Get all users except the current user
      const users = await User.find({ _id: { $ne: req.user._id } })
        .select('username email isOnline lastSeen')
        .sort({ username: 1 });

      res.json({ users });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  getUserById: async (req, res) => {
    try {
      const user = await User.findById(req.params.id)
        .select('username email isOnline lastSeen');

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ user });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  searchUsers: async (req, res) => {
    try {
      const { query } = req.query;
      
      if (!query) {
        return res.status(400).json({ message: 'Search query is required' });
      }

      const users = await User.find({
        $and: [
          { _id: { $ne: req.user._id } },
          {
            $or: [
              { username: { $regex: query, $options: 'i' } },
              { email: { $regex: query, $options: 'i' } }
            ]
          }
        ]
      }).select('username email isOnline lastSeen');

      res.json({ users });
    } catch (error) {
      console.error('Search users error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
};

module.exports = userController;