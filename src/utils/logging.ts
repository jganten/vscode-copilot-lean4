export class Logger {
    private static readonly MAX_DATA_LENGTH = 1000;

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

    static info(message: string, data?: any) {
        console.log(`[INFO] ${message}`, data ? this.formatData(data) : '');
    }

    static warn(message: string, data?: any) {
        console.warn(`[WARN] ${message}`, data || '');
    }

    static error(message: string, error?: any) {
        console.error(`[ERROR] ${message}`, error || '');
    }

    static debug(message: string, data?: any) {
        console.debug(`[DEBUG] ${message}`, data || '');
    }
}
