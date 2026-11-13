// audio.js — every sound in the game.
//
// The rest of the game only ever calls  window.playSound(name, detail).
// Each sound is made in code with the Web Audio API (beeps, thumps and
// filtered noise), so the game needs no sound files. These are placeholders:
// a real file listed in sounds/list.js replaces the sound with the same name.
//
// Browsers only allow sound after the first key press or click, so the
// audio starts up at the player's first input.

const GameAudio = (function () {

    let context = null;             // the Web Audio "sound card", made at the first sound
    let master = null;              // volume control everything passes through
    let muted = false;
    const files = {};               // name -> decoded sound file (when the team supplies one)
    const lastPlayed = {};          // name -> when it last played (to skip pile-ups)
    let played = 0;                 // how many sounds have started (used by the tests)

    function start() {
        if (context) return true;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return false;
        context = new AudioContext();
        master = context.createGain();
        master.gain.value = muted ? 0 : 0.5;
        master.connect(context.destination);
        loadFiles();
        return true;
    }

    // ---------- Building blocks ----------
    // A note: a wave at a pitch that can slide, fading out.
    //   type 'sine' (soft), 'triangle', 'square' (buzzy) or 'sawtooth' (harsh)
    function tone(type, from, to, seconds, volume, delay) {
        const t = context.currentTime + (delay || 0);
        const wave = context.createOscillator(), level = context.createGain();
        wave.type = type;
        wave.frequency.setValueAtTime(from, t);
        if (to !== from) wave.frequency.exponentialRampToValueAtTime(to, t + seconds);
        level.gain.setValueAtTime(volume, t);
        level.gain.exponentialRampToValueAtTime(0.001, t + seconds);
        wave.connect(level);
        level.connect(master);
        wave.start(t);
        wave.stop(t + seconds + 0.02);
    }

    // A burst of hiss (random noise) through a filter: whooshes, crowds, nets.
    //   filter 'lowpass' (dull), 'highpass' (airy) or 'bandpass' (hollow, voice-like)
    //   swell = seconds to fade in before fading out (0 = starts at full)
    let noiseBuffer = null;
    function noise(filter, from, to, seconds, volume, swell, delay) {
        if (!noiseBuffer) {
            noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        }
        const t = context.currentTime + (delay || 0);
        const source = context.createBufferSource(), shape = context.createBiquadFilter(), level = context.createGain();
        source.buffer = noiseBuffer;
        source.loop = true;
        shape.type = filter;
        shape.frequency.setValueAtTime(from, t);
        if (to !== from) shape.frequency.exponentialRampToValueAtTime(to, t + seconds);
        if (swell) {
            level.gain.setValueAtTime(0.001, t);
            level.gain.exponentialRampToValueAtTime(volume, t + swell);
        } else {
            level.gain.setValueAtTime(volume, t);
        }
        level.gain.exponentialRampToValueAtTime(0.001, t + seconds);
        source.connect(shape);
        shape.connect(level);
        level.connect(master);
        source.start(t, Math.random());
        source.stop(t + seconds + 0.02);
    }

    // ---------- The sounds ----------
    // One recipe per name. detail is whatever the game passed along.
    const SOUNDS = {
        // the ball
        shoot:  () => noise('bandpass', 500, 1500, 0.16, 0.25, 0.05),                          // whoosh off the hands
        swish:  () => noise('highpass', 2500, 5000, 0.28, 0.4, 0.02),                          // net snap
        score:  () => { noise('highpass', 2000, 4000, 0.22, 0.3, 0.02); tone('sine', 180, 120, 0.12, 0.2); },
        rim:    () => { tone('square', 620, 600, 0.18, 0.12); tone('triangle', 930, 900, 0.22, 0.12); },    // clank
        board:  () => { tone('sine', 120, 70, 0.16, 0.5); noise('lowpass', 400, 200, 0.08, 0.2); },        // thud
        floor:  () => tone('sine', 160, 60, 0.13, 0.5),                                        // bounce
        pole:   () => tone('triangle', 300, 260, 0.2, 0.2),
        // streaks and the clock
        chime:  (d) => {                                                                       // rises with the streak
            const step = Math.min((d && d.streak) || 1, 12);
            const pitch = 523 * Math.pow(2, (step - 1) * 2 / 12);
            tone('sine', pitch, pitch, 0.35, 0.3);
            tone('triangle', pitch * 2, pitch * 2, 0.2, 0.1);
        },
        fire:   () => noise('lowpass', 300, 1800, 0.5, 0.45, 0.25),                            // catching fire
        hiss:   () => noise('highpass', 5000, 2500, 0.5, 0.3),                                 // the fire goes out
        tick:   () => tone('square', 1000, 1000, 0.05, 0.12),                                  // last 10 seconds
        buzzer: () => { tone('sawtooth', 220, 220, 0.9, 0.3); tone('square', 110, 110, 0.9, 0.2); },
        // the crowd
        cheer:  (d) => noise('bandpass', 900, 1600, d && d.big ? 1.4 : 0.9, d && d.big ? 0.5 : 0.35, 0.15),
        groan:  () => { tone('sawtooth', 200, 140, 0.5, 0.08); noise('lowpass', 500, 250, 0.5, 0.2, 0.08); },
        gasp:   () => noise('highpass', 1500, 3000, 0.3, 0.3, 0.12),                           // so close
        boo:    () => { tone('sawtooth', 150, 110, 0.8, 0.12); tone('sawtooth', 158, 118, 0.8, 0.1); },
        stomp:  () => { tone('sine', 80, 45, 0.12, 0.6); noise('lowpass', 250, 120, 0.06, 0.25); },
        airball: () => {                                                                       // "air - ball"
            tone('triangle', 392, 392, 0.3, 0.2);
            tone('triangle', 330, 330, 0.45, 0.2, 0.34);
        }
    };

    // ---------- Real files from the team ----------
    // sounds/list.js names the files. Each replaces the sound with the same
    // name (swish.mp3 replaces 'swish').
    function loadFiles() {
        for (const fileName of (window.SOUND_FILES || [])) {
            const name = fileName.replace(/\.[^.]+$/, '');
            fetch('sounds/' + fileName)
                .then((response) => response.arrayBuffer())
                .then((bytes) => context.decodeAudioData(bytes))
                .then((sound) => { files[name] = sound; })
                .catch(() => { /* a missing or broken file: keep the sound made in code */ });
        }
    }

    // ---------- What the game calls ----------
    function playSound(name, detail) {
        if (muted || !SOUNDS[name] && !files[name]) return;
        if (!start()) return;
        if (context.state === 'suspended') context.resume();
        // the same sound twice within a few hundredths of a second is one sound
        const now = performance.now();
        if (lastPlayed[name] && now - lastPlayed[name] < 40) return;
        lastPlayed[name] = now;
        played++;
        if (files[name]) {
            const source = context.createBufferSource();
            source.buffer = files[name];
            source.connect(master);
            source.start();
        } else {
            SOUNDS[name](detail);
        }
    }
    window.playSound = playSound;

    function setMuted(on) {
        muted = on;
        if (master) master.gain.value = muted ? 0 : 0.5;
    }

    return {
        SOUNDS, playSound, setMuted,
        isMuted: function () { return muted; },
        playedCount: function () { return played; },
        hasFile: function (name) { return !!files[name]; },
        state: function () { return context ? context.state : 'not started'; }
    };
})();
