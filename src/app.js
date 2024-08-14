const express = require('express');
const bodyParser = require('body-parser');
const {sequelize} = require('./model')
const { getProfile } = require('./middleware/getProfile')
const { Op } = require("sequelize");
const Sequelize = require("sequelize");
const setupSwagger = require("../swagger");
const app = express();
app.use(bodyParser.json());
app.set('sequelize', sequelize)
app.set('models', sequelize.models)



/**
 * @swagger
 * /contracts/{id}:
 *   get:
 *     summary: Get a contract by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The contract ID
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Contract found
 *       404:
 *         description: Contract not found
 *       403:
 *         description: Forbidden
 */
app.get('/contracts/:id',getProfile ,async (req, res) =>{
    const {Contract} = req.app.get('models')
    const { id } = req.params
    const profileId = req.profile.id;
    const contract = await Contract.findOne({where: {id}})
    if (!contract) return res.status(404).end()
    
    if (
      contract.ClientId !== profileId &&
      contract.ContractorId !== profileId
    ) {
      return res.status(403).end();
    }
    res.json(contract)
})





/**
 * @swagger
 * /contracts:
 *   get:
 *     summary: Get all contracts for a profile
 *     responses:
 *       200:
 *         description: List of contracts
 */
app.get('/contracts',getProfile ,async (req, res) =>{
    const profileId = req.profile.id;
    const { Contract } = req.app.get("models");

    const contracts = await Contract.findAll({
      where: {
        [Op.or]: [{ ClientId: profileId }, { ContractorId: profileId }],
        status: { [Op.not]: "terminated" },
      },
    });

    res.json(contracts);
})



/**
 * @swagger
 * /jobs/unpaid:
 *   get:
 *     summary: Get unpaid jobs for a profile
 *     responses:
 *       200:
 *         description: List of unpaid jobs
 */
app.get("/jobs/unpaid", getProfile, async (req, res) => {
  const { Job } = req.app.get("models");
  const { Contract } = req.app.get("models");
  const profileId = req.profile.id;

  const unpaidJobs = await Job.findAll({
    where: {
      paid: false,
      "$Contract.status$": "in_progress",
      [Op.or]: [
        { "$Contract.ClientId$": profileId },
        { "$Contract.ContractorId$": profileId },
      ],
    },
    include: [{ model: Contract, required: true }],
  });

  res.json(unpaidJobs);
});





/**
 * @swagger
 * /jobs/{job_id}/pay:
 *   post:
 *     summary: Pay for a job
 *     parameters:
 *       - in: path
 *         name: job_id
 *         required: true
 *         description: The job ID
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Payment successful
 *       404:
 *         description: Job not found
 *       403:
 *         description: Forbidden
 *       400:
 *         description: Insufficient balance
 */
app.post("/jobs/:job_id/pay", getProfile, async (req, res) => {
  const { Job } = req.app.get("models");
  const { Contract } = req.app.get("models");
  const { Profile } = req.app.get("models");
  const { job_id } = req.params;
  const profileId = req.profile.id;

  const job = await Job.findOne({
    where: { id: job_id },
    include: [
      {
        model: Contract,
        include: [
          { model: Profile, as: "Client" }, 
          { model: Profile, as: "Contractor" },
        ],
      },
    ],
  });

  if (!job) return res.status(404).end();

  const contract = job.Contract;

  if (contract.ClientId !== profileId) return res.status(403).end();

  const client = await Profile.findOne({ where: { id: contract.ClientId } });
  const contractor = await Profile.findOne({
    where: { id: contract.ContractorId },
  });

  if (client.balance < job.price)
    return res.status(400).send("Insufficient balance");

  await client.update({ balance: client.balance - job.price });
  await contractor.update({ balance: contractor.balance + job.price });
  await job.update({ paid: true });

  res.json({ message: "Payment successful" });
});



/**
 * @swagger
 * /deposit-balance/{userId}:
 *   post:
 *     summary: Deposit balance for a client
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         description: The client ID
 *         schema:
 *           type: integer
 *       - in: body
 *         name: amount
 *         description: Deposit amount
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             amount:
 *               type: number
 *               format: float
 *     responses:
 *       200:
 *         description: Deposit successful
 *       404:
 *         description: Client not found
 *       400:
 *         description: Exceeds maximum deposit limit
 */
