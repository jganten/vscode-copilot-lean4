/**
 * A simple logger class for logging messages to the console with different levels.
 */
export class Logger {
    private static readonly MAX_DATA_LENGTH = 1000;

    /**
     * Formats data for logging, truncating if it exceeds the maximum length.
     * @param data The data to format.
     * @returns The formatted data string.
     */
    private static formatData(data: any): string {
        try {
            if (!data) {return '';}
            const str = JSON.stringify(data);
            return str.length > this.MAX_DATA_LENGTH 
                ? str.substring(0, this.MAX_DATA_LENGTH) + '...' 
                : str;
        } catch {
            return String(data);
        }
    }

    /**
     * Logs an info message to the console.
     * @param message The message to log.
     * @param data Optional data to include in the log.
     */
    static info(message: string, data?: any) {
        console.log(`[INFO] ${message}`, data ? this.formatData(data) : '');
    }

    /**
     * Logs a warning message to the console.
     * @param message The message to log.
     * @param data Optional data to include in the log.
     */
    static warn(message: string, data?: any) {
        console.warn(`[WARN] ${message}`, data || '');
    }

    /**
     * Logs an error message to the console.
     * @param message The message to log.
     * @param error Optional error object to include in the log.
     */
    static error(message: string, error?: any) {
        console.error(`[ERROR] ${message}`, error || '');
    }

    /**
     * Logs a debug message to the console.
     * @param message The message to log.
     * @param data Optional data to include in the log.
     */
    static debug(message: string, data?: any) {
        console.debug(`[DEBUG] ${message}`, data || '');
    }
}
