import express from 'express';
import mongoose from 'mongoose';
import { Item } from '../models/Item';
import { User } from '../models/User';
import { auth, optionalAuth, requireMongoUser } from '../middleware/auth';
import { getDistance } from 'geolib';

const router = express.Router();

router.get('/suggestions', optionalAuth, async (req: any, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json([]);
    const { q } = req.query;
    if (!q) return res.json([]);
    
    const query = q as string;
    let filter: any = { status: 'available' };
    if (req.user?.userId) filter.owner = { $ne: req.user.userId };

    // Fetch unique categories that match
    const categories = await Item.distinct('category', {
      ...filter,
      category: { $regex: query, $options: 'i' }
    });

    // Fetch items that match title
    const items = await Item.find({ 
      ...filter,
      title: { $regex: query, $options: 'i' }
    }).limit(5).select('title category').lean();
    
    // Combine them into a unified suggestion structure
    const suggestions = [
      ...categories.map(cat => ({ type: 'category', text: cat })),
      ...items.map(item => ({ type: 'item', text: item.title, category: item.category, id: item._id }))
    ];
    
    res.json(suggestions.slice(0, 8));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch suggestions" });
  }
});

router.get('/saved', auth, async (req: any, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json([]);
    const user = await User.findById(req.user.userId).populate({
      path: 'savedItems',
      populate: { path: 'owner', select: 'name avatar rating reviewCount' }
    }).lean();
    res.json(user?.savedItems || []);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch saved items" });
  }
});

router.post('/:id/save', auth, requireMongoUser, async (req: any, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const itemId = req.params.id;
    const isSaved = user.savedItems?.includes(itemId as any);

    if (isSaved) {
      user.savedItems = user.savedItems.filter(id => id.toString() !== itemId);
      await Item.findByIdAndUpdate(itemId, { $inc: { saveCount: -1 } });
    } else {
      user.savedItems.push(itemId as any);
      await Item.findByIdAndUpdate(itemId, { $inc: { saveCount: 1 } });
    }

    await user.save();
    res.json({ saved: !isSaved });
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle save" });
  }
});

router.get('/me', auth, async (req: any, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json([]);
    const items = await Item.find({ owner: req.user.userId }).sort({ createdAt: -1 }).lean();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch your items" });
  }
});

router.post('/:id/view', async (req, res) => {
  try {
    const item = await Item.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true }).maxTimeMS(5000);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json({ views: item.views });
  } catch (error) {
    res.status(500).json({ error: "Failed to increment views" });
  }
});

router.get('/', optionalAuth, async (req: any, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json([]);
    const { q, category, type, lat, lng, radius, excludeSelf } = req.query;
    let query: any = { status: 'available' };
    
    // Default behavior for marketplace: exclude self
    if (req.user?.userId) {
      query.owner = { $ne: req.user.userId };
    }

    if (q) query.$text = { $search: q as string };
    if (category) query.category = category;
    if (type) query.type = type;
    
    if (lat && lng && radius) {
      const userLat = parseFloat(lat as string);
      const userLng = parseFloat(lng as string);
      const maxDistance = parseFloat(radius as string) * 1000; // convert km to meters
      
      query.locationGeo = {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [userLng, userLat] // MongoDB uses [lng, lat]
          },
          $maxDistance: maxDistance
        }
      };
    }
    
    const { sort } = req.query;
    let sortQuery: any = {};

    if (sort === 'popular') sortQuery = { views: -1 };
    else if (sort === 'saved') sortQuery = { saveCount: -1 };
    else if (sort === 'oldest') sortQuery = { createdAt: 1 };
    else if (!lat || !lng) sortQuery = { createdAt: -1 }; // Default: Newest if no proximity
    // If proximity is used (lat/lng/radius), sortQuery stays empty so $near determines sort order (closest first)
    
    const limitNum = parseInt(req.query.limit as string) || 20;

    let items = await Item.find(query)
      .sort(sortQuery)
      .limit(limitNum)
      .populate('owner', 'name avatar rating impactScore reviewCount trustScore reliabilityRate isVerified transactionCount')
      .lean();
    
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

