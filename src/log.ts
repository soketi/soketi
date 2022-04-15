const colors = require('colors');

export class Log {
    static infoTitle(message: any): void {
        this.log(message, 'bold', 'black', 'bgCyan', 'mx-2', 'px-1');
    }

    static successTitle(message: any): void {
        this.log(message, 'bold', 'black', 'bgGreen', 'mx-2', 'px-1');
    }

    static errorTitle(message: any): void {
        this.log(this.prefixWithTime(message), 'bold', 'black', 'bgRed', 'mx-2', 'px-1');
    }

    static warningTitle(message: any): void {
        this.log(this.prefixWithTime(message), 'bold', 'black', 'bgYellow', 'mx-2', 'px-1');
    }

    static clusterTitle(message: any): void {
        this.log(this.prefixWithTime(message), 'bold', 'yellow', 'bgMagenta', 'mx-2', 'px-1');
    }

    static httpTitle(message: any): void {
        this.infoTitle(this.prefixWithTime(message));
    }

    static discoverTitle(message: any): void {
        this.log(this.prefixWithTime(message), 'bold', 'gray', 'bgBrightCyan', 'mx-2', 'px-1');
    }

    static websocketTitle(message: any): void {
        this.successTitle(this.prefixWithTime(message));
    }

    static webhookSenderTitle(message: any): void {
        this.log(this.prefixWithTime(message), 'bold', 'blue', 'bgWhite', 'mx-2', 'px-1');
    }

    static info(message: any): void {
        this.log(message, 'cyan', 'mx-2');
    }

    static success(message: any): void {
        this.log(message, 'green', 'mx-2');
    }

    static error(message: any): void {
        this.log(message, 'red', 'mx-2');
    }

    static warning(message: any): void {
        this.log(message, 'yellow', 'mx-2');
    }

    static cluster(message: any): void {
        this.log(message, 'bold', 'magenta', 'mx-2');
    }

    static http(message: any): void {
        this.info(message);
    }

    static discover(message: any): void {
        this.log(message, 'bold', 'brightCyan', 'mx-2');
    }

    static websocket(message: any): void {
        this.success(message);
    }

    static webhookSender(message: any): void {
        this.log(message, 'bold', 'white', 'mx-2');
    }

    static br(): void {
        console.log('');
    }

    protected static prefixWithTime(message: any): any {
        if (typeof message === 'string') {
            return '[' + (new Date).toString() + '] ' + message;
        }

        return message;
    }

    protected static log(message: string, ...styles: string[]): void {
        let withColor = colors;

        styles
            .filter(style => ! /^[m|p]x-/.test(style))
            .forEach((style) => withColor = withColor[style]);

        const applyMargins = (message: string): string => {
            const spaces = styles
                .filter(style => /^mx-/.test(style))
                .map(style => ' '.repeat(parseInt(style.substr(3))))
                .join('');

            return spaces + message + spaces;
        }

        const applyPadding = (message: string): string => {
            const spaces = styles
                .filter(style => /^px-/.test(style))
                .map(style => ' '.repeat(parseInt(style.substr(3))))
                .join('');

            return spaces + message + spaces;
        }

        console.dir(applyMargins(withColor(applyPadding(message))));
    }
}
