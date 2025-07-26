Please design a detailed plan to visual refactor the src/web/chat/components/MessageList. I have provided a screenshot of ideal message page in the cc-workfiles/knowledge/ui/message-page.html and cc-workfiles/knowledge/ui/message-page.png.

You need to first describe the image and the html design in detail especially the position, size and style of each element, and study current implementation in src/web/chat/components/MessageList.tsx.

You should copy the html design and implement it in src/web/chat/components/MessageList.tsx. You should:

- render the assistant tool call in the same visual as the "Analyzed" cell in the example, showing all raw calling and results in a code area. The "Analyzed" are replaced by the tool call name.
- render the assistant text message, user text message and input area exactly as the example.
- the header should also be rendered as the example.
- The only difference you are allowed to change is the text font and color. In the example, the text are rendered in secondary style. You should use the body text style for all text. You can also slightly make symbols/title/names bigger, preferbly more lean to default size for body content.

Present the plan to me first.