// Professional Sketchpad - Improved JavaScript Implementation
class SketchpadApp {
	constructor() {
		this.canvas = document.getElementById("drawingCanvas");
		this.ctx = this.canvas.getContext("2d");

		// Application state
		this.state = {
			drawing: false,
			mode: "freehand",
			color: "#000000",
			shapes: [],
			selectedShapes: [],
			dragging: false,
			polygonVertices: [],
			polygonDrawing: false,
			clipboard: null,
			groupCounter: 1,
		};

		// History management
		this.history = {
			undoStack: [],
			redoStack: [],
			maxHistorySize: 50,
		};

		// Performance optimization
		this.lastRedrawTime = 0;
		this.redrawThrottle = 16; // ~60fps

		this.initialize();
	}

	initialize() {
		this.setupCanvas();
		this.setupEventListeners();
		this.setupKeyboardShortcuts();
		this.updateObjectCount();
		this.showNotification(
			"Welcome to Professional Sketchpad! Start drawing to create your masterpiece.",
			"info"
		);
	}

	setupCanvas() {
		this.resizeCanvas();
		window.addEventListener("resize", () => this.resizeCanvas());
	}

	resizeCanvas() {
		const headerHeight =
			document.querySelector(".app-header")?.offsetHeight || 0;
		const footerHeight =
			document.querySelector(".app-footer")?.offsetHeight || 0;
		const leftToolbarWidth =
			document.querySelector(".left-toolbar")?.offsetWidth || 0;
		const rightToolbarWidth =
			document.querySelector(".right-toolbar")?.offsetWidth || 0;
		const containerPadding = 40;

		this.canvas.width =
			window.innerWidth -
			leftToolbarWidth -
			rightToolbarWidth -
			containerPadding;
		this.canvas.height =
			window.innerHeight - headerHeight - footerHeight - containerPadding;

		// Redraw after resize
		this.redrawShapes();
	}

	setupEventListeners() {
		// Color picker
		document
			.getElementById("colorPicker")
			?.addEventListener("input", (e) => {
				this.state.color = e.target.value;
				document.getElementById("currentColor").textContent =
					this.state.color;
			});

		// Canvas events
		this.canvas.addEventListener("mousedown", (e) =>
			this.handleMouseDown(e)
		);
		this.canvas.addEventListener("mousemove", (e) =>
			this.handleMouseMove(e)
		);
		this.canvas.addEventListener("mouseup", (e) => this.handleMouseUp(e));
		this.canvas.addEventListener("dblclick", () =>
			this.stopDrawingPolygon()
		);

		// Prevent context menu on canvas
		this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
	}

	setupKeyboardShortcuts() {
		document.addEventListener("keydown", (e) => {
			if (e.ctrlKey || e.metaKey) {
				switch (e.key.toLowerCase()) {
					case "x":
						e.preventDefault();
						this.cutObject();
						break;
					case "c":
						e.preventDefault();
						this.copyObject();
						break;
					case "v":
						e.preventDefault();
						this.pasteObject();
						break;
					case "z":
						e.preventDefault();
						this.undo();
						break;
					case "y":
						e.preventDefault();
						this.redo();
						break;
				}
			}
		});
	}

	setMode(newMode) {
		this.state.mode = newMode;

		// Update UI
		const modeDisplay = document.getElementById("currentMode");
		if (modeDisplay) {
			modeDisplay.textContent =
				newMode.charAt(0).toUpperCase() + newMode.slice(1);
		}

		// Update active button
		document
			.querySelectorAll(".tool-btn")
			.forEach((btn) => btn.classList.remove("active"));
		const activeBtn = document.getElementById(`btn-${newMode}`);
		if (activeBtn) activeBtn.classList.add("active");

		// Reset state based on mode
		if (newMode !== "polygon") {
			this.state.polygonVertices = [];
			this.state.polygonDrawing = false;
		}
		if (newMode !== "select") {
			this.state.selectedShapes = [];
		}

		this.redrawShapes();
		this.updateObjectCount();
	}

	handleMouseDown(e) {
		const rect = this.canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		this.state.startX = x;
		this.state.startY = y;
		this.ctx.strokeStyle = this.state.color;

		switch (this.state.mode) {
			case "select":
				this.handleSelectMouseDown(x, y);
				break;
			case "polygon":
				this.handlePolygonMouseDown(x, y);
				break;
			default:
				this.handleDrawingMouseDown(x, y);
		}

		this.redrawShapes();
	}

	handleSelectMouseDown(x, y) {
		const shape = this.selectObject(x, y);
		if (shape) {
			if (!this.state.selectedShapes.includes(shape)) {
				this.state.selectedShapes.push(shape);
			}
			this.state.dragging = true;
		} else {
			this.state.selectedShapes = [];
		}
	}

