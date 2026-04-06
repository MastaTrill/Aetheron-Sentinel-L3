import winston from "winston";

export class Logger {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: "debug",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : "";
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: "logs/anomaly-detection.log",
          level: "info"
        }),
        new winston.transports.File({
          filename: "logs/errors.log",
          level: "error"
        }),
      ],
    });
  }

  info(message: string, meta?: object): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: object): void {
    this.logger.warn(message, meta);
  }

  error(message: string, meta?: object): void {
    this.logger.error(message, meta);
  }

  debug(message: string, meta?: object): void {
    this.logger.debug(message, meta);
  }

  critical(message: string, meta?: object): void {
    // Critical goes to both file and a separate alert log
    this.logger.error(`🚨 CRITICAL: ${message}`, meta);
  }
}
