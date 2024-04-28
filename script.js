const TILE_SIZE_PX = 32;
const WIDTH = 12;
const HEIGHT = 16;
const WIDTH_PX = WIDTH * TILE_SIZE_PX;
const HEIGHT_PX = HEIGHT * TILE_SIZE_PX;

const BASIC_BRUSHES = [0x01,0x02,0x04,0x08];
const CURVE_BRUSHES = [0x11,0x12,0x13,0x14,0x15];
const COMPLEX_BRUSHES = [0x80,0x90,0xA0,0xB0,0xC0,0xD0,0xE0,0xF0];

const mainCanvas = document.getElementById("canvas");
const mainCtx = mainCanvas.getContext("2d");

let tilemap = new Uint8Array(WIDTH * HEIGHT);
let activeBrushId = 0x01;

let currentlyEditing = false;
let activeEditType = null;
let inProgressEdits = [];
let history = [];
let historyPosition = 0;

function drawLinePx(ctx, x0, y0, x1, y1) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
}

function drawLine(ctx, x0, y0, x1, y1) {
    drawLinePx(
        ctx,
        x0 * TILE_SIZE_PX,
        y0 * TILE_SIZE_PX,
        x1 * TILE_SIZE_PX,
        y1 * TILE_SIZE_PX)
}

function drawCirclePx(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r, 0, 0, 2 * Math.PI);
    ctx.stroke();
}

function drawCircle(ctx, cx, cy, r) {
    drawCirclePx(
        ctx,
        cx * TILE_SIZE_PX,
        cy * TILE_SIZE_PX,
        r * TILE_SIZE_PX)
}

function drawQuarterCirclePx(ctx, cx, cy, r, startAngle) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r, 0, startAngle, startAngle + Math.PI * .5);
    ctx.stroke();
}

function drawQuarterCircle(ctx, cx, cy, r, startAngle) {
    drawQuarterCirclePx(
        ctx,
        cx * TILE_SIZE_PX,
        cy * TILE_SIZE_PX,
        r * TILE_SIZE_PX,
        startAngle)
}

