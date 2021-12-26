const colors = require('colors');

export class Log {
    static infoTitle(message: any): void {
        console.log(colors.bold.black.bgCyan(message));
    }

    static successTitle(message: any): void {
        console.log(colors.bold.black.bgGreen(message));
    }

    static errorTitle(message: any): void {
        console.log(colors.bold.black.bgRed(this.prefixWithTime(message)));
    }

    static warningTitle(message: any): void {
        console.log(colors.bold.black.bgYellow(this.prefixWithTime(message)));
    }

    static clusterTitle(message: any): void {
        console.log(colors.bold.yellow.bgMagenta(this.prefixWithTime(message)));
    }

    static httpTitle(message: any): void {
        this.infoTitle(this.prefixWithTime(message));
    }

    static discoverTitle(message: any): void {
        console.log(colors.bold.gray.bgBrightCyan(this.prefixWithTime(message)));
    }

    static websocketTitle(message: any): void {
        this.successTitle(this.prefixWithTime(message));
    }

    static webhookSenderTitle(message: any): void {
        console.log(colors.bold.blue.bgWhite(this.prefixWithTime(message)));
    }

    static info(message: any): void {
        console.log(colors.cyan(message));
    }

    static success(message: any): void {
        console.log(colors.green(message));
    }

    static error(message: any): void {
        console.log(colors.red(message));
    }

    static warning(message: any): void {
        console.log(colors.yellow(message));
    }

    static cluster(message: any): void {
        console.log(colors.bold.yellow(message));
    }

    static http(message: any): void {
        this.info(message);
    }

    static discover(message: any): void {
        console.log(colors.bold.brightCyan(message));
    }

    static websocket(message: any): void {
        this.success(message);
    }

    static webhookSender(message: any): void {
        console.log(colors.bold.white(message));
    }

    protected static prefixWithTime(message: any): any {
        if (typeof message === 'string') {
            return '[' + (new Date).toString() + '] ' + message;
        }

        return message;
    }
}