router.post('/:id/reserve', auth, requireMongoUser, async (req: any, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid item ID" });
    }
    const { startDate, endDate } = req.body;
    const item = await Item.findById(req.params.id).maxTimeMS(5000);
    if (!item) return res.status(404).json({ error: "Item not found" });
    
    // Check for overlap in existing reservations
    const overlap = item.reservations.some(res => {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const resStart = new Date(res.startDate);
      const resEnd = new Date(res.endDate);
      return (start < resEnd && end > resStart);
    });
    
    if (overlap) return res.status(400).json({ error: "Node is already occupied for these coordinates in time." });
    
    item.reservations.push({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      user: req.user.userId
    });
    
    // If it's a share, maybe don't mark as reserved globally yet, but let's just keep it simple
    // item.status = 'reserved'; 
    await item.save();
    const populatedItem = await item.populate('owner', 'name avatar rating impactScore reviewCount trustScore reliabilityRate isVerified transactionCount');
    
    // Bonus: increase impact score for both parties?
    await User.findByIdAndUpdate(req.user.userId, { $inc: { impactScore: 5 } });
    await User.findByIdAndUpdate(item.owner, { $inc: { impactScore: 10 } });

    res.json(populatedItem);
  } catch (error) {
    res.status(500).json({ error: "Reservation failed" });
  }
});

  router.post('/', auth, requireMongoUser, async (req: any, res) => {
    try {
      console.log(`Attempting to create item for user: ${req.user.userId}`);
      
      // Auto-populate locationGeo if coordinates are present
      const itemData = { ...req.body, owner: req.user.userId };
      if (itemData.coordinates && itemData.coordinates.lat && itemData.coordinates.lng) {
        itemData.locationGeo = {
          type: 'Point',
          coordinates: [itemData.coordinates.lng, itemData.coordinates.lat]
        };
      }
      
      const item = new Item(itemData);
      await item.save();
      const populatedItem = await item.populate('owner', 'name avatar rating impactScore reviewCount');
      
      // Update impact score for creating a new node
      await User.findByIdAndUpdate(req.user.userId, { $inc: { impactScore: 20 } });
      
      // Emit real-time event to all connected clients
      if ((res as any).locals.io) {
        (res as any).locals.io.emit('new_item', populatedItem);
      }
      
      console.log(`Item created successfully: ${item._id}`);
      res.status(201).json(populatedItem);
    } catch (error) {
      console.error("Item creation error:", error);
      res.status(400).json({ error: "Failed to create item" });
    }
  });

router.post('/:id/renew', auth, requireMongoUser, async (req: any, res) => {
  try {
    const { id } = req.params;
    // Set expiry to 30 days from now
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 30);

    const item = await Item.findOneAndUpdate(
      { _id: id, owner: req.user.userId },
      { $set: { expiresAt: newExpiresAt } },
      { new: true }
    ).populate('owner', 'name avatar rating impactScore reviewCount');

    if (!item) {
      return res.status(404).json({ error: "Item not found or you're not the owner" });
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: "Failed to renew item" });
  }
});

router.patch('/:id', auth, requireMongoUser, async (req: any, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    // Auto-populate locationGeo if coordinates are updated
    if (updateData.coordinates && updateData.coordinates.lat && updateData.coordinates.lng) {
      updateData.locationGeo = {
        type: 'Point',
        coordinates: [updateData.coordinates.lng, updateData.coordinates.lat]
      };
    }

    // Convert keywords string to array if needed
    if (typeof updateData.keywords === 'string') {
      updateData.keywords = updateData.keywords.split(',').map((k: string) => k.trim()).filter((k: string) => k);
    }

    const item = await Item.findOneAndUpdate(
      { _id: id, owner: req.user.userId },
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('owner', 'name avatar rating impactScore reviewCount');

    if (!item) {
      return res.status(404).json({ error: "Item not found or you're not the owner" });
    }

    // Emit update event
    if ((res as any).locals.io) {
      (res as any).locals.io.emit('item_updated', item);
    }

    res.json(item);
  } catch (error) {
    console.error("Item update error:", error);
    res.status(400).json({ error: "Failed to update item" });
  }
});

router.delete('/:id', auth, requireMongoUser, async (req: any, res) => {
  try {
    const item = await Item.findOneAndDelete({ _id: req.params.id, owner: req.user.userId });
    if (!item) return res.status(404).json({ error: "Item not found or you're not the owner" });
    
    // Emit deletion event
    if ((res as any).locals.io) {
      (res as any).locals.io.emit('item_deleted', req.params.id);
    }
    
    res.json({ message: "Item deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete item" });
  }
});

export default router;
