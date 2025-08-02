let canvas = document.getElementById("drawingCanvas");
let ctx = canvas.getContext("2d");
function resizeCanvas() {
	const headerHeight = document.querySelector(".app-header").offsetHeight;
	const footerHeight = document.querySelector(".app-footer").offsetHeight;
	const leftToolbarWidth =
		document.querySelector(".left-toolbar").offsetWidth;
	const rightToolbarWidth =
		document.querySelector(".right-toolbar").offsetWidth;
	const containerPadding = 40;

	canvas.width =
		window.innerWidth -
		leftToolbarWidth -
		rightToolbarWidth -
		containerPadding;
	canvas.height =
		window.innerHeight - headerHeight - footerHeight - containerPadding;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

let drawing = false;
let mode = "freehand";
let startX, startY;
let color = "#000000";
let shapes = [];
let selectedShapes = [];
let dragging = false;
let polygonVertices = [];
let polygonDrawing = false;
let clipboard = null;
let groupCounter = 1;

let undoStack = [];
let redoStack = [];

document.getElementById("colorPicker").addEventListener("input", (e) => {
	color = e.target.value;
	document.getElementById("currentColor").textContent = color;
});

function setMode(newMode) {
	mode = newMode;
	document.getElementById("currentMode").textContent =
		mode.charAt(0).toUpperCase() + mode.slice(1);
	document
		.querySelectorAll(".tool-btn")
		.forEach((btn) => btn.classList.remove("active"));
	document.getElementById(`btn-${mode}`).classList.add("active");

	if (newMode !== "polygon") {
		polygonVertices = [];
		polygonDrawing = false;
	}
	if (newMode !== "select") {
		selectedShapes = [];
	}
	redrawShapes();
	updateObjectCount();
}

function stopDrawingPolygon() {
	if (polygonDrawing && polygonVertices.length > 1) {
		savePolygon();
		polygonDrawing = false;
		polygonVertices = [];
	}
}

canvas.addEventListener("mousedown", (e) => {
	startX = e.offsetX;
	startY = e.offsetY;
	ctx.strokeStyle = color;

	if (mode === "select") {
		let shape = selectObject(startX, startY);
		if (shape) {
			if (!selectedShapes.includes(shape)) {
				selectedShapes.push(shape);
			}
			dragging = true;
		} else {
			selectedShapes = [];
		}
	} else if (mode === "polygon") {
		if (!polygonDrawing) {
			polygonDrawing = true;
			polygonVertices = [[startX, startY]];
		} else {
			polygonVertices.push([startX, startY]);
		}
	} else {
		drawing = true;
		if (mode === "freehand") {
			ctx.beginPath();
			ctx.moveTo(startX, startY);
		}
	}
	redrawShapes();
});

canvas.addEventListener("mousemove", (e) => {
	if (!drawing && !dragging && mode !== "polygon") return;

	let currentX = e.offsetX;
	let currentY = e.offsetY;

	if (dragging && selectedShapes.length > 0) {
		moveObjects(currentX - startX, currentY - startY);
		startX = currentX;
		startY = currentY;
	} else if (drawing) {
		switch (mode) {
			case "freehand":
				ctx.lineTo(currentX, currentY);
				ctx.stroke();
				break;
			case "line":
				redrawShapes();
				ctx.beginPath();
				ctx.moveTo(startX, startY);
				ctx.lineTo(currentX, currentY);
				ctx.stroke();
				ctx.closePath();
				break;
			case "rectangle":
				redrawShapes();
				ctx.beginPath();
				ctx.rect(startX, startY, currentX - startX, currentY - startY);
				ctx.stroke();
				ctx.closePath();
				break;
			case "square":
				redrawShapes();
				ctx.beginPath();
				const side = Math.min(
					Math.abs(currentX - startX),
					Math.abs(currentY - startY)
				);
				ctx.rect(
					startX,
					startY,
					Math.sign(currentX - startX) * side,
					Math.sign(currentY - startY) * side
				);
				ctx.stroke();
				ctx.closePath();
				break;
			case "ellipse":
				redrawShapes();
				ctx.beginPath();
				ctx.ellipse(
					startX,
					startY,
					Math.abs(currentX - startX),
					Math.abs(currentY - startY),
					0,
					0,
					Math.PI * 2
				);
				ctx.stroke();
				ctx.closePath();
				break;
			case "circle":
				redrawShapes();
				ctx.beginPath();
				const radius = Math.min(
					Math.abs(currentX - startX),
					Math.abs(currentY - startY)
				);
				ctx.ellipse(startX, startY, radius, radius, 0, 0, Math.PI * 2);
				ctx.stroke();
				ctx.closePath();
				break;
		}
	} else if (mode === "polygon" && polygonDrawing) {
		redrawShapes();
		drawPolygon([...polygonVertices, [currentX, currentY]]);
	}
});

canvas.addEventListener("mouseup", (e) => {
	drawing = false;
	dragging = false;
	if (mode === "freehand") {
		shapes.push({
			type: "freehand",
			path: ctx.getImageData(0, 0, canvas.width, canvas.height),
			color: color,
		});
		ctx.beginPath();
		saveState();
	} else if (mode !== "select" && mode !== "polygon") {
		saveShape(e.offsetX, e.offsetY);
	}
	ctx.closePath();
});

canvas.addEventListener("dblclick", () => {
	stopDrawingPolygon();
});

function drawShape(drawFunc) {
	redrawShapes();
	ctx.beginPath();
	drawFunc();
	ctx.stroke();
	ctx.closePath();
}

function drawPolygon(vertices) {
	if (vertices.length > 1) {
		ctx.beginPath();
		ctx.moveTo(vertices[0][0], vertices[0][1]);
		for (let i = 1; i < vertices.length; i++) {
			ctx.lineTo(vertices[i][0], vertices[i][1]);
		}
		ctx.stroke();
		ctx.closePath();
	}
}

function saveShape(endX, endY) {
	shapes.push({
		type: mode,
		startX: startX,
		startY: startY,
		endX: endX,
		endY: endY,
		color: color,
	});
	saveState();
	redrawShapes();
}

function savePolygon() {
	if (polygonVertices.length > 1) {
		shapes.push({
			type: "polygon",
			vertices: polygonVertices,
			color: color,
		});
		saveState();
	}
	redrawShapes();
}

function redrawShapes() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	shapes.forEach((shape) => {
		ctx.strokeStyle = shape.color;
		ctx.beginPath();
		switch (shape.type) {
			case "freehand":
				if (shape.path instanceof ImageData) {
					ctx.putImageData(shape.path, 0, 0);
				}
				break;
			case "line":
				ctx.moveTo(shape.startX, shape.startY);
				ctx.lineTo(shape.endX, shape.endY);
				break;
			case "rectangle":
				ctx.rect(
					shape.startX,
					shape.startY,
					shape.endX - shape.startX,
					shape.endY - shape.startY
				);
				break;
			case "square":
				const squareSide = Math.min(
					Math.abs(shape.endX - shape.startX),
					Math.abs(shape.endY - shape.startY)
				);
				ctx.rect(
					shape.startX,
					shape.startY,
					Math.sign(shape.endX - shape.startX) * squareSide,
					Math.sign(shape.endY - shape.startY) * squareSide
				);
				break;
			case "ellipse":
				ctx.ellipse(
					shape.startX,
					shape.startY,
					Math.abs(shape.endX - shape.startX),
					Math.abs(shape.endY - shape.startY),
					0,
					0,
					Math.PI * 2
				);
				break;
			case "circle":
				const circleRadius = Math.min(
					Math.abs(shape.endX - shape.startX),
					Math.abs(shape.endY - shape.startY)
				);
				ctx.ellipse(
					shape.startX,
					shape.startY,
					circleRadius,
					circleRadius,
					0,
					0,
					Math.PI * 2
				);
				break;
			case "polygon":
				drawPolygon(shape.vertices);
				break;
		}
		if (selectedShapes.includes(shape)) {
			ctx.strokeStyle = "red";
			ctx.lineWidth = 2;
		}
		ctx.stroke();
		ctx.lineWidth = 1;
		ctx.closePath();
	});

	updateObjectCount();
}