	handlePolygonMouseDown(x, y) {
		if (!this.state.polygonDrawing) {
			this.state.polygonDrawing = true;
			this.state.polygonVertices = [[x, y]];
		} else {
			this.state.polygonVertices.push([x, y]);
		}
	}

	handleDrawingMouseDown(x, y) {
		this.state.drawing = true;
		if (this.state.mode === "freehand") {
			this.ctx.beginPath();
			this.ctx.moveTo(x, y);
		}
	}

	handleMouseMove(e) {
		if (
			!this.state.drawing &&
			!this.state.dragging &&
			this.state.mode !== "polygon"
		)
			return;

		const rect = this.canvas.getBoundingClientRect();
		const currentX = e.clientX - rect.left;
		const currentY = e.clientY - rect.top;

		if (this.state.dragging && this.state.selectedShapes.length > 0) {
			this.moveObjects(
				currentX - this.state.startX,
				currentY - this.state.startY
			);
			this.state.startX = currentX;
			this.state.startY = currentY;
		} else if (this.state.drawing) {
			this.handleDrawingMouseMove(currentX, currentY);
		} else if (this.state.mode === "polygon" && this.state.polygonDrawing) {
			this.redrawShapes();
			this.drawPolygon([
				...this.state.polygonVertices,
				[currentX, currentY],
			]);
		}
	}

	handleDrawingMouseMove(currentX, currentY) {
		this.redrawShapes();
		this.ctx.beginPath();

		switch (this.state.mode) {
			case "freehand":
				this.ctx.lineTo(currentX, currentY);
				this.ctx.stroke();
				break;
			case "line":
				this.ctx.moveTo(this.state.startX, this.state.startY);
				this.ctx.lineTo(currentX, currentY);
				this.ctx.stroke();
				break;
			case "rectangle":
				this.ctx.rect(
					this.state.startX,
					this.state.startY,
					currentX - this.state.startX,
					currentY - this.state.startY
				);
				this.ctx.stroke();
				break;
			case "square":
				const side = Math.min(
					Math.abs(currentX - this.state.startX),
					Math.abs(currentY - this.state.startY)
				);
				this.ctx.rect(
					this.state.startX,
					this.state.startY,
					Math.sign(currentX - this.state.startX) * side,
					Math.sign(currentY - this.state.startY) * side
				);
				this.ctx.stroke();
				break;
			case "ellipse":
				this.ctx.ellipse(
					this.state.startX,
					this.state.startY,
					Math.abs(currentX - this.state.startX),
					Math.abs(currentY - this.state.startY),
					0,
					0,
					Math.PI * 2
				);
				this.ctx.stroke();
				break;
			case "circle":
				const radius = Math.min(
					Math.abs(currentX - this.state.startX),
					Math.abs(currentY - this.state.startY)
				);
				this.ctx.ellipse(
					this.state.startX,
					this.state.startY,
					radius,
					radius,
					0,
					0,
					Math.PI * 2
				);
				this.ctx.stroke();
				break;
		}

		this.ctx.closePath();
	}

	handleMouseUp(e) {
		this.state.drawing = false;
		this.state.dragging = false;

		if (this.state.mode === "freehand") {
			this.saveFreehandShape();
		} else if (
			this.state.mode !== "select" &&
			this.state.mode !== "polygon"
		) {
			const rect = this.canvas.getBoundingClientRect();
			const endX = e.clientX - rect.left;
			const endY = e.clientY - rect.top;
			this.saveShape(endX, endY);
		}

		this.ctx.closePath();
	}

	saveFreehandShape() {
		try {
			const imageData = this.ctx.getImageData(
				0,
				0,
				this.canvas.width,
				this.canvas.height
			);
			this.state.shapes.push({
				type: "freehand",
				path: imageData,
				color: this.state.color,
				timestamp: Date.now(),
			});
			this.saveState();
		} catch (error) {
			console.error("Error saving freehand shape:", error);
			this.showNotification("Error saving freehand shape", "error");
		}
	}

	saveShape(endX, endY) {
		this.state.shapes.push({
			type: this.state.mode,
			startX: this.state.startX,
			startY: this.state.startY,
			endX: endX,
			endY: endY,
			color: this.state.color,
			timestamp: Date.now(),
		});
		this.saveState();
		this.redrawShapes();
	}

	stopDrawingPolygon() {
		if (
			this.state.polygonDrawing &&
			this.state.polygonVertices.length > 1
		) {
			this.savePolygon();
			this.state.polygonDrawing = false;
			this.state.polygonVertices = [];
		}
	}

	savePolygon() {
		if (this.state.polygonVertices.length > 1) {
			this.state.shapes.push({
				type: "polygon",
				vertices: [...this.state.polygonVertices],
				color: this.state.color,
				timestamp: Date.now(),
			});
			this.saveState();
		}
		this.redrawShapes();
	}

