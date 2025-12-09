export default class DifficultyManager {
    constructor(spawner) {
        this.spawner = spawner;
    }

    increaseDifficulty() {
        this.spawner.currentEnemySpeed += 60;
    }
}