app.post("/balances/deposit/:userId", getProfile, async (req, res) => {
  const { userId } = req.params;
  const { amount } = req.body;

  const { Job } = req.app.get("models");
  const { Contract } = req.app.get("models");
  const { Profile } = req.app.get("models");

  const client = await Profile.findOne({
    where: { id: userId, type: "client" },
  });
  if (!client) return res.status(404).end();

  const unpaidJobs = await Job.findAll({
    where: {
      paid: false,
      "$Contract.ClientId$": userId,
      "$Contract.status$": "in_progress",
    },
    include: [{ model: Contract }],
  });

  const totalUnpaid = unpaidJobs.reduce((sum, job) => sum + job.price, 0);
  const maxDeposit = totalUnpaid * 0.25;

  if (amount > maxDeposit)
    return res.status(400).send(`Cannot deposit more than ${maxDeposit}`);

  await client.update({ balance: client.balance + amount });

  res.json({ message: "Deposit successful" });
});




/**
 * @swagger
 * /best-profession:
 *   get:
 *     summary: Get the best profession by earnings
 *     parameters:
 *       - in: query
 *         name: start
 *         required: true
 *         description: Start date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end
 *         required: true
 *         description: End date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Best profession found
 *       404:
 *         description: No profession found
 */
app.get(
  "/admin/best-profession",
  getProfile,
    async (req, res) => {
      
        const { start, end } = req.query;
        const { Contract } = req.app.get("models");
        const { Profile } = req.app.get("models");
        const { Job } = req.app.get("models");

        try {
            if (!start || !end) {
              return res.status(400).send("Start and end dates are required.");
            }
          
            const bestProfession = await Profile.findOne({
              attributes: [
                "profession",
                [
                  sequelize.fn("sum", sequelize.col("Contracts.Jobs.price")),
                  "total_earned",
                ],
              ],
              include: [
                {
                  model: Contract,
                  as: "Contractor",
                  include: [
                    {
                      model: Job,
                      attributes: [],
                      where: {
                        paid: true,
                        paymentDate: {
                          [Sequelize.Op.between]: [start, end],
                        },
                      },
                    },
                  ],
                },
              ],
              group: ["Profile.profession"], // Use the correct table column name for grouping
              order: [[sequelize.col("total_earned"), "DESC"]],
              limit: 1, // Get the top profession
            });

           if (!bestProfession)
             return res
               .status(404)
               .send("No profession found in the given date range.");

           res.json(bestProfession);
        } catch (error) {
          console.error(error);
          res.status(500).send("Server Error");
        }
      
    }
);


 
/**
 * @swagger
 * /best-clients:
 *   get:
 *     summary: Get the best clients by total payment
 *     parameters:
 *       - in: query
 *         name: start
 *         required: true
 *         description: Start date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end
 *         required: true
 *         description: End date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: limit
 *         description: Number of clients to return
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of best clients
 *       404:
 *         description: No clients found
 */
app.get("/admin/best-clients", getProfile, async (req, res) => {

     const { start, end, limit = 2 } = req.query;
     const { Contract } = req.app.get("models");
     const { Profile } = req.app.get("models");
    const { Job } = req.app.get("models");
    

     const bestClients = await Profile.findAll({
       where: { type: "client" },
       attributes: [
         "id",
         [
           sequelize.fn(
             "concat",
             sequelize.col("firstName"),
             " ",
             sequelize.col("lastName")
           ),
           "fullName",
         ],
         [sequelize.fn("sum", sequelize.col("Job.price")), "paid"],
       ],
       include: [
         {
           model: Contract,
           include: [
             {
               model: Job,
               where: {
                 paid: true,
                 paymentDate: { [Op.between]: [start, end] },
               },
             },
           ],
         },
       ],
       group: ["Profile.id"],
       order: [[sequelize.col("paid"), "DESC"]],
       limit: parseInt(limit, 10),
     });

     if (bestClients.length === 0)
       return res.status(404).send("No clients found in the given date range.");

     res.json(bestClients);
});


setupSwagger(app);
module.exports = app;
