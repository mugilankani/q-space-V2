const requestLogger = (req, res, next) => {
  const start = process.hrtime();

  res.on("finish", () => {
    const diff = process.hrtime(start);
    const timeTakenMs = (diff[0] * 1e3 + diff[1] / 1e6).toFixed(2);

    console.log(
      `${req.method} ${req.originalUrl} - ${res.statusCode} - ${timeTakenMs} ms`,
    );
  });

  next();
};

export default requestLogger;
