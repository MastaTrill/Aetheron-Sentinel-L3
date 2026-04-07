import winston from "winston";
export class Logger {
    logger;
    constructor() {
        this.logger = winston.createLogger({
            level: "debug",
            format: winston.format.combine(winston.format.timestamp(), winston.format.colorize(), winston.format.printf(({ level, message, timestamp, ...meta }) => {
                const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : "";
                return `${timestamp} [${level}]: ${message} ${metaStr}`;
            })),
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
    info(message, meta) {
        this.logger.info(message, meta);
    }
    warn(message, meta) {
        this.logger.warn(message, meta);
    }
    error(message, meta) {
        this.logger.error(message, meta);
    }
    debug(message, meta) {
        this.logger.debug(message, meta);
    }
    critical(message, meta) {
        // Critical goes to both file and a separate alert log
        this.logger.error(`🚨 CRITICAL: ${message}`, meta);
    }
}
//# sourceMappingURL=logger.js.map