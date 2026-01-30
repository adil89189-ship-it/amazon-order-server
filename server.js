import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import routes from "./routes.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", routes);

app.listen(process.env.PORT, () => {
  console.log("Backend running on port", process.env.PORT);
});
