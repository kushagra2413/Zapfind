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

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    await connectToDatabase();
    
    const { stationId } = req.query;
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
}
