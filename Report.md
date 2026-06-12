📄 PROJECT REPORT
Real-Time Collaborative Diagram Editor (Eraser/Excalidraw Clone)
1. Abstract

This project is a web-based real-time collaborative diagram editor inspired by tools like Eraser.io and Excalidraw. It allows users to create, edit, and share diagrams consisting of basic geometric shapes on an infinite canvas. The system supports real-time collaboration, persistence, undo/redo functionality, and performance-optimized rendering.

The goal of this project is to demonstrate system design, frontend engineering, backend integration, and real-time distributed synchronization techniques.

2. Objective

The main objectives of this project are:

To build a browser-based interactive diagramming tool
To implement real-time collaboration between multiple users
To design a scalable and modular frontend architecture
To implement efficient state management and rendering
To support persistent storage of diagrams
To demonstrate core software engineering and system design principles
3. Technology Stack
Frontend
React (TypeScript)
HTML5 Canvas API
Zustand (State Management)
Vite (Build Tool)
Backend
Node.js
Express.js
WebSocket (ws library)
Storage
File-based JSON persistence (extendable to databases)
4. System Architecture

The system follows a client-server architecture:

Client Side:
Handles rendering of canvas
Processes user interactions (draw, move, resize)
Maintains local state store
Sends user actions to server
Server Side:
Manages WebSocket connections
Broadcasts updates to all connected clients
Handles document persistence via REST APIs
Stores diagram state in JSON format
Shared Layer:
Common TypeScript interfaces for shapes and events
5. Core Features
5.1 Drawing System
Rectangle, Circle, and Line creation
Shape selection and manipulation
Drag-and-drop movement
5.2 Editing Features
Resize shapes
Delete objects
Keyboard shortcuts support
5.3 Undo/Redo System
Command pattern-based architecture
Stack-based state reversal
5.4 Infinite Canvas
Pan and zoom functionality
Grid-based background
Smooth navigation
5.5 Real-Time Collaboration
WebSocket-based synchronization
Multi-user editing support
Live broadcasting of updates
5.6 Persistence
Save and load diagrams via REST API
JSON-based storage system
6. Design Methodology
6.1 State Management

A centralized store manages all diagram objects. Each change is treated as an immutable update to ensure consistency.

6.2 Command Pattern

All user actions (draw, move, delete) are encapsulated as commands, enabling undo/redo functionality.

6.3 Rendering Optimization
Canvas-based rendering for performance
Minimal re-rendering strategy
Event throttling for mouse movements
7. Real-Time Collaboration Design
WebSocket server maintains active sessions
Every user action is broadcast as an event
Clients update local state based on received events
Conflict resolution: Last Write Wins (basic strategy)
8. Limitations
Basic conflict resolution (no CRDT implementation yet)
File-based persistence (not production-scale DB)
Limited shape types
No authentication system
9. Future Improvements
Implement CRDT-based conflict-free editing
Add user authentication and access control
Replace file storage with MongoDB/PostgreSQL
Add shape grouping and layers
Add version history (Git-like system)
Improve rendering using WebGL
10. Learning Outcomes

Through this project, the following concepts were implemented and understood:

Frontend architecture design
Canvas-based rendering systems
WebSocket-based real-time communication
State management patterns
Command design pattern
System design fundamentals
Performance optimization techniques
11. Conclusion

This project successfully demonstrates the design and implementation of a real-time collaborative diagram editor. It combines frontend engineering, backend systems, and real-time networking into a unified application. The system showcases scalable architecture principles and practical software engineering skills relevant to modern SDE roles.

12. Resume Summary (Optional Section)

Built a real-time collaborative diagram editor inspired by Eraser.io using React, TypeScript, and WebSockets, supporting infinite canvas interactions, undo/redo system via command pattern, and persistent document storage.