const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const { default: Stripe } = require("stripe");

const stripe = require("stripe")(
  "sk_test_51PtSgqKtnD8lNSmSD4dAWrNmBWID2CLdtW2j19an9g6H9AnbDJ75z93i81mhfIipp7kVB1F0Jk9vpzMPeLzGSzGI00OK9arjjI"
);

// console.log(stripe);

//Middleware
app.use(cors());
app.use(express.json());
require("dotenv").config();

//MOngodb connection start
//post JWT start
app.post("/jwt", async (req, res) => {
  const user = req.body;
  // console.log(user);
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "1h",
  });
  res.send({ token });
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@courseradb.hrgo3.mongodb.net/?retryWrites=true&w=majority&appName=courseradb`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    ///middleware///////////////////////////////

    ////////////////////////verify token ///////////////////////////
    const verifyToken = (req, res, next) => {
      console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // All the collection
    const userCollection = client.db("courseradb").collection("users");
    const enrollCollection = client.db("courseradb").collection("enroll");
    const partnersCollection = client.db("courseradb").collection("partners");
    const courseCollection = client.db("courseradb").collection("courses");
    const reviewsCollection = client.db("courseradb").collection("reviews");
    const paymentCollection = client.db("courseradb").collection("payments");
    const teachersCollection = client.db("courseradb").collection("teachers");

    //menu related api

    //userRelated API's
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users", verifyToken, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    //Verify admin user
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    //verify role is teacher
    app.get("/teachers/teacher/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res
          .status(403)
          .send({ message: "Teacher issue / unauthorized access" });
      }
      const query = { teacherEmail: email };
      const teacher = await teachersCollection.findOne(query);
      let isTeacher = false;
      if (teacher) {
        isTeacher = teacher?.role === "teacher";
      }
      console.log(isTeacher);

      res.send({ isTeacher });
    });

    // Make user to admin
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = { $set: { role: "admin" } };
      const result = await userCollection.updateOne(query, update);
      res.send(result);
    });

    //Make user role as teacher
    app.patch("/teachers/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);

      const query = { _id: new ObjectId(id) };
      const update = { $set: { role: "teacher" } };
      const result = await teachersCollection.updateOne(query, update);
      res.send(result);
    });

    //get partners apis
    app.get("/partners", async (req, res) => {
      const result = await partnersCollection.find().toArray();
      res.send(result);
    });

    //get courses list
    app.get("/courses", async (req, res) => {
      const result = await courseCollection.find().toArray();
      res.send(result);
    });

    app.get("/courses/:id", async (req, res) => {
      const id = req.params.id;
      const result = await courseCollection
        .find({ _id: new ObjectId(id) })
        .toArray();
      res.send(result);
    });
    ///teacher request
    app.get("/myCourses", verifyToken, async (req, res) => {
      const teacherEmail = req.query.teacherEmail;
      const query = { teacherEmail: teacherEmail };
      const result = await courseCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/courses/:id", async (req, res) => {
      const id = req.params.id;
      const result = await courseCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    app.patch("/courses/:id", async (req, res) => {
      const course = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateCourse = {
        $set: {
          title: course.title,
          price: course.price,
          image: course.image,
          postedBy: course.postedBy,
          shortDescription: course.shortDescription,
          category: course.category,
          description: course.description,
          about: course.about,
        },
      };
      const result = await courseCollection.updateOne(filter, updateCourse);
      res.send(result);
    });

    app.post("/courses", verifyToken, async (req, res) => {
      const courseItem = req.body;
      console.log(courseItem);
      const result = await courseCollection.insertOne(courseItem);
      res.send(result);
    });

    //Get course reviews
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });

    //enroll collection start
    app.post("/enroll", async (req, res) => {
      const enroll = req.body;
      const query = {
        courseId: enroll.courseId,
        studentEmail: enroll.studentEmail,
      };
      const existingEnroll = await enrollCollection.findOne(query);
      if (existingEnroll) {
        return res.send({ message: "already enrolled", insertedId: null });
      }
      const result = await enrollCollection.insertOne(enroll);
      res.send(result);
    });

    app.get("/enroll", async (req, res) => {
      const studentEmail = req.query.studentEmail;
      const query = { studentEmail: studentEmail };
      const result = await enrollCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/my-course-enrolled", async (req, res) => {
      const teacherEmail = req.query.teacherEmail;
      const query = { teacherEmail: teacherEmail };
      const result = await enrollCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/enroll/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await enrollCollection.findOne(query);
      res.send(result);
    });

    app.delete("/enroll/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await enrollCollection.deleteOne(query);
      res.send(result);
    });

    //All payment related APIs

    //payment intent

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, "amount inside the intent");

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      console.log("payment info ", paymentResult);
      res.send(paymentResult);
    });

    // Get payments info
    app.get("/user-payments", verifyToken, async (req, res) => {
      const studentEmail = req.query.studentEmail;
      const query = { studentEmail: studentEmail };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/payments", verifyToken, async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });

    ////// Teacher panel
    app.post("/teachers", verifyToken, async (req, res) => {
      const teacher = req.body;
      const query = { teacherEmail: teacher.teacherEmail };
      const existingTeacher = await teachersCollection.findOne(query);
      if (existingTeacher) {
        return res.send({
          message: "already enrolled as a teacher",
          insertedId: null,
        });
      }
      const result = await teachersCollection.insertOne(teacher);
      res.send(result);
    });

    app.get("/teachers", async (req, res) => {
      const result = await teachersCollection.find().toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

//MOngodb connection end

app.get("/", (req, res) => {
  res.send("course has been loaded");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
