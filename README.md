# Marklet

Marklet is a professional-grade web annotation tool designed for research, documentation, and persistent knowledge management. It enables users to highlight text, create freehand drawings, and add annotations to any web page using a high-fidelity interface isolated within the Shadow DOM.

Designed with a focus on privacy, performance, and stability, Marklet operates entirely within the local browser environment without external dependencies or data transmission.

## Key Features

### Precision Highlighting
*   **Robust Persistence**: Utilizes the native Range API and advanced DOM traversal to ensure highlights persist across page reloads and dynamic content updates.
*   **Self-Healing Logic**: Automatically recovers and adjusts highlights when underlying page content shifts or updates, ensuring annotations remain accurate on dynamic timelines and applications.
*   **Conflict Resolution**: Intelligently manages overlapping and nested highlights with a smart merging strategy.

### Infinite Whiteboard
*   **Freehand Drawing**: Provides a responsive HTML5 Canvas layer for sketching, diagramming, and hand-written notes.
*   **Vector-like Experience**: smooth paths and adjustable strokes for professional-quality annotations.

### Engineered for Performance
*   **Adaptive Scheduling**: Implements a sophisticated scheduler with trailing debounce and throttling (2000ms - 8000ms intervals) to minimize main-thread impact on highly dynamic pages.
*   **Zero-Overhead Idle**: Automatically suspends DOM observation when no annotations are present, ensuring zero resource usage on passive pages.
*   **Shadow DOM Isolation**: UI components are fully encapsulated, preventing style leaks and conflicts with host page CSS.

### Privacy & Security
*   **Local Storage**: All data is stored locally within the browser using the `chrome.storage` API. No data is ever sent to external servers.
*   **Content Security Policy Compliant**: Designed to work within strict CSP environments.

## Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/Jelodar/marklet.git
    ```
2.  Navigate to `chrome://extensions` in your Chromium-based browser (Chrome, Edge, Brave).
3.  Enable "Developer mode" in the top right corner.
4.  Click "Load unpacked" and select the `marklet` directory.

## Architecture

The project follows a modular, zero-dependency architecture using modern Vanilla JavaScript (ES6+).

### Core Modules

*   **`marklet.js`**: The central controller managing the extension lifecycle, state persistence, and the adaptive mutation observer.
*   **`highlighter.js`**: Handles complex DOM interaction, range normalization, and the highlight rendering engine.
*   **`whiteboard.js`**: Manages the drawing canvas, stroke capture, and coordinate mapping.
*   **`ui.js`**: Renders the floating toolbars and settings interface within the Shadow DOM.
*   **`dom_utils.js`**: A specialized utility library for robust DOM traversal, XPath-like node resolution, and offset calculations.

## Development

The project includes a test suite using the native Node.js test runner.

### Prerequisites
*   Node.js v18+ (for running tests)

### Running Tests
Execute the test suite:
```bash
npm test
```

## Contributing
Contributions are welcome. Please ensure all changes are covered by tests and follow the established code style (Vanilla JS, no external frameworks).

## License

Distributed under the ISC License.
