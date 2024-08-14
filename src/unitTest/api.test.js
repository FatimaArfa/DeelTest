const request = require("supertest");
const app = require("../app"); 

describe("API Endpoints", () => {
  // Test for GET /contracts/:id
  describe("GET /contracts/:id", () => {
    it("should return a contract if it exists and is accessible", async () => {
      const contractId = 1; 
      const response = await request(app)
        .get(`/contracts/${contractId}`)
        .set("profile_id", 1); 

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("id", contractId);
    });

    it("should return 404 if the contract does not exist", async () => {
      const contractId = 9999; 
      const response = await request(app)
        .get(`/contracts/${contractId}`)
        .set("profile_id", 1); 

      expect(response.status).toBe(404);
    });

    it("should return 403 if the contract is not accessible by the user", async () => {
      const contractId = 2; 
      const response = await request(app)
        .get(`/contracts/${contractId}`)
        .set("profile_id", 3); 

      expect(response.status).toBe(403);
    });
  });

  // Test for GET /jobs/unpaid
  describe("GET /jobs/unpaid", () => {
    it("should return a list of unpaid jobs for the profile", async () => {
      const response = await request(app)
        .get("/jobs/unpaid")
        .set("profile_id", 1); 

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  // Test for POST /jobs/:job_id/pay
  describe("POST /jobs/:job_id/pay", () => {
    it("should successfully pay for a job", async () => {
      const jobId = 1;
      const response = await request(app)
        .post(`/jobs/${jobId}/pay`)
        .set("profile_id", 1); 

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message", "Payment successful");
    });

    it("should return 404 if the job does not exist", async () => {
      const jobId = 9999;
      const response = await request(app)
        .post(`/jobs/${jobId}/pay`)
        .set("profile_id", 1); 

      expect(response.status).toBe(404);
    });

    it("should return 403 if the user is not the client", async () => {
      const jobId = 2; 
      const response = await request(app)
        .post(`/jobs/${jobId}/pay`)
        .set("profile_id", 2); 

      expect(response.status).toBe(403);
    });

    it("should return 400 if the client has insufficient balance", async () => {
      const jobId = 3; 
      const response = await request(app)
        .post(`/jobs/${jobId}/pay`)
        .set("profile_id", 1); 

      expect(response.status).toBe(400);
      expect(response.text).toBe("Insufficient balance");
    });
  });

  // Test for POST /balances/deposit/:userId
  describe("POST /balances/deposit/:userId", () => {
    it("should successfully deposit balance for a client", async () => {
      const userId = 1;
      const response = await request(app)
        .post(`/balances/deposit/${userId}`)
        .set("profile_id", 1)
        .send({ amount: 100 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message", "Deposit successful");
    });

    it("should return 404 if the client is not found", async () => {
      const userId = 9999;
      const response = await request(app)
        .post(`/balances/deposit/${userId}`)
        .set("profile_id", 1) 
        .send({ amount: 100 });

      expect(response.status).toBe(404);
    });

    it("should return 400 if the deposit exceeds the maximum limit", async () => {
      const userId = 1; 
      const response = await request(app)
        .post(`/balances/deposit/${userId}`)
        .set("profile_id", 1) 
        .send({ amount: 10000 }); 

      expect(response.status).toBe(400);
      expect(response.text).toMatch(/Cannot deposit more than/);
    });
  });
});
