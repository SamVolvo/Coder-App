# Live Code Editor with Syntax Highlighting

This project demonstrates a simple web-based code editor with live syntax highlighting for JavaScript, built using React. It leverages `react-simple-code-editor` for the editor functionality and `prismjs` for the syntax highlighting.

## Features

*   **Live Syntax Highlighting**: As you type, your JavaScript code is highlighted.
*   **Simple Interface**: A clean and straightforward code editing experience.
*   **Dark Theme**: Uses a dark theme for better readability in low-light environments.

## Technologies Used

*   **React**: A JavaScript library for building user interfaces.
*   **`react-simple-code-editor`**: A lightweight, simple code editor component for React.
*   **`prismjs`**: A lightweight, robust, and elegant syntax highlighter.

## Setup and Installation

Follow these steps to get the project up and running on your local machine.

### Prerequisites

Make sure you have Node.js and npm (or yarn) installed on your system.

*   **Node.js**: [Download & Install Node.js](https://nodejs.org/)

### 1. Create a React App (if you haven't already)

If you're starting from scratch, you can create a new React project using Create React App:

```bash
npx create-react-app my-code-editor
cd my-code-editor
```

### 2. Install Dependencies

Navigate into your project directory and install the necessary packages:

```bash
npm install react-simple-code-editor prismjs
# or
yarn add react-simple-code-editor prismjs
```

### 3. Copy the Code

Replace the contents of `src/App.js`, `src/App.css`, `src/index.js`, `src/index.css`, and `public/index.html` with the provided code.

### 4. Run the Application

Start the development server:

```bash
npm start
# or
yarn start
```

This will open the application in your browser, usually at `http://localhost:3000`.

## Usage

Simply type or paste JavaScript code into the editor area. The syntax will be highlighted in real-time. You can modify the `code` state in `src/App.js` to change the initial content of the editor.

## Customization

*   **Language Highlighting**: To highlight a different language, you would need to import the corresponding `prismjs` component (e.g., `prismjs/components/prism-python`) and change `languages.javascript` to `languages.python` in the `highlight` prop of the `Editor` component in `src/App.js`.
*   **Themes**: You can change the PrismJS theme by importing a different CSS file in `src/App.js` (e.g., `import 'prismjs/themes/prism.css';` for a light theme).
*   **Editor Styles**: Modify `src/App.css` to adjust the editor's appearance, font, padding, etc.
