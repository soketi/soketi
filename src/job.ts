import { v4 as uuidv4 } from 'uuid';

export class Job {
    /**
     * Create a new job instance.
     */
    constructor(public id: string = uuidv4(), public data: { [key: string]: any; } = {}) {
        //
    }
}