	redrawShapes() {
		const now = performance.now();
		if (now - this.lastRedrawTime < this.redrawThrottle) {
			return;
		}
		this.lastRedrawTime = now;

		// Clear canvas
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		// Draw all shapes
		this.state.shapes.forEach((shape) => {
			this.drawShape(shape);
		});

		this.updateObjectCount();
	}

	drawShape(shape) {
		this.ctx.strokeStyle = shape.color;
		this.ctx.lineWidth = this.state.selectedShapes.includes(shape) ? 2 : 1;

		this.ctx.beginPath();

		switch (shape.type) {
			case "freehand":
				if (shape.path instanceof ImageData) {
					this.ctx.putImageData(shape.path, 0, 0);
				}
				break;
			case "line":
				this.ctx.moveTo(shape.startX, shape.startY);
				this.ctx.lineTo(shape.endX, shape.endY);
				break;
			case "rectangle":
				this.ctx.rect(
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
				this.ctx.rect(
					shape.startX,
					shape.startY,
					Math.sign(shape.endX - shape.startX) * squareSide,
					Math.sign(shape.endY - shape.startY) * squareSide
				);
				break;
			case "ellipse":
				this.ctx.ellipse(
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
				this.ctx.ellipse(
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
				this.drawPolygon(shape.vertices);
				break;
		}

		this.ctx.stroke();
		this.ctx.lineWidth = 1;
		this.ctx.closePath();
	}

	drawPolygon(vertices) {
		if (vertices.length > 1) {
			this.ctx.moveTo(vertices[0][0], vertices[0][1]);
			for (let i = 1; i < vertices.length; i++) {
				this.ctx.lineTo(vertices[i][0], vertices[i][1]);
			}
		}
	}

	selectObject(x, y) {
		return this.state.shapes.find((shape) => {
			switch (shape.type) {
				case "line":
					return this.isPointOnLine(
						shape.startX,
						shape.startY,
						shape.endX,
						shape.endY,
						x,
						y
					);
				case "rectangle":
					return this.isPointInRectangle(
						shape.startX,
						shape.startY,
						shape.endX,
						shape.endY,
						x,
						y
					);
				case "square":
					return this.isPointInSquare(shape, x, y);
				case "ellipse":
					return this.isPointInEllipse(
						shape.startX,
						shape.startY,
						Math.abs(shape.endX - shape.startX),
						Math.abs(shape.endY - shape.startY),
						x,
						y
					);
				case "circle":
					const radius = Math.min(
						Math.abs(shape.endX - shape.startX),
						Math.abs(shape.endY - shape.startY)
					);
					return this.isPointInEllipse(
						shape.startX,
						shape.startY,
						radius,
						radius,
						x,
						y
					);
				case "polygon":
					return this.isPointInPolygon(shape.vertices, x, y);
				case "freehand":
					return false; // Freehand shapes are not selectable
				default:
					return false;
			}
		});
	}

	isPointOnLine(x1, y1, x2, y2, px, py) {
		const tolerance = 5;
		const distToLine =
			Math.abs((y2 - y1) * px - (x2 - x1) * py + x2 * y1 - y2 * x1) /
			Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2));
		return distToLine <= tolerance;
	}

	isPointInRectangle(x1, y1, x2, y2, px, py) {
		const minX = Math.min(x1, x2);
		const maxX = Math.max(x1, x2);
		const minY = Math.min(y1, y2);
		const maxY = Math.max(y1, y2);
		return px >= minX && px <= maxX && py >= minY && py <= maxY;
	}

	isPointInSquare(shape, x, y) {
		const side = Math.min(
			Math.abs(shape.endX - shape.startX),
			Math.abs(shape.endY - shape.startY)
		);
		const endX = shape.startX + Math.sign(shape.endX - shape.startX) * side;
		const endY = shape.startY + Math.sign(shape.endY - shape.startY) * side;
		return this.isPointInRectangle(
			shape.startX,
			shape.startY,
			endX,
			endY,
			x,
			y
		);
	}

	isPointInEllipse(cx, cy, rx, ry, px, py) {
		return (
			Math.pow(px - cx, 2) / Math.pow(rx, 2) +
				Math.pow(py - cy, 2) / Math.pow(ry, 2) <=
			1
		);
	}

	isPointInPolygon(vertices, px, py) {
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

	moveObjects(dx, dy) {
		this.state.selectedShapes.forEach((shape) => {
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
		this.saveState();
		this.redrawShapes();
	}

	cutObject() {
		if (this.state.selectedShapes.length > 0) {
			this.state.clipboard = this.state.selectedShapes.map((shape) => ({
				...shape,
			}));
			this.state.shapes = this.state.shapes.filter(
				(shape) => !this.state.selectedShapes.includes(shape)
			);
			this.state.selectedShapes = [];
			this.saveState();
			this.redrawShapes();
			this.showNotification("Objects cut to clipboard", "success");
		}
	}

	copyObject() {
		if (this.state.selectedShapes.length > 0) {
			this.state.clipboard = this.state.selectedShapes.map((shape) => ({
				...shape,
			}));
			this.showNotification("Objects copied to clipboard", "success");
		}
	}

	pasteObject() {
		if (this.state.clipboard && this.state.clipboard.length > 0) {
			const offset = 10;
			this.state.clipboard.forEach((shape) => {
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
				this.state.shapes.push(newShape);
			});
			this.saveState();
			this.redrawShapes();
			this.showNotification("Objects pasted", "success");
		}
	}

	groupObjects() {
		if (this.state.selectedShapes.length > 0) {
			const groupId = this.state.groupCounter++;
			this.state.selectedShapes.forEach(
				(shape) => (shape.group = groupId)
			);
			this.state.selectedShapes = [];
			this.saveState();
			this.redrawShapes();
			this.showNotification("Objects grouped", "success");
		}
	}

	ungroupObjects() {
		this.state.shapes.forEach((shape) => delete shape.group);
		this.state.selectedShapes = [];
		this.saveState();
		this.redrawShapes();
		this.showNotification("Objects ungrouped", "success");
	}

	undo() {
		if (this.history.undoStack.length > 0) {
			this.history.redoStack.push(JSON.stringify(this.state.shapes));
			this.state.shapes = JSON.parse(this.history.undoStack.pop());
			this.redrawShapes();
			this.showNotification("Undo completed", "info");
		}
	}

	redo() {
		if (this.history.redoStack.length > 0) {
			this.history.undoStack.push(JSON.stringify(this.state.shapes));
			this.state.shapes = JSON.parse(this.history.redoStack.pop());
			this.redrawShapes();
			this.showNotification("Redo completed", "info");
		}
	}

	saveState() {
		this.history.undoStack.push(JSON.stringify(this.state.shapes));
		this.history.redoStack = [];

		// Limit history size
		if (this.history.undoStack.length > this.history.maxHistorySize) {
			this.history.undoStack.shift();
		}
	}

	updateObjectCount() {
		const objectCountElement = document.getElementById("objectCount");
		if (objectCountElement) {
			objectCountElement.textContent = this.state.shapes.length;
		}
	}

	saveDrawing() {
		try {
			const drawingData = this.state.shapes.map((shape) => {
				if (shape.type === "freehand") {
					return {
						...shape,
						path: Array.from(shape.path.data),
					};
				}
				return shape;
			});

			localStorage.setItem("drawing", JSON.stringify(drawingData));
			this.showNotification("Drawing saved successfully!", "success");
		} catch (error) {
			console.error("Error saving drawing:", error);
			this.showNotification("Error saving drawing", "error");
		}
	}

	loadDrawing() {
		try {
			const drawingData = localStorage.getItem("drawing");
			if (drawingData) {
				this.state.shapes = JSON.parse(drawingData).map((shape) => {
					if (shape.type === "freehand") {
						const imageData = new ImageData(
							new Uint8ClampedArray(shape.path),
							this.canvas.width,
							this.canvas.height
						);
						return { ...shape, path: imageData };
					}
					return shape;
				});
				this.redrawShapes();
				this.updateObjectCount();
				this.showNotification(
					"Drawing loaded successfully!",
					"success"
				);
			} else {
				this.showNotification("No saved drawing found.", "info");
			}
		} catch (error) {
			console.error("Error loading drawing:", error);
			this.showNotification("Error loading drawing", "error");
		}
	}

	showNotification(message, type = "info") {
		// Remove existing notifications
		const existingNotifications =
			document.querySelectorAll(".notification");
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
}

// Global functions for HTML onclick handlers
let sketchpadApp;

function setMode(mode) {
	sketchpadApp?.setMode(mode);
}

function stopDrawingPolygon() {
	sketchpadApp?.stopDrawingPolygon();
}

function cutObject() {
	sketchpadApp?.cutObject();
}

function copyObject() {
	sketchpadApp?.copyObject();
}

function pasteObject() {
	sketchpadApp?.pasteObject();
}

function groupObjects() {
	sketchpadApp?.groupObjects();
}

function ungroupObjects() {
	sketchpadApp?.ungroupObjects();
}

function undo() {
	sketchpadApp?.undo();
}

function redo() {
	sketchpadApp?.redo();
}

function saveDrawing() {
	sketchpadApp?.saveDrawing();
}

function loadDrawing() {
	sketchpadApp?.loadDrawing();
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
	sketchpadApp = new SketchpadApp();
});
