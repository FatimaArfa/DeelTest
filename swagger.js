const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Deel test",
    version: "1.0.0",
    description: "API documentation for your project",
  },
  servers: [
    {
      url: "http://localhost:3001", 
      description: "Local development server",
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ["./src/app.js"], 
};

const swaggerSpec = swaggerJSDoc(options);

function setupSwagger(app) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

module.exports = setupSwagger;