function renderBackdrop(ctx) {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function renderEditHighlights(ctx) {
    for (const edit of inProgressEdits) {
        ctx.fillStyle = "#724";
        ctx.fillRect(
            edit.x * TILE_SIZE_PX,
            edit.y * TILE_SIZE_PX,
            TILE_SIZE_PX,
            TILE_SIZE_PX);
    }
}

function renderTile(ctx, tileId, x, y) {
    ctx.strokeStyle = "white";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";

    const isBasicLine = (tileId & 0xf0) == 0;
    const isComplexLine = (tileId & 0x80) != 0;

    if (tileId == 0x11) {
        drawCircle(ctx, x+.5,y+.5,.5);
    }
    if (tileId == 0x12) {
        drawQuarterCircle(ctx, x+1,y+1,1,Math.PI*1.);
    }
    if (tileId == 0x13) {
        drawQuarterCircle(ctx, x,y+1,1,Math.PI*1.5);
    }
    if (tileId == 0x14) {
        drawQuarterCircle(ctx, x+1,y,1,Math.PI*.5);
    }
    if (tileId == 0x15) {
        drawQuarterCircle(ctx, x,y,1,Math.PI*0.);
    }

    if (isBasicLine || isComplexLine) {
        if (tileId & 0x01) { drawLine(ctx, x, y, x, y+1); }
        if (tileId & 0x02) { drawLine(ctx, x, y, x+1, y); }
        if (tileId & 0x04) { drawLine(ctx, x, y, x+1, y+1); }
        if (tileId & 0x08) { drawLine(ctx, x, y+1, x+1, y); }
    }

    if (isComplexLine) {
        const lineType = tileId & 0xf0;
        if (lineType == 0x80) { drawLine(ctx, x, y, x+.5, y+1); }
        if (lineType == 0x90) { drawLine(ctx, x, y, x+1, y+.5); }
        if (lineType == 0xa0) { drawLine(ctx, x, y+.5, x+1, y); }
        if (lineType == 0xb0) { drawLine(ctx, x+.5, y+1, x+1, y); }
        if (lineType == 0xc0) { drawLine(ctx, x+.5, y, x+1, y+1); }
        if (lineType == 0xd0) { drawLine(ctx, x, y+.5, x+1, y+1); }
        if (lineType == 0xe0) { drawLine(ctx, x, y+1, x+1, y+.5); }
        if (lineType == 0xf0) { drawLine(ctx, x, y+1, x+.5, y); }
    }
}

function renderTilemap(ctx) {
    tilemap.forEach((tileId,idx)=>{
        x = idx % WIDTH
        y = Math.floor(idx / WIDTH)
        x += 1/16;
        y += 1/16;
        renderTile(ctx, tileId, x, y)
    });
}

function renderGridlines(ctx) {
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 1;

    for (let x = 0; x < WIDTH; ++x) {
        drawLine(ctx, x, 0, x, HEIGHT);
    }
    for (let y = 0; y < HEIGHT; ++y) {
        drawLine(ctx, 0, y, WIDTH, y);
    }
}

function redrawBoard() {
    renderBackdrop(mainCtx);
    renderEditHighlights(mainCtx);
    renderTilemap(mainCtx);
    renderGridlines(mainCtx);
}

function redrawButtons() {
    const toolPalette = document.getElementById("tool-palette");
    const toolButtons = toolPalette.getElementsByTagName("button");

    for (var toolButton of toolButtons) {
        const brushIdStr = toolButton.getAttribute("data-brush");
        const brushId = parseInt(brushIdStr,16);

        const actionIdStr = toolButton.getAttribute("data-action");

        if (brushId == activeBrushId) {
            toolButton.setAttribute('data-active','true');
        } else {
            toolButton.removeAttribute('data-active');
        }

        if (actionIdStr == "undo") {
            if (canUndo()) {
                toolButton.removeAttribute('disabled');
            } else {
                toolButton.setAttribute('disabled','true')
            }
        }

        if (actionIdStr == "redo") {
            if (canRedo()) {
                toolButton.removeAttribute('disabled');
            } else {
                toolButton.setAttribute('disabled','true')
            }
        }

        if (actionIdStr == "export") {
            toolButton.innerHTML = "export to clipboard";
        }
    }
}

function onBrushClick(brushIdStr) {
    //console.log(`onBrushClick(${brushIdStr})`);
    const brushId = parseInt(brushIdStr,16);
    activeBrushId = brushId;
    redrawButtons();
}

function gridCoordsFromPointerCoords(x,y) {
    gx = Math.floor((x * WIDTH) / mainCanvas.width);
    gy = Math.floor((y * HEIGHT) / mainCanvas.height);
    //console.log(`${x} ${y} -> ${gx} ${gy}`)
    return [gx, gy];
}

function gridCoordsFromEvent(e, clientX, clientY) {
    const rect = e.target.getBoundingClientRect();
    const rel_x = clientX - rect.left;
    const rel_y = clientY - rect.top;

    const grid_x = Math.floor((rel_x * WIDTH) / rect.width);
    const grid_y = Math.floor((rel_y * HEIGHT) / rect.height);

    const clamped_x = Math.min(Math.max(grid_x, 0), WIDTH - 1);
    const clamped_y = Math.min(Math.max(grid_y, 0), HEIGHT - 1);

    return [clamped_x, clamped_y];
}

function getTileIdAtGridCoords(gx,gy) {
    const tileId = tilemap[gy*WIDTH+gx];
    //console.log(`getTileIdAtGridCoords(${gx},${gy}) -> ${tileId}`)
    return tileId;
}

function setTileIdAtGridCoords(gx,gy,tileId) {
    //console.log(`setTileIdAtGridCoords(${gx},${gy},${tileId})`)
    tilemap[gy*WIDTH+gx] = tileId;
}

function determineEditType(brushId, initialTileId) {
    const tileId = initialTileId;

    const isBasicBrush = BASIC_BRUSHES.includes(brushId);
    const isCurveBrush = CURVE_BRUSHES.includes(brushId);
    const isComplexBrush = COMPLEX_BRUSHES.includes(brushId);
    const isLineBrush = !isCurveBrush;

    const isCurveTile = CURVE_BRUSHES.includes(tileId);
    const isLineTile = !isCurveTile;

    if (brushId == 0x00) {
        return 'erase';
    }

    if (isBasicBrush) {
        if (isLineTile && (initialTileId & brushId) != 0) {
            return 'remove';
        } else {
            return 'add';
        }
    }
    
    if (isCurveBrush) {
        if (initialTileId == brushId) {
            return 'remove';
        } else {
            return 'add';
        }
    }
    
    if (isComplexBrush) {
        if (isLineTile && (initialTileId & 0xF0) == brushId) {
            return 'remove';
        } else {
            return 'add';
        }
    }
}

function computeEditResult(brushId, tileId, editType) {
    const isBasicBrush = BASIC_BRUSHES.includes(brushId);
    const isCurveBrush = CURVE_BRUSHES.includes(brushId);
    const isComplexBrush = COMPLEX_BRUSHES.includes(brushId);
    const isLineBrush = !isCurveBrush;

    const isCurveTile = CURVE_BRUSHES.includes(tileId);
    const isLineTile = !isCurveTile;

    if (editType == 'erase') {
        return 0x00;
    }

    if (editType == 'add') {
        if (isCurveBrush) {
            return brushId;
        }
        if (isLineBrush && !isLineTile) {
            return brushId;
        }
        if (isBasicBrush) {
            return tileId | brushId;
        }
        if (isComplexBrush) {
            return (tileId & 0x0F) | brushId;
        }
    }

    if (editType == 'remove') {
        if (isCurveBrush && !isCurveTile) {
            return tileId;
        }

        if (isLineBrush && !isLineTile) {
            return tileId;
        }

        if (isCurveBrush) {
            if (tileId == brushId) {
                return 0x00;
            } else {
                return tileId;
            }
        }
        
        if (isBasicBrush) {
            if (isLineTile) {
                return tileId & ~brushId;
            } else {
                return tileId;
            }
        }

        if (isComplexBrush) {
            if (isLineTile) {
                if ((tileId & 0xF0) == brushId) {
                    return tileId & 0x0F;
                } else {
                    return tileId;
                }
            } else {
                return tileId;
            }
        }
    }

    console.log("shouldn't be possible to get here!");
    console.log(`brushId: ${brushId}, tileId: ${tileId}, editType: ${editType}`);
}

function applyEditToTile(gx,gy) {
    const brushId = activeBrushId;
    const tileId = getTileIdAtGridCoords(gx,gy);
    const newTileId = computeEditResult(brushId, tileId, activeEditType);

    if (newTileId != tileId) {
        inProgressEdits.push({
            'x':gx,
            'y':gy,
            'from':tileId,
            'to':newTileId
        });
        setTileIdAtGridCoords(gx, gy, newTileId);
        return true;
    }

    return false;
}

function editBegin(e) {
    if (currentlyEditing) {
        return;
    }
    currentlyEditing = true;

    [x,y] = gridCoordsFromEvent(e, e.clientX, e.clientY);
    targetTile = getTileIdAtGridCoords(x,y);
    activeEditType = determineEditType(activeBrushId, targetTile);
    if (applyEditToTile(x,y)) {
        redrawBoard();
    }
}

function editMove(e) {
    if (!currentlyEditing) {
        return;
    }

    let anyEditsHappened = false;
    let maxAxialMovement = Math.max(Math.abs(e.movementX), Math.abs(e.movementY));
    let steps = Math.max(1,Math.ceil(maxAxialMovement / 16));
    for (let step = 0; step < steps; step++) {
        let clientX = e.clientX - (e.movementX * (step/steps));
        let clientY = e.clientY - (e.movementY * (step/steps));
        [x,y] = gridCoordsFromEvent(e, clientX, clientY);
        targetTile = getTileIdAtGridCoords(x,y);
        anyEditsHappened |= applyEditToTile(x,y);
    }

    if (anyEditsHappened) {
        redrawBoard();
    }
}

function editEnd(e) {
    if (!currentlyEditing) {
        return;
    }
    currentlyEditing = false;

    history = history.slice(0, historyPosition);
    history.push(inProgressEdits);
    historyPosition = history.length;
    inProgressEdits = [];

    redrawBoard();
    redrawButtons();
}

function canUndo() {
    return historyPosition > 0;
}

function canRedo() {
    return historyPosition < history.length;
}

function performUndo() {
    if (!canUndo()) {
        return;
    }

    historyPosition--;
    const editsToRevert = history[historyPosition];
    for (const edit of editsToRevert) {
        setTileIdAtGridCoords(edit.x, edit.y, edit.from);
    }

    redrawBoard();
    redrawButtons();
}

function performRedo() {
    if (!canRedo()) {
        return;
    }

    const editsToReapply = history[historyPosition];
    historyPosition++;
    for (const edit of editsToReapply) {
        setTileIdAtGridCoords(edit.x, edit.y, edit.to);
    }
    
    redrawBoard();
    redrawButtons();
}

async function performExport(e) {
    let exportStr = "";
    for (let y = 0; y < HEIGHT; ++y) {
        for (let x = 0; x < WIDTH; ++x) {
            const hex = getTileIdAtGridCoords(x,y).toString(16).padStart(2,'0');
            //exportStr += `0x${hex},`
            exportStr += hex;
        }
        exportStr += "\n";
    }

    // not 100% confident in this yet
    /*let exportStr = "";
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (let i = 0; i < tilemap.length; i += 3) {
        const i0 = tilemap[i];
        const i1 = ((i+1)<tilemap.length) ? tilemap[i+1] : 0;
        const i2 = ((i+2)<tilemap.length) ? tilemap[i+2] : 0;
        
        const o0 = (i0 >> 2) & 0x3f;
        const o1 = (i0 << 4 | i1 >> 4) & 0x3f;
        const o2 = (i1 << 2 | i2 >> 6) & 0x3f;
        const o3 = (i2) & 0x3f;

        exportStr += alphabet[o0];
        exportStr += alphabet[o1];
        exportStr += ((i+1)<tilemap.length) ? alphabet[o2] : '=';
        exportStr += ((i+2)<tilemap.length) ? alphabet[o3] : '=';
    }*/

    try {
        await navigator.clipboard.writeText(exportStr);
        e.target.innerHTML = "copied!";
    } catch (error) {
        console.error(error.message);
        e.target.innerHTML = "uh oh, something broke :/";
    }
}

function handleBeforeUnload(e) {
    if (history.length != 0) {
        e.preventDefault();
    }
}

function setup() {
    const toolPalette = document.getElementById("tool-palette");
    const toolButtons = toolPalette.getElementsByTagName("button");

    for (var toolButton of toolButtons) {
        const brushIdStr = toolButton.getAttribute("data-brush");
        const actionIdStr = toolButton.getAttribute("data-action");
        const tileIconStr = toolButton.getAttribute("data-tile-icon");

        if (brushIdStr) {
            toolButton.addEventListener("click",(e)=>onBrushClick(brushIdStr));
        }

        if (actionIdStr == "undo") {
            toolButton.addEventListener("click",(e)=>performUndo());
        }
        if (actionIdStr == "redo") {
            toolButton.addEventListener("click",(e)=>performRedo());
        }
        if (actionIdStr == "export") {
            toolButton.addEventListener("click",(e)=>performExport(e));
        }

        if (tileIconStr) {
            const tileIcon = parseInt(tileIconStr,16);
            const buttonCanvas = document.createElement("canvas");
            const buttonCtx = buttonCanvas.getContext("2d");
            const margin = 3;
            buttonCanvas['width'] = TILE_SIZE_PX * ((8+margin) / 8);
            buttonCanvas['height'] = TILE_SIZE_PX * ((8+margin) / 8);
            //renderBackdrop(buttonCtx);
            renderTile(buttonCtx, tileIcon, (margin/16), (margin/16));
            toolButton.appendChild(buttonCanvas);
        }
    }

    // prevent page scroll while dragging over the canvas
    mainCanvas.addEventListener("touchstart", e=>e.preventDefault(), {passive:false});
    mainCanvas.addEventListener("touchmove", e=>e.preventDefault(), {passive:false});

    // main drawing handling
    mainCanvas.addEventListener("pointerdown", (e)=>editBegin(e));
    mainCanvas.addEventListener("pointermove", (e)=>editMove(e));
    mainCanvas.addEventListener("pointercancel", (e)=>editEnd(e));
    mainCanvas.addEventListener("pointerup", (e)=>editEnd(e));

    // catch that "fun" case where someone releases the mouse outside the canvas
    window.addEventListener("pointerup", (e)=>editEnd(e));

    // "are you sure you want to leave?"
    // doesn't work on iOS because apple...
    window.addEventListener("beforeunload", handleBeforeUnload);

    redrawButtons();
    redrawBoard();
}

setup();
