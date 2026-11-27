/*
 * room-effects.js — единый модуль эффектов для всех комнат/игр.
 *
 * Что делает:
 *   • оптимизированный снег (меньше DOM-узлов, только GPU-трансформации,
 *     пауза во вкладке-фоне, отключение на слабых устройствах и при reduced-motion);
 *   • ленивую фоновую музыку (файл не качается, пока пользователь не взаимодействует);
 *   • кнопку «звук вкл/выкл» с запоминанием выбора;
 *   • ленивую загрузку картинок (loading="lazy", decoding="async");
 *   • аккуратное скрытие экрана загрузки.
 *
 * Настройки задаются data-атрибутами на теге скрипта:
 *   <script src="../js/room-effects.js" defer
 *           data-volume="0.18"
 *           data-music-src="../assets/audio/music/music31.ogg"
 *           data-music-off
 *           data-snow-off></script>
 */
(function () {
    'use strict';

    var script = document.currentScript ||
        document.querySelector('script[src*="room-effects.js"]');

    var root = '';
    if (script && script.src) {
        root = script.src.replace(/js\/room-effects\.js(?:[?#].*)?$/, '');
    } else {
        // Скрипт встроен инлайном (игра в iframe): база указывает на виртуальную /games/.
        try {
            root = new URL('../', document.baseURI).href;
        } catch (e) {
            root = '';
        }
    }

    var ds = (script && script.dataset) || {};

    /* Если страница открыта внутри хаба (iframe), не дублируем музыку
       и делаем снег легче. */
    var embedded = window.self !== window.top ||
        /[?&#]embed=1\b/.test(window.location.search + window.location.hash) ||
        ds.embed !== undefined;

    var CONFIG = {
        snow: ds.snowOff !== undefined && ds.snowOff !== 'false' ? false : true,
        music: !embedded && !(ds.musicOff !== undefined && ds.musicOff !== 'false'),
        musicSrc: ds.musicSrc || (root + 'assets/audio/music/music31.ogg'),
        volume: ds.volume !== undefined ? parseFloat(ds.volume) : 0.18,
        images: [root + 'assets/images/main/34.png', root + 'assets/images/main/35.png'],
        muteKey: 'room-effects-muted'
    };

    var reduceMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var lowPower = !!(navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
        !!(navigator.deviceMemory && navigator.deviceMemory <= 4);
    var isMobile = window.innerWidth < 768;

    /* ---------------------------------------------------------------- */
    /* 1. Экран загрузки                                                  */
    /* ---------------------------------------------------------------- */
    function hideLoader() {
        var overlay = document.getElementById('loadingOverlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            overlay.classList.add('hidden');
        }
    }

    function initLoader() {
        if (document.readyState === 'complete') {
            setTimeout(hideLoader, 250);
        } else {
            window.addEventListener('load', function () {
                setTimeout(hideLoader, 250);
            });
        }
        setTimeout(hideLoader, 4000);
    }

    /* ---------------------------------------------------------------- */
    /* 2. Ленивая загрузка картинок                                       */
    /* ---------------------------------------------------------------- */
    function initLazyImages() {
        var images = document.querySelectorAll('img');
        var viewportH = window.innerHeight || 800;

        for (var i = 0; i < images.length; i++) {
            var img = images[i];
            if (img.hasAttribute('loading')) continue;

            var rect = img.getBoundingClientRect();
            var aboveFold = rect.top < viewportH * 0.9;

            img.decoding = 'async';
            if (aboveFold) {
                img.loading = 'eager';
                if (!img.hasAttribute('fetchpriority')) {
                    img.setAttribute('fetchpriority', 'high');
                }
            } else {
                img.loading = 'lazy';
            }
        }
    }

    /* ---------------------------------------------------------------- */
    /* 3. Снег                                                            */
    /* ---------------------------------------------------------------- */
    var snowContainer = null;
    var snowBuilt = false;

    function flakeCounts() {
        var counts;
        if (isMobile) {
            counts = { dots: lowPower ? 12 : 18, images: lowPower ? 2 : 3 };
        } else {
            counts = { dots: lowPower ? 22 : 32, images: lowPower ? 4 : 6 };
        }
        if (embedded) {
            counts.dots = Math.max(8, Math.round(counts.dots * 0.5));
            counts.images = Math.max(1, Math.round(counts.images * 0.5));
        }
        return counts;
    }

    function createDotFlake() {
        var size = 2 + Math.random() * 5;
        var flake = document.createElement('span');
        flake.className = 're-flake';
        flake.style.setProperty('--re-size', size.toFixed(1) + 'px');
        flake.style.setProperty('--re-x', (10 + Math.random() * 80).toFixed(2) + 'vw');
        flake.style.setProperty('--re-dur', (7 + Math.random() * 9).toFixed(2) + 's');
        flake.style.setProperty('--re-delay', (-Math.random() * 12).toFixed(2) + 's');
        flake.style.setProperty('--re-op', (0.4 + Math.random() * 0.5).toFixed(2));
        return flake;
    }

    function createImageFlake() {
        var size = isMobile ? 10 + Math.random() * 18 : 12 + Math.random() * 26;
        var flake = document.createElement('span');
        flake.className = 're-flake re-flake--img';
        flake.style.setProperty('--re-size', size.toFixed(0) + 'px');
        flake.style.setProperty('--re-x', (10 + Math.random() * 80).toFixed(2) + 'vw');
        flake.style.setProperty('--re-dur', (9 + Math.random() * 10).toFixed(2) + 's');
        flake.style.setProperty('--re-delay', (-Math.random() * 14).toFixed(2) + 's');
        flake.style.setProperty('--re-op', (0.55 + Math.random() * 0.4).toFixed(2));
        flake.style.setProperty('--re-img',
            'url("' + CONFIG.images[Math.random() > 0.5 ? 0 : 1] + '")');
        return flake;
    }

    function buildSnow(force) {
        if (!CONFIG.snow || reduceMotion) return;
        if (snowBuilt && !force) return;

        var container = document.getElementById('snowContainer');
        if (!container) {
            container = document.createElement('div');
            container.className = 're-snow';
            container.id = 'snowContainer';
            document.body.appendChild(container);
        } else {
            container.classList.add('re-snow');
        }
        container.innerHTML = '';
        snowContainer = container;

        var counts = flakeCounts();
        var frag = document.createDocumentFragment();
        var i;

        for (i = 0; i < counts.dots; i++) {
            frag.appendChild(createDotFlake());
        }
        for (i = 0; i < counts.images; i++) {
            frag.appendChild(createImageFlake());
        }

        container.appendChild(frag);
        snowBuilt = true;

        if (document.hidden || document.body.classList.contains('hub-open')) {
            container.classList.add('is-paused');
        }
    }

    function initSnow() {
        if (!CONFIG.snow || reduceMotion) return;

        if ('requestIdleCallback' in window) {
            requestIdleCallback(buildSnow, { timeout: 1500 });
        } else {
            setTimeout(buildSnow, 300);
        }

        var resizeTimer = null;
        var wasMobile = isMobile;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                var nowMobile = window.innerWidth < 768;
                if (nowMobile !== wasMobile) {
                    isMobile = nowMobile;
                    wasMobile = nowMobile;
                    buildSnow(true);
                }
            }, 400);
        }, { passive: true });

        document.addEventListener('visibilitychange', function () {
            if (!snowContainer) return;
            if (document.hidden) {
                snowContainer.classList.add('is-paused');
            } else {
                snowContainer.classList.remove('is-paused');
            }
        });
    }

    /* ---------------------------------------------------------------- */
    /* 4. Фоновая музыка (ленивая)                                        */
    /* ---------------------------------------------------------------- */
    var audio = null;
    var audioStarted = false;
    var shouldPlay = false;
    var muted = false;

    try {
        muted = localStorage.getItem(CONFIG.muteKey) === '1';
    } catch (e) { /* localStorage может быть недоступен */ }

    var hasOwnMusic = !!(document.getElementById('audioPlayer') ||
        document.getElementById('background-music') ||
        document.getElementById('menuMusic'));

    function createAudio() {
        if (audio) return audio;
        audio = new Audio();
        audio.loop = true;
        audio.volume = Math.max(0, Math.min(1, CONFIG.volume));
        audio.preload = 'none';
        audio.src = CONFIG.musicSrc;
        return audio;
    }

    function tryPlay() {
        if (!CONFIG.music || hasOwnMusic || muted) return;
        var player = createAudio();
        shouldPlay = true;
        var p = player.play();
        if (p && p.catch) {
            p.catch(function () { /* ждём следующего жеста */ });
        }
    }

    // Запускаем музыку и сообщаем onStarted только при реальном старте:
    // если браузер отклонил play(), остаёмся в ожидании следующего жеста.
    function startAudio(onStarted) {
        if (audioStarted || !CONFIG.music || hasOwnMusic || muted) return;

        var player = createAudio();
        shouldPlay = true;
        var p = player.play();

        var started = function () {
            audioStarted = true;
            if (onStarted) onStarted();
        };

        if (p && p.then) {
            p.then(started).catch(function () { /* ждём следующий жест */ });
        } else {
            started();
        }
    }

    function initMusic() {
        if (!CONFIG.music || hasOwnMusic) return;

        var events = ['pointerdown', 'touchstart', 'keydown', 'click'];
        var detach = function () {
            events.forEach(function (evt) {
                document.removeEventListener(evt, unlock, true);
            });
        };
        var unlock = function () {
            if (audioStarted) {
                detach();
                return;
            }
            startAudio(detach);
        };
        events.forEach(function (evt) {
            document.addEventListener(evt, unlock, true);
        });

        // Пробуем запустить сразу: сработает там, где автоплей разрешён.
        // Если браузер запретил — музыку включит первый же жест в любом месте.
        startAudio(detach);

        document.addEventListener('visibilitychange', function () {
            if (!audio) return;
            if (document.hidden) {
                if (!audio.paused) {
                    shouldPlay = true;
                    audio.pause();
                }
            } else if (shouldPlay && !muted) {
                var p = audio.play();
                if (p && p.catch) p.catch(function () {});
            }
        });
    }

    /* ---------------------------------------------------------------- */
    /* 5. Кнопка звука                                                    */
    /* ---------------------------------------------------------------- */
    function initSoundUi() {
        if (!CONFIG.music || hasOwnMusic) return;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 're-sound-btn';
        btn.setAttribute('aria-label', 'Выключить фоновую музыку');
        btn.setAttribute('title', 'Фоновая музыка');
        btn.textContent = muted ? '🔇' : '🔊';

        function refresh() {
            btn.textContent = muted ? '🔇' : '🔊';
            btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
            btn.setAttribute('aria-label', muted ? 'Включить фоновую музыку' : 'Выключить фоновую музыку');
        }

        btn.addEventListener('click', function () {
            muted = !muted;
            try {
                localStorage.setItem(CONFIG.muteKey, muted ? '1' : '0');
            } catch (e) { /* игнорируем */ }

            if (muted) {
                shouldPlay = false;
                if (audio) audio.pause();
            } else {
                audioStarted = true;
                tryPlay();
            }
            refresh();
        });

        document.body.appendChild(btn);
        refresh();
    }

    /* ---------------------------------------------------------------- */
    /* 5.1 Публичное API для хаба игр                                     */
    /* ---------------------------------------------------------------- */
    window.RoomEffects = {
        pauseMusic: function () {
            shouldPlay = false;
            if (audio && !audio.paused) audio.pause();
        },
        resumeMusic: function () {
            if (!CONFIG.music || hasOwnMusic || muted) return;
            if (audio) {
                shouldPlay = true;
                var p = audio.play();
                if (p && p.catch) p.catch(function () {});
            }
        },
        pauseSnow: function () {
            if (snowContainer) snowContainer.classList.add('is-paused');
        },
        resumeSnow: function () {
            if (snowContainer && !document.hidden) snowContainer.classList.remove('is-paused');
        }
    };

    /* ---------------------------------------------------------------- */
    /* 6. Мост для запуска внутри хаба игр (iframe)                       */
    /* ---------------------------------------------------------------- */
    function initEmbedBridge() {
        if (window.self === window.top) return;

        // Прячем собственные «назад в меню» и сообщаем хабу о закрытии.
        var style = document.createElement('style');
        style.textContent =
            'a[href*="index.html"],[onclick*="index.html"],a[href$="../"],a[href$=".."]{display:none!important}';
        (document.head || document.documentElement).appendChild(style);

        document.addEventListener('click', function (event) {
            var target = event.target;
            var anchor = target.closest && target.closest('a[href]');
            var actionable = anchor || (target.closest && target.closest('[onclick]'));

            if (!actionable) return;

            var href = actionable.getAttribute('href') || '';
            var onclick = actionable.getAttribute('onclick') || '';
            var goesHome = href.indexOf('index.html') !== -1 ||
                href === '..' || href === '../' ||
                onclick.indexOf('index.html') !== -1;

            if (!goesHome) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            try {
                window.parent.postMessage({ type: 'room-effects:close-game' }, '*');
            } catch (err) { /* игнорируем */ }
        }, true);
    }

    /* ---------------------------------------------------------------- */
    /* 7. Старт                                                           */
    /* ---------------------------------------------------------------- */
    function init() {
        initLoader();
        initLazyImages();
        initSnow();
        initMusic();
        initSoundUi();
        initEmbedBridge();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
