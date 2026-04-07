"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const winston_1 = __importDefault(require("winston"));
class Logger {
    logger;
    constructor() {
        this.logger = winston_1.default.createLogger({
            level: "debug",
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.colorize(), winston_1.default.format.printf(({ level, message, timestamp, ...meta }) => {
                const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : "";
                return `${timestamp} [${level}]: ${message} ${metaStr}`;
            })),
            transports: [
                new winston_1.default.transports.Console(),
                new winston_1.default.transports.File({
                    filename: "logs/anomaly-detection.log",
                    level: "info"
                }),
                new winston_1.default.transports.File({
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
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map