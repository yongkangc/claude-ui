Please check src/web/console and create a webui for the cui.

Requirements:

- Choose a modern framework good for a chat like interface.
- Only implement the minimal functionality needed to get the job done.
- Use a super minimalistic design with a refreshing flavor of human and slightly TUI design, apply basic light/dark mode feature.
- Make sure it's designed to be easy testable, and easy to extend and mobile friendly.
- The webui are in /src/web/chat, with a debug console version in /src/web/console.

The webui should have:

- Layout:
    - A togglable sidebar that has full width in mobile and on the left in desktop.
    - The main content area, which divided into top like 80% of conversation details and bottom like 20% of multiline prompt input area.
    - So no floating input box. muted and minimal rounded corners with good contrast. I kinda like current src/web/console design
    - Each item in the sidebar is separated by a line.
    - Each item in the conversation details is separated by empty padding.
    - For all item in the conversation details, start with a minimalistic icon (similar to size of text) on the first line, and the rest are indented.

- Sidebar:
    - In each item, summary, update time and status are showed.
- Main content area:
    - in /new page has empty conversation details, but showing input form of fields of conversation/start endpoint.
    - in /c/sessionId page, show the conversation details.
    - The input area will call start endpoint in /new and call resume endpoint in /c/sessionId.
    - Switch between /new and different /c/sessionId should not clear the page or showing loading indicator before the request is done, just replace the conversation details.
- Input area:
    - A multiline input area with a send button.
    - Shift enter to add a new line.
    - Enter to send the prompt.
- Conversation details:
    - Use raw content in "messages.content" field for each message, you can add syntax highlighting and folding from json viewer.
    - Visually indentical, but logically the details are contacnation of /api/conversations/:sessionId and /api/stream/:streamingId(if exist for that sessionId)
    - The streaming output is not maintained. Always go to conversation page with empty streaming content and connect to available streaming and update the streaming content immediately.

When api are called, console log the request and response.

Before start, read @cc-workfiles/knowledge (esp cc-workfiles/knowledge/API.md) and related files carefully to understand the project. Present a plan to me before writing any code