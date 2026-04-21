# Marklet

[![Available in the Chrome Web Store](https://developer.chrome.com/static/images/webstore/ChromeWebStore_Badge_v2_206x58.png)](https://chrome.google.com/webstore/detail/ippbalglimaeggicgdadlkgbobpmbjnb)

![Chrome Web Store Version](https://img.shields.io/chrome-web-store/v/ippbalglimaeggicgdadlkgbobpmbjnb)

**Marklet** is a professional-grade web annotation tool designed for research, documentation, and persistent knowledge management. It enables users to highlight text, create freehand drawings, and add annotations to any web page using a high-fidelity interface isolated within the Shadow DOM.

Designed with a focus on **privacy**, **performance**, and **stability**, Marklet operates entirely within your local browser environment with zero external dependencies.

---

## Key Features

### Precision Highlighting
*   **Robust Persistence**: Utilizes advanced DOM traversal and coordinate mapping to ensure highlights persist across page reloads and dynamic content updates.
*   **Deep Linking**: Generate robust `#:~:text=` Scroll-to-Text fragments that are context-aware (using prefix/suffix) and support long selections.
*   **Contextual UI**: A floating selection toolbar appears instantly when text is selected for one-click highlighting.
*   **Self-Healing Logic**: Automatically recovers and adjusts highlights when underlying page content shifts.
*   **Conflict Resolution**: Intelligently manages overlapping and nested highlights with a smart merging strategy.

### Infinite Whiteboard
*   **Dual-Layer Rendering**: Uses a high-performance HTML5 Canvas for active drawing and automatically converts to SVG for static, scroll-stable persistence.
*   **Smart Shapes**: Dedicated tools for **Rectangles**, **Circles**, **Arrows**, and **Text**.
*   **Object Manipulation**: Select, move, resize, and rotate drawing elements after they have been placed.
*   **Undo/Redo**: Full multi-level history support for all whiteboard interactions.

### Modernized Dashboard & Popup
*   **Sleek Popup Interface**: A redesigned popup with a modern card-style layout for managing page-specific highlights.
*   **Themed List Items**: Highlight items in the popup list automatically adopt a nuanced background shade matching their highlight color for instant visual recognition.
*   **Quick Actions**: Manage snippets directly from the dashboard or popup—**Go to Highlight**, **Copy Text**, or **Delete** with a single click.
*   **Theme Support**: Full **Light**, **Dark**, and **System** theme support across all interfaces.

### Data Portability
*   **Backup & Restore**: Export your entire annotation database to a JSON file for backup or migration.
*   **Granular Import**: Supports selective importing and merging of annotation files with conflict resolution.

### Engineered for Performance
*   **Layered Storage Architecture**:
    *   **`tinyIDB`**: A lightweight, promise-based wrapper for IndexedDB providing fast asynchronous data access.
    *   **`PageStorage`**: A high-level abstraction layer that manages data normalization, batch updates, and cross-context synchronization.
*   **Layout-Aware Caching**: Uses a `WeakMap` display cache to minimize layout-triggering `getComputedStyle` calls.
*   **Zero-Overhead Idle**: Automatically suspends DOM observation when no annotations are present.
*   **Shadow DOM Isolation**: UI components are fully encapsulated to prevent style leaks or conflicts with the host page.

### Privacy & Security
*   **100% Local**: All data is stored locally within the browser using IndexedDB. No data ever leaves your machine.
*   **CSP Compliant**: Fully compatible with strict Content Security Policy (CSP) environments.

---

## Usage Guide

1.  **Highlighting**: Select any text on a webpage. A small toolbar will appear; click a color to highlight.
2.  **Managing Highlights**: Hover over any existing highlight to see the **Edit Toolbar** to change colors, copy a direct link, or delete.
3.  **Drawing**: Click the **Whiteboard** toggle in the popup or use `Alt+Shift+W`. Use the toolbar at the bottom to switch brushes, shapes, and text.
4.  **Dashboard**: Click the **Settings** icon in the popup to browse, search, and manage all saved annotations.

### Hotkeys

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
2.  **Install Dependencies** (for development/testing):
    ```bash
    npm install
    ```
3.  **Load the Extension**:
    *   Navigate to `chrome://extensions` in a Chromium browser.
    *   Enable **"Developer mode"** (top right).
    *   Click **"Load unpacked"** and select the `marklet` directory.

---

## Development & Architecture

### Project Structure
```text
.
├── background.js        # Service worker for storage and context menus
├── content/             # Scripts injected into web pages
│   ├── highlighter.js   # Text highlighting and DOM persistence logic
│   ├── whiteboard.js    # Canvas/SVG drawing implementation
│   ├── ui.js            # Shadow DOM UI components (toolbars, dock)
│   └── dom_utils.js     # DOM traversal and text fragment generation
├── popup/               # Extension popup interface
├── settings/            # Dashboard and configuration page
├── utils/               # Shared utilities and storage abstraction
└── tests/               # Native Node.js test suite
```

### Core Architecture
Marklet follows a **decoupled, event-driven** architecture:
1.  **Injected UI**: All UI elements are injected via a **Shadow Root** to prevent style conflicts.
2.  **Data Persistence**: `Highlighter` and `Whiteboard` modules communicate with `PageStorage`, which proxies requests to the background worker for **IndexedDB** interaction.
3.  **Normalization**: URLs are normalized to ensure highlights persist regardless of tracking parameters or referral links.

### Running Tests
The project uses the native Node.js test runner.
```bash
npm test
```

---

## License

Distributed under the GNU GPL v3 license.
