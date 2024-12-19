import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import express, { application } from "express";
import cors from "cors";
import "dotenv/config";

const app = express();
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());

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
    console.log(
      "JobDB is successfully connected to MongoDB!"
    );
    // job related api
    const jobCollection = client.db("jobDB").collection("jobs");
    const applicantsCollection = client.db("jobDB").collection("applicants");

    app.get("/jobs", async(req,res)=>{
        const email = req.query.email;
        let query = {};
        if(email){
          query = {hr_email : email}
        }
        const cursor = jobCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
    })

    app.post("/jobs", async(req, res)=>{
      const newJob = req.body;
      const result = await jobCollection.insertOne(newJob);
      res.send(result);
    })

    app.get("/jobs/:id", async(req, res)=>{
      const id = req.params.id;
      const query = { _id: new ObjectId(id)};
      const result = await jobCollection.findOne(query);
      res.send(result);
    })
    
    //get all jobs by email
    app.get('/job-application', async(req, res)=>{
      const email = req.query.email;
      const query = {applicant_email: email};
      const result = await applicantsCollection.find(query).toArray();
      for(const application of result){
        const query = {_id : new ObjectId(application.job_id)}
        const job = await jobCollection.findOne(query);
        if(job){
          application.title = job.title;
          application.company = job.company; 
          application.jobType = job.jobType; 
          application.applicationDeadline = job.applicationDeadline; 
        }
      }
      res.send(result);
    })
    app.get("/job-applications/jobs/:job_id", async(req, res)=>{
      const jobId = req.params.job_id;
      const query = {job_id: jobId};
      const result = await applicantsCollection.find(query).toArray();
      res.send(result);
    })
    //applicant related api 
    app.post('/job-applications', async(req, res)=>{
      const application = req.body;
      const result = await applicantsCollection.insertOne(application);
      //not the best way
      const id = application.job_id;
      const query = {_id: new ObjectId(id)};
      const job = await jobCollection.findOne(query);
      let newCount = 0;
      if(job.applicationCount){
        newCount = job.applicationCount + 1;
      }
      else{
        newCount = 1;
      }
      //now update the job info
      const filter = {_id: new ObjectId(id)};
      const updatedDoc = {
        $set : {
          applicationCount : newCount,
        }
      }
      const updatedResult = await jobCollection.updateOne(filter, updatedDoc);

      res.send(result);
    })
    app.patch("/job-applications/:id", async(req, res)=>{
      const id = req.params.id;
      const data = req.body;
      const filter = {_id: new ObjectId(id)};
      const updatedDoc = {
        $set:{
          status: data.status
        }
      }
      const result = await applicantsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })


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
