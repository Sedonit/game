// === Игра "Пятнашки" ===
let state = 1;
let puzzle;
let winModal; // Переменная для модального окна
let restartBtn; // Переменная для кнопки "Начать заново"
let menuBtn; // Переменная для кнопки "Вернуться в меню"
let victorySound; // Переменная для звука

document.addEventListener('DOMContentLoaded', function () {
    const wrap = document.getElementById('wrap');
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');
    let w, h;
    function resize() {
        w = canvas.width = canvas.offsetWidth;
        h = canvas.height = canvas.offsetHeight;
    }
    window.addEventListener('resize', resize);
    resize();
    // === Звёзды/Солнце ===
    const particles = [];
    const particleCount = 100;
    class Particle {
        constructor() {
            this.reset();
        }
        reset() {
            this.x = Math.random() * w;
            this.y = Math.random() * h;
            this.size = Math.random() * 2 + 1;
            this.speed = Math.random() * 0.5 + 0.1;
            this.angle = Math.random() * Math.PI * 2;
            this.spin = (Math.random() - 0.5) * 0.05;
        }
        update() {
            this.y += this.speed;
            this.angle += this.spin;
            if (this.y > h) {
                this.reset();
                this.y = 0;
            }
        }
        draw() {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
    // Создаем частицы
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }
    // Анимационный цикл
    function animate() {
        ctx.clearRect(0, 0, w, h);
        // Рисуем градиентный фон
        const gradient = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w, h)/2);
        // --- Новый градиент (черно-светлый), соответствует обновлённому body в HTML ---
        gradient.addColorStop(0, '#000000'); // Центр - чёрный
        gradient.addColorStop(1, '#1f1e1e'); // Края - серовато-чёрный
        // --- Конец нового градиента ---
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
        // Обновляем и рисуем частицы
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        requestAnimationFrame(animate);
    }
    animate();
    // === Игра "Пятнашки" ===
    puzzle = document.getElementById('puzzle-container');
    // Находим элементы модального окна
    winModal = document.getElementById('winModal');
    restartBtn = document.getElementById('restartBtn');
    menuBtn = document.getElementById('menuBtn');
    // Находим элемент звука
    victorySound = document.getElementById('victorySound');

    // Обработчики для кнопок модального окна
    restartBtn.addEventListener('click', function() {
        scramble(); // Перемешиваем
        winModal.classList.remove('show'); // Закрываем модальное окно
    });

    menuBtn.addEventListener('click', function() {
        window.location.href = '../index.html'; // Переход в меню
    });

    document.getElementById('solve').addEventListener('click', solve);
    document.getElementById('scramble').addEventListener('click', scramble);
    solve(); // Создаем начальную (решенную) головоломку
});

function solve() {
    if (state == 0) {
        return;
    }
    puzzle.innerHTML = '';
    let n = 1;
    for (let i = 0; i <= 3; i++) {
        for (let j = 0; j <= 3; j++) {
            const cell = document.createElement('span');
            cell.id = 'cell-' + i + '-' + j;
            cell.style.left = (j * 80 + 1 * j + 1) + 'px';
            cell.style.top = (i * 80 + 1 * i + 1) + 'px';
            if (n <= 15) {
                cell.classList.add('number');
                cell.innerHTML = (n++).toString();
            } else {
                cell.className = 'empty';
            }
            puzzle.appendChild(cell);
        }
    }
}

function shiftCell(cell) {
    if (cell.className != 'empty') {
        const emptyCell = getEmptyAdjacentCell(cell);
        if (emptyCell) {
            const tmp = { style: cell.style.cssText, id: cell.id };
            cell.style.cssText = emptyCell.style.cssText;
            cell.id = emptyCell.id;
            emptyCell.style.cssText = tmp.style;
            emptyCell.id = tmp.id;
            if (state == 1) {
                setTimeout(checkOrder, 150);
            }
        }
    }
}

function getCell(row, col) {
    return document.getElementById('cell-' + row + '-' + col);
}

function getEmptyCell() {
    return puzzle.querySelector('.empty');
}

function getEmptyAdjacentCell(cell) {
    const adjacent = getAdjacentCells(cell);
    for (let i = 0; i < adjacent.length; i++) {
        if (adjacent[i].className == 'empty') {
            return adjacent[i];
        }
    }
    return false;
}

function getAdjacentCells(cell) {
    const id = cell.id.split('-');
    const row = parseInt(id[1]);
    const col = parseInt(id[2]);
    const adjacent = [];
    if (row < 3) { adjacent.push(getCell(row + 1, col)); }
    if (row > 0) { adjacent.push(getCell(row - 1, col)); }
    if (col < 3) { adjacent.push(getCell(row, col + 1)); }
    if (col > 0) { adjacent.push(getCell(row, col - 1)); }
    return adjacent;
}

function checkOrder() {
    if (getEmptyCell().id != 'cell-3-3') {
        return;
    }
    let n = 1;
    for (let i = 0; i <= 3; i++) {
        for (let j = 0; j <= 3; j++) {
            if (n <= 15 && getCell(i, j).innerHTML != n.toString()) {
                return;
            }
            n++;
        }
    }
    // Puzzle solved
    // alert('🎉 Поздравляем! Вы собрали пазл!');
    // --- Открываем модальное окно, воспроизводим звук и запускаем конфетти вместо alert ---
    // Сначала воспроизводим звук
    victorySound.currentTime = 0; // Сбрасываем позицию воспроизведения
    victorySound.play().catch(e => console.log("Ошибка воспроизведения звука:", e)); // Воспроизводим, игнорируем ошибки

    // Затем запускаем конфетти
    confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
    });

    // И только потом показываем модальное окно
    winModal.classList.add('show');
    // --- Конец изменений ---
}

function scramble() {
    if (state == 0) {
        return;
    }
    puzzle.removeAttribute('class');
    state = 0;
    let previousCell;
    let i = 1;
    const interval = setInterval(function () {
        if (i <= 100) {
            const emptyCell = getEmptyCell();
            if (!emptyCell) {
                clearInterval(interval);
                state = 1;
                return;
            }
            const adjacent = getAdjacentCells(emptyCell);
            if (previousCell) {
                for (let j = adjacent.length - 1; j >= 0; j--) {
                    if (adjacent[j].innerHTML == previousCell.innerHTML) {
                        adjacent.splice(j, 1);
                    }
                }
            }
            if (adjacent.length > 0) {
                previousCell = adjacent[Math.floor(Math.random() * adjacent.length)];
                shiftCell(previousCell);
            }
            i++;
        } else {
            clearInterval(interval);
            puzzle.className = 'animate';
            state = 1;
        }
    }, 5);
}

// Добавляем обработчик клика к контейнеру пазла
document.addEventListener('click', function (e) {
    if (e.target.id && e.target.id.startsWith('cell-')) {
        if (state == 1) {
            puzzle.className = 'animate';
            shiftCell(e.target);
        }
    }
});