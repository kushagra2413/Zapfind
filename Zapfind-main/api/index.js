const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'https://*.vercel.app', 'https://zapfind.vercel.app'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Accept']
}));
app.use(express.json());

// MongoDB Connection
let isConnected = false;

const connectToDatabase = async () => {
  if (isConnected) {
    return;
  }

  try {
    await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    isConnected = true;
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

// Booking Schema
const bookingSchema = new mongoose.Schema({
    stationId: String,
    stationName: String,
    slotTime: Date,
    userName: String,
    email: String,
    phone: String,
    vehicleNumber: String,
    vehicleType: String,
    status: {
        type: String,
        enum: ['pending', 'confirmed'],
        default: 'confirmed'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

// Enhanced middleware for time and duplicate booking validation
const validateBooking = async (req, res, next) => {
    const bookingTime = new Date(req.body.slotTime);
    
    if (isNaN(bookingTime.getTime())) {
        return res.status(400).json({ 
            error: 'Invalid date format for slotTime' 
        });
    }

    const currentTime = new Date();
    
    if (bookingTime < currentTime) {
        return res.status(400).json({ 
            error: 'Cannot book slots in the past' 
        });
    }

    const existingBooking = await Booking.findOne({
        stationId: req.body.stationId,
        slotTime: bookingTime
    });

    if (existingBooking) {
        return res.status(409).json({ 
            error: 'This slot is already booked',
            isSlotTaken: true
        });
    }

    next();
};

// Firebase Config Endpoint
app.get('/firebase-config', (req, res) => {
    console.log("Firebase config requested");
    res.json({
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: "",
        messagingSenderId: "",
        appId: ""
    });
});

// API Routes
app.get('/api/slots/:stationId', async (req, res) => {
    try {
        await connectToDatabase();
        
        const { stationId } = req.params;
        const requestDate = new Date(req.query.date);
        
        if (isNaN(requestDate.getTime())) {
            return res.status(400).json({ error: 'Invalid date format' });
        }

        const currentTime = new Date();
        const requestDateOnly = new Date(requestDate.getFullYear(), requestDate.getMonth(), requestDate.getDate());
        const currentDateOnly = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate());

        if (requestDateOnly < currentDateOnly) {
            return res.json([]);
        }

        const bookings = await Booking.find({
            stationId,
            slotTime: {
                $gte: requestDateOnly,
                $lt: new Date(requestDateOnly.getTime() + 24 * 60 * 60 * 1000)
            }
        });

        const slots = [];
        const isToday = requestDateOnly.getTime() === currentDateOnly.getTime();

        for (let hour = 6; hour <= 22; hour++) {
            for (let minute of [0, 30]) {
                const slotTime = new Date(requestDate);
                slotTime.setHours(hour, minute, 0, 0);
                
                if (isToday && slotTime < currentTime) {
                    continue;
                }

                const isBooked = bookings.some(booking => 
                    booking.slotTime.getTime() === slotTime.getTime()
                );

                slots.push({
                    time: slotTime,
                    isAvailable: !isBooked
                });
            }
        }

        slots.sort((a, b) => new Date(a.time) - new Date(b.time));
        res.json(slots);
    } catch (error) {
        console.error('Error fetching slots:', error);
        res.status(500).json({ error: 'Error fetching slots' });
    }
});

app.post('/api/bookings', validateBooking, async (req, res) => {
    try {
        await connectToDatabase();
        
        const booking = new Booking(req.body);
        await booking.save();

        res.json({ 
            success: true, 
            booking,
            message: `Booking confirmed at ${booking.stationName} for ${new Date(booking.slotTime).toLocaleString()}`,
            bookingId: booking._id
        });
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({ 
            error: 'Error creating booking',
            details: error.message 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Handle all other routes
app.all('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

module.exports = app;