function selectObject(x, y) {
	return shapes.find((shape) => {
		switch (shape.type) {
			case "line":
				return isPointOnLine(
					shape.startX,
					shape.startY,
					shape.endX,
					shape.endY,
					x,
					y
				);
			case "rectangle":
				return (
					x >= shape.startX &&
					x <= shape.endX &&
					y >= shape.startY &&
					y <= shape.endY
				);
			case "square":
				const squareSide = Math.min(
					Math.abs(shape.endX - shape.startX),
					Math.abs(shape.endY - shape.startY)
				);
				const squareXEnd =
					shape.startX +
					Math.sign(shape.endX - shape.startX) * squareSide;
				const squareYEnd =
					shape.startY +
					Math.sign(shape.endY - shape.startY) * squareSide;
				return (
					x >= shape.startX &&
					x <= squareXEnd &&
					y >= shape.startY &&
					y <= squareYEnd
				);
			case "ellipse":
				return isPointInEllipse(
					shape.startX,
					shape.startY,
					Math.abs(shape.endX - shape.startX),
					Math.abs(shape.endY - shape.startY),
					x,
					y
				);
			case "circle":
				const circleRadius = Math.min(
					Math.abs(shape.endX - shape.startX),
					Math.abs(shape.endY - shape.startY)
				);
				return isPointInEllipse(
					shape.startX,
					shape.startY,
					circleRadius,
					circleRadius,
					x,
					y
				);
			case "polygon":
				return isPointInPolygon(shape.vertices, x, y);
			case "freehand":
				return false;
		}
	});
}

function isPointOnLine(x1, y1, x2, y2, px, py) {
	const tolerance = 5;
	const distToLine =
		Math.abs((y2 - y1) * px - (x2 - x1) * py + x2 * y1 - y2 * x1) /
		Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2));
	return distToLine <= tolerance;
}

