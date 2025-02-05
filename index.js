const express = require('express');
const app = express();
const cors = require('cors');
var jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;

// Middle Ware
app.use(cors());
app.use(express.json());
// ${process.env.DB_USER}:${process.env.DB_PASS}

// Part 1 adding cluster connection from mongo
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5uoh0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
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
    // part 2 find multiple documents
    const menuCollection = client.db("pearl_bistro").collection("menu");
    // part 5 cart documents
    const cartCollection = client.db("pearl_bistro").collection("carts");
    // part 7 find multiple documents
    const reviewsCollection = client.db("pearl_bistro").collection("reviews");
    // part 11 users collection
    const usersCollection = client.db("pearl_bistro").collection("users");

    // Step 17 jwt related api
    app.post('/jwt', async(req, res) =>{
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn : '1h' });
      res.send({token});
    });

    // step 18 verify by using middlewares
    const verifyToken = (req, res, next) =>{
      console.log('inside verify token', req.headers.authorization);
      if(!req.headers.authorization){
        return res.status(401).send({message : 'forbidden access'});
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) =>{
        if(err){
          return res.status(401).send({message : 'forbidden access'})
        }
        req.decoded = decoded;
        next();
      })
      // next(); means if its working right then go next 
    }

    // part 3 get all the menu
    app.get('/menu', async(req, res) =>{
        const result = await menuCollection.find().toArray();
        res.send(result);
    });

    // part 6 get all the reviews
    app.get('/reviews', async(req, res) =>{
        const result = await reviewsCollection.find().toArray();
        res.send(result);
    });

    // part 8 cart collection
    app.post('/carts', async(req, res) =>{
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    // step 9 get carts
    app.get('/carts', async(req, res) =>{
      // step 10 get email
      // const {email} = req.query;
      const email = req.query.email
      const query = {email : email};
      console.log(query)
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    // part 10 delete from cart
    app.delete('/carts/:id', async(req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });


    // step 12 users related api
    app.post('/users', async(req, res) =>{
      const user = req.body;
      // step 13 insert email if user does not exist
      const query = {email : user.email}
      const existingUser = await usersCollection.findOne(query);
      if(existingUser){
        return res.send({message : 'User Already Exists', insertedId : null})
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // step 14 get the users step 19 add verify
    app.get('/users', verifyToken, async(req, res) =>{
      const result = await usersCollection.find().toArray();
      res.send(result);
    });


    // step 15 delete user
    app.delete('/users/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // step 16 make admin
    app.patch('/users/admin/:id', async(req, res) => {
      const id = req.params.id;
      const filter  = {_id: new ObjectId(id)};
      const updatedDoc = {
        $set : {
          role : 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // step 4 close it
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) =>{
    res.send('Food server is coming')
});

app.listen(port, () =>{
    console.log(`Pearl Bistro menu on port ${port}`);
})