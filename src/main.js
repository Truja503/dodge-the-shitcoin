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

// Check if returning from online lobby (use hash because serve strips query params)
const isOnlineMode = window.location.hash === '#online' || new URLSearchParams(window.location.search).get('mode') === 'online';
if (isOnlineMode) {
    const matchData = JSON.parse(sessionStorage.getItem('online_match') || '{}');
    console.log('[Online] Match data:', matchData);

    if (matchData.roomId) {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = matchData.wsUrl || `${wsProtocol}//${window.location.hostname}:3001`;

        // Wait for Phaser to fully boot, then connect and start
        function waitForPhaser(callback) {
            const check = setInterval(() => {
                // MenuScene will be the first active scene
                try {
                    if (game.scene.getScene('MenuScene')) {
                        clearInterval(check);
                        callback();
                    }
                } catch(e) {}
            }, 100);
            // Safety timeout
            setTimeout(() => { clearInterval(check); callback(); }, 3000);
        }

        waitForPhaser(() => {
            console.log('[Online] Phaser ready, connecting WS...');
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log('[Online] WS connected, rejoining room:', matchData.roomId);
                ws.send(JSON.stringify({
                    type: matchData.isHost ? 'rejoin_host' : 'rejoin_client',
                    roomId: matchData.roomId,
                    username: matchData.username || 'Player'
                }));

                // Small delay to let rejoin process on server
                setTimeout(() => {
                    console.log('[Online] Starting OnlineScene...');
                    game.scene.stop('MenuScene');
                    game.scene.start('OnlineScene', {
                        isHost: matchData.isHost,
                        roomId: matchData.roomId,
                        ws: ws,
                        username: matchData.username || 'Player',
                        opponentName: matchData.opponentName || 'Opponent'
                    });
                }, 300);
            };

            ws.onerror = (err) => {
                console.error('[Online] WS error:', err);
                sessionStorage.removeItem('online_match');
                alert('Cannot connect to game server. Make sure it is running on port 3001.');
            };
        });
    }
}
