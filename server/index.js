import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import requestLogger from "./middleware/requestLogger.js";
import authRoutes from "./routes/auth.js";
import quizRoutes from "./routes/quiz.js";

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use(requestLogger);

app.use(
	cors({
		origin: process.env.CLIENT_URL,
		credentials: true,
	})
);

app.use("/api/auth", authRoutes);
app.use("/api/quiz", quizRoutes);

app.listen(process.env.PORT || 3000, () => {
	console.log("Server is running on port 3000");
});
