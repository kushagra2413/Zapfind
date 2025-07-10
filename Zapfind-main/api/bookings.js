import mongoose from 'mongoose';

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

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    await connectToDatabase();

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
}
