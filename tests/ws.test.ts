import { Server } from './../src/server';
import { Utils } from './utils';

describe('ws test', () => {
    afterEach(done => {
        if (Utils.currentServer) {
            Utils.currentServer.stop().then(() => {
                Utils.currentServer = null;
                done();
            });
        }
    });

    test('cannot connect using invalid app key', done => {
        Utils.newServer({}, (server: Server) => {
            let client = Utils.newClient({}, 6001, 'invalid-key');

            client.connection.bind('error', error => {
                client.disconnect();
                done();
            });
        });
    });
});
