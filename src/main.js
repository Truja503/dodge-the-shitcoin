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
        // Connect WebSocket and start OnlineScene
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = matchData.wsUrl || `${wsProtocol}//localhost:3001`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            // Wait for game to be ready, then start OnlineScene
            game.events.once('ready', () => {
                game.scene.start('OnlineScene', {
                    isHost: matchData.isHost,
                    roomId: matchData.roomId,
                    ws: ws,
                    username: matchData.username || 'Player',
                    opponentName: matchData.opponentName || 'Opponent'
                });
                game.scene.stop('MenuScene');
            });

            // If game is already ready
            if (game.isRunning) {
                game.scene.start('OnlineScene', {
                    isHost: matchData.isHost,
                    roomId: matchData.roomId,
                    ws: ws,
                    username: matchData.username || 'Player',
                    opponentName: matchData.opponentName || 'Opponent'
                });
                game.scene.stop('MenuScene');
            }
        };

        ws.onerror = () => {
            console.error('Failed to connect to game server');
            sessionStorage.removeItem('online_match');
        };
    }
}
