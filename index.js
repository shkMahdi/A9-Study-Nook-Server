const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.8.4"]);

const dotenv = require('dotenv');
dotenv.config();

const express = require('express')
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express()

const PORT = process.env.PORT || 5000;

const uri = process.env.MONGO_URI;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send("server is running fine")
})

app.listen(PORT, () => {
    console.log(`server running on port ${PORT}`);
})