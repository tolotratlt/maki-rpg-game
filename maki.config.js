export default {
    width: 800,
    height: 600,
    maps: ['default_map'],
    sprites: ['captain-clown-nose.png'],
    debug: false,
    player: {
        file: 'captain-clown-nose.png',
        idleFile: 'captain-clown-idle.png',
        layout: 'row',
        cols: 6,
        rows: 4,
        frameWidth: 64,
        frameHeight: 40,
        directions: {
            right: { start: 0, end: 5 },
            up: { start: 6, end: 11 },
            left: { start: 12, end: 17 },
            down: { start: 18, end: 23 }
        }
    }
}
