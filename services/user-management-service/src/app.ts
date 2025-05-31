import express from "express";
import cors from "cors";
import helmet from "helmet";
import { initDatabase } from "./database";
import { logger } from "./utils/logger";
import { initializeData } from "./services/dataSync";

import userRoutes from "./routes/users";
import regionRoutes from "./routes/regions";
import droneRoutes from "./routes/drones";

const app = express();
const PORT = process.env.PORT || 4003;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:3000" }));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "healthy", service: "user-management-service" });
});

app.use("/api/users", userRoutes);
app.use("/api/regions", regionRoutes);
app.use("/api/drones", droneRoutes);

const startServer = async () => {
  await initDatabase();
  await initializeData();
  
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
};

startServer();