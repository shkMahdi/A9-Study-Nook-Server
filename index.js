const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.8.4"]);

const dotenv = require('dotenv');
const cors = require("cors");
dotenv.config();

const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
const app = express()

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
}));
app.use(express.json());

const PORT = process.env.PORT || 5000;

const uri = process.env.MONGO_URI;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const JWKS = createRemoteJWKSet(
  new URL (`${process.env.CLIENT_URL}/api/auth/jwks`)
)

const verifyToken = async (req, res, next) => {
  const authHealer = req?.headers.authorization

  if(!authHealer) {
    return res.status(401).json({message: "Unauthorized"})
  }
  const token = authHealer.split(" ")[1];

  if(!token){
    return res.status(401).json({message: "Unauthorized"})
  }

  try{
    const {payload} = await jwtVerify(token, JWKS)
    console.log(payload)
    next()
  }catch (error) {
    return res.status(403).json({message: "Forbidden" })
  }
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection

    const db = client.db("study-nook-db");
    const roomCollection = db.collection("rooms");
    const bookingsCollection = db.collection("bookings");

    app.get('/room', async (req, res) => {
      const result = await roomCollection.find().toArray();
      res.json(result);
    });

    app.get("/room/user/:email", async (req, res) => {

      try {

        const email = req.params.email;

        console.log("EMAIL:", email);

        const rooms = await roomCollection
          .find({
            ownerEmail: email
          })
          .toArray();

        console.log("ROOMS:", rooms);

        res.send(rooms);

      } catch (error) {

        console.log("SERVER ERROR:");
        console.log(error);

        res.status(500).send({
          message: error.message
        });

      }

    });

    app.get('/room/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await roomCollection.findOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    app.get("/featured-rooms", async (req, res) => {

      try {

        const rooms = await roomCollection
          .find()
          .sort({ createdAt: -1 })
          .limit(6)
          .toArray();

        res.send(rooms);

      } catch (error) {

        console.log(error);

        res.status(500).send({
          message: error.message
        });

      }

    });

    app.patch('/room/:id', async (req, res) => {
      const { id } = req.params;
      const updateData = req.body;

      const result = await roomCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      )

      res.json(result);
    })

    app.delete('/room/:id', async (req, res) => {
      const { id } = req.params;
      const result = await roomCollection.deleteOne({ _id: new ObjectId(id) });

      res.json(result);
    })

    //booking
    app.post('/bookings', async (req, res) => {
      try {
        const {
          roomId,
          roomName,
          date,
          startTime,
          endTime,
          totalCost,
          note,
          userEmail,
        } = req.body;

        const conflict = await bookingsCollection.findOne({
          roomId,
          date,
          status: 'confirmed',
          $or: [
            { startTime: { $lt: endTime }, endTime: { $gt: startTime } },
          ],
        });

        if (conflict) {
          return res.status(409).json({
            error: `This room is already booked from ${conflict.startTime} to ${conflict.endTime} on ${date}. Please choose a different slot.`,
          });
        }

        const booking = {
          roomId,
          roomName,
          date,
          startTime,
          endTime,
          totalCost,
          note: note || '',
          userEmail,
          status: 'confirmed',
          createdAt: new Date(),
        };

        const result = await bookingsCollection.insertOne(booking);

        await roomCollection.updateOne(
          { _id: new ObjectId(roomId) },
          { $inc: { bookingCount: 1 } },
        );

        res.status(201).json({
          message: 'Room booked successfully',
          bookingId: result.insertedId,
        });
      } catch (error) {
        console.log(error); // so you see the real error in the terminal
        res.status(500).json({ error: error.message || 'Internal server error' });
      }
    });


    app.get("/bookings/user/:email", async (req, res) => {
      try {
        const bookings = await bookingsCollection
          .find({ userEmail: req.params.email })
          .sort({ createdAt: -1 })
          .toArray();
        res.send(bookings);
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: error.message });
      }
    });

    app.patch("/bookings/:id", async (req, res) => {
      try {
        const result = await bookingsCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { status: req.body.status } }
        );
        res.json(result);
      } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
      }
    });


    app.post('/room', async (req, res) => {

      const roomData = req.body
      console.log(roomData);

      const result = await roomCollection.insertOne(roomData);

      res.json(result);
    });


    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send("server is running fine")
})

app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
})