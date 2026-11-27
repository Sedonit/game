document.addEventListener('DOMContentLoaded', function () {
    const navbar = document.querySelector('.navbar');
    const navLinks = document.querySelectorAll('.nav-links a');
    const sections = document.querySelectorAll('.section');
    const menuToggle = document.getElementById('menuToggle') || document.querySelector('.menu-toggle');
    const navMenu = document.getElementById('navLinks') || document.querySelector('.nav-links');
    const mobileAuthButtons = document.getElementById('mobileAuth') || document.querySelector('.mobile-auth-buttons');
    const navBackdrop = document.getElementById('navBackdrop');
    const menuClose = document.getElementById('menuClose');

    // === Тема ===
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }

    // === Активная навигация ===
    function updateActiveNav() {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            if (window.scrollY >= (sectionTop - 200)) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    }

    let navScrollTicking = false;
    window.addEventListener('scroll', function () {
        if (navScrollTicking) return;
        navScrollTicking = true;
        requestAnimationFrame(function () {
            updateActiveNav();
            navScrollTicking = false;
        });
    }, { passive: true });

    // === Мобильное меню ===
    function setMenu(open) {
        if (!navMenu) return;
        navMenu.classList.toggle('active', open);
        if (mobileAuthButtons) mobileAuthButtons.classList.toggle('active', open);
        if (navBackdrop) navBackdrop.classList.toggle('active', open);
        document.body.classList.toggle('menu-open', open);
        if (menuToggle) menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function closeMenu() {
        setMenu(false);
    }

    if (menuToggle) {
        menuToggle.addEventListener('click', function (e) {
            e.stopPropagation();
            setMenu(!navMenu.classList.contains('active'));
        });
    }

    if (menuClose) {
        menuClose.addEventListener('click', closeMenu);
    }

    if (navBackdrop) {
        navBackdrop.addEventListener('click', closeMenu);
    }

    // === Закрытие меню при клике вне его ===
    document.addEventListener('click', (e) => {
        if (!navMenu || !navMenu.classList.contains('active')) return;
        if (navbar && !navbar.contains(e.target)) {
            closeMenu();
        }
    });

    // === Закрытие по Escape ===
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMenu();
    });

    // === Меню не нужно на десктопе ===
    window.addEventListener('resize', function () {
        if (window.innerWidth > 768) closeMenu();
    }, { passive: true });

    // === Плавная прокрутка к якорям ===
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href') || '';
            if (href.charAt(0) !== '#') return;
            e.preventDefault();
            const targetSection = document.getElementById(href.substring(1));
            if (targetSection) {
                window.scrollTo({
                    top: targetSection.offsetTop,
                    behavior: 'smooth'
                });
                closeMenu();
            }
        });
    });

    // === Хаб игр (игры хранятся в js/games и грузятся по требованию) ===
    const hub = document.getElementById('gameHub');
    if (!hub) return;

    const frame = document.getElementById('gameFrame');
    const hubTitle = document.getElementById('gameHubTitle');
    const hubClose = document.getElementById('gameHubClose');
    const hubLoader = document.getElementById('gameHubLoader');
    const gameLinks = document.querySelectorAll('[data-game]');

    const templateLoading = Object.create(null);
    const srcdocCache = Object.create(null);
    let isHubOpen = false;
    let currentSlug = null;
    let loadFallbackTimer = null;

    // На медленном соединении или при включённой экономии трафика не грузим
    // игры заранее — только по явному клику.
    function canPrefetch() {
        const connection = navigator.connection;
        if (connection) {
            if (connection.saveData) return false;
            if (/(^|-)2g$/.test(connection.effectiveType || '')) return false;
        }
        return true;
    }

    function slugFromValue(value) {
        if (!value) return '';
        return String(value)
            .replace(/^.*[\\/]/, '')
            .replace(/\.html?$/i, '')
            .trim();
    }

    function findGame(slug) {
        for (let i = 0; i < gameLinks.length; i++) {
            if (gameLinks[i].getAttribute('data-game') === slug) return gameLinks[i];
        }
        return null;
    }

    function loadTemplate(slug) {
        const cache = window.__GAME_TEMPLATES;
        if (cache && cache[slug]) return Promise.resolve(cache[slug]);
        if (templateLoading[slug]) return templateLoading[slug];

        templateLoading[slug] = new Promise(function (resolve, reject) {
            const script = document.createElement('script');
            script.src = 'js/games/' + slug + '.js';
            script.async = true;
            script.onload = function () {
                const templates = window.__GAME_TEMPLATES;
                if (templates && templates[slug]) resolve(templates[slug]);
                else reject(new Error('Шаблон не найден: ' + slug));
            };
            script.onerror = function () {
                // Не запоминаем неудачу навсегда — при повторном клике попробуем снова.
                delete templateLoading[slug];
                script.remove();
                reject(new Error('Не удалось загрузить игру: ' + slug));
            };
            document.head.appendChild(script);
        });

        return templateLoading[slug];
    }

    function buildSrcdoc(html) {
        // Виртуальная база /games/ — относительные пути игр (../assets, ../images)
        // продолжают работать, хотя папки games больше нет.
        const base = new URL('games/', window.location.href).href;
        const safeBase = base.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        const baseTag = '<base href="' + safeBase + '">';

        if (/<head[^>]*>/i.test(html)) {
            return html.replace(/<head[^>]*>/i, function (match) {
                return match + baseTag;
            });
        }
        return baseTag + html;
    }

    function pausePageEffects() {
        if (window.RoomEffects) {
            window.RoomEffects.pauseMusic();
            window.RoomEffects.pauseSnow();
        }
    }

    function resumePageEffects() {
        if (window.RoomEffects) {
            // Если из плеера переехала своя музыка — музыку меню не включаем,
            // даже когда она стоит на паузе (управление у мини-плеера).
            if (!bgTrack) {
                window.RoomEffects.resumeMusic();
            }
            window.RoomEffects.resumeSnow();
        }
    }

    // === Фоновая музыка из плеера: продолжает играть после закрытия хаба ===
    const bgAudio = new Audio();
    bgAudio.preload = 'auto';

    const bgPlayerEl = document.getElementById('bgPlayer');
    const bgCoverEl = document.getElementById('bgCover');
    const bgTitleEl = document.getElementById('bgTitle');
    const bgArtistEl = document.getElementById('bgArtist');
    const bgToggleEl = document.getElementById('bgToggle');
    const bgStopEl = document.getElementById('bgStop');
    const bgPrevEl = document.getElementById('bgPrev');
    const bgNextEl = document.getElementById('bgNext');

    // Плейлист общий с плеером (js/music-playlist.js) — чтобы кнопки переключения
    // и автопереход работали прямо из меню.
    const bgPlaylist = (window.MUSIC_TRACKS || []).map(function (track) {
        return {
            src: new URL(track.src, window.location.href).href,
            title: track.title,
            artist: track.artist,
            cover: track.cover ? new URL(track.cover, window.location.href).href : ''
        };
    });

    let bgTrack = null;
    let bgWanted = false;
    let bgPausedByHub = false;
    let lastMusicState = null;
    let pendingHandoff = null;
    // Что играло в мини-плеере до того, как мы заглушили его в рассказе/новеллах.
    let stoppedSnapshot = null;
    let lastBgSave = 0;
    let playerAudioStarted = false;

    // Позицию мини-плеера тоже запоминаем в localStorage: если музыку выключат
    // в рассказе/новеллах, при возврате в плеер трек продолжится с того же места.
    function saveBgSnapshot() {
        if (!bgTrack || !bgTrack.src) return;
        try {
            localStorage.setItem('playerSrc_minesweeper', bgTrack.src);
            localStorage.setItem('playerTime_minesweeper', String(bgAudio.currentTime || 0));
            localStorage.setItem('playerPlaying_minesweeper', bgWanted ? 'true' : 'false');
            const index = bgIndexBySrc(bgTrack.src);
            if (index >= 0) {
                localStorage.setItem('playerCurrentTrack_minesweeper', String(index));
            }
        } catch (err) { /* игнорируем */ }
    }

    function bgIndexBySrc(src) {
        if (!src) return -1;
        for (let i = 0; i < bgPlaylist.length; i++) {
            if (bgPlaylist[i].src === src) return i;
        }
        return -1;
    }

    // Ставим трек из плейлиста мини-плеера (с автозапуском).
    function playBgTrack(index) {
        if (!bgPlaylist.length) return;
        const count = bgPlaylist.length;
        const i = ((index % count) + count) % count;
        const track = bgPlaylist[i];

        bgTrack = {
            src: track.src,
            title: track.title,
            artist: track.artist,
            cover: track.cover
        };
        bgWanted = true;
        bgPausedByHub = false;

        if (bgAudio.getAttribute('src') !== track.src) {
            bgAudio.setAttribute('src', track.src);
            bgAudio.load();
        }

        const playPromise = bgAudio.play();
        if (playPromise && playPromise.catch) playPromise.catch(function () {});

        if (window.RoomEffects) window.RoomEffects.pauseMusic();
        saveBgSnapshot();
        updateBgUi();
    }

    // Переключение на соседний трек плейлиста (прошлый / следующий).
    function stepBgTrack(delta) {
        if (!bgPlaylist.length) return;
        const current = bgIndexBySrc(bgTrack && bgTrack.src);
        playBgTrack(current < 0 ? 0 : current + delta);
    }

    function updateBgUi() {
        const active = !!bgTrack;
        document.body.classList.toggle('has-bg-music', active);
        if (!bgPlayerEl) return;
        bgPlayerEl.hidden = !active;
        if (!active) return;

        if (bgCoverEl) {
            if (bgTrack.cover) bgCoverEl.src = bgTrack.cover;
            else bgCoverEl.removeAttribute('src');
        }
        if (bgTitleEl) bgTitleEl.textContent = bgTrack.title;
        if (bgArtistEl) bgArtistEl.textContent = bgTrack.artist;

        const playing = !bgAudio.paused;
        if (bgToggleEl) {
            bgToggleEl.textContent = playing ? '⏸' : '▶';
            bgToggleEl.setAttribute('aria-label', playing ? 'Пауза' : 'Включить музыку');
        }
    }

    function startBgMusic(state) {
        if (!state || !state.src) return;

        const volume = typeof state.volume === 'number' ? state.volume : 0.4;
        const seek = typeof state.time === 'number' && isFinite(state.time) ? state.time : 0;

        bgTrack = {
            src: state.src,
            title: state.title || 'Музыка',
            artist: state.artist || '',
            cover: state.cover || ''
        };
        bgWanted = true;
        bgPausedByHub = false;

        bgAudio.volume = Math.max(0, Math.min(1, volume));
        if (bgAudio.src !== state.src) {
            bgAudio.setAttribute('src', state.src);
            bgAudio.load();
        }

        if (bgAudio.readyState >= 1) {
            try { bgAudio.currentTime = seek; } catch (err) { /* игнорируем */ }
        } else {
            bgAudio.addEventListener('loadedmetadata', function () {
                try { bgAudio.currentTime = seek; } catch (err) { /* игнорируем */ }
            }, { once: true });
        }

        // play() вызываем сразу в обработчике клика — иначе браузер может заблокировать.
        const playPromise = bgAudio.play();
        if (playPromise && playPromise.catch) playPromise.catch(function () {});

        if (window.RoomEffects) window.RoomEffects.pauseMusic();
        updateBgUi();
    }

    function resumeBgMusic() {
        if (!bgTrack || !bgWanted) return;
        const playPromise = bgAudio.play();
        if (playPromise && playPromise.catch) playPromise.catch(function () {});
        updateBgUi();
    }

    function pauseBgMusic() {
        if (bgTrack) bgAudio.pause();
        updateBgUi();
    }

    function stopBgMusic(keepSnapshot) {
        // Перед выключением в рассказе сохраняем точную секунду для плеера.
        if (keepSnapshot && bgTrack) {
            saveBgSnapshot();
            // Запоминаем состояние, чтобы вернуть тот же трек при выходе из комнаты.
            stoppedSnapshot = {
                src: bgTrack.src,
                title: bgTrack.title,
                artist: bgTrack.artist,
                cover: bgTrack.cover,
                time: bgAudio.currentTime || 0,
                volume: bgAudio.volume,
                playing: bgWanted
            };
        } else {
            stoppedSnapshot = null;
        }
        bgTrack = null;
        bgWanted = false;
        bgPausedByHub = false;
        lastMusicState = null;
        pendingHandoff = null;
        bgAudio.pause();
        bgAudio.removeAttribute('src');
        try { bgAudio.load(); } catch (err) { /* игнорируем */ }

        // В рассказе/новеллах позиция нужна для возврата в плеер.
        // А при явном выключении музыки трек больше не должен оживать.
        if (!keepSnapshot) {
            try {
                localStorage.removeItem('playerSrc_minesweeper');
                localStorage.removeItem('playerTime_minesweeper');
                localStorage.removeItem('playerPlaying_minesweeper');
            } catch (err) { /* игнорируем */ }
        }
        updateBgUi();
    }

    bgAudio.addEventListener('play', updateBgUi);
    bgAudio.addEventListener('pause', updateBgUi);
    // Трек доиграл — включаем следующий из плейлиста, а не останавливаемся.
    bgAudio.addEventListener('ended', function () {
        if (!bgPlaylist.length) {
            updateBgUi();
            return;
        }
        stepBgTrack(1);
    });
    bgAudio.addEventListener('timeupdate', function () {
        const now = Date.now();
        if (now - lastBgSave < 1000) return;
        lastBgSave = now;
        saveBgSnapshot();
    });

    if (bgToggleEl) {
        bgToggleEl.addEventListener('click', function () {
            if (bgAudio.paused) {
                bgWanted = true;
                bgPausedByHub = false;
                resumeBgMusic();
            } else {
                bgWanted = false;
                pauseBgMusic();
            }
        });
    }

    if (bgPrevEl) {
        bgPrevEl.addEventListener('click', function () { stepBgTrack(-1); });
    }

    if (bgNextEl) {
        bgNextEl.addEventListener('click', function () { stepBgTrack(1); });
    }

    if (bgStopEl) {
        bgStopEl.addEventListener('click', function () { stopBgMusic(); });
    }

    function openGame(value, title, push) {
        const slug = slugFromValue(value);
        if (!slug || !frame) return;

        // Повторный клик по уже открытой игре просто обновляет заголовок.
        if (isHubOpen && currentSlug === slug) return;

        const cleanTitle = title || 'Игра';
        currentSlug = slug;
        isHubOpen = true;

        hub.classList.add('is-open');
        hub.setAttribute('aria-hidden', 'false');
        document.body.classList.add('hub-open');

        if (hubTitle) hubTitle.textContent = cleanTitle;
        if (hubLoader) hubLoader.classList.remove('is-hidden');

        pausePageEffects();

        // Музыка из плеера в комнатах продолжает звучать фоном. Исключение —
        // рассказ и новеллы: там она мешает читать, поэтому глушим совсем.
        if (bgTrack) {
            if (slug === 'book' || slug === 'novell') {
                stopBgMusic(true);
            } else if (slug === 'music') {
                playerAudioStarted = false;
                // Возвращаемся в плеер: отдаём ему трек с той же секунды.
                pendingHandoff = {
                    src: bgTrack.src,
                    title: bgTrack.title,
                    artist: bgTrack.artist,
                    cover: bgTrack.cover,
                    time: bgAudio.currentTime || 0,
                    volume: bgAudio.volume,
                    playing: bgWanted
                };
                bgPausedByHub = true;
                pauseBgMusic();
            }
        }

        if (push !== false) {
            try {
                history.pushState(
                    { game: slug, title: cleanTitle },
                    '',
                    '#game=' + encodeURIComponent(slug)
                );
            } catch (err) { /* игнорируем */ }
        }

        closeMenu();

        loadTemplate(slug).then(function (html) {
            if (!isHubOpen || currentSlug !== slug) return;

            if (!srcdocCache[slug]) srcdocCache[slug] = buildSrcdoc(html);
            frame.removeAttribute('src');
            frame.srcdoc = srcdocCache[slug];

            // Страховка: если какой-то ресурс игры «завис», лоадер не останется навсегда.
            clearTimeout(loadFallbackTimer);
            loadFallbackTimer = setTimeout(function () {
                if (isHubOpen && hubLoader) hubLoader.classList.add('is-hidden');
            }, 1500);
        }).catch(function () {
            if (!isHubOpen) return;
            if (hubLoader) {
                hubLoader.innerHTML = '<p>Не удалось загрузить игру. Проверь соединение и попробуй ещё раз.</p>';
            }
        });
    }

    function closeGame(fromPop) {
        if (!isHubOpen) return;

        // Запоминаем состояние плеера ДО удаления iframe: музыка переедет в меню.
        const closingSlug = currentSlug;
        const handoff = closingSlug === 'music' &&
            lastMusicState && lastMusicState.playing && lastMusicState.src
            ? lastMusicState
            : null;

        isHubOpen = false;
        currentSlug = null;
        pendingHandoff = null;
        playerAudioStarted = false;
        clearTimeout(loadFallbackTimer);

        hub.classList.remove('is-open');
        hub.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('hub-open');

        if (frame) {
            frame.removeAttribute('srcdoc');
            frame.src = 'about:blank';
        }
        if (hubLoader) hubLoader.classList.add('is-hidden');

        // Возврат из рассказа/новелл: включаем обратно тот же трек с того же места.
        const restoreSnapshot = stoppedSnapshot;
        stoppedSnapshot = null;

        if (handoff) {
            startBgMusic(handoff);
        } else if (restoreSnapshot) {
            if (restoreSnapshot.playing) {
                startBgMusic(restoreSnapshot);
            } else {
                bgTrack = {
                    src: restoreSnapshot.src,
                    title: restoreSnapshot.title,
                    artist: restoreSnapshot.artist,
                    cover: restoreSnapshot.cover
                };
                bgWanted = false;
                bgAudio.volume = Math.max(0, Math.min(1, restoreSnapshot.volume));
                updateBgUi();
            }
        } else if (bgTrack && bgWanted && bgPausedByHub) {
            bgPausedByHub = false;
            resumeBgMusic();
        }

        resumePageEffects();

        if (!fromPop) {
            try {
                history.replaceState(null, '', window.location.pathname + window.location.search);
            } catch (err) { /* игнорируем */ }
        }
    }

    gameLinks.forEach(function (link) {
        const slug = link.getAttribute('data-game');
        if (!slug) return;

        // Лёгкий prefetch шаблона при наведении/фокусе — открытие почти мгновенное.
        const prefetch = function () {
            if (!canPrefetch()) return;
            loadTemplate(slug).catch(function () {});
        };
        link.addEventListener('pointerenter', prefetch, { once: true });
        link.addEventListener('focus', prefetch, { once: true });
        // На тач-экранах наведения нет, зато есть момент касания — грузим тогда.
        link.addEventListener('touchstart', prefetch, { once: true, passive: true });

        link.addEventListener('click', function (e) {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            openGame(slug, link.getAttribute('data-title'));
        });
    });

    if (hubClose) {
        hubClose.addEventListener('click', function () { closeGame(); });
    }

    if (frame) {
        frame.addEventListener('load', function () {
            if (!isHubOpen) return;

            clearTimeout(loadFallbackTimer);
            if (hubLoader) hubLoader.classList.add('is-hidden');

            // Внутри iframe прячем его собственные «назад в меню» и перехватываем переходы.
            try {
                const doc = frame.contentDocument;
                if (!doc) return;

                if (!doc.getElementById('re-embed-style')) {
                    const style = doc.createElement('style');
                    style.id = 're-embed-style';
                    style.textContent =
                        'a[href*="index.html"],[onclick*="index.html"],a[href$="../"],a[href$=".."]{display:none!important}';
                    (doc.head || doc.documentElement).appendChild(style);

                    // Нижний safe-area добавляем только комнатам без своего отступа:
                    // иначе правило затирало padding комнаты и текст уезжал под меню.
                    const bodyPad = parseFloat(doc.defaultView.getComputedStyle(doc.body).paddingBottom) || 0;
                    if (bodyPad === 0) {
                        doc.body.style.paddingBottom = 'env(safe-area-inset-bottom)';
                    }
                }
            } catch (err) { /* документ ещё не готов */ }
        });
    }

    window.addEventListener('popstate', function () {
        if (isHubOpen) closeGame(true);
    });

    window.addEventListener('message', function (event) {
        const data = event.data;
        if (!data) return;
        if (data.type === 'room-effects:close-game' && isHubOpen) {
            closeGame();
            return;
        }
        if (data.type === 'music:request-state' && isHubOpen && currentSlug === 'music') {
            // Плеер при открытии спрашивает, что играло в мини-плеере.
            const state = pendingHandoff || (bgTrack ? {
                src: bgTrack.src,
                title: bgTrack.title,
                artist: bgTrack.artist,
                cover: bgTrack.cover,
                time: bgAudio.currentTime || 0,
                volume: bgAudio.volume,
                playing: bgWanted
            } : null);
            if (state && frame && frame.contentWindow) {
                frame.contentWindow.postMessage({ type: 'music:restore', state: state }, '*');
            }
            return;
        }
        if (data.type === 'music:state') {
            lastMusicState = data;
            if (currentSlug === 'music') {
                // Держим мини-плеер в согласии с плеером: пауза/плей и трек.
                // false до первого play — это ещё не пауза, а незапущенный трек.
                if (data.playing) {
                    playerAudioStarted = true;
                    bgWanted = true;
                } else if (playerAudioStarted) {
                    bgWanted = false;
                }
                if (bgTrack) {
                    bgTrack.title = data.title || bgTrack.title;
                    bgTrack.artist = data.artist || bgTrack.artist;
                    bgTrack.cover = data.cover || bgTrack.cover;
                } else if (data.src) {
                    bgTrack = {
                        src: data.src,
                        title: data.title || 'Музыка',
                        artist: data.artist || '',
                        cover: data.cover || ''
                    };
                }
            }
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && isHubOpen) closeGame();
    });

    // === Прямая ссылка #game=book (поддерживаем и старый #game=games/book.html) ===
    const hashMatch = /^#game=(.+)$/.exec(window.location.hash);
    if (hashMatch) {
        let value = '';
        try {
            value = decodeURIComponent(hashMatch[1]);
        } catch (err) {
            value = '';
        }
        const slug = slugFromValue(value);
        const game = slug ? findGame(slug) : null;
        if (game) openGame(slug, game.getAttribute('data-title'), false);
    }
});