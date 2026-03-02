document.addEventListener('DOMContentLoaded', () => {
    // Game State
    let currentLevel = 1;
    let isExecuting = false;

    // Level Data
    const levels = [
        {
            size: 6,
            start: { x: 0, y: 0, dir: 90 }, // 0: N, 90: E, 180: S, 270: W
            target: { x: 5, y: 5 },
            obstacles: [{ x: 2, y: 2 }, { x: 3, y: 3 }, { x: 5, y: 0 }]
        },
        {
            size: 8,
            start: { x: 0, y: 7, dir: 90 },
            target: { x: 7, y: 0 },
            obstacles: [{ x: 2, y: 7 }, { x: 2, y: 6 }, { x: 4, y: 3 }, { x: 5, y: 3 }, { x: 6, y: 3 }]
        }
    ];

    let roverState = { x: 0, y: 0, dir: 90 };
    let currentObstacles = [];
    let currentTarget = {};
    let boardSize = 6;
    let cellSize = 80;

    // DOM Elements
    const gameBoard = document.getElementById('game-board');
    const levelNumberEl = document.getElementById('level-number');
    const mainQueue = document.getElementById('program-queue');
    const btnClear = document.getElementById('btn-clear');
    const btnRun = document.getElementById('btn-run');
    const victoryOverlay = document.getElementById('victory-overlay');
    const crashOverlay = document.getElementById('crash-overlay');
    const btnNextLevel = document.getElementById('btn-next-level');
    const btnRetry = document.getElementById('btn-retry');

    let roverEl = null;

    // Initialize drag and drop
    function initDragAndDrop() {
        const draggableBlocks = document.querySelectorAll('.palette .block');
        const dropZones = document.querySelectorAll('.block-drop-zone');

        draggableBlocks.forEach(block => {
            block.addEventListener('dragstart', handleDragStart);
            block.addEventListener('dragend', handleDragEnd);
        });

        dropZones.forEach(zone => {
            zone.addEventListener('dragover', handleDragOver);
            zone.addEventListener('dragleave', handleDragLeave);
            zone.addEventListener('drop', handleDrop);
        });
    }

    let draggedType = null;
    let draggedHtml = null;

    function handleDragStart(e) {
        if (isExecuting) {
            e.preventDefault();
            return;
        }
        draggedType = this.dataset.type;
        // Construct the HTML for the cloned block depending on type
        if (draggedType === 'repeat' || draggedType === 'if') {
            draggedHtml = this.outerHTML;
        } else {
            draggedHtml = this.outerHTML;
        }
        e.dataTransfer.setData('text/plain', draggedType);
        this.style.opacity = '0.4';
    }

    function handleDragEnd(e) {
        this.style.opacity = '1';
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.add('drag-over');
    }

    function handleDragLeave(e) {
        e.stopPropagation();
        this.classList.remove('drag-over');
    }

    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('drag-over');

        if (isExecuting) return;

        // Hide empty state if present
        const emptyState = mainQueue.querySelector('.empty-state');
        if (emptyState) emptyState.style.display = 'none';

        // Create the new block element
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = draggedHtml;
        const newBlock = tempDiv.firstElementChild;

        newBlock.classList.add('block-in-queue');
        newBlock.removeAttribute('draggable'); // Once in queue, we don't drag it again (for simplicity)

        // Add delete button
        const delBtn = document.createElement('button');
        delBtn.innerHTML = '×';
        delBtn.className = 'delete-btn';
        delBtn.onclick = function (ev) {
            ev.stopPropagation();
            newBlock.remove();
            checkEmptyState();
        };
        newBlock.appendChild(delBtn);

        // If it's a logic block, ensure inner drop zones are initialized
        if (newBlock.classList.contains('logic-block')) {
            const innerZones = newBlock.querySelectorAll('.block-drop-zone');
            innerZones.forEach(zone => {
                zone.addEventListener('dragover', handleDragOver);
                zone.addEventListener('dragleave', handleDragLeave);
                zone.addEventListener('drop', handleDrop);
            });
        }

        this.appendChild(newBlock);
    }

    function checkEmptyState() {
        const blocks = mainQueue.querySelectorAll(':scope > .block');
        const emptyState = mainQueue.querySelector('.empty-state');
        if (blocks.length === 0 && emptyState) {
            emptyState.style.display = 'block';
        }
    }

    // Initialize Level
    function loadLevel(levelIndex) {
        const data = levels[levelIndex - 1];
        if (!data) {
            alert("Você completou todos os planetas!");
            // Reset to 1
            currentLevel = 1;
            loadLevel(1);
            return;
        }

        boardSize = data.size;
        roverState = { ...data.start };
        currentTarget = { ...data.target };
        currentObstacles = [...data.obstacles];

        document.documentElement.style.setProperty('--board-size', boardSize);
        levelNumberEl.innerText = levelIndex;

        drawBoard();
    }

    function drawBoard() {
        gameBoard.innerHTML = '';

        // Ensure UI matches size dynamically (for 8x8 it will scale cells or fit in container)
        // For simplicity, we keep cell size fixed, just grid changes.

        for (let r = 0; r < boardSize; r++) {
            for (let c = 0; c < boardSize; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';

                // Check for obstacles
                const isObstacle = currentObstacles.some(o => o.x === c && o.y === r);
                if (isObstacle) {
                    const crater = document.createElement('div');
                    crater.className = 'crater';
                    cell.appendChild(crater);
                }

                // Check for target
                if (currentTarget.x === c && currentTarget.y === r) {
                    const gem = document.createElement('div');
                    gem.className = 'gem';
                    gem.innerText = '💎';
                    cell.appendChild(gem);
                }

                gameBoard.appendChild(cell);
            }
        }

        // Add Rover absolute positioned
        roverEl = document.createElement('div');
        roverEl.className = 'rover';
        roverEl.innerText = '🤖';
        gameBoard.appendChild(roverEl);

        updateRoverVisuals(false);
    }

    function updateRoverVisuals(animate = true) {
        if (!animate) {
            roverEl.style.transition = 'none';
        } else {
            roverEl.style.transition = 'transform 0.4s ease-in-out, top 0.4s ease-in-out, left 0.4s ease-in-out';
        }

        // Calculate position based on grid logic:
        // x goes left to right, y goes top to bottom
        roverEl.style.left = (roverState.x * cellSize + roverState.x * 2) + 'px'; // +2 for grid gap
        roverEl.style.top = (roverState.y * cellSize + roverState.y * 2) + 'px';

        // Update rotation. Need to keep cumulative rotation to avoid 360 to 0 spin backs
        // For simplicity, we just set the degrees visually
        roverEl.style.transform = `rotate(${roverState.dir}deg)`;

        if (!animate) {
            // Force layout recalculation to apply no-transition immediately
            void roverEl.offsetWidth;
        }
    }

    // --- Execution Logic --- //
    const delay = ms => new Promise(res => setTimeout(res, ms));

    async function executeCommands() {
        if (isExecuting) return;

        const blocks = Array.from(mainQueue.querySelectorAll(':scope > .block-in-queue'));
        if (blocks.length === 0) return;

        isExecuting = true;
        btnRun.disabled = true;
        btnClear.disabled = true;
        document.body.style.pointerEvents = 'none'; // Prevent drag/drop during execution

        // Reset rover to start position
        const data = levels[currentLevel - 1];
        roverState = { ...data.start };
        updateRoverVisuals(false); // Snap back immediately
        await delay(500);
        updateRoverVisuals(true); // Re-enable animation

        try {
            await runSequence(blocks);

            // Check win condition
            if (roverState.x === currentTarget.x && roverState.y === currentTarget.y) {
                victoryOverlay.classList.remove('hidden');
            } else {
                // Return to start after delay if didn't win
                await delay(1000);
                roverState = { ...data.start };
                updateRoverVisuals(false);
                isExecuting = false;
                btnRun.disabled = false;
                btnClear.disabled = false;
                document.body.style.pointerEvents = 'auto';
            }
        } catch (error) {
            if (error === 'CRASH') {
                crashOverlay.classList.remove('hidden');
            }
        }
    }

    async function runSequence(blocks) {
        for (let block of blocks) {
            block.classList.add('executing');
            await delay(200);

            const type = block.dataset.type;

            if (type === 'forward') {
                await moveForward();
            } else if (type === 'turn-left') {
                roverState.dir -= 90;
                updateRoverVisuals();
                await delay(600);
            } else if (type === 'turn-right') {
                roverState.dir += 90;
                updateRoverVisuals();
                await delay(600);
            } else if (type === 'repeat') {
                const countInput = block.querySelector('.repeat-count');
                const count = parseInt(countInput.value) || 1;
                const innerZone = block.querySelector('.block-drop-zone');
                const innerBlocks = Array.from(innerZone.querySelectorAll(':scope > .block-in-queue'));
                for (let i = 0; i < count; i++) {
                    await runSequence(innerBlocks);
                }
            } else if (type === 'if') {
                const conditionSelect = block.querySelector('.condition-select');
                const condition = conditionSelect.value;
                const trueZone = block.querySelector('.true-zone');
                const falseZone = block.querySelector('.false-zone');
                const trueBlocks = Array.from(trueZone.querySelectorAll(':scope > .block-in-queue'));
                const falseBlocks = Array.from(falseZone.querySelectorAll(':scope > .block-in-queue'));

                let isTrue = false;
                if (condition === 'path-clear') {
                    isTrue = isPathClear();
                } else if (condition === 'on-target') {
                    isTrue = (roverState.x === currentTarget.x && roverState.y === currentTarget.y);
                }

                if (isTrue) {
                    await runSequence(trueBlocks);
                } else {
                    await runSequence(falseBlocks);
                }
            }

            block.classList.remove('executing');
            await delay(200);
        }
    }

    function getNextCoords() {
        let nDir = ((roverState.dir % 360) + 360) % 360; // Normalize 0-359
        let nx = roverState.x;
        let ny = roverState.y;

        if (nDir === 0) ny -= 1;        // Up / North
        else if (nDir === 90) nx += 1;  // Right / East
        else if (nDir === 180) ny += 1; // Down / South
        else if (nDir === 270) nx -= 1; // Left / West

        return { x: nx, y: ny };
    }

    function isPathClear() {
        const next = getNextCoords();
        // Check bounds
        if (next.x < 0 || next.x >= boardSize || next.y < 0 || next.y >= boardSize) return false;
        // Check obstacles
        if (currentObstacles.some(o => o.x === next.x && o.y === next.y)) return false;
        return true;
    }

    async function moveForward() {
        const next = getNextCoords();

        roverState.x = next.x;
        roverState.y = next.y;
        updateRoverVisuals();

        await delay(600);

        // Collision Check AFTER visual move ends
        if (roverState.x < 0 || roverState.x >= boardSize || roverState.y < 0 || roverState.y >= boardSize) {
            throw 'CRASH'; // Out of bounds
        }
        if (currentObstacles.some(o => o.x === roverState.x && o.y === roverState.y)) {
            throw 'CRASH'; // Hit obstacle
        }
    }

    // --- Events binding --- //
    initDragAndDrop();

    btnClear.addEventListener('click', () => {
        if (isExecuting) return;
        mainQueue.innerHTML = '<div class="empty-state">Arraste os comandos aqui</div>';
    });

    btnRun.addEventListener('click', executeCommands);

    btnNextLevel.addEventListener('click', () => {
        victoryOverlay.classList.add('hidden');
        currentLevel++;
        isExecuting = false;
        btnRun.disabled = false;
        btnClear.disabled = false;
        document.body.style.pointerEvents = 'auto';
        mainQueue.innerHTML = '<div class="empty-state">Arraste os comandos aqui</div>';
        loadLevel(currentLevel);
    });

    btnRetry.addEventListener('click', () => {
        crashOverlay.classList.add('hidden');
        isExecuting = false;
        btnRun.disabled = false;
        btnClear.disabled = false;
        document.body.style.pointerEvents = 'auto';
        // Reset rover
        const data = levels[currentLevel - 1];
        roverState = { ...data.start };
        updateRoverVisuals(false);
    });

    // Start
    loadLevel(currentLevel);
});
