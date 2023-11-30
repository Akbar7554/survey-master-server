const express = require('express')
const app = express()
const cors = require('cors')
const jwt = require('jsonwebtoken')
require('dotenv').config()

const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1i934d1.mongodb.net/?retryWrites=true&w=majority`;

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

        const userCollection = client.db("surveyDB").collection("users")
        const surveyCollection = client.db("surveyDB").collection("survey")

        // jwt api
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })

        // middlewares
        const verifyToken = (req, res, next) => {
            console.log(req.headers.authorization)
            if (!req.headers.authorization) {
                return res.status(401).send({ message: "unauthorized access" })
            }
            const token = req.headers.authorization.split(' ')[1]
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: "unauthorized access" })
                }
                req.decoded = decoded
                next()
            })
        }

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const isAdmin = user?.role === "admin"
            if (!isAdmin) {
                return res.status(403).send({ message: "forbidden access" })
            }
            next()
        }
        const verifySurveyor = async (req, res, next) => {
            const email = req.decoded.email
            const query = { email: email }
            const user = await userCollection.findOne(query)
            console.log(70, req.decoded, user);
            const isSurveyor = user?.role === "surveyor"
            if (!isSurveyor) {
                return res.status(403).send({ message: "forbidden access" })
            }
            next()
        }

        // users api
        app.post('/users', async (req, res) => {
            const user = req.body
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: "Users already in database", insertedId: null })
            }
            const result = await userCollection.insertOne(user)
            res.send(result)
        })

        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray()
            res.send(result)
        })

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "forbidden access" })
            }

            const query = { email: email }
            const user = await userCollection.findOne(query)
            let admin = false
            if (user) {
                admin = user?.role === "admin"
            }
            res.send({ admin })
        })

        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    role: "admin"
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query)
            res.send(result)
        })



        app.get('/users/surveyor/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            // if (email !== req.decoded.email) {

            //     return res.status(403).send({ message: "forbidden access" })
            // }
            const query = { email: { $regex: new RegExp(`^${email}$`, 'i') } }
            const user = await userCollection.findOne(query)
            let surveyor = false
            if (user) {
                surveyor = user?.role === "surveyor"
            }
            console.log("user", user);
            res.send({ surveyor })
        })


        app.patch('/users/surveyor/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    role: "surveyor"
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        // Surveyor related api
        app.post('/survey', verifyToken, verifySurveyor, async (req, res) => {
            const item = req.body
            item.set = {
                createdAt: new Date(),
                updatedAt : Date.now()
            }
            const result = await surveyCollection.insertOne(item)
            res.send(result)
        })
        // survey api
        app.get('/survey', verifyToken, verifySurveyor, async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            console.log(query);
            const result = await surveyCollection.find(query).toArray()
            res.send(result)
        })

        app.get('/survey/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await surveyCollection.findOne(query)
            res.send(result)
        })

        app.patch('/survey/:id', async (req, res) => {
            const item = req.body
            const id = req.params.id
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    title: item.title,
                    description: item.description,
                    options: item.options,
                    category: item.category,
                    vote: item.vote,
                    date: item.date,
                }
            }
            const result = await surveyCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        app.delete('/survey/:id', verifyToken, verifySurveyor, async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await surveyCollection.deleteOne(query)
            res.send(result)
        })

        app.get('/allSurvey',verifyToken, async (req, res) => {
            
            const result = await surveyCollection.find().toArray()
            console.log(result);
            res.send(result)
        })

        app.get('/allSurvey/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await surveyCollection.findOne(query)
            res.send(result)
        })








        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send("Survey is Running")
})

app.listen(port, () => {
    console.log(`Survey is Running on ${port}`);
})