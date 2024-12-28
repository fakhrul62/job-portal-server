import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import express from "express";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";

const app = express();
const port = process.env.PORT || 5000;
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://job-portal-1ae11.web.app",
      "https://job-portal-1ae11.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) => {
  // console.log("inside the verifyToken");
  const token = req?.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "Unauthorized Brother" });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized Access Brother" });
    }
    req.user = decoded;
    next();
  });
};

//MONGODB

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wwkoz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Send a ping to confirm a successful connection
    console.log("JobDB is successfully connected to MongoDB!");

    const jobCollection = client.db("jobDB").collection("jobs");
    const applicantsCollection = client.db("jobDB").collection("applicants");
//========================================================================================================================
    // *Auth related api // JWT
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET);
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    app.post("/jwt/logout", async(req, res) => {
      const user = req.body;
      console.log("logging out: ", user);
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict"
        })
        .send({ success: true });
    });
    //========================================================================================================================
    // job related api
    app.get("/jobs", async (req, res) => {
      const email = req.query?.email;
      const sort = req.query?.sort;
      const search = req.query?.search;
      const min = req.query?.min;
      const max = req.query?.max;
      let query = {};
      let sortQuery = {};
      if (email) {
        query = { hr_email: email };
      }
      if(sort === "true"){
        sortQuery = {"salaryRange.max" : -1};
      }
      if(search){
        query.location ={$regex : search, $options: "i"};
      }
      if(min && max){
        query = {
          ...query,
          "salaryRange.min": {$gte: parseInt(min)},
          "salaryRange.max": {$lte: parseInt(max)},
        }
      }
      console.log(query);
      const cursor = jobCollection.find(query).sort(sortQuery);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/jobs", async (req, res) => {
      const newJob = req.body;
      const result = await jobCollection.insertOne(newJob);
      res.send(result);
    });

    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobCollection.findOne(query);
      res.send(result);
    });

    //get all jobs by email
    app.get("/job-application", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { applicant_email: email };

      if (req.user.email !== email) {
        return res.status(403).send({ message: "Forbidden Access Bro" });
      }
      //console.log('req.cookies',req.cookies?.token);
      const result = await applicantsCollection.find(query).toArray();
      for (const application of result) {
        const query = { _id: new ObjectId(application.job_id) };
        const job = await jobCollection.findOne(query);
        if (job) {
          application.title = job.title;
          application.company = job.company;
          application.jobType = job.jobType;
          application.applicationDeadline = job.applicationDeadline;
        }
      }
      res.send(result);
    });
    app.get("/job-applications/jobs/:job_id", async (req, res) => {
      const jobId = req.params.job_id;
      const query = { job_id: jobId };
      const result = await applicantsCollection.find(query).toArray();
      res.send(result);
    });
   //========================================================================================================================
    //applicant related api
    app.post("/job-applications", async (req, res) => {
      const application = req.body;
      const result = await applicantsCollection.insertOne(application);
      //not the best way
      const id = application.job_id;
      const query = { _id: new ObjectId(id) };
      const job = await jobCollection.findOne(query);
      let newCount = 0;
      if (job.applicationCount) {
        newCount = job.applicationCount + 1;
      } else {
        newCount = 1;
      }
      //now update the job info
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          applicationCount: newCount,
        },
      };
      const updatedResult = await jobCollection.updateOne(filter, updatedDoc);

      res.send(result);
    });
    app.patch("/job-applications/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: data.status,
        },
      };
      const result = await applicantsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    //========================================================================================================================
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("JOB PORTAL IS RUNNING...you should run too :)");
});
app.listen(port, () => {
  console.log("JOB PORTAL is running on port: ", port);
});
