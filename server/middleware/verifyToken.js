import jwt from "jsonwebtoken";

function verifyToken(req, res, next) {
  const token = req.cookies.accessToken;
  if (!token) {
    return res.status(401).send("Unauthorized");
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    console.log("Token decoded:", decoded);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("JWT verification error:", error);
    return res.status(401).send("Unauthorized");
  }
}

export default verifyToken;
