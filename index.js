const express = require('express');
const app = express();
const cors = require('cors');
var jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const formData = require('form-data');
const Mailgun = require('mailgun.js')
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: "api",
  key: process.env.MAIL_GUN_API_KEY ,
});
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
    // await client.connect();
    // part 2 find multiple documents
    const menuCollection = client.db("pearl_bistro").collection("menu");
    // part 5 cart documents
    const cartCollection = client.db("pearl_bistro").collection("carts");
    // part 7 find multiple documents
    const reviewsCollection = client.db("pearl_bistro").collection("reviews");
    // part 11 users collection
    const usersCollection = client.db("pearl_bistro").collection("users");
    // part 26 payments collection
    const paymentCollection = client.db("pearl_bistro").collection("payments");

    // Step 17 jwt related api
    app.post('/jwt', async(req, res) =>{
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn : '1h' });
      res.send({token});
    });

    // step 18 verify by using middlewares
    const verifyToken = (req, res, next) =>{
      // console.log('inside verify token', req.headers.authorization);
      if(!req.headers.authorization){
        return res.status(401).send({message : 'unauthorized access'});
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) =>{
        if(err){
          return res.status(401).send({message : 'unauthorized access'})
        }
        req.decoded = decoded;
        next();
      })
      // next(); means if its working right then go next 
    };
    
    // step 21 verify admin after verify token
    const verifyAdmin = async(req, res, next) =>{
      const email = req.decoded.email;
      const query = {email : email};
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if(!isAdmin){
        return res.status(403).send({message : 'forbidden access'});
      }
      next();
    }
    
    // reviews 
    app.get('/reviews', async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    })

    // part 3 get all the menu
    app.get('/menu', async(req, res) =>{
        const result = await menuCollection.find().toArray();
        res.send(result);
    });

    // step 23 get specific item
    app.get('/menu/:id', async(req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await menuCollection.findOne(query);
      res.send(result);
    });

    // step 24 patch update id
    app.patch('/menu/:id', async(req, res) =>{
      const item = req.body;
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updatedDoc = {
        $set: { 
          name : item.name,
          category : item.category,
          price : item.price,
          recipe : item.recipe,
          image : item.image
        }
      }
      const result = await menuCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    // step 21
    app.post('/menu', verifyToken, verifyAdmin, async( req, res) =>{
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result);
    });

    // step 22
    app.delete('/menu/:id', verifyToken, verifyAdmin, async(req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    })

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

    // step 14 get the users step 19 add verify 21 verifyAdmin
    app.get('/users',  async(req, res) =>{
      const result = await usersCollection.find().toArray();
      res.send(result);
    });


    // step 25 payment intent
    app.post('/create-payment-intent', async(req, res) =>{
      const {price} = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, 'amount inside the intent');

      const paymentIntent = await stripe.paymentIntents.create({
        amount : amount,
        currency : 'usd',
        payment_method_types : ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    });

    // step 27 post payment
    app.post('/payments', verifyToken, async(req, res) =>{
      const payment = req.body;
      console.log(payment);
      const paymentResult = await paymentCollection.insertOne(payment);

      // Deleted each item from the cart
      console.log('Payment Info', payment);
      const query = {_id : {
        $in : payment.cartIds.map(id => new ObjectId(id))
      }}

      const deleteResult = await cartCollection.deleteMany(query);


      // Send Email
      mg.messages.create(process.env.MAIL_SENDING_DOMAIN, {
        from: "Mailgun Sandbox <postmaster@sandboxb106637669dc4319ba1037ca1e2c2022.mailgun.org>",
        to: ["shawonkn58@gmail.com"],
        subject: "Order Confirmation From Pearl Bistro",
        text: "Congratulations Md shahien khan, you just sent an email with Mailgun",
        html : `
        <div>
          <h2>Thank you for your order<h2>
          <h4>Your Transaction Id: <strong>${payment.transactionId}</strong><h4>
          <p>We would love to get your feedback about the food</p>
        </div>
        `
      })
      .then(msg => console.log(msg))
      .catch(err => console.log(err));

      res.send({paymentResult, deleteResult});
    });

    // step 28 get payment
    app.get('/payments/:email', async(req, res) =>{
      const query = {email : req.params.email}
      // if(req.params.email !== req.decoded.email){
      //   return res.status(403).send({message : 'Forbidden Access'});
      // }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    // step 29 payment analytics
    app.get('/admin-stats', verifyToken, verifyAdmin,async(req, res) =>{
      const users = await usersCollection.estimatedDocumentCount();
      const menuItems = await menuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();

      const result = await paymentCollection.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue : {
              $sum: '$price'
            }
          }
        }
      ]).toArray();

      const revenue = result.length > 0 ? result[0].totalRevenue : 0;

      res.send({
        users,
        menuItems,
        orders,
        revenue
      })
    });

    // step 30 using aggregate pipeline
    app.get('/order-stats', async(req, res) =>{
      const result = await paymentCollection.aggregate([
        {
          $unwind : '$menuItemIds'
        },
        {
          $lookup : {
            from : 'menu',
            localField : 'menuItemIds',
            foreignField: '_id',
            as: 'menuItems'
          }
        },
        {
          $unwind : '$menuItemIds'
        },
        {
          $group: {
            _id: '$menuItems.category',
            quantity : { $sum : 1 },
            revenue :  { $sum: '$menuItems.price'}
          }
        },
        {
          $project:{
            _id: 0,
            category : '$_id',
            quantity : '$quantity',
            revenue : '$revenue'
          }
        }
      ]).toArray();
      res.send(result);
    })

    // step 15 delete user
    app.delete('/users/:id', verifyAdmin, verifyToken, async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // step 16 make admin
    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async(req, res) => {
      const id = req.params.id;
      const filter  = {_id: new ObjectId(id)};
      const updatedDoc = {
        $set : {
          role : 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // step 20
    app.get('/users/admin/:email', verifyToken, async(req, res) =>{
      const email = req.params.email;
      if(email !== req.decoded.email){
        return res.status(403).send({message : 'forbidden access'})
      }
      const query = {email : email};
      const user = await usersCollection.findOne(query);
      let admin = false;
      if(user){
        admin = user?.role === 'admin';
      }
      res.send({admin});
    })


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
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