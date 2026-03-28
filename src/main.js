import GameScene from "./scenes/GameScene.js";
import MenuScene from "./scenes/MenuScene.js";
import OnlineScene from "./scenes/OnlineScene.js";

const config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: window.innerWidth,
        height: window.innerHeight,
    },
    backgroundColor: "#222",
    parent: "game-container",
    input: {
        gamepad: true
    },
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [MenuScene, GameScene, OnlineScene]
};

const game = new Phaser.Game(config);

// Check if returning from online lobby
const params = new URLSearchParams(window.location.search);
if (params.get('mode') === 'online') {
    const matchData = JSON.parse(sessionStorage.getItem('online_match') || '{}');
    if (matchData.roomId) {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = matchData.wsUrl || `${wsProtocol}//${window.location.hostname}:3001`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('WS connected for online match, room:', matchData.roomId);
            // Re-join the room so the server knows this WS belongs to this room
            ws.send(JSON.stringify({
                type: matchData.isHost ? 'rejoin_host' : 'rejoin_client',
                roomId: matchData.roomId,
                username: matchData.username || 'Player'
            }));

            function startOnline() {
                game.scene.stop('MenuScene');
                game.scene.start('OnlineScene', {
                    isHost: matchData.isHost,
                    roomId: matchData.roomId,
                    ws: ws,
                    username: matchData.username || 'Player',
                    opponentName: matchData.opponentName || 'Opponent'
                });
            }

            // Phaser might still be booting
            if (game.isRunning) {
                startOnline();
            } else {
                game.events.once('ready', startOnline);
                // Fallback: Phaser 3 sometimes doesn't fire 'ready'
                setTimeout(() => {
                    if (game.scene.isActive('MenuScene') || game.isRunning) {
                        startOnline();
                    }
                }, 1000);
            }
        };

        ws.onerror = () => {
            console.error('Failed to connect to game server');
            sessionStorage.removeItem('online_match');
        };
    }
}
