/**
 * Request logging middleware
 */
export function requestLogger(req, res, next) {
  const start = Date.now();

  // Log on response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent')?.substring(0, 50),
    };

    // Color code based on status
    let color = '\x1b[32m'; // Green for 2xx
    if (res.statusCode >= 400 && res.statusCode < 500) {
      color = '\x1b[33m'; // Yellow for 4xx
    } else if (res.statusCode >= 500) {
      color = '\x1b[31m'; // Red for 5xx
    }

    console.log(
      `${color}${logData.method}\x1b[0m ${logData.path} ${logData.status} - ${logData.duration}`
    );
  });

  next();
}