function isPointInEllipse(cx, cy, rx, ry, px, py) {
	return (
		Math.pow(px - cx, 2) / Math.pow(rx, 2) +
			Math.pow(py - cy, 2) / Math.pow(ry, 2) <=
		1
	);
}

function isPointInPolygon(vertices, px, py) {
	let inside = false;
	for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
		const xi = vertices[i][0],
			yi = vertices[i][1];
		const xj = vertices[j][0],
			yj = vertices[j][1];

		const intersect =
			yi > py !== yj > py &&
			px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
		if (intersect) inside = !inside;
	}
	return inside;
}

function moveObjects(dx, dy) {
	selectedShapes.forEach((shape) => {
		if (shape.type === "polygon") {
			shape.vertices = shape.vertices.map(([vx, vy]) => [
				vx + dx,
				vy + dy,
			]);
		} else {
			shape.startX += dx;
			shape.startY += dy;
			shape.endX += dx;
			shape.endY += dy;
		}
	});
	saveState();
	redrawShapes();
}

function cutObject() {
	if (selectedShapes.length > 0) {
		shapes = shapes.filter((shape) => !selectedShapes.includes(shape));
		selectedShapes = [];
		saveState();
		redrawShapes();
	}
}

function copyObject() {
	if (selectedShapes.length > 0) {
		clipboard = selectedShapes.map((shape) => ({ ...shape }));
	}
}

function pasteObject() {
	if (clipboard && clipboard.length > 0) {
		const offset = 10;
		clipboard.forEach((shape) => {
			const newShape = { ...shape };
			if (newShape.type === "polygon") {
				newShape.vertices = newShape.vertices.map(([vx, vy]) => [
					vx + offset,
					vy + offset,
				]);
			} else {
				newShape.startX += offset;
				newShape.startY += offset;
				newShape.endX += offset;
				newShape.endY += offset;
			}
			shapes.push(newShape);
		});
		saveState();
		redrawShapes();
	}
}

function groupObjects() {
	if (selectedShapes.length > 0) {
		const groupId = groupCounter++;
		selectedShapes.forEach((shape) => (shape.group = groupId));
		selectedShapes = [];
		saveState();
		redrawShapes();
	}
}

function ungroupObjects() {
	shapes.forEach((shape) => delete shape.group);
	selectedShapes = [];
	saveState();
	redrawShapes();
}

function undo() {
	if (undoStack.length > 0) {
		redoStack.push(JSON.stringify(shapes));
		shapes = JSON.parse(undoStack.pop());
		redrawShapes();
	}
}

function redo() {
	if (redoStack.length > 0) {
		undoStack.push(JSON.stringify(shapes));
		shapes = JSON.parse(redoStack.pop());
		redrawShapes();
	}
}

function saveState() {
	undoStack.push(JSON.stringify(shapes));
	redoStack = [];
}

function updateObjectCount() {
	const objectCountElement = document.getElementById("objectCount");
	if (objectCountElement) {
		objectCountElement.textContent = shapes.length;
	}
}

function saveDrawing() {
	const drawingData = shapes.map((shape) => {
		if (shape.type === "freehand") {
			return {
				...shape,
				path: Array.from(shape.path.data),
			};
		}
		return shape;
	});
	localStorage.setItem("drawing", JSON.stringify(drawingData));

	// Show success message
	showNotification("Drawing saved successfully!", "success");
}

function loadDrawing() {
	const drawingData = localStorage.getItem("drawing");
	if (drawingData) {
		shapes = JSON.parse(drawingData).map((shape) => {
			if (shape.type === "freehand") {
				const imageData = new ImageData(
					new Uint8ClampedArray(shape.path),
					canvas.width,
					canvas.height
				);
				return { ...shape, path: imageData };
			}
			return shape;
		});
		redrawShapes();
		updateObjectCount();
		showNotification("Drawing loaded successfully!", "success");
	} else {
		showNotification("No saved drawing found.", "info");
	}
}

// Notification system
function showNotification(message, type = "info") {
	// Remove existing notifications
	const existingNotifications = document.querySelectorAll(".notification");
	existingNotifications.forEach((notification) => notification.remove());

	// Create notification element
	const notification = document.createElement("div");
	notification.className = `notification notification-${type}`;
	notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-message">${message}</span>
      <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;

	// Add to page
	document.body.appendChild(notification);

	// Auto-remove after 3 seconds
	setTimeout(() => {
		if (notification.parentElement) {
			notification.remove();
		}
	}, 3000);
}

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
	updateObjectCount();
	showNotification(
		"Welcome to Professional Sketchpad! Start drawing to create your masterpiece.",
		"info"
	);
});

document.addEventListener("keydown", (e) => {
	if (e.ctrlKey && e.key === "x") {
		cutObject();
	}
	if (e.ctrlKey && e.key === "c") {
		copyObject();
	}
	if (e.ctrlKey && e.key === "v") {
		pasteObject();
	}
	if (e.ctrlKey && e.key === "z") {
		undo();
	}
	if (e.ctrlKey && e.key === "y") {
		redo();
	}
});
