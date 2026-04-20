# Marklet

**Marklet** is a professional-grade web annotation tool designed for research, documentation, and persistent knowledge management. It enables users to highlight text, create freehand drawings, and add annotations to any web page using a high-fidelity interface isolated within the Shadow DOM.

Designed with a focus on **privacy**, **performance**, and **stability**, Marklet operates entirely within your local browser environment with zero external dependencies.

---

## Key Features

### Precision Highlighting
*   **Robust Persistence**: Utilizes advanced DOM traversal and coordinate mapping to ensure highlights persist across page reloads and dynamic content updates.
*   **Deep Linking**: Generate robust `#:~:text=` Scroll-to-Text fragments. These links are context-aware (using prefix/suffix) and support long selections (`textStart,textEnd`), ensuring you always land on the exact spot.
*   **Self-Healing Logic**: Automatically recovers and adjusts highlights when underlying page content shifts or updates.
*   **Conflict Resolution**: Intelligently manages overlapping and nested highlights with a smart merging strategy.
*   **Edit Toolbar**: Hover over any highlight to change colors, copy a direct link, or delete it.

### Infinite Whiteboard
*   **Dual-Layer Rendering**:
    *   **Active Mode**: A `fixed` HTML5 Canvas layer provides a lag-free drawing experience optimized for high-performance sketching.
    *   **Static Mode**: Automatically converts drawings to an `absolute` positioned SVG layer that scrolls naturally with the page content.
*   **Smart Shapes**: Draw freehand or use dedicated tools for **Rectangles**, **Circles**, **Arrows**, and **Text**.
*   **Text Annotations**: Seamlessly add text that perfectly matches the site's typography (font-family, weight, and smoothing).
*   **Vector Fidelity**: High-quality paths with adjustable thickness, colors, and blend modes.
*   **Undo/Redo**: Full history support for all whiteboard interactions.

### Modernized Dashboard
*   **Annotation Management**: A sleek, card-based settings dashboard to browse, search, and filter all your saved annotations.
*   **Quick Actions**: Manage snippets directly from the dashboard—**Go to Highlight**, **Copy Text**, or **Delete** with a single click.
*   **Visual Summaries**: Each page card shows a breakdown of highlights and the number of drawings present.
*   **Customization**: Easily manage global settings, hotkeys, and color presets.

### Engineered for Performance
*   **Layout-Aware Caching**: Uses a `WeakMap` display cache to minimize layout-triggering `getComputedStyle` calls, preventing "font decoding" errors and lag on complex sites.
*   **Adaptive Scheduling**: Implements a sophisticated scheduler with trailing debounce and throttling to minimize main-thread impact.
*   **Zero-Overhead Idle**: Automatically suspends DOM observation when no annotations are present.
*   **Shadow DOM Isolation**: UI components are fully encapsulated, preventing style leaks or conflicts with the host page.

### Privacy & Security
*   **100% Local**: All data is stored locally within the browser using IndexedDB and `chrome.storage`. No data ever leaves your machine.
*   **CSP Compliant**: Fully compatible with strict Content Security Policy (CSP) environments; no inline scripts or unsafe evals.

---

## Usage & Hotkeys

| Action | Shortcut |
| :--- | :--- |
| **Highlight Selection** | `Alt + H` |
| **Toggle Whiteboard** | `Alt + Shift + W` |
| **Toggle Drawings Visibility** | `Alt + Shift + D` |
| **Toggle Highlights Visibility** | `Alt + Shift + H` |
| **Undo Interaction** | `Ctrl + Z` / `Cmd + Z` |
| **Redo Interaction** | `Ctrl + Y` / `Cmd + Y` / `Cmd + Shift + Z` |
| **Delete Selected Stroke** | `Delete` / `Backspace` |
| **Move Selected Stroke** | `Arrow Keys` ( + `Shift` for 10px) |

---

## Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/Jelodar/marklet.git
    ```
2.  **Load the Extension**:
    *   Navigate to `chrome://extensions` in a Chromium browser (Chrome, Edge, Brave).
    *   Enable **"Developer mode"** (top right).
    *   Click **"Load unpacked"** and select the `marklet` directory.

---

## Development & Architecture

Marklet is built with modern **Vanilla JavaScript (ES6+)** and follows a modular, zero-dependency architecture.

### Core Modules
- **`marklet.js`**: Central controller and extension lifecycle management.
- **`highlighter.js`**: Complex DOM interaction and rendering engine.
- **`whiteboard.js`**: Drawing canvas management and coordinate mapping.
- **`ui.js`**: Encapsulated Shadow DOM interface and toolbars.
- **`dom_utils.js`**: Robust traversal, node resolution, and text fragment generation.

### Running Tests
The project uses the native Node.js test runner for comprehensive verification.
```bash
npm test
```

---

## License

Distributed under the GNU GPL v3 license.
