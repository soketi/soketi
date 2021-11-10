const colors = require('colors');

export class Log {
    static successTitle(message: any): void {
        console.log(colors.bold.black.bgGreen(message));
    }

    static errorTitle(message: any): void {
        console.log(colors.bold.black.bgRed(message));
    }

    static warningTitle(message: any): void {
        console.log(colors.bold.black.bgYellow(message));
    }

    static infoTitle(message: any): void {
        console.log(colors.bold.cyan(message));
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
}
