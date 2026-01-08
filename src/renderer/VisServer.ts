import express from 'express';
import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import open from 'open';
import { IRenderer, ISimulationState, IControlInput } from '../core/interfaces';

export class VisServer implements IRenderer {
    private app: express.Express;
    private httpServer!: HttpServer; // Assigned on success
    private io: SocketIOServer;
    private currentInput: IControlInput = { throttle: 0, brake: 0, steering: 0 };
    private port: number = 3001;

    constructor() {
        this.app = express();

        // Initialize IO without server first
        this.io = new SocketIOServer({
            cors: { origin: "*" }
        });

        // Serve static files
        this.app.use(express.static(path.join(__dirname, 'public')));

        // Socket logic
        this.io.on('connection', (socket) => {
            console.log('Renderer client connected');

            socket.on('control_input', (input: IControlInput) => {
                this.currentInput = input;
            });
        });

        // Start server with retry
        this.startServer(this.port);
    }

    private startServer(port: number) {
        // Create a FRESH server instance for this port attempt
        const server = new HttpServer(this.app);

        server.listen(port, () => {
            console.log(`VisServer running at http://localhost:${port}`);

            // On success, attach IO and save server
            this.io.attach(server);
            this.httpServer = server;

            open(`http://localhost:${port}`);
        });

        server.on('error', (err: any) => {
            if (err.code === 'EADDRINUSE') {
                console.log(`Port ${port} is busy, trying ${port + 1}...`);
                // Do NOT reuse 'server'. It is dead.
                // Recursively try next port.
                this.startServer(port + 1);
            } else {
                console.error('Server error:', err);
            }
        });
    }

    render(state: ISimulationState): void {
        // Emit state to all clients
        this.io.emit('update_state', state);
    }

    getInput(): IControlInput {
        return this.currentInput;
    }
}
