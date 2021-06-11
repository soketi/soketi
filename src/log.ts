const colors = require('colors');

colors.setTheme({
    silly: 'rainbow',
    input: 'grey',
    verbose: 'cyan',
    prompt: 'grey',
    info: 'cyan',
    data: 'grey',
    help: 'cyan',
    warn: 'yellow',
    debug: 'blue',
    error: 'red',
    h1: 'grey',
    h2: 'yellow'
});

export class Log {
    /**
     * Console log heading 1.
     */
    static title(message: any): void {
        console.log(colors.bold(message));
    }

    /**
     * Console log heaing 2.
     */
    static subtitle(message: any): void {
        console.log(colors.h2.bold(message));
    }

    /**
     * Console log info.
     */
    static info(message: any): void {
        console.log(colors.info(message));
    }

    /**
     * Console log success.
     */
    static success(message: any): void {
        console.log(colors.green(message));
    }

    /**
     * Console log info.
     */
    static error(message: any): void {
        console.log(colors.error(message));
    }

    /**
     * Console log warning.
     */
    static warning(message: any): void {
        console.log(colors.warn(message));
    }
}
